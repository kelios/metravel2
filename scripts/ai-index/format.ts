/**
 * Контракт артефакта смыслового индекса сайта (#2454).
 *
 * Артефакт — четыре файла в одной директории:
 *   chunks.jsonl   — по одной записи ChunkRecord на строку, порядок = порядок векторов;
 *   vectors.f16    — N × dim чисел IEEE 754 binary16, little-endian, без заголовка;
 *   facts.jsonl    — по одной записи SourceFacts на ИСТОЧНИК (не на фрагмент): проверяемые факты
 *                    каталога для карточки ассистента (#3287, формат версии 2);
 *   manifest.json  — IndexManifest: модель, размерность, число записей, время сборки,
 *                    sha256 источника (детерминизм: те же chunks → тот же sha), версия формата,
 *                    число и sha256 записей фактов.
 *
 * Формат читают сервис metravel-assist (#2456) и MCP metravel-knowledge (#2455);
 * менять поля только с версией в manifest.format_version и правкой этого файла. Справка (#3293) — новые
 * записи `chunks.jsonl` с `type: "help"` и необязательным полем `answer`; у прежних записей ничего не
 * изменилось, поэтому версия формата та же: артефакт без справки читается и пишется как раньше. Артефакт версии 1
 * (без `format_version` и `facts.jsonl`) читается как прежде, фактов в нём нет.
 */
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

import { factsKey, type SourceFacts } from '../../api/aiAssist/sourceFacts.ts'

export type { SourceFacts }

/** `help` — справка о сайте (#3293, `help.ts`): в индексе рядом со статьями и квестами, в выдачу идёт только по явному запросу. */
export type ChunkType = 'travel' | 'quest' | 'help'

export interface ChunkRecord {
  /** Стабильный id: `${t|q}${source_id}-${locale}-${sha256(text)[0:16]}`. */
  id: string
  type: ChunkType
  source_id: number
  /** Абсолютный URL страницы-источника на metravel.by. */
  url: string
  title: string
  city: string | null
  country: string | null
  lat: number | null
  lng: number | null
  /** Месяцы поездки (1–12) для статей; для квестов пусто. */
  month: number[]
  tags: string[]
  /** Язык текста фрагмента: ru для статей, content_locale квеста. */
  locale: string
  text: string
  /** Обложка источника (thumb статьи или cover квеста) для карточек подбора (#2459); null — нет. */
  cover: string | null
  /** Только у справки (#3293): утверждённый ответ записи дословно — его служба отдаёт посетителю. */
  answer?: string
}

export interface IndexSourceCounts {
  travel: number
  quest: number
  /** Записей справки (#3293); поля нет — справки в индексе нет. */
  help?: number
}

export interface IndexManifest {
  model: string
  dim: number
  count: number
  built_at: string
  source_sha256: string
  /** Число статей и квестов в индексе (#3288); у артефактов, собранных раньше, поля нет — считать `countSources`. */
  sources?: IndexSourceCounts
  /** Версия формата артефакта (#3287): 2 — с `facts.jsonl`; поля нет — версия 1. */
  format_version?: number
  /** Записи фактов в `facts.jsonl`: число строк и их sha256. Поля нет — артефакт без фактов. */
  facts?: { count: number; sha256: string }
}

export interface IndexArtifact {
  manifest: IndexManifest
  chunks: ChunkRecord[]
  /** Плоский массив count × dim, нормализованные (L2) векторы. */
  vectors: Float32Array
  /** Факты источников; у артефакта версии 1 — пусто. */
  facts: SourceFacts[]
}

export const CHUNKS_FILE = 'chunks.jsonl'
export const VECTORS_FILE = 'vectors.f16'
export const FACTS_FILE = 'facts.jsonl'
export const MANIFEST_FILE = 'manifest.json'
/** Версия формата, которую пишет `writeIndex`. */
export const INDEX_FORMAT_VERSION = 2

export function sha256Hex(input: string | Buffer): string {
  return createHash('sha256').update(input).digest('hex')
}

export function chunkId(type: ChunkType, sourceId: number, locale: string, text: string): string {
  return `${type === 'travel' ? 't' : type === 'quest' ? 'q' : 'h'}${sourceId}-${locale}-${sha256Hex(text).slice(0, 16)}`
}

