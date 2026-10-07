// CQ-2: единственная реализация расстояния по дуге большого круга (Haversine).
// Раньше в проекте жило 17 копий с разными радиусами (6371 / 6371e3) и
// единицами (км / м); здесь один радиус, а единицу выбирает вызывающий.

/** Средний радиус Земли, км. */
export const EARTH_RADIUS_KM = 6371;
/** Средний радиус Земли, м. */
export const EARTH_RADIUS_M = EARTH_RADIUS_KM * 1000;

const toRad = (deg: number): number => (deg * Math.PI) / 180;

/** Расстояние между двумя точками (lat/lng в градусах) в МЕТРАХ. */
export function haversineMeters(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const s1 = Math.sin(dLat / 2);
  const s2 = Math.sin(dLng / 2);
  // Почти антиподальные точки дают h = 1 + ε из-за округления; без clamp
  // `Math.sqrt(1 - h)` вернул бы NaN (бывшие копии держали `Math.min(1, …)`).
  const h = Math.min(1, s1 * s1 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * s2 * s2);
  return 2 * EARTH_RADIUS_M * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/** Расстояние между двумя точками (lat/lng в градусах) в КИЛОМЕТРАХ. */
export function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  return haversineMeters(aLat, aLng, bLat, bLng) / 1000;
}
