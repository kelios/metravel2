import { mapTripRouteElevation } from '@/api/plannedTripsNormalizers'
import { decodeEncodedPolyline } from '@/utils/encodedPolyline'

// Реальный фрагмент ответа production `/api/trips/{id}/route-summary/` после
// ORS-пересчёта: полилиния кодирует высоты, ascent/descent приходят отдельно.
const ORS_ELEVATION_POLYLINE = 'yv{kHalwxBk{~CFl@hA?Zp@IVr@BZzIFJ?HF?H??HG?HO?@U?AA?CQsIOM{@'

const orsSummaryDto = {
  trip: 22,
  distance_m: 16543,
  duration_s: 1806,
  ascent_m: 452,
  descent_m: 270,
  stops_count: 3,
  provider: 'ors',
  status: 'ready',
  geometry: null,
  polyline: ORS_ELEVATION_POLYLINE,
  bounds: { south: 49.29, west: 19.94, north: 49.33, east: 20.11 },
  calculated_at: '2026-08-08T19:11:29.496990+00:00',
}

describe('mapTripRouteElevation', () => {
  it('turns an ORS elevation polyline into a route preview and route line', () => {
    const elevation = mapTripRouteElevation(orsSummaryDto)
    const decoded = decodeEncodedPolyline(ORS_ELEVATION_POLYLINE, {
      precision: 5,
      dimensions: 3,
    })

    expect(elevation.status).toBe('ready')
    expect(elevation.provider).toBe('ors')
    expect(elevation.ascentM).toBe(452)
    expect(elevation.descentM).toBe(270)
    expect(elevation.calculatedAt).toBe('2026-08-08T19:11:29.496990+00:00')

    expect(elevation.geometry).toEqual(decoded.map(([lng, lat]) => [lng, lat]))
    expect(elevation.preview?.linePoints).toHaveLength(decoded.length)
    expect(elevation.preview?.linePoints[0]).toEqual({
      coord: `${decoded[0][1]},${decoded[0][0]}`,
      elevation: decoded[0][2],
    })
  })

  it('builds a profile whose ascent and descent follow the decoded elevations', () => {
    const elevation = mapTripRouteElevation(orsSummaryDto)
    const samples = elevation.preview?.elevationProfile ?? []
    const decodedElevations = decodeEncodedPolyline(ORS_ELEVATION_POLYLINE, {
      precision: 5,
      dimensions: 3,
    }).map(([, , elevationM]) => elevationM)

    // Профиль строится тем же билдером, что и GPX-треки travel details, поэтому
    // набор/сброс на графике считаются ровно по высотам полилинии.
    expect(samples.map((sample) => sample.elevationM)).toEqual(decodedElevations)
    expect(samples.every((sample) => !sample.gapBefore)).toBe(true)
    samples.slice(1).forEach((sample, index) => {
      expect(sample.distanceKm).toBeGreaterThanOrEqual(samples[index].distanceKm)
    })
  })

  it('keeps the graph away from a direct-line fallback route', () => {
    const elevation = mapTripRouteElevation({
      trip: 22,
      distance_m: 19028,
      duration_s: 1369,
      ascent_m: null,
      descent_m: null,
      stops_count: 3,
      provider: 'direct',
      status: 'degraded',
      geometry: [
        [19.9496, 49.2992],
        [20.108, 49.32],
      ],
      polyline: null,
      bounds: null,
      calculated_at: '2026-08-08T19:10:58.231483+00:00',
    })

    expect(elevation.status).toBe('degraded')
    expect(elevation.provider).toBe('direct')
    expect(elevation.preview).toBeNull()
    expect(elevation.geometry).toBeNull()
    expect(elevation.ascentM).toBeNull()
  })

  it('treats an unavailable or missing summary as no elevation', () => {
    const unavailable = mapTripRouteElevation({
      trip: 22,
      provider: 'fallback',
      status: 'unavailable',
      polyline: null,
      calculated_at: null,
    })

    expect(unavailable.status).toBe('unavailable')
    expect(unavailable.preview).toBeNull()

    const missing = mapTripRouteElevation(null)
    expect(missing.status).toBe('unavailable')
    expect(missing.provider).toBe('unknown')
    expect(missing.preview).toBeNull()
    expect(missing.geometry).toBeNull()
  })

  it('ignores a polyline that cannot produce a drawable line', () => {
    const elevation = mapTripRouteElevation({ ...orsSummaryDto, polyline: 'yv{kHalwxBk{~C' })

    expect(elevation.geometry).toBeNull()
    expect(elevation.preview).toBeNull()
  })
})
