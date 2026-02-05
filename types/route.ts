import type { LatLng } from './coordinates';

/**
 * Transport mode for route calculation
 */
export type TransportMode = 'car' | 'bike' | 'foot';

/**
 * Route point type
 */
export type RoutePointType = 'start' | 'waypoint' | 'end';

/**
 * Single point in a route
 */
export interface RoutePoint {
  id: string;
  coordinates: LatLng;
  address: string;
  type: RoutePointType;
  timestamp: number;
}

/**
 * Calculated route data
 */
export interface RouteData {
  coordinates: LatLng[];
  distance: number; // meters
  duration: number; // seconds
  isOptimal: boolean;
  error?: string;
  elevationGain?: number; // meters
  elevationLoss?: number; // meters
}

/**
 * Route validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Saved route (for persistence)
 */
export interface SavedRoute {
  id: string;
  userId?: string;
  name: string;
  description?: string;
  points: RoutePoint[];
  transportMode: TransportMode;
  distance: number;
  duration: number;
  createdAt: Date;
  updatedAt: Date;
  isPublic: boolean;
  tags: string[];
  thumbnail?: string;
}
