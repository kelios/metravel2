import type { Travel } from '@/types/types'
import type { TravelStatusEntry } from '@/stores/travelStatusStore'

type CountryDescriptor = {
  id?: string
  name?: string
  code?: string
}

type CatalogCountry = {
  id: string
  name: string
  code?: string
  aliases: string[]
  region: ProfileCountryRegionKey
}

export type ProfileCountryRegionKey =
  | 'europe'
  | 'asia'
  | 'africa'
  | 'northAmerica'
  | 'southAmerica'
  | 'oceania'
  | 'other'

export type ProfileCountryRow = {
  id: string
  name: string
  code?: string
  region: ProfileCountryRegionKey
  visited: boolean
  source: 'catalog' | 'visited'
}

export type ProfileCountryRegionGroup = {
  key: ProfileCountryRegionKey
  label: string
  totalCount: number
  visitedCount: number
  remainingCount: number
  rows: ProfileCountryRow[]
}

export type ProfileCountryStats = {
  rows: ProfileCountryRow[]
  regionGroups: ProfileCountryRegionGroup[]
  visitedCount: number
  remainingCount: number
  totalCount: number
}

const NAME_FIELDS = [
  'title_ru',
  'name_ru',
  'name',
  'title',
  'title_en',
  'name_en',
  'text',
  'label',
] as const

const CODE_FIELDS = [
  'country_code',
  'countryCode',
  'code',
  'iso2',
  'iso',
  'alpha2',
  'alpha_2',
  'ISO3166_1_alpha2',
] as const

const ID_FIELDS = ['country_id', 'countryId', 'id', 'pk', 'value'] as const
const REGION_FIELDS = ['region', 'continent', 'zone', 'world_region'] as const

export const PROFILE_COUNTRY_REGION_META: Array<{ key: ProfileCountryRegionKey; label: string }> = [
  { key: 'europe', label: 'Европа' },
  { key: 'asia', label: 'Азия' },
  { key: 'africa', label: 'Африка' },
  { key: 'northAmerica', label: 'Северная Америка' },
  { key: 'southAmerica', label: 'Южная Америка' },
  { key: 'oceania', label: 'Океания' },
  { key: 'other', label: 'Другие территории' },
]

const REGION_BY_KEYWORD: Record<string, ProfileCountryRegionKey> = {
  europe: 'europe',
  europa: 'europe',
  'европа': 'europe',
  asia: 'asia',
  'азия': 'asia',
  africa: 'africa',
  'африка': 'africa',
  north_america: 'northAmerica',
  'north america': 'northAmerica',
  'северная америка': 'northAmerica',
  south_america: 'southAmerica',
  'south america': 'southAmerica',
  'южная америка': 'southAmerica',
  oceania: 'oceania',
  'океания': 'oceania',
}

