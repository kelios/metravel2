/**
 * #2056 — переезд на web-карте планировщика: прогоны — по своим срезам
 * `legs[].geometry_slice`, переезд — пунктирная дуга своего цвета с классом
 * `metravel-route-transfer`, сплошной линии поперёк переезда нет. Без
 * переездов карта рисует одну линию, как раньше.
 */
import React from 'react'
import { render, waitFor } from '@testing-library/react-native'

import type { RouteLeg, RoutePoint, RouteSummary } from '@/api/plannedTrips'

const mockPolylineProps: Array<Record<string, unknown>> = []
const mockMap = { setView: jest.fn(), fitBounds: jest.fn(), stop: jest.fn() }

jest.mock('react-dom', () => ({ createPortal: (node: unknown) => node }))
jest.mock('@/utils/ensureLeafletCss', () => ({ ensureLeafletCss: jest.fn() }))

jest.mock('@/utils/loadLeafletRuntime', () => ({
  loadLeafletRuntime: async () => ({
    L: {
      divIcon: (options: unknown) => options,
      latLngBounds: (positions: unknown) => positions,
    },
    RL: {
      Marker: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
      Popup: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
      Polyline: (props: Record<string, unknown>) => {
        mockPolylineProps.push(props)
        return null
      },
      useMap: () => mockMap,
      useMapEvents: () => null,
    },
  }),
}))

jest.mock('@/components/MapPage/Map/MapCanvas', () => ({
  MapCanvas: ({ children }: { children?: (engine: unknown) => React.ReactNode }) => (
    <div data-testid="map-canvas">{children?.({})}</div>
  ),
}))

jest.mock('@/hooks/useTheme', () => ({
  useThemedColors: () =>
    new Proxy({}, { get: (_t, key) => String(key) }) as unknown as Record<string, string>,
}))

import TripPlanRouteMap from '@/components/trips/planning/TripPlanRouteMap.web'
import { ROUTE_TRANSFER_DASH_ARRAY } from '@/components/trips/planning/tripRouteLegs'

const point = (id: string, coordinates: [number, number], arrivalMode: RoutePoint['arrivalMode'] = null): RoutePoint => ({
  id,
  type: 'custom',
  name: id,
  description: null,
  coordinates,
  placeId: null,
  arrivalMode,
})

const route = [point('a', [6.42, 49.81]), point('b', [11.78, 48.35]), point('c', [6.2, 49.62], 'flight'), point('d', [6.32, 49.79])]
const geometry: Array<[number, number]> = [
  [6.42, 49.81], [9, 49], [11.78, 48.35],
  [11.78, 48.35], [6.2, 49.62],
  [6.2, 49.62], [6.32, 49.79],
]
const leg = (mode: RouteLeg['mode'], slice: [number, number], provider: string): RouteLeg => ({
  fromIndex: 0, toIndex: 0, mode, distanceKm: 1, durationMin: null, provider, geometrySlice: slice,
})
const summary: RouteSummary = {
  distanceKm: 380,
  durationMin: 5000,
  elevationGainM: 0,
  stopsCount: 4,
  provider: 'ors',
  transferDistanceKm: 431,
  legs: [leg('route', [0, 3], 'ors'), leg('flight', [3, 5], 'transfer'), leg('route', [5, 7], 'ors')],
}

describe('TripPlanRouteMap.web — переезды (#2056)', () => {
  beforeEach(() => {
    mockPolylineProps.length = 0
  })

  it('draws two routed slices and one dashed transfer arc', async () => {
    render(<TripPlanRouteMap route={route} routeGeometry={geometry} summary={summary} />)
    await waitFor(() => expect(mockPolylineProps.length).toBe(3))

    const [first, transfer, second] = mockPolylineProps
    expect(first.positions).toEqual([[49.81, 6.42], [49, 9], [48.35, 11.78]])
    expect(second.positions).toEqual([[49.62, 6.2], [49.79, 6.32]])
    expect(first.pathOptions).toMatchObject({ color: 'primaryDark', dashArray: undefined })
    expect(transfer.pathOptions).toMatchObject({ color: 'infoDark', dashArray: ROUTE_TRANSFER_DASH_ARRAY })
    // Класс — опцией конструктора (проп), а не pathOptions: setStyle его не ставит.
    expect(transfer.className).toBe('metravel-route-transfer')
    expect(transfer.pathOptions).not.toHaveProperty('className')
    expect(first.className).toBeUndefined()
    const arc = transfer.positions as Array<[number, number]>
    expect(arc[0]).toEqual([48.35, 11.78])
    expect(arc[arc.length - 1]).toEqual([49.62, 6.2])
    expect(arc.length).toBeGreaterThan(2)
  })

  it('keeps one line when the route has no transfer', async () => {
    const plain = route.map((item) => ({ ...item, arrivalMode: null }))
    render(<TripPlanRouteMap route={plain} routeGeometry={geometry} summary={{ ...summary, legs: [leg('route', [0, 7], 'ors')] }} />)
    await waitFor(() => expect(mockPolylineProps.length).toBe(1))
    expect(mockPolylineProps[0].positions).toHaveLength(7)
  })
})
