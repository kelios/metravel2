/** @jest-environment-options {"url":"https://example.test/map"} */

import { act, renderHook, waitFor } from '@testing-library/react-native'
import { Platform } from 'react-native'

import { useMapCoordinates } from '@/hooks/map/useMapCoordinates'
import { publishLiveUserPosition } from '@/hooks/map/liveUserPosition'
import { MAP_STARTUP_LOCATION_KEY, MAP_WEB_LOCATION_PERMISSION_TIMEOUT_MS } from '@/utils/mapStartupLocation'

jest.mock('@/utils/logger', () => ({ logError: jest.fn(), logMessage: jest.fn() }))
jest.mock('@/hooks/map/expoLocationLoader', () => ({ loadExpoLocation: jest.fn() }))

// #2450 — coming back to the map with a fresh trusted fix must not request a new
// one (loading state, forced anchor, data refetch): it only resumes the watch.
describe('useMapCoordinates re-focus with a fresh trusted fix', () => {
  const originalPlatform = Platform.OS
  const originalNavigator = global.navigator

  afterEach(() => {
    publishLiveUserPosition(null)
    window.localStorage.clear?.()
    ;(Platform as any).OS = originalPlatform
    Object.defineProperty(global, 'navigator', { configurable: true, value: originalNavigator })
    Reflect.deleteProperty(window, MAP_STARTUP_LOCATION_KEY)
    jest.restoreAllMocks()
  })

  it('consumes the same pending document fix across refocus, then lets a later retry request normally', async () => {
    ;(Platform as any).OS = 'web'
    const denied = { code: 1, PERMISSION_DENIED: 1 } as GeolocationPositionError
    const getCurrentPosition = jest.fn((_success: PositionCallback, failure: PositionErrorCallback) => failure(denied))
    Object.defineProperty(global, 'navigator', {
      configurable: true,
      value: { geolocation: { getCurrentPosition } },
    })
    let settle: (result: { error: GeolocationPositionError }) => void = () => {}
    const pending = new Promise<{ error: GeolocationPositionError }>(resolve => { settle = resolve })
    Reflect.set(window, MAP_STARTUP_LOCATION_KEY, { permission: Promise.resolve('prompt'), result: pending })

    const { result, rerender } = await renderHook(
      ({ isFocused }) => useMapCoordinates({ isFocused }),
      { initialProps: { isFocused: true } },
    )
    expect(Reflect.has(window, MAP_STARTUP_LOCATION_KEY)).toBe(false)
    await rerender({ isFocused: false })
    await rerender({ isFocused: true })
    expect(getCurrentPosition).not.toHaveBeenCalled()

    await act(async () => { settle({ error: denied }) })
    expect(result.current.locationState.status).toBe('denied')
    expect(getCurrentPosition).not.toHaveBeenCalled()

    await act(() => result.current.refreshLocation())
    expect(getCurrentPosition).toHaveBeenCalledTimes(1)
  })

  it('discards a head fix settled while blurred and reclassifies permission on refocus', async () => {
    ;(Platform as any).OS = 'web'
    const query = jest.fn(async () => ({ state: 'prompt' }))
    const getCurrentPosition = jest.fn()
    Object.defineProperty(global, 'navigator', {
      configurable: true,
      value: { permissions: { query }, geolocation: { getCurrentPosition } },
    })
    let settle: (value: { position: GeolocationPosition }) => void = () => {}
    const pending = new Promise<{ position: GeolocationPosition }>(resolve => { settle = resolve })
    Reflect.set(window, MAP_STARTUP_LOCATION_KEY, { permission: Promise.resolve('granted'), result: pending })
    const { result, rerender } = await renderHook(
      ({ isFocused }) => useMapCoordinates({ isFocused }),
      { initialProps: { isFocused: true } },
    )
    expect(result.current.webStartupLocationPending).toBe(true)
    expect(query).not.toHaveBeenCalled()
    expect(getCurrentPosition).not.toHaveBeenCalled()

    await rerender({ isFocused: false })
    await act(async () => {
      settle({ position: { coords: { latitude: 52.2, longitude: 20.98 }, timestamp: 1000 } as GeolocationPosition })
    })
    await rerender({ isFocused: true })
    await waitFor(() => expect(result.current.webStartupLocationPending).toBe(false))
    expect(query).toHaveBeenCalledTimes(1)
    expect(getCurrentPosition).toHaveBeenCalledTimes(1)
    expect(result.current.currentLocation).toBeNull()
  })

  it('shares the pending permission probe across focus replay and opens when it times out', async () => {
    jest.useFakeTimers()
    try {
      ;(Platform as any).OS = 'web'
      const query = jest.fn(() => new Promise(() => {}))
      Object.defineProperty(global, 'navigator', {
        configurable: true,
        value: { permissions: { query }, geolocation: { getCurrentPosition: jest.fn() } },
      })
      const { result, rerender } = await renderHook(
        ({ isFocused }) => useMapCoordinates({ isFocused }),
        { initialProps: { isFocused: true } },
      )
      await rerender({ isFocused: false })
      await rerender({ isFocused: true })
      expect(query).toHaveBeenCalledTimes(1)
      expect(result.current.webStartupLocationPending).toBe(true)

      await act(async () => { await jest.advanceTimersByTimeAsync(MAP_WEB_LOCATION_PERMISSION_TIMEOUT_MS) })
      expect(result.current.webStartupLocationPending).toBe(false)
    } finally {
      jest.useRealTimers()
    }
  })

  it.each([
    ['granted', true, 'current'],
    ['prompt', false, 'current'],
    ['granted', true, 'error'],
  ] as const)('settles the startup viewport while geolocation permission is %s (%s, %s)', async (state, waitsForFix, outcome) => {
    ;(Platform as any).OS = 'web'
    const query = jest.fn(async () => ({ state }))
    const getCurrentPosition = jest.fn<void, Parameters<Geolocation['getCurrentPosition']>>()
    Object.defineProperty(global, 'navigator', {
      configurable: true,
      value: { permissions: { query }, geolocation: { getCurrentPosition } },
    })
    const { result } = await renderHook(() => useMapCoordinates({ isFocused: true }))
    await act(async () => {})

    expect(query).toHaveBeenCalledTimes(1)
    expect(result.current.webStartupLocationPending).toBe(waitsForFix)
    expect(result.current.locationState.status).toBe('loading')

    await act(async () => {
      const [success, failure] = getCurrentPosition.mock.calls[0]
      if (outcome === 'current') {
        success({
          coords: { latitude: 52.2, longitude: 20.98, accuracy: 9 },
          timestamp: Date.now(),
        } as GeolocationPosition)
      } else {
        const timeout = { code: 3, TIMEOUT: 3 } as GeolocationPositionError
        failure?.(timeout)
        expect(result.current.webStartupLocationPending).toBe(true)
        getCurrentPosition.mock.calls[1][1]?.(timeout)
      }
    })
    expect(result.current.locationState.status).toBe(outcome)
    expect(result.current.webStartupLocationPending).toBe(false)
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

    const { result, rerender } = await renderHook(
      ({ isFocused }) => useMapCoordinates({ isFocused }),
      { initialProps: { isFocused: true } },
    )

    await waitFor(() => {
      expect(result.current.coordinates).toEqual({ latitude: 52.2, longitude: 20.98 })
    })
    expect(getCurrentPosition).toHaveBeenCalledTimes(1)
    const coordinatesBefore = result.current.coordinates

    await act(async () => {
      await rerender({ isFocused: false })
    })
    await act(async () => {
      await rerender({ isFocused: true })
    })

    expect(getCurrentPosition).toHaveBeenCalledTimes(1)
    expect(result.current.coordinates).toBe(coordinatesBefore)
    // The foreground watch is resumed for the marker.
    expect(watchPosition.mock.calls.length).toBeGreaterThanOrEqual(2)
  })
})
