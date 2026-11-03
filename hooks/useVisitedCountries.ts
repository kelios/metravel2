import { useMemo } from 'react'

import {
  buildVisitedCountryIndex,
  type VisitedCountryMeta,
} from '@/components/screens/profile/profileCountries'
import type { CountryProgressStats } from '@/hooks/useCountryProgressStats'

export type UseVisitedCountriesResult = {
  visitedCodes: Set<string>
  byCode: Map<string, VisitedCountryMeta>
  visitedCount: number
  remainingCount: number
  totalCount: number
  isLoading: boolean
  isError: boolean
}

export function useVisitedCountries({
  stats,
  isInitialLoading,
  hasCatalogError,
}: CountryProgressStats): UseVisitedCountriesResult {
  const index = useMemo(() => buildVisitedCountryIndex(stats.rows), [stats.rows])

  return {
    visitedCodes: index.visitedCodes,
    byCode: index.byCode,
    visitedCount: stats.visitedCount,
    remainingCount: stats.remainingCount,
    totalCount: stats.totalCount,
    isLoading: isInitialLoading,
    isError: hasCatalogError,
  }
}
