import { useMemo } from 'react'

import {
  buildVisitedCountryIndex,
  type VisitedCountryMeta,
} from '@/components/screens/profile/profileCountries'
import { useCountryProgressStats } from '@/hooks/useCountryProgressStats'
import type { TravelStatusEntry } from '@/stores/travelStatusStore'
import type { Travel } from '@/types/types'

export type UseVisitedCountriesParams = {
  userId: string | number | null | undefined
  travels?: Travel[]
  personalTravelStatusEntries?: TravelStatusEntry[]
}

export type UseVisitedCountriesResult = {
  visitedCodes: Set<string>
  byCode: Map<string, VisitedCountryMeta>
  visitedCount: number
  remainingCount: number
  totalCount: number
  isLoading: boolean
  isError: boolean
}

const EMPTY_TRAVELS: Travel[] = []
const EMPTY_STATUS_ENTRIES: TravelStatusEntry[] = []

/**
 * Derives the set of visited countries (ISO alpha-2, UPPERCASE) for a user.
 * Prefers the server-side country-progress payload and falls back to the local
 * catalog + travels/«Был здесь» computation, mirroring ProfileCountriesTab.
 * Errors degrade gracefully to an empty set — never throws.
 */
export function useVisitedCountries({
  userId,
  travels = EMPTY_TRAVELS,
  personalTravelStatusEntries = EMPTY_STATUS_ENTRIES,
}: UseVisitedCountriesParams): UseVisitedCountriesResult {
  const { stats, isInitialLoading, hasCatalogError } = useCountryProgressStats({
    userId,
    travels,
    personalTravelStatusEntries,
  })

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
