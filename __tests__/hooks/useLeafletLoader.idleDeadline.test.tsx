/**
 * #2020: «Timeout policy» caps the Leaflet idle deadline at 1000 ms — the map
 * page (`Map.web.tsx`) and the travel map wait for the runtime behind their
 * skeleton.
 *
 * Under NODE_ENV=test the loader skips idle scheduling and loads at once
 * (`isTestEnv`), so the hook is required with another NODE_ENV to exercise the
 * scheduling branch that ships.
 */
import { renderHook } from '@testing-library/react-native'
import { Platform } from 'react-native'

const ORIGINAL_NODE_ENV = process.env.NODE_ENV
process.env.NODE_ENV = 'development'
const { useLeafletLoader } = require('@/hooks/useLeafletLoader') as typeof import('@/hooks/useLeafletLoader')
process.env.NODE_ENV = ORIGINAL_NODE_ENV

const ORIGINAL_PLATFORM_OS = Platform.OS

describe('useLeafletLoader idle deadline', () => {
  const requestIdleCallback = jest.fn((_callback: () => void, _options?: { timeout?: number }) => 1)

  beforeEach(() => {
    jest.useFakeTimers()
    requestIdleCallback.mockClear()
    Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true })
    Object.defineProperty(window, 'requestIdleCallback', {
      value: requestIdleCallback,
      writable: true,
      configurable: true,
    })
    Object.defineProperty(window, 'cancelIdleCallback', {
      value: jest.fn(),
      writable: true,
      configurable: true,
    })
  })

  afterEach(() => {
    jest.clearAllTimers()
    jest.useRealTimers()
    Object.defineProperty(Platform, 'OS', { value: ORIGINAL_PLATFORM_OS, configurable: true })
  })

  it('waits for idle no longer than 1000 ms by default', () => {
    renderHook(() => useLeafletLoader({ enabled: true, useIdleCallback: true }))

    expect(requestIdleCallback).toHaveBeenCalledTimes(1)
    expect(requestIdleCallback.mock.calls[0][1]?.timeout).toBeLessThanOrEqual(1000)
  })
})
