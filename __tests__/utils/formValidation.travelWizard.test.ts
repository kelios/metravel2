import {
  validateStep,
  getModerationErrors,
  validateName,
  validateDescription,
  validateCountries,
  validateCategories,
  validateMarkers,
  validateYear,
  validateDays,
  validatePeople,
  validateYouTubeLink,
  validateTravelForm,
  getFieldError,
} from '@/utils/formValidation';

describe('travel wizard validation', () => {
  describe('validateStep', () => {
    it('step 1: requires name, description, countries and categories', () => {
      const base = {
        name: 'Test trip',
        description: 'X'.repeat(60),
        countries: ['BY'],
        categories: ['city'],
      };

      const ok = validateStep(1, base as any);
      expect(ok.isValid).toBe(true);

      const noName = validateStep(1, { ...base, name: '' } as any);
      expect(noName.isValid).toBe(false);
      expect(noName.errors.some(e => e.field === 'name')).toBe(true);

      const noDescription = validateStep(1, { ...base, description: '' } as any);
      expect(noDescription.isValid).toBe(false);
      expect(noDescription.errors.some(e => e.field === 'description')).toBe(true);

      const noCountries = validateStep(1, { ...base, countries: [] } as any);
      expect(noCountries.isValid).toBe(false);
      expect(noCountries.errors.some(e => e.field === 'countries')).toBe(true);

      const noCategories = validateStep(1, { ...base, categories: [] } as any);
      expect(noCategories.isValid).toBe(false);
      expect(noCategories.errors.some(e => e.field === 'categories')).toBe(true);
    });

    it('step 2: requires at least one marker in coordsMeTravel/markers', () => {
      const noMarkers = validateStep(2, { coordsMeTravel: [] } as any, []);
      expect(noMarkers.isValid).toBe(false);

      const withCoords = validateStep(2, { coordsMeTravel: [{ lat: 1, lng: 2 }] } as any);
      expect(withCoords.isValid).toBe(true);

      const viaArg = validateStep(2, { coordsMeTravel: [] } as any, [{ lat: 1, lng: 2 }] as any);
      expect(viaArg.isValid).toBe(true);
    });

    it('steps 3 and 4 are always non-blocking', () => {
      const step3 = validateStep(3, {} as any);
      const step4 = validateStep(4, {} as any);
      expect(step3.isValid).toBe(true);
      expect(step4.isValid).toBe(true);
    });
  });

  describe('getModerationErrors', () => {
    it('returns human-readable list for missing critical fields', () => {
      const errors = getModerationErrors({
        name: '',
        description: '',
        countries: [],
        coordsMeTravel: [],
        gallery: [],
        travel_image_thumb_small_url: null,
      } as any, []);

      expect(errors).toContain('Название');
      expect(errors).toContain('Описание');
      expect(errors).toContain('Страны (минимум одна)');
      expect(errors).toContain('Маршрут (минимум одна точка)');
      expect(errors).toContain('Фото или обложка');
    });

    it('returns empty list when all critical fields are present', () => {
      const errors = getModerationErrors({
        name: 'Test',
        description: 'X'.repeat(60),
        countries: ['1'],
        coordsMeTravel: [{ lat: 1, lng: 2 }],
        gallery: ['img'],
        travel_image_thumb_small_url: null,
      } as any, []);

      expect(errors).toEqual([]);
    });

    it('treats either gallery or cover image as satisfying photos requirement', () => {
      const withCoverOnly = getModerationErrors({
        name: 'Test',
        description: 'X'.repeat(60),
        countries: ['1'],
        coordsMeTravel: [{ lat: 1, lng: 2 }],
        gallery: [],
        travel_image_thumb_small_url: 'cover.jpg',
      } as any, []);

      expect(withCoverOnly).not.toContain('Фото или обложка');
    });
  });

  describe('primitive validators', () => {
    it('validateName: rejects empty, too short and too long names, accepts valid', () => {
      expect(validateName('')).toEqual({
        field: 'name',
        message: 'Название обязательно для заполнения',
      });

      expect(validateName('ab')).toEqual({
        field: 'name',
        message: 'Название должно содержать минимум 3 символа',
      });

      const longName = 'a'.repeat(201);
      expect(validateName(longName)).toEqual({
        field: 'name',
        message: 'Название не должно превышать 200 символов',
      });

      expect(validateName('Valid name')).toBeNull();
    });

    it('validateDescription: enforces required and minimum length of 50 chars', () => {
      expect(validateDescription('')).toEqual({
        field: 'description',
        message: 'Описание обязательно для заполнения',
      });

      const short = 'x'.repeat(10);
      const tooShort = validateDescription(short);
      expect(tooShort).toEqual({
        field: 'description',
        message:
          'Опишите маршрут чуть подробнее (минимум 50 символов), чтобы путешественникам было понятно, чего ожидать.',
      });

      const valid = 'x'.repeat(60);
      expect(validateDescription(valid)).toBeNull();
    });

    it('validateCountries / validateCategories: require at least one item', () => {
      expect(validateCountries([])).toEqual({
        field: 'countries',
        message: 'Выберите хотя бы одну страну',
      });
      expect(validateCountries(['BY'])).toBeNull();

      expect(validateCategories([])).toEqual({
        field: 'categories',
        message: 'Выберите хотя бы одну категорию',
      });
      expect(validateCategories(['city-break'])).toBeNull();
    });

    it('validateMarkers: requires at least one marker', () => {
      expect(validateMarkers([])).toEqual({
        field: 'coordsMeTravel',
        message: 'Добавьте хотя бы одну точку маршрута на карте',
      });
      expect(validateMarkers([{ lat: 1, lng: 2 } as any])).toBeNull();
    });

    it('validateYear: accepts empty, rejects invalid range and invalid values', () => {
      expect(validateYear(undefined)).toBeNull();
      expect(validateYear('')).toBeNull();

      const tooOld = validateYear('1899');
      expect(tooOld?.field).toBe('year');

      const farFuture = validateYear(String(new Date().getFullYear() + 5));
      expect(farFuture?.field).toBe('year');

      expect(validateYear(2024)).toBeNull();
    });

    it('validateDays: ignores empty, validates range 1..365', () => {
      expect(validateDays(undefined)).toBeNull();
      expect(validateDays('')).toBeNull();

      expect(validateDays(0)).toEqual({
        field: 'number_days',
        message: 'Количество дней должно быть от 1 до 365',
      });

      expect(validateDays(400)).toEqual({
        field: 'number_days',
        message: 'Количество дней должно быть от 1 до 365',
      });

      expect(validateDays(10)).toBeNull();
    });

    it('validatePeople: ignores empty, validates range 1..100', () => {
      expect(validatePeople(undefined)).toBeNull();
      expect(validatePeople('')).toBeNull();

      expect(validatePeople(0)).toEqual({
        field: 'number_peoples',
        message: 'Количество людей должно быть от 1 до 100',
      });

      expect(validatePeople(101)).toEqual({
        field: 'number_peoples',
        message: 'Количество людей должно быть от 1 до 100',
      });

      expect(validatePeople(5)).toBeNull();
    });

    it('validateYouTubeLink: ignores empty value and validates format', () => {
      expect(validateYouTubeLink(undefined)).toBeNull();
      expect(validateYouTubeLink('')).toBeNull();

      const invalid = validateYouTubeLink('https://example.com/video');
      expect(invalid).toEqual({
        field: 'youtube_link',
        message: 'Введите корректную ссылку на YouTube',
      });

      expect(validateYouTubeLink('https://www.youtube.com/watch?v=abc123')).toBeNull();
      expect(validateYouTubeLink('https://youtu.be/abc123')).toBeNull();
    });
  });

  describe('validateTravelForm + getFieldError', () => {
    it('aggregates all field errors into ValidationResult', () => {
      const result = validateTravelForm({} as any);
      expect(result.isValid).toBe(false);

      const fields = result.errors.map(e => e.field).sort();
      expect(fields).toEqual([
        'categories',
        'coordsMeTravel',
        'countries',
        'description',
        'name',
      ].sort());
    });

    it('returns valid result for fully correct data', () => {
      const data = {
        name: 'Trip',
        description: 'X'.repeat(60),
        countries: ['BY'],
        categories: ['city'],
        coordsMeTravel: [{ lat: 1, lng: 2 }],
        year: String(new Date().getFullYear()),
        number_days: '7',
        number_peoples: '3',
      } as any;

      const result = validateTravelForm(data);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('getFieldError: returns message for field or null', () => {
      const errors = [
        { field: 'name', message: 'Ошибка имени' },
        { field: 'description', message: 'Ошибка описания' },
      ];

      expect(getFieldError('name', errors)).toBe('Ошибка имени');
      expect(getFieldError('missing', errors)).toBeNull();
    });
  });
});
