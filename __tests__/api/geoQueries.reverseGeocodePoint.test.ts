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

/**
 * #1746 — модульный `queryClient` из `api/queryClient` никогда не монтируется,
 * значит не подписан на `onlineManager` и не возобновляет `paused`-запросы.
 * С наследуемым `networkMode: 'online'` вызов в момент `isOnline() === false`
 * висел бесконечно, и `addPointAtCoords` визарда не добавлял точку. Императивный
 * геокод обязан завершаться и офлайн — ответом сервиса или `null`.
 */
describe('reverseGeocodePoint while onlineManager reports offline (#1746)', () => {
  const { onlineManager } = require('@tanstack/react-query') as typeof import('@tanstack/react-query')

  beforeEach(() => {
    nominatimReverse.mockReset()
    bigDataCloudReverse.mockReset()
    onlineManager.setOnline(false)
  })

  afterEach(() => {
    onlineManager.setOnline(true)
  })

  it('does not pause the unmounted module client: resolves instead of hanging', async () => {
    nominatimReverse.mockResolvedValue(jsonResponse({ name: 'Zadział', address: { country: 'Polska' } }))

    const hang = new Promise<'hang'>((resolve) => setTimeout(() => resolve('hang'), 1000))
    const result = await Promise.race([reverseGeocodePoint(49.8, 19.5), hang])

    expect(result).not.toBe('hang')
    expect(result).toMatchObject({ name: 'Zadział' })
    expect(nominatimReverse).toHaveBeenCalledTimes(1)
  })
})
