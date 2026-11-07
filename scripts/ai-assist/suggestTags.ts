/**
 * POST /ai/suggest-tags (#2886): подсказка словарных значений визарда статьи по тексту описания.
 * Модель не нужна: текст → вектор → `AI_TAG_SUGGEST_NEIGHBOURS` ближайших статей из индекса
 * (`vectorSources`, тот же подбор, что у `/ai/search`) → у каждой статьи словарные значения из
 * каталога (`GET /api/travels/<id>/`: id стран, категорий, транспорта, компаньонов, ночёвок) →
 * голосование → ответ только из допустимых значений словаря (`GET /api/getFiltersTravel/` и
 * `GET /api/countriesforsearch/`). Ответы каталога и словарь живут в памяти час (`TagCatalog`).
 *
 *   {text, locale?} → 200 {countries, categories, transports, companions, over_nights_stay,
 *                          confidence, degraded, neighbours, took_ms}
 *   400 bad_request — текст короче AI_TAG_SUGGEST_MIN_TEXT_CHARS
 *   503 busy — очередь к эмбеддингу (как у `/ai/search`)
 *   бэкенд недоступен (нет словаря или ни одной статьи) → 200 с пустыми списками,
 *   `confidence: 0`, `degraded: true` — визард просто не показывает блок.
 *
 * Порог голосования: значение берётся, если за него не меньше `max(2, ⌈0.3·k⌉)` статей из k
 * учтённых — два голоса из трёх соседей значимы, два из десяти — нет.
 */
import {
  AI_TAG_SUGGEST_FIELDS,
  AI_TAG_SUGGEST_MAX_TEXT_CHARS,
  AI_TAG_SUGGEST_MIN_TEXT_CHARS,
  AI_TAG_SUGGEST_NEIGHBOURS,
  type AiTagSuggestField,
} from '../../api/aiAssist/policy.ts'
import { LruCache } from './cache.ts'
import { HttpError, parseLocale } from './params.ts'
import { BusyError } from './queue.ts'

/** Текст статьи кириллицей до AI_TAG_SUGGEST_MAX_TEXT_CHARS с запасом на JSON. */
export const SUGGEST_TAGS_MAX_BODY_BYTES = 64 * 1024
export const TAG_CATALOG_TTL_MS = 60 * 60 * 1000
/** Статей в кэше каталога: соседи повторяются между похожими текстами, но весь каталог не нужен. */
export const TAG_CATALOG_CAPACITY = 2000

export type TagValues = Record<AiTagSuggestField, number[]>
export type TagDictionary = Record<AiTagSuggestField, ReadonlySet<number>>

export interface SuggestTagsResponse extends TagValues {
  /** Средняя доля голосов у принятых значений (0..1); 0 — ничего не предложено. */
  confidence: number
  /** Словарь или все соседи недоступны: списки пусты не потому, что текст ни на что не похож. */
  degraded: boolean
  /** Сколько статей проголосовало. */
  neighbours: number
  took_ms: number
}

export interface TagCatalog {
  /** Допустимые id каждого поля; null — бэкенд не ответил. */
  dictionary(): Promise<TagDictionary | null>
  /** Словарные значения статьи; null — бэкенд не ответил или статья не отдана. */
  travelTags(id: number): Promise<TagValues | null>
}

export const emptyTagValues = (): TagValues => ({ countries: [], categories: [], transports: [], companions: [], over_nights_stay: [] })

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value)

const toIds = (value: unknown): number[] => {
  if (!Array.isArray(value)) return []
  const out = new Set<number>()
  for (const raw of value) {
    const id = Number(isRecord(raw) ? (raw.id ?? raw.country_id) : raw)
    if (Number.isInteger(id) && id > 0) out.add(id)
  }
  return [...out]
}

/** Ответ `GET /api/travels/<id>/` → id словарных значений (`countries` там — список country_id). */
export function parseTravelTags(payload: unknown): TagValues | null {
  if (!isRecord(payload)) return null
  const values = emptyTagValues()
  for (const field of AI_TAG_SUGGEST_FIELDS) values[field] = toIds(payload[field])
  return values
}

/** `GET /api/getFiltersTravel/` (+ страны из `GET /api/countriesforsearch/`) → допустимые id. */
export function parseTagDictionary(filters: unknown, countries: unknown): TagDictionary | null {
  if (!isRecord(filters) || !Array.isArray(countries)) return null
  const dictionary = {} as Record<AiTagSuggestField, ReadonlySet<number>>
  for (const field of AI_TAG_SUGGEST_FIELDS) {
    const source = field === 'countries' ? countries : filters[field]
    if (!Array.isArray(source)) return null
    dictionary[field] = new Set(toIds(source))
  }
  return dictionary
}

export function parseSuggestTagsText(value: unknown): string {
  if (typeof value !== 'string') throw new HttpError(400, 'bad_request', 'text: обязательная строка')
  const text = value.replace(/\s+/g, ' ').trim()
  if (text.length < AI_TAG_SUGGEST_MIN_TEXT_CHARS) {
    throw new HttpError(400, 'bad_request', `text: не короче ${AI_TAG_SUGGEST_MIN_TEXT_CHARS} символов`)
  }
  return text.length > AI_TAG_SUGGEST_MAX_TEXT_CHARS ? text.slice(0, AI_TAG_SUGGEST_MAX_TEXT_CHARS) : text
}

export const voteThreshold = (neighbours: number): number => Math.max(2, Math.ceil(neighbours * 0.3))

/**
 * Голосование: каждая статья отдаёт по голосу за каждое своё значение; проходят значения с
 * `voteThreshold(k)` голосами, которые есть в словаре. Порядок — по голосам, затем по id.
 */
