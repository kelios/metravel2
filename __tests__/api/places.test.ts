import { fetchPlacesCatalog, fetchPlacesCatalogCategoryGroups } from '@/api/places'
import { fetchWithTimeout } from '@/utils/fetchWithTimeout'
import { Platform } from 'react-native'

jest.mock('@/utils/fetchWithTimeout', () => ({
  fetchWithTimeout: jest.fn(),
}))

const mockedFetch = fetchWithTimeout as jest.MockedFunction<typeof fetchWithTimeout>

const catalogPayload = {
  results: [
    {
      id: 1039,
      title: 'Hrad Loket',
      address: 'Hrad Loket, Loket, Чехия',
      category: { id: 43, name: 'Замок' },
      country: { code: 'cz', name: 'Чехия' },
      coord: '50.1871828,12.7546903',
      lat: 50.1871828,
      lng: 12.7546903,
      search_text: 'hrad loket чехия замок',
      travel: { id: 158, slug: 's', url: '/travels/s', title: 'T' },
      image: { thumb_url: 'https://metravel.by/address-image/x.webp', landscape_url: null },
    },
  ],
  count: 220,
  facets: {
    categories: [{ id: 43, name: 'Замок', count: 72 }],
    countries: [{ code: 'cz', name: 'Чехия', count: 11 }],
  },
}

const okResponse = (json: unknown) =>
  ({ ok: true, status: 200, statusText: 'OK', text: async () => JSON.stringify(json) }) as unknown as Response

describe('fetchPlacesCatalog', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('hits the places catalog endpoint with paging + filters and maps the payload', async () => {
    mockedFetch.mockResolvedValueOnce(okResponse(catalogPayload))

    const page = await fetchPlacesCatalog({
      page: 2,
      perPage: 20,
      q: 'замок',
      categories: ['Замок'],
      country: 'cz',
    })

    expect(mockedFetch).toHaveBeenCalledTimes(1)
    const [url] = mockedFetch.mock.calls[0]
    expect(url).toContain('/places/catalog/?')
    expect(url).toContain('page=2')
    expect(url).toContain('perPage=20')
    expect(url).toContain('q=%D0%B7%D0%B0%D0%BC%D0%BE%D0%BA')
    expect(url).toContain('category=%D0%97%D0%B0%D0%BC%D0%BE%D0%BA')
    expect(url).toContain('country=cz')

    expect(page.count).toBe(220)
    expect(page.places[0].title).toBe('Hrad Loket')
    expect(page.categoryFacets[0]).toEqual({ id: 43, name: 'Замок', count: 72 })
    expect(page.countryFacets[0]).toEqual({ id: null, name: 'Чехия', count: 11 })
  })

  it('sends multiple categories as repeated category params (OR filter)', async () => {
    mockedFetch.mockResolvedValueOnce(okResponse(catalogPayload))

    await fetchPlacesCatalog({ page: 1, perPage: 20, categories: ['Замок', 'Озеро'] })

    const [url] = mockedFetch.mock.calls[0]
    const matches = String(url).match(/category=/g) ?? []
    expect(matches).toHaveLength(2)
    expect(url).toContain('category=%D0%97%D0%B0%D0%BC%D0%BE%D0%BA')
    expect(url).toContain('category=%D0%9E%D0%B7%D0%B5%D1%80%D0%BE')
  })

  it('omits empty filter params from the request', async () => {
    mockedFetch.mockResolvedValueOnce(okResponse(catalogPayload))

    await fetchPlacesCatalog({ page: 1, perPage: 20 })

    const [url] = mockedFetch.mock.calls[0]
    expect(url).not.toContain('q=')
    expect(url).not.toContain('category=')
    expect(url).not.toContain('country=')
    expect(url).not.toContain('sort=')
  })

  it('sends sort=rating and omits the default sort', async () => {
    mockedFetch.mockResolvedValueOnce(okResponse(catalogPayload))
    await fetchPlacesCatalog({ page: 1, perPage: 20, sort: 'rating' })
    expect(String(mockedFetch.mock.calls[0][0])).toContain('sort=rating')

    mockedFetch.mockResolvedValueOnce(okResponse(catalogPayload))
    await fetchPlacesCatalog({ page: 1, perPage: 20, sort: 'default' })
    expect(String(mockedFetch.mock.calls[1][0])).not.toContain('sort=')
  })

  it('throws on non-ok responses so React Query can surface the error state', async () => {
    mockedFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Server Error',
    } as unknown as Response)

    await expect(fetchPlacesCatalog({ page: 1, perPage: 20 })).rejects.toThrow('HTTP 500')
  })
})


describe('fetchPlacesCatalogCategoryGroups aggregate resource', () => {
  beforeEach(() => mockedFetch.mockReset())
  const groups = [{ id: 'nature', categories: ['Озеро', 'Лес'] }, { id: 'historic', categories: ['Замок'] }]
  it('sends one repeated group parameter per collection, with country, session credentials and the same timeout/signal', async () => {
    mockedFetch.mockResolvedValueOnce(okResponse({ groups: [{ id: 'nature', count: 41 }, { id: 'historic', count: 7 }] }))
    const signal = new AbortController().signal
    await expect(fetchPlacesCatalogCategoryGroups({ country: ' by ', groups }, signal)).resolves.toEqual({ nature: 41, historic: 7 })
    const [request, options, timeout] = mockedFetch.mock.calls[0]
    const url = new URL(String(request))
    expect(url.pathname).toBe('/api/places/catalog/category-groups/')
    expect(url.searchParams.getAll('group')).toEqual(['nature:Озеро,Лес', 'historic:Замок'])
    expect(url.searchParams.get('country')).toBe('by')
    expect(options?.signal).toBe(signal)
    expect(options?.credentials).toBe(Platform.OS === 'web' ? 'include' : 'omit')
    expect(timeout).toBe(15000)
    expect(mockedFetch).toHaveBeenCalledTimes(1)
  })
  it('accepts honest zero counts but omits invalid, absent and unsolicited rows', async () => {
    mockedFetch.mockResolvedValueOnce(okResponse({ groups: [
      { id: 'nature', count: 0 }, { id: 'historic', count: -1 }, { id: 'foreign', count: 9 },
      { id: 'historic', count: '12' }, null,
    ] }))
    await expect(fetchPlacesCatalogCategoryGroups({ groups })).resolves.toEqual({ nature: 0 })
  })
  it('preserves structured HTTP status so aggregate retry and quiet fallback remain meaningful', async () => {
    mockedFetch.mockResolvedValueOnce({ ...okResponse({}), ok: false, status: 504 })
    await expect(fetchPlacesCatalogCategoryGroups({ groups })).rejects.toMatchObject({ status: 504 })
    expect(mockedFetch).toHaveBeenCalledTimes(1)
  })
})
