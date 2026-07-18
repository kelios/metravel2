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

  describe('rating enrichment', () => {
    it('leaves rating null when the payload has no rating field', () => {
      const page = mapPlacesCatalogResponse(rawResponse())
      expect(page.places[0].rating).toBeNull()
    })

    it('maps the structured rating object with per-source attribution', () => {
      const page = mapPlacesCatalogResponse(
        rawResponse({
          results: [
            rawItem({
              rating: {
                value: 4.6,
                count: 128,
                sources: [
                  { provider: '2gis', value: 4.7, count: 90, url: 'https://2gis.by/x' },
                  { provider: 'tripadvisor', value: 4.5, count: 38, url: 'https://tripadvisor.com/x' },
                ],
              },
            }),
          ],
        }),
      )
      const { rating } = page.places[0]
      expect(rating).not.toBeNull()
      expect(rating?.value).toBeCloseTo(4.6)
      expect(rating?.count).toBe(128)
      expect(rating?.sources).toHaveLength(2)
      expect(rating?.sources[0]).toEqual({
        provider: '2gis',
        value: 4.7,
        count: 90,
        url: 'https://2gis.by/x',
      })
    })

    it('derives the aggregate value from sources when top-level value is absent', () => {
      const page = mapPlacesCatalogResponse(
        rawResponse({
          results: [
            rawItem({
              rating: {
                sources: [
                  { provider: '2gis', value: 5, count: 100 },
                  { provider: 'tripadvisor', value: 4, count: 100 },
                ],
              },
            }),
          ],
        }),
      )
      const { rating } = page.places[0]
      // Equal weights => simple average of 5 and 4.
      expect(rating?.value).toBeCloseTo(4.5)
      // Count falls back to the sum of source review counts.
      expect(rating?.count).toBe(200)
    })

    it('accepts flat rating aliases (rating + rating_count + rating_source)', () => {
      const page = mapPlacesCatalogResponse(
        rawResponse({
          results: [rawItem({ rating: 4.2, rating_count: 57, rating_source: 'google' })],
        }),
      )
      const { rating } = page.places[0]
      expect(rating?.value).toBeCloseTo(4.2)
      expect(rating?.count).toBe(57)
      expect(rating?.sources).toEqual([
        { provider: 'google', value: 4.2, count: 57, url: null },
      ])
    })

    it('clamps out-of-range scores and drops non-positive ratings', () => {
      const page = mapPlacesCatalogResponse(
        rawResponse({
          results: [
            rawItem({ id: 1, rating: { value: 9, count: 3, sources: [] } }),
            rawItem({ id: 2, coord: '50.1,12.7', rating: { value: 0, count: 0, sources: [] } }),
          ],
        }),
      )
      expect(page.places[0].rating?.value).toBe(5)
      expect(page.places[1].rating).toBeNull()
    })
  })
})
