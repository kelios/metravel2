import type { TravelCoords } from '@/types/types'
import { translate as i18nT } from '@/i18n'


/** Rating for a single external provider (2GIS, TripAdvisor, …). */
export type PlaceRatingSource = {
  /** Stable provider code from the backend: 2gis | tripadvisor | google | yandex | … */
  provider: string
  /** Average score 0..5, or null when the provider has no score yet. */
  value: number | null
  /** Number of reviews backing the score. */
  count: number
  /** Deep link to the place on the provider (for attribution / "open on 2GIS"). */
  url: string | null
}

/** Aggregated place rating enriched by the backend from external sources. */
export type PlaceRating = {
  /** Weighted aggregate score 0..5, or null when no source has a score. */
  value: number | null
  /** Total number of reviews across sources. */
  count: number
  /** Per-source breakdown, kept for attribution and provider deep links. */
  sources: PlaceRatingSource[]
}

export type CatalogPlace = TravelCoords & {
  id: string
  travelId: number | null
  relatedTravelId: number | null
  title: string
  category: string
  categoryId: number | null
  country: string
  countryCode: string
  latNumber: number
  lngNumber: number
  searchText: string
  /** Present only when the backend has an external rating for this place. */
  rating: PlaceRating | null
}

export type CatalogFacet = {
  id: number | null
  name: string
  count: number
}

export type PlacesCatalogPage = {
  places: CatalogPlace[]
  count: number
  categoryFacets: CatalogFacet[]
  countryFacets: CatalogFacet[]
}

type RawCatalogCategory = { id?: unknown; name?: unknown }
type RawCatalogCountry = { code?: unknown; name?: unknown }
type RawCatalogTravel = { id?: unknown; url?: unknown; slug?: unknown }
type RawCatalogImage = { thumb_url?: unknown; landscape_url?: unknown }

type RawCatalogItem = {
  id?: unknown
  travel_id?: unknown
  urlTravel?: unknown
  title?: unknown
  address?: unknown
  category?: RawCatalogCategory | null
  country?: RawCatalogCountry | null
  coord?: unknown
  lat?: unknown
  lng?: unknown
  search_text?: unknown
  travel?: RawCatalogTravel | null
  image?: RawCatalogImage | null
  // Rating enrichment (optional; present once the backend ships it). Both the
  // structured `rating` object and a few flat aliases are tolerated so the FE
  // does not need a redeploy if the backend shape drifts slightly.
  rating?: RawCatalogRating | number | null
  rating_value?: unknown
  rating_count?: unknown
  reviews_count?: unknown
  rating_source?: unknown
  rating_url?: unknown
}

type RawCatalogRatingSource = {
  provider?: unknown
  source?: unknown
  value?: unknown
  rating?: unknown
  count?: unknown
  reviews?: unknown
  reviews_count?: unknown
  url?: unknown
}

type RawCatalogRating = {
  value?: unknown
  rating?: unknown
  count?: unknown
  reviews_count?: unknown
  sources?: unknown
}

type RawCatalogFacet = { id?: unknown; code?: unknown; name?: unknown; count?: unknown }

export type RawPlacesCatalogResponse = {
  results?: unknown
  count?: unknown
  facets?: {
    categories?: unknown
    countries?: unknown
  } | null
}

const normalizeText = (value: unknown, fallback = ''): string => {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed || fallback
  }
  if (value == null) return fallback
  const normalized = String(value).trim()
  return normalized || fallback
}

const parseCoordinate = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value.replace(',', '.').trim())
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

const parseFacetId = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value.trim())
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

const parseFacetCount = (value: unknown): number => {
  const parsed = parseFacetId(value)
  return parsed != null && parsed >= 0 ? parsed : 0
}

const parseTravelId = (value: unknown): number | null => {
  const parsed = parseFacetId(value)
  return parsed != null && Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null
}

const buildRelatedTravelUrl = (
  item: RawCatalogItem,
  travelId: number | null,
): string => {
  const topLevelUrl = normalizeText(item.urlTravel)
  if (topLevelUrl) return topLevelUrl

  const nestedUrl = normalizeText(item.travel?.url)
  if (nestedUrl) return nestedUrl

  const nestedSlug = normalizeText(item.travel?.slug)
  if (nestedSlug) return `/travels/${encodeURIComponent(nestedSlug)}`

  return travelId != null ? `/travels/${travelId}` : ''
}

