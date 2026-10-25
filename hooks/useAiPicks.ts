/**
 * React Query поверх `api/aiPicks` (#2459). Один запрос без ретраев, час в кэше:
 * при отказе службы блок исчезает, а повторная попытка приходит только со
 * следующим монтированием после `staleTime`.
 */
import { useQuery } from '@tanstack/react-query'

import { fetchAiSearch, fetchAiSimilar, AI_SEARCH_MIN_QUERY_LENGTH, type AiPickType } from '@/api/aiPicks'
import { queryKeys } from '@/api/queryKeys'
import { getActiveLocale } from '@/i18n'
import { isAiPicksEnabled } from '@/utils/aiPicksConfig'

const HOUR_MS = 60 * 60 * 1000

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
  const numericId = typeof id === 'number' && Number.isInteger(id) && id > 0 ? id : 0
  return useQuery({
    queryKey: queryKeys.aiSimilar(type, numericId, locale, resultType ?? 'all'),
    queryFn: ({ signal }) => fetchAiSimilar({ type, id: numericId, locale, limit, resultType, signal }),
    enabled: enabled && isAiPicksEnabled() && numericId > 0,
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
