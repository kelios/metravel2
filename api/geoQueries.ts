import { useQuery, type QueryFunctionContext } from '@tanstack/react-query'

import { queryClient } from '@/api/queryClient'
import { queryKeys } from '@/api/queryKeys'
import { nominatimReverse, nominatimSearch } from '@/api/external/nominatim'

// Geo data changes rarely — keep results warm for 10 minutes.
const GEO_STALE_TIME_MS = 10 * 60 * 1000
const GEO_GC_TIME_MS = 30 * 60 * 1000

const NOMINATIM_HEADERS: HeadersInit = { 'User-Agent': 'MeTravel/1.0', 'Accept-Language': 'ru' }

export interface LocationSearchResult {
  place_id: string
  display_name: string
  lat: string
  lon: string
  address?: {
    country?: string
    country_code?: string
    city?: string
    town?: string
    village?: string
    state?: string
  }
  type?: string
  importance?: number
}

export interface ReverseGeocodeAddress {
  country?: string
  country_code?: string
  city?: string
  town?: string
  village?: string
  state?: string
  name?: string
  [key: string]: unknown
}

export interface ReverseGeocodeResult {
  name?: string
  display_name?: string
  address?: ReverseGeocodeAddress
  [key: string]: unknown
}

interface UseLocationSearchQueryArgs {
  query: string
  enabled?: boolean
  limit?: number
}

interface UseReverseGeocodeQueryArgs {
  lat: number | null | undefined
  lng: number | null | undefined
  enabled?: boolean
}

/**
 * Location search via Nominatim. The query passed here should already be the
 * debounced value — debounce belongs to the input component, not the cache key.
 */
export function useLocationSearchQuery({ query, enabled = true, limit = 7 }: UseLocationSearchQueryArgs) {
  const trimmed = query.trim()

  return useQuery<LocationSearchResult[]>({
    queryKey: queryKeys.locationSearch(trimmed),
    enabled: enabled && trimmed.length >= 3,
    retry: false,
    staleTime: GEO_STALE_TIME_MS,
    gcTime: GEO_GC_TIME_MS,
    queryFn: async ({ signal }) => {
      const response = await nominatimSearch(
        { q: trimmed, limit, addressdetails: 1, acceptLanguage: 'ru' },
        { signal, headers: NOMINATIM_HEADERS },
      )
      if (!response.ok) throw new Error('Ошибка поиска')
      const data: unknown = await response.json()
      if (!Array.isArray(data)) return []
      return (data as LocationSearchResult[]).filter(
        (item): item is LocationSearchResult => !!item && typeof item.display_name === 'string',
      )
    },
  })
}

type ReverseGeocodeKey = ReturnType<typeof queryKeys.reverseGeocode>

const reverseGeocodeQueryFn = async ({
  queryKey,
  signal,
}: QueryFunctionContext<ReverseGeocodeKey>): Promise<ReverseGeocodeResult | null> => {
  const [, lat, lng] = queryKey
  const response = await nominatimReverse(
    {
      lat,
      lng,
      zoom: 18,
      addressdetails: 1,
      extratags: 1,
      namedetails: 1,
      acceptLanguage: 'ru',
    },
    { signal, headers: NOMINATIM_HEADERS },
  )
  if (!response.ok) return null
  const data: ReverseGeocodeResult = await response.json()
  if (data?.name || data?.address?.name || data?.display_name) return data
  return null
}

/**
 * Reverse-geocode a coordinate via Nominatim (zoom=18 for maximum detail).
 * Returns null when Nominatim has no usable name/address for the point.
 */
export function useReverseGeocodeQuery({ lat, lng, enabled = true }: UseReverseGeocodeQueryArgs) {
  const hasCoords = typeof lat === 'number' && Number.isFinite(lat) && typeof lng === 'number' && Number.isFinite(lng)

  return useQuery<ReverseGeocodeResult | null, Error, ReverseGeocodeResult | null, ReverseGeocodeKey>({
    queryKey: queryKeys.reverseGeocode(hasCoords ? (lat as number) : 0, hasCoords ? (lng as number) : 0),
    enabled: enabled && hasCoords,
    retry: false,
    staleTime: GEO_STALE_TIME_MS,
    gcTime: GEO_GC_TIME_MS,
    queryFn: reverseGeocodeQueryFn,
  })
}

/**
 * Imperative reverse-geocode for event-driven flows (map click, photo EXIF)
 * where a hook can't be used. Shares the same cache, key and staleTime as
 * useReverseGeocodeQuery, and gets React Query's built-in request cancellation.
 */
export function fetchReverseGeocode(lat: number, lng: number): Promise<ReverseGeocodeResult | null> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return Promise.resolve(null)
  return queryClient.fetchQuery<ReverseGeocodeResult | null, Error, ReverseGeocodeResult | null, ReverseGeocodeKey>({
    queryKey: queryKeys.reverseGeocode(lat, lng),
    staleTime: GEO_STALE_TIME_MS,
    gcTime: GEO_GC_TIME_MS,
    retry: false,
    queryFn: reverseGeocodeQueryFn,
  })
}
