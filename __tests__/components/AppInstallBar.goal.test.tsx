import React from 'react'
import { Platform, StyleSheet } from 'react-native'
import { render, fireEvent, act } from '@testing-library/react-native'
import { sendAnalyticsEvent } from '@/utils/analytics'
import { openExternalUrl } from '@/utils/externalLinks'
import { markAppInstallHintDismissed } from '@/utils/appInstallHint'
import { APP_STORE_APP_URL, GOOGLE_PLAY_APP_URL } from '@/constants/appStore'
import { emitAppInstallSignal, resetAppInstallSignalForTests } from '@/utils/appInstallSignal'
import { writeConsent } from '@/utils/consent'
import { getBottomChromeReserve, getCriticalBottomChromeOwner, resetBottomChromeReserve, setBottomChromeReserve } from '@/utils/bottomChromeReserve'

let mockViewportWidth = 320
let mockIsConnected = false
let mockKeyboardInset = 0
const mockKeyboardListeners = new Set<() => void>()
const setKeyboardInset = async (inset: number) => act(() => {
  mockKeyboardInset = inset
  mockKeyboardListeners.forEach(listener => listener())
})

jest.mock('expo-router', () => {
  const react = jest.requireActual<typeof import('react')>('react')
  // #2907: the home first screen never shows the bar, so default to a content page.
  const context = react.createContext({ pathname: '/travels/route', searchParams: {} })
  return {
    __MockRouterContext: context,
    usePathname: () => react.useContext(context).pathname,
    useGlobalSearchParams: () => react.useContext(context).searchParams,
    useRouter: () => ({ push: jest.fn() }),
    Link: ({ children }: { children: React.ReactNode }) => children,
  }
})
const MockRouterContext = require('expo-router').__MockRouterContext as React.Context<{
  pathname: string
  searchParams: Record<string, string>
}>
jest.mock('@/hooks/useResponsive', () => ({ useResponsive: () => ({ isMobile: true, width: mockViewportWidth }) }))
jest.mock('@/hooks/useNetworkStatus', () => ({ useNetworkStatus: () => ({ isConnected: mockIsConnected }) }))
jest.mock('@/hooks/useWebKeyboardInset', () => ({
  useWebKeyboardInset: () => {
    const React = jest.requireActual<typeof import('react')>('react')
    return React.useSyncExternalStore(
      (listener: () => void) => { mockKeyboardListeners.add(listener); return () => { mockKeyboardListeners.delete(listener) } },
      () => mockKeyboardInset,
    )
  },
}))
const DECIDED_CONSENT = { necessary: true, analytics: false, date: '2026-10-26T00:00:00.000Z' }
let mockConsent: typeof DECIDED_CONSENT | null = DECIDED_CONSENT
jest.mock('@/utils/consent', () => ({ readConsent: () => mockConsent, writeConsent: jest.fn() }))
jest.mock('@/components/layout/bottomChromeInset', () => ({
  ...jest.requireActual('@/components/layout/bottomChromeInset'),
  useFloatingAnchorPx: () => 56,
}))
jest.mock('@/hooks/useSafeAreaInsetsSafe', () => ({
  useSafeAreaInsetsSafe: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}))
