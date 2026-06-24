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
  const heroTravel = {
    id: 1,
    name: 'Demo travel',
    gallery: [{ id: 'hero-1', url: 'https://example.com/hero.jpg' }],
  } as any

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
    expect(result.current.postLcpRuntimeReady).toBe(false)
  })

  it('preloads slider runtime automatically after LCP', async () => {
    const { result } = renderHook(() =>
      useTravelDetailsPerformance({
        travel: heroTravel,
        isMobile: false,
        isLoading: false,
      })
    )

    expect(result.current.sliderReady).toBe(false)

    // Slider chunk is now gated by both lcpLoaded and deferAllowed.
    await act(async () => {
      result.current.setLcpLoaded(true)
    })

    await act(async () => {
      await Promise.resolve()
    })

    expect(result.current.deferAllowed).toBe(true)
    expect(result.current.sliderReady).toBe(true)
  })

  it('keeps post-LCP runtime blocked until LCP is ready', async () => {
    const { result } = renderHook(() =>
      useTravelDetailsPerformance({
        travel: heroTravel,
        isMobile: false,
        isLoading: false,
      })
    )

    expect(result.current.deferAllowed).toBe(true)
    expect(result.current.heroEnhancersReady).toBe(false)
    expect(result.current.postLcpRuntimeReady).toBe(false)
  })

  it('unblocks the main runtime immediately when the travel has no hero gallery', () => {
    const { result } = renderHook(() =>
      useTravelDetailsPerformance({
        travel: { id: 503, name: 'No gallery travel', gallery: [] } as any,
        isMobile: false,
        isLoading: false,
      })
    )

    expect(result.current.deferAllowed).toBe(true)
    expect(result.current.heroEnhancersReady).toBe(true)
    expect(result.current.postLcpRuntimeReady).toBe(true)
    expect(result.current.lcpLoaded).toBe(false)
  })

  it('reveals hero enhancers and post-LCP runtime together on a single idle window after LCP', async () => {
    const { result } = renderHook(() =>
      useTravelDetailsPerformance({
        travel: heroTravel,
        isMobile: false,
        isLoading: false,
      })
    )

    await act(async () => {
      result.current.setLcpLoaded(true)
    })

    await act(async () => {
      await Promise.resolve()
    })

    expect(result.current.heroEnhancersReady).toBe(false)
    expect(result.current.postLcpRuntimeReady).toBe(false)

    // #558: a single idle callback after LCP flips both gates in the same commit
    // instead of a 250→500 fixed-timer ladder, so chrome no longer steps in.
    await act(async () => {
      jest.advanceTimersByTime(250)
      await Promise.resolve()
    })

    expect(result.current.heroEnhancersReady).toBe(true)
    expect(result.current.postLcpRuntimeReady).toBe(true)
  })

  it('resets web gates during render on a cache-hit travel swap (isLoading stays false)', async () => {
    const firstTravel = {
      id: 1,
      name: 'First travel',
      gallery: [{ id: 'hero-1', url: 'https://example.com/a.jpg' }],
    } as any
    const secondTravel = {
      id: 2,
      name: 'Second travel',
      gallery: [{ id: 'hero-2', url: 'https://example.com/b.jpg' }],
    } as any

    const { result, rerender } = renderHook(
      ({ travel }) =>
        useTravelDetailsPerformance({ travel, isMobile: false, isLoading: false }),
      { initialProps: { travel: firstTravel } }
    )

    // Bring the first travel's gates fully open (simulating the previous page).
    await act(async () => {
      result.current.setLcpLoaded(true)
    })
    await act(async () => {
      await Promise.resolve()
    })
    act(() => {
      jest.advanceTimersByTime(500)
    })
    await act(async () => {
      await Promise.resolve()
    })

    expect(result.current.lcpLoaded).toBe(true)
    expect(result.current.postLcpRuntimeReady).toBe(true)
    expect(result.current.heroEnhancersReady).toBe(true)

    // SPA cache-hit navigation: same hook instance, isLoading never flips true.
    act(() => {
      rerender({ travel: secondTravel })
    })

    // First render of the new travel must NOT carry the heavy gates over.
    expect(result.current.lcpLoaded).toBe(false)
    expect(result.current.postLcpRuntimeReady).toBe(false)
    expect(result.current.heroEnhancersReady).toBe(false)
    expect(result.current.sliderReady).toBe(false)

    // Then the idle effects re-reveal the chrome progressively.
    await act(async () => {
      result.current.setLcpLoaded(true)
    })
    await act(async () => {
      await Promise.resolve()
    })
    act(() => {
      jest.advanceTimersByTime(500)
    })
    await act(async () => {
      await Promise.resolve()
    })

    expect(result.current.heroEnhancersReady).toBe(true)
    expect(result.current.postLcpRuntimeReady).toBe(true)
  })

  it('keeps post-LCP chrome out of the critical path until LCP, then reveals it in one step', async () => {
    const { result } = renderHook(() =>
      useTravelDetailsPerformance({
        travel: heroTravel,
        isMobile: false,
        isLoading: false,
      })
    )

    // Before LCP nothing post-LCP is revealed (chrome must not enter the critical path).
    expect(result.current.heroEnhancersReady).toBe(false)
    expect(result.current.postLcpRuntimeReady).toBe(false)

    await act(async () => {
      result.current.setLcpLoaded(true)
    })

    await act(async () => {
      await Promise.resolve()
    })

    await act(async () => {
      jest.advanceTimersByTime(250)
      await Promise.resolve()
    })

    expect(result.current.heroEnhancersReady).toBe(true)
    expect(result.current.postLcpRuntimeReady).toBe(true)
  })
})
