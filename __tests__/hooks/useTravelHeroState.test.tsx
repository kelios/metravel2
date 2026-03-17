import { act, renderHook } from '@testing-library/react-native'
import * as ReactNative from 'react-native'
import { Platform } from 'react-native'

import { __testables, useTravelHeroState } from '@/hooks/useTravelHeroState'

jest.mock('@/hooks/useTdTrace', () => ({
  useTdTrace: () => jest.fn(),
}))

describe('useWebHeroSliderUpgradeGate', () => {
  const originalPlatformOS = Platform.OS

  beforeEach(() => {
    Platform.OS = 'web' as any
    jest.useFakeTimers()
    Object.defineProperty(window.navigator, 'webdriver', {
      value: false,
      configurable: true,
    })
  })

  afterEach(() => {
    Platform.OS = originalPlatformOS as any
    jest.useRealTimers()
  })

  it('keeps the web hero slider disabled until the user interacts with the hero', () => {
    const { result } = renderHook(() =>
      __testables.useWebHeroSliderUpgradeGate(),
    )

    expect(result.current).toBe(true)

    act(() => {
      jest.advanceTimersByTime(5000)
    })

    expect(result.current).toBe(true)
  })

  it('keeps the web hero slider enabled even when pointer interaction happens later', () => {
    const hero = document.createElement('div')
    hero.setAttribute('data-testid', 'travel-details-hero-slider-container')
    document.body.appendChild(hero)

    const { result } = renderHook(() =>
      __testables.useWebHeroSliderUpgradeGate(),
    )

    expect(result.current).toBe(true)

    act(() => {
      hero.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }))
    })

    expect(result.current).toBe(true)
    hero.remove()
  })

  it('stays enabled in automation mode', () => {
    Object.defineProperty(window.navigator, 'webdriver', {
      value: true,
      configurable: true,
    })

    const { result } = renderHook(() =>
      __testables.useWebHeroSliderUpgradeGate(),
    )

    expect(result.current).toBe(true)
  })
})

describe('useTravelHeroState', () => {
  const originalPlatformOS = Platform.OS
  let useWindowDimensionsSpy: jest.SpyInstance

  beforeEach(() => {
    Platform.OS = 'web' as any
    jest.useFakeTimers()
    useWindowDimensionsSpy = jest
      .spyOn(ReactNative, 'useWindowDimensions')
      .mockReturnValue({ width: 1440, height: 1000, scale: 1, fontScale: 1 } as any)
  })

  afterEach(() => {
    Platform.OS = originalPlatformOS as any
    jest.useRealTimers()
    useWindowDimensionsSpy.mockRestore()
  })

  it('uses the first gallery image as the initial web hero media when gallery exists', () => {
    const onFirstImageLoad = jest.fn()
    const travel = {
      id: 42,
      name: 'Stable handoff travel',
      travel_image_thumb_url: 'https://example.com/cover.jpg?updated=1',
      gallery: [
        { id: 1, url: 'https://example.com/gallery-1.jpg?size=sm' },
        { id: 2, url: 'https://example.com/gallery-2.jpg' },
      ],
    } as any

    const { result } = renderHook(() =>
      useTravelHeroState(travel, false, onFirstImageLoad, false),
    )

    expect(result.current.firstImg?.url).toBe('https://example.com/gallery-1.jpg?size=sm')
    expect(result.current.galleryImages[0]?.url).toBe('https://example.com/gallery-1.jpg?size=sm')
    expect(result.current.heroSliderImages).toHaveLength(2)
    expect(result.current.heroSliderImages[0]?.url).toBe('https://example.com/gallery-1.jpg?size=sm')
    expect(result.current.heroSliderImages[1]?.url).toBe('https://example.com/gallery-2.jpg')
  })

  it('keeps gallery order even when the first gallery image matches the cover media', () => {
    const onFirstImageLoad = jest.fn()
    const travel = {
      id: 43,
      name: 'Deduped handoff travel',
      travel_image_thumb_url: 'https://example.com/cover.jpg?updated=1',
      gallery: [
        { id: 1, url: 'https://example.com/cover.jpg?size=lg' },
        { id: 2, url: 'https://example.com/gallery-2.jpg' },
      ],
    } as any

    const { result } = renderHook(() =>
      useTravelHeroState(travel, false, onFirstImageLoad, false),
    )

    expect(result.current.firstImg?.url).toBe('https://example.com/cover.jpg?size=lg')
    expect(result.current.heroSliderImages).toHaveLength(2)
    expect(result.current.heroSliderImages[0]?.url).toBe('https://example.com/cover.jpg?size=lg')
    expect(result.current.heroSliderImages[1]?.url).toBe('https://example.com/gallery-2.jpg')
  })

  it('falls back to the cover image in the slider when gallery is empty', () => {
    const onFirstImageLoad = jest.fn()
    const travel = {
      id: 44,
      name: 'Cover fallback travel',
      travel_image_thumb_url: 'https://example.com/cover.jpg?updated=1',
      gallery: [],
    } as any

    const { result } = renderHook(() =>
      useTravelHeroState(travel, false, onFirstImageLoad, false),
    )

    expect(result.current.heroSliderImages).toHaveLength(1)
    expect(result.current.heroSliderImages[0]?.url).toBe('https://example.com/cover.jpg?updated=1')
  })

  it('caps web hero height to 70 percent of the viewport', () => {
    const onFirstImageLoad = jest.fn()
    const travel = {
      id: 45,
      name: 'Capped web hero',
      gallery: [
        {
          id: 1,
          url: 'https://example.com/tall-gallery.jpg',
          width: 900,
          height: 1600,
        },
      ],
    } as any

    const { result } = renderHook(() =>
      useTravelHeroState(travel, false, onFirstImageLoad, false),
    )

    expect(result.current.heroHeight).toBeLessThanOrEqual(Math.round(1000 * 0.7))
  })

  it('marks web hero as loaded after the shortened fallback timeout when load event is delayed', () => {
    const originalUserAgent = window.navigator.userAgent
    Object.defineProperty(window.navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36',
      configurable: true,
    })

    const onFirstImageLoad = jest.fn()
    const travel = {
      id: 46,
      name: 'Fallback handoff travel',
      gallery: [
        {
          id: 1,
          url: 'https://example.com/fallback-gallery.jpg',
          width: 1200,
          height: 800,
        },
      ],
    } as any

    const { result } = renderHook(() =>
      useTravelHeroState(travel, false, onFirstImageLoad, false),
    )

    expect(result.current.webHeroLoaded).toBe(false)

    act(() => {
      jest.advanceTimersByTime(399)
    })

    expect(result.current.webHeroLoaded).toBe(false)

    act(() => {
      jest.advanceTimersByTime(1)
    })

    expect(result.current.webHeroLoaded).toBe(true)
    expect(onFirstImageLoad).toHaveBeenCalledTimes(1)

    Object.defineProperty(window.navigator, 'userAgent', {
      value: originalUserAgent,
      configurable: true,
    })
  })
})
