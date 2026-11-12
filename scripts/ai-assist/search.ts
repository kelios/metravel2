/**
 * Чистая логика подбора: векторные кандидаты → схлопывание по источникам → RRF с лексикой.
 * Ни HTTP, ни модели: всё тестируется на фикстурном индексе.
 */
import type { ChunkRecord, ChunkType } from '../ai-index/format.ts'
import { HELP_ANSWER_TAG } from '../ai-index/help.ts'
import { type Hit, sourceKey, topK } from '../ai-index/query.ts'
import type { LoadedIndex } from './index.ts'
import type { LexicalHit } from './lexical.ts'

export const LOCALES = ['ru', 'be', 'uk', 'pl', 'en'] as const
export type Locale = (typeof LOCALES)[number]

export interface ResultItem {
  type: ChunkType
  source_id: number
  title: string
  url: string
  snippet: string
  /** Косинус лучшего фрагмента источника; null — источник пришёл только из лексики. */
  score: number | null
  city: string | null
  country: string | null
  lat: number | null
  lng: number | null
  /** Обложка для карточки подбора; null — показывать плейсхолдер. */
  cover: string | null
  /** Только у справки (#3293): утверждённый ответ записи дословно. */
  answer?: string
}

/** Код типа строки индекса (`LoadedIndex.typeOfRow`): статья, квест, справка (#3293). */
export const ROW_TYPE: Readonly<Record<ChunkType, number>> = { travel: 0, quest: 1, help: 2 }

export const SNIPPET_CHARS = 200
/**
 * Длина текстового фрагмента в карточке `/ai/ask` — после строки фактов (#3287), по типу источника.
 * `SNIPPET_CHARS` остаётся длиной сниппета выдачи `/ai/search`; здесь — сколько из него уходит в
 * подсказку модели. Значения выбраны замером токенов на 30 вопросах живого набора
 * (`docs/features/ai-assistant.md` → «Бюджет подсказки службы»): строка фактов добавляет к карточке
 * ≈ 29 токенов, и при прежних 200 знаках медиана подсказки выросла бы с 1340 до 1573; при 120 и 60
 * она остаётся прежней (1316). Квесту хватает короткого фрагмента: его карточка несёт факты, а
 * модель училась на карточке квеста вовсе без текста. Качество ответов на этих длинах меряется на
 * модели продукта; окружение службы переопределяет значения без правки кода
 * (`AI_ASSIST_ASK_FRAGMENT_TRAVEL_CHARS`, `AI_ASSIST_ASK_FRAGMENT_QUEST_CHARS`), 0 — карточка без
 * текстового фрагмента.
 */
export const ASK_FRAGMENT_CHARS: Readonly<Record<Exclude<ChunkType, 'help'>, number>> = { travel: 120, quest: 60 }
/** Сколько источников берёт векторная половина гибрида до слияния. */
export const VECTOR_SOURCES = 50
/** Константа RRF из статьи Cormack et al.: сглаживает разрыв между первыми местами. */
export const RRF_K = 60

export function snippet(text: string, max = SNIPPET_CHARS): string {
  const flat = text.replace(/\s+/g, ' ').trim()
  if (flat.length <= max) return flat
  const cut = flat.slice(0, max)
  const space = cut.lastIndexOf(' ')
  return `${space > max / 2 ? cut.slice(0, space) : cut}…`
}

export function itemForRow(index: LoadedIndex, row: number, score: number | null): ResultItem {
  const chunk: ChunkRecord = index.artifact.chunks[row]
  return {
    type: chunk.type,
    source_id: chunk.source_id,
    title: chunk.title,
    url: chunk.url,
    snippet: index.snippets[row],
    score,
    city: chunk.city,
    country: chunk.country,
    lat: chunk.lat,
    lng: chunk.lng,
    cover: chunk.cover ?? null,
    ...(chunk.answer ? { answer: chunk.answer } : {}),
  }
}

