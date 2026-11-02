/**
 * Точка маршрута у Bacówki na Maciejowej: Nominatim reverse отдаёт безымянную
 * скамейку, а `road` у неё — тропа, и точка называлась «Czerwony szlak Na
 * Turbacz». Имя объекта рядом берётся из Overpass.
 */
jest.mock('@/api/external/nominatim', () => ({
  nominatimReverse: jest.fn(),
  nominatimSearch: jest.fn(),
}))
jest.mock('@/api/external/bigdatacloud', () => ({
  bigDataCloudReverse: jest.fn(),
}))
jest.mock('@/api/external/overpass', () => ({
  overpassQuery: jest.fn(),
}))

const { nominatimReverse } = require('@/api/external/nominatim') as { nominatimReverse: jest.Mock }
const { bigDataCloudReverse } = require('@/api/external/bigdatacloud') as { bigDataCloudReverse: jest.Mock }
const { overpassQuery } = require('@/api/external/overpass') as { overpassQuery: jest.Mock }
const { reverseGeocodeRoutePoint } = require('@/api/geoQueries') as typeof import('@/api/geoQueries')
const { buildPointTitleFromGeocode } = require('@/utils/geocodeHelpers') as typeof import('@/utils/geocodeHelpers')

const jsonResponse = (body: unknown, ok = true) => ({ ok, json: async () => body })

const TRAIL_BENCH = {
  name: '',
  category: 'amenity',
  type: 'bench',
  display_name: 'Czerwony szlak Na Turbacz, Рабка-Здруй, gmina Rabka-Zdrój, Польша',
  address: { road: 'Czerwony szlak Na Turbacz', town: 'Рабка-Здруй', country: 'Польша', country_code: 'pl' },
}

const HUT = {
  type: 'way',
  center: { lat: 49.5827421, lon: 20.0081488 },
  tags: { name: 'Schronisko PTTK na Maciejowej', tourism: 'alpine_hut', ele: '852' },
}

describe('reverseGeocodeRoutePoint', () => {
  beforeEach(() => {
    nominatimReverse.mockReset()
    bigDataCloudReverse.mockReset()
    overpassQuery.mockReset()
  })

  it('names the point after the nearby hut instead of the trail', async () => {
    nominatimReverse.mockResolvedValue(jsonResponse(TRAIL_BENCH))
    overpassQuery.mockResolvedValue(jsonResponse({ elements: [HUT] }))

    // Свои координаты на каждый кейс: fetchReverseGeocode кэширует по ключу.
    const latlng = { lat: 49.58285, lng: 20.0079 }
    const data = await reverseGeocodeRoutePoint(latlng.lat, latlng.lng)

    expect(overpassQuery).toHaveBeenCalledTimes(1)
    expect(data).toMatchObject({ name: 'Schronisko PTTK na Maciejowej', address: { country_code: 'pl' } })
    expect(buildPointTitleFromGeocode(data, latlng)).toBe('Schronisko PTTK na Maciejowej')
  })

  it('picks the nearest named object and skips far area centres', async () => {
    nominatimReverse.mockResolvedValue(jsonResponse(TRAIL_BENCH))
    overpassQuery.mockResolvedValue(
      jsonResponse({
        elements: [
          { type: 'relation', center: { lat: 49.6, lon: 20.03 }, tags: { name: 'Gorczański Park', leisure: 'park' } },
          { type: 'node', lat: 49.5838, lon: 20.0079, tags: { name: 'Kapliczka', historic: 'wayside_shrine' } },
          HUT,
        ],
      }),
    )

    const data = await reverseGeocodeRoutePoint(49.5828, 20.0081)

    expect(data).toMatchObject({ name: 'Schronisko PTTK na Maciejowej' })
  })

  it('keeps an addressed house as is and does not ask Overpass', async () => {
    nominatimReverse.mockResolvedValue(
      jsonResponse({
        name: '',
        display_name: '12, Floriańska, Kraków, Polska',
        address: { road: 'Floriańska', house_number: '12', city: 'Kraków' },
      }),
    )

    const data = await reverseGeocodeRoutePoint(50.0631, 19.9395)

    expect(overpassQuery).not.toHaveBeenCalled()
    expect(buildPointTitleFromGeocode(data, { lat: 50.0631, lng: 19.9395 })).toBe('Floriańska 12')
  })

  it('does not ask Overpass when Nominatim already names the object', async () => {
    nominatimReverse.mockResolvedValue(jsonResponse({ name: 'Soblówka', address: { country: 'Polska' } }))

    await expect(reverseGeocodeRoutePoint(49.4882, 19.1235)).resolves.toMatchObject({ name: 'Soblówka' })
    expect(overpassQuery).not.toHaveBeenCalled()
  })

  it('asks the second Overpass server when the first one is at capacity', async () => {
    nominatimReverse.mockResolvedValue(jsonResponse(TRAIL_BENCH))
    overpassQuery
      .mockResolvedValueOnce(jsonResponse({}, false))
      .mockResolvedValueOnce(jsonResponse({ elements: [HUT] }))

    const data = await reverseGeocodeRoutePoint(49.58286, 20.00791)

    expect(overpassQuery).toHaveBeenCalledTimes(2)
    expect(overpassQuery.mock.calls[1][1]).toMatchObject({ endpoint: 'https://overpass.kumi.systems/api/interpreter' })
    expect(data).toMatchObject({ name: 'Schronisko PTTK na Maciejowej' })
  })

  it('falls back to the Nominatim answer when Overpass fails', async () => {
    nominatimReverse.mockResolvedValue(jsonResponse(TRAIL_BENCH))
    overpassQuery.mockRejectedValue(new Error('504'))

    const data = await reverseGeocodeRoutePoint(49.5829, 20.008)

    expect(data).toMatchObject({ address: { road: 'Czerwony szlak Na Turbacz' } })
    expect(data?.name).toBe('')
  })
})
