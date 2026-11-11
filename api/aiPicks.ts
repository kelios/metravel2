/**
 * Клиент службы metravel-assist для смыслового подбора (#2459, контракт #2456):
 *   GET  /ai/similar?type=&id=&limit=&locale=&result_type= → {items, took_ms, index_built_at}
 *        либо, при `EXPO_PUBLIC_AI_SIMILAR_SOURCE=static` (#3292), статический слепок
 *        `/assets/data/ai-similar.json` — тот же ответ, посчитанный заранее
 *   POST /ai/search  {q, locale, type?, limit?}            → {items, took_ms, degraded, cached}
 *   POST /ai/near-route {points: [{lat, lng}], limit, locale} → {items, took_ms} (#2911)
 * `items[]` — карточки материалов сайта: `url` абсолютный, `cover` может быть null.
 * Одна попытка без ретраев: при отказе блоки просто не показываются.
 */
import { Platform } from 'react-native'

import { ApiError } from '@/api/clientErrors'
import { fetchWithTimeout } from '@/utils/fetchWithTimeout'
import { buildAiPicksUrl, getAiSimilarSource, getAiSimilarStaticUrl } from '@/utils/aiPicksConfig'
import { parseQuestLocaleRoute } from '@/utils/questLocaleRouting'

export type AiPickType = 'travel' | 'quest'

export interface AiPickItem {
  type: AiPickType
  source_id: number
  title: string
  /** Абсолютный URL страницы на сайте. */
  url: string
  /** Путь для навигации внутри приложения, из `url`. */
  path: string
  snippet: string
  score: number | null
  city: string | null
  country: string | null
  /** Координаты источника из индекса; null — у источника их нет (#2911: точка маршрута из карточки). */
  lat: number | null
  lng: number | null
  cover: string | null
}

export interface AiNearRoutePoint {
  lat: number
  lng: number
}

export interface AiSearchResult {
  items: AiPickItem[]
  took_ms: number
  /** Лексическая половина гибрида не ответила вовремя — выдача только векторная. */
  degraded: boolean
}

export const AI_PICKS_TIMEOUT_MS = 4000
export const AI_SEARCH_MIN_QUERY_LENGTH = 3
export const AI_SEARCH_MAX_QUERY_LENGTH = 500
/** Точек маршрута в запросе `/ai/near-route` — потолок службы; длиннее — прореживается равномерно. */
export const AI_NEAR_ROUTE_MAX_POINTS = 50

type RawItem = Partial<Record<keyof AiPickItem, unknown>>

const isType = (value: unknown): value is AiPickType => value === 'travel' || value === 'quest'

function sitePathOf(url: string): string {
  try {
    const parsed = new URL(url)
    return `${parsed.pathname}${parsed.search}` || '/'
  } catch {
    return url.startsWith('/') ? url : '/'
  }
}

/**
 * Путь для `router.push`. Локальные версии квестов (`/en/quests/…`) есть только на
 * web (`app/[...missing].web.tsx`); native открывает тот же квест его RU-маршрутом,
 * а не экран «не найдено».
 */
export function toSitePath(url: string, platform: string = Platform.OS): string {
  const path = sitePathOf(url)
  if (platform === 'web') return path
  const questRoute = parseQuestLocaleRoute(path)
  return questRoute ? `/quests/${questRoute.cityId}/${questRoute.questSlug}` : path
}

function normalizeItem(raw: unknown): AiPickItem | null {
  if (!raw || typeof raw !== 'object') return null
  const item = raw as RawItem
  const sourceId = Number(item.source_id)
  if (!isType(item.type) || !Number.isInteger(sourceId) || sourceId <= 0) return null
  if (typeof item.title !== 'string' || typeof item.url !== 'string' || !item.url) return null
  return {
    type: item.type,
    source_id: sourceId,
    title: item.title,
    url: item.url,
    path: toSitePath(item.url),
    snippet: typeof item.snippet === 'string' ? item.snippet : '',
    score: typeof item.score === 'number' ? item.score : null,
    city: typeof item.city === 'string' && item.city ? item.city : null,
    country: typeof item.country === 'string' && item.country ? item.country : null,
    lat: typeof item.lat === 'number' && Number.isFinite(item.lat) ? item.lat : null,
    lng: typeof item.lng === 'number' && Number.isFinite(item.lng) ? item.lng : null,
    cover: typeof item.cover === 'string' && /^https?:\/\//.test(item.cover) ? item.cover : null,
  }
}

function normalizeItems(value: unknown): AiPickItem[] {
  if (!Array.isArray(value)) return []
  return value.map(normalizeItem).filter((item): item is AiPickItem => item !== null)
}

async function requestJson(url: string, init: RequestInit): Promise<unknown> {
  const response = await fetchWithTimeout(url, init, AI_PICKS_TIMEOUT_MS)
  if (!response.ok) throw new ApiError(response.status, `ai-picks ${response.status}`)
  return (await response.json()) as unknown
}

export interface FetchAiSimilarParams {
  type: AiPickType
  id: number
  locale: string
  limit: number
  resultType?: AiPickType
  /** Сигнал React Query: уход со страницы отменяет запрос. */
  signal?: AbortSignal
}