export interface VectorQuery {
  vector: ArrayLike<number>
  locale: Locale
  type?: ChunkType
  /** Источник, который надо исключить (сам документ в /ai/similar). */
  excludeSource?: string
  limit: number
}

/**
 * Лучший фрагмент на источник. Квест лежит в индексе на нескольких локалях с почти одинаковыми
 * векторами, поэтому сканируем с запасом, оставляем фрагмент запрошенной локали, если источник
 * на ней есть, и схлопываем до `limit` источников. Если скан схлопнулся в меньше источников,
 * чем просили (один квест на 5 локалях — до сотни строк), скан расширяется, пока источников не
 * хватит или строки подходящего типа не кончатся.
 */
export function vectorSources(index: LoadedIndex, query: VectorQuery): Hit[] {
  const { artifact, typeOfRow, localesBySource } = index
  // Без типа — статьи и квесты: справка (#3293) идёт в выдачу только по явному `type: 'help'`.
  const wantType = query.type === undefined ? null : ROW_TYPE[query.type]
  const accept = wantType === null ? (row: number) => typeOfRow[row] !== ROW_TYPE.help : (row: number) => typeOfRow[row] === wantType
  let scanK = query.limit * (query.type === 'travel' ? 4 : 4 * LOCALES.length)
  for (;;) {
    const hits = topK(query.vector, artifact, scanK, accept)
    const seen = new Set<string>()
    const out: Hit[] = []
    for (const hit of hits) {
      const key = sourceKey(hit.chunk)
      if (key === query.excludeSource || seen.has(key)) continue
      // Квест и запись справки лежат на нескольких локалях: остаётся фрагмент локали запроса, если он есть.
      if (hit.chunk.type !== 'travel' && hit.chunk.locale !== query.locale && localesBySource.get(key)?.has(query.locale)) {
        continue
      }
      seen.add(key)
      out.push(hit)
      if (out.length >= query.limit) break
    }
    if (out.length >= query.limit || hits.length < scanK || scanK >= artifact.manifest.count) return out
    scanK = Math.min(scanK * 4, artifact.manifest.count)
  }
}

export interface HelpHit {
  /** Строка лучшей формулировки записи: её заголовок — заголовок карточки. */
  row: number
  /** Близость лучшей формулировки записи к вопросу (косинус). */
  cosine: number
  /** Балл порядка: среднее двух лучших формулировок плюс близость ответа. */
  score: number
  /** Тема записи корпуса: вторая запись ответа берётся только из той же темы. */
  topic: string
}

/**
 * Записи справки по близости к вопросу (#3293). Порядок — не по одной лучшей формулировке, а по записи
 * целиком: среднее двух лучших формулировок плюс близость ответа. По одной формулировке первой вставала
 * соседняя запись: на «Ці ёсць у квэсце падказкі?» — «сообщить о неточности», на «Ці трэба рэгістравацца?» —
 * «как зарегистрироваться». Замер 12.11.2026 (`.codex-temp/train2/help-rank.mts`): верная первая запись на
 * 17 вопросах о сайте набора — 13 → 17; на 650 формулировках корпуса без самой формулировки — 440 → 496.
 * Запись берётся на локали вопроса, если переведена, иначе на любой (RU). Возвращаются все записи: вызывающий
 * сам берёт первые и по самой близкой формулировке среди всех решает, отвечает ли справка.
 */
