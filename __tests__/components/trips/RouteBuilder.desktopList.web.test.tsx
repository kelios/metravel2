import React from 'react'
import { fireEvent, render } from '@testing-library/react-native'
import { Platform, StyleSheet } from 'react-native'

import type { PlannedTrip, RoutePoint } from '@/api/plannedTrips'
import RouteBuilder from '@/components/trips/planning/RouteBuilder'
import { createQueryWrapper } from '../../helpers/testQueryClient'

jest.mock('@/api/places', () => ({ fetchPlacesCatalog: jest.fn() }))
jest.mock('@/api/travelsApi', () => ({ fetchTravels: jest.fn() }))

jest.mock('@/hooks/usePlannedTripsApi', () => ({
  useRouteTemplates: () => ({ data: [] }),
  useTripRouteElevation: () => ({ data: undefined }),
  useRefreshTripRouteElevation: () => ({ mutate: jest.fn(), isPending: false }),
  useUpdateTripRoute: () => ({ mutate: jest.fn(), isPending: false }),
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

const originalPlatformOS = Platform.OS

const setPlatformOS = (os: typeof Platform.OS) => {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: os })
}

const makeRoute = (count: number): RoutePoint[] =>
  Array.from({ length: count }, (_, index) => ({
    id: `point-${index}`,
    type: 'custom',
    name: `Точка ${index + 1}`,
    description: null,
    coordinates: [27.5 + index / 100, 53.9 + index / 100],
    placeId: null,
  }))

const makeTrip = (route = makeRoute(50)): PlannedTrip => ({
  id: 1600,
  slug: '1600',
  title: 'Длинный маршрут',
  description: '',
  startDate: '2026-08-27',
  startTime: '09:00',
  transport: 'car',
  bikeType: null,
  visibility: 'private',
  seatsTotal: 4,
  startPoint: null,
  status: 'planning',
  organizer: { id: 7, name: 'Owner', avatarUrl: null },
  route,
  routeGeometry: null,
  routeSummary: {
    distanceKm: 30,
    durationMin: 55,
    elevationGainM: 120,
    stopsCount: route.length,
    provider: 'ors',
  },
  routingState: { provider: 'ors', isOptimal: true, fallbackReason: null, warnings: [] },
  participants: [],
  coverUrl: null,
  region: '',
  publishedToCommunity: false,
  report: null,
  isOwner: true,
  myRsvp: 'going',
  createdAt: '2026-08-27T08:00:00Z',
})

const renderBuilder = () =>
  render(<RouteBuilder trip={makeTrip()} />, { wrapper: createQueryWrapper().Wrapper })

describe('RouteBuilder desktop long-list contract', () => {
  beforeEach(() => {
    setPlatformOS('web')
    jest.spyOn(Platform, 'select').mockImplementation(((options: {
      web?: unknown
      default?: unknown
    }) => options.web ?? options.default) as typeof Platform.select)
  })
  afterEach(() => jest.restoreAllMocks())
  afterAll(() => setPlatformOS(originalPlatformOS))

  it('bounds a long route in a scroll surface without removing keyboard or a11y controls', () => {
    const { getByTestId } = renderBuilder()

    const scroll = getByTestId('route-builder-point-list-scroll')
    const scrollStyle = StyleSheet.flatten(scroll.props.style) as {
      maxHeight?: number | string
      overscrollBehaviorY?: string
    }

    expect(scrollStyle.maxHeight).toEqual(expect.stringMatching(/^clamp\(.+\)$/))
    expect(scrollStyle.overscrollBehaviorY).toBe('contain')
    expect(scroll).toHaveProp('tabIndex', 0)
    expect(scroll.props.accessibilityLabel).toEqual(expect.any(String))
    expect(scroll.props.accessibilityLabel.trim()).not.toBe('')
    expect(scroll).toHaveProp('nestedScrollEnabled', true)
    expect(scroll).toHaveProp('keyboardShouldPersistTaps', 'handled')
    expect(getByTestId('route-builder-point-49')).toBeTruthy()
    expect(getByTestId('route-builder-edit-25')).toHaveProp('accessibilityRole', 'button')
    expect(getByTestId('route-builder-edit-25').props.accessibilityLabel).toEqual(
      expect.any(String),
    )
    expect(getByTestId('route-builder-drag-25')).toHaveProp(
      'accessibilityRole',
      'adjustable',
    )
    expect(getByTestId('route-builder-drag-25')).toHaveProp('tabIndex', 0)
    expect(getByTestId('route-builder-delete-25')).toHaveProp('accessibilityRole', 'button')
  })

  it('never shows add and edit forms at the same time', () => {
    const { getByTestId, queryByTestId } = renderBuilder()

    expect(getByTestId('route-builder-add-action')).toBeTruthy()
    expect(queryByTestId('route-builder-add-form')).toBeNull()
    expect(queryByTestId('route-builder-edit-form')).toBeNull()

    fireEvent.press(getByTestId('route-builder-add-action'))

    expect(getByTestId('route-builder-add-form')).toBeTruthy()
    expect(queryByTestId('route-builder-add-action')).toBeNull()
    expect(queryByTestId('route-builder-edit-form')).toBeNull()

    fireEvent.press(getByTestId('route-builder-add-cancel'))

    expect(getByTestId('route-builder-add-action')).toBeTruthy()
    expect(queryByTestId('route-builder-add-form')).toBeNull()

    fireEvent.press(getByTestId('route-builder-add-action'))
    fireEvent.press(getByTestId('route-builder-type-custom'))
    fireEvent.changeText(getByTestId('route-builder-name'), 'Новая точка')
    fireEvent.press(getByTestId('route-builder-add'))

    expect(getByTestId('route-builder-add-action')).toBeTruthy()
    expect(queryByTestId('route-builder-add-form')).toBeNull()

    fireEvent.press(getByTestId('route-builder-add-action'))
    fireEvent.press(getByTestId('route-builder-edit-5'))

    expect(getByTestId('route-builder-edit-form')).toBeTruthy()
    expect(queryByTestId('route-builder-add-action')).toBeNull()
    expect(queryByTestId('route-builder-add-form')).toBeNull()

    fireEvent.press(getByTestId('route-builder-edit-cancel'))

    expect(getByTestId('route-builder-add-action')).toBeTruthy()
    expect(queryByTestId('route-builder-add-form')).toBeNull()
    expect(queryByTestId('route-builder-edit-form')).toBeNull()
  })
})
