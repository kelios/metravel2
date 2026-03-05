describe('utils/performance initPerformanceMonitoring', () => {
  let originalPerformanceObserver: unknown
  let warnSpy: jest.SpyInstance

  beforeEach(() => {
    jest.resetModules()
    originalPerformanceObserver = (globalThis as Record<string, unknown>).PerformanceObserver
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    warnSpy.mockRestore()
    ;(globalThis as Record<string, unknown>).PerformanceObserver = originalPerformanceObserver
  })

  it('ignores very late LCP entries and initializes observers only once', async () => {
    const observers: Array<{ callback: (list: { getEntries: () => Array<{ startTime?: number; duration?: number }> }) => void }> = []

    class MockPerformanceObserver {
      callback: (list: { getEntries: () => Array<{ startTime?: number; duration?: number }> }) => void

      constructor(callback: (list: { getEntries: () => Array<{ startTime?: number; duration?: number }> }) => void) {
        this.callback = callback
        observers.push({ callback })
      }

      observe(): void {
        // no-op
      }
    }

    ;(globalThis as Record<string, unknown>).PerformanceObserver = MockPerformanceObserver as unknown

    const performanceObject = performance as unknown as { getEntriesByType?: (type: string) => unknown[] }
    if (typeof performanceObject.getEntriesByType !== 'function') {
      performanceObject.getEntriesByType = () => []
    }

    const getEntriesByTypeSpy = jest
      .spyOn(performanceObject as { getEntriesByType: (type: string) => unknown[] }, 'getEntriesByType')
      .mockImplementation((type: string) => {
        if (type === 'navigation') {
          return [{ loadEventEnd: 1200 }]
        }
        return []
      })

    const { initPerformanceMonitoring } = await import('@/utils/performance')
    initPerformanceMonitoring()
    initPerformanceMonitoring()

    // LCP + LongTask observers are created exactly once.
    expect(observers).toHaveLength(2)

    const lcpObserver = observers[0]
    lcpObserver.callback({
      getEntries: () => [{ startTime: 59_340 }],
    })
    expect(warnSpy).not.toHaveBeenCalled()

    lcpObserver.callback({
      getEntries: () => [{ startTime: 5_000 }],
    })
    expect(warnSpy).toHaveBeenCalledTimes(1)

    // Warning should be emitted once even if later entries also exceed threshold.
    lcpObserver.callback({
      getEntries: () => [{ startTime: 7_000 }],
    })
    expect(warnSpy).toHaveBeenCalledTimes(1)

    getEntriesByTypeSpy.mockRestore()
  })
})
