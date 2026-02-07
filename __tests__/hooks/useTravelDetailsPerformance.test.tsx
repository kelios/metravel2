import { act, renderHook } from '@testing-library/react-native'
import { Platform } from 'react-native'

import { useTravelDetailsPerformance } from '@/hooks/useTravelDetailsPerformance'

jest.mock('@/components/travel/details/TravelDetailsSections', () => ({
  useLCPPreload: jest.fn(),
}))
jest.mock('@/styles/criticalCSS', () => ({
  injectCriticalStyles: jest.fn(),
}))
jest.mock('@/utils/performance', () => ({
  initPerformanceMonitoring: jest.fn(),
}))
jest.mock('@/utils/advancedPerformanceOptimization', () => ({
  optimizeCriticalPath: jest.fn(),
}))

jest.mock('@/components/travel/TravelDescription', () => ({
  __esModule: true,
  default: () => null,
}))
jest.mock('@/components/travel/PointList', () => ({
  __esModule: true,
  default: () => null,
}))
jest.mock('@/components/travel/NearTravelList', () => ({
  __esModule: true,
  default: () => null,
}))
jest.mock('@/components/travel/PopularTravelList', () => ({
  __esModule: true,
  default: () => null,
}))
jest.mock('@/components/travel/ToggleableMapSection', () => ({
  __esModule: true,
  default: () => null,
}))
jest.mock('@/components/map/Map', () => ({
  __esModule: true,
  default: () => null,
}))
jest.mock('@expo/vector-icons/MaterialIcons', () => ({
  __esModule: true,
  default: {},
}))

const useLCPPreload = jest.requireMock(
  '@/components/travel/details/TravelDetailsSections'
).useLCPPreload as jest.Mock
const injectCriticalStyles = jest.requireMock('@/styles/criticalCSS')
  .injectCriticalStyles as jest.Mock
const initPerformanceMonitoring = jest.requireMock('@/utils/performance')
  .initPerformanceMonitoring as jest.Mock
const optimizeCriticalPath = jest.requireMock('@/utils/advancedPerformanceOptimization')
  .optimizeCriticalPath as jest.Mock

describe('useTravelDetailsPerformance', () => {
  const originalOS = Platform.OS

  beforeEach(() => {
    Platform.OS = 'web'
    jest.useFakeTimers()
    jest.clearAllMocks()
  })

  afterEach(() => {
    Platform.OS = originalOS
    jest.useRealTimers()
  })

  it('initializes performance helpers on web', async () => {
    renderHook(() =>
      useTravelDetailsPerformance({ travel: undefined, isMobile: false, isLoading: true })
    )

    // rIC schedules via requestIdleCallback (mocked as setTimeout(cb, 0)).
    // The callback is now async (dynamic imports), so we need to flush both
    // timers and microtask queue.
    await act(async () => {
      jest.advanceTimersByTime(800)
    })

    // useLCPPreload is now a no-op (preloading handled by inline script in +html.tsx)
    // but it's still called to maintain the hook signature
    expect(useLCPPreload).toHaveBeenCalled()
    expect(injectCriticalStyles).toHaveBeenCalled()
    expect(initPerformanceMonitoring).toHaveBeenCalled()
    expect(optimizeCriticalPath).toHaveBeenCalled()
  })

  it('enables deferred loading once loading is complete', () => {
    const { result } = renderHook(() =>
      useTravelDetailsPerformance({ travel: undefined, isMobile: false, isLoading: false })
    )

    act(() => {})
    expect(result.current.deferAllowed).toBe(true)
  })

  it('marks slider ready after LCP is loaded', () => {
    const { result } = renderHook(() =>
      useTravelDetailsPerformance({ travel: undefined, isMobile: false, isLoading: true })
    )

    expect(result.current.sliderReady).toBe(false)

    act(() => {
      result.current.setLcpLoaded(true)
    })

    // Slider is enabled after window load + idle time on web.
    // Ensure we go through the "load" path even in jsdom.
    try {
      Object.defineProperty(document, 'readyState', {
        value: 'loading',
        configurable: true,
      })
    } catch {
      // noop
    }
    act(() => {
      window.dispatchEvent(new Event('load'))
    })
    act(() => {
      jest.advanceTimersByTime(1200)
    })

    expect(result.current.sliderReady).toBe(true)
  })
})
