// #3015: источники блока «Ещё по запросу» на /search.
const mockGet = jest.fn()
const mockFetchPlacesCatalog = jest.fn()

jest.mock('@/api/client', () => ({
  apiClient: { get: (...args: unknown[]) => mockGet(...args) },
}))

jest.mock('@/api/places', () => ({
  fetchPlacesCatalog: (...args: unknown[]) => mockFetchPlacesCatalog(...args),
}))

import {
  fetchSiteSearchQuestPreview,
  fetchSiteSearchPlaces,
} from '@/api/siteSearchExtras'
import { lookupMediaPlaceholder } from '@/utils/mediaPlaceholderIndex'

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

describe('siteSearchExtras (#3015)', () => {
  beforeEach(() => jest.clearAllMocks())

  it('fetches one localized preview and keeps its city, total and server order', async () => {
    const signal = new AbortController().signal
    const coverUrl = '/quest-cover/site-search-preview/braslav.webp'
    const coveredQuest = {
      ...questMeta(1, 'a', 9),
      cover_url: coverUrl,
      media: { cover: { src: coverUrl, dominant_color: '#334455' } },
    }
    mockGet.mockResolvedValue({
      city: { slug: 'braslav', name: 'Braslaw' },
      count: 11,
      results: [coveredQuest, questMeta(2, 'b', 4), questMeta(3, 'c', 1)],
    })

    const result = await fetchSiteSearchQuestPreview('браслав озера', 'en', signal)

    expect(mockGet).toHaveBeenCalledTimes(1)
    const [requestPath, timeout, requestOptions] = mockGet.mock.calls[0]
    const url = new URL(requestPath, 'https://metravel.by')
    expect(url.pathname).toBe('/quests/search-city-preview/')
    expect(Object.fromEntries(url.searchParams)).toEqual({ q: 'браслав озера', locale: 'en' })
    expect(timeout).toBeUndefined()
    expect(requestOptions).toEqual({ signal })
    expect(result.total).toBe(11)
    expect(result.quests.map((quest) => quest.id)).toEqual(['a', 'b', 'c'])
    expect(result.citySegment).toBe('braslav')
    expect(result.cityName).toBe('Braslaw')
    expect(lookupMediaPlaceholder(coverUrl)?.dominantColor).toBe('#334455')
  })

  it('maps an unknown city to empty quests with no city landing segment', async () => {
    mockGet.mockResolvedValue({ city: null, count: 0, results: [] })

    await expect(fetchSiteSearchQuestPreview('зюзюкино', 'ru', new AbortController().signal)).resolves.toEqual({
      quests: [],
      total: 0,
      citySegment: null,
      cityName: '',
    })
    expect(mockGet).toHaveBeenCalledTimes(1)
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
