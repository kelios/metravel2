/**
 * Чистая логика подбора: векторные кандидаты → схлопывание по источникам → RRF с лексикой.
 * Ни HTTP, ни модели: всё тестируется на фикстурном индексе.
 */
import type { ChunkRecord, ChunkType } from '../ai-index/format.ts'
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
}

export const SNIPPET_CHARS = 200
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
  const wantType = query.type === undefined ? null : query.type === 'quest' ? 1 : 0
  const accept = wantType === null ? undefined : (row: number) => typeOfRow[row] === wantType
  let scanK = query.limit * (query.type === 'travel' ? 4 : 4 * LOCALES.length)
  for (;;) {
    const hits = topK(query.vector, artifact, scanK, accept)
    const seen = new Set<string>()
    const out: Hit[] = []
    for (const hit of hits) {
      const key = sourceKey(hit.chunk)
      if (key === query.excludeSource || seen.has(key)) continue
      if (hit.chunk.type === 'quest' && hit.chunk.locale !== query.locale && localesBySource.get(key)?.has(query.locale)) {
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
