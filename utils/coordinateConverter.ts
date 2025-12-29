import type { LatLng, LatLngTuple, LatLngBounds } from '@/types/coordinates';

/**
 * Coordinate conversion utilities
 * Ensures consistent coordinate handling across the application
 */
export class CoordinateConverter {
  /**
   * Parse coordinates from string format "lat,lng"
   * @throws Error if string is invalid
   */
  static fromString(str: string): LatLng {
    if (!str || typeof str !== 'string') {
      throw new Error(`Invalid coordinate string: ${str}`);
    }

    const parts = str.split(',').map(s => s.trim());
    if (parts.length !== 2) {
      throw new Error(`Invalid coordinate format: ${str}. Expected "lat,lng"`);
    }

    const lat = parseFloat(parts[0]);
    const lng = parseFloat(parts[1]);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      throw new Error(`Invalid coordinate values: ${str}`);
    }

    if (lat < -90 || lat > 90) {
      throw new Error(`Latitude out of range: ${lat}. Must be between -90 and 90`);
    }

    if (lng < -180 || lng > 180) {
      throw new Error(`Longitude out of range: ${lng}. Must be between -180 and 180`);
    }

    return { lat, lng };
  }

  /**
   * Parse coordinates from a loose string format "lat,lng" or "lat;lng"
   * Returns null instead of throwing for invalid inputs.
   */
  static fromLooseString(str: string): LatLng | null {
    if (!str || typeof str !== 'string') return null;
    const cleaned = str.replace(/;/g, ',').replace(/\s+/g, '');
    try {
      return this.fromString(cleaned);
    } catch {
      return null;
    }
  }

  /**
   * Convert LatLng to Leaflet tuple format [lat, lng]
   */
  static toLeaflet(coords: LatLng): LatLngTuple {
    return [coords.lat, coords.lng];
  }

  /**
   * Convert Leaflet tuple [lat, lng] to LatLng object
   */
  static fromLeaflet(tuple: LatLngTuple): LatLng {
    return { lat: tuple[0], lng: tuple[1] };
  }

  /**
   * Convert LatLng to string format "lat,lng"
   */
  static toString(coords: LatLng, precision: number = 6): string {
    return `${coords.lat.toFixed(precision)},${coords.lng.toFixed(precision)}`;
  }

  /**
   * Calculate distance between two points using Haversine formula
   * @returns Distance in meters
   */
  static distance(a: LatLng, b: LatLng): number {
    const R = 6371e3; // Earth radius in metres
    const φ1 = (a.lat * Math.PI) / 180;
    const φ2 = (b.lat * Math.PI) / 180;
    const Δφ = ((b.lat - a.lat) * Math.PI) / 180;
    const Δλ = ((b.lng - a.lng) * Math.PI) / 180;

    const a_calc =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a_calc), Math.sqrt(1 - a_calc));

    return R * c;
  }

  /**
   * Calculate total distance for a path
   * @returns Distance in meters
   */
  static pathDistance(points: LatLng[]): number {
    if (points.length < 2) return 0;

    let total = 0;
    for (let i = 1; i < points.length; i++) {
      total += this.distance(points[i - 1], points[i]);
    }
    return total;
  }

  /**
   * Check if coordinate is valid
   */
  static isValid(coords: LatLng): boolean {
    return (
      Number.isFinite(coords.lat) &&
      Number.isFinite(coords.lng) &&
      coords.lat >= -90 &&
      coords.lat <= 90 &&
      coords.lng >= -180 &&
      coords.lng <= 180
    );
  }

  /**
   * Calculate bounds for a set of points
   */
  static calculateBounds(points: LatLng[]): LatLngBounds | null {
    if (points.length === 0) return null;

    let north = points[0].lat;
    let south = points[0].lat;
    let east = points[0].lng;
    let west = points[0].lng;

    for (const point of points) {
      if (point.lat > north) north = point.lat;
      if (point.lat < south) south = point.lat;
      if (point.lng > east) east = point.lng;
      if (point.lng < west) west = point.lng;
    }

    return { north, south, east, west };
  }

  /**
   * Check if point is within bounds
   */
  static isInBounds(point: LatLng, bounds: LatLngBounds): boolean {
    return (
      point.lat >= bounds.south &&
      point.lat <= bounds.north &&
      point.lng >= bounds.west &&
      point.lng <= bounds.east
    );
  }

  /**
   * Format distance for display
   */
  static formatDistance(meters: number): string {
    if (meters < 1000) {
      return `${Math.round(meters)} м`;
    }
    return `${(meters / 1000).toFixed(1)} км`;
  }

  /**
   * Format coordinates for display
   */
  static formatCoordinates(coords: LatLng): string {
    return `${coords.lat.toFixed(4)}°, ${coords.lng.toFixed(4)}°`;
  }
}
