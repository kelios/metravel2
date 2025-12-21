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