/** Детерминированный отпечаток источника: зависит только от содержимого и порядка записей. */
export function sourceSha256(chunks: ChunkRecord[]): string {
  const hash = createHash('sha256')
  for (const chunk of chunks) {
    hash.update(JSON.stringify(chunk))
    hash.update('\n')
  }
  return hash.digest('hex')
}

/** Отпечаток записей фактов — тем же правилом, что у фрагментов. */
export function factsSha256(facts: SourceFacts[]): string {
  const hash = createHash('sha256')
  for (const record of facts) {
    hash.update(JSON.stringify(record))
    hash.update('\n')
  }
  return hash.digest('hex')
}

/**
 * Факты только тех источников, что есть среди фрагментов, по одной записи на источник, в порядке
 * первого фрагмента источника: источник без текста в индекс не попадает, и карточки у него нет.
 */
export function factsForChunks(facts: SourceFacts[], chunks: Array<Pick<ChunkRecord, 'type' | 'source_id'>>): SourceFacts[] {
  const byKey = new Map<string, SourceFacts>()
  for (const record of facts) if (!byKey.has(factsKey(record))) byKey.set(factsKey(record), record)
  const out: SourceFacts[] = []
  const seen = new Set<string>()
  for (const chunk of chunks) {
    const key = factsKey(chunk)
    if (seen.has(key)) continue
    seen.add(key)
    const record = byKey.get(key)
    if (record) out.push(record)
  }
  return out
}

/** Сколько разных статей и квестов описывают фрагменты (квест на пяти локалях — один источник). */
export function countSources(chunks: Array<Pick<ChunkRecord, 'type' | 'source_id'>>): IndexSourceCounts {
  const travel = new Set<number>()
  const quest = new Set<number>()
  const help = new Set<number>()
  for (const chunk of chunks) (chunk.type === 'quest' ? quest : chunk.type === 'help' ? help : travel).add(chunk.source_id)
  // Поле справки появляется только вместе с ней: манифест индекса без справки остаётся прежним.
  return { travel: travel.size, quest: quest.size, ...(help.size ? { help: help.size } : {}) }
}

/** Возраст сборки в целых днях; кривая дата — `null`, чтобы проверка свежести не приняла её за «сегодня». */
export function indexAgeDays(builtAt: string, now: number = Date.now()): number | null {
  const built = Date.parse(builtAt)
  if (!Number.isFinite(built)) return null
  return Math.max(0, Math.floor((now - built) / 86_400_000))
}

const f32 = new Float32Array(1)
const u32 = new Uint32Array(f32.buffer)

/** float32 → биты binary16, округление к ближайшему чётному. */
export function float32ToFloat16Bits(value: number): number {
  f32[0] = value
  const x = u32[0]
  const sign = (x >>> 16) & 0x8000
  const exp = (x >>> 23) & 0xff
  const mant = x & 0x7fffff
  if (exp === 0xff) return sign | 0x7c00 | (mant ? 0x200 : 0)
  const e = exp - 127 + 15
  if (e >= 0x1f) return sign | 0x7c00
  if (e <= 0) {
    if (e < -10) return sign
    const m = mant | 0x800000
    const shift = 14 - e
    let half = m >> shift
    const rem = m & ((1 << shift) - 1)
    const halfway = 1 << (shift - 1)
    if (rem > halfway || (rem === halfway && (half & 1))) half += 1
    return sign | half
  }
  let half = (e << 10) | (mant >> 13)
  const rem = mant & 0x1fff
  if (rem > 0x1000 || (rem === 0x1000 && (half & 1))) half += 1
  return sign | half
}

export function float16BitsToFloat32(bits: number): number {
  const sign = bits & 0x8000 ? -1 : 1
  const exp = (bits >> 10) & 0x1f
  const mant = bits & 0x3ff
  if (exp === 0) return sign * mant * 2 ** -24
  if (exp === 0x1f) return mant ? Number.NaN : sign * Number.POSITIVE_INFINITY
  return sign * (1 + mant / 1024) * 2 ** (exp - 15)
}

export function encodeVectors(vectors: ArrayLike<number>[], dim: number): Buffer {
  const buffer = Buffer.alloc(vectors.length * dim * 2)
  let offset = 0
  for (const vector of vectors) {
    if (vector.length !== dim) {
      throw new Error(`vector length ${vector.length} does not match dim ${dim}`)
    }
    for (let i = 0; i < dim; i += 1) {
      buffer.writeUInt16LE(float32ToFloat16Bits(vector[i]), offset)
      offset += 2
    }
  }
  return buffer
}

