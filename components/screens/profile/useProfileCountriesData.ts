import { useMemo } from 'react'

import type { CountryProgressStats } from '@/hooks/useCountryProgressStats'

import { buildCountryApplicationRows } from './profileCountries'

type ProfileCountriesDataInput = {
  progress: CountryProgressStats
  travelsSyncing: boolean
  loadedTravelsCount: number
  /** `null` — счётчик маршрутов недоступен из-за сбоя, а не равен нулю (#1871). */
  totalTravelsCount: number | null
}

export function useProfileCountriesData({
  progress,
  travelsSyncing,
  loadedTravelsCount,
  totalTravelsCount,
}: ProfileCountriesDataInput) {
  const {
    stats,
    backendStats,
    shouldLoadFallbackCatalog,
    countriesLoading,
    isInitialLoading,
    hasCatalogError,
  } = progress

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
      shouldLoadFallbackCatalog && stats.rows.length > 0,
    showTravelsSyncing:
      !backendStats && travelsSyncing && totalTravelsCount != null && totalTravelsCount > 0 && loadedTravelsCount < totalTravelsCount,
  }
}
