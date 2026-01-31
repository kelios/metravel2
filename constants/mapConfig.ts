/**
 * Map configuration constants
 */

export const DEFAULT_RADIUS_KM = 60;

export const RADIUS_OPTIONS = [
  { id: '60', name: '60' },
  { id: '100', name: '100' },
  { id: '200', name: '200' },
  { id: '500', name: '500' },
  { id: '600', name: '600' },
] as const;

export const DEFAULT_MAP_CENTER = {
  latitude: 53.9006,
  longitude: 27.5590,
} as const;
