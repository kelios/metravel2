import React from 'react'
import { Platform } from 'react-native'
import { render, fireEvent } from '@testing-library/react-native'
import { sendAnalyticsEvent } from '@/utils/analytics'
import { openExternalUrl } from '@/utils/externalLinks'
import { APP_STORE_APP_URL, GOOGLE_PLAY_APP_URL } from '@/constants/appStore'

const mockPush = jest.fn()
let mockStorePlatform: 'ios' | 'android' | null = 'android'

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}))

jest.mock('@/hooks/useDeviceStorePlatform', () => ({
  useDeviceStorePlatform: () => mockStorePlatform,
}))

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

  it.each([
    ['ios', APP_STORE_APP_URL],
    ['android', GOOGLE_PLAY_APP_URL],
  ] as const)('opens the %s listing and reports both events from a phone', async (platform, url) => {
    mockStorePlatform = platform
    const HomeAppPromoSection = require('@/components/home/HomeAppPromoSection').default
    const { getByLabelText } = await render(<HomeAppPromoSection />)

    await fireEvent.press(getByLabelText('homeStatic:homePromo.app.a11y'))

    expect(mockedSendAnalyticsEvent).toHaveBeenCalledWith('HomeClick_InstallApp', { platform })
    expect(mockedSendAnalyticsEvent).toHaveBeenCalledWith('app_download_click', {
      source: 'home_promo',
      platform,
    })
    expect(mockedOpenExternalUrl).toHaveBeenCalledWith(url, expect.anything())
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('sends a desktop visitor to the /app landing with both stores', async () => {
    mockStorePlatform = null
    const HomeAppPromoSection = require('@/components/home/HomeAppPromoSection').default
    const { getByLabelText } = await render(<HomeAppPromoSection />)

    await fireEvent.press(getByLabelText('homeStatic:homePromo.app.a11y'))

    expect(mockedSendAnalyticsEvent).toHaveBeenCalledWith('HomeClick_InstallApp', { platform: 'landing' })
    expect(mockedSendAnalyticsEvent).not.toHaveBeenCalledWith('app_download_click', expect.anything())
    expect(mockedOpenExternalUrl).not.toHaveBeenCalled()
    expect(mockPush).toHaveBeenCalledWith('/app')
  })
})
