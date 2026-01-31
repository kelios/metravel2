/**
 * Coordinate utilities - validation, normalization, conversion
 * @module utils/coordinates
 */

import {
  Coordinates,
  LatLng,
  LatLngTuple,
  LngLatTuple,
  DEFAULT_COORDINATES,
  COORDINATE_LIMITS,
  CoordinateGuards,
} from '@/types/coordinates';

/**
 * Validate if latitude value is within valid range
 */
export function isValidLatitude(lat: number): boolean {
  return (
    Number.isFinite(lat) &&
    lat >= COORDINATE_LIMITS.MIN_LATITUDE &&
    lat <= COORDINATE_LIMITS.MAX_LATITUDE
  );
}

/**
 * Validate if longitude value is within valid range
 */
export function isValidLongitude(lng: number): boolean {
  return (
    Number.isFinite(lng) &&
    lng >= COORDINATE_LIMITS.MIN_LONGITUDE &&
    lng <= COORDINATE_LIMITS.MAX_LONGITUDE
  );
}

/**
 * Validate if coordinate pair is valid
 */
export function isValidCoordinate(lat: number, lng: number): boolean {
  return isValidLatitude(lat) && isValidLongitude(lng);
}

/**
 * Validate if zoom level is within valid range
 */
export function isValidZoom(zoom: number): boolean {
  return (
    Number.isFinite(zoom) &&
    zoom >= COORDINATE_LIMITS.MIN_ZOOM &&
    zoom <= COORDINATE_LIMITS.MAX_ZOOM
  );
}

/**
 * Normalize Coordinates object, replacing invalid values with defaults
 */
export function normalizeCoordinates(coords: Partial<Coordinates> | null | undefined): Coordinates {
  if (!coords) {
    return { ...DEFAULT_COORDINATES };
  }

  const lat = typeof coords.latitude === 'number' ? coords.latitude : DEFAULT_COORDINATES.latitude;
  const lng = typeof coords.longitude === 'number' ? coords.longitude : DEFAULT_COORDINATES.longitude;
  const zoom = typeof coords.zoom === 'number' ? coords.zoom : DEFAULT_COORDINATES.zoom;

  return {
    latitude: isValidLatitude(lat) ? lat : DEFAULT_COORDINATES.latitude,
    longitude: isValidLongitude(lng) ? lng : DEFAULT_COORDINATES.longitude,
    zoom: isValidZoom(zoom!) ? zoom : DEFAULT_COORDINATES.zoom,
  };
}

/**
 * Normalize LatLng object, replacing invalid values with defaults
 */
export function normalizeLatLng(coords: Partial<LatLng> | null | undefined): LatLng {
  if (!coords) {
    return { lat: DEFAULT_COORDINATES.latitude, lng: DEFAULT_COORDINATES.longitude };
  }

  const lat = typeof coords.lat === 'number' ? coords.lat : DEFAULT_COORDINATES.latitude;
  const lng = typeof coords.lng === 'number' ? coords.lng : DEFAULT_COORDINATES.longitude;

  return {
    lat: isValidLatitude(lat) ? lat : DEFAULT_COORDINATES.latitude,
    lng: isValidLongitude(lng) ? lng : DEFAULT_COORDINATES.longitude,
  };
}

/**
 * Convert Coordinates to LatLng
 */
export function coordinatesToLatLng(coords: Coordinates): LatLng {
  return {
    lat: coords.latitude,
    lng: coords.longitude,
  };
}

/**
 * Convert LatLng to Coordinates
 */
export function latLngToCoordinates(latLng: LatLng, zoom?: number): Coordinates {
  return {
    latitude: latLng.lat,
    longitude: latLng.lng,
    zoom,
  };
}

/**
 * Convert LatLng to LatLngTuple (for Leaflet methods)
 */
export function latLngToTuple(latLng: LatLng): LatLngTuple {
  return [latLng.lat, latLng.lng];
}

/**
 * Convert LatLngTuple to LatLng
 */
export function tupleToLatLng(tuple: LatLngTuple): LatLng {
  return { lat: tuple[0], lng: tuple[1] };
}

/**
 * Convert LatLng to LngLatTuple (for ORS API)
 */
export function latLngToLngLatTuple(latLng: LatLng): LngLatTuple {
  return [latLng.lng, latLng.lat];
}

/**
 * Convert LngLatTuple to LatLng
 */
export function lngLatTupleToLatLng(tuple: LngLatTuple): LatLng {
  return { lat: tuple[1], lng: tuple[0] };
}

/**
 * Parse coordinate string to LatLng
 * Supports formats:
 * - "lat,lng" (e.g., "53.9,27.5")
 * - "lat, lng" (with space)
 * - "lat;lng" (semicolon separator)
 */
export function parseCoordinateString(str: string): LatLng | null {
  if (!str) return null;

  const cleaned = str.trim().replace(/\s+/g, '').replace(/;/g, ',');
  const parts = cleaned.split(',');

  if (parts.length !== 2) return null;

  const lat = parseFloat(parts[0]);
  const lng = parseFloat(parts[1]);

  if (!isValidCoordinate(lat, lng)) return null;

  return { lat, lng };
}

/**
 * Format LatLng to string (lat,lng)
 */
export function formatLatLng(latLng: LatLng, precision: number = 6): string {
  return `${latLng.lat.toFixed(precision)},${latLng.lng.toFixed(precision)}`;
}

/**
 * Calculate distance between two points (Haversine formula)
 * @returns distance in meters
 */
export function calculateDistance(point1: LatLng, point2: LatLng): number {
  const R = 6371000; // Earth radius in meters
  const phi1 = (point1.lat * Math.PI) / 180;
  const phi2 = (point2.lat * Math.PI) / 180;
  const deltaPhi = ((point2.lat - point1.lat) * Math.PI) / 180;
  const deltaLambda = ((point2.lng - point1.lng) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Check if point is within bounds
 */
export function isPointInBounds(point: LatLng, bounds: { north: number; south: number; east: number; west: number }): boolean {
  return (
    point.lat <= bounds.north &&
    point.lat >= bounds.south &&
    point.lng <= bounds.east &&
    point.lng >= bounds.west
  );
}

/**
 * Get center point between two coordinates
 */
export function getCenterPoint(point1: LatLng, point2: LatLng): LatLng {
  return {
    lat: (point1.lat + point2.lat) / 2,
    lng: (point1.lng + point2.lng) / 2,
  };
}

// Re-export guards for convenience
export { CoordinateGuards };
