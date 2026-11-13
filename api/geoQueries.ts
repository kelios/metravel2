import { useQuery, type QueryClient, type QueryFunctionContext } from '@tanstack/react-query'

import { getActiveQueryClient } from '@/api/activeQueryClient'
import { queryKeys } from '@/api/queryKeys'
import { createOptimizedQueryClient } from '@/utils/reactQueryConfig'
import { bigDataCloudReverse } from '@/api/external/bigdatacloud'
import { nominatimReverse, nominatimSearch } from '@/api/external/nominatim'
import { overpassQuery } from '@/api/external/overpass'
import { buildGeocodeParts } from '@/utils/geocodeHelpers'
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

/**
 * Ответ Nominatim `/search?addressdetails=1`. Помимо страны и населённого
 * пункта отдаёт имя объекта (`name`) и ключи объекта в `address` — именно на
 * них держится имя точки в `buildGeocodeParts` (#1736; форма снята пробой
 * живого API 03.09.2026).
 */
export interface LocationSearchResult {
  place_id: string
  display_name: string
  lat: string
  lon: string
  name?: string
  address?: {
    country?: string
    country_code?: string
    city?: string
    town?: string
    village?: string
    municipality?: string
    suburb?: string
    county?: string
    state?: string
    // Альтернатива `state` в `buildGeocodeParts` (`utils/geocodeHelpers.ts`):
    // часть стран отдаёт регион именно этим ключом.
    region?: string
    // Ключи объекта: значение — имя объекта данного класса.
    name?: string
    tourism?: string
    amenity?: string
    historic?: string
    leisure?: string
    place_of_worship?: string
    building?: string
    road?: string
    house_number?: string
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
  /** Keep explicit search intent from being repeated by observer lifecycle events. */
  userInitiatedOnly?: boolean
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
export function useLocationSearchQuery({ query, enabled = true, limit = 7, userInitiatedOnly = false }: UseLocationSearchQueryArgs) {
  const trimmed = query.trim()
  const locale = getActiveLocale()

  return useQuery<LocationSearchResult[]>({
    queryKey: queryKeys.locationSearch(trimmed, locale),
    enabled: enabled && trimmed.length >= 3,
    retry: false,
    ...(userInitiatedOnly ? {
      networkMode: 'always' as const,
      refetchOnMount: false,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    } : {}),
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

/** Радиус поиска объекта вокруг точки: погрешность GPS снимка плюс размер здания. */
const NAMED_PLACE_RADIUS_M = 60
/** Площадные объекты (парк, замок) отбрасываются, если их центр дальше этого. */
const NAMED_PLACE_MAX_CENTER_M = 250
const NAMED_PLACE_TIMEOUT_MS = 6000
/**
 * Основной сервер Overpass регулярно отвечает 502 «at capacity», поэтому есть
 * второй адрес. Оба разрешены в prod-CSP (`nginx/nginx.conf`, `connect-src`).
 */
const NAMED_PLACE_ENDPOINTS = [
  process.env.EXPO_PUBLIC_OVERPASS_ENDPOINT || 'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
]

/**
 * Классы OSM, имя которых годится в подпись точки маршрута: приют, вершина,
 * часовня, руины. `tourism=information` исключён — это указатели и доски,
 * которые называются по тропе, а тропа как раз то, от чего уходим.
 */
const buildNamedPlaceQuery = (lat: number, lng: number) => {
  const around = `(around:${NAMED_PLACE_RADIUS_M},${lat},${lng})`
  return `[out:json][timeout:8];
(
  nwr${around}["name"]["tourism"]["tourism"!="information"];
  nwr${around}["name"]["historic"];
  nwr${around}["name"]["natural"~"^(peak|saddle|spring|waterfall|cave_entrance|rock|stone|cliff|volcano|hill)$"];
  nwr${around}["name"]["amenity"~"^(shelter|place_of_worship|monastery|fountain)$"];
  nwr${around}["name"]["man_made"~"^(tower|lighthouse|windmill|watermill|cross)$"];
  nwr${around}["name"]["leisure"~"^(park|garden)$"];
);
out center tags;`
}

const distanceMeters = (lat1: number, lng1: number, lat2: number, lng2: number) => {
  const toRad = Math.PI / 180
  const x = (lng2 - lng1) * toRad * Math.cos(((lat1 + lat2) / 2) * toRad)
  const y = (lat2 - lat1) * toRad
  return Math.sqrt(x * x + y * y) * 6371000
}

type OverpassNamedElement = {
  lat?: number
  lon?: number
  center?: { lat?: number; lon?: number }
  tags?: Record<string, string>
}

/**
 * Ближайший объект с именем вокруг точки — через Overpass, а не Nominatim.
 * Nominatim reverse отдаёт ближайший узел, а у приюта это безымянные
 * дефибриллятор, скамейка или указатель; подпись тогда собиралась из `road`,
 * которым у горной точки оказывается тропа («Czerwony szlak Na Turbacz»
 * вместо «Schronisko PTTK na Maciejowej»). Ошибка и таймаут дают `null`:
 * точка остаётся с подписью Nominatim, как раньше.
 */
export async function findNamedPlaceNear(lat: number, lng: number): Promise<string | null> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), NAMED_PLACE_TIMEOUT_MS)
  try {
    let data: { elements?: OverpassNamedElement[] } | null = null
    for (const endpoint of NAMED_PLACE_ENDPOINTS) {
      try {
        const response = await overpassQuery(buildNamedPlaceQuery(lat, lng), { signal: controller.signal, endpoint })
        if (response.ok) {
          data = await response.json()
          break
        }
      } catch (error) {
        if (controller.signal.aborted) throw error
      }
    }
    if (!data) return null
    const language = getActiveLocaleDefinition().geocoderLanguage
    let best: { name: string; distance: number } | null = null
    for (const element of Array.isArray(data?.elements) ? data.elements : []) {
      const elLat = element.lat ?? element.center?.lat
      const elLng = element.lon ?? element.center?.lon
      const name = element.tags?.[`name:${language}`] || element.tags?.name
      if (!name || typeof elLat !== 'number' || typeof elLng !== 'number') continue
      const distance = distanceMeters(lat, lng, elLat, elLng)
      if (distance > NAMED_PLACE_MAX_CENTER_M) continue
      if (!best || distance < best.distance) best = { name, distance }
    }
    return best?.name ?? null
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Обратный геокод именно для точки маршрута: `reverseGeocodePoint` плюс имя
 * ближайшего объекта, когда у ответа геокодера своего имени нет. Дом с адресом
 * не трогаем: в городе «Floriańska 12» точнее, чем соседний отель. Подписям
 * ключевых точек (`useKeyPointLabels`) нужен населённый пункт, поэтому они
 * остаются на `reverseGeocodePoint` и лишнего запроса не делают.
 */
export async function reverseGeocodeRoutePoint(
  lat: number,
  lng: number,
): Promise<ReverseGeocodePointResult | null> {
  const data = await reverseGeocodePoint(lat, lng)
  const hasOwnName = !!data && !!buildGeocodeParts(data).poi
  if (hasOwnName || data?.address?.house_number) return data

  const placeName = await findNamedPlaceNear(lat, lng)
  if (!placeName) return data
  return { ...(data ?? {}), name: placeName }
}

// LC-2: резервный клиент только для вызова до монтирования корневого layout
// (SSR, тесты, ранний boot). Создаётся лениво и без стартового префетча
// словарей, чтобы загрузка geoQueries не давала второго запроса фильтров.
let fallbackGeoQueryClient: QueryClient | null = null

/**
 * Клиент для императивного геокода: тот же, что смонтирован в React-дереве
 * (`api/activeQueryClient.ts`), поэтому `fetchReverseGeocode` и
 * `useReverseGeocodeQuery` делят один кэш и дедуплицируют запросы.
 */
function resolveGeoQueryClient(): QueryClient {
  const active = getActiveQueryClient()
  if (active) return active
  if (!fallbackGeoQueryClient) {
    fallbackGeoQueryClient = createOptimizedQueryClient(undefined, { enableStaticPrefetch: false })
  }
  return fallbackGeoQueryClient
}

/** Только для тестов: сбросить ленивый резервный клиент. */
export function __resetGeoQueryClientForTests(): void {
  fallbackGeoQueryClient = null
}

/**
 * Imperative reverse-geocode for event-driven flows (map click, photo EXIF)
 * where a hook can't be used. Shares the same cache, key and staleTime as
 * useReverseGeocodeQuery, and gets React Query's built-in request cancellation.
 */
export function fetchReverseGeocode(lat: number, lng: number): Promise<ReverseGeocodeResult | null> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return Promise.resolve(null)
  return resolveGeoQueryClient().fetchQuery<ReverseGeocodeResult | null, Error, ReverseGeocodeResult | null, ReverseGeocodeKey>({
    queryKey: queryKeys.reverseGeocode(lat, lng, getActiveLocale()),
    staleTime: GEO_STALE_TIME_MS,
    gcTime: GEO_GC_TIME_MS,
    retry: false,
    // #1746 — `networkMode: 'always'`, а не наследуемый 'online'. Императивный
    // поток «пользователь нажал добавить» не должен зависать `paused` при
    // `isOnline() === false` (резервный клиент не монтируется и не возобновляет
    // такие запросы; у смонтированного ожидание тоже не нужно): правильный ответ
    // офлайн — быстрый отказ и фолбэк вызывающего (координаты вместо названия),
    // как было до #1738.
    networkMode: 'always',
    queryFn: reverseGeocodeQueryFn,
  })
}
