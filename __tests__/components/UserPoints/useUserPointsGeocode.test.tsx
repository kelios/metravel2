import { act, renderHook } from '@testing-library/react-native'

jest.mock('@/api/external/nominatim', () => ({ nominatimSearch: jest.fn() }))
jest.mock('@/utils/mapLocale', () => ({ getMapGeocoderLanguage: () => 'ru' }))

const { nominatimSearch } = require('@/api/external/nominatim')
const mockNominatim = nominatimSearch as jest.Mock

import { useUserPointsGeocode } from '@/components/UserPoints/useUserPointsGeocode'

const NO_POINTS: unknown[] = []
const ONE_POINT: unknown[] = [{ id: 1 }]

const flush = async (ms: number) => {
  await act(async () => {
    jest.advanceTimersByTime(ms)
    await Promise.resolve()
    await Promise.resolve()
  })
}

describe('useUserPointsGeocode (#3135)', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.clearAllMocks()
  })
  afterEach(() => {
    jest.useRealTimers()
  })

  it('пустой результат поиска → геокод и маркер «найдено»', async () => {
    mockNominatim.mockResolvedValue({ ok: true, json: async () => [{ lat: '52.1', lon: '21.0', display_name: 'Warszawa' }] })
    const focusOnCoord = jest.fn()
    const { result } = await renderHook(() =>
      useUserPointsGeocode({
        appliedSearchQuery: 'варшава',
        filteredPoints: NO_POINTS,
        isSearching: false,
        mapUiApi: { focusOnCoord } as any,
        fallbackCenter: { lat: 53.9, lng: 27.5 },
      }),
    )
    await flush(500)
    expect(mockNominatim).toHaveBeenCalledTimes(1)
    expect(result.current).toEqual({ lat: 52.1, lng: 21, label: 'Warszawa' })
    expect(focusOnCoord).toHaveBeenCalledWith('52.1,21', { zoom: 13 })
  })

  it('геокодер не нашёл → карта к фоллбэку без маркера; без фоллбэка — карта стоит', async () => {
    mockNominatim.mockResolvedValue({ ok: true, json: async () => [] })
    const focusOnCoord = jest.fn()
    const withFallback = await renderHook(() =>
      useUserPointsGeocode({
        appliedSearchQuery: 'абракадабра',
        filteredPoints: NO_POINTS,
        isSearching: false,
        mapUiApi: { focusOnCoord } as any,
        fallbackCenter: { lat: 53.9, lng: 27.5 },
      }),
    )
    await flush(500)
    expect(focusOnCoord).toHaveBeenCalledWith('53.9,27.5', { zoom: 10 })
    expect(withFallback.result.current).toBeNull()

    focusOnCoord.mockClear()
    const noFallback = await renderHook(() =>
      useUserPointsGeocode({
        appliedSearchQuery: 'абракадабра2',
        filteredPoints: NO_POINTS,
        isSearching: false,
        mapUiApi: { focusOnCoord } as any,
        fallbackCenter: null,
      }),
    )
    await flush(500)
    expect(focusOnCoord).not.toHaveBeenCalled()
    expect(noFallback.result.current).toBeNull()
  })

  it('пока сервер ищет или точки нашлись — геокодер не дёргается', async () => {
    const focusOnCoord = jest.fn()
    await renderHook(() =>
      useUserPointsGeocode({ appliedSearchQuery: 'озеро', filteredPoints: NO_POINTS, isSearching: true, mapUiApi: { focusOnCoord } as any, fallbackCenter: null }),
    )
    await renderHook(() =>
      useUserPointsGeocode({ appliedSearchQuery: 'озеро', filteredPoints: ONE_POINT, isSearching: false, mapUiApi: { focusOnCoord } as any, fallbackCenter: null }),
    )
    await flush(600)
    expect(mockNominatim).not.toHaveBeenCalled()
  })
})
