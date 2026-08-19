import React from 'react'
import { Platform } from 'react-native'
import { render, fireEvent } from '@testing-library/react-native'
import { sendAnalyticsEvent } from '@/utils/analytics'
import { openExternalUrl } from '@/utils/externalLinks'
import { GOOGLE_PLAY_APP_URL } from '@/constants/appStore'

jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => ({ width: 1200, isPhone: false, isLargePhone: false }),
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

describe('HomeAppPromoSection', () => {
  const originalPlatform = Platform.OS

  beforeAll(() => {
    // Секция рисуется только на web (`IS_WEB` вычисляется при загрузке модуля),
    // поэтому платформа выставляется до require компонента.
    ;(Platform as any).OS = 'web'
  })

  afterAll(() => {
    ;(Platform as any).OS = originalPlatform
  })

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('reports both the surface event and the app_download_click goal', () => {
    const HomeAppPromoSection = require('@/components/home/HomeAppPromoSection').default
    const { getByLabelText } = render(<HomeAppPromoSection />)

    fireEvent.press(getByLabelText(/skachat_prilozhenie_metravel_dlya_android/))

    expect(mockedSendAnalyticsEvent).toHaveBeenCalledWith('HomeClick_InstallApp', {
      platform: 'android',
    })
    expect(mockedSendAnalyticsEvent).toHaveBeenCalledWith('app_download_click', {
      source: 'home_promo',
      platform: 'android',
    })
    expect(mockedOpenExternalUrl).toHaveBeenCalledWith(GOOGLE_PLAY_APP_URL, expect.anything())
  })
})
