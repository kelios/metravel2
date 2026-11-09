import { useQuery } from '@tanstack/react-query'

import { osrmRoute } from '@/api/external/osrm'
import { queryKeys } from '@/api/queryKeys'
import type { DriveInfo } from '@/types/userPoints'

type LatLng = { lat?: number | null; lng?: number | null } | null | undefined

/** Время в пути не меняется от сдвига геолокации на метры: ключ по 4 знакам (~10 м). */
const FROM_PRECISION = 4
/** Координаты точки — как есть (6 знаков, ~10 см). */
const TO_PRECISION = 6
const STALE_TIME_MS = 10 * 60 * 1000
const GC_TIME_MS = 30 * 60 * 1000

const toCoordKey = (coords: LatLng, precision: number): string | null => {
  const lat = Number(coords?.lat)
  const lng = Number(coords?.lng)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  return `${lat.toFixed(precision)},${lng.toFixed(precision)}`
}

/** Маршрут OSRM «откуда → куда» в километрах и минутах; бросает на неполном ответе. */
export async function fetchDriveInfo(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
  signal?: AbortSignal,
): Promise<{ distanceKm: number; durationMin: number }> {
  const response = await osrmRoute({ coords: [[from.lng, from.lat], [to.lng, to.lat]] }, { signal })
  const data = await response.json()
  const route = Array.isArray(data?.routes) ? data.routes[0] : null
  const distanceM = Number(route?.distance)
  const durationS = Number(route?.duration)
  if (!Number.isFinite(distanceM) || !Number.isFinite(durationS)) {
    throw new Error('OSRM route without distance/duration')
  }
  return {
    distanceKm: Math.round((distanceM / 1000) * 10) / 10,
    durationMin: Math.max(1, Math.round(durationS / 60)),
  }
}

/**
 * Время в пути до точки для карточки списка и попапа карты (#3135). До этого
 * у карты и списка были два хука с одинаковой OSRM-логикой, и клик по маркеру
 * при известной геолокации слал два одинаковых запроса. React Query с общим
 * ключом (геолокация ~10 м, точка) дедуплицирует запрос между потребителями и
 * держит ответ 10 минут — повторный клик по той же точке в сеть не ходит.
 * `null` — считать нечего (нет геолокации, координат или запрос выключен).
 */
export function useDriveInfoQuery({
  from,
  to,
  enabled = true,
}: {
  from: LatLng
  to: LatLng
  enabled?: boolean
}): DriveInfo | null {
  const fromKey = toCoordKey(from, FROM_PRECISION)
  const toKey = toCoordKey(to, TO_PRECISION)
  const active = enabled && fromKey !== null && toKey !== null
  const query = useQuery({
    queryKey: queryKeys.driveInfo(fromKey ?? '', toKey ?? ''),
    enabled: active,
    queryFn: ({ signal }) =>
      fetchDriveInfo(
        { lat: Number(from?.lat), lng: Number(from?.lng) },
        { lat: Number(to?.lat), lng: Number(to?.lng) },
        signal,
      ),
    staleTime: STALE_TIME_MS,
    gcTime: GC_TIME_MS,
    retry: false,
    refetchOnWindowFocus: false,
  })
  if (!active) return null
  if (query.data) return { status: 'ok', ...query.data }
  if (query.isError) return { status: 'error' }
  return { status: 'loading' }
}