/** Форма слепка «похожих» (#3292, `scripts/ai-assist/similarArtifact.ts`): карточки статей и списки id соседей. */
interface AiSimilarArtifact {
  cards: Record<string, unknown>
  travel: Record<string, unknown>
  quest: Record<string, unknown>
}

const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)

function parseSimilarArtifact(body: unknown): AiSimilarArtifact {
  if (!isRecord(body) || body.version !== 1 || !isRecord(body.cards)) throw new ApiError(502, 'ai-similar: unexpected artifact shape')
  return { cards: body.cards, travel: isRecord(body.travel) ? body.travel : {}, quest: isRecord(body.quest) ? body.quest : {} }
}

/**
 * Слепок один на все страницы: читается первым блоком «Похожие» и живёт до перезагрузки.
 * Запрос не привязан к сигналу страницы — уход с неё не должен ронять загрузку для следующей;
 * отказ кэш не занимает, следующий блок попробует снова.
 */
let similarArtifactRequest: Promise<AiSimilarArtifact> | null = null

function loadSimilarArtifact(): Promise<AiSimilarArtifact> {
  if (!similarArtifactRequest) {
    const request = requestJson(getAiSimilarStaticUrl(), { method: 'GET' }).then(parseSimilarArtifact)
    request.catch(() => {
      if (similarArtifactRequest === request) similarArtifactRequest = null
    })
    similarArtifactRequest = request
  }
  return similarArtifactRequest
}

/** Сброс кэша слепка — только для тестов. */
export function resetAiSimilarArtifactCacheForTests(): void {
  similarArtifactRequest = null
}

/**
 * Соседи из слепка: в нём только статьи (оба блока сайта просят `result_type=travel`), поэтому
 * запрос квестов-соседей даёт пустой список. Источника нет в слепке (материал новее сборки
 * индекса) — пустой список, блок не показывается, как при `404` службы.
 */
async function fetchAiSimilarStatic({ type, id, limit, resultType }: FetchAiSimilarParams): Promise<AiPickItem[]> {
  if (resultType === 'quest') return []
  const artifact = await loadSimilarArtifact()
  const ids = artifact[type][String(id)]
  if (!Array.isArray(ids)) return []
  const items: AiPickItem[] = []
  for (const neighbour of ids) {
    const card = artifact.cards[String(neighbour)]
    const item = isRecord(card) ? normalizeItem({ ...card, type: 'travel', source_id: neighbour }) : null
    if (item) items.push(item)
    if (items.length >= limit) break
  }
  return items
}

/** Похожие материалы для источника; источник вне индекса (404) — пустой список, не ошибка. */
export async function fetchAiSimilar(request: FetchAiSimilarParams): Promise<AiPickItem[]> {
  if (getAiSimilarSource() === 'static') return fetchAiSimilarStatic(request)
  const { type, id, locale, limit, resultType, signal } = request
  const params = new URLSearchParams({ type, id: String(id), limit: String(limit), locale })
  if (resultType) params.set('result_type', resultType)
  try {
    const body = (await requestJson(buildAiPicksUrl(`/similar?${params.toString()}`), { method: 'GET', signal })) as {
      items?: unknown
    }
    return normalizeItems(body?.items)
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return []
    throw error
  }
}

export interface FetchAiSearchParams {
  q: string
  locale: string
  limit: number
  type?: AiPickType
  signal?: AbortSignal
}

export async function fetchAiSearch({ q, locale, limit, type, signal }: FetchAiSearchParams): Promise<AiSearchResult> {
  const body = (await requestJson(buildAiPicksUrl('/search'), {
    method: 'POST',
    signal,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ q: q.slice(0, AI_SEARCH_MAX_QUERY_LENGTH), locale, limit, ...(type ? { type } : {}) }),
  })) as { items?: unknown; took_ms?: unknown; degraded?: unknown }
  return {
    items: normalizeItems(body?.items),
    took_ms: typeof body?.took_ms === 'number' ? body.took_ms : 0,
    degraded: body?.degraded === true,
  }
}

export interface FetchNearRouteParams {
  points: AiNearRoutePoint[]
  locale: string
  limit: number
  signal?: AbortSignal
}

/** Равномерная выборка до `max` точек: сервис принимает не больше 50, концы маршрута сохраняются. */
export function thinRoutePoints<T>(points: T[], max: number = AI_NEAR_ROUTE_MAX_POINTS): T[] {
  if (points.length <= max) return points
  const step = (points.length - 1) / (max - 1)
  return Array.from({ length: max }, (_, i) => points[Math.round(i * step)])
}

/** Материалы сайта в коридоре маршрута (#2911); пустой маршрут — пустой список без запроса. */
export async function fetchNearRoute({ points, locale, limit, signal }: FetchNearRouteParams): Promise<AiPickItem[]> {
  if (!points.length) return []
  const body = (await requestJson(buildAiPicksUrl('/near-route'), {
    method: 'POST',
    signal,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ points: thinRoutePoints(points), limit, locale }),
  })) as { items?: unknown }
  return normalizeItems(body?.items)
}
