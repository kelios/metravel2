import React from 'react'
import { render } from '@testing-library/react-native'
import { act } from 'react-test-renderer'

import type { PlannedTrip } from '@/api/plannedTrips'
import RouteBuilder from '@/components/trips/planning/RouteBuilder'
import { createQueryWrapper } from '../../helpers/testQueryClient'

jest.mock('@/api/places', () => ({
  fetchPlacesCatalog: jest.fn(),
}))

jest.mock('@/api/travelsApi', () => ({
  fetchTravels: jest.fn(),
}))

jest.mock('@/hooks/usePlannedTripsApi', () => ({
  useRouteTemplates: () => ({ data: [] }),
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

// Имя начинается с `mock`, иначе jest не пустит переменную в фабрику мока.
const mockMapProps: {
  current: {
    onAddPointFromMap?: (p: { lat: number; lng: number }) => void
    route?: unknown[]
  }
} = { current: {} }

jest.mock('@/components/trips/planning/TripPlanRouteMap', () => {
  return function TripPlanRouteMap(props: Record<string, unknown>) {
    const { View } = require('react-native')
    mockMapProps.current = props
    return <View testID="trip-plan-route-map" />
  }
})

const makeTrip = (overrides: Partial<PlannedTrip> = {}): PlannedTrip => ({
  id: 42,
  slug: '42',
  title: 'Маршрут',
  description: '',
  startDate: '2026-08-08',
  startTime: '09:00',
  transport: 'car',
  bikeType: 'regular',
  visibility: 'private',
  seatsTotal: 4,
  startPoint: null,
  status: 'planning',
  organizer: { id: 7, name: 'Owner', avatarUrl: null },
  route: [],
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
  createdAt: '2026-08-08T08:00:00Z',
  ...overrides,
})

const renderRouteBuilder = (element: React.ReactElement) =>
  render(element, { wrapper: createQueryWrapper().Wrapper })

describe('RouteBuilder: цепочка тапов по карте', () => {
  beforeEach(() => {
    mockMapProps.current = {}
  })

  // Точка с карты сразу открывает редактор, и раньше это же гасило карту:
  // обработчик переставал передаваться, второй тап молча ничего не делал,
  // хотя подсказка продолжала звать нажимать по карте.
  it('добавляет вторую точку тапом, пока открыт редактор первой', () => {
    const { getByText } = renderRouteBuilder(<RouteBuilder trip={makeTrip()} />)

    act(() => {
      mockMapProps.current.onAddPointFromMap?.({ lat: 53.9, lng: 27.56 })
    })
    expect(typeof mockMapProps.current.onAddPointFromMap).toBe('function')

    act(() => {
      mockMapProps.current.onAddPointFromMap?.({ lat: 53.8, lng: 27.4 })
    })

    expect(getByText('Точка 1')).toBeTruthy()
    expect(getByText('Точка 2')).toBeTruthy()
  })

  it('не добавляет точку с нечисловыми координатами', () => {
    renderRouteBuilder(<RouteBuilder trip={makeTrip()} />)

    act(() => {
      mockMapProps.current.onAddPointFromMap?.({ lat: Number.NaN, lng: 27.56 })
    })

    expect(mockMapProps.current.route).toHaveLength(0)
  })
})
