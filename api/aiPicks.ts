/**
 * Клиент службы metravel-assist для смыслового подбора (#2459, контракт #2456):
 *   GET  /ai/similar?type=&id=&limit=&locale=&result_type= → {items, took_ms, index_built_at}
 *   POST /ai/search  {q, locale, type?, limit?}            → {items, took_ms, degraded, cached}
 * `items[]` — карточки материалов сайта: `url` абсолютный, `cover` может быть null.
 * Одна попытка без ретраев: при отказе блоки просто не показываются.
 */
import { Platform } from 'react-native'

import { ApiError } from '@/api/clientErrors'
import { fetchWithTimeout } from '@/utils/fetchWithTimeout'
import { buildAiPicksUrl } from '@/utils/aiPicksConfig'
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
  cover: string | null
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

/** Похожие материалы для источника; источник вне индекса (404) — пустой список, не ошибка. */
export async function fetchAiSimilar({ type, id, locale, limit, resultType, signal }: FetchAiSimilarParams): Promise<AiPickItem[]> {
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
