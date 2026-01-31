/**
 * Unified coordinate system for the entire application
 * 
 * Convention: Always use LatLng object internally
 * - lat: latitude (north-south, -90 to 90)
 * - lng: longitude (east-west, -180 to 180)
 */

export interface LatLng {
  lat: number;
  lng: number;
}

/**
 * Tuple format [lat, lng] used by Leaflet
 */
export type LatLngTuple = [lat: number, lng: number];

/**
 * Bounds for a rectangular area
 */
export interface LatLngBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

/**
 * Point with optional metadata
 */
export interface GeoPoint extends LatLng {
  id?: string;
  address?: string;
  timestamp?: number;
}

/**
 * Standard coordinate format (React Native friendly)
 * Used in: location services, user position, travel data
 */
export interface Coordinates {
  latitude: number;
  longitude: number;
  zoom?: number;
}

/**
 * Tuple format for route points (ORS API)
 * Used in: OpenRouteService API, route building
 */
export type LngLatTuple = [number, number]; // [lng, lat]

/**
 * Extended coordinates with zoom level
 * Used in: map initialization, saved map state
 */
export interface CoordinatesWithZoom extends Coordinates {
  zoom: number;
}

/**
 * Type guards for coordinate validation
 */
export const CoordinateGuards = {
  /**
   * Check if value is a valid Coordinates object
   */
  isCoordinates(value: unknown): value is Coordinates {
    if (!value || typeof value !== 'object') return false;
    const obj = value as any;
    return (
      typeof obj.latitude === 'number' &&
      typeof obj.longitude === 'number' &&
      Number.isFinite(obj.latitude) &&
      Number.isFinite(obj.longitude)
    );
  },

  /**
   * Check if value is a valid LatLng object
   */
  isLatLng(value: unknown): value is LatLng {
    if (!value || typeof value !== 'object') return false;
    const obj = value as any;
    return (
      typeof obj.lat === 'number' &&
      typeof obj.lng === 'number' &&
      Number.isFinite(obj.lat) &&
      Number.isFinite(obj.lng)
    );
  },

  /**
   * Check if value is a valid LatLngTuple
   */
  isLatLngTuple(value: unknown): value is LatLngTuple {
    return (
      Array.isArray(value) &&
      value.length === 2 &&
      typeof value[0] === 'number' &&
      typeof value[1] === 'number' &&
      Number.isFinite(value[0]) &&
      Number.isFinite(value[1])
    );
  },
};

/**
 * Default coordinates (Minsk, Belarus)
 * Used as fallback when coordinates are invalid or unavailable
 */
export const DEFAULT_COORDINATES: Coordinates = {
  latitude: 53.9006,
  longitude: 27.559,
  zoom: 11,
};

/**
 * Coordinate validation constants
 */
export const COORDINATE_LIMITS = {
  MIN_LATITUDE: -90,
  MAX_LATITUDE: 90,
  MIN_LONGITUDE: -180,
  MAX_LONGITUDE: 180,
  MIN_ZOOM: 0,
  MAX_ZOOM: 19,
} as const;

