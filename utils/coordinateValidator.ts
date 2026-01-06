/**
 * Утилита для валидации координат
 * Используется во всех компонентах карты для обеспечения безопасности
 */

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface LatLng {
  lat: number;
  lng: number;
}

/**
 * Проверяет, являются ли координаты валидными
 */
export const isValidCoordinate = (lat: number, lng: number): boolean => {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
};

/**
 * Проверяет объект координат
 */
export const isValidCoordinates = (coords: Coordinates | null | undefined): coords is Coordinates => {
  if (!coords) return false;
  return isValidCoordinate(coords.latitude, coords.longitude);
};

/**
 * Проверяет объект LatLng
 */
export const isValidLatLng = (coords: LatLng | null | undefined): coords is LatLng => {
  if (!coords) return false;
  return isValidCoordinate(coords.lat, coords.lng);
};

/**
 * Возвращает безопасные координаты с fallback на дефолтные (Минск)
 */
export const getSafeCoordinates = (
  coords: Coordinates | null | undefined,
  fallback: Coordinates = { latitude: 53.9006, longitude: 27.559 }
): Coordinates => {
  if (isValidCoordinates(coords)) {
    return coords;
  }
  return fallback;
};

/**
 * Возвращает безопасные LatLng с fallback
 */
export const getSafeLatLng = (
  coords: LatLng | null | undefined,
  fallback: LatLng = { lat: 53.9006, lng: 27.559 }
): LatLng => {
  if (isValidLatLng(coords)) {
    return coords;
  }
  return fallback;
};

/**
 * Валидирует массив точек маршрута
 */
export const validateRoutePoints = (points: [number, number][]): boolean => {
  if (!Array.isArray(points) || points.length < 2) {
    return false;
  }

  return points.every(([lng, lat]) => isValidCoordinate(lat, lng));
};

/**
 * Фильтрует невалидные точки из массива
 */
export const filterValidRoutePoints = (points: [number, number][]): [number, number][] => {
  if (!Array.isArray(points)) return [];
  return points.filter(([lng, lat]) => isValidCoordinate(lat, lng));
};
