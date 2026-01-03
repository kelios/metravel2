import {
  getEmptyFormData,
  transformTravelToFormData,
  syncCountriesFromMarkers,
  cleanEmptyFields,
  normalizeTravelId,
  checkTravelEditAccess,
  validateModerationRequirements,
} from '@/utils/travelFormUtils';
import { Travel, MarkerData } from '@/src/types/types';

describe('travelFormUtils', () => {
  describe('getEmptyFormData', () => {
    it('should create empty form data with null id', () => {
      const result = getEmptyFormData(null);
      expect(result.id).toBeNull();
      expect(result.name).toBe('');
      expect(result.countries).toEqual([]);
    });

    it('should create empty form data with provided id', () => {
      const result = getEmptyFormData('123');
      expect(result.id).toBe('123');
      expect(result.name).toBe('');
    });
  });

  describe('transformTravelToFormData', () => {
    it('should transform travel data to form data', () => {
      const travel: Travel = {
        id: 123,
        name: 'Test Travel',
        year: 2024,
        number_days: 10,
        number_peoples: 2,
        categories: [1, 2],
        countries: ['1', '2'],
      } as any;

      const result = transformTravelToFormData(travel);
      expect(result.id).toBe('123');
      expect(result.name).toBe('Test Travel');
      expect(result.year).toBe('2024');
      expect(result.number_days).toBe('10');
      expect(result.number_peoples).toBe('2');
      expect(result.categories).toEqual(['1', '2']);
    });

    it('should handle missing optional fields', () => {
      const travel: Travel = {
        id: 123,
        name: 'Test Travel',
      } as any;

      const result = transformTravelToFormData(travel);
      expect(result.id).toBe('123');
      expect(result.year).toBe('');
      expect(result.number_days).toBe('');
    });
  });

  describe('syncCountriesFromMarkers', () => {
    it('should sync countries from markers', () => {
      const markers: MarkerData[] = [
        { country: '1' } as any,
        { country: '2' } as any,
      ];
      const existingCountries = ['3'];

      const result = syncCountriesFromMarkers(markers, existingCountries);
      expect(result).toContain('1');
      expect(result).toContain('2');
      expect(result).toContain('3');
    });

    it('should deduplicate countries', () => {
      const markers: MarkerData[] = [
        { country: '1' } as any,
        { country: '1' } as any,
      ];
      const existingCountries = ['1'];

      const result = syncCountriesFromMarkers(markers, existingCountries);
      expect(result).toEqual(['1']);
    });

    it('should filter out null countries', () => {
      const markers: MarkerData[] = [
        { country: '1' } as any,
        { country: null } as any,
      ];
      const existingCountries: string[] = [];

      const result = syncCountriesFromMarkers(markers, existingCountries);
      expect(result).toEqual(['1']);
    });
  });

  describe('cleanEmptyFields', () => {
    it('should replace empty strings with null', () => {
      const obj = {
        name: 'Test',
        description: '',
        year: '',
      };

      const result = cleanEmptyFields(obj);
      expect(result.name).toBe('Test');
      expect(result.description).toBeNull();
      expect(result.year).toBeNull();
    });

    it('should preserve false values', () => {
      const obj = {
        publish: false,
        moderation: false,
      };

      const result = cleanEmptyFields(obj);
      expect(result.publish).toBe(false);
      expect(result.moderation).toBe(false);
    });
  });

  describe('normalizeTravelId', () => {
    it('should return null for null input', () => {
      expect(normalizeTravelId(null)).toBeNull();
      expect(normalizeTravelId(undefined)).toBeNull();
    });

    it('should return number for valid number input', () => {
      expect(normalizeTravelId(123)).toBe(123);
    });

    it('should parse valid string to number', () => {
      expect(normalizeTravelId('123')).toBe(123);
      expect(normalizeTravelId(' 456 ')).toBe(456);
    });

    it('should return null for invalid string', () => {
      expect(normalizeTravelId('abc')).toBeNull();
      expect(normalizeTravelId('')).toBeNull();
      expect(normalizeTravelId('  ')).toBeNull();
    });

    it('should return null for NaN and Infinity', () => {
      expect(normalizeTravelId(NaN)).toBeNull();
      expect(normalizeTravelId(Infinity)).toBeNull();
    });
  });

  describe('checkTravelEditAccess', () => {
    it('should allow access for new travel', () => {
      const result = checkTravelEditAccess(null, '123', false);
      expect(result).toBe(true);
    });

    it('should allow access for owner', () => {
      const travel: Travel = {
        id: 1,
        userIds: '123',
      } as any;

      const result = checkTravelEditAccess(travel, '123', false);
      expect(result).toBe(true);
    });

    it('should allow access for super admin', () => {
      const travel: Travel = {
        id: 1,
        userIds: '456',
      } as any;

      const result = checkTravelEditAccess(travel, '123', true);
      expect(result).toBe(true);
    });

    it('should deny access for non-owner non-admin', () => {
      const travel: Travel = {
        id: 1,
        userIds: '456',
      } as any;

      const result = checkTravelEditAccess(travel, '123', false);
      expect(result).toBe(false);
    });
  });

  describe('validateModerationRequirements', () => {
    it('should validate complete form data', () => {
      const formData = {
        name: 'Test Travel',
        description: 'A'.repeat(60),
        countries: ['1'],
        categories: ['1'],
        coordsMeTravel: [{ lat: 53.9, lng: 27.5667 }],
        travel_image_thumb_small_url: 'image.jpg',
      } as any;

      const result = validateModerationRequirements(formData);
      expect(result.isValid).toBe(true);
      expect(result.missingFields).toEqual([]);
    });

    it('should detect missing name', () => {
      const formData = {
        name: '',
        description: 'A'.repeat(60),
        countries: ['1'],
        categories: ['1'],
        coordsMeTravel: [{}],
      } as any;

      const result = validateModerationRequirements(formData);
      expect(result.isValid).toBe(false);
      expect(result.missingFields).toContain('name');
    });

    it('should detect short description', () => {
      const formData = {
        name: 'Test',
        description: 'Short',
        countries: ['1'],
        categories: ['1'],
        coordsMeTravel: [{}],
      } as any;

      const result = validateModerationRequirements(formData);
      expect(result.isValid).toBe(false);
      expect(result.missingFields).toContain('description');
    });

    it('should detect missing countries', () => {
      const formData = {
        name: 'Test',
        description: 'A'.repeat(60),
        countries: [],
        categories: ['1'],
        coordsMeTravel: [{}],
      } as any;

      const result = validateModerationRequirements(formData);
      expect(result.isValid).toBe(false);
      expect(result.missingFields).toContain('countries');
    });

    it('should detect missing route', () => {
      const formData = {
        name: 'Test',
        description: 'A'.repeat(60),
        countries: ['1'],
        categories: ['1'],
        coordsMeTravel: [],
      } as any;

      const result = validateModerationRequirements(formData);
      expect(result.isValid).toBe(false);
      expect(result.missingFields).toContain('route');
    });

    it('should detect missing photos', () => {
      const formData = {
        name: 'Test',
        description: 'A'.repeat(60),
        countries: ['1'],
        categories: ['1'],
        coordsMeTravel: [{}],
        gallery: [],
      } as any;

      const result = validateModerationRequirements(formData);
      expect(result.isValid).toBe(false);
      expect(result.missingFields).toContain('photos');
    });
  });
});
