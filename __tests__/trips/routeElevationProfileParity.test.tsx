import { renderHook } from '@testing-library/react-native'

import { mapTripRouteElevation } from '@/api/plannedTripsNormalizers'
import { useRouteElevationModel } from '@/components/travel/details/sections/routeElevationProfile/useRouteElevationModel'
import orsRouteSummary from '../fixtures/tripRouteSummaryOrs.json'

// Живой ответ production `/api/trips/22/route-summary/` после ORS-пересчёта.
// График планировщика обязан показывать те же набор/сброс, что отдал бэк, иначе
// сводка маршрута и профиль высот разойдутся на одной странице.
describe('planner elevation profile parity with the route-summary response', () => {
  it('derives the same ascent and descent as the API from the stored polyline', () => {
    const elevation = mapTripRouteElevation(orsRouteSummary)
    expect(elevation.provider).toBe('ors')
    expect(elevation.preview).not.toBeNull()

    const { result } = renderHook(() =>
      useRouteElevationModel({
        preview: elevation.preview!,
        width: 600,
        isCompactLayout: false,
        activeSampleIndex: null,
        placeHints: [],
      }),
    )
    const metrics = result.current.metrics

    expect(metrics.hasElevation).toBe(true)
    expect(Math.round(metrics.ascent)).toBe(orsRouteSummary.ascent_m)
    expect(Math.round(metrics.descent)).toBe(orsRouteSummary.descent_m)
    expect(elevation.ascentM).toBe(orsRouteSummary.ascent_m)
    expect(elevation.descentM).toBe(orsRouteSummary.descent_m)
  })

  it('measures the same route length and a plausible elevation band', () => {
    const elevation = mapTripRouteElevation(orsRouteSummary)
    const { result } = renderHook(() =>
      useRouteElevationModel({
        preview: elevation.preview!,
        width: 600,
        isCompactLayout: false,
        activeSampleIndex: null,
        placeHints: [],
      }),
    )
    const metrics = result.current.metrics

    // Дистанция считается по той же полилинии, что и на бэке: допускаем 2%.
    expect(metrics.totalDistanceKm).toBeGreaterThan((orsRouteSummary.distance_m / 1000) * 0.98)
    expect(metrics.totalDistanceKm).toBeLessThan((orsRouteSummary.distance_m / 1000) * 1.02)
    expect(metrics.minElevation).toBeCloseTo(729, 0)
    expect(metrics.maxElevation).toBeCloseTo(1014, 0)
    expect(result.current.chartPoints.length).toBe(elevation.preview!.elevationProfile.length)
  })
})
