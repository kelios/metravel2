import React from 'react'
import { fireEvent, render, waitFor } from '@testing-library/react-native'

import type { PlannedTrip, TripRouteElevation } from '@/api/plannedTrips'
import RouteBuilder from '@/components/trips/planning/RouteBuilder'
import { createQueryWrapper } from '../../helpers/testQueryClient'

const mockRefreshElevation = jest.fn()
const mockElevationEnabled = jest.fn()
let mockElevationData: TripRouteElevation | undefined

jest.mock('@/api/places', () => ({
  fetchPlacesCatalog: jest.fn(),
}))

jest.mock('@/api/travelsApi', () => ({
  fetchTravels: jest.fn(),
}))

jest.mock('@/hooks/usePlannedTripsApi', () => ({
  useRouteTemplates: () => ({ data: [] }),
  useTripRouteElevation: (
    _tripId: number,
    options?: { enabled?: boolean },
  ) => {
    mockElevationEnabled(options?.enabled)
    return { data: mockElevationData }
  },
  useRefreshTripRouteElevation: () => ({
    mutate: mockRefreshElevation,
    isPending: false,
  }),
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
    routeGeometry,
  }: {
    routeGeometry?: Array<[number, number]> | null
  }) {
    const { Text, View } = require('react-native')
    return (
      <View testID="trip-plan-route-map">
        <Text testID="route-map-geometry">{String(routeGeometry?.length ?? 0)}</Text>
      </View>
    )
  }
})

jest.mock('@/components/travel/details/sections/RouteElevationProfile', () => ({
  __esModule: true,
  default: function RouteElevationProfile({
    preview,
    placeHints,
    transportHints,
  }: {
    preview?: { elevationProfile?: unknown[] }
    placeHints?: Array<{ name: string }>
    transportHints?: string[]
  }) {
    const { Text, View } = require('react-native')
    return (
      <View testID="route-elevation-profile">
        <Text testID="route-elevation-samples">
          {String(preview?.elevationProfile?.length ?? 0)}
        </Text>
        <Text testID="route-elevation-hints">
          {(placeHints ?? []).map((hint) => hint.name).join('|')}
        </Text>
        <Text testID="route-elevation-transport">{(transportHints ?? []).join('|')}</Text>
      </View>
    )
  },
}))

