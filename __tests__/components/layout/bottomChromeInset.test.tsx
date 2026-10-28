import React from 'react'
import { Platform } from 'react-native'
import { act, renderHook, waitFor } from '@testing-library/react-native'

import { BOTTOM_DOCK_HEIGHT } from '@/components/layout/bottomDockModel'
import {
  BottomChromeInsetProvider,
  useBottomChromeInset,
  useDockReservePx,
  useBottomChromeReservePx,
  useScrollBottomPadding,
  useNativeBottomChromeOcclusion,
  WEB_BOTTOM_CHROME_INSET,
  webBottomChromeInset,
  webDockReserve,
  webFloatingAnchor,
  useWebFooterHeightPublisher,
} from '@/components/layout/bottomChromeInset'
import { releaseBottomChromeReserve, resetBottomChromeReserve, setBottomChromeReserve } from '@/utils/bottomChromeReserve'

let mockInsets = { top: 0, bottom: 0, left: 0, right: 0 }
jest.mock('@/hooks/useSafeAreaInsetsSafe', () => ({
  useSafeAreaInsetsSafe: () => mockInsets,
}))

describe('bottomChromeInset', () => {
  const originalOS = Platform.OS

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { value: originalOS, configurable: true })
    mockInsets = { top: 0, bottom: 0, left: 0, right: 0 }
    resetBottomChromeReserve()
  })

  it('на native до замера отдаёт фолбэк высоты дока и safe-area', async () => {
    Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true })
    mockInsets = { top: 0, bottom: 34, left: 0, right: 0 }
    const { result } = await renderHook(() => useBottomChromeInset())
    expect(result.current.bottom).toBe(BOTTOM_DOCK_HEIGHT + 34)
  })

  it('на native после замера отдаёт измеренную высоту, а 0 означает скрытый док', async () => {
    Object.defineProperty(Platform, 'OS', { value: 'android', configurable: true })
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <BottomChromeInsetProvider measuredHeight={90}>{children}</BottomChromeInsetProvider>
    )
    const measured = await renderHook(() => useScrollBottomPadding(16), { wrapper })
    expect(measured.result.current).toBe(106)

    const hiddenWrapper = ({ children }: { children: React.ReactNode }) => (
      <BottomChromeInsetProvider measuredHeight={0}>{children}</BottomChromeInsetProvider>
    )
    const hidden = await renderHook(() => useDockReservePx(), { wrapper: hiddenWrapper })
    expect(hidden.result.current).toBe(0)
  })

  it('на web резерв — CSS max() дока и плашки, extra добавляется внутрь calc', async () => {
    Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true })
    const { result } = await renderHook(() => useBottomChromeInset())
    expect(result.current.bottom).toBe(WEB_BOTTOM_CHROME_INSET)
    expect(webBottomChromeInset(24)).toBe(
      'calc(max(var(--mt-dock-h, 0px), var(--mt-consent-h, 0px)) + 24px)',
    )
    expect((await renderHook(() => useDockReservePx())).result.current).toBe(0)
    expect(webDockReserve(16)).toBe('calc(var(--mt-dock-h, 0px) + 16px)')
  })

  it('anchors floating notices above the dock or the desktop footer, never into scroll reserves (#2788)', () => {
    expect(webFloatingAnchor(8)).toBe('calc(max(var(--mt-dock-h, 0px), var(--mt-footer-h, 0px)) + 8px)')
    expect(webFloatingAnchor(8, 120)).toBe('calc(max(var(--mt-dock-h, 0px), var(--mt-footer-h, 0px), 120px) + 8px)')
    expect(webDockReserve(8)).not.toContain('--mt-footer-h')
    expect(WEB_BOTTOM_CHROME_INSET).not.toContain('--mt-footer-h')
  })

  it('publishes the rendered desktop footer height and clears it when hidden or unmounted (#2788)', async () => {
    Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true })
    const observers: Array<() => void> = []
    const originalObserver = (global as any).ResizeObserver
    ;(global as any).ResizeObserver = class {
      constructor(callback: () => void) { observers.push(callback) }
      observe() {}
      disconnect() {}
    }
    const node = document.createElement('div')
    let height = 52
    jest.spyOn(node, 'getBoundingClientRect').mockImplementation(() => ({ height } as DOMRect))
    const root = document.documentElement
    try {
      const hook = await renderHook(() => useWebFooterHeightPublisher({ current: node }))
      expect(root.style.getPropertyValue('--mt-footer-h')).toBe('52px')
      height = 102 // Narrower desktop wraps the footer to two rows.
      await act(() => observers.forEach((notify) => notify()))
      expect(root.style.getPropertyValue('--mt-footer-h')).toBe('102px')
      height = 0 // Below the breakpoint the shell is display:none.
      await act(() => observers.forEach((notify) => notify()))
      expect(root.style.getPropertyValue('--mt-footer-h')).toBe('')
      height = 52
      await act(() => observers.forEach((notify) => notify()))
      await hook.unmount()
      expect(root.style.getPropertyValue('--mt-footer-h')).toBe('')
    } finally {
      ;(global as any).ResizeObserver = originalObserver
      root.style.removeProperty('--mt-footer-h')
    }
  })

  it('includes measured dock and named web notices for numeric reveal consumers, releasing each independently', async () => {
    Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true })
    const rect = jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      return { height: this.hasAttribute('data-mt-dock-measure') ? 56 : 0 } as DOMRect
    })
    const hook = await renderHook(useBottomChromeReservePx)
    try {
      expect(hook.result.current).toBe(56)
      await act(() => setBottomChromeReserve('consent-banner', 180))
      expect(hook.result.current).toBe(180)
      await act(() => setBottomChromeReserve('network-status', 280))
      expect(hook.result.current).toBe(280)
      await act(() => releaseBottomChromeReserve('network-status'))
      expect(hook.result.current).toBe(180)
      await act(() => releaseBottomChromeReserve('consent-banner'))
      expect(hook.result.current).toBe(56)
    } finally {
      await hook.unmount()
      rect.mockRestore()
    }
  })

  it.each(['ios', 'android'] as const)('keeps %s numeric reveal at the measured dock without web reserves', async os => {
    Object.defineProperty(Platform, 'OS', { value: os, configurable: true })
    setBottomChromeReserve('network-status', 500)
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <BottomChromeInsetProvider measuredHeight={89}>{children}</BottomChromeInsetProvider>
    )
    const hook = await renderHook(useBottomChromeReservePx, { wrapper })
    expect(hook.result.current).toBe(89)
    await act(() => setBottomChromeReserve('network-status', 600))
    expect(hook.result.current).toBe(89)
  })

  it('keeps owner-scoped native occlusion separate from dock and scroll reserves', async () => {
    Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true })
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <BottomChromeInsetProvider measuredHeight={89}>{children}</BottomChromeInsetProvider>
    )
    const { result } = await renderHook(() => ({
      chrome: useNativeBottomChromeOcclusion(),
      dock: useDockReservePx(),
      padding: useScrollBottomPadding(16),
    }), { wrapper })
    await act(() => {
      result.current.chrome.register('first', 1883)
      result.current.chrome.register('second', 1800)
    })
    expect(result.current).toMatchObject({ chrome: { top: 1800 }, dock: 89, padding: 105 })
    await act(() => result.current.chrome.release('second'))
    expect(result.current.chrome.top).toBe(1883)
    await act(() => result.current.chrome.register('first', 1200))
    expect(result.current.chrome.top).toBe(1200)
    await act(() => result.current.chrome.register('first', Number.NaN))
    expect(result.current.chrome.top).toBe(1200)
    await act(() => result.current.chrome.release('first'))
    expect(result.current.chrome.top).toBeNull()
  })

  it('isolates native owners by provider and ignores registrations on web', async () => {
    Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true })
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <BottomChromeInsetProvider measuredHeight={0}>{children}</BottomChromeInsetProvider>
    )
    const first = await renderHook(useNativeBottomChromeOcclusion, { wrapper })
    const second = await renderHook(useNativeBottomChromeOcclusion, { wrapper })
    await act(() => first.result.current.register('same-owner', 200))
    expect(first.result.current.top).toBe(200)
    expect(second.result.current.top).toBeNull()
    Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true })
    await act(() => second.result.current.register('web-owner', 100))
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
    const first = await renderHook(() => useDockReservePx())
    const second = await renderHook(() => useDockReservePx())
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
      await act(() => window.dispatchEvent(new Event('resize')))
      expect(first.result.current).toBe(0)
      await first.unmount()
      expect(document.querySelectorAll('[data-mt-dock-measure]')).toHaveLength(1)
      await second.unmount()
      expect(document.querySelectorAll('[data-mt-dock-measure]')).toHaveLength(0)
      expect(removeListener).toHaveBeenCalledWith('resize', expect.any(Function))
    } finally {
      await first.unmount()
      await second.unmount()
      marker.remove()
      rect.mockRestore()
      removeListener.mockRestore()
      heightAssignment.mockRestore()
    }
  })
})
