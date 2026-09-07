/**
 * #1820 — сигнал «маршрут заменили целиком» из конструктора в карту.
 *
 * Карта не может вывести оптовую замену из самих точек: повторное применение
 * ТОГО ЖЕ шаблона возвращает неперетащенные точки с прежними координатами, и от
 * частичной правки такая замена неотличима. Поэтому `RouteBuilder` считает
 * замены сам. Тест держит две стороны контракта:
 *   1. шаблон и импортированный трек увеличивают счётчик — в том числе шаблон,
 *      применённый повторно;
 *   2. правка точки с карты счётчик не трогает, иначе перетаскивание маркера
 *      само же и выбрасывало бы наведённый им кадр.
 */
import React from 'react'
import { fireEvent, render } from '@testing-library/react-native'

import type { PlannedTrip } from '@/api/plannedTrips'
import RouteBuilder from '@/components/trips/planning/RouteBuilder'
import { createQueryWrapper } from '../../helpers/testQueryClient'

jest.mock('@/api/places', () => ({ fetchPlacesCatalog: jest.fn() }))
jest.mock('@/api/travelsApi', () => ({ fetchTravels: jest.fn() }))

const template = {
  id: 'ring',
  title: 'Кольцо',
  description: 'Три точки',
  points: [
    { type: 'custom', name: 'Т1', description: null, coordinates: [27.56, 53.9], placeId: null },
    { type: 'custom', name: 'Т2', description: null, coordinates: [27.6, 53.91], placeId: null },
  ],
}

jest.mock('@/hooks/usePlannedTripsApi', () => ({
  useRouteTemplates: () => ({ data: [template] }),
  useTripRouteElevation: () => ({ data: undefined }),
  useRefreshTripRouteElevation: () => ({ mutate: jest.fn(), isPending: false }),
  useUpdateTripRoute: () => ({ mutate: jest.fn(), isPending: false }),
  useUpdateTripTransport: () => ({ mutate: jest.fn(), isPending: false }),
  useUpdateTripBikeType: () => ({ mutate: jest.fn(), isPending: false }),
}))

jest.mock('@/components/ui/ImageCardMedia', () => {
  return function ImageCardMedia() {
    const { View } = require('react-native')
    return <View />
  }
})

const tokens: Array<number | undefined> = []

jest.mock('@/components/trips/planning/TripPlanRouteMap', () => {
  return function TripPlanRouteMap({
    routeReplacementToken,
    onMovePoint,
  }: {
    routeReplacementToken?: number
    onMovePoint?: (move: { index: number; lat: number; lng: number }) => void
  }) {
    const { Pressable, View } = require('react-native')
    tokens.push(routeReplacementToken)
    return (
      <View testID="trip-plan-route-map">
        <Pressable
          testID="map-drag-point-0"
          onPress={() => onMovePoint?.({ index: 0, lat: 53.93, lng: 27.61 })}
        />
      </View>
    )
  }
})

jest.mock('@/components/trips/planning/TripRouteImportPanel', () => {
  return function TripRouteImportPanel({
    onApply,
  }: {
    onApply?: (route: unknown[], upload: null) => void
  }) {
    const { Pressable, View } = require('react-native')
    return (
      <View>
        <Pressable
          testID="import-apply"
          onPress={() =>
            onApply?.(
              [
                { id: 'i1', type: 'custom', name: 'Прага', description: null, coordinates: [14.43, 50.07], placeId: null },
                { id: 'i2', type: 'custom', name: 'Брно', description: null, coordinates: [16.6, 49.19], placeId: null },
              ],
              null,
            )
          }
        />
      </View>
    )
  }
})

const trip: PlannedTrip = {
  id: 42,
  slug: '42',
  title: 'Маршрут',
  description: '',
  startDate: '2026-09-06',
  startTime: '09:00',
  transport: 'car',
  bikeType: 'regular',
  visibility: 'private',
  seatsTotal: 4,
  startPoint: null,
  status: 'planning',
  organizer: { id: 7, name: 'Owner', avatarUrl: null },
  route: [
    { id: 'a', type: 'custom', name: 'Т1', description: null, coordinates: [27.56, 53.9], placeId: null },
    { id: 'b', type: 'custom', name: 'Т2', description: null, coordinates: [27.6, 53.91], placeId: null },
  ],
  routeGeometry: null,
  routeSummary: null,
  routingState: null,
  participants: [],
  coverUrl: null,
  region: '',
  publishedToCommunity: false,
  report: null,
  isOwner: true,
  myRsvp: 'going',
  createdAt: '2026-09-06T08:00:00Z',
}

const lastToken = () => tokens[tokens.length - 1]

describe('#1820 RouteBuilder — счётчик оптовых замен маршрута', () => {
  beforeEach(() => {
    tokens.length = 0
  })

  it('растёт на каждом применении шаблона, включая повторное', () => {
    const { getByTestId } = render(<RouteBuilder trip={trip} />, {
      wrapper: createQueryWrapper().Wrapper,
    })

    const initial = lastToken()
    expect(initial).toBe(0)

    fireEvent.press(getByTestId('route-builder-template-ring'))
    expect(lastToken()).toBe(1)

    // Тот же шаблон второй раз: точки вернулись прежними, и без роста счётчика
    // карта осталась бы с защёлкой кадра от перетаскивания маркера.
    fireEvent.press(getByTestId('route-builder-template-ring'))
    expect(lastToken()).toBe(2)
  })

  it('растёт на применении импортированного трека', () => {
    const { getByTestId } = render(<RouteBuilder trip={trip} />, {
      wrapper: createQueryWrapper().Wrapper,
    })

    fireEvent.press(getByTestId('import-apply'))

    expect(lastToken()).toBe(1)
  })

  it('не растёт на правке точки с карты', () => {
    const { getByTestId } = render(<RouteBuilder trip={trip} />, {
      wrapper: createQueryWrapper().Wrapper,
    })

    fireEvent.press(getByTestId('map-drag-point-0'))

    expect(lastToken()).toBe(0)
  })
})
