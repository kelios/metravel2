import React from 'react'
import { act, fireEvent, render } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'

import type { PlannedTrip } from '@/api/plannedTrips'
import RouteBuilder from '@/components/trips/planning/RouteBuilder'

const mockRouteMutate = jest.fn()
const mockTransportMutate = jest.fn()
let mockRoutePending = false
let mockTransportPending = false

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
  useUpdateTripRoute: () => ({
    mutate: mockRouteMutate,
    isPending: mockRoutePending,
  }),
  useUpdateTripTransport: () => ({
    mutate: mockTransportMutate,
    isPending: mockTransportPending,
  }),
  useUpdateTripBikeType: () => ({ mutate: jest.fn(), isPending: false }),
}))

jest.mock('@/components/ui/ImageCardMedia', () => {
  return function ImageCardMedia() {
    const { View } = require('react-native')
    return <View />
  }
})

// #1490: живое превью маршрута ходит в сеть за дорогой; здесь оно не предмет
// проверки, поэтому движок заглушён.
jest.mock('@/components/trips/planning/TripRoutePreviewEngine', () => {
  return function TripRoutePreviewEngine() {
    const { View } = require('react-native')
    return <View testID="trip-route-preview-engine" />
  }
})

jest.mock('@/components/trips/planning/TripPlanRouteMap', () => {
  return function TripPlanRouteMap({
    route,
    routeGeometry,
    routingState,
    summary,
    transport,
  }: {
    route?: Array<{ name: string }>
    routeGeometry?: Array<[number, number]> | null
    routingState?: { provider: string; isOptimal: boolean } | null
    summary?: { durationMin: number } | null
    transport?: string
  }) {
    const { Text, View } = require('react-native')
    return (
      <View testID="trip-plan-route-map">
        <Text>
          {`${transport ?? 'none'}:${routeGeometry?.length ?? 0}:${summary?.durationMin ?? 0}:${routingState?.provider ?? 'none'}`}
        </Text>
        <Text testID="route-map-point-names">{route?.map((point) => point.name).join('|')}</Text>
      </View>
    )
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
    { id: 'a', type: 'custom', name: 'A', description: null, coordinates: [27.56, 53.9], placeId: null },
    { id: 'b', type: 'custom', name: 'B', description: null, coordinates: [27.4, 53.8], placeId: null },
  ],
  routeGeometry: [[27.56, 53.9], [27.4, 53.8]],
  routeSummary: {
    distanceKm: 18.5,
    durationMin: 20,
    elevationGainM: 140,
    stopsCount: 1,
    provider: 'ors',
  },
  routingState: {
    provider: 'ors',
    isOptimal: true,
    fallbackReason: null,
    warnings: [],
  },
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

type MutationCallbacks = {
  onSuccess: (trip: PlannedTrip) => void
  onError: () => void
  onSettled: () => void
}

describe('RouteBuilder transport selector', () => {
  beforeEach(() => {
    mockRouteMutate.mockReset()
    mockTransportMutate.mockReset()
    mockRoutePending = false
    mockTransportPending = false
  })

  it('shows the three owner choices in order with selected state and 44dp targets', () => {
    const { getAllByRole, getByTestId } = render(<RouteBuilder trip={makeTrip()} />)

    const choices = getAllByRole('radio')
    expect(choices.map((choice) => choice.props.accessibilityLabel)).toEqual([
      'На машине',
      'Пешком',
      'На велосипеде',
    ])
    expect(choices.map((choice) => choice.props.accessibilityState.checked)).toEqual([
      true,
      false,
      false,
    ])

    const footStyle = getByTestId('segmented-foot').props.style
    const resolvedStyle = typeof footStyle === 'function'
      ? footStyle({ pressed: false, focused: false, hovered: false })
      : footStyle
    expect(StyleSheet.flatten(resolvedStyle).minHeight).toBeGreaterThanOrEqual(44)
  })

  it('does not render an interactive selector for a non-owner', () => {
    const { queryByTestId, getByTestId } = render(
      <RouteBuilder trip={makeTrip({ isOwner: false })} />,
    )

    expect(queryByTestId('route-builder-transport-control')).toBeNull()
    expect(getByTestId('trip-plan-route-map')).toBeTruthy()
  })

  it('ignores the current choice and locks rapid repeated changes to one mutation', () => {
    const { getByTestId } = render(<RouteBuilder trip={makeTrip()} />)

    fireEvent.press(getByTestId('segmented-car'))
    expect(mockTransportMutate).not.toHaveBeenCalled()

    fireEvent.press(getByTestId('segmented-foot'))
    fireEvent.press(getByTestId('segmented-foot'))
    fireEvent.press(getByTestId('route-builder-save'))

    expect(mockTransportMutate).toHaveBeenCalledTimes(1)
    expect(mockTransportMutate.mock.calls[0][0]).toEqual({ tripId: 42, transport: 'foot' })
    expect(mockRouteMutate).not.toHaveBeenCalled()
  })

  it('disables transport changes while a route save is pending', () => {
    mockRoutePending = true
    const { getAllByRole, getByTestId } = render(<RouteBuilder trip={makeTrip()} />)

    expect(getAllByRole('radio').every((choice) => choice.props.accessibilityState.disabled)).toBe(true)

    fireEvent.press(getByTestId('segmented-foot'))
    expect(mockTransportMutate).not.toHaveBeenCalled()
  })

  it('keeps the persisted route visible and disables all choices while pending', () => {
    mockTransportPending = true
    const { getAllByRole, getByTestId, getByText } = render(<RouteBuilder trip={makeTrip()} />)

    expect(getByTestId('route-builder-transport-pending')).toBeTruthy()
    expect(getAllByRole('radio').every((choice) => choice.props.accessibilityState.disabled)).toBe(true)
    expect(getByText('car:2:20:ors')).toBeTruthy()

    fireEvent.press(getByTestId('segmented-foot'))
    expect(mockTransportMutate).not.toHaveBeenCalled()
  })

  it('applies the returned transport, geometry, summary, and degraded routing state together', () => {
    const initialTrip = makeTrip()
    const updatedTrip = makeTrip({
      transport: 'bike',
      route: [
        { id: 'server-a', type: 'custom', name: 'A', description: null, coordinates: [27.56, 53.9], placeId: null },
        { id: 'server-b', type: 'custom', name: 'B', description: null, coordinates: [27.4, 53.8], placeId: null },
      ],
      routeGeometry: [[27.56, 53.9], [27.5, 53.85], [27.4, 53.8]],
      routeSummary: {
        distanceKm: 19.2,
        durationMin: 72,
        elevationGainM: 150,
        stopsCount: 1,
        provider: 'direct',
      },
      routingState: {
        provider: 'direct',
        isOptimal: false,
        fallbackReason: 'routing_provider_unavailable',
        warnings: [],
      },
    })
    const { getByTestId, getByText, rerender } = render(<RouteBuilder trip={initialTrip} />)

    fireEvent.press(getByTestId('segmented-bike'))
    const callbacks = mockTransportMutate.mock.calls[0][1] as MutationCallbacks
    act(() => {
      callbacks.onSuccess(updatedTrip)
      callbacks.onSettled()
    })
    rerender(<RouteBuilder trip={updatedTrip} />)

    expect(getByText('bike:3:72:direct')).toBeTruthy()
    expect(getByTestId('route-summary-approximate')).toBeTruthy()
  })

  it('does not overwrite unsaved route edits when the transport response arrives', () => {
    const initialTrip = makeTrip()
    const updatedTrip = makeTrip({
      transport: 'foot',
      route: [
        { id: 'server-a', type: 'custom', name: 'A', description: null, coordinates: [27.56, 53.9], placeId: null },
        { id: 'server-b', type: 'custom', name: 'B', description: null, coordinates: [27.4, 53.8], placeId: null },
      ],
    })
    const { getByTestId } = render(<RouteBuilder trip={initialTrip} />)

    fireEvent.press(getByTestId('route-builder-type-custom'))
    fireEvent.changeText(getByTestId('route-builder-name'), 'C')
    fireEvent.press(getByTestId('route-builder-add'))
    expect(getByTestId('route-map-point-names').props.children).toBe('A|B|C')

    fireEvent.press(getByTestId('segmented-foot'))
    const callbacks = mockTransportMutate.mock.calls[0][1] as MutationCallbacks
    act(() => {
      callbacks.onSuccess(updatedTrip)
      callbacks.onSettled()
    })

    expect(getByTestId('route-map-point-names').props.children).toBe('A|B|C')
  })

  it('preserves the prior route, shows an error, and allows retry after failure', () => {
    const { getByTestId, getByText } = render(<RouteBuilder trip={makeTrip()} />)

    fireEvent.press(getByTestId('segmented-foot'))
    const callbacks = mockTransportMutate.mock.calls[0][1] as MutationCallbacks
    act(() => {
      callbacks.onError()
      callbacks.onSettled()
    })

    expect(getByTestId('route-builder-transport-error')).toBeTruthy()
    expect(getByText('Не удалось перестроить маршрут. Попробуйте ещё раз.')).toBeTruthy()
    expect(getByText('car:2:20:ors')).toBeTruthy()

    fireEvent.press(getByTestId('segmented-foot'))
    expect(mockTransportMutate).toHaveBeenCalledTimes(2)
  })
})
