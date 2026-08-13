import { render, fireEvent } from '@testing-library/react-native'
import { Platform, StyleSheet } from 'react-native'

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
  const originalPlatform = Platform.OS

  beforeEach(() => {
    jest.clearAllMocks()
    ;(Platform as any).OS = originalPlatform
    ENV_KEYS.forEach((k) => {
      original[k] = process.env[k]
    })
    process.env.EXPO_PUBLIC_TRAVELPAYOUTS_MARKER = '999999'
    process.env.EXPO_PUBLIC_AFFILIATE_TOURS_TEMPLATE =
      'https://tp.media/r?marker=999999.{subid}&p=652&trs=423278&u={url}'
    process.env.EXPO_PUBLIC_AFFILIATE_HOTELS_TEMPLATE =
      'https://tp.media/r?marker=999999.{subid}&p=7038&trs=423278&u={url}'
  })

  afterEach(() => {
    ;(Platform as any).OS = originalPlatform
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

  // #1392: Android reports a narrower width for this label than it later paints,
  // so a subtitle ending near the edge of its box is sized as a single line and
  // painted as two — and the clipped tail is exactly the place name the offer link
  // promises. The width reserve moves the wrap decision off that edge; from the
  // browser it looks like styling nobody needs, hence this guard. Asserted as a
  // range, not as `'96%'`: the number is a measurement, and a different reserve is
  // still a correct fix — a reserve of none is not. The name says what is asserted
  // and no more: the reserve narrows the exposure, it does not close the class.
  it('keeps a width reserve on the offer subtitle (#1392)', () => {
    const { getByText } = render(
      <AffiliateOffers city="Минск" country="Беларусь" countryCode="BY" travelId={384} />,
    )
    // Full string on purpose: `/Авторские экскурсии/` also matches the place-less
    // copy, so it would stay green in the very regression this file is about.
    const subtitle = getByText('Авторские экскурсии и местные гиды — Минск')
    const maxWidth = StyleSheet.flatten(subtitle.props.style)?.maxWidth
    const reserve = Number.parseFloat(String(maxWidth ?? ''))
    expect(reserve).toBeGreaterThan(0)
    // A reserve in dp is just as valid a fix, so only the percentage form is
    // bounded by 100 — otherwise this would reject the alternative it invites.
    if (String(maxWidth).endsWith('%')) expect(reserve).toBeLessThan(100)
  })

  it('renders nothing when no template is configured', () => {
    delete process.env.EXPO_PUBLIC_AFFILIATE_TOURS_TEMPLATE
    delete process.env.EXPO_PUBLIC_AFFILIATE_HOTELS_TEMPLATE
    const { toJSON } = render(<AffiliateOffers city="Минск" travelId={384} />)
    expect(toJSON()).toBeNull()
  })

  it('tracks click and opens the interpolated affiliate URL', () => {
    const { getByText } = render(
      <AffiliateOffers city="Минск" country="Беларусь" countryCode="BY" travelId={384} />,
    )
    fireEvent.press(getByText('Подобрать жильё'))

    expect(queueAnalyticsEvent).toHaveBeenCalledWith(
      'Affiliate_Click',
      expect.objectContaining({ program: 'hotels', travelId: '384', city: 'Минск' }),
    )
    const openMock = openExternalUrlInNewTab as jest.Mock
    const calledUrl = openMock.mock.calls[0][0] as string
    expect(calledUrl).toContain('marker=999999.travel384')
    // hotels (Ostrovok) deep-links to the country page resolved from the ISO code
    expect(calledUrl).toContain(encodeURIComponent('https://ostrovok.ru/hotel/belarus/'))
  })

  it('tracks one impression from native layout without opening partner links', () => {
    ;(Platform as any).OS = 'android'

    const { getByTestId } = render(
      <AffiliateOffers city="Минск" country="Беларусь" countryCode="BY" travelId={384} />,
    )

    fireEvent(getByTestId('affiliate-offers'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 120, width: 320, height: 180 } },
    })
    fireEvent(getByTestId('affiliate-offers'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 120, width: 320, height: 180 } },
    })

    expect(queueAnalyticsEvent).toHaveBeenCalledTimes(1)
    expect(queueAnalyticsEvent).toHaveBeenCalledWith(
      'Affiliate_Impression',
      expect.objectContaining({
        travelId: '384',
        city: 'Минск',
        offers: 'tours,hotels',
      }),
    )
    expect(openExternalUrlInNewTab).not.toHaveBeenCalled()
  })
})