let mockPhoneStorePlatform: 'ios' | 'android' = 'android'
jest.mock('@/utils/appInstallHint', () => ({
  getPhoneStorePlatform: () => mockPhoneStorePlatform,
  isStandaloneDisplayMode: () => false,
  markAppInstallHintDismissed: jest.fn(),
  readAppInstallHintState: () => null,
  shouldOfferAppInstall: () => true,
}))
jest.mock('@/i18n/LocaleProvider', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
jest.mock('@/utils/analytics', () => ({
  sendAnalyticsEvent: jest.fn(() => Promise.resolve()),
  queueAnalyticsEvent: jest.fn(),
}))
jest.mock('@/utils/externalLinks', () => ({ openExternalUrl: jest.fn(() => Promise.resolve(true)) }))

const mockedSendAnalyticsEvent = jest.mocked(sendAnalyticsEvent)
const mockedOpenExternalUrl = jest.mocked(openExternalUrl)

describe('AppInstallBar', () => {
  const originalPlatform = Platform.OS
  beforeAll(() => { Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' }) })
  afterAll(() => { Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatform }) })
  beforeEach(() => {
    jest.clearAllMocks()
    resetBottomChromeReserve()
    mockViewportWidth = 320
    mockIsConnected = false
    mockKeyboardInset = 0
    mockConsent = DECIDED_CONSENT
    resetAppInstallSignalForTests()
    emitAppInstallSignal('quest_start')
  })
  afterEach(() => {
    resetBottomChromeReserve()
    jest.useRealTimers()
  })

  it.each([
    ['ios', APP_STORE_APP_URL], ['android', GOOGLE_PLAY_APP_URL],
  ] as const)('offers one %s store button with the signal context', async (platform, url) => {
    mockPhoneStorePlatform = platform
    const AppInstallBar = require('@/components/layout/AppInstallBar').default
    const { getByTestId, getByText, queryByTestId } = await render(<AppInstallBar />)
    expect(getByTestId('app-install-bar')).toBeTruthy()
    expect(getByText('sharedStatic:appHandoff.signal.quest_start.title')).toBeTruthy()
    expect(queryByTestId('app-install-bar-open')).toBeNull()
    expect(mockedSendAnalyticsEvent).toHaveBeenCalledWith('AppInstallBar_Shown', { platform, signal: 'quest_start' })
    expect(mockedOpenExternalUrl).not.toHaveBeenCalled()
    await fireEvent.press(getByTestId('app-install-bar-cta'))
    expect(mockedSendAnalyticsEvent).toHaveBeenCalledWith('AppInstallBar_Click', { platform, signal: 'quest_start' })
    expect(mockedSendAnalyticsEvent).toHaveBeenCalledWith('app_download_click', { source: 'install_bar', platform })
    expect(mockedOpenExternalUrl).toHaveBeenCalledWith(url, expect.anything())
    expect(markAppInstallHintDismissed).not.toHaveBeenCalled()
  })

  // The web runtime resolves only keys the Babel inliner compiled; a template
  // key would render «Перевод недоступен» on the one platform with this bar.
  it('keeps every signal copy key inlinable on web', () => {
    const fs = jest.requireActual<typeof import('node:fs')>('node:fs')
    const path = jest.requireActual<typeof import('node:path')>('node:path')
    const { transformSync } = jest.requireActual<typeof import('@babel/core')>('@babel/core')
    const filename = path.resolve(process.cwd(), 'components/layout/AppInstallBar.tsx')
    const result = transformSync(fs.readFileSync(filename, 'utf8'), {
      caller: { name: 'metro', platform: 'web' },
      filename,
    })
    expect(result?.code).not.toContain('sharedStatic:appHandoff.')
  })

  // #2907: shown on entry the bar got 2.7% CTR and 36% dismissals.
  it('waits for an intent signal and names it in the text and dismiss event', async () => {
    resetAppInstallSignalForTests()
    const AppInstallBar = require('@/components/layout/AppInstallBar').default
    const view = await render(<AppInstallBar />)
    expect(view.queryByTestId('app-install-bar')).toBeNull()
    expect(mockedSendAnalyticsEvent).not.toHaveBeenCalled()
    await act(() => emitAppInstallSignal('offline_save'))
    await act(() => emitAppInstallSignal('second_travel'))
    expect(view.getByText('sharedStatic:appHandoff.signal.offline_save.title')).toBeTruthy()
    await fireEvent.press(view.getByTestId('app-install-bar-dismiss'))
    expect(markAppInstallHintDismissed).toHaveBeenCalled()
    expect(mockedSendAnalyticsEvent).toHaveBeenCalledWith('AppInstallBar_Dismiss', { platform: 'android', signal: 'offline_save' })
  })

  it('stacks above existing consent and releases its measured reserve on dismissal', async () => {
    setBottomChromeReserve('consent-banner', 240)
    const AppInstallBar = require('@/components/layout/AppInstallBar').default
    const { getByTestId, queryByTestId } = await render(<AppInstallBar />)
    expect(StyleSheet.flatten(getByTestId('app-install-bar').props.style).bottom).toContain('240px')
    await fireEvent(getByTestId('app-install-bar'), 'layout', { nativeEvent: { layout: { height: 136 } } })
    expect(getBottomChromeReserve()).toBe(240 + 8 + 136 + 8)
    await fireEvent.press(getByTestId('app-install-bar-dismiss'))
    expect(markAppInstallHintDismissed).toHaveBeenCalled()
    expect(queryByTestId('app-install-bar')).toBeNull()
    expect(getBottomChromeReserve()).toBe(240)
  })

  it('ignores the network banner above it when positioning over consent', async () => {
    setBottomChromeReserve('consent-banner', 240)
    setBottomChromeReserve('network-status', 500)
    const AppInstallBar = require('@/components/layout/AppInstallBar').default
    const view = await render(<AppInstallBar />)
    expect(StyleSheet.flatten(view.getByTestId('app-install-bar').props.style).bottom).toContain('240px')
    await act(() => setBottomChromeReserve('network-status', 600))
    expect(StyleSheet.flatten(view.getByTestId('app-install-bar').props.style).bottom).toContain('240px')
    expect(getBottomChromeReserve('network-status')).toBe(240 + 8 + 112 + 8)
    await view.unmount()
    expect(getBottomChromeReserve('network-status')).toBe(240)
  })

  it('keeps initially offline navigation clear at 600×320, yields for More, then restores pending optional notices after exit', async () => {
    jest.useFakeTimers()
    mockViewportWidth = 600
    mockConsent = null
    const AppInstallBar = require('@/components/layout/AppInstallBar').default
    const ConsentBanner = require('@/components/layout/ConsentBanner').default
    const { NetworkStatus } = require('@/components/ui/NetworkStatus.web')
    const view = await render(<><ConsentBanner /><AppInstallBar /><NetworkStatus position="bottom" /></>)
    await fireEvent(view.getByTestId('network-status-banner'), 'layout', { nativeEvent: { layout: { height: 60 } } })
    const networkExtent = 56 + 8 + 60 + 8
    expect(getCriticalBottomChromeOwner()).toBe('network-status')
    expect(getBottomChromeReserve()).toBe(networkExtent)
    expect(320 - getBottomChromeReserve()).toBeGreaterThan(54)
    expect(view.queryByTestId('consent-banner')).toBeNull()
    expect(view.queryByTestId('app-install-bar')).toBeNull()
    expect(document.body.hasAttribute('data-consent-banner-open')).toBe(false)
    expect(StyleSheet.flatten(view.getByTestId('network-status-banner').props.style).bottom).toBe('calc(max(var(--mt-dock-h, 0px), var(--mt-footer-h, 0px)) + 8px)')
    await act(() => window.dispatchEvent(new CustomEvent('metravel:footer-more', { detail: { open: true } })))
    expect(getBottomChromeReserve()).toBe(0)
    expect(view.queryByTestId('network-status-banner')).toBeNull()
    expect(view.queryByTestId('app-install-bar')).toBeNull()
    expect(getCriticalBottomChromeOwner()).toBe('network-status')
    await act(() => window.dispatchEvent(new CustomEvent('metravel:footer-more', { detail: { open: false } })))
    expect(getBottomChromeReserve()).toBe(networkExtent)
    expect(view.queryByTestId('consent-banner')).toBeNull()
    expect(view.queryByTestId('app-install-bar')).toBeNull()
    mockIsConnected = true
    await view.rerender(<><ConsentBanner /><AppInstallBar /><NetworkStatus position="bottom" /></>)
    await act(async () => { jest.advanceTimersByTime(2000) })
    expect(getCriticalBottomChromeOwner()).toBe('network-status')
    expect(getBottomChromeReserve()).toBe(0)
    expect(view.queryByTestId('consent-banner')).toBeNull()
    expect(view.queryByTestId('app-install-bar')).toBeNull()
    await act(async () => { jest.advanceTimersByTime(300) })
    expect(getCriticalBottomChromeOwner()).toBeNull()
    expect(view.getByTestId('consent-banner')).toBeTruthy()
    // #2782: the undecided visitor gets only the consent banner on this page.
    expect(view.queryByTestId('app-install-bar')).toBeNull()
    await fireEvent(view.getByTestId('consent-banner'), 'layout', { nativeEvent: { layout: { height: 100 } } })
    expect(getBottomChromeReserve()).toBe(172)
    expect(writeConsent).not.toHaveBeenCalled()
    expect(markAppInstallHintDismissed).not.toHaveBeenCalled()
    await view.unmount()
    expect(getBottomChromeReserve()).toBe(0)
  })

  it('suspends physical notices for the existing keyboard overlap without releasing network priority', async () => {
    mockConsent = null
    const AppInstallBar = require('@/components/layout/AppInstallBar').default
    const ConsentBanner = require('@/components/layout/ConsentBanner').default
    const { NetworkStatus } = require('@/components/ui/NetworkStatus.web')
    const tree = <><ConsentBanner /><AppInstallBar /><NetworkStatus position="bottom" /></>
    const view = await render(tree)
    expect(getBottomChromeReserve()).toBe(132)
    await setKeyboardInset(240)
    expect(getBottomChromeReserve()).toBe(0)
    expect(getCriticalBottomChromeOwner()).toBe('network-status')
    expect(view.queryByTestId('network-status-banner')).toBeNull()
    expect(view.queryByTestId('consent-banner')).toBeNull()
    expect(view.queryByTestId('app-install-bar')).toBeNull()
    await setKeyboardInset(0)
    expect(getBottomChromeReserve()).toBe(132)
    await view.unmount()
    expect(getCriticalBottomChromeOwner()).toBeNull()
    mockIsConnected = true
    const online = await render(<><ConsentBanner /><AppInstallBar /></>)
    expect(online.getByTestId('consent-banner')).toBeTruthy()
    expect(online.queryByTestId('app-install-bar')).toBeNull()
    await setKeyboardInset(240)
    expect(getBottomChromeReserve()).toBe(0)
    expect(online.queryByTestId('consent-banner')).toBeNull()
    await setKeyboardInset(0)
    expect(online.getByTestId('consent-banner')).toBeTruthy()
    expect(online.queryByTestId('app-install-bar')).toBeNull()
    expect(writeConsent).not.toHaveBeenCalled()
    expect(markAppInstallHintDismissed).not.toHaveBeenCalled()
  })

  // #2782: two stacked bottom offers covered ~40% of a phone map on a first visit.
  it('waits for the consent answer and a later page before offering the app', async () => {
    mockConsent = null
    mockIsConnected = true
    const AppInstallBar = require('@/components/layout/AppInstallBar').default
    const ConsentBanner = require('@/components/layout/ConsentBanner').default
    const tree = (pathname: string) => (
      <MockRouterContext.Provider value={{ pathname, searchParams: {} }}>
        <ConsentBanner />
        <AppInstallBar />
      </MockRouterContext.Provider>
    )
    const view = await render(tree('/map'))
    expect(view.getByTestId('consent-banner')).toBeTruthy()
    expect(view.queryByTestId('app-install-bar')).toBeNull()
    mockConsent = DECIDED_CONSENT
    await view.rerender(tree('/map'))
    expect(view.queryByTestId('app-install-bar')).toBeNull()
    await view.rerender(tree('/places'))
    expect(view.getByTestId('app-install-bar')).toBeTruthy()
  })

  it('refreshes the native banner destination after a query-only navigation', async () => {
    const meta = document.createElement('meta')
    meta.name = 'apple-itunes-app'
    document.head.appendChild(meta)
    const initialUrl = window.location.href
    const handoffModule: typeof import('@/utils/mobileAppHandoff') = require('@/utils/mobileAppHandoff')
    const bannerContent = jest.spyOn(handoffModule, 'getSmartAppBannerContent')
      .mockImplementation((url) => `app-argument=${url}`)
    try {
      window.history.replaceState(null, '', '/map?lat=1')
      const AppInstallBar = require('@/components/layout/AppInstallBar').default
      const { rerender } = await render(
        <MockRouterContext.Provider value={{ pathname: '/map', searchParams: { lat: '1' } }}>
          <AppInstallBar />
        </MockRouterContext.Provider>
      )
      expect(meta.content).toBe(`app-argument=${window.location.href}`)

      window.history.replaceState(null, '', '/map?lat=2')
      await rerender(
        <MockRouterContext.Provider value={{ pathname: '/map', searchParams: { lat: '2' } }}>
          <AppInstallBar />
        </MockRouterContext.Provider>
      )

      expect(meta.content).toBe(`app-argument=${window.location.href}`)
      expect(meta.content).toContain('/map?lat=2')
    } finally {
      bannerContent.mockRestore()
      window.history.replaceState(null, '', initialUrl)
      meta.remove()
    }
  })

  it('suspends the offer for the home first screen, the app landing and More overlay', async () => {
    const AppInstallBar = require('@/components/layout/AppInstallBar').default
    const { queryByTestId, rerender } = await render(
      <MockRouterContext.Provider value={{ pathname: '/places', searchParams: {} }}>
        <AppInstallBar />
      </MockRouterContext.Provider>
    )
    await act(() => window.dispatchEvent(new CustomEvent('metravel:footer-more', { detail: { open: true } })))
    expect(queryByTestId('app-install-bar')).toBeNull()
    expect(getBottomChromeReserve()).toBe(0)
    await act(() => window.dispatchEvent(new CustomEvent('metravel:footer-more', { detail: { open: false } })))
    expect(queryByTestId('app-install-bar')).not.toBeNull()
    for (const pathname of ['/app', '/']) {
      await rerender(
        <MockRouterContext.Provider value={{ pathname, searchParams: {} }}>
          <AppInstallBar />
        </MockRouterContext.Provider>
      )
      expect(queryByTestId('app-install-bar')).toBeNull()
    }
  })
  it('never covers a quest page: its step keeps the task and the answer field clear (#3220)', async () => {
    const AppInstallBar = require('@/components/layout/AppInstallBar').default
    const { queryByTestId, rerender } = await render(
      <MockRouterContext.Provider value={{ pathname: '/quests', searchParams: {} }}>
        <AppInstallBar />
      </MockRouterContext.Provider>
    )
    expect(queryByTestId('app-install-bar')).not.toBeNull()
    for (const pathname of ['/quests/11/grodno-royal', '/en/quests/11/grodno-royal']) {
      await rerender(
        <MockRouterContext.Provider value={{ pathname, searchParams: {} }}>
          <AppInstallBar />
        </MockRouterContext.Provider>
      )
      expect(queryByTestId('app-install-bar')).toBeNull()
      expect(getBottomChromeReserve()).toBe(0)
    }
  })
})
