import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'

import { ApiError } from '@/api/client'
import { fetchQuestsNearLocation, type NearLocationParams } from '@/api/quests'
import { queryKeys } from '@/api/queryKeys'
import { useQuestsList } from '@/hooks/useQuestsApi'
import { adaptMeta } from '@/utils/questAdapters'
import { queryConfigs } from '@/utils/reactQueryConfig'
import {
  findQuestsNearLocation,
  type LocationQuery,
  type QuestForLocationMatch,
} from '@/utils/questForLocation'
import type { QuestMeta } from '@/utils/questAdapters'

/** Первая координата локации — для гео-параметров near-location. */
function firstCoord(coords: LocationQuery['coords']): { lat: number; lng: number } | null {
  if (!coords) return null
  for (const c of coords) {
    if (Number.isFinite(c.lat) && Number.isFinite(c.lng)) return c
  }
  return null
}

function toNearParams(query: LocationQuery, limit?: number): NearLocationParams {
  const coord = firstCoord(query.coords)
  return {
    city: query.cityName ?? undefined,
    country: query.countryName ?? undefined,
    lat: coord?.lat ?? undefined,
    lng: coord?.lng ?? undefined,
    limit,
  }
}

function nearLocationKey(query: LocationQuery, limit?: number): string {
  const coord = firstCoord(query.coords)
  return [
    query.cityName ?? '',
    query.countryName ?? '',
    query.countryCode ?? '',
    coord ? `${coord.lat.toFixed(4)},${coord.lng.toFixed(4)}` : '',
    limit ?? '',
  ].join('|')
}

function hasLocation(query: LocationQuery): boolean {
  return Boolean(query.cityName?.trim() || query.countryName?.trim() || firstCoord(query.coords))
}

type NearLocationState = {
  matches: QuestForLocationMatch[]
  loading: boolean
  /** true, если серверный near-location недоступен (404 старого деплоя). */
  serverUnavailable: boolean
}

/**
 * Серверные гео-рекомендации квестов (score/distance считает бэкенд).
 * Возвращает флаг serverUnavailable для graceful fallback на клиентский расчёт.
 */
function useServerQuestsNearLocation(query: LocationQuery, limit?: number): NearLocationState {
  const enabled = hasLocation(query)

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.questsNearLocation(nearLocationKey(query, limit)),
    enabled,
    queryFn: async ({ signal }) => fetchQuestsNearLocation(toNearParams(query, limit), { signal }),
    retry: (count, err) => !(err instanceof ApiError && err.status === 404) && count < 2,
    ...queryConfigs.paginated,
  })

  const serverUnavailable = error instanceof ApiError && error.status === 404

  const matches = useMemo<QuestForLocationMatch[]>(() => {
    if (!data) return []
    return data.map((item) => ({
      quest: adaptMeta(item.quest),
      score: item.score,
      distanceKm: item.distance_km ?? Infinity,
    }))
  }, [data])

  return { matches, loading: enabled && isLoading && !serverUnavailable, serverUnavailable }
}

/**
 * Возвращает квест, подходящий под локацию (город/страна/координаты), или null.
 * Используется для блока «Пройдите квест по этому городу» на travel-странице.
 */
export function useQuestForLocation(query: LocationQuery): {
  quest: QuestMeta | null
  loading: boolean
} {
  const { matches, loading } = useQuestsForLocation(query, { limit: 1 })
  return { quest: matches[0]?.quest ?? null, loading }
}

/**
 * Возвращает список квестов, подходящих под локацию (отсортированный
 * по релевантности и дистанции). Используется для блока
 * «Квесты по этому городу и рядом» на travel-странице.
 *
 * Первично читает серверный /quests/near-location/ (score/distance с бэка);
 * на старом деплое без эндпоинта (404) — graceful fallback на клиентский расчёт.
 */
export function useQuestsForLocation(
  query: LocationQuery,
  opts?: { limit?: number },
): { matches: QuestForLocationMatch[]; loading: boolean } {
  const limit = opts?.limit
  const server = useServerQuestsNearLocation(query, limit)

  // Клиентский fallback подключается только если серверный эндпоинт недоступен.
  const fallbackEnabled = server.serverUnavailable
  const { quests, loading: questsLoading } = useQuestsList({ enabled: fallbackEnabled })
  const { cityName, countryName, countryCode, coords } = query

  const fallbackMatches = useMemo(() => {
    if (!fallbackEnabled || questsLoading || !quests.length) return []
    return findQuestsNearLocation(
      quests,
      { cityName, countryName, countryCode, coords },
      typeof limit === 'number' ? { limit } : undefined,
    )
  }, [fallbackEnabled, questsLoading, quests, cityName, countryName, countryCode, coords, limit])

  if (fallbackEnabled) {
    return { matches: fallbackMatches, loading: fallbackEnabled && questsLoading }
  }
  return { matches: server.matches, loading: server.loading }
}
