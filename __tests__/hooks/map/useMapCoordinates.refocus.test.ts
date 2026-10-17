import { act, renderHook, waitFor } from '@testing-library/react-native'
import { Platform } from 'react-native'

import { useMapCoordinates } from '@/hooks/map/useMapCoordinates'
import { publishLiveUserPosition } from '@/hooks/map/liveUserPosition'

jest.mock('@/utils/logger', () => ({ logError: jest.fn(), logMessage: jest.fn() }))
jest.mock('@/hooks/map/expoLocationLoader', () => ({ loadExpoLocation: jest.fn() }))

// #2450 — coming back to the map with a fresh trusted fix must not request a new
// one (loading state, forced anchor, data refetch): it only resumes the watch.
describe('useMapCoordinates re-focus with a fresh trusted fix', () => {
  const originalPlatform = Platform.OS
  const originalNavigator = global.navigator

  afterEach(() => {
    publishLiveUserPosition(null)
    ;(Platform as any).OS = originalPlatform
    Object.defineProperty(global, 'navigator', { configurable: true, value: originalNavigator })
    jest.restoreAllMocks()
  })

  it('does not call getCurrentPosition again and keeps the coordinates object identity', async () => {
    ;(Platform as any).OS = 'web'
    const getCurrentPosition = jest.fn((success: PositionCallback) => {
      success({
        coords: { latitude: 52.2, longitude: 20.98, accuracy: 9 },
        timestamp: Date.now(),
      } as GeolocationPosition)
    })
    const watchPosition = jest.fn(() => 77)
    const clearWatch = jest.fn()
    Object.defineProperty(global, 'navigator', {
      configurable: true,
      value: { geolocation: { getCurrentPosition, watchPosition, clearWatch } },
    })
    if (typeof window !== 'undefined') {
      Object.defineProperty(window, 'localStorage', {
        configurable: true,
        value: { getItem: jest.fn(() => null), setItem: jest.fn() },
      })
    }

    const { result, rerender } = renderHook(
      ({ isFocused }) => useMapCoordinates({ isFocused }),
      { initialProps: { isFocused: true } },
    )

    await waitFor(() => {
      expect(result.current.coordinates).toEqual({ latitude: 52.2, longitude: 20.98 })
    })
    expect(getCurrentPosition).toHaveBeenCalledTimes(1)
    const coordinatesBefore = result.current.coordinates

    await act(async () => {
      rerender({ isFocused: false })
    })
    await act(async () => {
      rerender({ isFocused: true })
    })

    expect(getCurrentPosition).toHaveBeenCalledTimes(1)
    expect(result.current.coordinates).toBe(coordinatesBefore)
    // The foreground watch is resumed for the marker.
    expect(watchPosition.mock.calls.length).toBeGreaterThanOrEqual(2)
  })
})
