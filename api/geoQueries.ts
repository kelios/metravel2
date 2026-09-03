import { useQuery, type QueryFunctionContext } from '@tanstack/react-query'

import { queryClient } from '@/api/queryClient'
import { queryKeys } from '@/api/queryKeys'
import { bigDataCloudReverse } from '@/api/external/bigdatacloud'
import { nominatimReverse, nominatimSearch } from '@/api/external/nominatim'
import { getActiveLocale, getActiveLocaleDefinition, translate as i18nT } from '@/i18n'

// Geo data changes rarely — keep results warm for 10 minutes.
const GEO_STALE_TIME_MS = 10 * 60 * 1000
const GEO_GC_TIME_MS = 30 * 60 * 1000

const getNominatimLocaleOptions = () => {
  const language = getActiveLocaleDefinition().geocoderLanguage
  return {
    language,
    headers: { 'User-Agent': 'MeTravel/1.0', 'Accept-Language': language } satisfies HeadersInit,
  }
}

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
  ISO3166_1_alpha2?: string
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

/** Ответ BigDataCloud — только поля, которые читают потребители точки. */
export interface BigDataCloudReverseResult {
  countryName?: string
  countryCode?: string
  locality?: string
  city?: string
  principalSubdivision?: string
  localityInfo?: { administrative?: Array<{ order?: number; name?: string }> }
}

/**
 * Что отдаёт `reverseGeocodePoint`: Nominatim (`name`, `address`) либо фолбэк
 * BigDataCloud (`countryName`, `localityInfo`). Разбор потребителя читает оба
 * набора через optional chaining, поэтому тип — объединение полей, а не union.
 */
export type ReverseGeocodePointResult = ReverseGeocodeResult & BigDataCloudReverseResult

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
  const locale = getActiveLocale()

  return useQuery<LocationSearchResult[]>({
    queryKey: queryKeys.locationSearch(trimmed, locale),
    enabled: enabled && trimmed.length >= 3,
    retry: false,
    staleTime: GEO_STALE_TIME_MS,
    gcTime: GEO_GC_TIME_MS,
    queryFn: async ({ signal }) => {
      const locale = getNominatimLocaleOptions()
      const response = await nominatimSearch(
        { q: trimmed, limit, addressdetails: 1, acceptLanguage: locale.language },
        { signal, headers: locale.headers },
      )
      if (!response.ok) throw new Error(i18nT('errorsStatic:api.geo.searchFailed'))
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
  const [, , lat, lng] = queryKey
  const locale = getNominatimLocaleOptions()
  const response = await nominatimReverse(
    {
      lat,
      lng,
      zoom: 18,
      addressdetails: 1,
      extratags: 1,
      namedetails: 1,
      acceptLanguage: locale.language,
    },
    { signal, headers: locale.headers },
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
  const locale = getActiveLocale()

  return useQuery<ReverseGeocodeResult | null, Error, ReverseGeocodeResult | null, ReverseGeocodeKey>({
    queryKey: queryKeys.reverseGeocode(
      hasCoords ? (lat as number) : 0,
      hasCoords ? (lng as number) : 0,
      locale,
    ),
    enabled: enabled && hasCoords,
    retry: false,
    staleTime: GEO_STALE_TIME_MS,
    gcTime: GEO_GC_TIME_MS,
    queryFn: reverseGeocodeQueryFn,
  })
}

/**
 * Обратный геокод точки маршрута с фолбэком — ОДИН на все поверхности (#1738).
 *
 * Реализаций было две, и они разошлись ровно там, где это дорого стоило:
 * `components/travel/stepRoute/helpers.ts` отдавала `null` на web безусловно,
 * поэтому ручной ввод координат называл точку самими координатами, и они
 * протекали в `cityName` шапки статьи и в виджет погоды. Вторая копия жила в
 * `WebMapComponent` и на web работала — потому и не было заметно, что тап по
 * карте и ручной ввод ведут себя по-разному.
 *
 * Порядок сервисов взят у работавшей копии: Nominatim первым, потому что он
 * отдаёт имя объекта (`name`, `address.tourism` и прочие), а это и есть подпись
 * точки (#1717). BigDataCloud остаётся фолбэком: он знает населённый пункт, но
 * не объект.
 *
 * Про web (проверено 03.09.2026): CORS у обоих сервисов открыт
 * (`access-control-allow-origin: *`), так что прежний web-guard был лишним с
 * самого начала. Но prod-CSP `connect-src` (nginx бэкенда) пускает только
 * `nominatim.openstreetmap.org`, поэтому на сайте фолбэк BigDataCloud блокируется
 * браузером и молча падает в `null` — на web фактически работает один Nominatim,
 * на native оба. Локальный стек CSP не ставит, там фолбэк виден.
 */
export async function reverseGeocodePoint(lat: number, lng: number): Promise<ReverseGeocodePointResult | null> {
  try {
    const data = await fetchReverseGeocode(lat, lng)
    if (data) return data
  } catch {
    // Падение первого сервиса — не повод отказываться от второго.
  }

  try {
    const response = await bigDataCloudReverse(lat, lng, getActiveLocaleDefinition().geocoderLanguage)
    if (response.ok) {
      const data: ReverseGeocodePointResult = await response.json()
      return data
    }
  } catch {
    // Обе попытки исчерпаны: вызывающий подставит своё запасное значение.
  }

  return null
}

/**
 * Imperative reverse-geocode for event-driven flows (map click, photo EXIF)
 * where a hook can't be used. Shares the same cache, key and staleTime as
 * useReverseGeocodeQuery, and gets React Query's built-in request cancellation.
 */
export function fetchReverseGeocode(lat: number, lng: number): Promise<ReverseGeocodeResult | null> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return Promise.resolve(null)
  return queryClient.fetchQuery<ReverseGeocodeResult | null, Error, ReverseGeocodeResult | null, ReverseGeocodeKey>({
    queryKey: queryKeys.reverseGeocode(lat, lng, getActiveLocale()),
    staleTime: GEO_STALE_TIME_MS,
    gcTime: GEO_GC_TIME_MS,
    retry: false,
    queryFn: reverseGeocodeQueryFn,
  })
}
