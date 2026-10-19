import React from 'react'
import { Platform } from 'react-native'
import { render, fireEvent } from '@testing-library/react-native'
import AppDownloadScreen from '@/app/app'
import { sendAnalyticsEvent } from '@/utils/analytics'
import { openExternalUrl } from '@/utils/externalLinks'
import { APP_STORE_APP_URL, GOOGLE_PLAY_APP_URL } from '@/constants/appStore'

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
  const originalOS = Platform.OS

  beforeAll(() => {
    // Лендинг проверяется как web-страница: на native кнопка только одна, своя.
    ;(Platform as { OS: string }).OS = 'web'
  })

  afterAll(() => {
    ;(Platform as { OS: string }).OS = originalOS
  })

  beforeEach(() => {
    jest.clearAllMocks()
  })

  // Лендинг `/app` — единственная поверхность установки, которая раньше не
  // отправляла ни одного события, поэтому цель Метрики «Скачали приложение»
  // (ID 599654242, идентификатор `app_download_click`) её не видела.
  it.each([
    ['ios', APP_STORE_APP_URL],
    ['android', GOOGLE_PLAY_APP_URL],
  ] as const)('reports the app_download_click goal before opening the %s listing', (platform, url) => {
    const { getByTestId } = render(<AppDownloadScreen />)

    fireEvent.press(getByTestId(`app-page-store-buttons-${platform}`))

    expect(mockedSendAnalyticsEvent).toHaveBeenCalledWith('app_download_click', {
      source: 'app_page',
      platform,
    })
    expect(mockedOpenExternalUrl).toHaveBeenCalledWith(url, expect.anything())
  })
})
