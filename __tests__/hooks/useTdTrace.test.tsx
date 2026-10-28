import { renderHook } from '@testing-library/react-native'
import { Platform } from 'react-native'

describe('useTdTrace', () => {
  const originalOS = Platform.OS
  const originalUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`

  beforeEach(() => {
    Platform.OS = 'web' as any
  })

  afterEach(() => {
    Platform.OS = originalOS as any
    // location в jsdom 26 non-configurable: возвращаем исходный адрес через history.
    window.history.replaceState(null, '', originalUrl)
    delete (window as unknown as Record<string, unknown>).__METRAVEL_TD_TRACE
    jest.resetModules()
    jest.restoreAllMocks()
  })

  it('enables tracing from tdtrace query param', async () => {
    window.history.replaceState(null, '', '/?tdtrace=1')

    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {})
    const { useTdTrace } = require('@/hooks/useTdTrace')

    const { result } = await renderHook(() => useTdTrace())
    result.current('trace:test')

    expect(consoleSpy).toHaveBeenCalled()
  })
})
