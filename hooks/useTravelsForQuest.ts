import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'

import { ApiError } from '@/api/client'
import type { NearLocationParams } from '@/api/quests'
import { queryKeys } from '@/api/queryKeys'
import { fetchTravels } from '@/api/travelsQueries'
import { fetchTravelsNearLocation } from '@/api/travelListQueries'
import { queryConfigs } from '@/utils/reactQueryConfig'
import {
  findTravelsNearLocation,
  type TravelForLocationMatch,
  type TravelLocationQuery,
} from '@/utils/travelForLocation'
import type { Travel } from '@/types/types'

const FETCH_PAGE_SIZE = 30

function firstCoord(coords: TravelLocationQuery['coords']): { lat: number; lng: number } | null {
  if (!coords) return null
  for (const c of coords) {
    if (Number.isFinite(c.lat) && Number.isFinite(c.lng)) return c
  }
  return null
}

function toNearParams(query: TravelLocationQuery, limit?: number): NearLocationParams {
  const coord = firstCoord(query.coords)
  return {
    city: query.cityName ?? undefined,
    country: query.countryName ?? undefined,
    lat: coord?.lat ?? undefined,
    lng: coord?.lng ?? undefined,
    limit,
  }
}

function nearLocationKey(query: TravelLocationQuery, limit?: number): string {
  const coord = firstCoord(query.coords)
  return [
    query.cityName ?? '',
    query.countryName ?? '',
    query.countryCode ?? '',
    coord ? `${coord.lat.toFixed(4)},${coord.lng.toFixed(4)}` : '',
    limit ?? '',
  ].join('|')
}

function hasLocation(query: TravelLocationQuery): boolean {
  return Boolean(query.cityName?.trim() || query.countryName?.trim() || firstCoord(query.coords))
}

/**
 * Возвращает travel-статьи, подходящие под локацию квеста, для блока
 * «Путешествия по этому городу» на странице квеста.
 *
 * Первично читает серверный /travels/near-location/ (score/distance с бэка);
 * на старом деплое без эндпоинта (404) — graceful fallback на клиентский расчёт
 * (поиск по названию города + фильтрация по близости к точкам квеста).
 */
export function useTravelsForQuest(
  query: TravelLocationQuery,
  opts?: { limit?: number; enabled?: boolean },
): { matches: TravelForLocationMatch[]; loading: boolean } {
  const { cityName, countryName, countryCode, coords } = query
  const limit = opts?.limit
  const enabledOpt = opts?.enabled ?? true
  const enabled = enabledOpt && hasLocation(query)

  const {
    data: serverData,
    isLoading: serverLoading,
    error: serverError,
  } = useQuery({
    queryKey: queryKeys.travelsNearLocation(nearLocationKey(query, limit)),
    enabled,
    queryFn: async ({ signal }) => fetchTravelsNearLocation(toNearParams(query, limit), { signal }),
    retry: (count, err) => !(err instanceof ApiError && err.status === 404) && count < 2,
    ...queryConfigs.paginated,
  })

  const serverUnavailable = serverError instanceof ApiError && serverError.status === 404

  const serverMatches = useMemo<TravelForLocationMatch[]>(() => {
    if (!serverData) return []
    return serverData.map((item) => ({
      travel: item.travel,
      score: item.score,
      distanceKm: item.distanceKm ?? Infinity,
    }))
  }, [serverData])

  // Клиентский fallback: подгружаем список только если серверный эндпоинт 404.
  const searchTerm = (cityName || countryName || '').trim()
  const fallbackEnabled = enabledOpt && serverUnavailable && searchTerm.length > 0

  const { data: fallbackData, isLoading: fallbackLoading } = useQuery<Travel[]>({
    queryKey: queryKeys.travelsForQuest(searchTerm),
    enabled: fallbackEnabled,
    queryFn: async ({ signal }) => {
      const result = await fetchTravels(0, FETCH_PAGE_SIZE, searchTerm, {}, { signal })
      return Array.isArray(result.data) ? result.data : []
    },
    ...queryConfigs.paginated,
  })

  const fallbackMatches = useMemo<TravelForLocationMatch[]>(() => {
    if (!fallbackEnabled) return []
    const travels = fallbackData ?? []
    if (!travels.length) return []
    return findTravelsNearLocation(
      travels,
      { cityName, countryName, countryCode, coords },
      typeof limit === 'number' ? { limit } : undefined,
    )
  }, [fallbackEnabled, fallbackData, cityName, countryName, countryCode, coords, limit])

  if (serverUnavailable) {
    return { matches: fallbackMatches, loading: fallbackEnabled && fallbackLoading }
  }
  return { matches: serverMatches, loading: enabled && serverLoading }
}
