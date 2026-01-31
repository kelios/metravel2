/**
 * Tests for coordinate utilities
 */

import {
  isValidLatitude,
  isValidLongitude,
  isValidCoordinate,
  isValidZoom,
  normalizeCoordinates,
  normalizeLatLng,
  coordinatesToLatLng,
  latLngToCoordinates,
  latLngToTuple,
  tupleToLatLng,
  latLngToLngLatTuple,
  lngLatTupleToLatLng,
  parseCoordinateString,
  formatLatLng,
  calculateDistance,
  isPointInBounds,
  getCenterPoint,
} from '@/utils/coordinates';
import { DEFAULT_COORDINATES } from '@/types/coordinates';

describe('Coordinate Validation', () => {
  describe('isValidLatitude', () => {
    it('should accept valid latitudes', () => {
      expect(isValidLatitude(0)).toBe(true);
      expect(isValidLatitude(45.5)).toBe(true);
      expect(isValidLatitude(-45.5)).toBe(true);
      expect(isValidLatitude(90)).toBe(true);
      expect(isValidLatitude(-90)).toBe(true);
    });

    it('should reject invalid latitudes', () => {
      expect(isValidLatitude(91)).toBe(false);
      expect(isValidLatitude(-91)).toBe(false);
      expect(isValidLatitude(NaN)).toBe(false);
      expect(isValidLatitude(Infinity)).toBe(false);
      expect(isValidLatitude(-Infinity)).toBe(false);
    });
  });

  describe('isValidLongitude', () => {
    it('should accept valid longitudes', () => {
      expect(isValidLongitude(0)).toBe(true);
      expect(isValidLongitude(45.5)).toBe(true);
      expect(isValidLongitude(-45.5)).toBe(true);
      expect(isValidLongitude(180)).toBe(true);
      expect(isValidLongitude(-180)).toBe(true);
    });

    it('should reject invalid longitudes', () => {
      expect(isValidLongitude(181)).toBe(false);
      expect(isValidLongitude(-181)).toBe(false);
      expect(isValidLongitude(NaN)).toBe(false);
      expect(isValidLongitude(Infinity)).toBe(false);
      expect(isValidLongitude(-Infinity)).toBe(false);
    });
  });

  describe('isValidCoordinate', () => {
    it('should accept valid coordinate pairs', () => {
      expect(isValidCoordinate(53.9, 27.5)).toBe(true);
      expect(isValidCoordinate(0, 0)).toBe(true);
      expect(isValidCoordinate(-45, -90)).toBe(true);
    });

    it('should reject invalid coordinate pairs', () => {
      expect(isValidCoordinate(91, 0)).toBe(false);
      expect(isValidCoordinate(0, 181)).toBe(false);
      expect(isValidCoordinate(NaN, 0)).toBe(false);
      expect(isValidCoordinate(0, NaN)).toBe(false);
    });
  });

  describe('isValidZoom', () => {
    it('should accept valid zoom levels', () => {
      expect(isValidZoom(0)).toBe(true);
      expect(isValidZoom(11)).toBe(true);
      expect(isValidZoom(19)).toBe(true);
    });

    it('should reject invalid zoom levels', () => {
      expect(isValidZoom(-1)).toBe(false);
      expect(isValidZoom(20)).toBe(false);
      expect(isValidZoom(NaN)).toBe(false);
    });
  });
});

describe('Coordinate Normalization', () => {
  describe('normalizeCoordinates', () => {
    it('should return valid coordinates unchanged', () => {
      const coords = { latitude: 53.9, longitude: 27.5, zoom: 11 };
      const result = normalizeCoordinates(coords);
      expect(result).toEqual(coords);
    });

    it('should replace invalid coordinates with defaults', () => {
      const coords = { latitude: 91, longitude: 181, zoom: 25 };
      const result = normalizeCoordinates(coords);
      expect(result).toEqual(DEFAULT_COORDINATES);
    });

    it('should handle null input', () => {
      const result = normalizeCoordinates(null);
      expect(result).toEqual(DEFAULT_COORDINATES);
    });

    it('should handle undefined input', () => {
      const result = normalizeCoordinates(undefined);
      expect(result).toEqual(DEFAULT_COORDINATES);
    });

    it('should handle partial objects', () => {
      const coords = { latitude: 53.9 } as any;
      const result = normalizeCoordinates(coords);
      expect(result.latitude).toBe(53.9);
      expect(result.longitude).toBe(DEFAULT_COORDINATES.longitude);
    });
  });

  describe('normalizeLatLng', () => {
    it('should return valid LatLng unchanged', () => {
      const latLng = { lat: 53.9, lng: 27.5 };
      const result = normalizeLatLng(latLng);
      expect(result).toEqual(latLng);
    });

    it('should replace invalid LatLng with defaults', () => {
      const latLng = { lat: 91, lng: 181 };
      const result = normalizeLatLng(latLng);
      expect(result).toEqual({
        lat: DEFAULT_COORDINATES.latitude,
        lng: DEFAULT_COORDINATES.longitude,
      });
    });
  });
});

