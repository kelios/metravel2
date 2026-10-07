import { Platform } from 'react-native'

import { resolveApiBaseUrl } from '@/utils/resolveApiBaseUrl'
import { ApiError } from '@/api/clientErrors'
import { fetchPublicWithSession } from '@/api/publicFetchWithSession'
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
  // #2165: каталог мест несёт путешествия авторов — с сессией, чтобы бэк скрыл заблокированных (#2164).
  const res = await fetchPublicWithSession(url, { signal }, PLACES_CATALOG_TIMEOUT_MS)
  if (!res.ok) {
    // Статус — полем, а не только текстом: политика повторов отличает по нему
    // 502/503 (сервер запрос не считает) от 504 (ещё считает) и 4xx (#2184).
    throw new ApiError(res.status, `HTTP ${res.status}: ${res.statusText}`)
  }
  const payload = await safeJsonParse<RawPlacesCatalogResponse>(res, {})
  return mapPlacesCatalogResponse(payload)
}

export type PlacesCatalogCategoryGroup = { id: string; categories: readonly string[] }

/** Exact server aggregate; missing/invalid counts remain unknown to the UI. */
export const fetchPlacesCatalogCategoryGroups = async (
  { country, groups }: { country?: string; groups: readonly PlacesCatalogCategoryGroup[] },
  signal?: AbortSignal,
): Promise<Readonly<Record<string, number>>> => {
  const params = new URLSearchParams()
  if (country?.trim()) params.set('country', country.trim())
  for (const group of groups) params.append('group', `${group.id}:${group.categories.join(',')}`)
  const response = await fetchPublicWithSession(`${PLACES_CATALOG_URL}category-groups/?${params}`, { signal }, PLACES_CATALOG_TIMEOUT_MS)
  if (!response.ok) throw new ApiError(response.status, `HTTP ${response.status}: ${response.statusText}`)
  const payload = await safeJsonParse<{ groups?: Array<{ id?: unknown; count?: unknown } | null> }>(response, {})
  const requested = new Set(groups.map(({ id }) => id))
  const counts: Record<string, number> = {}
  for (const group of Array.isArray(payload.groups) ? payload.groups : []) {
    if (group && typeof group.id === 'string' && requested.has(group.id) && typeof group.count === 'number' && Number.isInteger(group.count) && group.count >= 0) {
      counts[group.id] = group.count
    }
  }
  return counts
}
