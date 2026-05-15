import { fetchTravelsForMap } from '@/api/map'
import type { TravelCoords, TravelsForMap } from '@/types/types'
import { normalizeCatalogPlaces, type CatalogPlace } from '@/utils/placesCatalog'

const PLACES_CATALOG_PER_PAGE = 1000
const PLACES_CATALOG_RADIUS_KM = 20000
const PLACES_CATALOG_TIMEOUT_MS = 12000
const PLACES_CATALOG_CENTER = {
  lat: '53.9006',
  lng: '27.5590',
}

const rejectAfter = (ms: number): Promise<never> =>
  new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Places catalog request timed out')), ms)
  })

const toTravelCoordsArray = (value: TravelsForMap): TravelCoords[] => {
  if (Array.isArray(value)) return value as unknown as TravelCoords[]
  if (value && typeof value === 'object') {
    return Object.values(value as Record<string, unknown>) as TravelCoords[]
  }
  return []
}

export const fetchPlacesCatalog = async (signal?: AbortSignal): Promise<CatalogPlace[]> => {
  const controller = new AbortController()
  const abortFromParent = () => controller.abort()
  const timeoutId = setTimeout(() => controller.abort(), PLACES_CATALOG_TIMEOUT_MS)

  if (signal?.aborted) controller.abort()
  signal?.addEventListener('abort', abortFromParent, { once: true })

  try {
    const payload = await Promise.race([
      fetchTravelsForMap(
        0,
        PLACES_CATALOG_PER_PAGE,
        {
          ...PLACES_CATALOG_CENTER,
          radius: PLACES_CATALOG_RADIUS_KM,
        },
        { signal: controller.signal, throwOnError: true },
      ),
      rejectAfter(PLACES_CATALOG_TIMEOUT_MS),
    ])
    return normalizeCatalogPlaces(toTravelCoordsArray(payload))
  } finally {
    clearTimeout(timeoutId)
    signal?.removeEventListener('abort', abortFromParent)
  }
}
