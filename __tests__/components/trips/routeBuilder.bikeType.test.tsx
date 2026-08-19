import React from 'react'
import { act, fireEvent, render } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'

import type { PlannedTrip } from '@/api/plannedTrips'
import RouteBuilder from '@/components/trips/planning/RouteBuilder'

const mockRouteMutate = jest.fn()
const mockTransportMutate = jest.fn()
const mockBikeTypeMutate = jest.fn()
let mockRoutePending = false
let mockBikeTypePending = false

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
    isPending: false,
  }),
  useUpdateTripBikeType: () => ({
    mutate: mockBikeTypeMutate,
    isPending: mockBikeTypePending,
  }),
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
    summary?: { distanceKm: number; durationMin: number } | null
    transport?: string
  }) {
    const { Text, View } = require('react-native')
    return (
      <View testID="trip-plan-route-map">
        <Text>
          {`${transport ?? 'none'}:${routeGeometry?.length ?? 0}:${summary?.distanceKm ?? 0}:${summary?.durationMin ?? 0}:${routingState?.provider ?? 'none'}`}
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
  transport: 'bike',
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
    durationMin: 62,
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

describe('RouteBuilder bike type selector', () => {
  beforeEach(() => {
    mockRouteMutate.mockReset()
    mockTransportMutate.mockReset()
    mockBikeTypeMutate.mockReset()
    mockRoutePending = false
    mockBikeTypePending = false
  })

  it('is hidden for every non-bike transport', () => {
    const { queryByTestId, rerender } = render(<RouteBuilder trip={makeTrip({ transport: 'car' })} />)
    expect(queryByTestId('route-builder-bike-type-control')).toBeNull()

    rerender(<RouteBuilder trip={makeTrip({ transport: 'foot' })} />)
    expect(queryByTestId('route-builder-bike-type-control')).toBeNull()
  })

  it('is hidden for a non-owner even when the transport is bike', () => {
    const { queryByTestId } = render(<RouteBuilder trip={makeTrip({ isOwner: false })} />)

    expect(queryByTestId('route-builder-bike-type-control')).toBeNull()
  })

  it('is hidden when the backend does not expose bike_type at all', () => {
    const { queryByTestId, getByTestId } = render(<RouteBuilder trip={makeTrip({ bikeType: null })} />)

    expect(queryByTestId('route-builder-bike-type-control')).toBeNull()
    expect(getByTestId('route-builder-transport-control')).toBeTruthy()
  })

  it('shows the three choices with selected state and 44dp targets when transport is bike', () => {
    const { getByTestId } = render(<RouteBuilder trip={makeTrip({ bikeType: 'road' })} />)

    expect(getByTestId('route-builder-bike-type-control')).toBeTruthy()

    const chips = ['regular', 'road', 'mountain'].map((bikeType) =>
      getByTestId(`route-builder-bike-type-${bikeType}`),
    )
    expect(chips.map((chip) => chip.props.accessibilityLabel)).toEqual([
      'Обычный',
      'Шоссейный',
      'Горный',
    ])
    expect(chips.map((chip) => chip.props.accessibilityState.selected)).toEqual([
      false,
      true,
      false,
    ])

    const chipStyle = chips[0].props.style
    const resolvedStyle = typeof chipStyle === 'function'
      ? chipStyle({ pressed: false, focused: false, hovered: false })
      : chipStyle
    expect(StyleSheet.flatten(resolvedStyle).minHeight).toBeGreaterThanOrEqual(44)
  })

  it('ignores the current choice and locks rapid repeated changes to one PATCH without a separate rebuild', () => {
    const { getByTestId } = render(<RouteBuilder trip={makeTrip()} />)

    fireEvent.press(getByTestId('route-builder-bike-type-regular'))
    expect(mockBikeTypeMutate).not.toHaveBeenCalled()

    fireEvent.press(getByTestId('route-builder-bike-type-mountain'))
    fireEvent.press(getByTestId('route-builder-bike-type-mountain'))
    fireEvent.press(getByTestId('route-builder-bike-type-road'))
    fireEvent.press(getByTestId('route-builder-save'))

    expect(mockBikeTypeMutate).toHaveBeenCalledTimes(1)
    expect(mockBikeTypeMutate.mock.calls[0][0]).toEqual({ tripId: 42, bikeType: 'mountain' })
    expect(mockRouteMutate).not.toHaveBeenCalled()
    expect(mockTransportMutate).not.toHaveBeenCalled()
  })

  it('disables bike type changes while a route save is pending', () => {
    mockRoutePending = true
    const { getByTestId } = render(<RouteBuilder trip={makeTrip()} />)

    const chip = getByTestId('route-builder-bike-type-road')
    expect(chip.props.accessibilityState.disabled).toBe(true)

    fireEvent.press(chip)
    expect(mockBikeTypeMutate).not.toHaveBeenCalled()
  })

  it('shows the shared rebuild hint and blocks repeat presses while the change is pending', () => {
    mockBikeTypePending = true
    const { getByTestId } = render(<RouteBuilder trip={makeTrip()} />)

    expect(getByTestId('route-builder-transport-pending')).toBeTruthy()
    expect(getByTestId('route-builder-bike-type-road').props.accessibilityState.disabled).toBe(true)

    fireEvent.press(getByTestId('route-builder-bike-type-road'))
    expect(mockBikeTypeMutate).not.toHaveBeenCalled()
  })

  it('applies the rebuilt route, geometry and summary from the response together', () => {
    const updatedTrip = makeTrip({
      bikeType: 'mountain',
      route: [
        { id: 'server-a', type: 'custom', name: 'A', description: null, coordinates: [27.56, 53.9], placeId: null },
        { id: 'server-b', type: 'custom', name: 'B', description: null, coordinates: [27.4, 53.8], placeId: null },
      ],
      routeGeometry: [[27.56, 53.9], [27.5, 53.85], [27.4, 53.8]],
      routeSummary: {
        distanceKm: 21.4,
        durationMin: 78,
        elevationGainM: 210,
        stopsCount: 1,
        provider: 'ors',
      },
    })
    const { getByTestId, getByText, rerender } = render(<RouteBuilder trip={makeTrip()} />)

    fireEvent.press(getByTestId('route-builder-bike-type-mountain'))
    const callbacks = mockBikeTypeMutate.mock.calls[0][1] as MutationCallbacks
    act(() => {
      callbacks.onSuccess(updatedTrip)
      callbacks.onSettled()
    })
    rerender(<RouteBuilder trip={updatedTrip} />)

    expect(getByText('bike:3:21.4:78:ors')).toBeTruthy()
    expect(getByTestId('route-builder-bike-type-mountain').props.accessibilityState.selected).toBe(true)
  })

  it('does not overwrite unsaved route edits when the response arrives', () => {
    const updatedTrip = makeTrip({ bikeType: 'road' })
    const { getByTestId } = render(<RouteBuilder trip={makeTrip()} />)

    fireEvent.press(getByTestId('route-builder-type-custom'))
    fireEvent.changeText(getByTestId('route-builder-name'), 'C')
    fireEvent.press(getByTestId('route-builder-add'))
    expect(getByTestId('route-map-point-names').props.children).toBe('A|B|C')

    fireEvent.press(getByTestId('route-builder-bike-type-road'))
    const callbacks = mockBikeTypeMutate.mock.calls[0][1] as MutationCallbacks
    act(() => {
      callbacks.onSuccess(updatedTrip)
      callbacks.onSettled()
    })

    expect(getByTestId('route-map-point-names').props.children).toBe('A|B|C')
  })

  it('keeps the prior route, announces the failure and allows a retry', () => {
    const { getByTestId, getByText, queryByTestId } = render(<RouteBuilder trip={makeTrip()} />)

    fireEvent.press(getByTestId('route-builder-bike-type-road'))
    const callbacks = mockBikeTypeMutate.mock.calls[0][1] as MutationCallbacks
    act(() => {
      callbacks.onError()
      callbacks.onSettled()
    })

    // Ошибка у транспорта и типа велосипеда общая: поток перестроения один.
    const error = getByTestId('route-builder-transport-error')
    expect(error.props.accessibilityLiveRegion).toBe('assertive')
    expect(getByText('Не удалось перестроить маршрут. Попробуйте ещё раз.')).toBeTruthy()
    expect(getByText('bike:2:18.5:62:ors')).toBeTruthy()

    fireEvent.press(getByTestId('route-builder-bike-type-road'))
    expect(mockBikeTypeMutate).toHaveBeenCalledTimes(2)
    expect(queryByTestId('route-builder-transport-error')).toBeNull()
  })

  it('does not keep a stale failure under a later successful change', () => {
    const { getByTestId, queryByTestId } = render(<RouteBuilder trip={makeTrip()} />)

    fireEvent.press(getByTestId('route-builder-bike-type-road'))
    act(() => {
      const failed = mockBikeTypeMutate.mock.calls[0][1] as MutationCallbacks
      failed.onError()
      failed.onSettled()
    })
    expect(getByTestId('route-builder-transport-error')).toBeTruthy()

    fireEvent.press(getByTestId('segmented-foot'))
    act(() => {
      const succeeded = mockTransportMutate.mock.calls[0][1] as MutationCallbacks
      succeeded.onSuccess(makeTrip({ transport: 'foot', bikeType: 'regular' }))
      succeeded.onSettled()
    })

    expect(queryByTestId('route-builder-transport-error')).toBeNull()
  })
})
