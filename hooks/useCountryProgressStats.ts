import { useCallback, useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'

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
  enabled: boolean
  travels: Travel[]
  personalTravelStatusEntries: TravelStatusEntry[]
}

const EMPTY_COUNTRIES: unknown[] = []
const EMPTY_STATS = buildProfileCountryStatsFromProgress({ countries: [] })

/** Owns country progress for both profile tabs and computes local data only on degradation. */
export function useCountryProgressStats({
  userId,
  enabled,
  travels,
  personalTravelStatusEntries,
}: UseCountryProgressStatsParams) {
  const queryClient = useQueryClient()
  const queryKey = useMemo(() => queryKeys.userCountryProgress(userId), [userId])
  const isEnabled = enabled && Boolean(userId)
  const countryProgressQuery = useQuery({
    queryKey,
    queryFn: async () => {
      if (!userId) throw new Error('Country progress requires a profile owner')
      const progress = await fetchUserCountryProgress(userId)
      if (!Array.isArray(progress?.countries)) throw new Error('Missing country progress catalog')
      return progress
    },
    enabled: isEnabled,
    ...queryConfigs.dynamic,
  })

  const shouldLoadFallbackCatalog = isEnabled &&
    countryProgressQuery.isError && !countryProgressQuery.data

  const [countries, setCountries] = useState<unknown[] | null>(null)

  useEffect(() => {
    if (!shouldLoadFallbackCatalog) {
      setCountries(null)
      return
    }

    const controller = new AbortController()
    fetchAllCountriesOptimized({ signal: controller.signal })
      .then((nextCountries) => {
        if (!controller.signal.aborted) setCountries(nextCountries)
      })
      .catch(() => {
        if (!controller.signal.aborted) setCountries([])
      })
    return () => controller.abort()
  }, [shouldLoadFallbackCatalog])

  const backendStats = useMemo(
    () =>
      countryProgressQuery.data
        ? buildProfileCountryStatsFromProgress(countryProgressQuery.data)
        : null,
    [countryProgressQuery.data],
  )

  const stats = useMemo(() => {
    if (backendStats) return backendStats
    if (!shouldLoadFallbackCatalog) return EMPTY_STATS
    return buildProfileCountryStats({ countries: countries ?? EMPTY_COUNTRIES, travels, personalTravelStatusEntries })
  }, [backendStats, countries, personalTravelStatusEntries, shouldLoadFallbackCatalog, travels])

  const countriesLoading = shouldLoadFallbackCatalog && countries === null
  const isInitialLoading = !backendStats && (
    (isEnabled && countryProgressQuery.isPending) ||
    (countriesLoading && stats.rows.length === 0)
  )
  const hasCatalogError = shouldLoadFallbackCatalog && !isInitialLoading && stats.rows.length === 0

  const { refetch: refetchQuery } = countryProgressQuery
  const refetch = useCallback(async () => {
    const pending = refetchQuery({ cancelRefetch: false })
    // A paused request will resume with connectivity. Keep the refresh control usable.
    if (queryClient.getQueryState(queryKey)?.fetchStatus === 'paused') return
    await pending
  }, [queryClient, queryKey, refetchQuery])

  return useMemo(() => ({
    stats,
    backendStats,
    refetch,
    shouldLoadFallbackCatalog,
    countriesLoading,
    isInitialLoading,
    hasCatalogError,
  }), [stats, backendStats, refetch, shouldLoadFallbackCatalog, countriesLoading, isInitialLoading, hasCatalogError])
}

export type CountryProgressStats = ReturnType<typeof useCountryProgressStats>
