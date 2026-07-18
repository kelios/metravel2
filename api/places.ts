import { Platform } from 'react-native'

import { resolveApiBaseUrl } from '@/utils/resolveApiBaseUrl'
import { fetchWithTimeout } from '@/utils/fetchWithTimeout'
import { safeJsonParse } from '@/utils/safeJsonParse'
import {
  mapPlacesCatalogResponse,
  type PlacesCatalogPage,
  type RawPlacesCatalogResponse,
} from '@/utils/placesCatalog'

const isLocalApi = String(process.env.EXPO_PUBLIC_IS_LOCAL_API || '').toLowerCase() === 'true'
const isE2E = String(process.env.EXPO_PUBLIC_E2E || '').toLowerCase() === 'true'
const rawApiUrl = resolveApiBaseUrl({
  platformOS: Platform.OS,
  envApiUrl: process.env.EXPO_PUBLIC_API_URL,
  prodApiUrl: process.env.PROD_API_URL,
  nodeEnv: process.env.NODE_ENV,
  isE2E,
  isLocalApi,
  windowOrigin: Platform.OS === 'web' && typeof window !== 'undefined' ? window.location?.origin : null,
  windowHostname: Platform.OS === 'web' && typeof window !== 'undefined' ? window.location?.hostname : null,
})
if (!rawApiUrl) {
  throw new Error('EXPO_PUBLIC_API_URL is not defined. Please set this environment variable.')
}

const PLACES_CATALOG_URL = `${rawApiUrl}/places/catalog/`
const PLACES_CATALOG_TIMEOUT_MS = 15000

/** Server-side sort modes for the places catalog. `default` keeps the backend's
 * natural order; `rating` orders by aggregate external rating (2GIS/TripAdvisor)
 * descending, placing unrated places last. Unknown/omitted values are ignored by
 * the backend, so the FE control degrades gracefully until the backend ships. */
export type PlacesCatalogSort = 'default' | 'rating'

export type PlacesCatalogParams = {
  page: number
  perPage: number
  q?: string
  categories?: string[]
  country?: string | null
  sort?: PlacesCatalogSort
}

const buildQuery = ({ page, perPage, q, categories, country, sort }: PlacesCatalogParams): string => {
  const params = new URLSearchParams()
  params.set('page', String(Math.max(1, Math.floor(page))))
  params.set('perPage', String(Math.max(1, Math.floor(perPage))))

  const trimmedQuery = q?.trim()
  if (trimmedQuery) params.set('q', trimmedQuery)

  const normalizedCategories = (categories ?? [])
    .map((item) => item.trim())
    .filter(Boolean)
  normalizedCategories.forEach((category) => params.append('category', category))

  const trimmedCountry = country?.trim()
  if (trimmedCountry) params.set('country', trimmedCountry)

  // Only send an explicit sort when it deviates from the backend default, so
  // existing cached responses and the default order stay untouched.
  if (sort && sort !== 'default') params.set('sort', sort)

  return params.toString()
}

export const fetchPlacesCatalog = async (
  params: PlacesCatalogParams,
  signal?: AbortSignal,
): Promise<PlacesCatalogPage> => {
  const url = `${PLACES_CATALOG_URL}?${buildQuery(params)}`
  const res = await fetchWithTimeout(url, { signal }, PLACES_CATALOG_TIMEOUT_MS)
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${res.statusText}`)
  }
  const payload = await safeJsonParse<RawPlacesCatalogResponse>(res, {})
  return mapPlacesCatalogResponse(payload)
}
