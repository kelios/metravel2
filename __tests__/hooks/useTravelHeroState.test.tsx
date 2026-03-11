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

  it('auto-allows the web hero slider after a short fallback timeout', () => {
    const { result } = renderHook(() =>
      __testables.useWebHeroSliderUpgradeGate(true),
    )

    expect(result.current).toBe(false)

    act(() => {
      jest.advanceTimersByTime(__testables.HERO_SLIDER_AUTO_UPGRADE_MS - 1)
    })
    expect(result.current).toBe(false)

    act(() => {
      jest.advanceTimersByTime(1)
    })
    expect(result.current).toBe(true)
  })

  it('allows the web hero slider immediately on pointer interaction', () => {
    const { result } = renderHook(() =>
      __testables.useWebHeroSliderUpgradeGate(true),
    )

    expect(result.current).toBe(false)

    act(() => {
      window.dispatchEvent(new Event('pointerdown'))
    })

    expect(result.current).toBe(true)
  })

  it('stays disabled while the slider runtime is not ready', () => {
    const { result } = renderHook(() =>
      __testables.useWebHeroSliderUpgradeGate(false),
    )

    act(() => {
      jest.advanceTimersByTime(__testables.HERO_SLIDER_AUTO_UPGRADE_MS + 50)
    })

    expect(result.current).toBe(false)
  })
})
