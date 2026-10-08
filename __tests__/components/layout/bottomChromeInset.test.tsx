import React from 'react'
import { Platform } from 'react-native'
import { act, renderHook, waitFor } from '@testing-library/react-native'

import { BOTTOM_DOCK_HEIGHT } from '@/components/layout/bottomDockModel'
import {
  BottomChromeInsetProvider,
  useBottomChromeInset,
  useDockReservePx,
  useScrollBottomPadding,
  useNativeBottomChromeOcclusion,
  WEB_BOTTOM_CHROME_INSET,
  webBottomChromeInset,
  webDockReserve,
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
    expect(renderHook(() => useDockReservePx()).result.current).toBe(0)
    expect(webDockReserve(16)).toBe('calc(var(--mt-dock-h, 0px) + 16px)')
  })

  it('keeps owner-scoped native occlusion separate from dock and scroll reserves', () => {
    Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true })
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <BottomChromeInsetProvider measuredHeight={89}>{children}</BottomChromeInsetProvider>
    )
    const { result } = renderHook(() => ({
      chrome: useNativeBottomChromeOcclusion(),
      dock: useDockReservePx(),
      padding: useScrollBottomPadding(16),
    }), { wrapper })
    act(() => {
      result.current.chrome.register('first', 1883)
      result.current.chrome.register('second', 1800)
    })
    expect(result.current).toMatchObject({ chrome: { top: 1800 }, dock: 89, padding: 105 })
    act(() => result.current.chrome.release('second'))
    expect(result.current.chrome.top).toBe(1883)
    act(() => result.current.chrome.register('first', 1200))
    expect(result.current.chrome.top).toBe(1200)
    act(() => result.current.chrome.register('first', Number.NaN))
    expect(result.current.chrome.top).toBe(1200)
    act(() => result.current.chrome.release('first'))
    expect(result.current.chrome.top).toBeNull()
  })

  it('isolates native owners by provider and ignores registrations on web', () => {
    Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true })
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <BottomChromeInsetProvider measuredHeight={0}>{children}</BottomChromeInsetProvider>
    )
    const first = renderHook(useNativeBottomChromeOcclusion, { wrapper })
    const second = renderHook(useNativeBottomChromeOcclusion, { wrapper })
    act(() => first.result.current.register('same-owner', 200))
    expect(first.result.current.top).toBe(200)
    expect(second.result.current.top).toBeNull()
    Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true })
    act(() => second.result.current.register('web-owner', 100))
    expect(second.result.current.top).toBeNull()
  })

  it('shares CSS dock measurement across callers, responds to dock markers/resize, and cleans up', async () => {
    Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true })
    let browserHeight = 56
    const rect = jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      return { height: this.hasAttribute('data-mt-dock-measure') ? browserHeight : 0 } as DOMRect
    })
    const removeListener = jest.spyOn(window, 'removeEventListener')
    // This jsdom CSS parser rejects var() in dimensions; inspect the browser
    // assignment while the rectangle stub exercises measurement and updates.
    const heightAssignment = jest.spyOn(CSSStyleDeclaration.prototype, 'height', 'set')
    const marker = document.createElement('div')
    document.body.appendChild(marker)
    const first = renderHook(() => useDockReservePx())
    const second = renderHook(() => useDockReservePx())
    try {
      expect(first.result.current).toBe(56)
      expect(second.result.current).toBe(56)
      const probes = document.querySelectorAll<HTMLElement>('[data-mt-dock-measure]')
      expect(probes).toHaveLength(1)
      expect(heightAssignment).toHaveBeenCalledWith('var(--mt-dock-h, 0px)')
      browserHeight = 0
      await act(async () => marker.setAttribute('data-mt-dock', 'off'))
      await waitFor(() => expect(first.result.current).toBe(0))
      expect(second.result.current).toBe(0)
      browserHeight = 90 // Browser resolved dock + safe-area, with no duplicated JS rule.
      await act(async () => marker.removeAttribute('data-mt-dock'))
      await waitFor(() => expect(first.result.current).toBe(90))
      browserHeight = 0 // Desktop media query.
      act(() => window.dispatchEvent(new Event('resize')))
      expect(first.result.current).toBe(0)
      first.unmount()
      expect(document.querySelectorAll('[data-mt-dock-measure]')).toHaveLength(1)
      second.unmount()
      expect(document.querySelectorAll('[data-mt-dock-measure]')).toHaveLength(0)
      expect(removeListener).toHaveBeenCalledWith('resize', expect.any(Function))
    } finally {
      first.unmount()
      second.unmount()
      marker.remove()
      rect.mockRestore()
      removeListener.mockRestore()
      heightAssignment.mockRestore()
    }
  })
})
