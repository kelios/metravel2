import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'

import { fetchAllCountries } from '@/api/misc'
import { queryKeys } from '@/api/queryKeys'
import { fetchUserCountryProgress } from '@/api/user'
import {
  buildProfileCountryStats,
  buildProfileCountryStatsFromProgress,
  buildVisitedCountryIndex,
  type VisitedCountryMeta,
} from '@/components/screens/profile/profileCountries'
import type { TravelStatusEntry } from '@/stores/travelStatusStore'
import type { Travel } from '@/types/types'
import { queryConfigs } from '@/utils/reactQueryConfig'

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

    fetchAllCountries({ signal: controller.signal, throwOnError: true })
      .then((nextCountries) => {
        if (!mounted) return
        setCountries(nextCountries)
      })
      .catch((error: unknown) => {
        if (!mounted) return
        if (error instanceof Error && error.name === 'AbortError') return
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
    () =>
      buildProfileCountryStats({
        countries,
        travels,
        personalTravelStatusEntries,
      }),
    [countries, personalTravelStatusEntries, travels],
  )

  const stats = backendStats ?? fallbackStats

  const index = useMemo(() => buildVisitedCountryIndex(stats.rows), [stats.rows])

  const isLoading =
    (countryProgressQuery.isLoading && !backendStats && stats.rows.length === 0) ||
    (shouldLoadFallbackCatalog && countriesLoading && stats.rows.length === 0)

  const isError =
    (countryProgressQuery.isError || countriesError) && stats.rows.length === 0

  return {
    visitedCodes: index.visitedCodes,
    byCode: index.byCode,
    visitedCount: stats.visitedCount,
    remainingCount: stats.remainingCount,
    totalCount: stats.totalCount,
    isLoading,
    isError,
  }
}