export function voteTags(rows: TagValues[], dictionary: TagDictionary): { values: TagValues; confidence: number } {
  const values = emptyTagValues()
  const k = rows.length
  if (!k) return { values, confidence: 0 }
  const threshold = voteThreshold(k)
  let shareSum = 0
  let accepted = 0
  for (const field of AI_TAG_SUGGEST_FIELDS) {
    const votes = new Map<number, number>()
    for (const row of rows) {
      for (const id of new Set(row[field])) votes.set(id, (votes.get(id) ?? 0) + 1)
    }
    values[field] = [...votes.entries()]
      .filter(([id, count]) => count >= threshold && dictionary[field].has(id))
      .sort((a, b) => b[1] - a[1] || a[0] - b[0])
      .map(([id, count]) => {
        shareSum += count / k
        accepted += 1
        return id
      })
  }
  return { values, confidence: accepted ? Math.round((shareSum / accepted) * 100) / 100 : 0 }
}

export interface TagCatalogOptions {
  backendUrl: string
  timeoutMs: number
  ttlMs?: number
  fetchImpl?: typeof fetch
  log?: (line: string) => void
  now?: () => number
}

interface Cached<T> {
  value: T
  expiresAt: number
}

/**
 * Каталог с часовым кэшем в памяти: словарь — один ключ, статьи — LRU. Отказы не кэшируются:
 * следующий запрос попробует снова, а деградация не живёт час.
 */
export function createTagCatalog(options: TagCatalogOptions): TagCatalog {
  const backendUrl = options.backendUrl.replace(/\/+$/, '')
  const fetchImpl = options.fetchImpl ?? fetch
  const now = options.now ?? Date.now
  const ttl = options.ttlMs ?? TAG_CATALOG_TTL_MS
  const log = options.log ?? (() => {})
  const travels = new LruCache<Cached<TagValues>>(TAG_CATALOG_CAPACITY)
  let dictionaryCache: Cached<TagDictionary> | null = null
  let dictionaryInFlight: Promise<TagDictionary | null> | null = null

  async function getJson(path: string): Promise<unknown | null> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), options.timeoutMs)
    try {
      const response = await fetchImpl(`${backendUrl}${path}`, {
        signal: controller.signal,
        headers: { accept: 'application/json', 'user-agent': 'metravel-assist/1.0' },
      })
      if (!response.ok) {
        log(`suggest-tags: ${response.status} от ${path}`)
        return null
      }
      return await response.json()
    } catch (error) {
      log(`suggest-tags: ${path}: ${error instanceof Error ? error.message : String(error)}`)
      return null
    } finally {
      clearTimeout(timer)
    }
  }

  async function loadDictionary(): Promise<TagDictionary | null> {
    const [filters, countries] = await Promise.all([getJson('/api/getFiltersTravel/'), getJson('/api/countriesforsearch/')])
    const dictionary = parseTagDictionary(filters, countries)
    if (dictionary) dictionaryCache = { value: dictionary, expiresAt: now() + ttl }
    return dictionary
  }

  return {
    async dictionary() {
      if (dictionaryCache && dictionaryCache.expiresAt > now()) return dictionaryCache.value
      // Один полёт на всех: параллельные запросы не дёргают бэкенд дважды за тем же словарём.
      if (!dictionaryInFlight) dictionaryInFlight = loadDictionary().finally(() => (dictionaryInFlight = null))
      return dictionaryInFlight
    },
    async travelTags(id) {
      const key = String(id)
      const cached = travels.get(key)
      if (cached && cached.expiresAt > now()) return cached.value
      const values = parseTravelTags(await getJson(`/api/travels/${id}/`))
      if (values) travels.set(key, { value: values, expiresAt: now() + ttl })
      return values
    },
  }
}

export interface SuggestTagsDeps {
  catalog: TagCatalog
  /** Вектор текста через очередь эмбеддинга `/ai/search`; `BusyError` → 503 busy. */
  embed: (text: string) => Promise<ArrayLike<number>>
  /** id ближайших статей индекса по вектору. */
  neighbours: (vector: ArrayLike<number>, limit: number) => number[]
  log: (line: string) => void
}

export type SuggestTagsHandler = (body: unknown) => Promise<SuggestTagsResponse>

const elapsedMs = (started: bigint) => Math.round(Number(process.hrtime.bigint() - started) / 1e4) / 100

export function createSuggestTagsHandler(deps: SuggestTagsDeps): SuggestTagsHandler {
  return async (body) => {
    const started = process.hrtime.bigint()
    const input = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>
    const text = parseSuggestTagsText(input.text)
    // Локаль проверяется ради единого контракта `/ai/*`; статьи индексируются только в ru.
    parseLocale(input.locale)

    let vector: ArrayLike<number>
    try {
      vector = await deps.embed(text)
    } catch (error) {
      if (error instanceof BusyError) throw new HttpError(503, 'busy', error.message)
      throw error
    }
    const ids = deps.neighbours(vector, AI_TAG_SUGGEST_NEIGHBOURS)
    const [dictionary, ...rows] = await Promise.all([deps.catalog.dictionary(), ...ids.map((id) => deps.catalog.travelTags(id))])
    const voters = rows.filter((row): row is TagValues => row !== null)
    const degraded = !dictionary || (ids.length > 0 && voters.length === 0)
    const { values, confidence } = dictionary ? voteTags(voters, dictionary) : { values: emptyTagValues(), confidence: 0 }
    if (degraded) deps.log(`POST /ai/suggest-tags: degraded (словарь ${dictionary ? 'есть' : 'нет'}, статей ${voters.length}/${ids.length})`)
    return { ...values, confidence, degraded, neighbours: voters.length, took_ms: elapsedMs(started) }
  }
}
