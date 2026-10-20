import React from 'react'
import { Platform, StyleSheet } from 'react-native'
import { render, fireEvent, act } from '@testing-library/react-native'
import { sendAnalyticsEvent } from '@/utils/analytics'
import { openExternalUrl } from '@/utils/externalLinks'
import { markAppInstallHintDismissed } from '@/utils/appInstallHint'
import { APP_STORE_APP_URL, GOOGLE_PLAY_APP_URL } from '@/constants/appStore'
import { getMobileAppOpenUrl } from '@/utils/mobileAppHandoff'
import { getBottomChromeReserve, resetBottomChromeReserve, setBottomChromeReserve } from '@/utils/bottomChromeReserve'

jest.mock('expo-router', () => {
  const react = jest.requireActual<typeof import('react')>('react')
  const context = react.createContext({ pathname: '/', searchParams: {} })
  return {
    __MockRouterContext: context,
    usePathname: () => react.useContext(context).pathname,
    useGlobalSearchParams: () => react.useContext(context).searchParams,
  }
})
const MockRouterContext = require('expo-router').__MockRouterContext as React.Context<{
  pathname: string
  searchParams: Record<string, string>
}>
jest.mock('@/hooks/useResponsive', () => ({ useResponsive: () => ({ isMobile: true, width: 320 }) }))
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
  })
  afterEach(() => resetBottomChromeReserve())

  it.each([
    ['ios', APP_STORE_APP_URL], ['android', GOOGLE_PLAY_APP_URL],
  ] as const)('offers the %s store without claiming installation or closing Open', (platform, url) => {
    mockPhoneStorePlatform = platform
    const AppInstallBar = require('@/components/layout/AppInstallBar').default
    const { getByTestId } = render(<AppInstallBar />)
    expect(getByTestId('app-install-bar')).toBeTruthy()
    expect(mockedOpenExternalUrl).not.toHaveBeenCalled()
    fireEvent.press(getByTestId('app-install-bar-cta'))
    expect(mockedSendAnalyticsEvent).toHaveBeenCalledWith('app_download_click', { source: 'install_bar', platform })
    expect(mockedOpenExternalUrl).toHaveBeenCalledWith(url, expect.anything())
    expect(getByTestId('app-install-bar-open')).toBeTruthy()
    expect(markAppInstallHintDismissed).not.toHaveBeenCalled()
  })

  it.each(['ios', 'android'] as const)('opens the current page explicitly on %s without an install goal', (platform) => {
    mockPhoneStorePlatform = platform
    const AppInstallBar = require('@/components/layout/AppInstallBar').default
    const { getByTestId } = render(<AppInstallBar />)
    fireEvent.press(getByTestId('app-install-bar-open'))
    expect(mockedOpenExternalUrl).toHaveBeenCalledWith(getMobileAppOpenUrl(platform, window.location.href), {
      allowedProtocols: ['metravel:', 'intent:'],
    })
    expect(mockedSendAnalyticsEvent).not.toHaveBeenCalledWith('app_download_click', expect.anything())
  })

  it('stacks above existing consent and releases its measured reserve on dismissal', () => {
    setBottomChromeReserve('consent-banner', 240)
    const AppInstallBar = require('@/components/layout/AppInstallBar').default
    const { getByTestId, queryByTestId } = render(<AppInstallBar />)
    expect(StyleSheet.flatten(getByTestId('app-install-bar').props.style).bottom).toContain('240px')
    fireEvent(getByTestId('app-install-bar'), 'layout', { nativeEvent: { layout: { height: 136 } } })
    expect(getBottomChromeReserve()).toBe(240 + 8 + 136 + 8)
    fireEvent.press(getByTestId('app-install-bar-dismiss'))
    expect(markAppInstallHintDismissed).toHaveBeenCalled()
    expect(queryByTestId('app-install-bar')).toBeNull()
    expect(getBottomChromeReserve()).toBe(240)
  })

  it('refreshes the native banner destination after a query-only navigation', () => {
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
      const { rerender } = render(
        <MockRouterContext.Provider value={{ pathname: '/map', searchParams: { lat: '1' } }}>
          <AppInstallBar />
        </MockRouterContext.Provider>
      )
      expect(meta.content).toBe(`app-argument=${window.location.href}`)

      window.history.replaceState(null, '', '/map?lat=2')
      rerender(
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

  it('suspends the offer for the app landing and More overlay', () => {
    const AppInstallBar = require('@/components/layout/AppInstallBar').default
    const { queryByTestId, rerender } = render(
      <MockRouterContext.Provider value={{ pathname: '/', searchParams: {} }}>
        <AppInstallBar />
      </MockRouterContext.Provider>
    )
    act(() => window.dispatchEvent(new CustomEvent('metravel:footer-more', { detail: { open: true } })))
    expect(queryByTestId('app-install-bar')).toBeNull()
    expect(getBottomChromeReserve()).toBe(0)
    act(() => window.dispatchEvent(new CustomEvent('metravel:footer-more', { detail: { open: false } })))
    expect(queryByTestId('app-install-bar')).not.toBeNull()
    rerender(
      <MockRouterContext.Provider value={{ pathname: '/app', searchParams: {} }}>
        <AppInstallBar />
      </MockRouterContext.Provider>
    )
    expect(queryByTestId('app-install-bar')).toBeNull()
  })
})
