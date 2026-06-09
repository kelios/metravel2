import React from 'react'
import { render, fireEvent } from '@testing-library/react-native'

import AffiliateOffers from '@/components/affiliate/AffiliateOffers'
import { openExternalUrlInNewTab } from '@/utils/externalLinks'
import { queueAnalyticsEvent } from '@/utils/analytics'

jest.mock('@/utils/externalLinks', () => ({
  openExternalUrlInNewTab: jest.fn(),
}))
jest.mock('@/utils/analytics', () => ({
  queueAnalyticsEvent: jest.fn(),
}))

const ENV_KEYS = [
  'EXPO_PUBLIC_TRAVELPAYOUTS_MARKER',
  'EXPO_PUBLIC_AFFILIATE_TOURS_TEMPLATE',
  'EXPO_PUBLIC_AFFILIATE_HOTELS_TEMPLATE',
] as const

describe('AffiliateOffers', () => {
  const original: Record<string, string | undefined> = {}

  beforeEach(() => {
    jest.clearAllMocks()
    ENV_KEYS.forEach((k) => {
      original[k] = process.env[k]
    })
    process.env.EXPO_PUBLIC_TRAVELPAYOUTS_MARKER = '999999'
    process.env.EXPO_PUBLIC_AFFILIATE_TOURS_TEMPLATE =
      'https://tp.media/r?marker=999999.{subid}&u=https%3A%2F%2Fexample.com%2Ftours%3Fq%3D{query}'
    process.env.EXPO_PUBLIC_AFFILIATE_HOTELS_TEMPLATE =
      'https://tp.media/r?marker=999999.{subid}&u=https%3A%2F%2Fexample.com%2Fhotels%3Fq%3D{query}'
  })

  afterEach(() => {
    ENV_KEYS.forEach((k) => {
      if (original[k] === undefined) delete process.env[k]
      else process.env[k] = original[k]
    })
  })

  it('renders both offers with localized titles', () => {
    const { getByText } = render(<AffiliateOffers city="Минск" travelId={384} />)
    expect(getByText('Экскурсии и гиды')).toBeTruthy()
    expect(getByText('Где остановиться')).toBeTruthy()
  })

  it('renders nothing when no template is configured', () => {
    delete process.env.EXPO_PUBLIC_AFFILIATE_TOURS_TEMPLATE
    delete process.env.EXPO_PUBLIC_AFFILIATE_HOTELS_TEMPLATE
    const { toJSON } = render(<AffiliateOffers city="Минск" travelId={384} />)
    expect(toJSON()).toBeNull()
  })

  it('tracks click and opens the interpolated affiliate URL', () => {
    const { getByText } = render(<AffiliateOffers city="Минск" travelId={384} />)
    fireEvent.press(getByText('Посмотреть экскурсии'))

    expect(queueAnalyticsEvent).toHaveBeenCalledWith(
      'Affiliate_Click',
      expect.objectContaining({ program: 'tours', travelId: '384', city: 'Минск' }),
    )
    const openMock = openExternalUrlInNewTab as jest.Mock
    const calledUrl = openMock.mock.calls[0][0] as string
    expect(calledUrl).toContain('marker=999999.travel384')
    // tours (Tripster) transliterates the Cyrillic city to a Latin slug
    expect(calledUrl).toContain('q%3Dminsk')
  })
})