export function helpHits(index: LoadedIndex, vector: ArrayLike<number>, locale: Locale): HelpHit[] {
  const { artifact, typeOfRow, rowsBySource, localesBySource } = index
  const { dim } = artifact.manifest
  const cosine = (row: number): number => {
    let sum = 0
    const offset = row * dim
    for (let i = 0; i < dim; i += 1) sum += artifact.vectors[offset + i] * vector[i]
    return sum
  }
  const hits: HelpHit[] = []
  for (const [key, rows] of rowsBySource) {
    if (typeOfRow[rows[0]] !== ROW_TYPE.help) continue
    const localized = localesBySource.get(key)?.has(locale) ? rows.filter((row) => artifact.chunks[row].locale === locale) : rows
    const variants = localized.filter((row) => !artifact.chunks[row].tags.includes(HELP_ANSWER_TAG)).map((row) => ({ row, value: cosine(row) })).sort((a, b) => b.value - a.value)
    if (!variants.length) continue
    const answerRow = localized.find((row) => artifact.chunks[row].tags.includes(HELP_ANSWER_TAG))
    const top = variants.slice(0, 2)
    const score = top.reduce((sum, item) => sum + item.value, 0) / top.length + (answerRow === undefined ? 0 : cosine(answerRow))
    hits.push({ row: variants[0].row, cosine: variants[0].value, score, topic: artifact.chunks[variants[0].row].tags[1] ?? '' })
  }
  return hits.sort((a, b) => b.score - a.score || a.row - b.row)
}

/** Вектор источника для /ai/similar: нормализованное среднее его фрагментов (на нужной локали, если есть). */
export function sourceVector(index: LoadedIndex, key: string, locale: Locale): Float32Array | null {
  const rows = index.rowsBySource.get(key)
  if (!rows?.length) return null
  const { dim } = index.artifact.manifest
  const localized = rows.filter((row) => index.artifact.chunks[row].locale === locale)
  const use = localized.length ? localized : rows
  const out = new Float32Array(dim)
  for (const row of use) {
    const offset = row * dim
    for (let i = 0; i < dim; i += 1) out[i] += index.artifact.vectors[offset + i]
  }
  let norm = 0
  for (let i = 0; i < dim; i += 1) norm += out[i] * out[i]
  norm = Math.sqrt(norm) || 1
  for (let i = 0; i < dim; i += 1) out[i] /= norm
  return out
}

export interface SimilarQuery {
  /** Источник: `travel:816`, `quest:13`. */
  key: string
  locale: Locale
  resultType?: ChunkType
  limit: number
}

/**
 * Смысловые соседи источника — одна функция для `GET /ai/similar` и для предрасчёта слепка
 * «похожих» (#3292, `similarArtifact.ts`): живой ответ и статический файл не расходятся.
 * `null` — источника нет в индексе.
 */
export function similarHits(index: LoadedIndex, query: SimilarQuery): Hit[] | null {
  const vector = sourceVector(index, query.key, query.locale)
  if (!vector) return null
  return vectorSources(index, { vector, locale: query.locale, type: query.resultType, excludeSource: query.key, limit: query.limit })
}

export interface RankedSource {
  key: string
  item: ResultItem
}

/**
 * Reciprocal Rank Fusion двух списков источников. Элемент, которого нет в индексе (лексика нашла
 * статью, опубликованную после сборки), остаётся с данными лексики и пустым snippet.
 */
export function rrfMerge(vector: Hit[], lexical: LexicalHit[], index: LoadedIndex, limit: number): ResultItem[] {
  const scores = new Map<string, number>()
  const items = new Map<string, ResultItem>()
  vector.forEach((hit, rank) => {
    const key = sourceKey(hit.chunk)
    scores.set(key, (scores.get(key) ?? 0) + 1 / (RRF_K + rank + 1))
    items.set(key, itemForRow(index, hit.index, hit.score))
  })
  lexical.forEach((hit, rank) => {
    const key = `travel:${hit.source_id}`
    scores.set(key, (scores.get(key) ?? 0) + 1 / (RRF_K + rank + 1))
    if (items.has(key)) return
    const row = index.rowsBySource.get(key)?.[0]
    items.set(
      key,
      row === undefined
        ? {
            type: 'travel',
            source_id: hit.source_id,
            title: hit.title,
            url: hit.url,
            snippet: '',
            score: null,
            city: hit.city,
            country: hit.country,
            lat: null,
            lng: null,
            cover: hit.cover,
          }
        : itemForRow(index, row, null),
    )
  })
  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([key]) => items.get(key)!)
}

/** Ключ кэша: нормализованный запрос + параметры; регистр и пробелы не плодят записи. */
export function normalizeQuery(q: string): string {
  return q.normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim()
}
