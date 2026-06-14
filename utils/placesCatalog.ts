import type { TravelCoords } from '@/types/types'

export type CatalogPlace = TravelCoords & {
  id: string
  title: string
  category: string
  country: string
  latNumber: number
  lngNumber: number
  searchText: string
}

export type PlaceCategoryGroup = {
  category: string
  count: number
  places: CatalogPlace[]
}

export type PlaceCountryGroup = {
  country: string
  count: number
  places: CatalogPlace[]
}

const FALLBACK_CATEGORY = 'Другое'
const FALLBACK_COUNTRY = 'Страна не указана'
const KNOWN_COUNTRIES = [
  'Беларусь',
  'Польша',
  'Литва',
  'Латвия',
  'Эстония',
  'Россия',
  'Украина',
  'Грузия',
  'Армения',
  'Азербайджан',
  'Турция',
  'Вьетнам',
  'Италия',
  'Франция',
  'Германия',
  'Чехия',
  'Словакия',
  'Австрия',
  'Швейцария',
  'Испания',
  'Португалия',
  'Греция',
  'Норвегия',
  'Швеция',
  'Финляндия',
  'Дания',
  'Нидерланды',
  'Бельгия',
  'Венгрия',
  'Румыния',
  'Болгария',
  'Сербия',
  'Хорватия',
  'Черногория',
  'Словения',
  'Албания',
  'США',
  'Канада',
] as const

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

// "12", "№7", "136км", "12 km", "170м", "3." — user-entered marker numbers,
// not real place names. Such tokens make terrible card titles / sort keys.
const isJunkPlaceLabel = (value: string): boolean => {
  const v = value.trim()
  if (!v) return true
  return /^№?\s*\d+([.,]\d+)?\s*(км|km|м|m)?\.?$/i.test(v)
}

// "52.9654099, 29.7841898" — raw lat/lng pair, never a real place name.
const isCoordinatePair = (value: string): boolean =>
  /^[-+]?\d{1,3}([.,]\d+)?\s*[,;]\s*[-+]?\d{1,3}([.,]\d+)?$/.test(value.trim())

// NB: JS \b word boundaries don't work around Cyrillic, so these use plain
// lowercase string checks instead of \b-anchored regexes.

// Administrative-unit tails ("…сельский Совет", "…район", "…область") read as
// bureaucratic noise in a card title — keep them in the address line, not the name.
const ADMIN_UNIT_SUBSTRINGS = [
  'сельсовет',
  'сельский совет',
  'поселковый совет',
  'городской совет',
  'с/с',
  'район',
  'область',
  'обл.',
] as const
const isAdminUnitLabel = (value: string): boolean => {
  const v = value.trim().toLowerCase()
  return ADMIN_UNIT_SUBSTRINGS.some((token) => v.includes(token))
}

// "улица Мира", "пер. Садовый" — a street is a worse title than the locality that
// follows it, so we skip it when a better part exists.
const STREET_PREFIXES = [
  'улица',
  'ул',
  'переулок',
  'пер',
  'проспект',
  'просп',
  'пр-т',
  'шоссе',
  'тракт',
  'бульвар',
  'бул',
  'набережная',
  'наб',
  'площадь',
  'пл',
  'проезд',
  'тупик',
  'микрорайон',
  'мкр',
] as const
const isStreetLabel = (value: string): boolean => {
  const v = value.trim().toLowerCase()
  return STREET_PREFIXES.some(
    (p) => v === p || v.startsWith(`${p} `) || v.startsWith(`${p}.`),
  )
}

const getPlaceTitle = (place: TravelCoords): string => {
  const maybeName = normalizeText((place as TravelCoords & { name?: unknown }).name)
  if (maybeName && !isJunkPlaceLabel(maybeName) && !isCoordinatePair(maybeName)) return maybeName

  const address = normalizeText(place.address)
  if (!address) return maybeName || 'Место без названия'

  const parts = address
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
  // Drop house-number / distance segments, then street and administrative-unit
  // segments (they read as noise in a title — «улица …», «… сельский Совет»),
  // keeping the first 2 remaining parts (e.g. point name + locality).
  const meaningful = parts.filter((part) => !isJunkPlaceLabel(part))
  const cleaned = meaningful.filter(
    (part) => !isStreetLabel(part) && !isAdminUnitLabel(part),
  )
  const pool = cleaned.length > 0 ? cleaned : meaningful
  const picked = pool.slice(0, 2).join(', ')
  if (picked) return picked

  const category = getPrimaryCategory(place.categoryName)
  return category !== FALLBACK_CATEGORY ? `${category} без названия` : 'Место без названия'
}

const getPlaceCountry = (place: TravelCoords): string => {
  const record = place as TravelCoords & Record<string, unknown>
  const direct = normalizeText(
    record.countryName ??
      record.country_name ??
      record.country ??
      record.countryTitle ??
      record.country_title ??
      record.country_name_ru,
  )
  if (direct) return direct

  const addressParts = normalizeText(place.address)
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)

  const addressLower = addressParts.join(' ').toLowerCase()
  const knownCountry = KNOWN_COUNTRIES.find((country) =>
    addressLower.includes(country.toLowerCase()),
  )
  if (knownCountry) return knownCountry

  const fallbackPart = [...addressParts]
    .reverse()
    .find((part) => !/^\d{4,}(?:[-\s]\d+)?$/.test(part) && !/^\d/.test(part))

  return fallbackPart || FALLBACK_COUNTRY
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

    const title = getPlaceTitle(place)
    const category = getPrimaryCategory(place.categoryName)
    const country = getPlaceCountry(place)

    places.push({
      ...place,
      id: identity,
      title,
      category,
      country,
      latNumber: coords.lat,
      lngNumber: coords.lng,
      urlTravel: travelUrl,
      searchText: [title, place.address, category, country]
        .filter(Boolean)
        .join(' ')
        .toLowerCase(),
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

export const groupCatalogCountries = (places: CatalogPlace[]): PlaceCountryGroup[] => {
  const grouped = new Map<string, CatalogPlace[]>()

  places.forEach((place) => {
    const current = grouped.get(place.country) ?? []
    current.push(place)
    grouped.set(place.country, current)
  })

  return Array.from(grouped.entries())
    .map(([country, items]) => ({
      country,
      count: items.length,
      places: [...items].sort((a, b) => a.title.localeCompare(b.title, 'ru')),
    }))
    .sort((a, b) => {
      if (a.country === FALLBACK_COUNTRY) return 1
      if (b.country === FALLBACK_COUNTRY) return -1
      if (b.count !== a.count) return b.count - a.count
      return a.country.localeCompare(b.country, 'ru')
    })
}

export const filterCatalogPlaces = (
  places: CatalogPlace[],
  query: string,
  category?: string | string[] | null,
  country?: string | null,
): CatalogPlace[] => {
  const normalizedQuery = query.trim().toLowerCase()
  const normalizedCategories = (Array.isArray(category) ? category : category ? [category] : [])
    .map((item) => item.trim())
    .filter(Boolean)
  const normalizedCountry = country?.trim()

  return places.filter((place) => {
    if (normalizedCategories.length > 0 && !normalizedCategories.includes(place.category)) return false
    if (normalizedCountry && place.country !== normalizedCountry) return false
    if (!normalizedQuery) return true

    return place.searchText.includes(normalizedQuery)
  })
}
