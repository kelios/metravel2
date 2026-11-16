/** @jest-environment jsdom */
import type { Root } from 'react-dom/client'

let createElement: typeof import('react').createElement
let act: typeof import('react').act
let createRoot: typeof import('react-dom/client').createRoot
let ConsentBanner: typeof import('@/components/layout/ConsentBanner').default
let useResponsive: typeof import('@/hooks/useResponsive').useResponsive
const hydrationTransitions: Array<() => void> = []

beforeAll(() => {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1280, writable: true })
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800, writable: true })
  jest.resetModules()
  jest.doMock('react', () => ({
    ...jest.requireActual('react'),
    // The banner may become visible before this low-priority hydration update.
    startTransition: (callback: () => void) => { hydrationTransitions.push(callback) },
  }))
  jest.doMock('react-native', () => jest.requireActual('react-native-web'))
  jest.doMock('expo-router', () => ({ usePathname: () => '/' }))
  jest.doMock('@/hooks/useTheme', () => ({ useThemedColors: () => ({ surface: '#fff', borderLight: '#ddd', textMuted: '#444', border: '#ccc', primaryText: '#123', primary: '#06c' }) }))
  jest.doMock('@/hooks/useFooterOverlayOpen', () => ({ useFooterOverlayOpen: () => false }))
  jest.doMock('@/hooks/useWebKeyboardInset', () => ({ useWebKeyboardInset: () => 0 }))
  jest.doMock('@/components/layout/bottomChromeInset', () => ({ useFloatingAnchorPx: () => 0, webFloatingAnchor: () => 0, asBottomDimension: (value: number) => value }))
  jest.doMock('@/utils/bottomChromeReserve', () => ({ subscribeBottomChromeReserve: () => () => {}, getCriticalBottomChromeOwner: () => null, releaseBottomChromeReserve: () => {}, setBottomChromeReserve: () => {} }))
  jest.doMock('@/utils/consent', () => ({ readConsent: () => null, writeConsent: jest.fn() }))
  jest.doMock('@/utils/analyticsContext', () => ({ clearAnalyticsIdentity: jest.fn() }))
  jest.doMock('@/utils/questFunnelAnalytics', () => ({ clearQuestFunnelRuns: jest.fn() }))
  jest.doMock('@/i18n', () => ({ translate: (key: string) => key }))
  jest.doMock('@/components/ui/Button', () => ({ __esModule: true, default: ({ label }: { label: string }) => createElement('button', null, label) }))
  jest.doMock('@/components/ui/LinkPressable', () => ({ __esModule: true, default: ({ children }: { children: (state: { pressed: boolean }) => unknown }) => children({ pressed: false }) }))
  ;({ createElement, act } = require('react'))
  ;({ createRoot } = require('react-dom/client'))
  ;({ useResponsive } = require('@/hooks/useResponsive'))
  ConsentBanner = require('@/components/layout/ConsentBanner').default
})

function LiveViewportOwner() {
  const { width } = useResponsive({ clientOnly: true })
  return createElement('output', { 'data-testid': 'live-viewport' }, String(width))
}

async function firstVisibleLayout(width: number) {
  window.innerWidth = width
  window.dispatchEvent(new Event('resize'))
  const container = document.createElement('div')
  document.body.append(container)
  let root: Root | null = null
  const frames: Array<{ direction: string; maxWidth: string }> = []
  const observer = new MutationObserver(() => {
    const banner = container.querySelector<HTMLElement>('[data-testid="consent-banner"]')
    if (!banner || frames.length) return
    const style = getComputedStyle(banner)
    frames.push({ direction: style.flexDirection, maxWidth: style.maxWidth })
  })
  observer.observe(container, { childList: true, subtree: true, attributes: true })
  try {
    // The application viewport store is already live when deferred chrome mounts.
    await act(async () => { root = createRoot(container); root.render(createElement(LiveViewportOwner)) })
    expect(container.querySelector('[data-testid="live-viewport"]')?.textContent).toBe(String(width))
    hydrationTransitions.length = 0
    await act(async () => {
      root?.render(createElement('div', null, createElement(LiveViewportOwner), createElement(ConsentBanner)))
      await Promise.resolve()
    })
    expect(container.querySelector('[data-testid="consent-banner"]')).not.toBeNull()
    expect(frames).toHaveLength(1)
    return frames[0]
  } finally {
    observer.disconnect()
    await act(async () => {
      for (const callback of hydrationTransitions.splice(0)) callback()
      root?.unmount()
    })
    container.remove()
  }
}

it('shows the desktop row on its first visible frame while hydration transitions are pending', async () => {
  expect(await firstVisibleLayout(1280)).toEqual({ direction: 'row', maxWidth: '820px' })
})

it('keeps the healthy320 mobile column on its first visible frame', async () => {
  expect(await firstVisibleLayout(320)).toEqual({ direction: 'column', maxWidth: '520px' })
})