export function decodeVectors(buffer: Buffer, dim: number): Float32Array {
  if (dim <= 0 || buffer.length % (dim * 2) !== 0) {
    throw new Error(`vectors buffer of ${buffer.length} bytes is not a multiple of dim ${dim} × 2`)
  }
  const total = buffer.length / 2
  const out = new Float32Array(total)
  for (let i = 0; i < total; i += 1) {
    out[i] = float16BitsToFloat32(buffer.readUInt16LE(i * 2))
  }
  return out
}

export function readJsonl<T>(file: string): T[] {
  if (!fs.existsSync(file)) return []
  const rows: T[] = []
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (trimmed) rows.push(JSON.parse(trimmed) as T)
  }
  return rows
}

function toJsonl(rows: unknown[]): string {
  return rows.map((row) => `${JSON.stringify(row)}\n`).join('')
}

export function writeJsonl(file: string, rows: unknown[]): void {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, toJsonl(rows))
}

export interface ReadIndexOptions {
  /**
   * Не читать `facts.jsonl` (в артефакте будет пустой список). Для тех, кто факты перезаписывает:
   * несовпавший файл фактов не должен стоить пересчёта векторов или мешать его же починке.
   */
  skipFacts?: boolean
}

export function readIndex(distDir: string, options: ReadIndexOptions = {}): IndexArtifact | null {
  const manifestFile = path.join(distDir, MANIFEST_FILE)
  const chunksFile = path.join(distDir, CHUNKS_FILE)
  const vectorsFile = path.join(distDir, VECTORS_FILE)
  if (!fs.existsSync(manifestFile) || !fs.existsSync(chunksFile) || !fs.existsSync(vectorsFile)) {
    return null
  }
  const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8')) as IndexManifest
  const chunks = readJsonl<ChunkRecord>(chunksFile)
  const vectors = decodeVectors(fs.readFileSync(vectorsFile), manifest.dim)
  if (chunks.length !== manifest.count || vectors.length !== manifest.count * manifest.dim) {
    throw new Error(
      `index at ${distDir} is inconsistent: manifest.count=${manifest.count}, chunks=${chunks.length}, vectors=${vectors.length / manifest.dim}`,
    )
  }
  // Файлы заменяются по одному (tmp + rename), поэтому читатель, попавший между rename,
  // может получить chunks от одной сборки и manifest от другой: sha это ловит.
  const sha = sourceSha256(chunks)
  if (sha !== manifest.source_sha256) {
    throw new Error(`index at ${distDir} is inconsistent: source_sha256 ${sha} ≠ manifest ${manifest.source_sha256}`)
  }
  return { manifest, chunks, vectors, facts: options.skipFacts ? [] : readFacts(distDir, manifest) }
}

/**
 * Факты артефакта. Манифест без поля `facts` (версия 1) — пустой список: читатель работает без
 * фактов. Манифест с фактами и несовпавший файл — та же несогласованность, что у фрагментов:
 * файлы заменяются по одному, читатель повторит попытку.
 */
function readFacts(distDir: string, manifest: IndexManifest): SourceFacts[] {
  if (!manifest.facts) return []
  const facts = readJsonl<SourceFacts>(path.join(distDir, FACTS_FILE))
  const sha = factsSha256(facts)
  if (facts.length !== manifest.facts.count || sha !== manifest.facts.sha256) {
    throw new Error(
      `index at ${distDir} is inconsistent: facts.jsonl — ${facts.length} строк, sha256 ${sha}; manifest — ${manifest.facts.count} строк, sha256 ${manifest.facts.sha256}`,
    )
  }
  return facts
}

export function writeIndex(
  distDir: string,
  input: { model: string; dim: number; chunks: ChunkRecord[]; vectors: ArrayLike<number>[]; facts?: SourceFacts[]; builtAt?: string },
): IndexManifest {
  if (input.vectors.length !== input.chunks.length) {
    throw new Error(`chunks (${input.chunks.length}) and vectors (${input.vectors.length}) differ in length`)
  }
  fs.mkdirSync(distDir, { recursive: true })
  const facts = factsForChunks(input.facts ?? [], input.chunks)
  const manifest: IndexManifest = {
    model: input.model,
    dim: input.dim,
    count: input.chunks.length,
    built_at: input.builtAt ?? new Date().toISOString(),
    source_sha256: sourceSha256(input.chunks),
    sources: countSources(input.chunks),
    format_version: INDEX_FORMAT_VERSION,
    facts: { count: facts.length, sha256: factsSha256(facts) },
  }
  replaceFiles([
    [path.join(distDir, VECTORS_FILE), encodeVectors(input.vectors, input.dim)],
    [path.join(distDir, CHUNKS_FILE), toJsonl(input.chunks)],
    [path.join(distDir, FACTS_FILE), toJsonl(facts)],
    [path.join(distDir, MANIFEST_FILE), `${JSON.stringify(manifest, null, 2)}\n`],
  ])
  return manifest
}

