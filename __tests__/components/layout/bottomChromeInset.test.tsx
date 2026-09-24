import React from 'react'
import { Platform } from 'react-native'
import { renderHook } from '@testing-library/react-native'

import { BOTTOM_DOCK_HEIGHT } from '@/components/layout/bottomDockModel'
import {
  BottomChromeInsetProvider,
  useBottomChromeInset,
  useDockReservePx,
  useScrollBottomPadding,
  WEB_BOTTOM_CHROME_INSET,
  webBottomChromeInset,
} from '@/components/layout/bottomChromeInset'

let mockInsets = { top: 0, bottom: 0, left: 0, right: 0 }
jest.mock('@/hooks/useSafeAreaInsetsSafe', () => ({
  useSafeAreaInsetsSafe: () => mockInsets,
}))

describe('bottomChromeInset', () => {
  const originalOS = Platform.OS

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { value: originalOS, configurable: true })
    mockInsets = { top: 0, bottom: 0, left: 0, right: 0 }
  })

  it('на native до замера отдаёт фолбэк высоты дока и safe-area', () => {
    Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true })
    mockInsets = { top: 0, bottom: 34, left: 0, right: 0 }
    const { result } = renderHook(() => useBottomChromeInset())
    expect(result.current.bottom).toBe(BOTTOM_DOCK_HEIGHT + 34)
  })

  it('на native после замера отдаёт измеренную высоту, а 0 означает скрытый док', () => {
    Object.defineProperty(Platform, 'OS', { value: 'android', configurable: true })
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <BottomChromeInsetProvider measuredHeight={90}>{children}</BottomChromeInsetProvider>
    )
    const measured = renderHook(() => useScrollBottomPadding(16), { wrapper })
    expect(measured.result.current).toBe(106)

    const hiddenWrapper = ({ children }: { children: React.ReactNode }) => (
      <BottomChromeInsetProvider measuredHeight={0}>{children}</BottomChromeInsetProvider>
    )
    const hidden = renderHook(() => useDockReservePx(), { wrapper: hiddenWrapper })
    expect(hidden.result.current).toBe(0)
  })

  it('на web резерв — CSS max() дока и плашки, extra добавляется внутрь calc', () => {
    Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true })
    const { result } = renderHook(() => useBottomChromeInset())
    expect(result.current.bottom).toBe(WEB_BOTTOM_CHROME_INSET)
    expect(webBottomChromeInset(24)).toBe(
      'calc(max(var(--mt-dock-h, 0px), var(--mt-consent-h, 0px)) + 24px)',
    )
    expect(renderHook(() => useDockReservePx()).result.current).toBe(BOTTOM_DOCK_HEIGHT)
  })
})
