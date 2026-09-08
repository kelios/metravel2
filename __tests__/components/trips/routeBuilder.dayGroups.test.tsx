// #1845: список точек конструктора группируется по дню похода.
import React from 'react'
import { fireEvent, render } from '@testing-library/react-native'

import type { PlannedTrip, RoutePoint } from '@/api/plannedTrips'
import RouteBuilder from '@/components/trips/planning/RouteBuilder'
import { translate as i18nT } from '@/i18n'
import { formatTripDateLong } from '@/utils/tripDateTime'
import { createQueryWrapper } from '../../helpers/testQueryClient'

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

jest.mock('@/hooks/usePlannedTripRouteFile', () => ({
  usePlannedTripRouteFile: () => ({ data: null }),
  usePlannedTripOriginalTrack: () => ({ data: null }),
  useUploadPlannedTripRouteFile: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useDeletePlannedTripRouteFile: () => ({ mutate: jest.fn(), isPending: false }),
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

jest.mock('@/components/trips/planning/TripRoutePreviewEngine', () => {
  return function TripRoutePreviewEngine() {
    const { View } = require('react-native')
    return <View testID="trip-route-preview-engine" />
  }
})

jest.mock('@/components/trips/planning/TripPlanRouteMap', () => {
  return function TripPlanRouteMap() {
    const { View } = require('react-native')
    return <View testID="trip-plan-route-map" />
  }
})

jest.mock('@/components/trips/planning/TripRouteImportPanel', () => {
  return function TripRouteImportPanel() {
    const { View } = require('react-native')
    return <View />
  }
})

jest.mock('@/components/MapPage/AddressSearch', () => {
  return function AddressSearch() {
    const { View } = require('react-native')
    return <View />
  }
})

const makePoint = (over: Partial<RoutePoint> = {}): RoutePoint => ({
  id: 'p0',
  type: 'custom',
  name: 'Точка 1',
  description: null,
  coordinates: [6.42, 49.81],
  placeId: null,
  ...over,
})

const makeTrip = (route: RoutePoint[], over: Partial<PlannedTrip> = {}): PlannedTrip => ({
  id: 42,
  slug: '42',
  title: 'Mullerthal Trail',
  description: '',
  startDate: '2026-09-26',
  endDate: null,
  startTime: '09:00',
  transport: 'foot',
  bikeType: null,
  visibility: 'private',
  seatsTotal: 4,
  startPoint: null,
  status: 'planning',
  organizer: { id: 7, name: 'Owner', avatarUrl: null },
  route,
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
  ...over,
})

const renderRouteBuilder = (route: RoutePoint[], layout: 'stack' | 'mapFirst') =>
  render(<RouteBuilder trip={makeTrip(route)} layout={layout} />, {
    wrapper: createQueryWrapper().Wrapper,
  })

describe.each(['stack', 'mapFirst'] as const)('RouteBuilder: дни похода (%s)', (layout) => {
  beforeEach(() => {
    mockRouteMutate.mockReset()
  })

  it('не рисует заголовки дней, пока ни у одной точки дня нет', () => {
    const { queryByTestId } = renderRouteBuilder(
      [makePoint(), makePoint({ id: 'p1', name: 'Точка 2' })],
      layout,
    )
    expect(queryByTestId('route-builder-day-group-1')).toBeNull()
    expect(queryByTestId('route-builder-day-group-unassigned')).toBeNull()
  })

  it('группирует список по дням и показывает дату со старта поездки', () => {
    const { getByTestId, getByText } = renderRouteBuilder(
      [
        makePoint({ id: 'd1', name: 'Старт', dayNumber: 1 }),
        makePoint({ id: 'd2', name: 'Ночёвка', dayNumber: 2, coordinates: [6.5, 49.82] }),
        makePoint({ id: 'none', name: 'Точка без дня' }),
      ],
      layout,
    )

    expect(getByTestId('route-builder-day-group-1')).toBeTruthy()
    expect(getByTestId('route-builder-day-group-2')).toBeTruthy()
    expect(getByTestId('route-builder-day-group-unassigned')).toBeTruthy()
    expect(getByText(i18nT('tripsStatic:plan.routeDay.heading', { day: 1 }))).toBeTruthy()
    expect(getByTestId('route-builder-day-group-1').props.accessibilityLabel).toContain(
      formatTripDateLong('2026-09-26'),
    )
  })

  it('группирует список и у гостя, когда дни уже назначены', () => {
    const { getByTestId, queryByTestId } = render(
      <RouteBuilder
        trip={makeTrip(
          [
            makePoint({ id: 'd1', name: 'Старт', dayNumber: 1 }),
            makePoint({ id: 'd2', name: 'Ночёвка', dayNumber: 2 }),
          ],
          { isOwner: false },
        )}
        layout={layout}
      />,
      { wrapper: createQueryWrapper().Wrapper },
    )

    expect(getByTestId('route-builder-day-group-1')).toBeTruthy()
    expect(getByTestId('route-builder-day-group-2')).toBeTruthy()
    expect(queryByTestId('route-builder-day-group-unassigned')).toBeNull()
  })

  it('переносит точку в другой день через чип и считает это несохранённой правкой', () => {
    const { getByTestId, queryByTestId } = renderRouteBuilder(
      [
        makePoint({ id: 'd1', name: 'Старт', dayNumber: 1 }),
        makePoint({ id: 'd2', name: 'Ночёвка', dayNumber: 2 }),
      ],
      layout,
    )

    fireEvent.press(getByTestId('route-builder-edit-0'))
    fireEvent.press(getByTestId('route-builder-day-chip-2'))
    fireEvent.press(getByTestId('route-builder-edit-save'))
    fireEvent.press(getByTestId('route-builder-save'))

    expect(mockRouteMutate).toHaveBeenCalledTimes(1)
    const saved = mockRouteMutate.mock.calls[0][0].route as RoutePoint[]
    expect(saved[0].dayNumber).toBe(2)
    expect(saved[1].dayNumber).toBe(2)
    expect(getByTestId('route-builder-day-group-2')).toBeTruthy()
    expect(queryByTestId('route-builder-day-group-1')).toBeNull()
  })

  it('не закрывает форму на день вне 1–60', () => {
    const { getByTestId, getByText } = renderRouteBuilder([makePoint()], layout)

    fireEvent.press(getByTestId('route-builder-edit-0'))
    fireEvent.changeText(getByTestId('route-builder-day-input'), '80')
    fireEvent.press(getByTestId('route-builder-edit-save'))

    expect(getByTestId('route-builder-edit-form')).toBeTruthy()
    expect(getByText(i18nT('tripsStatic:plan.routeDay.errors.range'))).toBeTruthy()
    expect(mockRouteMutate).not.toHaveBeenCalled()
  })
})
