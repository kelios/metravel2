/**
 * #2056 — отрезки маршрута плана: разбиение повторяет бэкенд #2055
 * (`trips/route_legs.py::split_route_legs` + `_summary_for_route_points`),
 * линии карты режутся по `legs[].geometry_slice`, переезд — дуга.
 */
import type { RouteLeg, RoutePoint, RoutePointArrivalMode } from '@/api/plannedTrips'
import {
  routeLineSegments,
  splitRouteSegments,
  transferArc,
  transfersByPointIndex,
} from '@/components/trips/planning/tripRouteLegs'
import { dayGroupDistanceKm } from '@/components/trips/planning/routePointDays'

const point = (
  id: string,
  coordinates: [number, number] | null,
  arrivalMode: RoutePointArrivalMode | null = null,
  dayNumber: number | null = null,
): RoutePoint => ({
  id,
  type: 'custom',
  name: id,
  description: null,
  coordinates,
  placeId: null,
  arrivalMode,
  dayNumber,
})

// Пешком по Мюллерталю, перелёт Мюнхен → Люксембург и снова пешком.
const ECHTERNACH: [number, number] = [6.4214, 49.8117]
const BERDORF: [number, number] = [6.3508, 49.8206]
const MUC: [number, number] = [11.786, 48.3538]
const LUX: [number, number] = [6.2044, 49.6233]
const MUELLERTHAL: [number, number] = [6.3208, 49.7897]

describe('splitRouteSegments — parity with backend split_route_legs (#2055)', () => {
  it('two walking parts and a flight give two runs and one transfer', () => {
    const route = [
      point('a', ECHTERNACH),
      point('b', MUC),
      point('c', LUX, 'flight'),
      point('d', MUELLERTHAL),
    ]
    const segments = splitRouteSegments(route)
    expect(segments.map((segment) => [segment.kind, segment.fromIndex, segment.toIndex])).toEqual([
      ['route', 0, 1],
      ['transfer', 1, 2],
      ['route', 2, 3],
    ])
    const transfer = segments[1]
    expect(transfer.kind === 'transfer' && transfer.mode).toBe('flight')
    // MUC → LUX по прямой ≈ 431 км — так переезд меряет и бэкенд.
    expect(transfer.kind === 'transfer' && Math.round(transfer.distanceKm)).toBe(431)
  })

  it('keeps a single run with every routable point when nothing is a transfer', () => {
    const route = [point('a', ECHTERNACH), point('x', null), point('b', BERDORF)]
    expect(splitRouteSegments(route)).toEqual([
      { kind: 'route', fromIndex: 0, toIndex: 2, points: [ECHTERNACH, BERDORF] },
    ])
  })

  it('ignores the arrival mode of the first point, like the backend', () => {
    const route = [point('a', ECHTERNACH, 'train'), point('b', BERDORF)]
    expect(splitRouteSegments(route).map((segment) => segment.kind)).toEqual(['route'])
  })

  it('skips runs below two routable points and keeps a transfer without coordinates at 0 km', () => {
    const route = [
      point('a', ECHTERNACH),
      point('b', null, 'train'),
      point('c', LUX, 'flight'),
      point('d', MUELLERTHAL),
    ]
    const segments = splitRouteSegments(route)
    // [a] и [b] — прогоны короче двух точек: бэкенд их пропускает.
    expect(segments.map((segment) => segment.kind)).toEqual(['transfer', 'transfer', 'route'])
    expect(segments[0]).toMatchObject({ kind: 'transfer', mode: 'train', line: null, distanceKm: 0 })
    expect(segments[1]).toMatchObject({ kind: 'transfer', mode: 'flight', line: null, distanceKm: 0 })
    expect(segments[2]).toMatchObject({ kind: 'route', fromIndex: 2, toIndex: 3 })
  })

  it('indexes transfers by their destination point for the list plaque', () => {
    const route = [point('a', MUC), point('b', LUX, 'flight'), point('c', MUELLERTHAL)]
    const transfers = transfersByPointIndex(route)
    expect([...transfers.keys()]).toEqual([1])
    expect(transfers.get(1)?.mode).toBe('flight')
  })
})

