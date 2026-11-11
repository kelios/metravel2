/**
 * Загрузка артефакта индекса для сервиса: та же проверка count + длина vectors + source_sha256,
 * что у `readIndex` (#2454), с повтором — файлы пишутся по одному через rename, и читатель может
 * попасть между ними. Поверх артефакта — карты источников для /ai/similar и фильтра локали.
 */
import fs from 'node:fs'
import path from 'node:path'

import { factsKey, type SourceFacts } from '../../api/aiAssist/sourceFacts.ts'
import { CHUNKS_FILE, type ChunkRecord, type IndexArtifact, readIndex } from '../ai-index/format.ts'
import { sourceKey } from '../ai-index/query.ts'
import { snippet } from './search.ts'

export interface LoadedIndex {
  artifact: IndexArtifact
  /** Строки (индексы фрагментов) каждого источника в порядке файла. */
  rowsBySource: Map<string, number[]>
  /** Локали, в которых источник есть в индексе (у квестов — до пяти, у статей — ru). */
  localesBySource: Map<string, Set<string>>
  /** 0 = travel, 1 = quest — чтобы фильтр типа в горячем цикле не трогал объекты chunks. */
  typeOfRow: Uint8Array
  /**
   * Сниппет каждой строки. Полный текст фрагментов сервису не нужен, а на полном индексе он
   * держит ~100 МБ кучи, поэтому после вычисления сниппетов `chunk.text` обнуляется.
   */
  snippets: string[]
  /** Факты источника по ключу `type:id` (#3287); у артефакта без `facts.jsonl` карта пуста. */
  factsBySource: Map<string, SourceFacts>
  /**
   * Полный текст фрагмента по строке (#3290) — с диска: в памяти остаются только сниппеты. Нужен режиму
   * страницы, который берёт окно текста вокруг слов вопроса. `null` — строку прочитать не удалось
   * (файл подменили на месте); у индекса, собранного без `loadIndex` (тесты), чтения нет вовсе.
   */
  readText?: (row: number) => string | null
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

export interface LoadIndexOptions {
  /** Ключ модели сервиса (AI_ASSIST_MODEL, в образе — запечённая модель); несовпадение с manifest.model — отказ старта. Без него модель берётся из манифеста. */
  expectedModel?: string
  attempts?: number
  retryDelayMs?: number
}

export function indexMaps(artifact: IndexArtifact): Omit<LoadedIndex, 'artifact'> {
  const rowsBySource = new Map<string, number[]>()
  const localesBySource = new Map<string, Set<string>>()
  const typeOfRow = new Uint8Array(artifact.chunks.length)
  const snippets = new Array<string>(artifact.chunks.length)
  artifact.chunks.forEach((chunk, row) => {
    const key = sourceKey(chunk)
    let rows = rowsBySource.get(key)
    if (!rows) {
      rows = []
      rowsBySource.set(key, rows)
      localesBySource.set(key, new Set())
    }
    rows.push(row)
    localesBySource.get(key)!.add(chunk.locale)
    typeOfRow[row] = chunk.type === 'quest' ? 1 : 0
    // Buffer-круг даёт плоскую строку: `slice` в snippet() вернул бы SlicedString, которая держит
    // в куче весь исходный фрагмент (замер: куча 182 МБ вместо ~60 на полном индексе).
    snippets[row] = Buffer.from(snippet(chunk.text), 'utf8').toString('utf8')
    chunk.text = ''
  })
  const factsBySource = new Map<string, SourceFacts>()
  for (const record of artifact.facts) factsBySource.set(factsKey(record), record)
  return { rowsBySource, localesBySource, typeOfRow, snippets, factsBySource }
}

export async function loadIndex(distDir: string, options: LoadIndexOptions): Promise<LoadedIndex> {
  const attempts = options.attempts ?? 3
  let lastError: unknown = null
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const artifact = readIndex(distDir)
      if (!artifact) throw new Error(`нет артефакта индекса в ${distDir}: ожидались chunks.jsonl, vectors.f16, manifest.json`)
      if (options.expectedModel && artifact.manifest.model !== options.expectedModel) {
        throw new IndexModelMismatch(artifact.manifest.model, options.expectedModel)
      }
      return { artifact, ...indexMaps(artifact), readText: openChunkText(path.join(distDir, CHUNKS_FILE), artifact.chunks) }
    } catch (error) {
      if (error instanceof IndexModelMismatch) throw error
      lastError = error
      if (attempt < attempts) await sleep(options.retryDelayMs ?? 1000)
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError))
}

/**
 * Чтение текста фрагмента по номеру строки `chunks.jsonl`. Файл открывается один раз и остаётся
 * открытым: пересборка индекса заменяет его через rename, и открытый описатель продолжает видеть
 * тот файл, по которому посчитаны смещения. Прочитанная запись сверяется по `id` — если файл всё же
 * изменили на месте, чтение отдаёт `null`, и вызывающий берёт сниппет из памяти.
 */
export function openChunkText(file: string, chunks: readonly Pick<ChunkRecord, 'id'>[]): (row: number) => string | null {
  let fd: number
  try {
    fd = fs.openSync(file, 'r')
  } catch {
    return () => null
  }
  // Смещения непустых строк — тем же правилом, что `readJsonl`: пустые строки записью не считаются.
  const starts: number[] = []
  const lengths: number[] = []
  const block = Buffer.alloc(1 << 20)
  let position = 0
  let lineStart = 0
  let hasContent = false
  for (;;) {
    const read = fs.readSync(fd, block, 0, block.length, position)
    if (read <= 0) break
    for (let i = 0; i < read; i += 1) {
      const byte = block[i]
      if (byte === 0x0a) {
        if (hasContent) {
          starts.push(lineStart)
          lengths.push(position + i - lineStart)
        }
        lineStart = position + i + 1
        hasContent = false
      } else if (byte !== 0x20 && byte !== 0x09 && byte !== 0x0d) {
        hasContent = true
      }
    }
    position += read
  }
  if (hasContent) {
    starts.push(lineStart)
    lengths.push(position - lineStart)
  }
  if (starts.length !== chunks.length) return () => null
  return (row) => {
    if (!Number.isInteger(row) || row < 0 || row >= starts.length) return null
    try {
      const buffer = Buffer.alloc(lengths[row])
      fs.readSync(fd, buffer, 0, buffer.length, starts[row])
      const record = JSON.parse(buffer.toString('utf8')) as Partial<ChunkRecord>
      return record.id === chunks[row].id && typeof record.text === 'string' ? record.text : null
    } catch {
      return null
    }
  }
}

export class IndexModelMismatch extends Error {
  readonly indexModel: string
  readonly serviceModel: string

  // Без parameter properties: `--experimental-strip-types` их не принимает.
  constructor(indexModel: string, serviceModel: string) {
    super(
      `индекс собран моделью "${indexModel}", сервис считает запросы моделью "${serviceModel}": ` +
        'пересоберите индекс (`npm run ai:index -- embed --full`) или запустите сервис с AI_ASSIST_MODEL=' +
        indexModel,
    )
    this.name = 'IndexModelMismatch'
    this.indexModel = indexModel
    this.serviceModel = serviceModel
  }
}