const REGION_CODE_SETS: Record<Exclude<ProfileCountryRegionKey, 'other'>, Set<string>> = {
  europe: new Set([
    'AD', 'AL', 'AM', 'AT', 'AX', 'AZ', 'BA', 'BE', 'BG', 'BY', 'CH', 'CY', 'CZ', 'DE', 'DK', 'EE',
    'ES', 'FI', 'FO', 'FR', 'GB', 'GE', 'GG', 'GI', 'GR', 'HR', 'HU', 'IE', 'IM', 'IS', 'IT', 'JE',
    'LI', 'LT', 'LU', 'LV', 'MC', 'MD', 'ME', 'MK', 'MT', 'NL', 'NO', 'PL', 'PT', 'RO', 'RS', 'RU',
    'SE', 'SI', 'SJ', 'SK', 'SM', 'TR', 'UA', 'VA', 'XK',
  ]),
  asia: new Set([
    'AE', 'AF', 'BD', 'BH', 'BN', 'BT', 'CC', 'CN', 'CX', 'HK', 'ID', 'IL', 'IN', 'IO', 'IQ', 'IR',
    'JO', 'JP', 'KG', 'KH', 'KP', 'KR', 'KW', 'KZ', 'LA', 'LB', 'LK', 'MM', 'MN', 'MO', 'MV', 'MY',
    'NP', 'OM', 'PH', 'PK', 'PS', 'QA', 'SA', 'SG', 'SY', 'TH', 'TJ', 'TL', 'TM', 'TW', 'UZ', 'VN',
    'YE',
  ]),
  africa: new Set([
    'AO', 'BF', 'BI', 'BJ', 'BW', 'CD', 'CF', 'CG', 'CI', 'CM', 'CV', 'DJ', 'DZ', 'EG', 'EH', 'ER',
    'ET', 'GA', 'GH', 'GM', 'GN', 'GQ', 'GW', 'KE', 'KM', 'LR', 'LS', 'LY', 'MA', 'MG', 'ML', 'MR',
    'MU', 'MW', 'MZ', 'NA', 'NE', 'NG', 'RE', 'RW', 'SC', 'SD', 'SH', 'SL', 'SN', 'SO', 'SS', 'ST',
    'SZ', 'TD', 'TG', 'TN', 'TZ', 'UG', 'YT', 'ZA', 'ZM', 'ZW',
  ]),
  northAmerica: new Set([
    'AG', 'AI', 'AW', 'BB', 'BL', 'BM', 'BQ', 'BS', 'BZ', 'CA', 'CR', 'CU', 'CW', 'DM', 'DO', 'GD',
    'GL', 'GP', 'GT', 'HN', 'HT', 'JM', 'KN', 'KY', 'LC', 'MF', 'MQ', 'MS', 'MX', 'NI', 'PA', 'PM',
    'PR', 'SV', 'SX', 'TC', 'TT', 'US', 'VC', 'VG', 'VI',
  ]),
  southAmerica: new Set([
    'AR', 'BO', 'BR', 'CL', 'CO', 'EC', 'FK', 'GF', 'GY', 'PE', 'PY', 'SR', 'UY', 'VE',
  ]),
  oceania: new Set([
    'AS', 'AU', 'CK', 'FJ', 'FM', 'GU', 'KI', 'MH', 'MP', 'NC', 'NF', 'NR', 'NU', 'NZ', 'PF', 'PG',
    'PN', 'PW', 'SB', 'TK', 'TO', 'TV', 'UM', 'VU', 'WF', 'WS',
  ]),
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const readString = (record: Record<string, unknown>, fields: readonly string[]) => {
  for (const field of fields) {
    const value = record[field]
    if (typeof value === 'string' && value.trim()) return value.trim()
    if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  }
  return ''
}

const normalizeRegion = (value: unknown): ProfileCountryRegionKey | null => {
  if (typeof value !== 'string') return null
  const key = normalizeCountryName(value).replace(/\s+/g, ' ')
  return REGION_BY_KEYWORD[key] ?? REGION_BY_KEYWORD[key.replace(/\s+/g, '_')] ?? null
}

export const normalizeCountryName = (value: unknown): string => {
  if (typeof value !== 'string') return ''
  return value
    .trim()
    .replace(/ё/g, 'е')
    .replace(/Ё/g, 'Е')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .replace(/[«»"'`.,()]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const normalizeCountryCode = (value: unknown): string => {
  if (typeof value !== 'string' && typeof value !== 'number') return ''
  const code = String(value).trim().toUpperCase()
  return /^[A-Z]{2,3}$/.test(code) ? code : ''
}

const collectNameAliases = (record: Record<string, unknown>, fallbackName: string) => {
  const aliases = new Set<string>()
  if (fallbackName) aliases.add(fallbackName)
  NAME_FIELDS.forEach((field) => {
    const value = record[field]
    if (typeof value === 'string' && value.trim()) aliases.add(value.trim())
  })
  return Array.from(aliases)
}

const getCountryRegion = (record: Record<string, unknown> | null, code?: string): ProfileCountryRegionKey => {
  if (record) {
    const rawRegion = readString(record, REGION_FIELDS)
    const normalized = normalizeRegion(rawRegion)
    if (normalized) return normalized
  }

  if (code) {
    for (const [region, codes] of Object.entries(REGION_CODE_SETS) as Array<[Exclude<ProfileCountryRegionKey, 'other'>, Set<string>]>) {
      if (codes.has(code)) return region
    }
  }

  return 'other'
}

export const normalizeCountryCatalog = (rawCountries: unknown[]): CatalogCountry[] => {
  const seen = new Set<string>()

  return rawCountries
    .map((country, index): CatalogCountry | null => {
      if (!isRecord(country)) {
        const name = typeof country === 'string' ? country.trim() : ''
        if (!name) return null
        return {
          id: `raw-${index}`,
          name,
          region: 'other',
          aliases: [name],
        }
      }

      const name = readString(country, NAME_FIELDS)
      if (!name) return null

      const rawId = readString(country, ID_FIELDS)
      const code = normalizeCountryCode(readString(country, CODE_FIELDS))
      const id = rawId || code || `country-${index}`

      return {
        id,
        name,
        code: code || undefined,
        region: getCountryRegion(country, code || undefined),
        aliases: collectNameAliases(country, name),
      }
    })
    .filter((country): country is CatalogCountry => {
      if (!country) return false
      const key = country.code ? `code:${country.code}` : `name:${normalizeCountryName(country.name)}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
}

const descriptorFromCountryValue = (value: unknown): CountryDescriptor | null => {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return null
    const code = normalizeCountryCode(trimmed)
    return /^\d+$/.test(trimmed)
      ? { id: trimmed }
      : { name: trimmed, code: code || undefined }
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return { id: String(value) }
  }

  if (!isRecord(value)) return null

  const id = readString(value, ID_FIELDS)
  const name = readString(value, NAME_FIELDS)
  const code = normalizeCountryCode(readString(value, CODE_FIELDS))

  if (!id && !name && !code) return null
  return {
    id: id || undefined,
    name: name || undefined,
    code: code || undefined,
  }
}

export const getTravelCountryDescriptors = (travel: Travel): CountryDescriptor[] => {
  const record = travel as unknown as Record<string, unknown>
  const descriptors: CountryDescriptor[] = []

  const directName =
    record.countryName ??
    record.country_name ??
    record.country ??
    record.countryTitle ??
    record.country_title
  const directCode =
    record.countryCode ??
    record.country_code ??
    record.code ??
    record.iso2
  const directId = record.country_id ?? record.countryId

  const direct = descriptorFromCountryValue({
    country_id: directId,
    title_ru: directName,
    country_code: directCode,
  })
  if (direct) descriptors.push(direct)

  const countries = record.countries
  if (Array.isArray(countries)) {
    countries.forEach((item) => {
      const descriptor = descriptorFromCountryValue(item)
      if (descriptor) descriptors.push(descriptor)
    })
  }

  return descriptors
}

const descriptorKey = (descriptor: CountryDescriptor) =>
  descriptor.code
    ? `code:${descriptor.code}`
    : descriptor.name
      ? `name:${normalizeCountryName(descriptor.name)}`
      : descriptor.id
        ? `id:${descriptor.id}`
        : ''

const compareCountryRows = (a: ProfileCountryRow, b: ProfileCountryRow) => {
  if (a.visited !== b.visited) return a.visited ? -1 : 1
  return a.name.localeCompare(b.name, 'ru')
}

export const groupProfileCountriesByRegion = (rows: ProfileCountryRow[]): ProfileCountryRegionGroup[] => {
  const groups = new Map<ProfileCountryRegionKey, ProfileCountryRow[]>()

  rows.forEach((row) => {
    const groupRows = groups.get(row.region) ?? []
    groupRows.push(row)
    groups.set(row.region, groupRows)
  })

  return PROFILE_COUNTRY_REGION_META
    .map((meta) => {
      const groupRows = (groups.get(meta.key) ?? []).slice().sort(compareCountryRows)
      const visitedCount = groupRows.filter((row) => row.visited).length
      const totalCount = groupRows.length
      return {
        ...meta,
        totalCount,
        visitedCount,
        remainingCount: Math.max(0, totalCount - visitedCount),
        rows: groupRows,
      }
    })
    .filter((group) => group.totalCount > 0)
}

export function buildProfileCountryStats({
  countries,
  travels,
  personalTravelStatusEntries,
}: {
  countries: unknown[]
  travels: Travel[]
  personalTravelStatusEntries: TravelStatusEntry[]
}): ProfileCountryStats {
  const catalog = normalizeCountryCatalog(countries)
  const visitedIds = new Set<string>()
  const visitedCodes = new Set<string>()
  const visitedNames = new Set<string>()
  const visitedDescriptors: CountryDescriptor[] = []

  const addVisitedDescriptor = (descriptor: CountryDescriptor | null) => {
    if (!descriptor) return
    if (descriptor.id) visitedIds.add(descriptor.id)
    if (descriptor.code) visitedCodes.add(descriptor.code)
    if (descriptor.name) visitedNames.add(normalizeCountryName(descriptor.name))
    visitedDescriptors.push(descriptor)
  }

  travels.forEach((travel) => {
    getTravelCountryDescriptors(travel).forEach(addVisitedDescriptor)
  })

  personalTravelStatusEntries
    .filter((entry) => entry.status === 'visited')
    .forEach((entry) => addVisitedDescriptor(descriptorFromCountryValue(entry.country)))

  const rows = catalog.map((country): ProfileCountryRow => {
    const aliasVisited = country.aliases.some((alias) => visitedNames.has(normalizeCountryName(alias)))
    const visited =
      visitedIds.has(country.id) ||
      Boolean(country.code && visitedCodes.has(country.code)) ||
      aliasVisited

    return {
      id: country.id,
      name: country.name,
      code: country.code,
      region: country.region,
      visited,
      source: 'catalog',
    }
  })

  const matchedVisitedKeys = new Set<string>()
  rows.forEach((row) => {
    if (!row.visited) return
    if (row.code) matchedVisitedKeys.add(`code:${row.code}`)
    matchedVisitedKeys.add(`name:${normalizeCountryName(row.name)}`)
    matchedVisitedKeys.add(`id:${row.id}`)
  })

  visitedDescriptors.forEach((descriptor) => {
    if (!descriptor.name) return
    const key = descriptorKey(descriptor)
    if (!key || matchedVisitedKeys.has(key)) return
    const nameKey = `name:${normalizeCountryName(descriptor.name)}`
    if (matchedVisitedKeys.has(nameKey)) return
    rows.push({
      id: key,
      name: descriptor.name,
      code: descriptor.code,
      region: getCountryRegion(null, descriptor.code),
      visited: true,
      source: 'visited',
    })
    matchedVisitedKeys.add(key)
    matchedVisitedKeys.add(nameKey)
  })

  const sortedRows = rows.sort(compareCountryRows)
  const visitedCount = sortedRows.filter((row) => row.visited).length
  const totalCount = sortedRows.length

  return {
    rows: sortedRows,
    regionGroups: groupProfileCountriesByRegion(sortedRows),
    visitedCount,
    remainingCount: Math.max(0, totalCount - visitedCount),
    totalCount,
  }
}
