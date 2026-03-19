import { act, renderHook } from '@testing-library/react-native'
import { Platform } from 'react-native'

import { useTravelDetailsPerformance } from '@/hooks/useTravelDetailsPerformance'

jest.mock('@/components/travel/Slider.web', () => ({
  __esModule: true,
  default: () => null,
}))
jest.mock('@/styles/criticalCSS', () => ({
  injectCriticalStyles: jest.fn(),
}))
jest.mock('@/utils/performance', () => ({
  initPerformanceMonitoring: jest.fn(),
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
    jest.restoreAllMocks()
  })

  it('initializes performance helpers on non-happy paths after idle delay', async () => {
    renderHook(() =>
      useTravelDetailsPerformance({ travel: undefined, isMobile: false, isLoading: false })
    )

    await act(async () => {
      jest.advanceTimersByTime(1000)
    })

    expect(injectCriticalStyles).not.toHaveBeenCalled()
    expect(initPerformanceMonitoring).toHaveBeenCalled()
  })

  it('keeps performance helpers out of the early happy-path window', async () => {
    renderHook(() =>
      useTravelDetailsPerformance({
        travel: { id: 1, name: 'Demo travel' } as any,
        isMobile: false,
        isLoading: false,
      })
    )

    await act(async () => {
      jest.advanceTimersByTime(1000)
    })

    expect(initPerformanceMonitoring).not.toHaveBeenCalled()
  })

  it('enables deferred loading once loading is complete', () => {
    const { result } = renderHook(() =>
      useTravelDetailsPerformance({ travel: undefined, isMobile: false, isLoading: false })
    )

    act(() => {})
    expect(result.current.deferAllowed).toBe(true)
    expect(result.current.postLcpRuntimeReady).toBe(true)
  })

  it('preloads slider runtime automatically after LCP', async () => {
    const { result } = renderHook(() =>
      useTravelDetailsPerformance({
        travel: { id: 1, name: 'Demo travel' } as any,
        isMobile: false,
        isLoading: false,
      })
    )

    expect(result.current.sliderReady).toBe(false)

    // Slider chunk is now gated by both lcpLoaded and deferAllowed.
    await act(async () => {
      result.current.setLcpLoaded(true)
    })

    expect(result.current.sliderReady).toBe(false)

    await act(async () => {
      jest.advanceTimersByTime(400)
    })

    expect(result.current.deferAllowed).toBe(true)
    await act(async () => {
      await Promise.resolve()
    })

    expect(result.current.sliderReady).toBe(true)
  })

  it('reveals post-LCP runtime automatically after data loading without user interaction', async () => {
    const { result } = renderHook(() =>
      useTravelDetailsPerformance({
        travel: { id: 1, name: 'Demo travel' } as any,
        isMobile: false,
        isLoading: false,
      })
    )

    expect(result.current.deferAllowed).toBe(true)
    expect(result.current.postLcpRuntimeReady).toBe(true)
  })
})
