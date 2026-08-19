import React from 'react'
import { render, fireEvent } from '@testing-library/react-native'
import AppDownloadScreen from '@/app/app'
import { sendAnalyticsEvent } from '@/utils/analytics'
import { openExternalUrl } from '@/utils/externalLinks'
import { GOOGLE_PLAY_APP_URL } from '@/constants/appStore'

jest.mock('expo-router', () => ({
  useIsFocused: () => true,
}))

jest.mock('@/components/seo/LazyInstantSEO', () => () => null)
jest.mock('@/components/layout/CustomHeader', () => () => null)

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

describe('AppDownloadScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  // Лендинг `/app` — единственная поверхность установки, которая раньше не
  // отправляла ни одного события, поэтому цель Метрики «Скачали приложение»
  // (ID 599654242, идентификатор `app_download_click`) её не видела.
  it('reports the app_download_click goal before opening Google Play', () => {
    const { getByLabelText } = render(<AppDownloadScreen />)

    fireEvent.press(getByLabelText(/skachat_prilozhenie_metravel_iz_google_play/))

    expect(mockedSendAnalyticsEvent).toHaveBeenCalledWith('app_download_click', {
      source: 'app_page',
      platform: 'android',
    })
    expect(mockedOpenExternalUrl).toHaveBeenCalledWith(GOOGLE_PLAY_APP_URL, expect.anything())
  })
})
