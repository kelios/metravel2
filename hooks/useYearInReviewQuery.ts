import { useQuery } from '@tanstack/react-query'

import { fetchYearInReview, type YearInReview } from '@/api/advent'
import { queryKeys } from '@/api/queryKeys'
import { useQueryOwner } from '@/hooks/useQueryOwner'
import { readRetryOnce } from '@/utils/queryRetryPolicy'

/** Личные «Итоги года» для финальной дверцы адвента (#2868, бэкенд — #2865). */
export function useYearInReviewQuery(year: number, enabled = true) {
  const owner = useQueryOwner()
  return useQuery<YearInReview>({
    queryKey: queryKeys.adventYearInReview(owner, year),
    queryFn: ({ signal }) => fetchYearInReview(year, signal),
    enabled: enabled && owner !== null,
    // Агрегат кэшируется на сервере на час — чаще перезапрашивать незачем.
    staleTime: 10 * 60 * 1000,
    retry: readRetryOnce,
  })
}
