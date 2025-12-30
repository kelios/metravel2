import { act, renderHook } from '@testing-library/react-native'
import { Platform } from 'react-native'

import { useTravelDetailsPerformance } from '@/hooks/useTravelDetailsPerformance'

jest.mock('@/components/travel/details/TravelDetailsSections', () => ({
  useLCPPreload: jest.fn(),
}))
jest.mock('@/styles/criticalCSS', () => ({
  injectCriticalStyles: jest.fn(),
}))
jest.mock('@/utils/performanceMonitoring', () => ({
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
jest.mock('@/components/Map', () => ({
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
const initPerformanceMonitoring = jest.requireMock('@/utils/performanceMonitoring')
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

  it('initializes performance helpers on web', () => {
    renderHook(() =>
      useTravelDetailsPerformance({ travel: undefined, isMobile: false, isLoading: true })
    )

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
    act(() => {
      jest.advanceTimersByTime(600)
    })

    expect(result.current.sliderReady).toBe(true)
  })
})
