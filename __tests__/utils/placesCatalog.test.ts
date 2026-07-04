import { mapPlacesCatalogResponse, type RawPlacesCatalogResponse } from '@/utils/placesCatalog'

const rawItem = (overrides: Record<string, unknown> = {}) => ({
  id: 1039,
  title: 'Hrad Loket',
  address: 'Hrad Loket, Loket, Чехия',
  category: { id: 43, name: 'Замок' },
  country: { code: 'cz', name: 'Чехия' },
  coord: '50.1871828,12.7546903',
  lat: 50.1871828,
  lng: 12.7546903,
  search_text: 'Hrad Loket Чехия Замок',
  travel: { id: 158, slug: 'karlovy-vary', url: '/travels/karlovy-vary', title: 'Карловы Вары' },
  image: {
    thumb_url: 'https://metravel.by/address-image/1039/conversions/x-thumb_400_wp.webp',
    landscape_url: null,
  },
  ...overrides,
})

const rawResponse = (overrides: Partial<RawPlacesCatalogResponse> = {}): RawPlacesCatalogResponse => ({
  results: [rawItem()],
  count: 220,
  facets: {
    categories: [{ id: 43, name: 'Замок', count: 72 }],
    countries: [{ code: 'cz', name: 'Чехия', count: 11 }],
  },
  ...overrides,
})

describe('mapPlacesCatalogResponse', () => {
  it('maps the server catalog payload to CatalogPlace shape', () => {
    const page = mapPlacesCatalogResponse(rawResponse())

    expect(page.count).toBe(220)
    expect(page.places).toHaveLength(1)

    const [place] = page.places
    expect(place.id).toBe('1039')
    expect(place.title).toBe('Hrad Loket')
    expect(place.category).toBe('Замок')
    expect(place.categoryId).toBe(43)
    expect(place.country).toBe('Чехия')
    expect(place.countryCode).toBe('cz')
    expect(place.latNumber).toBeCloseTo(50.1871828)
    expect(place.lngNumber).toBeCloseTo(12.7546903)
    expect(place.coord).toBe('50.1871828,12.7546903')
    expect(place.urlTravel).toBe('/travels/karlovy-vary')
    expect(place.travelImageThumbUrl).toContain('thumb_400_wp.webp')
    expect(place.searchText).toBe('hrad loket чехия замок')
  })

  it('reads facets from the response', () => {
    const page = mapPlacesCatalogResponse(rawResponse())

    expect(page.categoryFacets).toEqual([{ id: 43, name: 'Замок', count: 72 }])
    expect(page.countryFacets).toEqual([{ id: null, name: 'Чехия', count: 11 }])
  })

  it('skips items without resolvable coordinates', () => {
    const page = mapPlacesCatalogResponse(
      rawResponse({ results: [rawItem({ coord: null, lat: null, lng: null })] }),
    )
    expect(page.places).toHaveLength(0)
  })

  it('falls back to results length when count is missing', () => {
    const page = mapPlacesCatalogResponse(rawResponse({ count: undefined }))
    expect(page.count).toBe(1)
  })

  it('upgrades http image urls to https for remote hosts', () => {
    const page = mapPlacesCatalogResponse(
      rawResponse({
        results: [
          rawItem({
            image: { thumb_url: 'http://metravel.by/address-image/x.webp', landscape_url: null },
          }),
        ],
      }),
    )
    expect(page.places[0].travelImageThumbUrl).toBe('https://metravel.by/address-image/x.webp')
  })
})
