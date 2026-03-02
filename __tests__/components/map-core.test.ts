/**
 * K1: Tests for map-core types and utilities
 * @module __tests__/components/map-core.test.ts
 */

import {
  parseCoordString,
  legacyPointToMarker,
  type LegacyMapPoint,
} from '@/components/map-core';

describe('map-core', () => {
  describe('parseCoordString', () => {
    it('parses "lat, lng" format', () => {
      expect(parseCoordString('55.7558, 37.6173')).toEqual({ lat: 55.7558, lng: 37.6173 });
    });

    it('parses "lat,lng" without spaces', () => {
      expect(parseCoordString('48.8566,2.3522')).toEqual({ lat: 48.8566, lng: 2.3522 });
    });

    it('returns null for empty string', () => {
      expect(parseCoordString('')).toBeNull();
    });

    it('returns null for invalid format', () => {
      expect(parseCoordString('abc,def')).toBeNull();
    });

    it('returns null for single value', () => {
      expect(parseCoordString('55.7558')).toBeNull();
    });

    it('returns null for out-of-range latitude', () => {
      expect(parseCoordString('91, 37')).toBeNull();
      expect(parseCoordString('-91, 37')).toBeNull();
    });

    it('returns null for out-of-range longitude', () => {
      expect(parseCoordString('55, 181')).toBeNull();
      expect(parseCoordString('55, -181')).toBeNull();
    });

    it('handles negative coordinates', () => {
      expect(parseCoordString('-33.8688, 151.2093')).toEqual({ lat: -33.8688, lng: 151.2093 });
    });

    it('handles zero coordinates', () => {
      expect(parseCoordString('0, 0')).toEqual({ lat: 0, lng: 0 });
    });
  });

  describe('legacyPointToMarker', () => {
    it('converts valid LegacyMapPoint', () => {
      const point: LegacyMapPoint = {
        id: '123',
        coord: '55.7558, 37.6173',
        address: 'Moscow, Red Square',
        travelImageThumbUrl: 'https://example.com/img.jpg',
        urlTravel: '/travel/moscow',
        articleUrl: '/article/moscow',
        updated_at: '2026-01-01T00:00:00Z',
      };

      const marker = legacyPointToMarker(point, 0);
      expect(marker).not.toBeNull();
      expect(marker!.id).toBe('123');
      expect(marker!.lat).toBe(55.7558);
      expect(marker!.lng).toBe(37.6173);
      expect(marker!.address).toBe('Moscow, Red Square');
      expect(marker!.imageUrl).toBe('https://example.com/img.jpg');
      expect(marker!.travelUrl).toBe('/travel/moscow');
      expect(marker!.articleUrl).toBe('/article/moscow');
      expect(marker!.updatedAt).toBe('2026-01-01T00:00:00Z');
    });

    it('generates id from index when id is missing', () => {
      const point: LegacyMapPoint = {
        coord: '48.8566, 2.3522',
        address: 'Paris',
      };
      const marker = legacyPointToMarker(point, 5);
      expect(marker!.id).toBe('idx-5');
    });

    it('returns null for invalid coordinates', () => {
      const point: LegacyMapPoint = {
        id: '1',
        coord: 'invalid',
        address: 'Nowhere',
      };
      expect(legacyPointToMarker(point, 0)).toBeNull();
    });

    it('returns null for empty coord', () => {
      const point: LegacyMapPoint = {
        id: '1',
        coord: '',
        address: 'Nowhere',
      };
      expect(legacyPointToMarker(point, 0)).toBeNull();
    });

    it('normalizes string categoryName', () => {
      const point: LegacyMapPoint = {
        coord: '55.7558, 37.6173',
        address: 'Test',
        categoryName: 'Restaurant',
      };
      const marker = legacyPointToMarker(point, 0);
      expect(marker!.categoryName).toBe('Restaurant');
    });

    it('normalizes object categoryName', () => {
      const point: LegacyMapPoint = {
        coord: '55.7558, 37.6173',
        address: 'Test',
        categoryName: { name: 'Hotel' },
      };
      const marker = legacyPointToMarker(point, 0);
      expect(marker!.categoryName).toBe('Hotel');
    });

    it('merges categoryIds from multiple sources', () => {
      const point: LegacyMapPoint = {
        coord: '55.7558, 37.6173',
        address: 'Test',
        categoryIds: [1, 2],
        category_ids: [3],
        categoryId: 4,
      };
      const marker = legacyPointToMarker(point, 0);
      expect(marker!.categoryIds).toEqual([1, 2, 3, 4]);
    });

    it('returns undefined categoryIds when none provided', () => {
      const point: LegacyMapPoint = {
        coord: '55.7558, 37.6173',
        address: 'Test',
      };
      const marker = legacyPointToMarker(point, 0);
      expect(marker!.categoryIds).toBeUndefined();
    });

    it('handles numeric id', () => {
      const point: LegacyMapPoint = {
        id: 42,
        coord: '55.7558, 37.6173',
        address: 'Test',
      };
      const marker = legacyPointToMarker(point, 0);
      expect(marker!.id).toBe('42');
    });
  });
});

