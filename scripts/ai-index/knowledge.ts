/**
 * Логика инструментов MCP `metravel-knowledge` (#2455) поверх артефакта индекса (#2454):
 * search / similar / coverage / gaps. Ни транспорта, ни модели — всё тестируется на
 * фикстурном индексе с подменённым `embedQuery`.
 *
 * Векторная часть (top-k, схлопывание по источникам, вектор источника) берётся из
 * `scripts/ai-assist/search.ts`: сервис сайта и MCP редакции обязаны ранжировать одинаково,
 * иначе «похожие статьи» у владельца и у читателя разойдутся.
 */
import { indexMaps, type LoadedIndex } from '../ai-assist/index.ts'
import { sourceVector, vectorSources } from '../ai-assist/search.ts'
import { type ChunkRecord, type ChunkType, readIndex } from './format.ts'
import { EMBEDDING_MODELS } from './models.ts'
import { type Hit, sourceKey } from './query.ts'

export const DEFAULT_INDEX_DIR = '.codex-temp/ai-index/dist'
export const DEFAULT_LIMIT = 10
export const MAX_LIMIT = 50
/** Радиус, в котором первая точка статьи считается «статьёй про это место» для `gaps`. */
export const NEARBY_KM = 10

export interface KnowledgeIndex extends LoadedIndex {
  /**
   * Нормализованные (`normalizeText`) тексты фрагментов: indexMaps обнуляет chunk.text ради кучи
   * сервиса, а coverage/gaps ищут упоминания по тексту. Нормализуются один раз при открытии, а не
   * на каждый вызов: coverage иначе прогоняет NFD по всему индексу (~280 мс на 20 тыс. фрагментов).
   */
  normalizedTexts: string[]
  /** Страны источника во всех локалях (у квестов country локализован: Польша / Polska / Poland). */
  countriesBySource: Map<string, Set<string>>
}

export class KnowledgeModelMismatch extends Error {
  readonly indexModel: string
  readonly expectedModel: string

  constructor(indexModel: string, expectedModel: string) {
    super(
      `индекс собран моделью "${indexModel}", сервер ожидает "${expectedModel}": ` +
        'пересоберите индекс (`npm run ai:index -- embed --full`) или уберите/поправьте METRAVEL_AI_INDEX_MODEL',
    )
    this.name = 'KnowledgeModelMismatch'
    this.indexModel = indexModel
    this.expectedModel = expectedModel
  }
}

export interface OpenIndexOptions {
  /** Строгий ключ модели (METRAVEL_AI_INDEX_MODEL); без него модель берётся из манифеста, но обязана быть в реестре. */
  expectedModel?: string
}

/**
 * Читает артефакт и проверяет модель до старта транспорта: запрос, посчитанный другой моделью,
 * даёт правдоподобный, но случайный список — лучше отказ с понятной строкой.
 */
export function openKnowledgeIndex(distDir: string, options: OpenIndexOptions = {}): KnowledgeIndex {
  const artifact = readIndex(distDir)
  if (!artifact) {
    throw new Error(
      `нет артефакта индекса в ${distDir}: ожидались chunks.jsonl, vectors.f16, manifest.json ` +
        '(соберите `npm run ai:index -- build` или укажите METRAVEL_AI_INDEX_DIR)',
    )
  }
  const { model } = artifact.manifest
  if (options.expectedModel && options.expectedModel !== model) {
    throw new KnowledgeModelMismatch(model, options.expectedModel)
  }
  if (!options.expectedModel && !EMBEDDING_MODELS[model]) {
    throw new KnowledgeModelMismatch(model, Object.keys(EMBEDDING_MODELS).join(' | '))
  }
  const normalizedTexts = artifact.chunks.map((chunk) => normalizeText(chunk.text))
  const maps = indexMaps(artifact)
  const countriesBySource = new Map<string, Set<string>>()
  artifact.chunks.forEach((chunk) => {
    if (!chunk.country) return
    const key = sourceKey(chunk)
    let set = countriesBySource.get(key)
    if (!set) {
      set = new Set()
      countriesBySource.set(key, set)
    }
    set.add(normalizeText(chunk.country))
  })
  return { artifact, ...maps, normalizedTexts, countriesBySource }
}

/**
 * Нижний регистр, ё→е, латиница без диакритики (Kraków = Krakow), один пробел. Диакритика
 * снимается только после латинской буквы: у кириллицы «й», «ў», «ї» в NFD — тоже база + знак,
 * и общее удаление дало бы «оицув» вместо «ойцув» в видимых `stems`.
 */
export function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/(?<=[a-z])[\u0300-\u036f]+/gi, '')
    .normalize('NFC')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

