import React from 'react'
import { fireEvent, render } from '@testing-library/react-native'

import type { PlannedTrip } from '@/api/plannedTrips'
import RouteBuilder from '@/components/trips/planning/RouteBuilder'

const mockRouteMutate = jest.fn()

jest.mock('@/api/places', () => ({ fetchPlacesCatalog: jest.fn() }))
jest.mock('@/api/travelsApi', () => ({ fetchTravels: jest.fn() }))

jest.mock('@/hooks/usePlannedTripsApi', () => ({
  useRouteTemplates: () => ({ data: [] }),
  useTripRouteElevation: () => ({ data: undefined }),
  useRefreshTripRouteElevation: () => ({ mutate: jest.fn(), isPending: false }),
  useUpdateTripRoute: () => ({ mutate: mockRouteMutate, isPending: false }),
  useUpdateTripTransport: () => ({ mutate: jest.fn(), isPending: false }),
  useUpdateTripBikeType: () => ({ mutate: jest.fn(), isPending: false }),
}))

jest.mock('@/utils/tripAnalytics', () => ({
  trackRouteExported: jest.fn(),
  trackRoutePointAdded: jest.fn(),
}))

jest.mock('@/components/ui/ImageCardMedia', () => {
  return function ImageCardMedia() {
    const { View } = require('react-native')
    return <View />
  }
})

jest.mock('@/components/trips/planning/TripPlanRouteMap', () => {
  return function TripPlanRouteMap({ route }: { route?: Array<{ name: string }> }) {
    const { Text, View } = require('react-native')
    return (
      <View testID="trip-plan-route-map">
        <Text testID="route-map-point-names">{route?.map((point) => point.name).join('|')}</Text>
      </View>
    )
  }
})

const ROUTE_LENGTH = 25

const makeRoute = (length = ROUTE_LENGTH) =>
  Array.from({ length }, (_, index) => ({
    id: `p${index}`,
    type: 'custom' as const,
    name: `Point ${index + 1}`,
    description: null,
    coordinates: [27.5 + index * 0.02, 53.9 + index * 0.03] as [number, number],
    placeId: null,
  }))

const makeTrip = (overrides: Partial<PlannedTrip> = {}): PlannedTrip => ({
  id: 42,
  slug: '42',
  title: 'Длинный маршрут',
  description: '',
  startDate: '2026-08-08',
  startTime: '09:00',
  transport: 'car',
  visibility: 'private',
  seatsTotal: 4,
  startPoint: null,
  status: 'planning',
  organizer: { id: 7, name: 'Owner', avatarUrl: null },
  route: makeRoute(),
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

describe('RouteBuilder reorder', () => {
  beforeEach(() => {
    mockRouteMutate.mockReset()
  })

  it('renders every point of a long route with its own drag handle', () => {
    const { getByTestId, queryByTestId } = render(<RouteBuilder trip={makeTrip()} />)

    expect(getByTestId(`route-builder-point-${ROUTE_LENGTH - 1}`)).toBeTruthy()
    expect(getByTestId(`route-builder-drag-${ROUTE_LENGTH - 1}`)).toBeTruthy()
    expect(queryByTestId(`route-builder-point-${ROUTE_LENGTH}`)).toBeNull()
    expect(getByTestId('route-map-point-names').props.children).toBe(
      makeRoute().map((point) => point.name).join('|'),
    )
  })

  it('saves the whole reordered list with a single mutation', () => {
    const { getByTestId } = render(<RouteBuilder trip={makeTrip()} />)

    // Стрелки — клавиатурный/a11y путь того же reorder, что и перетаскивание.
    fireEvent.press(getByTestId('route-builder-move-up-19'))
    fireEvent.press(getByTestId('route-builder-save'))

    expect(mockRouteMutate).toHaveBeenCalledTimes(1)
    const [payload] = mockRouteMutate.mock.calls[0] as [
      { tripId: number; route: Array<{ name: string }> },
    ]
    expect(payload.tripId).toBe(42)
    expect(payload.route).toHaveLength(ROUTE_LENGTH)
    expect(payload.route[18].name).toBe('Point 20')
    expect(payload.route[19].name).toBe('Point 19')
  })

  it('keeps the edit form on its own point after a reorder', () => {
    const { getByTestId } = render(<RouteBuilder trip={makeTrip()} />)

    fireEvent.press(getByTestId('route-builder-edit-3'))
    expect(getByTestId('route-builder-edit-name').props.value).toBe('Point 4')

    fireEvent.press(getByTestId('route-builder-move-down-3'))
    expect(getByTestId('route-builder-edit-name').props.value).toBe('Point 4')

    fireEvent.press(getByTestId('route-builder-edit-save'))
    fireEvent.press(getByTestId('route-builder-save'))

    const [payload] = mockRouteMutate.mock.calls[0] as [{ route: Array<{ name: string }> }]
    expect(payload.route[4].name).toBe('Point 4')
    expect(payload.route[3].name).toBe('Point 5')
  })

  it('hides the drag handle when there is nothing to reorder or the trip is not mine', () => {
    const single = render(<RouteBuilder trip={makeTrip({ route: makeRoute(1) })} />)
    expect(single.queryByTestId('route-builder-drag-0')).toBeNull()
    expect(single.getByTestId('route-builder-point-0')).toBeTruthy()

    const foreign = render(<RouteBuilder trip={makeTrip({ isOwner: false })} />)
    expect(foreign.queryByTestId('route-builder-drag-0')).toBeNull()
    expect(foreign.queryByTestId('route-builder-move-up-1')).toBeNull()
    expect(foreign.getByTestId(`route-builder-point-${ROUTE_LENGTH - 1}`)).toBeTruthy()
  })
})
