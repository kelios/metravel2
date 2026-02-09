import { act, renderHook } from '@testing-library/react-native'
import { Platform } from 'react-native'

import { useTravelDetailsPerformance } from '@/hooks/useTravelDetailsPerformance'

jest.mock('@/components/travel/Slider', () => ({
  __esModule: true,
  default: () => null,
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
    // timers and microtask queue. Delay is 3000ms.
    await act(async () => {
      jest.advanceTimersByTime(3000)
    })

    // criticalCSS and advancedPerformanceOptimization are no longer imported at runtime —
    // critical CSS is inlined in +html.tsx at build time.
    expect(injectCriticalStyles).not.toHaveBeenCalled()
    expect(initPerformanceMonitoring).toHaveBeenCalled()
    expect(optimizeCriticalPath).not.toHaveBeenCalled()
  })

  it('enables deferred loading once loading is complete', () => {
    const { result } = renderHook(() =>
      useTravelDetailsPerformance({ travel: undefined, isMobile: false, isLoading: false })
    )

    act(() => {})
    expect(result.current.deferAllowed).toBe(true)
  })

  it('marks slider ready after LCP is loaded and Slider chunk resolves', async () => {
    const { result } = renderHook(() =>
      useTravelDetailsPerformance({ travel: undefined, isMobile: false, isLoading: true })
    )

    expect(result.current.sliderReady).toBe(false)

    // setLcpLoaded triggers an effect that does import('@/components/travel/Slider')
    // which is mocked and resolves as a microtask.
    await act(async () => {
      result.current.setLcpLoaded(true)
    })

    // Flush any remaining timers
    await act(async () => {
      jest.advanceTimersByTime(100)
    })

    expect(result.current.sliderReady).toBe(true)
  })
})
