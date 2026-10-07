import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'

import { fetchAllCountriesOptimized } from '@/api/miscOptimized'
import { queryKeys } from '@/api/queryKeys'
import { fetchUserCountryProgress } from '@/api/user'
import {
  buildProfileCountryStats,
  buildProfileCountryStatsFromProgress,
} from '@/components/screens/profile/profileCountries'
import type { TravelStatusEntry } from '@/stores/travelStatusStore'
import type { Travel } from '@/types/types'
import { queryConfigs } from '@/utils/reactQueryConfig'

export type UseCountryProgressStatsParams = {
  userId: string | number | null | undefined
  travels: Travel[]
  personalTravelStatusEntries: TravelStatusEntry[]
}

/**
 * Shared core of the profile «Страны» tab and the world map: the server-side
 * country-progress query with a fallback to the local catalog + travels/«Был
 * здесь» computation. Two line-for-line copies of this logic used to live in
 * `useVisitedCountries` and `useProfileCountriesData` (HK-10); both now derive
 * their view models from this hook.
 */
export function useCountryProgressStats({
  userId,
  travels,
  personalTravelStatusEntries,
}: UseCountryProgressStatsParams) {
  const countryProgressQuery = useQuery({
    queryKey: queryKeys.userCountryProgress(userId),
    queryFn: () => fetchUserCountryProgress(userId as string | number),
    enabled: Boolean(userId),
    ...queryConfigs.dynamic,
  })

  const shouldLoadFallbackCatalog = !userId || countryProgressQuery.isError

  const [countries, setCountries] = useState<unknown[]>([])
  const [countriesLoading, setCountriesLoading] = useState(false)
  const [countriesError, setCountriesError] = useState(false)

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

    fetchAllCountriesOptimized({ signal: controller.signal })
      .then((nextCountries) => {
        if (mounted) setCountries(nextCountries)
      })
      .catch((error: unknown) => {
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
    () =>
      countryProgressQuery.data
        ? buildProfileCountryStatsFromProgress(countryProgressQuery.data)
        : null,
    [countryProgressQuery.data],
  )

  const fallbackStats = useMemo(
    () => buildProfileCountryStats({ countries, travels, personalTravelStatusEntries }),
    [countries, personalTravelStatusEntries, travels],
  )

  const stats = backendStats ?? fallbackStats

  const isInitialLoading =
    (countryProgressQuery.isLoading && !backendStats && stats.rows.length === 0) ||
    (shouldLoadFallbackCatalog && countriesLoading && stats.rows.length === 0)

  const hasCatalogError =
    (countryProgressQuery.isError || countriesError) && stats.rows.length === 0

  return {
    stats,
    backendStats,
    countryProgressQuery,
    shouldLoadFallbackCatalog,
    countriesLoading,
    countriesError,
    isInitialLoading,
    hasCatalogError,
  }
}
