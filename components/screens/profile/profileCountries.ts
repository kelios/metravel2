import type { Travel } from '@/types/types'
import type { TravelStatusEntry } from '@/stores/travelStatusStore'
import { SUPPORTED_LOCALES, createCollator, translate as i18nT } from '@/i18n'


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

export type VisitedCountryVisit = {
  travelId: string
  title: string
  url: string
  year: number | null
}

export type ProfileCountryRow = {
  id: string
  name: string
  code?: string
  region: ProfileCountryRegionKey
  visited: boolean
  source: 'backend' | 'catalog' | 'visited'
  visitedTravelsCount?: number
  firstVisitedDate?: string | null
  visits?: VisitedCountryVisit[]
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

export type ProfileCountryProgressPayload = {
  total_count?: number | null
  visited_count?: number | null
  remaining_count?: number | null
  countries?: Array<Record<string, unknown>> | null
  region_groups?: Array<Record<string, unknown>> | null
} | null | undefined

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
const FIRST_VISITED_DATE_FIELDS = ['first_visited_date', 'firstVisitedDate'] as const
const VISITED_TRAVELS_COUNT_FIELDS = ['visited_travels_count', 'visitedTravelsCount', 'visits_count', 'visit_count'] as const
const REGION_GROUP_TOTAL_COUNT_FIELDS = ['total_count', 'totalCount'] as const
const REGION_GROUP_VISITED_COUNT_FIELDS = ['visited_count', 'visitedCount'] as const
const REGION_GROUP_REMAINING_COUNT_FIELDS = ['remaining_count', 'remainingCount'] as const

export const PROFILE_COUNTRY_REGION_META: Array<{ key: ProfileCountryRegionKey; label: string }> = [
  { key: 'europe', get label() { return i18nT('profile:components.screens.profile.profileCountries.regions.europe') } },
  { key: 'asia', get label() { return i18nT('profile:components.screens.profile.profileCountries.regions.asia') } },
  { key: 'africa', get label() { return i18nT('profile:components.screens.profile.profileCountries.regions.africa') } },
  { key: 'northAmerica', get label() { return i18nT('profile:components.screens.profile.profileCountries.regions.northAmerica') } },
  { key: 'southAmerica', get label() { return i18nT('profile:components.screens.profile.profileCountries.regions.southAmerica') } },
  { key: 'oceania', get label() { return i18nT('profile:components.screens.profile.profileCountries.regions.oceania') } },
  { key: 'other', get label() { return i18nT('profile:components.screens.profile.profileCountries.regions.other') } },
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
  northamerica: 'northAmerica',
  northAmerica: 'northAmerica',
  'north america': 'northAmerica',
  'северная америка': 'northAmerica',
  south_america: 'southAmerica',
  southamerica: 'southAmerica',
  southAmerica: 'southAmerica',
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

const ISO_COUNTRY_CODES = [
  'AD', 'AE', 'AF', 'AG', 'AI', 'AL', 'AM', 'AO', 'AQ', 'AR', 'AS', 'AT', 'AU', 'AW', 'AX', 'AZ',
  'BA', 'BB', 'BD', 'BE', 'BF', 'BG', 'BH', 'BI', 'BJ', 'BL', 'BM', 'BN', 'BO', 'BQ', 'BR', 'BS',
  'BT', 'BV', 'BW', 'BY', 'BZ', 'CA', 'CC', 'CD', 'CF', 'CG', 'CH', 'CI', 'CK', 'CL', 'CM', 'CN',
  'CO', 'CR', 'CU', 'CV', 'CW', 'CX', 'CY', 'CZ', 'DE', 'DJ', 'DK', 'DM', 'DO', 'DZ', 'EC', 'EE',
  'EG', 'EH', 'ER', 'ES', 'ET', 'FI', 'FJ', 'FK', 'FM', 'FO', 'FR', 'GA', 'GB', 'GD', 'GE', 'GF',
  'GG', 'GH', 'GI', 'GL', 'GM', 'GN', 'GP', 'GQ', 'GR', 'GS', 'GT', 'GU', 'GW', 'GY', 'HK', 'HM',
  'HN', 'HR', 'HT', 'HU', 'ID', 'IE', 'IL', 'IM', 'IN', 'IO', 'IQ', 'IR', 'IS', 'IT', 'JE', 'JM',
  'JO', 'JP', 'KE', 'KG', 'KH', 'KI', 'KM', 'KN', 'KP', 'KR', 'KW', 'KY', 'KZ', 'LA', 'LB', 'LC',
  'LI', 'LK', 'LR', 'LS', 'LT', 'LU', 'LV', 'LY', 'MA', 'MC', 'MD', 'ME', 'MF', 'MG', 'MH', 'MK',
  'ML', 'MM', 'MN', 'MO', 'MP', 'MQ', 'MR', 'MS', 'MT', 'MU', 'MV', 'MW', 'MX', 'MY', 'MZ', 'NA',
  'NC', 'NE', 'NF', 'NG', 'NI', 'NL', 'NO', 'NP', 'NR', 'NU', 'NZ', 'OM', 'PA', 'PE', 'PF', 'PG',
  'PH', 'PK', 'PL', 'PM', 'PN', 'PR', 'PS', 'PT', 'PW', 'PY', 'QA', 'RE', 'RO', 'RS', 'RU', 'RW',
  'SA', 'SB', 'SC', 'SD', 'SE', 'SG', 'SH', 'SI', 'SJ', 'SK', 'SL', 'SM', 'SN', 'SO', 'SR', 'SS',
  'ST', 'SV', 'SX', 'SY', 'SZ', 'TC', 'TD', 'TF', 'TG', 'TH', 'TJ', 'TK', 'TL', 'TM', 'TN', 'TO',
  'TR', 'TT', 'TV', 'TW', 'TZ', 'UA', 'UG', 'UM', 'US', 'UY', 'UZ', 'VA', 'VC', 'VE', 'VG', 'VI',
  'VN', 'VU', 'WF', 'WS', 'YE', 'YT', 'ZA', 'ZM', 'ZW', 'XK',
] as const

const COUNTRY_CODE_NAME_ALIASES: Record<string, string> = {
  'США': 'US',
  'Россия': 'RU',
  'Южная Корея': 'KR',
  'Северная Корея': 'KP',
  'Вьетнам': 'VN',
  'Лаос': 'LA',
  'Молдова': 'MD',
  'Иран': 'IR',
  'Сирия': 'SY',
  'Танзания': 'TZ',
  'Великобритания': 'GB',
  'Боливия': 'BO',
  'Венесуэла': 'VE',
  'Бруней-Даруссалам': 'BN',
  'Кабо-Верде': 'CV',
  'Кот д`Ивуар': 'CI',
  'Конго, демократическая республика': 'CD',
  'Конго': 'CG',
  'Микронезия, Федеративные Штаты': 'FM',
  'Палестинская автономия': 'PS',
  'Палестина': 'PS',
  'Тайвань': 'TW',
  'Турция': 'TR',
  'Свазиленд': 'SZ',
  'Эсватини': 'SZ',
  'Восточный Тимор': 'TL',
  'Бонайре, Синт-Эстатиус и Саба': 'BQ',
  'Сент-Мартен': 'MF',
  'Синт-Мартен': 'SX',
  'Святая Елена': 'SH',
  'Южная Георгия и Южные Сандвичевы острова': 'GS',
  'Территория Французские Южные и Антарктические Земли': 'TF',
  'Питкерн': 'PN',
  'Питкэрн': 'PN',
  'Уоллис и Футуна': 'WF',
  'Кокосовые острова': 'CC',
  'Остров Рождества': 'CX',
  'Остров Норфолк': 'NF',
  'Острова Кука': 'CK',
  'Фарерские острова': 'FO',
  'Фолклендские острова': 'FK',
  'Мартиника': 'MQ',
  'Гваделупа': 'GP',
  'Реюньон': 'RE',
  'Майотта': 'YT',
  'Гвиана': 'GF',
  'Западная Сахара': 'EH',
  'Северные Марианские острова': 'MP',
  'Американское Самоа': 'AS',
  'Виргинские острова, Британские': 'VG',
  'Виргинские острова, США': 'VI',
  'Острова Теркс и Кайкос': 'TC',
  'Туркс и Кайкос': 'TC',
  'Сен-Бартелеми': 'BL',
  'Сент-Пьер и Микелон': 'PM',
  'Святой Мартин, французская часть': 'MF',
  'Кюрасао': 'CW',
  'Аруба': 'AW',
  'Ангилья': 'AI',
  'Бермуды': 'BM',
  'Острова Кайман': 'KY',
  'Каймановы острова': 'KY',
  'Пуэрто-Рико': 'PR',
  'Гибралтар': 'GI',
  'Гернси': 'GG',
  'Джерси': 'JE',
  'Остров Мэн': 'IM',
  'Шпицберген и Ян Майен': 'SJ',
  'Аландские острова': 'AX',
  'Ватикан': 'VA',
  'Гонконг': 'HK',
  'Макао': 'MO',
  'Кыргызстан': 'KG',
  'Македония': 'MK',
  'Маршалловы Острова': 'MH',
  'Мьянма': 'MM',
  'Объединенные Арабские Эмираты': 'AE',
  'Папуа - Новая Гвинея': 'PG',
  'Папуа Новая Гвинея': 'PG',
  'Сейшелы': 'SC',
  'Сент-Винсент': 'VC',
  'Сирийская Арабская Республика': 'SY',
  'Соломоновы Острова': 'SB',
}

type IntlDisplayNamesConstructor = new (
  locales: string | string[],
  options: { type: 'region' }
) => { of: (code: string) => string | undefined }

let localizedCountryCodeIndex: Map<string, string> | null = null

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

const getLocalizedCountryCodeIndex = () => {
  if (localizedCountryCodeIndex) return localizedCountryCodeIndex

  const index = new Map<string, string>()
  Object.entries(COUNTRY_CODE_NAME_ALIASES).forEach(([name, code]) => {
    index.set(normalizeCountryName(name), code)
  })

  const DisplayNames = (Intl as unknown as { DisplayNames?: IntlDisplayNamesConstructor }).DisplayNames
  if (DisplayNames) {
    SUPPORTED_LOCALES.forEach((locale) => {
      const regionNames = new DisplayNames(locale, { type: 'region' })
      ISO_COUNTRY_CODES.forEach((code) => {
        const label = regionNames.of(code)
        if (label) index.set(normalizeCountryName(label), code)
      })
    })
  }

  localizedCountryCodeIndex = index
  return index
}

const resolveCountryCode = (record: Record<string, unknown>, name: string) => {
  const rawCode = normalizeCountryCode(readString(record, CODE_FIELDS))
  if (rawCode) return rawCode

  const index = getLocalizedCountryCodeIndex()
  const possibleNames = collectNameAliases(record, name)
  for (const possibleName of possibleNames) {
    const code = index.get(normalizeCountryName(possibleName))
    if (code) return code
  }

  return ''
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
      const code = resolveCountryCode(country, name)
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
  const code = name
    ? resolveCountryCode(value, name)
    : normalizeCountryCode(readString(value, CODE_FIELDS))

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

// [FE-635-T3] Группировка маршрутов пользователя по ISO alpha-2 стране.
// Переиспользует нормализацию descriptor.code (resolveCountryCode под капотом
// getTravelCountryDescriptors). Ключ — UPPERCASE ISO. Один travel может попасть
// в несколько стран (мультистрановой), дубль внутри страны исключается по id.
export const buildTravelsByCountryCode = (travels: Travel[]): Map<string, Travel[]> => {
  const byCode = new Map<string, Travel[]>()

  travels.forEach((travel) => {
    const codes = new Set<string>()
    getTravelCountryDescriptors(travel).forEach((descriptor) => {
      const code = typeof descriptor.code === 'string' ? descriptor.code.trim().toUpperCase() : ''
      if (/^[A-Z]{2}$/.test(code)) codes.add(code)
    })

    codes.forEach((code) => {
      const list = byCode.get(code) ?? []
      if (!list.some((existing) => existing.id === travel.id)) list.push(travel)
      byCode.set(code, list)
    })
  })

  return byCode
}

const descriptorKey = (descriptor: CountryDescriptor) =>
  descriptor.code
    ? `code:${descriptor.code}`
    : descriptor.name
      ? `name:${normalizeCountryName(descriptor.name)}`
      : descriptor.id
        ? `id:${descriptor.id}`
        : ''

const createCountryRowsComparator = () => {
  const collator = createCollator()
  return (a: ProfileCountryRow, b: ProfileCountryRow) => {
    if (a.visited !== b.visited) return a.visited ? -1 : 1
    return collator.compare(a.name, b.name)
  }
}

const readProgressCount = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null

const readNonNegativeInteger = (record: Record<string, unknown>, fields: readonly string[]) => {
  for (const field of fields) {
    const value = record[field]
    const numberValue =
      typeof value === 'number'
        ? value
        : typeof value === 'string' && value.trim()
          ? Number(value)
          : NaN
    if (Number.isInteger(numberValue) && numberValue >= 0) return numberValue
  }
  return undefined
}

const readCountryVisits = (record: Record<string, unknown>): VisitedCountryVisit[] => {
  const raw = record.visits
  if (!Array.isArray(raw)) return []

  const seen = new Set<string>()
  const visits: VisitedCountryVisit[] = []

  raw.forEach((item) => {
    if (!isRecord(item)) return
    const travelId = readString(item, ['travel_id', 'travelId', 'id'])
    const url = readString(item, ['travel_url', 'travelUrl', 'url'])
    if (!travelId || seen.has(travelId)) return

    const title = readString(item, ['travel_title', 'travelTitle', 'title', 'name']) || url || travelId
    const yearValue = item.year
    const year = typeof yearValue === 'number' && Number.isFinite(yearValue) ? yearValue : null

    seen.add(travelId)
    visits.push({ travelId, title, url, year })
  })

  return visits
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
      const groupRows = (groups.get(meta.key) ?? []).slice().sort(createCountryRowsComparator())
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

const getRegionMetaLabel = (key: ProfileCountryRegionKey, fallbackLabel: string) =>
  PROFILE_COUNTRY_REGION_META.find((meta) => meta.key === key)?.label || fallbackLabel || key

const buildProfileCountryRegionGroupsFromProgress = (
  rawGroups: unknown,
  rows: ProfileCountryRow[],
): ProfileCountryRegionGroup[] | null => {
  if (!Array.isArray(rawGroups)) return null

  const rowsByRegion = new Map<ProfileCountryRegionKey, ProfileCountryRow[]>()
  rows.forEach((row) => {
    const groupRows = rowsByRegion.get(row.region) ?? []
    groupRows.push(row)
    rowsByRegion.set(row.region, groupRows)
  })

  const seen = new Set<ProfileCountryRegionKey>()
  const groups = rawGroups
    .map((rawGroup): ProfileCountryRegionGroup | null => {
      if (!isRecord(rawGroup)) return null
      const key = normalizeRegion(readString(rawGroup, ['key', ...REGION_FIELDS]))
      if (!key || seen.has(key)) return null
      seen.add(key)

      const groupRows = (rowsByRegion.get(key) ?? []).slice().sort(createCountryRowsComparator())
      const derivedTotalCount = groupRows.length
      const derivedVisitedCount = groupRows.filter((row) => row.visited).length
      const totalCount = readNonNegativeInteger(rawGroup, REGION_GROUP_TOTAL_COUNT_FIELDS) ?? derivedTotalCount
      const visitedCount = readNonNegativeInteger(rawGroup, REGION_GROUP_VISITED_COUNT_FIELDS) ?? derivedVisitedCount
      const remainingCount =
        readNonNegativeInteger(rawGroup, REGION_GROUP_REMAINING_COUNT_FIELDS) ??
        Math.max(0, totalCount - visitedCount)

      return {
        key,
        label: getRegionMetaLabel(key, readString(rawGroup, ['label', 'name', 'title'])),
        totalCount,
        visitedCount,
        remainingCount,
        rows: groupRows,
      }
    })
    .filter((group): group is ProfileCountryRegionGroup => group !== null && group.totalCount > 0)

  return groups.length > 0 ? groups : null
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

  const sortedRows = rows.sort(createCountryRowsComparator())
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

export function buildProfileCountryStatsFromProgress(
  progress: ProfileCountryProgressPayload,
): ProfileCountryStats {
  const progressRecord: Record<string, unknown> = isRecord(progress) ? progress : {}
  const countries = Array.isArray(progressRecord.countries) ? progressRecord.countries : []

  const rows = countries
    .map((country, index): ProfileCountryRow | null => {
      if (!isRecord(country)) return null

      const name = readString(country, NAME_FIELDS)
      const code = resolveCountryCode(country, name)
      const rawId = readString(country, ID_FIELDS)
      const id = rawId || code || `country-progress-${index}`
      const fallbackName = code || id

      return {
        id,
        name: name || fallbackName,
        code: code || undefined,
        region: getCountryRegion(country, code || undefined),
        visited: country.visited === true,
        source: 'backend',
        visitedTravelsCount: readNonNegativeInteger(country, VISITED_TRAVELS_COUNT_FIELDS),
        firstVisitedDate: readString(country, FIRST_VISITED_DATE_FIELDS) || null,
        visits: readCountryVisits(country),
      }
    })
    .filter((row): row is ProfileCountryRow => Boolean(row))
    .sort(createCountryRowsComparator())

  const derivedTotalCount = rows.length
  const derivedVisitedCount = rows.filter((row) => row.visited).length
  const totalCount = readProgressCount(progressRecord.total_count) ?? derivedTotalCount
  const visitedCount = readProgressCount(progressRecord.visited_count) ?? derivedVisitedCount
  const remainingCount =
    readProgressCount(progressRecord.remaining_count) ??
    Math.max(0, totalCount - visitedCount)

  return {
    rows,
    regionGroups:
      buildProfileCountryRegionGroupsFromProgress(progressRecord.region_groups, rows) ??
      groupProfileCountriesByRegion(rows),
    visitedCount,
    remainingCount,
    totalCount,
  }
}

export {
  buildCountryApplicationRows,
  buildVisitedCountryIndex,
} from './profileCountryApplication'
export type {
  ProfileCountryApplicationRow,
  VisitedCountryIndex,
  VisitedCountryMeta,
} from './profileCountryApplication'
