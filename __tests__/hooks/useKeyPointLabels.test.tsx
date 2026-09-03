/**
 * #1742 — подписи ключевых точек маршрута берут ОБЩИЙ обратный геокод
 * (`reverseGeocodePoint`, язык из локали), а не свою копию с жёсткой `'ru'`
 * и web-guard. Под jest-expo Platform.OS = ios, web выставляется явно.
 */
import { renderHook, waitFor } from '@testing-library/react-native'
import { Platform } from 'react-native'

jest.mock('@/api/geoQueries', () => ({ reverseGeocodePoint: jest.fn() }))
jest.mock('@/api/external/nominatim', () => ({ nominatimReverse: jest.fn(), nominatimSearch: jest.fn() }))
jest.mock('@/api/external/bigdatacloud', () => ({ bigDataCloudReverse: jest.fn() }))
jest.mock('@/api/external/overpass', () => ({ overpassQuery: jest.fn(async () => ({ ok: false })) }))

const { reverseGeocodePoint } = require('@/api/geoQueries') as { reverseGeocodePoint: jest.Mock }
const { nominatimReverse } = require('@/api/external/nominatim') as { nominatimReverse: jest.Mock }
const { bigDataCloudReverse } = require('@/api/external/bigdatacloud') as { bigDataCloudReverse: jest.Mock }
const { useKeyPointLabels } = require('@/hooks/useKeyPointLabels') as typeof import('@/hooks/useKeyPointLabels')

const ROUTE = {
  linePoints: [
    { coord: '49.4881,19.1234', elevation: 700 },
    { coord: '49.5000,19.2000', elevation: 1200 },
    { coord: '49.5200,19.2500', elevation: 650 },
  ],
} as any

const SHORT_ROUTE = { linePoints: [{ coord: '1,2' }] } as any

const NOMINATIM_VILLAGE = { name: 'Schronisko', address: { village: 'Soblówka', country: 'Polska' } }
const BDC_TOWN = { countryName: 'Poland', locality: 'Żywiec', localityInfo: { administrative: [] } }

describe('useKeyPointLabels (#1742)', () => {
  const prevOS = Platform.OS

  beforeEach(() => {
    reverseGeocodePoint.mockReset()
    nominatimReverse.mockReset()
    bigDataCloudReverse.mockReset()
  })

  afterEach(() => {
    ;(Platform.OS as any) = prevOS
  })

  it.each(['web', 'ios'] as const)(
    'on %s asks the shared geocoder for start/peak/finish and names them after the locality',
    async (os) => {
      ;(Platform.OS as any) = os
      reverseGeocodePoint.mockImplementation(async (lat: number) => (lat === 49.5 ? BDC_TOWN : NOMINATIM_VILLAGE))

      const { result } = renderHook(() => useKeyPointLabels(ROUTE))

      await waitFor(() => expect(result.current.keyPointLabels.finishName).toBe('Soblówka'))
      expect(result.current.keyPointLabels).toEqual({ startName: 'Soblówka', peakName: 'Żywiec', finishName: 'Soblówka' })
      // Три точки — три обращения к общему слою и ни одного прямого вызова клиентов.
      expect(reverseGeocodePoint).toHaveBeenCalledTimes(3)
      expect(nominatimReverse).not.toHaveBeenCalled()
      expect(bigDataCloudReverse).not.toHaveBeenCalled()
    },
  )

  it('prefers the locality over the object name (label is a place, not a POI)', async () => {
    reverseGeocodePoint.mockResolvedValue({ name: 'Muzeum', address: { town: 'Żywiec' } })

    const { result } = renderHook(() => useKeyPointLabels(ROUTE))

    await waitFor(() => expect(result.current.keyPointLabels.startName).toBe('Żywiec'))
  })

  it('never names a point after a bare house number from display_name (#1717)', async () => {
    reverseGeocodePoint.mockResolvedValue({
      display_name: '332, Soblówka, Żywiec County, Polska',
      address: { house_number: '332', county: 'Żywiec County' },
    })

    const { result } = renderHook(() => useKeyPointLabels(ROUTE))

    await waitFor(() => expect(result.current.keyPointLabels.startName).toBe('Soblówka'))
  })

  it('leaves labels null (never coordinates) when the shared geocoder has nothing', async () => {
    reverseGeocodePoint.mockResolvedValue(null)

    const { result } = renderHook(() => useKeyPointLabels(ROUTE))

    await waitFor(() =>
      expect(result.current.keyPointLabels).toEqual({ startName: null, peakName: null, finishName: null }),
    )
  })

  it('clears labels when the route has fewer than two points', () => {
    const { result } = renderHook(() => useKeyPointLabels(SHORT_ROUTE))
    expect(result.current.keyPointLabels).toEqual({})
    expect(reverseGeocodePoint).not.toHaveBeenCalled()
  })

  it('does not re-render forever when a short preview is a fresh object each render', () => {
    let renders = 0
    const { result } = renderHook(() => {
      renders += 1
      return useKeyPointLabels({ linePoints: [{ coord: '1,2' }] } as any)
    })
    expect(result.current.keyPointLabels).toEqual({})
    expect(renders).toBeLessThan(5)
  })
})
