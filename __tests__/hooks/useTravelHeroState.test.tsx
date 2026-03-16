import { act, renderHook } from '@testing-library/react-native'
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

  beforeEach(() => {
    Platform.OS = 'web' as any
    jest.useFakeTimers()
  })

  afterEach(() => {
    Platform.OS = originalPlatformOS as any
    jest.useRealTimers()
  })

  it('starts web hero slider with the cover image to keep hero handoff stable', () => {
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

    expect(result.current.firstImg?.url).toBe('https://example.com/cover.jpg?updated=1')
    expect(result.current.galleryImages[0]?.url).toBe('https://example.com/gallery-1.jpg?size=sm')
    expect(result.current.heroSliderImages[0]?.url).toBe('https://example.com/cover.jpg?updated=1')
    expect(result.current.heroSliderImages[1]?.url).toBe('https://example.com/gallery-1.jpg?size=sm')
  })

  it('deduplicates the cover from slider images when gallery already starts with the same media', () => {
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

    expect(result.current.heroSliderImages).toHaveLength(2)
    expect(result.current.heroSliderImages[0]?.url).toBe('https://example.com/cover.jpg?updated=1')
    expect(result.current.heroSliderImages[1]?.url).toBe('https://example.com/gallery-2.jpg')
  })
})
