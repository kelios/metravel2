// __tests__/trips/tripRoutePreview.test.ts
// #1490: разбор ответа движка маршрутизации в доменные RouteSummary/RoutingState
// и профиль высот превью. Ни одна цифра здесь не считается локальной формулой —
// они приходят из ответа движка и из useElevation.

import type { UseMapRoutingResult } from '@/components/map-core/useMapRouting'
import type { RoutePoint } from '@/api/plannedTrips'
import {
  isPreviewDegraded,
  isRoutableTransport,
  previewElevation,
  previewGeometry,
  previewPointsKey,
  previewRoutingState,
  previewSummary,
  routablePreviewPoints,
  schematicRoutingState,
  schematicSummary,
} from '@/components/trips/planning/tripRoutePreview'

const pt = (id: string, coordinates: [number, number] | null): RoutePoint => ({
  id,
  type: 'custom',
  name: id,
  description: null,
  coordinates,
  placeId: null,
})

// Ломаная «в горку и обратно»: одинаковых координат нет, поэтому дистанция
// вдоль неё строго растёт.
const routedCoords = (count: number): Array<[number, number]> =>
  Array.from({ length: count }, (_, index) => [27.5 + index * 0.001, 53.9 + index * 0.001] as [number, number])

const result = (overrides: Partial<UseMapRoutingResult> = {}): UseMapRoutingResult => ({
  loading: false,
  error: null,
  distance: 18_450,
  duration: 3_120,
  coords: routedCoords(40),
  elevationGain: 132,
  elevationLoss: 118,
  elevationSamples: null,
  ...overrides,
})

describe('routablePreviewPoints', () => {
  it('keeps only points with finite coordinates, as [lng, lat]', () => {
    const points = routablePreviewPoints([
      pt('a', [27.56, 53.9]),
      pt('b', null),
      pt('c', [Number.NaN, 53.8]),
      pt('d', [26.69, 53.22]),
    ])

    expect(points).toEqual([
      [27.56, 53.9],
      [26.69, 53.22],
    ])
  })
})

describe('previewPointsKey', () => {
  it('changes with the transport mode on the very same points', () => {
    const points: Array<[number, number]> = [
      [27.56, 53.9],
      [26.69, 53.22],
    ]

    expect(previewPointsKey(points, 'car')).not.toBe(previewPointsKey(points, 'bike'))
  })

  it('changes when a point moves', () => {
    const before = previewPointsKey([[27.56, 53.9], [26.69, 53.22]], 'car')
    const after = previewPointsKey([[27.56, 53.9], [26.7, 53.22]], 'car')

    expect(after).not.toBe(before)
  })
})

describe('previewSummary', () => {
  it('takes distance and duration from the routing engine answer', () => {
    const summary = previewSummary(result(), [pt('a', [27.56, 53.9]), pt('b', [26.69, 53.22])])

    expect(summary).toEqual({
      distanceKm: 18.5,
      durationMin: 52,
      elevationGainM: 132,
      stopsCount: 1,
      provider: 'preview',
      updatedAt: null,
    })
  })

  it('reports no elevation when the engine did not measure it', () => {
    const summary = previewSummary(result({ elevationGain: null }), [
      pt('a', [27.56, 53.9]),
      pt('b', [26.69, 53.22]),
    ])

    expect(summary?.elevationGainM).toBe(0)
  })

  it('has nothing to show while the engine is still building', () => {
    expect(previewSummary(result({ loading: true }), [])).toBeNull()
    expect(previewSummary(null, [])).toBeNull()
  })

  it('marks a degraded answer as a direct line, not as a route', () => {
    const summary = previewSummary(result({ error: 'ORS недоступен' }), [
      pt('a', [27.56, 53.9]),
      pt('b', [26.69, 53.22]),
    ])

    expect(summary?.provider).toBe('direct')
  })
})

describe('previewGeometry / previewRoutingState', () => {
  it('draws the engine geometry and calls the route routed', () => {
    const ok = result()

    expect(previewGeometry(ok)).toBe(ok.coords)
    expect(previewRoutingState(ok)).toEqual({
      provider: 'preview',
      isOptimal: true,
      fallbackReason: null,
      warnings: [],
    })
    expect(isPreviewDegraded(ok)).toBe(false)
  })

  it('never passes a degraded straight line off as route geometry', () => {
    const degraded = result({ error: 'Сервис маршрутов недоступен' })

    expect(previewGeometry(degraded)).toBeNull()
    expect(previewRoutingState(degraded)).toEqual({
      provider: 'direct',
      isOptimal: false,
      fallbackReason: 'Сервис маршрутов недоступен',
      warnings: [],
    })
    expect(isPreviewDegraded(degraded)).toBe(true)
  })

  it('shows nothing at all while the engine is loading', () => {
    const loading = result({ loading: true })

    expect(previewGeometry(loading)).toBeNull()
    expect(previewRoutingState(loading)).toBeNull()
  })
})

describe('schematicRoutingState', () => {
  it('is approximate by construction — public/mixed is never auto-routed', () => {
    expect(schematicRoutingState()).toEqual({
      provider: 'schematic',
      isOptimal: false,
      fallbackReason: null,
      warnings: [],
    })
    expect(isRoutableTransport('public')).toBe(false)
    expect(isRoutableTransport('mixed')).toBe(false)
    expect(isRoutableTransport('bike')).toBe(true)
  })

  it('counts stops but invents neither distance nor time', () => {
    const summary = schematicSummary([pt('a', [27.56, 53.9]), pt('b', [26.69, 53.22]), pt('c', [26.4, 53.4])])

    expect(summary).toEqual({
      distanceKm: 0,
      durationMin: 0,
      elevationGainM: 0,
      stopsCount: 2,
      provider: 'schematic',
      updatedAt: null,
    })
    expect(schematicSummary([pt('a', [27.56, 53.9])])).toBeNull()
  })
})

describe('previewElevation', () => {
  it('spreads sparse elevation samples back over the routed line', () => {
    const coords = routedCoords(40)
    const preview = previewElevation(
      result({
        coords,
        elevationSamples: [
          { index: 0, elevationM: 200 },
          { index: 20, elevationM: 260 },
          { index: 39, elevationM: 210 },
        ],
      }),
    )

    expect(preview).not.toBeNull()
    // Профиль несёт ровно замеренные точки, а линия — всю геометрию маршрута,
    // поэтому дистанция по оси X считается вдоль дороги.
    expect(preview?.elevationProfile).toHaveLength(3)
    expect(preview?.linePoints).toHaveLength(coords.length)
    expect(preview?.elevationProfile.map((sample) => sample.elevationM)).toEqual([200, 260, 210])
    expect(preview?.elevationProfile[0].distanceKm).toBe(0)
    expect(preview?.elevationProfile[2].distanceKm).toBeGreaterThan(
      preview?.elevationProfile[1].distanceKm ?? 0,
    )
  })

  it('has no profile without measurements', () => {
    expect(previewElevation(result({ elevationSamples: null }))).toBeNull()
    expect(previewElevation(result({ elevationSamples: [{ index: 0, elevationM: 200 }] }))).toBeNull()
  })

  it('has no profile for a degraded straight line', () => {
    expect(
      previewElevation(
        result({
          error: 'нет провайдера',
          elevationSamples: [
            { index: 0, elevationM: 200 },
            { index: 20, elevationM: 260 },
          ],
        }),
      ),
    ).toBeNull()
  })
})
