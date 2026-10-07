import { useMemo } from 'react'

import { useCountryProgressStats } from '@/hooks/useCountryProgressStats'
import type { TravelStatusEntry } from '@/stores/travelStatusStore'
import type { Travel } from '@/types/types'

import { buildCountryApplicationRows } from './profileCountries'

type ProfileCountriesDataInput = {
  userId: string | number | null | undefined
  travels: Travel[]
  personalTravelStatusEntries: TravelStatusEntry[]
  travelsSyncing: boolean
  loadedTravelsCount: number
  /** `null` — счётчик маршрутов недоступен из-за сбоя, а не равен нулю (#1871). */
  totalTravelsCount: number | null
}

export function useProfileCountriesData({
  userId,
  travels,
  personalTravelStatusEntries,
  travelsSyncing,
  loadedTravelsCount,
  totalTravelsCount,
}: ProfileCountriesDataInput) {
  const {
    stats,
    backendStats,
    countryProgressQuery,
    shouldLoadFallbackCatalog,
    countriesLoading,
    countriesError,
    isInitialLoading,
    hasCatalogError,
  } = useCountryProgressStats({ userId, travels, personalTravelStatusEntries })

  const applicationRows = useMemo(() => buildCountryApplicationRows(stats.rows), [stats.rows])
  const progressPercent = stats.totalCount > 0
    ? Math.min(100, Math.round((stats.visitedCount / stats.totalCount) * 100))
    : 0

  return {
    applicationRows,
    stats,
    progressPercent,
    isInitialLoading,
    showCatalogError: hasCatalogError,
    showFallbackCatalogLoading: shouldLoadFallbackCatalog && countriesLoading,
    showPartialCatalogWarning:
      !backendStats && (countryProgressQuery.isError || countriesError) && stats.rows.length > 0,
    showTravelsSyncing:
      !backendStats && travelsSyncing && totalTravelsCount != null && totalTravelsCount > 0 && loadedTravelsCount < totalTravelsCount,
  }
}