/**
 * Основы слов для лексического поиска упоминаний: падежи RU/BE/UK/PL различаются 1–3 последними
 * буквами («Беловежская пуща» → «беловежск», «пущ»; «Krakowa» → «krak»). Это не морфология, а
 * префикс с запасом; ложные срабатывания («скал» ⊂ «скалолаз») допустимы для подсказки редактору.
 */
export function placeStems(place: string): string[] {
  return normalizeText(place)
    .split(' ')
    .filter(Boolean)
    .map((word) => {
      if (word.length <= 3) return word
      if (word.length <= 5) return word.slice(0, -1)
      if (word.length <= 8) return word.slice(0, -2)
      return word.slice(0, -3)
    })
}

const mentionsAll = (normalized: string, stems: string[]) => stems.length > 0 && stems.every((stem) => normalized.includes(stem))

export interface KnowledgeItem {
  score: number
  type: ChunkType
  source_id: number
  title: string
  url: string
  snippet: string
  city: string | null
  country: string | null
}

export interface SearchParams {
  query: string
  limit?: number
  type?: ChunkType
  country?: string
}

export interface SimilarParams {
  type: ChunkType
  source_id: number
  limit?: number
}

export interface CoverageSource {
  id: number
  title: string
  url: string
  city: string | null
  country: string | null
  /** Фрагментов источника с упоминанием места (на одной локали: ru, если есть). */
  mentions: number
  in_title: boolean
}

export interface CoverageResult {
  place: string
  stems: string[]
  travels: CoverageSource[]
  quests: CoverageSource[]
}

export interface GapPlace {
  place: string
  /** Квесты этого места (ru-заголовок и URL). */
  quests: Array<{ id: number; title: string; url: string }>
  /** Статей, где место упоминается в тексте без собственной статьи. */
  mentioned_in: number
}

export interface GapsResult {
  country: string
  sources: { travels: number; quests: number }
  /** Места из квестов и статей страны без собственной статьи. */
  gaps: GapPlace[]
  /** Места страны, у которых статья есть (по city, заголовку или точке ≤ NEARBY_KM). */
  covered: Array<{ place: string; travels: number }>
}

export interface Knowledge {
  search: (params: SearchParams) => Promise<KnowledgeItem[]>
  /** null — источника нет в индексе. */
  similar: (params: SimilarParams) => KnowledgeItem[] | null
  coverage: (place: string) => CoverageResult
  gaps: (country: string) => GapsResult
}

export type EmbedQuery = (query: string) => Promise<Float32Array>

const clampLimit = (limit: number | undefined) => Math.min(MAX_LIMIT, Math.max(1, Math.trunc(limit ?? DEFAULT_LIMIT)))

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const rad = Math.PI / 180
  const dLat = (lat2 - lat1) * rad
  const dLng = (lng2 - lng1) * rad
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(a))
}

