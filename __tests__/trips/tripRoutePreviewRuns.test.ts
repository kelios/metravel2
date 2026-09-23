// __tests__/trips/tripRoutePreviewRuns.test.ts
// #2056: превью маршрута с переездами — прогоны отдельно, итог по отрезкам как
// у бэкенда (`combine_route_legs`), переезды в дистанцию и время не входят.
import type { UseMapRoutingResult } from '@/components/map-core/useMapRouting'
import type { RoutePoint, RoutePointArrivalMode } from '@/api/plannedTrips'
import {
  combinePreviewRuns,
  previewPointsKey,
  previewRouteShapeKey,
  previewRunPlan,
  previewSummary,
  routablePreviewPoints,
} from '@/components/trips/planning/tripRoutePreview'

const pt = (
  id: string,
  coordinates: [number, number] | null,
  arrivalMode: RoutePointArrivalMode | null = null,
): RoutePoint => ({ id, type: 'custom', name: id, description: null, coordinates, placeId: null, arrivalMode })

const result = (overrides: Partial<UseMapRoutingResult> = {}): UseMapRoutingResult => ({
  loading: false,
  error: null,
  distance: 10_000,
  duration: 7_200,
  coords: [[0, 0], [0.5, 0.1], [1, 0]],
  elevationGain: 100,
  elevationLoss: 90,
  elevationSamples: null,
  ...overrides,
})

// Две пешие части и перелёт между ними.
const route = [
  pt('a', [0, 0]),
  pt('b', [1, 0]),
  pt('c', [5, 0], 'flight'),
  pt('d', [6, 0]),
]

describe('previewRunPlan', () => {
  it('two walking parts and a flight → two routing requests, the flight is not routed', () => {
    const plan = previewRunPlan(route)
    expect(plan.runs).toEqual([
      [[0, 0], [1, 0]],
      [[5, 0], [6, 0]],
    ])
  })

  it('a trip without transfers keeps one run with every routable point', () => {
    const plain = route.map((point) => ({ ...point, arrivalMode: null }))
    expect(previewRunPlan(plain).runs).toEqual([routablePreviewPoints(plain)])
  })
})

describe('previewRouteShapeKey', () => {
  it('equals the old points key without transfers', () => {
    const plain = route.map((point) => ({ ...point, arrivalMode: null }))
    expect(previewRouteShapeKey(plain, 'foot')).toBe(previewPointsKey(routablePreviewPoints(plain), 'foot'))
  })

  it('changes when a transfer appears, but not when only its mode changes', () => {
    const plain = route.map((point) => ({ ...point, arrivalMode: null }))
    const byTrain = route.map((point) => (point.id === 'c' ? { ...point, arrivalMode: 'train' as const } : point))
    expect(previewRouteShapeKey(route, 'foot')).not.toBe(previewRouteShapeKey(plain, 'foot'))
    expect(previewRouteShapeKey(route, 'foot')).toBe(previewRouteShapeKey(byTrain, 'foot'))
  })
})

describe('combinePreviewRuns', () => {
  const plan = previewRunPlan(route)
  const first = result({ distance: 12_000, duration: 10_800, coords: [[0, 0], [0.5, 0.2], [1, 0]] })
  const second = result({ distance: 3_000, duration: 2_700, coords: [[5, 0], [6, 0]] })

  it('is loading until every run answered', () => {
    expect(combinePreviewRuns(plan, [first], route)).toMatchObject({ loading: true, summary: null, geometry: null })
  })

  it('sums distance and time over the runs only and keeps transfers apart', () => {
    const view = combinePreviewRuns(plan, [first, second], route)
    expect(view.loading).toBe(false)
    expect(view.degraded).toBe(false)
    expect(view.summary).toMatchObject({
      distanceKm: 15,
      durationMin: 225,
      provider: 'preview',
      stopsCount: 4,
    })
    // [1,0] → [5,0] по прямой ≈ 444,8 км — отдельной суммой.
    expect(view.summary?.transferDistanceKm).toBeGreaterThan(440)
    expect(view.summary?.transferDistanceKm).toBeLessThan(450)
    expect(view.summary?.legs?.map((leg) => [leg.mode, leg.provider, leg.geometrySlice, leg.durationMin])).toEqual([
      ['route', 'preview', [0, 3], 180],
      ['flight', 'transfer', [3, 5], null],
      ['route', 'preview', [5, 7], 45],
    ])
    expect(view.geometry).toEqual([[0, 0], [0.5, 0.2], [1, 0], [1, 0], [5, 0], [5, 0], [6, 0]])
    expect(view.routingState).toMatchObject({ provider: 'preview', isOptimal: true })
    // Профиль высот по склеенной линии рисовал бы перелёт рельефом.
    expect(view.elevation).toBeNull()
  })

  it('degrades only the failed run: its straight points, direct leg, direct summary', () => {
    const failed = result({ error: 'ors_http_404', coords: [[5, 0], [6, 0]], distance: 2_000, duration: 5_000 })
    const view = combinePreviewRuns(plan, [first, failed], route)
    expect(view.degraded).toBe(true)
    expect(view.summary?.provider).toBe('direct')
    expect(view.summary?.legs?.map((leg) => leg.provider)).toEqual(['preview', 'transfer', 'direct'])
    expect(view.geometry?.slice(0, 3)).toEqual(first.coords)
    expect(view.routingState).toMatchObject({ provider: 'direct', isOptimal: false, fallbackReason: 'ors_http_404' })
  })

  it('delegates a transfer-free route to the single-answer functions unchanged', () => {
    const plain = route.map((point) => ({ ...point, arrivalMode: null }))
    const view = combinePreviewRuns(previewRunPlan(plain), [first], plain)
    expect(view.summary).toEqual(previewSummary(first, plain))
    expect(view.summary).not.toHaveProperty('legs')
    expect(view.geometry).toBe(first.coords)
  })

  it('a trip of transfers only has nothing to route and still reports the transfers', () => {
    const flightsOnly = [pt('a', [1, 0]), pt('b', [5, 0], 'flight')]
    const view = combinePreviewRuns(previewRunPlan(flightsOnly), [], flightsOnly)
    expect(view.loading).toBe(false)
    expect(view.summary?.distanceKm).toBe(0)
    expect(view.summary?.transferDistanceKm).toBeGreaterThan(440)
  })
})
