// CQ-2: единая реализация Haversine; все 17 бывших копий сводятся к ней, и
// единицы (км / м) выбирает вызывающий — это поведение, а не стиль.

import { EARTH_RADIUS_KM, EARTH_RADIUS_M, haversineKm, haversineMeters } from '@/utils/geoDistance';
import { haversineKm as legacyGeoHaversineKm } from '@/utils/geo';
import { calculateDistance as calculateDistanceKm } from '@/utils/distanceCalculator';
import { calculateDistance as calculateDistanceMeters } from '@/utils/coordinates';
import { CoordinateConverter } from '@/utils/coordinateConverter';
import { haversineMeters as routingHaversineMeters } from '@/utils/routingHelpers';
import { distanceKm as searchAreaDistanceKm } from '@/hooks/map/useSearchThisArea';
import { haversineKm as pointsListHaversineKm } from '@/components/UserPoints/pointsListLogic';
import { haversineMeters as elevationHaversineMeters } from '@/components/travel/details/sections/RouteElevationProfile.utils';

// Минск (центр) → Национальная библиотека: ≈ 6.4 км по дуге большого круга.
const A = { lat: 53.9006, lng: 27.559 };
const B = { lat: 53.9314, lng: 27.6462 };

describe('utils/geoDistance', () => {
  it('uses one Earth radius for both units', () => {
    expect(EARTH_RADIUS_KM).toBe(6371);
    expect(EARTH_RADIUS_M).toBe(6371000);
  });

  it('returns zero for identical points and is symmetric', () => {
    expect(haversineMeters(A.lat, A.lng, A.lat, A.lng)).toBe(0);
    expect(haversineKm(A.lat, A.lng, B.lat, B.lng)).toBeCloseTo(haversineKm(B.lat, B.lng, A.lat, A.lng), 12);
  });

  it('km is exactly meters / 1000', () => {
    const meters = haversineMeters(A.lat, A.lng, B.lat, B.lng);
    expect(meters).toBeGreaterThan(6_000);
    expect(meters).toBeLessThan(7_000);
    expect(haversineKm(A.lat, A.lng, B.lat, B.lng)).toBeCloseTo(meters / 1000, 12);
  });

  it('stays finite for near-antipodal points (h rounds to 1 + ε)', () => {
    // -87.5,-180 → 87.5,0: без clamp `Math.sqrt(1 - h)` даёт NaN.
    const m = haversineMeters(-87.5, -180, 87.5, 0);
    expect(Number.isFinite(m)).toBe(true);
    expect(m).toBeCloseTo(Math.PI * EARTH_RADIUS_M, 0);
  });

  // Каждая бывшая копия сохраняет свои единицы: км там, где были км, метры —
  // где были метры. Проверяем против единой реализации, а не против литералов.
  it('every former copy keeps its unit and delegates to the shared formula', () => {
    const km = haversineKm(A.lat, A.lng, B.lat, B.lng);
    const m = haversineMeters(A.lat, A.lng, B.lat, B.lng);

    expect(legacyGeoHaversineKm(A.lat, A.lng, B.lat, B.lng)).toBeCloseTo(km, 9);
    expect(searchAreaDistanceKm(
      { latitude: A.lat, longitude: A.lng },
      { latitude: B.lat, longitude: B.lng },
    )).toBeCloseTo(km, 9);
    expect(pointsListHaversineKm(A.lat, A.lng, B.lat, B.lng)).toBeCloseTo(km, 9);
    expect(calculateDistanceKm(A, B)).toBe(Math.round(km * 10) / 10);

    expect(calculateDistanceMeters(A, B)).toBeCloseTo(m, 6);
    expect(CoordinateConverter.distance(A, B)).toBeCloseTo(m, 6);
    expect(routingHaversineMeters([A.lng, A.lat], [B.lng, B.lat])).toBeCloseTo(m, 6);
    expect(elevationHaversineMeters(A, B)).toBeCloseTo(m, 6);
  });
});
