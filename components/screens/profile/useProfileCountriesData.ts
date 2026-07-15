import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'

import { fetchAllCountries } from '@/api/misc'
import { queryKeys } from '@/api/queryKeys'
import { fetchUserCountryProgress } from '@/api/user'
import type { TravelStatusEntry } from '@/stores/travelStatusStore'
import type { Travel } from '@/types/types'
import { queryConfigs } from '@/utils/reactQueryConfig'

import {
  buildCountryApplicationRows,
  buildProfileCountryStats,
  buildProfileCountryStatsFromProgress,
} from './profileCountries'

type ProfileCountriesDataInput = {
  userId: string | number | null | undefined
  travels: Travel[]
  personalTravelStatusEntries: TravelStatusEntry[]
  travelsSyncing: boolean
  loadedTravelsCount: number
  totalTravelsCount: number
}

export function useProfileCountriesData({
  userId,
  travels,
  personalTravelStatusEntries,
  travelsSyncing,
  loadedTravelsCount,
  totalTravelsCount,
}: ProfileCountriesDataInput) {
  const [countries, setCountries] = useState<unknown[]>([])
  const [countriesLoading, setCountriesLoading] = useState(false)
  const [countriesError, setCountriesError] = useState(false)
  const countryProgressQuery = useQuery({
    queryKey: queryKeys.userCountryProgress(userId),
    queryFn: () => fetchUserCountryProgress(userId as string | number),
    enabled: Boolean(userId),
    ...queryConfigs.dynamic,
  })
  const shouldLoadFallbackCatalog = !userId || countryProgressQuery.isError

  useEffect(() => {
    if (!shouldLoadFallbackCatalog) {
      setCountries([])
      setCountriesLoading(false)
      setCountriesError(false)
      return
    }

    const controller = new AbortController()
    let mounted = true

    setCountriesLoading(true)
    setCountriesError(false)
    fetchAllCountries({ signal: controller.signal, throwOnError: true })
      .then((nextCountries) => {
        if (mounted) setCountries(nextCountries)
      })
      .catch((error) => {
        if (!mounted || (error instanceof Error && error.name === 'AbortError')) return
        setCountriesError(true)
        setCountries([])
      })
      .finally(() => {
        if (mounted) setCountriesLoading(false)
      })

    return () => {
      mounted = false
      controller.abort()
    }
  }, [shouldLoadFallbackCatalog])

  const backendStats = useMemo(
    () => countryProgressQuery.data
      ? buildProfileCountryStatsFromProgress(countryProgressQuery.data)
      : null,
    [countryProgressQuery.data],
  )
  const fallbackStats = useMemo(
    () => buildProfileCountryStats({ countries, travels, personalTravelStatusEntries }),
    [countries, personalTravelStatusEntries, travels],
  )
  const stats = backendStats ?? fallbackStats
  const applicationRows = useMemo(() => buildCountryApplicationRows(stats.rows), [stats.rows])
  const progressPercent = stats.totalCount > 0
    ? Math.min(100, Math.round((stats.visitedCount / stats.totalCount) * 100))
    : 0

  return {
    applicationRows,
    stats,
    progressPercent,
    isInitialLoading:
      (countryProgressQuery.isLoading && !backendStats && stats.rows.length === 0) ||
      (shouldLoadFallbackCatalog && countriesLoading && stats.rows.length === 0),
    showCatalogError:
      (countryProgressQuery.isError || countriesError) && stats.rows.length === 0,
    showFallbackCatalogLoading: shouldLoadFallbackCatalog && countriesLoading,
    showPartialCatalogWarning:
      !backendStats && (countryProgressQuery.isError || countriesError) && stats.rows.length > 0,
    showTravelsSyncing:
      !backendStats && travelsSyncing && totalTravelsCount > 0 && loadedTravelsCount < totalTravelsCount,
  }
}
