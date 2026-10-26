import {
  findQuestCityForQuery,
  isSiteSearchQueryLongEnough,
  normalizeSiteSearchText,
} from '@/utils/siteSearchQuestCity'

const cities = [
  { id: 65, name: 'Браслав', name_canonical: 'Браслав' },
  { id: 3, name: 'Брест', name_canonical: 'Брест' },
  { id: 7, name: 'Kraków', name_canonical: 'Краков' },
  { id: 9, name: 'Минск', name_canonical: 'Минск' },
  { id: 12, name: 'Каменец-Подольский', name_canonical: 'Каменец-Подольский' },
  { id: 14, name: 'Лида', name_canonical: 'Лида' },
]

describe('siteSearchQuestCity (#2775)', () => {
  it('normalizes case, ё/е, diacritics, hyphens and spaces', () => {
    expect(normalizeSiteSearchText('  Ёлки-Палки  ')).toBe('елки палки')
    expect(normalizeSiteSearchText('Kraków')).toBe('krakow')
  })

  it('finds a city by exact name regardless of case', () => {
    expect(findQuestCityForQuery(cities, 'браслав')?.id).toBe(65)
    expect(findQuestCityForQuery(cities, 'БРАСЛАВ')?.id).toBe(65)
  })

  it('finds a city by a prefix of at least three characters', () => {
    expect(findQuestCityForQuery(cities, 'Брас')?.id).toBe(65)
    expect(findQuestCityForQuery(cities, 'Бр')).toBeNull()
  })

  it('accepts an inflected tail after the city name', () => {
    expect(findQuestCityForQuery(cities, 'Браславские озёра')?.id).toBe(65)
    expect(findQuestCityForQuery(cities, 'Минская область')?.id).toBe(9)
  })

  it('matches localized and canonical names alike', () => {
    expect(findQuestCityForQuery(cities, 'krakow')?.id).toBe(7)
    expect(findQuestCityForQuery(cities, 'Краков')?.id).toBe(7)
    expect(findQuestCityForQuery(cities, 'каменец подольский')?.id).toBe(12)
  })

  it('prefers the closest name among prefix matches', () => {
    expect(findQuestCityForQuery(cities, 'Бре')?.id).toBe(3)
  })

  it('returns null without a match', () => {
    expect(findQuestCityForQuery(cities, 'Лидер')).toBeNull()
    expect(findQuestCityForQuery(cities, 'Нарочь')).toBeNull()
    expect(findQuestCityForQuery(cities, '')).toBeNull()
  })

  it('requires three characters before searching', () => {
    expect(isSiteSearchQueryLongEnough('  Бр ')).toBe(false)
    expect(isSiteSearchQueryLongEnough('Бра')).toBe(true)
  })
})
