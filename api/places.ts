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

const readTravelsForMapTotal = (value: TravelsForMap): number | null => {
  if (!value || typeof value !== 'object') return null
  const total = (value as Record<string, unknown>).__total
  return typeof total === 'number' && Number.isFinite(total) ? total : null
}

const fetchPlacesCatalogPage = (
  page: number,
  signal: AbortSignal,
): Promise<TravelsForMap> =>
  fetchTravelsForMap(
    page,
    PLACES_CATALOG_PER_PAGE,
    {
      ...PLACES_CATALOG_CENTER,
      radius: PLACES_CATALOG_RADIUS_KM,
    },
    { signal, throwOnError: true },
  )

export const fetchPlacesCatalog = async (signal?: AbortSignal): Promise<CatalogPlace[]> => {
  const controller = new AbortController()
  const abortFromParent = () => controller.abort()
  const timeoutId = setTimeout(() => controller.abort(), PLACES_CATALOG_TIMEOUT_MS)

  if (signal?.aborted) controller.abort()
  signal?.addEventListener('abort', abortFromParent, { once: true })

  try {
    const places = await Promise.race([
      (async () => {
        const firstPayload = await fetchPlacesCatalogPage(0, controller.signal)
        const allPlaces = toTravelCoordsArray(firstPayload)
        const total = readTravelsForMapTotal(firstPayload)

        if (total == null || allPlaces.length <= 0 || allPlaces.length >= total) {
          return allPlaces
        }

        const maxPages = Math.ceil(total / PLACES_CATALOG_PER_PAGE)
        for (let page = 1; page < maxPages; page += 1) {
          const payload = await fetchPlacesCatalogPage(page, controller.signal)
          const pagePlaces = toTravelCoordsArray(payload)
          if (pagePlaces.length <= 0) break
          allPlaces.push(...pagePlaces)
          if (allPlaces.length >= total || pagePlaces.length < PLACES_CATALOG_PER_PAGE) break
        }

        return allPlaces
      })(),
      rejectAfter(PLACES_CATALOG_TIMEOUT_MS),
    ])
    return normalizeCatalogPlaces(places)
  } finally {
    clearTimeout(timeoutId)
    signal?.removeEventListener('abort', abortFromParent)
  }
}