/** Замена файлов через tmp + rename; манифест идёт последним — по нему читатель сверяет остальные. */
function replaceFiles(targets: Array<[string, Buffer | string]>): void {
  const tmpSuffix = `.tmp-${process.pid}`
  for (const [file, body] of targets) fs.writeFileSync(file + tmpSuffix, body)
  for (const [file] of targets) fs.renameSync(file + tmpSuffix, file)
}

/**
 * Запись фактов в готовый артефакт без пересчёта векторов (#3287): фрагменты, векторы,
 * `source_sha256` и время сборки не меняются, манифест получает версию формата и отпечаток фактов.
 * Так артефакт версии 1 переводится на версию 2; обычная сборка пишет факты в `writeIndex`.
 */
export function writeFacts(distDir: string, facts: SourceFacts[]): IndexManifest {
  const artifact = readIndex(distDir, { skipFacts: true })
  if (!artifact) throw new Error(`нет артефакта индекса в ${distDir}: ожидались chunks.jsonl, vectors.f16, manifest.json`)
  const kept = factsForChunks(facts, artifact.chunks)
  const manifest: IndexManifest = { ...artifact.manifest, format_version: INDEX_FORMAT_VERSION, facts: { count: kept.length, sha256: factsSha256(kept) } }
  replaceFiles([
    [path.join(distDir, FACTS_FILE), toJsonl(kept)],
    [path.join(distDir, MANIFEST_FILE), `${JSON.stringify(manifest, null, 2)}\n`],
  ])
  return manifest
}

/** Проверка артефакта по правилам карточки: count = строки chunks.jsonl = size(vectors.f16) / (dim × 2). */
export function verifyIndex(distDir: string): { ok: boolean; problems: string[]; manifest: IndexManifest | null } {
  const problems: string[] = []
  const manifestFile = path.join(distDir, MANIFEST_FILE)
  if (!fs.existsSync(manifestFile)) return { ok: false, problems: [`нет ${manifestFile}`], manifest: null }
  const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8')) as IndexManifest
  const chunks = readJsonl<ChunkRecord>(path.join(distDir, CHUNKS_FILE))
  const vectorsFile = path.join(distDir, VECTORS_FILE)
  const vectorBytes = fs.existsSync(vectorsFile) ? fs.statSync(vectorsFile).size : -1
  if (chunks.length !== manifest.count) problems.push(`chunks.jsonl: ${chunks.length} строк, manifest.count=${manifest.count}`)
  if (vectorBytes !== manifest.count * manifest.dim * 2) {
    problems.push(`vectors.f16: ${vectorBytes} байт, ожидалось ${manifest.count * manifest.dim * 2}`)
  }
  const sha = sourceSha256(chunks)
  if (sha !== manifest.source_sha256) problems.push(`source_sha256 не совпадает: ${sha} ≠ ${manifest.source_sha256}`)
  if (manifest.facts) {
    const facts = readJsonl<SourceFacts>(path.join(distDir, FACTS_FILE))
    if (facts.length !== manifest.facts.count) problems.push(`facts.jsonl: ${facts.length} строк, manifest.facts.count=${manifest.facts.count}`)
    const factsSha = factsSha256(facts)
    if (factsSha !== manifest.facts.sha256) problems.push(`facts.sha256 не совпадает: ${factsSha} ≠ ${manifest.facts.sha256}`)
    const known = new Set(chunks.map((chunk) => factsKey(chunk)))
    const foreign = facts.filter((record) => !known.has(factsKey(record))).length
    if (foreign) problems.push(`facts.jsonl: ${foreign} записей об источниках, которых нет в chunks.jsonl`)
  }
  return { ok: problems.length === 0, problems, manifest }
}
