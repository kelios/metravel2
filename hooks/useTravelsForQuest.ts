import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'

import { queryKeys } from '@/api/queryKeys'
import { fetchTravels } from '@/api/travelsQueries'
import { queryConfigs } from '@/utils/reactQueryConfig'
import {
  findTravelsNearLocation,
  type TravelForLocationMatch,
  type TravelLocationQuery,
} from '@/utils/travelForLocation'
import type { Travel } from '@/types/types'

const FETCH_PAGE_SIZE = 30

/**
 * Возвращает travel-статьи, подходящие под локацию квеста (город/координаты),
 * для блока «Путешествия по этому городу». Список подгружается по названию
 * города, затем фильтруется по близости к точкам квеста на клиенте.
 */
export function useTravelsForQuest(
  query: TravelLocationQuery,
  opts?: { limit?: number; enabled?: boolean },
): { matches: TravelForLocationMatch[]; loading: boolean } {
  const { cityName, countryName, countryCode, coords } = query
  const limit = opts?.limit
  const searchTerm = (cityName || countryName || '').trim()
  const enabled = (opts?.enabled ?? true) && searchTerm.length > 0

  const { data, isLoading } = useQuery<Travel[]>({
    queryKey: queryKeys.travelsForQuest(searchTerm),
    enabled,
    queryFn: async ({ signal }) => {
      const result = await fetchTravels(0, FETCH_PAGE_SIZE, searchTerm, {}, { signal })
      return Array.isArray(result.data) ? result.data : []
    },
    ...queryConfigs.paginated,
  })

  const matches = useMemo(() => {
    const travels = data ?? []
    if (!travels.length) return []
    return findTravelsNearLocation(
      travels,
      { cityName, countryName, countryCode, coords },
      typeof limit === 'number' ? { limit } : undefined,
    )
  }, [data, cityName, countryName, countryCode, coords, limit])

  return { matches, loading: enabled && isLoading }
}
