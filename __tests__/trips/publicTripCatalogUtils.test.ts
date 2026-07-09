import type { PublicTrip } from '@/api/publicTrips';
import {
  filterPublicTripsBySearch,
  hasActivePublicTripFilters,
  sortPublicTrips,
} from '@/components/trips/publicTripCatalogUtils';

const baseTrip = (overrides: Partial<PublicTrip>): PublicTrip => ({
  id: 1,
  slug: '1',
  title: 'Поездка',
  coverUrl: null,
  region: 'Минск',
  tripType: 'car',
  startDate: '2026-08-01T09:00:00Z',
  endDate: null,
  organizer: { id: 1, name: 'Аня', avatarUrl: null },
  seatsTotal: 4,
  seatsTaken: 1,
  status: 'open',
  description: 'Описание',
  featured: false,
  myApplicationStatus: null,
  isOwner: false,
  meetingPoint: null,
  contactNote: null,
  ...overrides,
});

describe('publicTripCatalogUtils', () => {
  it('sorts featured trips first and then by start date', () => {
    const trips = [
      baseTrip({ id: 1, startDate: '2026-09-10T09:00:00Z' }),
      baseTrip({ id: 2, startDate: '2026-08-10T09:00:00Z' }),
      baseTrip({ id: 3, featured: true, startDate: '2026-10-10T09:00:00Z' }),
    ];

    expect(sortPublicTrips(trips).map((trip) => trip.id)).toEqual([3, 2, 1]);
  });

  it('detects active filters', () => {
    expect(hasActivePublicTripFilters({})).toBe(false);
    expect(hasActivePublicTripFilters({ status: 'full' })).toBe(true);
    expect(hasActivePublicTripFilters({ region: 'Минск' })).toBe(true);
  });

  it('filters search by title, region, organizer, and description', () => {
    const trips = [
      baseTrip({ id: 1, title: 'Поход к замкам', region: 'Несвиж' }),
      baseTrip({ id: 2, title: 'Лесной маршрут', organizer: { id: 2, name: 'Борис', avatarUrl: null } }),
      baseTrip({ id: 3, title: 'Вечерняя прогулка', description: 'Берём велосипеды' }),
    ];

    expect(filterPublicTripsBySearch(trips, 'замк').map((trip) => trip.id)).toEqual([1]);
    expect(filterPublicTripsBySearch(trips, 'борис').map((trip) => trip.id)).toEqual([2]);
    expect(filterPublicTripsBySearch(trips, 'велосип').map((trip) => trip.id)).toEqual([3]);
  });

  it('returns all trips for an empty search query', () => {
    const trips = [baseTrip({ id: 1 }), baseTrip({ id: 2 })];
    expect(filterPublicTripsBySearch(trips, '   ')).toBe(trips);
  });
});
