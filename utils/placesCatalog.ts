import type { TravelCoords } from '@/types/types'
import { translate as i18nT } from '@/i18n'


export type CatalogPlace = TravelCoords & {
  id: string
  title: string
  category: string
  categoryId: number | null
  country: string
  countryCode: string
  latNumber: number
  lngNumber: number
  searchText: string
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
type RawCatalogTravel = { url?: unknown; slug?: unknown }
type RawCatalogImage = { thumb_url?: unknown; landscape_url?: unknown }

type RawCatalogItem = {
  id?: unknown
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
  const urlTravel = normalizeText(item.travel?.url)
  const thumbUrl = normalizeImageUrl(item.image?.thumb_url)
  const landscapeUrl = normalizeImageUrl(item.image?.landscape_url)
  const title = normalizeText(item.title, address || i18nT('map:utils.placesCatalog.mesto_bez_nazvaniya_d8d437b0'))
  const searchText = normalizeText(item.search_text).toLowerCase()

  return {
    id,
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