export function createKnowledge(index: KnowledgeIndex, embedQuery: EmbedQuery): Knowledge {
  const { artifact, rowsBySource, normalizedTexts, countriesBySource } = index

  const item = (hit: Hit): KnowledgeItem => {
    const chunk = artifact.chunks[hit.index]
    return {
      score: Number(hit.score.toFixed(4)),
      type: chunk.type,
      source_id: chunk.source_id,
      title: chunk.title,
      url: chunk.url,
      snippet: index.snippets[hit.index],
      city: chunk.city,
      country: chunk.country,
    }
  }

  const inCountry = (key: string, country: string | undefined) =>
    !country || (countriesBySource.get(key)?.has(normalizeText(country)) ?? false)

  /** Строки источника на предпочтительной локали: ru, если есть, иначе первая в файле. */
  const preferredRows = (key: string): number[] => {
    const rows = rowsBySource.get(key) ?? []
    const ru = rows.filter((row) => artifact.chunks[row].locale === 'ru')
    if (ru.length) return ru
    const first = rows.length ? artifact.chunks[rows[0]].locale : null
    return rows.filter((row) => artifact.chunks[row].locale === first)
  }

  const headChunk = (key: string): ChunkRecord => artifact.chunks[preferredRows(key)[0]]

  const sourcesByCountry = (country: string) =>
    [...rowsBySource.keys()].filter((key) => inCountry(key, country))

  const mentionRows = (key: string, stems: string[]) =>
    preferredRows(key).filter((row) => mentionsAll(normalizedTexts[row], stems)).length

  const coverage = (place: string): CoverageResult => {
    const stems = placeStems(place)
    const travels: CoverageSource[] = []
    const quests: CoverageSource[] = []
    if (!stems.length) return { place, stems, travels, quests }
    for (const key of rowsBySource.keys()) {
      const head = headChunk(key)
      const inTitle = mentionsAll(normalizeText(head.title), stems)
      const inCity = head.city ? mentionsAll(normalizeText(head.city), stems) : false
      const mentions = mentionRows(key, stems)
      if (!inTitle && !inCity && mentions === 0) continue
      const entry: CoverageSource = {
        id: head.source_id,
        title: head.title,
        url: head.url,
        city: head.city,
        country: head.country,
        mentions,
        in_title: inTitle || inCity,
      }
      ;(head.type === 'travel' ? travels : quests).push(entry)
    }
    const order = (a: CoverageSource, b: CoverageSource) =>
      Number(b.in_title) - Number(a.in_title) || b.mentions - a.mentions || a.id - b.id
    travels.sort(order)
    quests.sort(order)
    return { place, stems, travels, quests }
  }

  const gaps = (country: string): GapsResult => {
    const keys = sourcesByCountry(country)
    const travelKeys = keys.filter((key) => headChunk(key).type === 'travel')
    const questKeys = keys.filter((key) => headChunk(key).type === 'quest')
    // Место → квесты и координаты. Имена точек маршрута (coordsMeTravel) в артефакт #2454 не
    // входят (только lat/lng первой точки), поэтому кандидаты — города квестов и статей.
    const places = new Map<string, { label: string; quests: GapPlace['quests']; lat: number | null; lng: number | null }>()
    const addPlace = (chunk: ChunkRecord) => {
      if (!chunk.city) return null
      const id = normalizeText(chunk.city)
      let entry = places.get(id)
      if (!entry) {
        entry = { label: chunk.city, quests: [], lat: chunk.lat, lng: chunk.lng }
        places.set(id, entry)
      }
      if (entry.lat === null && chunk.lat !== null) {
        entry.lat = chunk.lat
        entry.lng = chunk.lng
      }
      return entry
    }
    for (const key of questKeys) {
      const head = headChunk(key)
      addPlace(head)?.quests.push({ id: head.source_id, title: head.title, url: head.url })
    }
    for (const key of travelKeys) addPlace(headChunk(key))

    const travelHeads = travelKeys.map(headChunk)
    const result: GapsResult = { country, sources: { travels: travelKeys.length, quests: questKeys.length }, gaps: [], covered: [] }
    for (const [, place] of places) {
      const stems = placeStems(place.label)
      const own = travelHeads.filter((head) => {
        if (head.city && mentionsAll(normalizeText(head.city), stems)) return true
        if (mentionsAll(normalizeText(head.title), stems)) return true
        return (
          place.lat !== null &&
          place.lng !== null &&
          head.lat !== null &&
          head.lng !== null &&
          haversineKm(place.lat, place.lng, head.lat, head.lng) <= NEARBY_KM
        )
      }).length
      if (own > 0) {
        result.covered.push({ place: place.label, travels: own })
        continue
      }
      const mentionedIn = travelKeys.filter((key) => mentionRows(key, stems) > 0).length
      result.gaps.push({ place: place.label, quests: place.quests, mentioned_in: mentionedIn })
    }
    result.gaps.sort((a, b) => b.quests.length - a.quests.length || b.mentioned_in - a.mentioned_in || a.place.localeCompare(b.place))
    result.covered.sort((a, b) => b.travels - a.travels || a.place.localeCompare(b.place))
    return result
  }

  const rank = (vector: Float32Array, limit: number, type: ChunkType | undefined, country: string | undefined, excludeSource?: string) => {
    // Фильтр страны — после схлопывания по источникам: сканируем с запасом и расширяем, пока
    // источников не хватит или индекс не кончится.
    let scan = country ? limit * 4 : limit
    for (;;) {
      const hits = vectorSources(index, { vector, locale: 'ru', type, excludeSource, limit: scan })
      const kept = hits.filter((hit) => inCountry(sourceKey(hit.chunk), country))
      if (kept.length >= limit || hits.length < scan || scan >= rowsBySource.size) return kept.slice(0, limit).map(item)
      scan = Math.min(scan * 4, rowsBySource.size)
    }
  }

  return {
    async search(params) {
      const query = params.query.trim()
      if (!query) return []
      const vector = await embedQuery(query)
      return rank(vector, clampLimit(params.limit), params.type, params.country)
    },
    similar(params) {
      const key = `${params.type}:${params.source_id}`
      const vector = sourceVector(index, key, 'ru')
      if (!vector) return null
      return rank(vector, clampLimit(params.limit), undefined, undefined, key)
    },
    coverage,
    gaps,
  }
}
