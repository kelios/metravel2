// #2775: источники блока «Ещё по запросу» на /search.
const mockGet = jest.fn()
const mockFetchQuestsByCity = jest.fn()
const mockFetchPlacesCatalog = jest.fn()

jest.mock('@/api/client', () => ({
  apiClient: { get: (...args: unknown[]) => mockGet(...args) },
}))

jest.mock('@/api/quests', () => ({
  fetchQuestsByCity: (...args: unknown[]) => mockFetchQuestsByCity(...args),
}))

jest.mock('@/api/places', () => ({
  fetchPlacesCatalog: (...args: unknown[]) => mockFetchPlacesCatalog(...args),
}))

import {
  fetchQuestCitiesDirectory,
  fetchSiteSearchCityQuests,
  fetchSiteSearchPlaces,
} from '@/api/siteSearchExtras'

const city = (id: number, name: string) => ({ id, name, name_canonical: name, lat: 0, lng: 0, legacy_ids: [] })

const questMeta = (id: number, questId: string, completions: number) => ({
  id,
  quest_id: questId,
  title: `Квест ${questId}`,
  points: 5,
  city_id: '65',
  city_name: 'Браслав',
  city_name_localized: 'Braslaw',
  city_alias: 'braslav',
  lat: 55.6,
  lng: 27,
  duration_min: 90,
  difficulty: 'easy',
  tags: null,
  pet_friendly: false,
  cover_url: null,
  completions_count: completions,
})

describe('siteSearchExtras (#2775)', () => {
  beforeEach(() => jest.clearAllMocks())

  it('reads the whole quest city directory in pages of 100 with the content locale', async () => {
    mockGet.mockImplementation(async (url: string) =>
      url.includes('page=2')
        ? { count: 101, results: [city(200, 'Ялта')] }
        : { count: 101, results: Array.from({ length: 100 }, (_, i) => city(i + 1, `Город ${i}`)) },
    )

    const list = await fetchQuestCitiesDirectory('pl')

    expect(list).toHaveLength(101)
    expect(mockGet).toHaveBeenCalledTimes(2)
    expect(mockGet.mock.calls[0][0]).toBe('/quest-cities/?page_size=100&lang=pl')
    expect(mockGet.mock.calls[1][0]).toBe('/quest-cities/?page_size=100&page=2&lang=pl')
  })

  it('returns up to three popular city quests, the total and the city landing segment', async () => {
    mockFetchQuestsByCity.mockResolvedValue([
      questMeta(1, 'a', 0),
      questMeta(2, 'b', 9),
      questMeta(3, 'c', 4),
      questMeta(4, 'd', 1),
    ])

    const result = await fetchSiteSearchCityQuests(65, 'en')

    expect(mockFetchQuestsByCity).toHaveBeenCalledWith(65, 'en')
    expect(result.total).toBe(4)
    expect(result.quests.map((quest) => quest.id)).toEqual(['b', 'c', 'd'])
    expect(result.citySegment).toBe('braslav')
    expect(result.cityName).toBe('Braslaw')
  })

  it('asks the places catalog for the first three places by query', async () => {
    mockFetchPlacesCatalog.mockResolvedValue({
      places: [{ id: '1' }, { id: '2' }, { id: '3' }],
      count: 12,
      categoryFacets: [],
      countryFacets: [],
    })

    const result = await fetchSiteSearchPlaces('Браслав')

    expect(mockFetchPlacesCatalog).toHaveBeenCalledWith({ page: 1, perPage: 3, q: 'Браслав' }, undefined)
    expect(result.total).toBe(12)
    expect(result.places).toHaveLength(3)
  })
})
