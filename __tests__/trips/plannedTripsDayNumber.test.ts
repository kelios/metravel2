// #1845: день похода доезжает из ответа API в доменный тип.
import { mapTrip, type PlannedTripDto } from '@/api/plannedTripsNormalizers'

const dto = (points: PlannedTripDto['route']): PlannedTripDto => ({
  id: 42,
  title: 'Mullerthal Trail',
  start_date: '2026-09-26',
  status: 'planned',
  transport_mode: 'walk',
  owner: { id: 7, username: 'Owner', avatar: null },
  route: points,
  participants: [],
  is_public: false,
  max_participants: 4,
})

describe('mapTrip day_number', () => {
  it('читает 1–60 и оставляет мусор без дня', () => {
    const trip = mapTrip(
      dto({
        points: [
          { id: 1, point_type: 'custom', title: 'Старт', lat: 49.81, lng: 6.42, day_number: 1 },
          { id: 2, point_type: 'custom', title: 'Ночёвка', lat: 49.8, lng: 6.4, day_number: 8 },
          { id: 3, point_type: 'custom', title: 'Без дня', lat: 49.79, lng: 6.39 },
          { id: 4, point_type: 'custom', title: 'Мусор', lat: 49.78, lng: 6.38, day_number: 0 },
        ],
      }),
    )

    expect(trip.route.map((point) => point.dayNumber)).toEqual([1, 8, null, null])
  })
})
