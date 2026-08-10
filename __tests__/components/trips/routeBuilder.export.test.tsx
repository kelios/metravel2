import React from 'react'
import { fireEvent, render, waitFor } from '@testing-library/react-native'

import type { PlannedTrip } from '@/api/plannedTrips'
import RouteBuilder from '@/components/trips/planning/RouteBuilder'
import { buildTripRouteExportInput } from '@/components/trips/planning/tripRouteExport'
import { buildGpx } from '@/utils/routeExport'

const mockSaveRouteExportFile = jest.fn()

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

jest.mock('@/utils/routeExport', () => {
  const actual = jest.requireActual('@/utils/routeExport')
  return {
    ...actual,
    saveRouteExportFile: (...args: unknown[]) => mockSaveRouteExportFile(...args),
  }
})

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
  return function TripPlanRouteMap() {
    const { View } = require('react-native')
    return <View testID="trip-plan-route-map" />
  }
})

const routedGeometry: Array<[number, number]> = Array.from({ length: 40 }, (_, i) => [
  19.9496 + i * 0.004,
  49.2992 + i * 0.0005,
])

const makeTrip = (overrides: Partial<PlannedTrip> = {}): PlannedTrip => ({
  id: 22,
  slug: '22',
  title: 'Закопане — Буковина',
  description: '',
  startDate: '2026-08-08',
  startTime: '09:00',
  transport: 'car',
  visibility: 'private',
  seatsTotal: 4,
  startPoint: null,
  status: 'planning',
  organizer: { id: 7, name: 'Owner', avatarUrl: null },
  route: [
    { id: 'a', type: 'custom', name: 'Zakopane', description: null, coordinates: [19.9496, 49.2992], placeId: null },
    { id: 'b', type: 'custom', name: 'Bukowina', description: null, coordinates: [20.108, 49.32], placeId: null },
  ],
  routeGeometry: routedGeometry,
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

// #1304: маршрут строится во вкладке «Маршрут», а скачать его можно было только
// во вкладке «Экспорт» — владелец функциональность не нашёл.
describe('RouteBuilder route download', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockSaveRouteExportFile.mockResolvedValue(true)
  })

  it('offers GPX and KML download next to the map', () => {
    const { getByTestId } = render(<RouteBuilder trip={makeTrip()} />)

    expect(getByTestId('route-builder-export')).toBeTruthy()
    expect(getByTestId('trip-route-export-gpx')).toBeTruthy()
    expect(getByTestId('trip-route-export-kml')).toBeTruthy()
  })

  it('keeps the download available for a participant who cannot edit the route', () => {
    const { getByTestId } = render(<RouteBuilder trip={makeTrip({ isOwner: false })} />)

    expect(getByTestId('route-builder-export')).toBeTruthy()
  })

  it('builds a real file through the shared export path', async () => {
    const { getByTestId } = render(<RouteBuilder trip={makeTrip()} />)

    fireEvent.press(getByTestId('trip-route-export-gpx'))

    await waitFor(() => expect(mockSaveRouteExportFile).toHaveBeenCalledTimes(1))
    expect(mockSaveRouteExportFile.mock.calls[0][0]).toEqual(
      expect.objectContaining({ filename: expect.stringMatching(/\.gpx$/) }),
    )
  })

  it('disables the buttons until the route has two points with coordinates', () => {
    const { getByTestId } = render(
      <RouteBuilder
        trip={makeTrip({
          route: [
            { id: 'a', type: 'custom', name: 'Zakopane', description: null, coordinates: [19.9496, 49.2992], placeId: null },
          ],
          routeGeometry: null,
        })}
      />,
    )

    expect(getByTestId('trip-route-export-gpx').props.accessibilityState.disabled).toBe(true)
    expect(getByTestId('trip-route-export-kml').props.accessibilityState.disabled).toBe(true)
  })
})

// Инвариант экспорта: файл несёт проложенный трек, а не только точки — иначе
// «скачать маршрут» отдаёт прямые между waypoints.
describe('trip route export payload', () => {
  it('writes the routed geometry into the GPX track', () => {
    const gpx = buildGpx(buildTripRouteExportInput(makeTrip()))

    expect((gpx.content.match(/<trkpt/g) ?? []).length).toBe(routedGeometry.length)
    expect((gpx.content.match(/<wpt/g) ?? []).length).toBe(2)
  })

  it('falls back to the waypoint line when no routed geometry exists', () => {
    const gpx = buildGpx(buildTripRouteExportInput(makeTrip({ routeGeometry: null })))

    expect((gpx.content.match(/<trkpt/g) ?? []).length).toBe(2)
  })
})
