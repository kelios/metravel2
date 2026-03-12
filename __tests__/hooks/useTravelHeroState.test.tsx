import { act, renderHook } from '@testing-library/react-native'
import { Platform } from 'react-native'

import { __testables } from '@/hooks/useTravelHeroState'

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
