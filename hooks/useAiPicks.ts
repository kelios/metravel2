/**
 * React Query поверх `api/aiPicks` (#2459). Один запрос без ретраев, час в кэше:
 * при отказе службы блок исчезает, а повторная попытка приходит только со
 * следующим монтированием после `staleTime`.
 */
import { useQuery } from '@tanstack/react-query'

import { fetchAiSearch, fetchAiSimilar, fetchNearRoute, AI_SEARCH_MIN_QUERY_LENGTH, type AiNearRoutePoint, type AiPickType } from '@/api/aiPicks'
import { queryKeys } from '@/api/queryKeys'
import { aiSimilarQueryKey, toAiSimilarSourceId } from '@/hooks/useAiSimilarAvailability'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { getActiveLocale } from '@/i18n'
import { isAiPicksEnabled, isAiSimilarEnabled } from '@/utils/aiPicksConfig'

const HOUR_MS = 60 * 60 * 1000
/** Пауза после правки маршрута (#2911): перетаскивание и серия добавлений — один запрос. */
export const AI_NEAR_ROUTE_DEBOUNCE_MS = 800

export interface UseAiSimilarOptions {
  type: AiPickType
  id: number | null | undefined
  limit: number
  /** Что показывать: статьи или квесты; без значения — оба типа. */
  resultType?: AiPickType
  enabled?: boolean
}

export function useAiSimilar({ type, id, limit, resultType, enabled = true }: UseAiSimilarOptions) {
  const locale = getActiveLocale()
  const numericId = toAiSimilarSourceId(id)
  return useQuery({
    queryKey: aiSimilarQueryKey(type, numericId, locale, resultType),
    queryFn: ({ signal }) => fetchAiSimilar({ type, id: numericId, locale, limit, resultType, signal }),
    // #3292: блоки «Похожие» работают и без службы — на статическом слепке.
    enabled: enabled && isAiSimilarEnabled() && numericId > 0,
    staleTime: HOUR_MS,
    gcTime: HOUR_MS,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  })
}

export const normalizeAiSearchQuery = (value: string): string => value.trim().replace(/\s+/g, ' ')

export function useAiSearch(rawQuery: string, { limit = 12, enabled = true }: { limit?: number; enabled?: boolean } = {}) {
  const locale = getActiveLocale()
  const q = normalizeAiSearchQuery(rawQuery)
  return useQuery({
    queryKey: queryKeys.aiSearch(q, locale),
    queryFn: ({ signal }) => fetchAiSearch({ q, locale, limit, signal }),
    enabled: enabled && isAiPicksEnabled() && q.length >= AI_SEARCH_MIN_QUERY_LENGTH,
    staleTime: HOUR_MS,
    gcTime: HOUR_MS,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  })
}

/** Отпечаток маршрута для ключа запроса: `lat,lng` до 3 знаков (~100 м) через `;` — сдвиг маркера на метры кэш не сбрасывает. */
export const nearRoutePointsKey = (points: AiNearRoutePoint[]): string =>
  points.map((point) => `${point.lat.toFixed(3)},${point.lng.toFixed(3)}`).join(';')

const isEmptyRoute = (points: AiNearRoutePoint[]) => points.length === 0

/**
 * Материалы сайта в коридоре маршрута планировщика (#2911). Точки дебаунсятся
 * `AI_NEAR_ROUTE_DEBOUNCE_MS`; пустой маршрут применяется сразу и запроса не делает.
 */
export function useAiNearRoute(points: AiNearRoutePoint[], { limit = 8, enabled = true }: { limit?: number; enabled?: boolean } = {}) {
  const locale = getActiveLocale()
  const settled = useDebouncedValue(points, AI_NEAR_ROUTE_DEBOUNCE_MS, isEmptyRoute)
  return useQuery({
    queryKey: queryKeys.aiNearRoute(nearRoutePointsKey(settled), locale),
    queryFn: ({ signal }) => fetchNearRoute({ points: settled, locale, limit, signal }),
    enabled: enabled && isAiPicksEnabled() && settled.length > 0,
    staleTime: HOUR_MS,
    gcTime: HOUR_MS,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  })
}