describe('transferArc', () => {
  it('starts and ends exactly at the transfer endpoints and bulges off the straight line', () => {
    const arc = transferArc(MUC, LUX)
    expect(arc[0]).toEqual(MUC)
    expect(arc[arc.length - 1]).toEqual(LUX)
    const middle = arc[Math.floor(arc.length / 2)]
    const straightMiddle = [(MUC[0] + LUX[0]) / 2, (MUC[1] + LUX[1]) / 2]
    expect(Math.hypot(middle[0] - straightMiddle[0], middle[1] - straightMiddle[1])).toBeGreaterThan(0.5)
  })
})

describe('routeLineSegments — map lines by legs[].geometry_slice', () => {
  const route = [
    point('a', [0, 0]),
    point('b', [1, 0]),
    point('c', [5, 0], 'flight'),
    point('d', [6, 0]),
  ]
  // Склейка бэкенда: прогон [0,2), переезд [2,4), прогон [4,6).
  const geometry: Array<[number, number]> = [[0, 0], [1, 0], [1, 0], [5, 0], [5, 0], [6, 0]]
  const leg = (mode: RouteLeg['mode'], slice: [number, number], provider = 'ors'): RouteLeg => ({
    fromIndex: 0,
    toIndex: 0,
    mode,
    distanceKm: 1,
    durationMin: mode === 'route' ? 10 : null,
    provider,
    geometrySlice: slice,
  })

  it('returns null without transfers — the maps keep their single line', () => {
    expect(routeLineSegments(route.map((item) => ({ ...item, arrivalMode: null })), null, null)).toBeNull()
    expect(routeLineSegments(route, geometry, [leg('route', [0, 6])])).toBeNull()
  })

  it('draws routed slices and a dashed arc for the flight, never a solid line across it', () => {
    const segments = routeLineSegments(route, geometry, [
      leg('route', [0, 2]),
      leg('flight', [2, 4], 'transfer'),
      leg('route', [4, 6]),
    ])
    expect(segments?.map((segment) => segment.style)).toEqual(['route', 'transfer', 'route'])
    expect(segments?.[0].line).toEqual([[0, 0], [1, 0]])
    expect(segments?.[2].line).toEqual([[5, 0], [6, 0]])
    const arc = segments?.[1].line ?? []
    expect(arc[0]).toEqual([1, 0])
    expect(arc[arc.length - 1]).toEqual([5, 0])
    expect(arc.length).toBeGreaterThan(2)
  })

  it('keeps only the degraded run approximate', () => {
    const segments = routeLineSegments(route, geometry, [
      leg('route', [0, 2], 'direct'),
      leg('flight', [2, 4], 'transfer'),
      leg('route', [4, 6]),
    ])
    expect(segments?.map((segment) => segment.style)).toEqual(['approximate', 'transfer', 'route'])
  })

  it('falls back to straight approximate runs when the slices do not match the geometry', () => {
    const segments = routeLineSegments(route, geometry.slice(0, 5), [
      leg('route', [0, 2]),
      leg('flight', [2, 4], 'transfer'),
      leg('route', [4, 6]),
    ])
    expect(segments?.map((segment) => segment.style)).toEqual(['approximate', 'transfer', 'approximate'])
    expect(segments?.[0].line).toEqual([[0, 0], [1, 0]])
  })
})

describe('dayGroupDistanceKm — a transfer does not make the day longer (#2056)', () => {
  it('counts the walk and skips the flight edge of the same day', () => {
    const route = [
      point('a', ECHTERNACH, null, 1),
      point('b', BERDORF, null, 1),
      point('c', LUX, 'flight', 1),
    ]
    const walkOnly = dayGroupDistanceKm(route.slice(0, 2), [0, 1])
    expect(dayGroupDistanceKm(route, [0, 1, 2])).toBeCloseTo(walkOnly, 6)
    expect(dayGroupDistanceKm(route.map((item) => ({ ...item, arrivalMode: null })), [0, 1, 2]))
      .toBeGreaterThan(walkOnly + 10)
  })
})
