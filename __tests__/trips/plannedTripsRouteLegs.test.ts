// #2056: отрезки сводки #2055 доезжают в домен индексами `route`, переезды —
// отдельной суммой; битый отрезок отбрасывается, а не режет геометрию наугад.
import { mapTrip, type PlannedTripDto } from '@/api/plannedTripsNormalizers'

const dto = (routeSummary: PlannedTripDto['route_summary']): PlannedTripDto => ({
  id: 47,
  title: 'Mullerthal Trail',
  start_date: '2026-09-25',
  status: 'planned',
  transport_mode: 'walk',
  owner: { id: 7, username: 'Owner', avatar: null },
  // `order` бэкенда не обязан идти подряд с единицы.
  route: {
    points: [
      { id: 11, order: 3, point_type: 'custom', title: 'Munich', lat: 48.3538, lng: 11.786 },
      { id: 12, order: 5, point_type: 'custom', title: 'Luxembourg', lat: 49.6233, lng: 6.2044, arrival_mode: 'flight' },
      { id: 13, order: 9, point_type: 'custom', title: 'Echternach', lat: 49.8117, lng: 6.4214 },
    ],
  },
  route_summary: routeSummary,
  participants: [],
  is_public: false,
  max_participants: 1,
})

describe('route_summary.legs → RouteSummary.legs', () => {
  it('maps backend orders to route indices and keeps transfers apart', () => {
    const trip = mapTrip(dto({
      distance_km: 21.4,
      transfer_distance_km: 431.2,
      duration_min: 300,
      stops_count: 3,
      provider: 'ors',
      legs: [
        { from_order: 3, to_order: 5, mode: 'flight', distance_m: 431_200, duration_s: null, provider: 'transfer', geometry_slice: [0, 2] },
        { from_order: 5, to_order: 9, mode: 'route', distance_m: 21_400, duration_s: 18_000, provider: 'ors', geometry_slice: [2, 40] },
      ],
    }))
    expect(trip.routeSummary?.transferDistanceKm).toBe(431.2)
    expect(trip.routeSummary?.distanceKm).toBe(21.4)
    expect(trip.routeSummary?.legs).toEqual([
      { fromIndex: 0, toIndex: 1, mode: 'flight', distanceKm: 431.2, durationMin: null, provider: 'transfer', geometrySlice: [0, 2] },
      { fromIndex: 1, toIndex: 2, mode: 'route', distanceKm: 21.4, durationMin: 300, provider: 'ors', geometrySlice: [2, 40] },
    ])
  })

  it('drops a leg with an unknown mode, a foreign order or a broken slice', () => {
    const trip = mapTrip(dto({
      distance_km: 1,
      legs: [
        { from_order: 3, to_order: 5, mode: 'rocket', distance_m: 1, provider: 'transfer', geometry_slice: [0, 2] },
        { from_order: 1, to_order: 5, mode: 'route', distance_m: 1, provider: 'ors', geometry_slice: [0, 2] },
        { from_order: 5, to_order: 9, mode: 'route', distance_m: 1, provider: 'ors', geometry_slice: [4, 2] },
        null,
      ],
    }))
    expect(trip.routeSummary?.legs).toEqual([])
  })

  it('leaves both fields undefined for a summary without #2055', () => {
    const trip = mapTrip(dto({ distance_km: 12, duration_min: 60, stops_count: 3, provider: 'ors' }))
    expect(trip.routeSummary?.legs).toBeUndefined()
    expect(trip.routeSummary?.transferDistanceKm).toBeUndefined()
  })
})