describe('Coordinate Conversion', () => {
  describe('coordinatesToLatLng', () => {
    it('should convert Coordinates to LatLng', () => {
      const coords = { latitude: 53.9, longitude: 27.5 };
      const result = coordinatesToLatLng(coords);
      expect(result).toEqual({ lat: 53.9, lng: 27.5 });
    });
  });

  describe('latLngToCoordinates', () => {
    it('should convert LatLng to Coordinates', () => {
      const latLng = { lat: 53.9, lng: 27.5 };
      const result = latLngToCoordinates(latLng);
      expect(result).toEqual({ latitude: 53.9, longitude: 27.5 });
    });

    it('should include zoom if provided', () => {
      const latLng = { lat: 53.9, lng: 27.5 };
      const result = latLngToCoordinates(latLng, 11);
      expect(result).toEqual({ latitude: 53.9, longitude: 27.5, zoom: 11 });
    });
  });

  describe('latLngToTuple', () => {
    it('should convert LatLng to tuple', () => {
      const latLng = { lat: 53.9, lng: 27.5 };
      const result = latLngToTuple(latLng);
      expect(result).toEqual([53.9, 27.5]);
    });
  });

  describe('tupleToLatLng', () => {
    it('should convert tuple to LatLng', () => {
      const tuple: [number, number] = [53.9, 27.5];
      const result = tupleToLatLng(tuple);
      expect(result).toEqual({ lat: 53.9, lng: 27.5 });
    });
  });

  describe('latLngToLngLatTuple', () => {
    it('should convert LatLng to LngLat tuple (reversed)', () => {
      const latLng = { lat: 53.9, lng: 27.5 };
      const result = latLngToLngLatTuple(latLng);
      expect(result).toEqual([27.5, 53.9]); // [lng, lat]
    });
  });

  describe('lngLatTupleToLatLng', () => {
    it('should convert LngLat tuple to LatLng', () => {
      const tuple: [number, number] = [27.5, 53.9]; // [lng, lat]
      const result = lngLatTupleToLatLng(tuple);
      expect(result).toEqual({ lat: 53.9, lng: 27.5 });
    });
  });
});

describe('Coordinate Parsing', () => {
  describe('parseCoordinateString', () => {
    it('should parse comma-separated coordinates', () => {
      const result = parseCoordinateString('53.9,27.5');
      expect(result).toEqual({ lat: 53.9, lng: 27.5 });
    });

    it('should parse coordinates with spaces', () => {
      const result = parseCoordinateString('53.9, 27.5');
      expect(result).toEqual({ lat: 53.9, lng: 27.5 });
    });

    it('should parse semicolon-separated coordinates', () => {
      const result = parseCoordinateString('53.9;27.5');
      expect(result).toEqual({ lat: 53.9, lng: 27.5 });
    });

    it('should return null for invalid strings', () => {
      expect(parseCoordinateString('invalid')).toBeNull();
      expect(parseCoordinateString('53.9')).toBeNull();
      expect(parseCoordinateString('53.9,181')).toBeNull();
      expect(parseCoordinateString('')).toBeNull();
    });

    it('should handle null/undefined', () => {
      expect(parseCoordinateString(null as any)).toBeNull();
      expect(parseCoordinateString(undefined as any)).toBeNull();
    });
  });

  describe('formatLatLng', () => {
    it('should format LatLng to string', () => {
      const latLng = { lat: 53.9, lng: 27.5 };
      const result = formatLatLng(latLng);
      expect(result).toBe('53.900000,27.500000');
    });

    it('should respect precision parameter', () => {
      const latLng = { lat: 53.9, lng: 27.5 };
      const result = formatLatLng(latLng, 2);
      expect(result).toBe('53.90,27.50');
    });
  });
});

describe('Coordinate Calculations', () => {
  describe('calculateDistance', () => {
    it('should calculate distance between two points', () => {
      const point1 = { lat: 53.9, lng: 27.5 };
      const point2 = { lat: 53.91, lng: 27.51 };
      const distance = calculateDistance(point1, point2);

      // Should be roughly 1.2 km
      expect(distance).toBeGreaterThan(1000);
      expect(distance).toBeLessThan(2000);
    });

    it('should return 0 for identical points', () => {
      const point = { lat: 53.9, lng: 27.5 };
      const distance = calculateDistance(point, point);
      expect(distance).toBe(0);
    });
  });

  describe('isPointInBounds', () => {
    it('should detect point within bounds', () => {
      const point = { lat: 53.9, lng: 27.5 };
      const bounds = { north: 54, south: 53, east: 28, west: 27 };
      expect(isPointInBounds(point, bounds)).toBe(true);
    });

    it('should detect point outside bounds', () => {
      const point = { lat: 55, lng: 27.5 };
      const bounds = { north: 54, south: 53, east: 28, west: 27 };
      expect(isPointInBounds(point, bounds)).toBe(false);
    });
  });

  describe('getCenterPoint', () => {
    it('should calculate center between two points', () => {
      const point1 = { lat: 50, lng: 20 };
      const point2 = { lat: 60, lng: 30 };
      const center = getCenterPoint(point1, point2);
      expect(center).toEqual({ lat: 55, lng: 25 });
    });
  });
});
