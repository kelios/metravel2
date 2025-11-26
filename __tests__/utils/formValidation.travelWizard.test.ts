import { validateStep, getModerationErrors } from '@/utils/formValidation';

describe('travel wizard validation', () => {
  describe('validateStep', () => {
    it('step 1: requires name and description, but not countries', () => {
      const base = { name: 'Test trip', description: 'X'.repeat(60), countries: [] };

      const ok = validateStep(1, base as any);
      expect(ok.isValid).toBe(true);

      const noName = validateStep(1, { ...base, name: '' } as any);
      expect(noName.isValid).toBe(false);
      expect(noName.errors.some(e => e.field === 'name')).toBe(true);

      const noDescription = validateStep(1, { ...base, description: '' } as any);
      expect(noDescription.isValid).toBe(false);
      expect(noDescription.errors.some(e => e.field === 'description')).toBe(true);
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
});
