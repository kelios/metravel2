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

  it('does not auto-allow the web hero slider without interaction', () => {
    const { result } = renderHook(() =>
      __testables.useWebHeroSliderUpgradeGate(true),
    )

    expect(result.current).toBe(false)

    act(() => {
      jest.advanceTimersByTime(5000)
    })

    expect(result.current).toBe(false)
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
      jest.advanceTimersByTime(5000)
    })

    expect(result.current).toBe(false)
  })
})
