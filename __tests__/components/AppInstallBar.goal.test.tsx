import React from 'react'
import { Platform } from 'react-native'
import { render, fireEvent, act } from '@testing-library/react-native'
import { sendAnalyticsEvent } from '@/utils/analytics'
import { openExternalUrl } from '@/utils/externalLinks'
import { markAppInstallHintConverted, markAppInstallHintDismissed } from '@/utils/appInstallHint'
import { APP_STORE_APP_URL, GOOGLE_PLAY_APP_URL } from '@/constants/appStore'

jest.mock('expo-router', () => ({
  usePathname: () => '/',
}))

jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => ({ isMobile: true, width: 400 }),
}))

jest.mock('@/hooks/useSafeAreaInsetsSafe', () => ({
  useSafeAreaInsetsSafe: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}))

jest.mock('@/hooks/useFooterOverlayOpen', () => ({
  useFooterOverlayOpen: () => false,
}))

let mockPhoneStorePlatform: 'ios' | 'android' = 'android'

jest.mock('@/utils/appInstallHint', () => ({
  getPhoneStorePlatform: () => mockPhoneStorePlatform,
  isStandaloneDisplayMode: () => false,
  markAppInstallHintConverted: jest.fn(),
  markAppInstallHintDismissed: jest.fn(),
  readAppInstallHintState: () => null,
  shouldOfferAppInstall: () => true,
}))

jest.mock('@/utils/consent', () => ({
  readConsent: () => ({ analytics: true }),
}))

jest.mock('@/utils/bottomChromeReserve', () => ({
  setBottomChromeReserve: jest.fn(),
  releaseBottomChromeReserve: jest.fn(),
}))

jest.mock('@/i18n', () => ({
  translate: (key: string) => key,
}))

jest.mock('@/utils/analytics', () => ({
  sendAnalyticsEvent: jest.fn(() => Promise.resolve()),
  queueAnalyticsEvent: jest.fn(),
}))

jest.mock('@/utils/externalLinks', () => ({
  openExternalUrl: jest.fn(() => Promise.resolve(true)),
}))

const mockedSendAnalyticsEvent = sendAnalyticsEvent as jest.MockedFunction<typeof sendAnalyticsEvent>
const mockedOpenExternalUrl = openExternalUrl as jest.MockedFunction<typeof openExternalUrl>
const mockedMarkConverted = markAppInstallHintConverted as jest.MockedFunction<
  typeof markAppInstallHintConverted
>
const mockedMarkDismissed = markAppInstallHintDismissed as jest.MockedFunction<
  typeof markAppInstallHintDismissed
>

describe('AppInstallBar', () => {
  const originalPlatform = Platform.OS

  beforeAll(() => {
    // Плашка живёт только на web: `IS_WEB` считается при загрузке модуля.
    ;(Platform as any).OS = 'web'
  })

  afterAll(() => {
    ;(Platform as any).OS = originalPlatform
  })

  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  // Третья поверхность установки: mobile web, показывается только узкому
  // вьюпорту, поэтому в тестах остальных поверхностей не видна.
  it.each([
    ['ios', APP_STORE_APP_URL],
    ['android', GOOGLE_PLAY_APP_URL],
  ] as const)('reports the app_download_click goal from the %s install bar', (platform, url) => {
    mockPhoneStorePlatform = platform
    const AppInstallBar = require('@/components/layout/AppInstallBar').default
    const { getByTestId } = render(<AppInstallBar />)

    // Плашка появляется не сразу: REVEAL_DELAY_MS = 12 c.
    act(() => {
      jest.advanceTimersByTime(12000)
    })

    fireEvent.press(getByTestId('app-install-bar-cta'))

    expect(mockedMarkConverted).toHaveBeenCalled()
    expect(mockedSendAnalyticsEvent).toHaveBeenCalledWith('AppInstallBar_Click', { platform })
    expect(mockedSendAnalyticsEvent).toHaveBeenCalledWith('app_download_click', {
      source: 'install_bar',
      platform,
    })
    expect(mockedOpenExternalUrl).toHaveBeenCalledWith(url, expect.anything())
  })

  it('reports the shown store and its dismissal without opening a listing', () => {
    mockPhoneStorePlatform = 'ios'
    const AppInstallBar = require('@/components/layout/AppInstallBar').default
    const { getByTestId, queryByTestId } = render(<AppInstallBar />)

    expect(queryByTestId('app-install-bar')).toBeNull()
    act(() => {
      jest.advanceTimersByTime(12000)
    })
    expect(mockedSendAnalyticsEvent).toHaveBeenCalledWith('AppInstallBar_Shown', { platform: 'ios' })

    fireEvent.press(getByTestId('app-install-bar-dismiss'))

    expect(mockedMarkDismissed).toHaveBeenCalled()
    expect(mockedSendAnalyticsEvent).toHaveBeenCalledWith('AppInstallBar_Dismiss', { platform: 'ios' })
    expect(mockedOpenExternalUrl).not.toHaveBeenCalled()
    expect(queryByTestId('app-install-bar')).toBeNull()
  })
})
