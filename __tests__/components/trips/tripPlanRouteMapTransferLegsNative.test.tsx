/**
 * #2056 — переезд на native-карте планировщика: отрезки линии уезжают в
 * WebView внутри payload планировщика (`routePointMarkers.lineSegments`) с
 * цветом дуги; без переездов поля нет, и WebView рисует одну линию.
 */
import React from 'react'
import { render } from '@testing-library/react-native'

import type { RoutePoint, RouteSummary } from '@/api/plannedTrips'

const mockMapProps: Array<Record<string, unknown>> = []

jest.mock('@/components/MapPage/Map', () => {
  const { View } = require('react-native')
  const MockNativeMap = (props: Record<string, unknown>) => {
    mockMapProps.push(props)
    return <View testID="native-map" />
  }
  return { __esModule: true, default: MockNativeMap }
})

jest.mock('@/hooks/useTheme', () => ({
  useThemedColors: () =>
    new Proxy({}, { get: (_t, key) => String(key) }) as unknown as Record<string, string>,
}))

import TripPlanRouteMap from '@/components/trips/planning/TripPlanRouteMap'

const point = (id: string, coordinates: [number, number], arrivalMode: RoutePoint['arrivalMode'] = null): RoutePoint => ({
  id, type: 'custom', name: id, description: null, coordinates, placeId: null, arrivalMode,
})

const route = [point('a', [6.42, 49.81]), point('b', [11.78, 48.35]), point('c', [6.2, 49.62], 'flight'), point('d', [6.32, 49.79])]
const geometry: Array<[number, number]> = [
  [6.42, 49.81], [11.78, 48.35],
  [11.78, 48.35], [6.2, 49.62],
  [6.2, 49.62], [6.32, 49.79],
]
const summary: RouteSummary = {
  distanceKm: 380,
  durationMin: 5000,
  elevationGainM: 0,
  stopsCount: 4,
  provider: 'ors',
  transferDistanceKm: 431,
  legs: [
    { fromIndex: 0, toIndex: 1, mode: 'route', distanceKm: 380, durationMin: 5000, provider: 'ors', geometrySlice: [0, 2] },
    { fromIndex: 1, toIndex: 2, mode: 'flight', distanceKm: 431, durationMin: null, provider: 'transfer', geometrySlice: [2, 4] },
    { fromIndex: 2, toIndex: 3, mode: 'route', distanceKm: 20, durationMin: 300, provider: 'ors', geometrySlice: [4, 6] },
  ],
}

describe('TripPlanRouteMap (native) — переезды (#2056)', () => {
  beforeEach(() => {
    mockMapProps.length = 0
  })

  it('sends the transfer arc and routed slices to the WebView payload', () => {
    render(<TripPlanRouteMap route={route} routeGeometry={geometry} summary={summary} />)
    const markers = mockMapProps.at(-1)!.routePointMarkers as {
      lineSegments?: Array<{ style: string; line: Array<[number, number]> }>
      transferColor?: string
    }
    expect(markers.lineSegments?.map((segment) => segment.style)).toEqual(['route', 'transfer', 'route'])
    expect(markers.lineSegments?.[0].line).toEqual([[6.42, 49.81], [11.78, 48.35]])
    expect(markers.transferColor).toBe('infoDark')
    // Кадр по-прежнему по всей линии маршрута.
    expect(mockMapProps.at(-1)!.fullRouteCoords).toHaveLength(6)
  })

  it('sends no segments without transfers', () => {
    render(<TripPlanRouteMap route={route.map((item) => ({ ...item, arrivalMode: null }))} routeGeometry={geometry} />)
    const markers = mockMapProps.at(-1)!.routePointMarkers as Record<string, unknown>
    expect(markers).not.toHaveProperty('lineSegments')
  })
})
