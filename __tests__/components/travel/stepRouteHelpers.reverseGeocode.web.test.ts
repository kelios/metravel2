/**
 * #1738 — ручной ввод координат на web. Раньше `reverseGeocode` визарда держала
 * `if (Platform.OS === 'web') return null`, поэтому `addPointAtCoords` на сайте
 * получала пустоту и называла точку самими координатами. Под jest-expo
 * Platform.OS = ios, так что web-ветку надо гонять явно.
 */
const COORDS = { lat: 49.4881, lng: 19.1234 }
const GEOCODE = {
  name: 'Soblówka',
  display_name: 'Soblówka, powiat żywiecki, województwo śląskie, Polska',
  address: { village: 'Soblówka', country: 'Polska', country_code: 'pl' },
}

const loadUnder = (os: 'web' | 'ios') => {
  jest.resetModules()
  jest.doMock('react-native', () => {
    const actual = jest.requireActual('react-native')
    const platform = { OS: os, select: (s: Record<string, unknown>) => (os in s ? s[os] : s.default) }
    // Proxy, а не спред: спред react-native дёргает все ленивые геттеры модуля.
    return new Proxy(actual, {
      get: (target, prop) => (prop === 'Platform' ? platform : Reflect.get(target, prop)),
    })
  })
  jest.doMock('@/api/geoQueries', () => ({
    reverseGeocodePoint: jest.fn(async () => GEOCODE),
  }))
  const helpers = require('@/components/travel/stepRoute/helpers') as typeof import('@/components/travel/stepRoute/helpers')
  const { buildPointTitleFromGeocode } = require('@/utils/geocodeHelpers') as typeof import('@/utils/geocodeHelpers')
  const { reverseGeocodePoint } = require('@/api/geoQueries') as { reverseGeocodePoint: jest.Mock }
  return { helpers, buildPointTitleFromGeocode, reverseGeocodePoint }
}

describe('stepRoute reverseGeocode per platform (#1738)', () => {
  afterEach(() => {
    jest.dontMock('react-native')
    jest.dontMock('@/api/geoQueries')
    jest.resetModules()
  })

  it.each(['web', 'ios'] as const)('on %s asks the shared geocoder and names the point after the place', async (os) => {
    const { helpers, buildPointTitleFromGeocode, reverseGeocodePoint } = loadUnder(os)

    const data = await helpers.reverseGeocode(COORDS.lat, COORDS.lng)
    const { name: countryName } = helpers.getReverseGeocodeCountry(data)
    const title = buildPointTitleFromGeocode(data, COORDS, undefined)

    expect(reverseGeocodePoint).toHaveBeenCalledWith(COORDS.lat, COORDS.lng)
    expect(data).toMatchObject({ name: 'Soblówka' })
    expect(countryName).toBe('Polska')
    expect(title).toBe('Soblówka')
    expect(title).not.toBe(`${COORDS.lat}, ${COORDS.lng}`)
  })
})
