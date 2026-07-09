import type { PublicTrip, PublicTripsFilters } from '@/api/publicTrips';

/** Featured вперёд, затем по дате старта. */
export function sortPublicTrips(trips: PublicTrip[]): PublicTrip[] {
  return [...trips].sort((a, b) => {
    if (a.featured !== b.featured) return a.featured ? -1 : 1;
    return a.startDate.localeCompare(b.startDate);
  });
}

export function hasActivePublicTripFilters(filters: PublicTripsFilters): boolean {
  return Boolean(filters.region || filters.tripType || filters.status);
}

const normalizeSearch = (value: string): string =>
  value.trim().toLocaleLowerCase('ru-RU');

export function filterPublicTripsBySearch(
  trips: PublicTrip[],
  query: string,
): PublicTrip[] {
  const needle = normalizeSearch(query);
  if (!needle) return trips;

  return trips.filter((trip) => {
    const haystack = [
      trip.title,
      trip.description,
      trip.region,
      trip.tripType,
      trip.organizer.name,
    ]
      .filter((v): v is string => typeof v === 'string' && v.length > 0)
      .join(' ')
      .toLocaleLowerCase('ru-RU');

    return haystack.includes(needle);
  });
}
