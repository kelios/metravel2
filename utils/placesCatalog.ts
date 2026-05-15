import type { TravelCoords } from '@/types/types'

export type CatalogPlace = TravelCoords & {
  id: string
  title: string
  category: string
  latNumber: number
  lngNumber: number
}

export type PlaceCategoryGroup = {
  category: string
  count: number
  places: CatalogPlace[]
}

const FALLBACK_CATEGORY = 'Другое'

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

const readPointCoordinates = (place: TravelCoords): { lat: number; lng: number } | null => {
  const directLat = parseCoordinate(place.lat)
  const directLng = parseCoordinate(place.lng)
  if (directLat != null && directLng != null) return { lat: directLat, lng: directLng }

  const coord = normalizeText(place.coord)
  if (!coord) return null

  const [firstRaw, secondRaw] = coord.split(',').map((part) => part.trim())
  const first = parseCoordinate(firstRaw)
  const second = parseCoordinate(secondRaw)
  if (first == null || second == null) return null

  const firstLooksLat = Math.abs(first) <= 90
  const secondLooksLat = Math.abs(second) <= 90
  if (!firstLooksLat && secondLooksLat) return { lat: second, lng: first }
  return { lat: first, lng: second }
}

const getPrimaryCategory = (value: unknown): string => {
  const category = normalizeText(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)[0]

  return category || FALLBACK_CATEGORY
}

const getPlaceTitle = (place: TravelCoords): string => {
  const maybeName = normalizeText((place as TravelCoords & { name?: unknown }).name)
  if (maybeName) return maybeName

  const address = normalizeText(place.address)
  if (!address) return 'Место без названия'

  const firstPart = address.split(',').map((part) => part.trim()).filter(Boolean)[0]
  return firstPart || address
}

const getPlaceIdentity = (place: TravelCoords, coords: { lat: number; lng: number }): string => {
  const rawId = normalizeText((place as TravelCoords & { id?: unknown }).id)
  if (rawId) return `id:${rawId}`

  const address = normalizeText(place.address).toLowerCase()
  const travelUrl = normalizeText(place.urlTravel).toLowerCase()
  return [
    address || 'unknown',
    coords.lat.toFixed(5),
    coords.lng.toFixed(5),
    travelUrl || 'no-travel',
  ].join('|')
}

export const normalizeCatalogPlaces = (rawPlaces: TravelCoords[]): CatalogPlace[] => {
  const seen = new Set<string>()
  const places: CatalogPlace[] = []

  rawPlaces.forEach((place) => {
    const coords = readPointCoordinates(place)
    if (!coords) return

    const travelUrl = normalizeText(place.urlTravel)
    const identity = getPlaceIdentity(place, coords)
    if (seen.has(identity)) return
    seen.add(identity)

    places.push({
      ...place,
      id: identity,
      title: getPlaceTitle(place),
      category: getPrimaryCategory(place.categoryName),
      latNumber: coords.lat,
      lngNumber: coords.lng,
      urlTravel: travelUrl,
    })
  })

  return places.sort((a, b) => a.title.localeCompare(b.title, 'ru'))
}

export const groupCatalogPlaces = (places: CatalogPlace[]): PlaceCategoryGroup[] => {
  const grouped = new Map<string, CatalogPlace[]>()

  places.forEach((place) => {
    const current = grouped.get(place.category) ?? []
    current.push(place)
    grouped.set(place.category, current)
  })

  return Array.from(grouped.entries())
    .map(([category, items]) => ({
      category,
      count: items.length,
      places: [...items].sort((a, b) => a.title.localeCompare(b.title, 'ru')),
    }))
    .sort((a, b) => {
      if (a.category === FALLBACK_CATEGORY) return 1
      if (b.category === FALLBACK_CATEGORY) return -1
      if (b.count !== a.count) return b.count - a.count
      return a.category.localeCompare(b.category, 'ru')
    })
}

export const filterCatalogPlaces = (
  places: CatalogPlace[],
  query: string,
  category?: string | null,
): CatalogPlace[] => {
  const normalizedQuery = query.trim().toLowerCase()
  const normalizedCategory = category?.trim()

  return places.filter((place) => {
    if (normalizedCategory && place.category !== normalizedCategory) return false
    if (!normalizedQuery) return true

    return [place.title, place.address, place.category]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(normalizedQuery)
  })
}
