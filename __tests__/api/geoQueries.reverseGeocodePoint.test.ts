/**
 * #1738 — один обратный геокод на все поверхности: Nominatim первым (он знает
 * имя объекта), BigDataCloud фолбэком. Раньше копий было две, и та, что шла из
 * визарда, на web возвращала `null` до любого запроса.
 */
jest.mock('@/api/external/nominatim', () => ({
  nominatimReverse: jest.fn(),
  nominatimSearch: jest.fn(),
}))
jest.mock('@/api/external/bigdatacloud', () => ({
  bigDataCloudReverse: jest.fn(),
}))

const { nominatimReverse } = require('@/api/external/nominatim') as { nominatimReverse: jest.Mock }
const { bigDataCloudReverse } = require('@/api/external/bigdatacloud') as { bigDataCloudReverse: jest.Mock }
const { reverseGeocodePoint } = require('@/api/geoQueries') as typeof import('@/api/geoQueries')

const jsonResponse = (body: unknown, ok = true) => ({ ok, json: async () => body })

describe('reverseGeocodePoint (#1738)', () => {
  beforeEach(() => {
    nominatimReverse.mockReset()
    bigDataCloudReverse.mockReset()
  })

  it('returns the Nominatim object and does not touch the fallback', async () => {
    nominatimReverse.mockResolvedValue(jsonResponse({ name: 'Soblówka', address: { country: 'Polska' } }))

    // Свои координаты на каждый кейс: fetchReverseGeocode кэширует по ключу.
    const data = await reverseGeocodePoint(49.4881, 19.1234)

    expect(data).toMatchObject({ name: 'Soblówka' })
    expect(bigDataCloudReverse).not.toHaveBeenCalled()
  })

  it('falls back to BigDataCloud when Nominatim has nothing to say', async () => {
    nominatimReverse.mockResolvedValue(jsonResponse({}, false))
    bigDataCloudReverse.mockResolvedValue(jsonResponse({ countryName: 'Poland', locality: 'Soblówka' }))

    const data = await reverseGeocodePoint(49.5, 19.2)

    expect(data).toMatchObject({ countryName: 'Poland' })
    expect(bigDataCloudReverse).toHaveBeenCalledTimes(1)
  })

  it('survives a throwing Nominatim and still tries the fallback', async () => {
    nominatimReverse.mockRejectedValue(new Error('network'))
    bigDataCloudReverse.mockResolvedValue(jsonResponse({ countryName: 'Poland' }))

    await expect(reverseGeocodePoint(49.6, 19.3)).resolves.toMatchObject({ countryName: 'Poland' })
  })

  it('returns null when both services fail — the caller falls back to coordinates', async () => {
    nominatimReverse.mockRejectedValue(new Error('network'))
    bigDataCloudReverse.mockRejectedValue(new Error('blocked by CSP'))

    await expect(reverseGeocodePoint(49.7, 19.4)).resolves.toBeNull()
  })
})
