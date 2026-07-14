import { act, renderHook, waitFor } from '@testing-library/react-native'
import { Platform } from 'react-native'

import { useMapCoordinates } from '@/hooks/map/useMapCoordinates'

jest.mock('@/hooks/map/expoLocationLoader', () => ({
  loadExpoLocation: jest.fn(),
}))

describe('useMapCoordinates live location updates', () => {
  const originalPlatform = Platform.OS
  const originalNavigator = global.navigator

  afterEach(() => {
    ;(Platform as any).OS = originalPlatform
    Object.defineProperty(global, 'navigator', {
      configurable: true,
      value: originalNavigator,
    })
    jest.restoreAllMocks()
  })

  it('starts a web watch after a trusted fix, applies live ticks, and cleans up', async () => {
    ;(Platform as any).OS = 'web'

    let watchSuccess: ((position: GeolocationPosition) => void) | null = null
    const getCurrentPosition = jest.fn((success: PositionCallback) => {
      success({
        coords: {
          latitude: 52.2,
          longitude: 20.98,
          accuracy: 9,
        },
        timestamp: 1000,
      } as GeolocationPosition)
    })
    const watchPosition = jest.fn((success: PositionCallback) => {
      watchSuccess = success
      return 77
    })
    const clearWatch = jest.fn()

    Object.defineProperty(global, 'navigator', {
      configurable: true,
      value: {
        geolocation: {
          getCurrentPosition,
          watchPosition,
          clearWatch,
        },
      },
    })
    const webGlobal = typeof window !== 'undefined' ? window : null
    if (webGlobal) {
      Object.defineProperty(webGlobal, 'localStorage', {
        configurable: true,
        value: {
          getItem: jest.fn(() => null),
          setItem: jest.fn(),
        },
      })
    }

    const { result, unmount } = renderHook(() => useMapCoordinates())

    await waitFor(() => {
      expect(result.current.coordinates).toEqual({ latitude: 52.2, longitude: 20.98 })
      expect(result.current.coordinatesAreFallback).toBe(false)
    })
    expect(watchPosition).toHaveBeenCalledTimes(1)

    act(() => {
      watchSuccess?.({
        coords: {
          latitude: 52.2004,
          longitude: 20.9804,
          accuracy: 7,
        },
        timestamp: 7000,
      } as GeolocationPosition)
    })

    expect(result.current.coordinates).toEqual({ latitude: 52.2004, longitude: 20.9804 })

    unmount()
    expect(clearWatch).toHaveBeenCalledWith(77)
  })
})
