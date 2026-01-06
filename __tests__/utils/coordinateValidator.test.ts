import {
  isValidCoordinate,
  isValidCoordinates,
  isValidLatLng,
  getSafeCoordinates,
  getSafeLatLng,
  validateRoutePoints,
  filterValidRoutePoints,
} from '@/utils/coordinateValidator';

describe('coordinateValidator', () => {
  describe('isValidCoordinate', () => {
    it('returns true for valid coordinates', () => {
      expect(isValidCoordinate(53.9, 27.56)).toBe(true);
      expect(isValidCoordinate(0, 0)).toBe(true);
      expect(isValidCoordinate(-90, -180)).toBe(true);
      expect(isValidCoordinate(90, 180)).toBe(true);
    });

    it('returns false for invalid latitude', () => {
      expect(isValidCoordinate(-91, 27.56)).toBe(false);
      expect(isValidCoordinate(91, 27.56)).toBe(false);
      expect(isValidCoordinate(NaN, 27.56)).toBe(false);
      expect(isValidCoordinate(Infinity, 27.56)).toBe(false);
    });

    it('returns false for invalid longitude', () => {
      expect(isValidCoordinate(53.9, -181)).toBe(false);
      expect(isValidCoordinate(53.9, 181)).toBe(false);
      expect(isValidCoordinate(53.9, NaN)).toBe(false);
      expect(isValidCoordinate(53.9, Infinity)).toBe(false);
    });
  });

  describe('isValidCoordinates', () => {
    it('returns true for valid Coordinates object', () => {
      expect(isValidCoordinates({ latitude: 53.9, longitude: 27.56 })).toBe(true);
    });

    it('returns false for null or undefined', () => {
      expect(isValidCoordinates(null)).toBe(false);
      expect(isValidCoordinates(undefined)).toBe(false);
    });

    it('returns false for invalid coordinates', () => {
      expect(isValidCoordinates({ latitude: 91, longitude: 27.56 })).toBe(false);
      expect(isValidCoordinates({ latitude: 53.9, longitude: 181 })).toBe(false);
    });
  });

  describe('isValidLatLng', () => {
    it('returns true for valid LatLng object', () => {
      expect(isValidLatLng({ lat: 53.9, lng: 27.56 })).toBe(true);
    });

    it('returns false for null or undefined', () => {
      expect(isValidLatLng(null)).toBe(false);
      expect(isValidLatLng(undefined)).toBe(false);
    });

    it('returns false for invalid coordinates', () => {
      expect(isValidLatLng({ lat: 91, lng: 27.56 })).toBe(false);
      expect(isValidLatLng({ lat: 53.9, lng: 181 })).toBe(false);
    });
  });

  describe('getSafeCoordinates', () => {
    it('returns valid coordinates as-is', () => {
      const coords = { latitude: 53.9, longitude: 27.56 };
      expect(getSafeCoordinates(coords)).toEqual(coords);
    });

    it('returns default fallback for invalid coordinates', () => {
      expect(getSafeCoordinates(null)).toEqual({ latitude: 53.9006, longitude: 27.559 });
      expect(getSafeCoordinates({ latitude: 91, longitude: 27.56 })).toEqual({
        latitude: 53.9006,
        longitude: 27.559,
      });
    });

    it('uses custom fallback when provided', () => {
      const fallback = { latitude: 50, longitude: 30 };
      expect(getSafeCoordinates(null, fallback)).toEqual(fallback);
    });
  });

  describe('getSafeLatLng', () => {
    it('returns valid LatLng as-is', () => {
      const coords = { lat: 53.9, lng: 27.56 };
      expect(getSafeLatLng(coords)).toEqual(coords);
    });

    it('returns default fallback for invalid LatLng', () => {
      expect(getSafeLatLng(null)).toEqual({ lat: 53.9006, lng: 27.559 });
      expect(getSafeLatLng({ lat: 91, lng: 27.56 })).toEqual({ lat: 53.9006, lng: 27.559 });
    });
  });

  describe('validateRoutePoints', () => {
    it('returns true for valid route points', () => {
      const points: [number, number][] = [
        [27.56, 53.9],
        [27.6, 53.95],
      ];
      expect(validateRoutePoints(points)).toBe(true);
    });

    it('returns false for less than 2 points', () => {
      expect(validateRoutePoints([])).toBe(false);
      expect(validateRoutePoints([[27.56, 53.9]])).toBe(false);
    });

    it('returns false if any point is invalid', () => {
      const points: [number, number][] = [
        [27.56, 53.9],
        [181, 53.95], // invalid longitude
      ];
      expect(validateRoutePoints(points)).toBe(false);
    });

    it('returns false for non-array input', () => {
      expect(validateRoutePoints(null as any)).toBe(false);
      expect(validateRoutePoints(undefined as any)).toBe(false);
    });
  });

  describe('filterValidRoutePoints', () => {
    it('filters out invalid points', () => {
      const points: [number, number][] = [
        [27.56, 53.9], // valid
        [181, 53.95], // invalid longitude
        [27.6, 91], // invalid latitude
        [27.7, 54.0], // valid
      ];
      const result = filterValidRoutePoints(points);
      expect(result).toHaveLength(2);
      expect(result).toEqual([
        [27.56, 53.9],
        [27.7, 54.0],
      ]);
    });

    it('returns empty array for non-array input', () => {
      expect(filterValidRoutePoints(null as any)).toEqual([]);
      expect(filterValidRoutePoints(undefined as any)).toEqual([]);
    });

    it('returns empty array if all points are invalid', () => {
      const points: [number, number][] = [
        [181, 53.9],
        [27.6, 91],
      ];
      expect(filterValidRoutePoints(points)).toEqual([]);
    });
  });
});
