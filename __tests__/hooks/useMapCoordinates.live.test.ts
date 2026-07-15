import { act, renderHook, waitFor } from '@testing-library/react-native'
import { AppState, Linking, Platform } from 'react-native'

import { useMapCoordinates } from '@/hooks/map/useMapCoordinates'
import { loadExpoLocation } from '@/hooks/map/expoLocationLoader'

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
    ;(loadExpoLocation as jest.Mock).mockReset()
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

  it('ignores stationary web watch jitter instead of refreshing coordinates on interval ticks', async () => {
    ;(Platform as any).OS = 'web'

    let watchSuccess: ((position: GeolocationPosition) => void) | null = null
    const getCurrentPosition = jest.fn((success: PositionCallback) => {
      success({
        coords: {
          latitude: 50.0614,
          longitude: 19.9366,
          accuracy: 14,
        },
        timestamp: 1000,
      } as GeolocationPosition)
    })
    const watchPosition = jest.fn((success: PositionCallback) => {
      watchSuccess = success
      return 78
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
      expect(result.current.coordinates).toEqual({ latitude: 50.0614, longitude: 19.9366 })
      expect(result.current.coordinatesAreFallback).toBe(false)
    })

    act(() => {
      watchSuccess?.({
        coords: {
          latitude: 50.061405,
          longitude: 19.936605,
          accuracy: 13,
        },
        timestamp: 7000,
      } as GeolocationPosition)
    })

    expect(result.current.coordinates).toEqual({ latitude: 50.0614, longitude: 19.9366 })

    unmount()
    expect(clearWatch).toHaveBeenCalledWith(78)
  })

  it('keeps cached web coordinates as a viewport-only anchor after permission denial', async () => {
    ;(Platform as any).OS = 'web'

    const getCurrentPosition = jest.fn((_success: PositionCallback, error: PositionErrorCallback) => {
      error({
        code: 1,
        message: 'denied',
        PERMISSION_DENIED: 1,
        POSITION_UNAVAILABLE: 2,
        TIMEOUT: 3,
      } as GeolocationPositionError)
    })
    Object.defineProperty(global, 'navigator', {
      configurable: true,
      value: {
        geolocation: {
          getCurrentPosition,
          watchPosition: jest.fn(),
          clearWatch: jest.fn(),
        },
      },
    })
    const webGlobal = typeof window !== 'undefined' ? window : null
    if (webGlobal) {
      Object.defineProperty(webGlobal, 'localStorage', {
        configurable: true,
        value: {
          getItem: jest.fn(() => JSON.stringify({
            latitude: 52.2,
            longitude: 20.98,
            accuracy: 15,
            timestamp: 900,
          })),
          setItem: jest.fn(),
        },
      })
    }

    const { result } = renderHook(() => useMapCoordinates())

    await waitFor(() => {
      expect(result.current.locationState).toEqual(expect.objectContaining({
        status: 'denied',
        canAskAgain: true,
      }))
    })
    expect(result.current.coordinates).toEqual({ latitude: 52.2, longitude: 20.98 })
    expect(result.current.coordinatesSource).toBe('cache')
    expect(result.current.currentLocation).toBeNull()
    expect(result.current.coordinatesAreFallback).toBe(true)
  })

  it('uses the canonical default only as a viewport when web geolocation is unavailable', async () => {
    ;(Platform as any).OS = 'web'
    Object.defineProperty(global, 'navigator', {
      configurable: true,
      value: {},
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

    const { result } = renderHook(() => useMapCoordinates())

    await waitFor(() => expect(result.current.locationState.status).toBe('unavailable'))
    expect(result.current.coordinatesSource).toBe('default')
    expect(result.current.currentLocation).toBeNull()
    expect(result.current.coordinatesAreFallback).toBe(true)
  })

  it('keeps a non-permission web failure in the explicit error state', async () => {
    ;(Platform as any).OS = 'web'
    Object.defineProperty(global, 'navigator', {
      configurable: true,
      value: {
        geolocation: {
          getCurrentPosition: jest.fn((_success: PositionCallback, error: PositionErrorCallback) => {
            error({
              code: 3,
              message: 'timeout',
              PERMISSION_DENIED: 1,
              POSITION_UNAVAILABLE: 2,
              TIMEOUT: 3,
            } as GeolocationPositionError)
          }),
          watchPosition: jest.fn(),
          clearWatch: jest.fn(),
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

    const { result } = renderHook(() => useMapCoordinates())

    await waitFor(() => expect(result.current.locationState.status).toBe('error'))
    expect(result.current.coordinatesSource).toBe('default')
    expect(result.current.currentLocation).toBeNull()
    expect(result.current.coordinatesAreFallback).toBe(true)
  })

  it('preserves native canAskAgain=false for the settings flow', async () => {
    ;(Platform as any).OS = 'android'
    ;(loadExpoLocation as jest.Mock).mockResolvedValue({
      requestForegroundPermissionsAsync: jest.fn().mockResolvedValue({
        status: 'denied',
        granted: false,
        canAskAgain: false,
      }),
      getCurrentPositionAsync: jest.fn(),
      Accuracy: { Balanced: 3 },
    })

    const { result } = renderHook(() => useMapCoordinates())

    await waitFor(() => {
      expect(result.current.locationState).toEqual({
        status: 'denied',
        coordinates: null,
        accuracy: null,
        timestamp: null,
        canAskAgain: false,
      })
    })
    expect(result.current.currentLocation).toBeNull()
    expect(result.current.coordinatesAreFallback).toBe(true)
  })

  it('exposes timestamp and accuracy only for a trusted native current fix', async () => {
    ;(Platform as any).OS = 'android'
    ;(loadExpoLocation as jest.Mock).mockResolvedValue({
      requestForegroundPermissionsAsync: jest.fn().mockResolvedValue({
        status: 'granted',
        granted: true,
        canAskAgain: true,
      }),
      getCurrentPositionAsync: jest.fn().mockResolvedValue({
        coords: { latitude: 52.2, longitude: 20.98, accuracy: 8 },
        timestamp: 1234,
      }),
      watchPositionAsync: undefined,
      Accuracy: { Balanced: 3 },
    })

    const { result } = renderHook(() => useMapCoordinates())

    await waitFor(() => {
      expect(result.current.locationState).toEqual({
        status: 'current',
        coordinates: { latitude: 52.2, longitude: 20.98 },
        accuracy: 8,
        timestamp: 1234,
        canAskAgain: true,
      })
    })
    expect(result.current.currentLocation).toEqual({ latitude: 52.2, longitude: 20.98 })
    expect(result.current.coordinatesAreFallback).toBe(false)
  })

  it('rechecks native permission after returning from device settings', async () => {
    ;(Platform as any).OS = 'android'
    let handleAppStateChange: ((state: string) => void) | null = null
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, handler: any) => {
      handleAppStateChange = handler
      return { remove: jest.fn() } as any
    })
    const requestForegroundPermissionsAsync = jest
      .fn()
      .mockResolvedValueOnce({ status: 'denied', granted: false, canAskAgain: false })
      .mockResolvedValueOnce({ status: 'granted', granted: true, canAskAgain: true })
    ;(loadExpoLocation as jest.Mock).mockResolvedValue({
      requestForegroundPermissionsAsync,
      getCurrentPositionAsync: jest.fn().mockResolvedValue({
        coords: { latitude: 52.2, longitude: 20.98, accuracy: 6 },
        timestamp: 3000,
      }),
      watchPositionAsync: undefined,
      Accuracy: { Balanced: 3 },
    })

    const { result } = renderHook(() => useMapCoordinates())
    await waitFor(() => expect(result.current.locationState.status).toBe('denied'))

    const openSettings = jest.fn().mockResolvedValue(undefined)
    Object.defineProperty(Linking, 'openSettings', {
      configurable: true,
      value: openSettings,
    })
    await act(async () => {
      await result.current.openLocationSettings()
    })

    act(() => {
      handleAppStateChange?.('background')
      handleAppStateChange?.('active')
    })

    await waitFor(() => expect(result.current.locationState.status).toBe('current'))
    expect(openSettings).toHaveBeenCalledTimes(1)
    expect(requestForegroundPermissionsAsync).toHaveBeenCalledTimes(2)
    expect(result.current.currentLocation).toEqual({ latitude: 52.2, longitude: 20.98 })
  })

  it('does not re-prompt denied permission after an unrelated app background cycle', async () => {
    ;(Platform as any).OS = 'android'
    let handleAppStateChange: ((state: string) => void) | null = null
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, handler: any) => {
      handleAppStateChange = handler
      return { remove: jest.fn() } as any
    })
    const requestForegroundPermissionsAsync = jest.fn().mockResolvedValue({
      status: 'denied',
      granted: false,
      canAskAgain: true,
    })
    ;(loadExpoLocation as jest.Mock).mockResolvedValue({
      requestForegroundPermissionsAsync,
      getCurrentPositionAsync: jest.fn(),
      Accuracy: { Balanced: 3 },
    })

    const { result } = renderHook(() => useMapCoordinates())
    await waitFor(() => expect(result.current.locationState.status).toBe('denied'))

    act(() => {
      handleAppStateChange?.('background')
      handleAppStateChange?.('active')
    })

    expect(requestForegroundPermissionsAsync).toHaveBeenCalledTimes(1)
    expect(result.current.locationState.status).toBe('denied')
  })
})
