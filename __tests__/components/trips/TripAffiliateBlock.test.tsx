import React from 'react'
import { fireEvent, render } from '@testing-library/react-native'

import TripAffiliateBlock from '@/components/trips/planning/TripAffiliateBlock'
import type { PlannedTrip, RoutePoint } from '@/api/plannedTrips'
import { openExternalUrlInNewTab } from '@/utils/externalLinks'
import { trackTripAffiliateClick } from '@/utils/tripAnalytics'

jest.mock('@/utils/externalLinks', () => ({
  openExternalUrlInNewTab: jest.fn(),
}))
jest.mock('@/utils/analytics', () => ({
  queueAnalyticsEvent: jest.fn(),
}))
jest.mock('@/utils/tripAnalytics', () => ({
  trackTripAffiliateClick: jest.fn(),
}))

const ENV_KEYS = [
  'EXPO_PUBLIC_TRAVELPAYOUTS_MARKER',
  'EXPO_PUBLIC_AFFILIATE_TOURS_TEMPLATE',
  'EXPO_PUBLIC_AFFILIATE_HOTELS_TEMPLATE',
] as const

// `coordinates` у RoutePoint — [lng, lat].
const point = (name: string, coordinates: [number, number] | null): RoutePoint =>
  ({ id: name, type: 'place', name, description: null, coordinates, placeId: null })

const MINSK: [number, number] = [27.5615, 53.9023]
const PRAGUE: [number, number] = [14.4378, 50.0755]

const makeTrip = (route: RoutePoint[], region = ''): PlannedTrip =>
  ({ id: 31, region, route, startPoint: null } as unknown as PlannedTrip)

const openedUrl = () => (openExternalUrlInNewTab as jest.Mock).mock.calls[0][0] as string

describe('TripAffiliateBlock', () => {
  const original: Record<string, string | undefined> = {}

  beforeEach(() => {
    jest.clearAllMocks()
    ENV_KEYS.forEach((k) => {
      original[k] = process.env[k]
    })
    process.env.EXPO_PUBLIC_TRAVELPAYOUTS_MARKER = '999999'
    process.env.EXPO_PUBLIC_AFFILIATE_TOURS_TEMPLATE = 'https://tp.media/r?marker=999999.{subid}&u={url}'
    process.env.EXPO_PUBLIC_AFFILIATE_HOTELS_TEMPLATE = 'https://tp.media/r?marker=999999.{subid}&u={url}'
  })

  afterEach(() => {
    ENV_KEYS.forEach((k) => {
      if (original[k] === undefined) delete process.env[k]
      else process.env[k] = original[k]
    })
  })

  // Суть задачи: без `countryCode` обе ссылки поездки всегда уходили на homepage
  // партнёра, потому что `resolveCountrySlug` нечего было резолвить.
  it('deep-links both partners to the country of the first route point', () => {
    const { getByText } = render(<TripAffiliateBlock trip={makeTrip([point('Минск', MINSK)])} />)

    fireEvent.press(getByText('Подобрать жильё'))
    expect(openedUrl()).toContain(encodeURIComponent('https://ostrovok.ru/hotel/belarus/'))

    ;(openExternalUrlInNewTab as jest.Mock).mockClear()
    fireEvent.press(getByText('Посмотреть экскурсии'))
    expect(openedUrl()).toContain(encodeURIComponent('https://experience.tripster.ru/destinations/belarus/'))
  })

  it('keeps reporting the click to trip analytics', () => {
    const { getByText } = render(<TripAffiliateBlock trip={makeTrip([point('Минск', MINSK)])} />)
    fireEvent.press(getByText('Подобрать жильё'))
    expect(trackTripAffiliateClick).toHaveBeenCalledWith(31, 'hotels')
  })

  // Точка типа `custom` заводится без координат: страна берётся у первой точки,
  // у которой они есть, иначе поездка теряла бы дип-линк целиком.
  it('falls through a coordinate-less first point to the next one', () => {
    const { getByText } = render(
      <TripAffiliateBlock trip={makeTrip([point('Сбор у подъезда', null), point('Минск', MINSK)])} />,
    )

    fireEvent.press(getByText('Подобрать жильё'))
    expect(openedUrl()).toContain(encodeURIComponent('https://ostrovok.ru/hotel/belarus/'))
  })

  // Инвариант #1371 на поверхности поездок: место в копии допустимо только тогда,
  // когда ссылка реально ведёт в это место.
  it('names the place when the link lands there', () => {
    const { getByText } = render(
      <TripAffiliateBlock trip={makeTrip([point('Минск', MINSK)], 'Минск')} />,
    )
    expect(getByText('Отели и апартаменты — Минск')).toBeTruthy()
  })

  it('names no place when the country has no partner page and the link is the homepage', () => {
    // CZ нет в COUNTRY_SLUG — обе ссылки уходят на homepage, значит подпись не
    // имеет права называть Прагу.
    const { getByText } = render(
      <TripAffiliateBlock trip={makeTrip([point('Прага', PRAGUE)], 'Прага')} />,
    )

    expect(getByText('Отели и апартаменты рядом с маршрутом')).toBeTruthy()
    fireEvent.press(getByText('Подобрать жильё'))
    expect(openedUrl()).toContain(encodeURIComponent('https://ostrovok.ru/'))
    expect(openedUrl()).not.toContain(encodeURIComponent('/hotel/'))
  })

  it('stays neutral for a trip without any coordinates', () => {
    const { getByText } = render(
      <TripAffiliateBlock trip={makeTrip([point('Сбор у подъезда', null)], 'Минск')} />,
    )

    expect(getByText('Отели и апартаменты рядом с маршрутом')).toBeTruthy()
    fireEvent.press(getByText('Подобрать жильё'))
    expect(openedUrl()).toContain(encodeURIComponent('https://ostrovok.ru/'))
    expect(openedUrl()).not.toContain(encodeURIComponent('/hotel/'))
  })

  it('renders no orphan heading when no offer template is configured', () => {
    delete process.env.EXPO_PUBLIC_AFFILIATE_TOURS_TEMPLATE
    delete process.env.EXPO_PUBLIC_AFFILIATE_HOTELS_TEMPLATE

    const { queryByTestId, queryByText } = render(
      <TripAffiliateBlock trip={makeTrip([point('Минск', MINSK)])} />,
    )

    expect(queryByTestId('trip-affiliate')).toBeNull()
    expect(queryByText('Где остановиться и что посмотреть')).toBeNull()
  })
})
