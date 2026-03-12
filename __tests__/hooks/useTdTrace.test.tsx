import { renderHook } from '@testing-library/react-native'
import { Platform } from 'react-native'

describe('useTdTrace', () => {
  const originalOS = Platform.OS
  const originalLocation = window.location

  beforeEach(() => {
    Platform.OS = 'web' as any
  })

  afterEach(() => {
    Platform.OS = originalOS as any
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    })
    delete (window as unknown as Record<string, unknown>).__METRAVEL_TD_TRACE
    jest.resetModules()
    jest.restoreAllMocks()
  })

  it('enables tracing from tdtrace query param', () => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        ...originalLocation,
        search: '?tdtrace=1',
      },
    })

    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {})
    const { useTdTrace } = require('@/hooks/useTdTrace')

    const { result } = renderHook(() => useTdTrace())
    result.current('trace:test')

    expect(consoleSpy).toHaveBeenCalled()
  })
})
