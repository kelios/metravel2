import { filterTravelsByRadius } from '@/hooks/map/useMapTravels';
import type { TravelCoords } from '@/src/types/types';

describe('filterTravelsByRadius', () => {
  const center = { lat: 53.9, lng: 27.56 }; // Minsk
  const radiusMeters = 60_000;

  const mk = (partial: Partial<TravelCoords>): TravelCoords => {
    return {
      categoryName: partial.categoryName ?? 'Test',
      lat: partial.lat ?? '',
      lng: partial.lng ?? '',
      travelImageThumbUrl: partial.travelImageThumbUrl ?? '',
      urlTravel: partial.urlTravel ?? '',
      coord: partial.coord,
      address: partial.address,
      articleUrl: partial.articleUrl,
    };
  };

  test('keeps points within radius and removes points outside radius', () => {
    const within = mk({ coord: '53.95,27.60' });
    const far = mk({ coord: '54.70,30.00' });

    const out = filterTravelsByRadius([within, far], center, radiusMeters);
    expect(out).toHaveLength(1);
    expect(out[0]).toBe(within);
  });

  test('drops items with invalid/unparseable coords in radius mode', () => {
    const invalid1 = mk({ coord: 'abc' });
    const invalid2 = mk({ coord: '', lat: 'not-a-number', lng: '27.0' });
    const within = mk({ coord: '53.95,27.60' });

    const out = filterTravelsByRadius([invalid1, invalid2, within], center, radiusMeters);
    expect(out).toEqual([within]);
  });

  test('handles swapped coord order by choosing the candidate closest to center', () => {
    const swapped = mk({ coord: '27.60,53.95' });

    const out = filterTravelsByRadius([swapped], center, radiusMeters);
    expect(out).toEqual([swapped]);
  });

  test('falls back to lat/lng fields when coord is missing', () => {
    const within = mk({ coord: undefined, lat: '53.95', lng: '27.60' });
    const far = mk({ coord: undefined, lat: '54.70', lng: '30.00' });

    const out = filterTravelsByRadius([within, far], center, radiusMeters);
    expect(out).toEqual([within]);
  });
});
