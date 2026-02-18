/**
 * Unit тесты для системы валидации Travel Wizard
 */

import {
  validateField,
  validateStep,
  getStepProgress,
  isReadyForModeration,
  getQualityScore,
  STEP_VALIDATION_RULES,
} from '@/utils/travelWizardValidation';
import { TravelFormData } from '@/types/types';

describe('travelWizardValidation', () => {
  describe('validateField', () => {
    it('should validate field with minLength', () => {
      const rules = { minLength: 3, label: 'Test Field' };
      
      const resultTooShort = validateField('test', 'AB', rules);
      expect(resultTooShort.isValid).toBe(false);
      expect(resultTooShort.error).toContain('Минимум 3 символов');
      
      const resultValid = validateField('test', 'ABC', rules);
      expect(resultValid.isValid).toBe(true);
    });

    it('should validate field with maxLength', () => {
      const rules = { maxLength: 5, label: 'Test Field' };
      
      const resultTooLong = validateField('test', 'ABCDEF', rules);
      expect(resultTooLong.isValid).toBe(false);
      expect(resultTooLong.error).toContain('Максимум 5 символов');
      
      const resultValid = validateField('test', 'ABCDE', rules);
      expect(resultValid.isValid).toBe(true);
    });

    it('should validate field with minItems for arrays', () => {
      const rules = { minItems: 2, label: 'Test Array' };
      
      const resultTooFew = validateField('test', ['item1'], rules);
      expect(resultTooFew.isValid).toBe(false);
      expect(resultTooFew.error).toContain('Необходимо минимум 2');
      
      const resultValid = validateField('test', ['item1', 'item2'], rules);
      expect(resultValid.isValid).toBe(true);
    });

    it('should validate field with pattern', () => {
      const rules = { 
        pattern: /^https?:\/\/.+$/,
        label: 'URL' 
      };
      
      const resultInvalid = validateField('test', 'not-a-url', rules);
      expect(resultInvalid.isValid).toBe(false);
      expect(resultInvalid.error).toContain('Неверный формат');
      
      const resultValid = validateField('test', 'https://example.com', rules);
      expect(resultValid.isValid).toBe(true);
    });

    it('should return character count for text fields', () => {
      const rules = { minLength: 3, maxLength: 10, label: 'Test' };
      
      const result = validateField('test', 'Hello', rules);
      expect(result.characterCount).toBe(5);
      expect(result.minLength).toBe(3);
      expect(result.maxLength).toBe(10);
    });

    it('should count plain text length for html fields', () => {
      const rules = { minLength: 3, maxLength: 5, label: 'HTML', content: 'html' as const };

      const resultOk = validateField('description', '<p>Hello</p>', rules);
      expect(resultOk.isValid).toBe(true);
      expect(resultOk.characterCount).toBe(5);

      const resultTooShort = validateField('description', '<p>Hi</p>', rules);
      expect(resultTooShort.isValid).toBe(false);
      expect(resultTooShort.error).toContain('Минимум 3 символов');
    });
  });

  describe('validateStep', () => {
    it('should validate step 1 (basic info)', () => {
      const formDataInvalid: Partial<TravelFormData> = {
        name: 'AB', // Too short
        description: 'Short', // Too short
      };
      
      const resultInvalid = validateStep(1, formDataInvalid as TravelFormData);
      expect(resultInvalid.isValid).toBe(false);
      expect(resultInvalid.errors.length).toBeGreaterThan(0);
      
      const formDataValid: Partial<TravelFormData> = {
        name: 'Valid Travel Name',
        description: 'A'.repeat(60), // 60 characters, more than minimum 50
      };
      
      const resultValid = validateStep(1, formDataValid as TravelFormData);
      expect(resultValid.isValid).toBe(true);
      expect(resultValid.errors.length).toBe(0);
    });

    it('should treat html-only description as empty on step 1', () => {
      const formData: Partial<TravelFormData> = {
        name: 'Valid Travel Name',
        description: '<p><br></p>',
      };

      const result = validateStep(1, formData as TravelFormData);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field === 'description')).toBe(true);
    });

    it('should not fail maxLength for html markup when plain text fits', () => {
      const plain = 'A'.repeat(1900);
      const html = `<p>${plain.split('').map(ch => `<span>${ch}</span>`).join('')}</p>`;

      const formData: Partial<TravelFormData> = {
        name: 'Valid Travel Name',
        description: html,
      };

      const result = validateStep(1, formData as TravelFormData);
      expect(result.isValid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it('should validate step 2 (route)', () => {
      const formDataInvalid: Partial<TravelFormData> = {
        coordsMeTravel: [], // Empty
        countries: [], // Empty
      };
      
      const resultInvalid = validateStep(2, formDataInvalid as TravelFormData);
      expect(resultInvalid.isValid).toBe(false);
      expect(resultInvalid.errors.some(e => e.field === 'coordsMeTravel')).toBe(true);
      expect(resultInvalid.errors.some(e => e.field === 'countries')).toBe(true);
      
      const formDataValid: Partial<TravelFormData> = {
        coordsMeTravel: [{ lat: 50, lng: 30, country: 1, address: 'Test', categories: [], image: '', id: 1 }],
        countries: ['1'],
      };
      
      const resultValid = validateStep(2, formDataValid as TravelFormData);
      expect(resultValid.isValid).toBe(true);
    });

    it('should return warnings for recommended fields on step 3', () => {
      const formData: Partial<TravelFormData> = {
        gallery: [], // Empty - should trigger warning
      };
      
      const result = validateStep(3, formData as TravelFormData);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.field === 'gallery')).toBe(true);
    });

    it('should validate step 6 (publish) with all required fields', () => {
      const formDataInvalid: Partial<TravelFormData> = {
        name: 'Test',
        description: 'Short',
        coordsMeTravel: [],
        countries: [],
        categories: [],
      };
      
      const resultInvalid = validateStep(6, formDataInvalid as TravelFormData);
      expect(resultInvalid.isValid).toBe(false);
      
      const formDataValid: Partial<TravelFormData> = {
        name: 'Valid Travel Name',
        description: 'A'.repeat(60),
        coordsMeTravel: [{ lat: 50, lng: 30, country: 1, address: 'Test', categories: [], image: '', id: 1 }],
        countries: ['1'],
        categories: ['1'],
      };
      
      const resultValid = validateStep(6, formDataValid as TravelFormData);
      expect(resultValid.isValid).toBe(true);
    });

    it('should require categories on step 6', () => {
      const formDataMissingCategories: Partial<TravelFormData> = {
        name: 'Valid Travel Name',
        description: 'A'.repeat(60),
        coordsMeTravel: [{ lat: 50, lng: 30, country: 1, address: 'Test', categories: [], image: '', id: 1 }],
        countries: ['1'],
        categories: [],
      };

      const result = validateStep(6, formDataMissingCategories as TravelFormData);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field === 'categories')).toBe(true);
    });
  });

  describe('getStepProgress', () => {
    it('should calculate progress for step 1', () => {
      const formDataEmpty: Partial<TravelFormData> = {
        name: '',
        description: '',
      };
      
      const progressEmpty = getStepProgress(1, formDataEmpty as TravelFormData);
      expect(progressEmpty).toBe(0);
      
      const formDataPartial: Partial<TravelFormData> = {
        name: 'Test',
        description: '',
      };
      
      const progressPartial = getStepProgress(1, formDataPartial as TravelFormData);
      expect(progressPartial).toBe(50);
      
      const formDataFull: Partial<TravelFormData> = {
        name: 'Test',
        description: 'Description',
      };
      
      const progressFull = getStepProgress(1, formDataFull as TravelFormData);
      expect(progressFull).toBe(100);
    });

    it('should return 100 for steps without rules', () => {
      const progress = getStepProgress(99, {} as TravelFormData);
      expect(progress).toBe(100);
    });
  });

  describe('isReadyForModeration', () => {
    it('should return false when required fields are missing', () => {
      const formData: Partial<TravelFormData> = {
        name: 'Test',
        description: 'Short',
      };
      
      const result = isReadyForModeration(formData as TravelFormData);
      expect(result.ready).toBe(false);
      expect(result.missingFields.length).toBeGreaterThan(0);
    });

    it('should return true when all required fields are filled', () => {
      const formData: Partial<TravelFormData> = {
        name: 'Valid Travel Name',
        description: 'A'.repeat(60),
        coordsMeTravel: [{ lat: 50, lng: 30, country: 1, address: 'Test', categories: [], image: '', id: 1 }],
        countries: ['1'],
        categories: ['1'],
      };
      
      const result = isReadyForModeration(formData as TravelFormData);
      expect(result.ready).toBe(true);
      expect(result.missingFields.length).toBe(0);
    });
  });

  describe('getQualityScore', () => {
    it('should return poor score for minimal data', () => {
      const formData: Partial<TravelFormData> = {
        name: 'Test',
        description: 'Short',
      };
      
      const result = getQualityScore(formData as TravelFormData);
      expect(result.level).toBe('poor');
      expect(result.score).toBeLessThan(40);
      expect(result.suggestions.length).toBeGreaterThan(0);
    });

    it('should return good score for well-filled data', () => {
      const formData: Partial<TravelFormData> = {
        name: 'Valid Travel Name',
        description: 'A'.repeat(120),
        coordsMeTravel: [
          { lat: 50, lng: 30, country: 1, address: 'Test1', categories: [], image: '', id: 1 },
          { lat: 51, lng: 31, country: 1, address: 'Test2', categories: [], image: '', id: 2 },
          { lat: 52, lng: 32, country: 1, address: 'Test3', categories: [], image: '', id: 3 },
        ],
        gallery: ['img1', 'img2', 'img3'],
        plus: 'A'.repeat(60),
        minus: 'A'.repeat(60),
        recommendation: 'A'.repeat(60),
        categories: ['1', '2'],
        transports: ['1'],
      };
      
      const result = getQualityScore(formData as TravelFormData);
      expect(result.level).toBe('good');
      expect(result.score).toBeGreaterThanOrEqual(60);
    });

    it('should return excellent score for complete data', () => {
      const formData: Partial<TravelFormData> = {
        name: 'Excellent Travel Name',
        description: 'A'.repeat(120),
        coordsMeTravel: [
          { lat: 50, lng: 30, country: 1, address: 'Test1', categories: [], image: '', id: 1 },
          { lat: 51, lng: 31, country: 1, address: 'Test2', categories: [], image: '', id: 2 },
          { lat: 52, lng: 32, country: 1, address: 'Test3', categories: [], image: '', id: 3 },
        ],
        travelImageThumbUrlArr: ['cover.jpg'],
        gallery: ['img1', 'img2', 'img3'],
        youtube_link: 'https://youtube.com/watch?v=test',
        plus: 'A'.repeat(60),
        minus: 'A'.repeat(60),
        recommendation: 'A'.repeat(60),
        categories: ['1', '2'],
        transports: ['1'],
      };
      
      const result = getQualityScore(formData as TravelFormData);
      expect(result.level).toBe('excellent');
      expect(result.score).toBeGreaterThanOrEqual(80);
      expect(result.suggestions.length).toBe(0);
    });

    it('should provide helpful suggestions', () => {
      const formData: Partial<TravelFormData> = {
        name: 'Test',
        description: 'A'.repeat(60),
        coordsMeTravel: [{ lat: 50, lng: 30, country: 1, address: 'Test', categories: [], image: '', id: 1 }],
      };
      
      const result = getQualityScore(formData as TravelFormData);
      expect(result.suggestions).toContain('Добавьте главное изображение');
      expect(result.suggestions).toContain('Добавьте минимум 3 фото в галерею');
    });
  });

  describe('STEP_VALIDATION_RULES', () => {
    it('should have rules for all 6 steps', () => {
      expect(STEP_VALIDATION_RULES[1]).toBeDefined();
      expect(STEP_VALIDATION_RULES[2]).toBeDefined();
      expect(STEP_VALIDATION_RULES[3]).toBeDefined();
      expect(STEP_VALIDATION_RULES[4]).toBeDefined();
      expect(STEP_VALIDATION_RULES[5]).toBeDefined();
      expect(STEP_VALIDATION_RULES[6]).toBeDefined();
    });

    it('should have required fields for critical steps', () => {
      expect(STEP_VALIDATION_RULES[1].required).toContain('name');
      expect(STEP_VALIDATION_RULES[1].required).toContain('description');
      expect(STEP_VALIDATION_RULES[2].required).toContain('coordsMeTravel');
      expect(STEP_VALIDATION_RULES[2].required).toContain('countries');
    });

    it('should have recommended fields for optional steps', () => {
      expect(STEP_VALIDATION_RULES[3].recommended).toBeDefined();
      expect(STEP_VALIDATION_RULES[4].recommended).toBeDefined();
      expect(STEP_VALIDATION_RULES[5].recommended).toBeDefined();
    });
  });
});