const makeTrip = (overrides: Partial<PlannedTrip> = {}): PlannedTrip => ({
  id: 22,
  slug: '22',
  title: 'Закопане — Буковина',
  description: '',
  startDate: '2026-08-08',
  startTime: '09:00',
  transport: 'car',
  bikeType: null,
  visibility: 'private',
  seatsTotal: 4,
  startPoint: null,
  status: 'planning',
  organizer: { id: 7, name: 'Owner', avatarUrl: null },
  route: [
    { id: 'a', type: 'custom', name: 'Zakopane', description: null, coordinates: [19.9496, 49.2992], placeId: null },
    { id: 'b', type: 'custom', name: 'Bukowina', description: null, coordinates: [20.108, 49.32], placeId: null },
  ],
  routeGeometry: null,
  routeSummary: {
    distanceKm: 16.5,
    durationMin: 30,
    elevationGainM: 452,
    stopsCount: 2,
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
  createdAt: '2026-08-08T08:00:00Z',
  ...overrides,
})

const makeElevation = (overrides: Partial<TripRouteElevation> = {}): TripRouteElevation => ({
  status: 'ready',
  provider: 'ors',
  ascentM: 452,
  descentM: 270,
  preview: {
    linePoints: [
      { coord: '49.29917,19.94961', elevation: 818.62 },
      { coord: '49.29913,19.94938', elevation: 830.1 },
      { coord: '49.32154,20.10814', elevation: 1000.87 },
    ],
    elevationProfile: [
      { distanceKm: 0, elevationM: 818.62 },
      { distanceKm: 0.02, elevationM: 830.1 },
      { distanceKm: 16.54, elevationM: 1000.87 },
    ],
  },
  geometry: [
    [19.94961, 49.29917],
    [19.94938, 49.29913],
    [20.10814, 49.32154],
  ],
  calculatedAt: '2026-08-08T19:11:29.496990+00:00',
  ...overrides,
})


// #1491: шаг «Точки маршрута» рендерит общий AddressSearch с /map, а он ходит за
// адресами через React Query — конструктору нужен клиент, как и в приложении.
const renderRouteBuilder = (element: React.ReactElement) =>
  render(element, { wrapper: createQueryWrapper().Wrapper })

describe('RouteBuilder elevation profile', () => {
  beforeEach(() => {
    mockRefreshElevation.mockReset()
    mockElevationEnabled.mockReset()
    mockElevationData = undefined
  })

  it('shows the shared profile under the map for a routed trip', async () => {
    mockElevationData = makeElevation()
    const { findByTestId, getByTestId } = renderRouteBuilder(<RouteBuilder trip={makeTrip()} />)

    expect(await findByTestId('route-elevation-profile')).toBeTruthy()
    expect(getByTestId('route-elevation-samples').props.children).toBe('3')
    // Названия точек маршрута подписывают старт/пик/финиш графика.
    expect(getByTestId('route-elevation-hints').props.children).toBe('Zakopane|Bukowina')
    expect(getByTestId('route-elevation-transport').props.children).toBe('На машине')
    expect(mockRefreshElevation).not.toHaveBeenCalled()
  })

  it('feeds the decoded polyline to the map when the trip has no stored geometry', async () => {
    mockElevationData = makeElevation()
    const { findByTestId, getByTestId } = renderRouteBuilder(<RouteBuilder trip={makeTrip()} />)

    await findByTestId('route-elevation-profile')
    expect(getByTestId('route-map-geometry').props.children).toBe('3')
  })

  it('keeps the trip geometry when the backend still returns it', async () => {
    mockElevationData = makeElevation()
    const trip = makeTrip({
      routeGeometry: [
        [19.9496, 49.2992],
        [20.0, 49.3],
        [20.108, 49.32],
        [20.2, 49.33],
      ],
    })
    const { findByTestId, getByTestId } = renderRouteBuilder(<RouteBuilder trip={trip} />)

    await findByTestId('route-elevation-profile')
    expect(getByTestId('route-map-geometry').props.children).toBe('4')
  })

  it('hides the graph for a direct-line route and does not ask for a recalculation', () => {
    mockElevationData = makeElevation({
      status: 'degraded',
      provider: 'direct',
      ascentM: null,
      descentM: null,
      preview: null,
      geometry: null,
    })
    const { queryByTestId } = renderRouteBuilder(
      <RouteBuilder
        trip={makeTrip({
          routingState: {
            provider: 'direct',
            isOptimal: false,
            fallbackReason: 'route_provider_unavailable',
            warnings: [],
          },
        })}
      />,
    )

    expect(queryByTestId('route-elevation-profile')).toBeNull()
    expect(mockRefreshElevation).not.toHaveBeenCalled()
  })

  it('recalculates once when a routed summary was saved without elevation', async () => {
    mockElevationData = makeElevation({ preview: null, geometry: null, ascentM: null })
    const trip = makeTrip({ routeGeometry: makeElevation().geometry })
    const { rerender } = renderRouteBuilder(<RouteBuilder trip={trip} />)

    await waitFor(() => expect(mockRefreshElevation).toHaveBeenCalledTimes(1))
    expect(mockRefreshElevation).toHaveBeenCalledWith({ tripId: 22 })

    rerender(<RouteBuilder trip={trip} />)
    rerender(<RouteBuilder trip={makeTrip()} />)
    expect(mockRefreshElevation).toHaveBeenCalledTimes(1)
  })

  // #1308: смена транспорта и типа велосипеда перестраивает маршрут на тех же
  // точках и снова стирает высоты — каждый такой профиль нужно пересчитать.
  it('recalculates again after the route is rebuilt for another transport or bike type', async () => {
    mockElevationData = makeElevation({ preview: null, geometry: null, ascentM: null })
    const routeGeometry = makeElevation().geometry
    const { rerender } = renderRouteBuilder(<RouteBuilder trip={makeTrip({ routeGeometry })} />)

    await waitFor(() => expect(mockRefreshElevation).toHaveBeenCalledTimes(1))

    rerender(<RouteBuilder trip={makeTrip({ routeGeometry, transport: 'bike', bikeType: 'regular' })} />)
    await waitFor(() => expect(mockRefreshElevation).toHaveBeenCalledTimes(2))

    rerender(<RouteBuilder trip={makeTrip({ routeGeometry, transport: 'bike', bikeType: 'mountain' })} />)
    await waitFor(() => expect(mockRefreshElevation).toHaveBeenCalledTimes(3))

    rerender(<RouteBuilder trip={makeTrip({ routeGeometry, transport: 'bike', bikeType: 'mountain' })} />)
    expect(mockRefreshElevation).toHaveBeenCalledTimes(3)
  })

  it('hides the profile once an unsaved point changes the road', async () => {
    mockElevationData = makeElevation()
    const { findByTestId, getByTestId, queryByTestId } = renderRouteBuilder(
      <RouteBuilder trip={makeTrip()} />,
    )

    await findByTestId('route-elevation-profile')

    fireEvent.press(getByTestId('route-builder-add-action'))
    fireEvent.press(getByTestId('route-builder-type-custom'))
    fireEvent.changeText(getByTestId('route-builder-name'), 'Poronin')
    fireEvent.changeText(getByTestId('route-builder-lat'), '49.339')
    fireEvent.changeText(getByTestId('route-builder-lng'), '20.009')
    fireEvent.press(getByTestId('route-builder-add'))

    expect(queryByTestId('route-elevation-profile')).toBeNull()
    expect(getByTestId('route-map-geometry').props.children).toBe('0')
  })

  // #1490: серверные высоты и геометрия описывают дорогу, а дорога зависит от
  // координат. Точка без координат на карту не попадает и обесценить их не может.
  it('keeps the profile when the added point has no coordinates', async () => {
    mockElevationData = makeElevation()
    const { findByTestId, getByTestId, queryByTestId } = renderRouteBuilder(
      <RouteBuilder trip={makeTrip()} />,
    )

    await findByTestId('route-elevation-profile')

    fireEvent.press(getByTestId('route-builder-add-action'))
    fireEvent.press(getByTestId('route-builder-type-custom'))
    fireEvent.changeText(getByTestId('route-builder-name'), 'Кофе по дороге')
    fireEvent.press(getByTestId('route-builder-add'))

    expect(queryByTestId('route-elevation-profile')).not.toBeNull()
    expect(getByTestId('route-map-geometry').props.children).toBe('3')
  })

  it('never recalculates for a participant who cannot own the route', () => {
    mockElevationData = makeElevation({ preview: null, geometry: null, ascentM: null })
    renderRouteBuilder(<RouteBuilder trip={makeTrip({ isOwner: false })} />)

    expect(mockRefreshElevation).not.toHaveBeenCalled()
  })

  it('does not request elevation for a route that cannot be routed', () => {
    renderRouteBuilder(
      <RouteBuilder
        trip={makeTrip({
          route: [
            { id: 'a', type: 'custom', name: 'A', description: null, coordinates: null, placeId: null },
            { id: 'b', type: 'custom', name: 'B', description: null, coordinates: [20.108, 49.32], placeId: null },
          ],
        })}
      />,
    )

    expect(mockElevationEnabled).toHaveBeenCalledWith(false)
  })
})
