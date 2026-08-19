import React from 'react'
import { fireEvent, render } from '@testing-library/react-native'
import { Platform } from 'react-native'

import type { PlannedTrip } from '@/api/plannedTrips'
import RouteBuilder from '@/components/trips/planning/RouteBuilder'

jest.mock('@/api/places', () => ({
  fetchPlacesCatalog: jest.fn(),
}))

jest.mock('@/api/travelsApi', () => ({
  fetchTravels: jest.fn(),
}))

const mockRouteMutate = jest.fn()

jest.mock('@/hooks/usePlannedTripsApi', () => ({
  useRouteTemplates: () => ({ data: [] }),
  useTripRouteElevation: () => ({ data: undefined }),
  useRefreshTripRouteElevation: () => ({ mutate: jest.fn(), isPending: false }),
  useUpdateTripRoute: () => ({ mutate: mockRouteMutate, isPending: false }),
  useUpdateTripTransport: () => ({ mutate: jest.fn(), isPending: false }),
  useUpdateTripBikeType: () => ({ mutate: jest.fn(), isPending: false }),
}))

jest.mock('@/components/ui/ImageCardMedia', () => {
  return function ImageCardMedia() {
    const { View } = require('react-native')
    return <View />
  }
})

jest.mock('@/components/trips/planning/TripPlanRouteMap', () => {
  return function TripPlanRouteMap() {
    const { View } = require('react-native')
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
  route: [
    {
      id: 'a',
      type: 'custom',
      name: 'Кафе',
      description: 'Меню тут cafe-gluboke.by/menu',
      coordinates: [27.56, 53.9],
      placeId: null,
    },
    { id: 'b', type: 'custom', name: 'B', description: null, coordinates: [27.4, 53.8], placeId: null },
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
  createdAt: '2026-08-08T08:00:00Z',
  ...overrides,
})

describe('RouteBuilder point description', () => {
  const originalPlatform = Platform.OS

  beforeEach(() => {
    mockRouteMutate.mockReset()
  })

  afterEach(() => {
    Platform.OS = originalPlatform
  })

  // #1494: однострочное поле не давало прочитать и отредактировать длинное описание.
  it('keeps the new-point description input multiline', () => {
    const { getByTestId } = render(<RouteBuilder trip={makeTrip()} />)
    // по умолчанию открыт поиск по местам сайта — ручные поля живут в «своей точке»
    fireEvent.press(getByTestId('route-builder-type-custom'))
    const input = getByTestId('route-builder-description')
    expect(input.props.multiline).toBe(true)
    expect(input.props.numberOfLines).toBe(3)
  })

  it('keeps the edited-point description input multiline', () => {
    const { getByTestId } = render(<RouteBuilder trip={makeTrip()} />)
    fireEvent.press(getByTestId('route-builder-edit-0'))
    const input = getByTestId('route-builder-edit-description')
    expect(input.props.multiline).toBe(true)
    expect(input.props.numberOfLines).toBe(3)
  })

  // #1494: длинное описание точки должно доезжать до сохранения маршрута целиком,
  // вместе с переносами строк — ради этого поле и стало многострочным.
  it('saves a multi-line point description with its line breaks', () => {
    const { getByTestId } = render(<RouteBuilder trip={makeTrip()} />)
    fireEvent.press(getByTestId('route-builder-type-custom'))
    fireEvent.changeText(getByTestId('route-builder-name'), 'Ночёвка')
    fireEvent.changeText(
      getByTestId('route-builder-description'),
      'Бронь на фамилию Иванов\nЗаезд с 14:00, ключи у сторожа\nСайт camp.by/booking',
    )
    fireEvent.press(getByTestId('route-builder-add'))
    fireEvent.press(getByTestId('route-builder-save'))

    expect(mockRouteMutate).toHaveBeenCalledTimes(1)
    const saved = mockRouteMutate.mock.calls[0][0].route.at(-1)
    expect(saved.name).toBe('Ночёвка')
    expect(saved.description).toBe(
      'Бронь на фамилию Иванов\nЗаезд с 14:00, ключи у сторожа\nСайт camp.by/booking',
    )
  })

  it('renders links inside a point description as real anchors on web', () => {
    Platform.OS = 'web'
    const { UNSAFE_getAllByProps } = render(<RouteBuilder trip={makeTrip()} />)
    const anchors = UNSAFE_getAllByProps({ href: 'https://cafe-gluboke.by/menu' })
    expect(anchors.length).toBeGreaterThan(0)
  })
})