const readCoordinates = (
  item: RawCatalogItem,
): { lat: number; lng: number; coord: string } | null => {
  const directLat = parseCoordinate(item.lat)
  const directLng = parseCoordinate(item.lng)
  if (directLat != null && directLng != null) {
    return { lat: directLat, lng: directLng, coord: `${directLat},${directLng}` }
  }

  const rawCoord = normalizeText(item.coord)
  if (!rawCoord) return null
  const [firstRaw, secondRaw] = rawCoord.split(',').map((part) => part.trim())
  const first = parseCoordinate(firstRaw)
  const second = parseCoordinate(secondRaw)
  if (first == null || second == null) return null
  const firstLooksLat = Math.abs(first) <= 90
  const secondLooksLat = Math.abs(second) <= 90
  const lat = !firstLooksLat && secondLooksLat ? second : first
  const lng = !firstLooksLat && secondLooksLat ? first : second
  return { lat, lng, coord: `${lat},${lng}` }
}

const isPrivateOrLocalImageHost = (host: string): boolean =>
  host === 'localhost' ||
  host === '127.0.0.1' ||
  host.endsWith('.local') ||
  /^10\./.test(host) ||
  /^192\.168\./.test(host) ||
  /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)

const normalizeImageUrl = (value: unknown): string => {
  const url = normalizeText(value)
  if (!url) return ''
  if (/^http:\/\//i.test(url)) {
    try {
      const parsed = new URL(url)
      if (!isPrivateOrLocalImageHost(parsed.hostname.toLowerCase())) {
        return url.replace(/^http:\/\//i, 'https://')
      }
    } catch {
      return url.replace(/^http:\/\//i, 'https://')
    }
  }
  return url
}

const parseScore = (value: unknown): number | null => {
  const parsed = parseCoordinate(value)
  if (parsed == null) return null
  if (parsed <= 0) return null
  // Clamp defensively to the 0..5 star scale the UI renders.
  return Math.min(5, Math.max(0, parsed))
}

const parseReviewCount = (value: unknown): number => {
  const parsed = parseCoordinate(value)
  if (parsed == null || !Number.isFinite(parsed) || parsed < 0) return 0
  return Math.floor(parsed)
}

const parseRatingSource = (raw: unknown): PlaceRatingSource | null => {
  if (!raw || typeof raw !== 'object') return null
  const source = raw as RawCatalogRatingSource
  const provider = normalizeText(source.provider ?? source.source).toLowerCase()
  if (!provider) return null
  const value = parseScore(source.value ?? source.rating)
  const count = parseReviewCount(source.count ?? source.reviews_count ?? source.reviews)
  const url = normalizeImageUrl(source.url)
  return { provider, value, count, url: url || null }
}

const parseRating = (item: RawCatalogItem): PlaceRating | null => {
  const raw = item.rating

  // Structured object form: { value, count, sources: [...] }
  if (raw && typeof raw === 'object') {
    const ratingObj = raw as RawCatalogRating
    const sources = (Array.isArray(ratingObj.sources) ? ratingObj.sources : [])
      .map(parseRatingSource)
      .filter((source): source is PlaceRatingSource => source != null)
    const value =
      parseScore(ratingObj.value ?? ratingObj.rating) ??
      // Fall back to a weighted average of source scores when no top-level value.
      (() => {
        const scored = sources.filter((source) => source.value != null)
        if (scored.length === 0) return null
        const totalWeight = scored.reduce((sum, source) => sum + Math.max(1, source.count), 0)
        const weighted = scored.reduce(
          (sum, source) => sum + (source.value as number) * Math.max(1, source.count),
          0,
        )
        return totalWeight > 0 ? Math.round((weighted / totalWeight) * 10) / 10 : null
      })()
    const count =
      parseReviewCount(ratingObj.count ?? ratingObj.reviews_count) ||
      sources.reduce((sum, source) => sum + source.count, 0)
    if (value == null && sources.length === 0) return null
    return { value, count, sources }
  }

  // Flat aliases: rating (number) + rating_count + rating_source + rating_url.
  const flatValue = parseScore(typeof raw === 'number' ? raw : item.rating_value)
  if (flatValue == null) return null
  const flatCount = parseReviewCount(item.rating_count ?? item.reviews_count)
  const provider = normalizeText(item.rating_source).toLowerCase()
  const url = normalizeImageUrl(item.rating_url)
  return {
    value: flatValue,
    count: flatCount,
    sources: provider
      ? [{ provider, value: flatValue, count: flatCount, url: url || null }]
      : [],
  }
}

const mapCatalogItem = (raw: unknown): CatalogPlace | null => {
  if (!raw || typeof raw !== 'object') return null
  const item = raw as RawCatalogItem

  const coords = readCoordinates(item)
  if (!coords) return null

  const id = normalizeText(item.id)
  if (!id) return null

  const address = normalizeText(item.address)
  const category = normalizeText(item.category?.name, i18nT('shared:utils.placesCatalog.drugoe_3fd100e8'))
  const categoryId = parseFacetId(item.category?.id)
  const country = normalizeText(item.country?.name, i18nT('shared:utils.placesCatalog.strana_ne_ukazana_2418b87a'))
  const countryCode = normalizeText(item.country?.code)
  const travelId = parseTravelId(item.travel_id) ?? parseTravelId(item.travel?.id)
  const urlTravel = buildRelatedTravelUrl(item, travelId)
  const thumbUrl = normalizeImageUrl(item.image?.thumb_url)
  const landscapeUrl = normalizeImageUrl(item.image?.landscape_url)
  const title = normalizeText(item.title, address || i18nT('map:utils.placesCatalog.mesto_bez_nazvaniya_d8d437b0'))
  const searchText = normalizeText(item.search_text).toLowerCase()

  return {
    id,
    travelId,
    relatedTravelId: travelId,
    title,
    category,
    categoryId,
    country,
    countryCode,
    latNumber: coords.lat,
    lngNumber: coords.lng,
    coord: coords.coord,
    lat: String(coords.lat),
    lng: String(coords.lng),
    address: address || undefined,
    categoryName: category,
    travelImageThumbUrl: thumbUrl,
    travelImageLandscapeUrl: landscapeUrl || undefined,
    imageUrl: thumbUrl || undefined,
    urlTravel,
    rating: parseRating(item),

    searchText:
      searchText ||
      [title, address, category, country].filter(Boolean).join(' ').toLowerCase(),
  }
}

const mapCategoryFacet = (raw: unknown): CatalogFacet | null => {
  if (!raw || typeof raw !== 'object') return null
  const facet = raw as RawCatalogFacet
  const name = normalizeText(facet.name)
  if (!name) return null
  return { id: parseFacetId(facet.id), name, count: parseFacetCount(facet.count) }
}

const mapCountryFacet = (raw: unknown): CatalogFacet | null => {
  if (!raw || typeof raw !== 'object') return null
  const facet = raw as RawCatalogFacet
  const name = normalizeText(facet.name)
  if (!name) return null
  return { id: null, name, count: parseFacetCount(facet.count) }
}

export const mapPlacesCatalogResponse = (
  payload: RawPlacesCatalogResponse,
): PlacesCatalogPage => {
  const rawResults = Array.isArray(payload?.results) ? payload.results : []
  const places = rawResults
    .map(mapCatalogItem)
    .filter((place): place is CatalogPlace => place != null)

  const rawCount = parseFacetId(payload?.count)
  const count = rawCount != null && rawCount >= 0 ? rawCount : places.length

  const categoryFacets = (Array.isArray(payload?.facets?.categories) ? payload.facets.categories : [])
    .map(mapCategoryFacet)
    .filter((facet): facet is CatalogFacet => facet != null)

  const countryFacets = (Array.isArray(payload?.facets?.countries) ? payload.facets.countries : [])
    .map(mapCountryFacet)
    .filter((facet): facet is CatalogFacet => facet != null)

  return { places, count, categoryFacets, countryFacets }
}
