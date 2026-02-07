import {
  isLocalPreviewUrl,
  isEmptyImageValue,
  mergeMarkersPreserveImages,
  ensureRequiredDraftFields,
  normalizeDraftPlaceholders,
  isDraftPlaceholder,
  keepCurrentField,
  normalizeNullableStrings,
  normalizeMarkersForSave,
  normalizeGalleryForSave,
  sanitizeCoverUrl,
  filterAllowedKeys,
  mergeOverridePreservingUserInput,
  DRAFT_PLACEHOLDER_PREFIX,
} from '@/utils/travelFormNormalization';

describe('travelFormNormalization', () => {
  describe('isLocalPreviewUrl', () => {
    it('returns true for blob: URLs', () => {
      expect(isLocalPreviewUrl('blob:http://localhost/abc')).toBe(true);
    });

    it('returns true for data: URLs', () => {
      expect(isLocalPreviewUrl('data:image/png;base64,abc')).toBe(true);
    });

    it('returns false for http URLs', () => {
      expect(isLocalPreviewUrl('https://cdn.com/img.jpg')).toBe(false);
    });

    it('returns false for non-strings', () => {
      expect(isLocalPreviewUrl(null)).toBe(false);
      expect(isLocalPreviewUrl(undefined)).toBe(false);
      expect(isLocalPreviewUrl(42)).toBe(false);
    });

    it('returns false for empty string', () => {
      expect(isLocalPreviewUrl('')).toBe(false);
      expect(isLocalPreviewUrl('  ')).toBe(false);
    });
  });

  describe('isEmptyImageValue', () => {
    it('returns true for null/undefined', () => {
      expect(isEmptyImageValue(null)).toBe(true);
      expect(isEmptyImageValue(undefined)).toBe(true);
    });

    it('returns true for empty/whitespace string', () => {
      expect(isEmptyImageValue('')).toBe(true);
      expect(isEmptyImageValue('   ')).toBe(true);
    });

    it('returns false for non-empty string', () => {
      expect(isEmptyImageValue('img.jpg')).toBe(false);
    });

    it('returns false for non-string types', () => {
      expect(isEmptyImageValue(42)).toBe(false);
    });
  });

  describe('isDraftPlaceholder', () => {
    it('returns true for placeholder value', () => {
      expect(isDraftPlaceholder(DRAFT_PLACEHOLDER_PREFIX)).toBe(true);
    });

    it('returns false for regular strings', () => {
      expect(isDraftPlaceholder('hello')).toBe(false);
    });

    it('returns false for non-strings', () => {
      expect(isDraftPlaceholder(null)).toBe(false);
      expect(isDraftPlaceholder(42)).toBe(false);
    });
  });

  describe('mergeMarkersPreserveImages', () => {
    it('returns current markers when server is empty', () => {
      const current = [{ id: 1, image: 'local.jpg' }];
      expect(mergeMarkersPreserveImages([], current)).toBe(current);
    });

    it('returns server markers when current is empty', () => {
      const server = [{ id: 1, image: 'server.jpg' }];
      expect(mergeMarkersPreserveImages(server, [])).toBe(server);
    });

    it('preserves local image when server image is empty', () => {
      const server = [{ id: 1, lat: 50, lng: 30, image: '' }];
      const current = [{ id: 1, lat: 50, lng: 30, image: 'local.jpg' }];
      const result = mergeMarkersPreserveImages(server, current);
      expect(result[0].image).toBe('local.jpg');
    });

    it('uses server image when it has value', () => {
      const server = [{ id: 1, lat: 50, lng: 30, image: 'server.jpg' }];
      const current = [{ id: 1, lat: 50, lng: 30, image: 'local.jpg' }];
      const result = mergeMarkersPreserveImages(server, current);
      expect(result[0].image).toBe('server.jpg');
    });
  });

  describe('ensureRequiredDraftFields', () => {
    it('initializes missing array fields to empty arrays', () => {
      const result = ensureRequiredDraftFields({} as any);
      expect(result.categories).toEqual([]);
      expect(result.transports).toEqual([]);
    });

    it('normalizes boolean fields from strings', () => {
      const result = ensureRequiredDraftFields({
        publish: 'true' as any,
        visa: 'false' as any,
        moderation: '1' as any,
      } as any);
      expect(result.publish).toBe(true);
      expect(result.visa).toBe(false);
      expect(result.moderation).toBe(true);
    });

    it('fills blank string fields with placeholder for drafts', () => {
      const result = ensureRequiredDraftFields({
        publish: false,
        moderation: false,
        description: '',
      } as any);
      expect(result.description).toBe(DRAFT_PLACEHOLDER_PREFIX);
    });

    it('fills blank string fields with null for published', () => {
      const result = ensureRequiredDraftFields({
        publish: true,
        moderation: false,
        description: '',
      } as any);
      expect(result.description).toBeNull();
    });
  });

  describe('normalizeDraftPlaceholders', () => {
    it('replaces placeholders with empty strings', () => {
      const result = normalizeDraftPlaceholders({
        description: DRAFT_PLACEHOLDER_PREFIX,
        plus: 'real content',
      } as any);
      expect(result.description).toBe('');
      expect(result.plus).toBe('real content');
    });

    it('normalizes whitespace-only strings to empty', () => {
      const result = normalizeDraftPlaceholders({
        minus: '   ',
      } as any);
      expect(result.minus).toBe('');
    });
  });

  describe('keepCurrentField', () => {
    it('emptyString: keeps current when server is empty', () => {
      const target = { name: '' };
      const current = { name: 'User input' };
      keepCurrentField(target, current, 'name', 'emptyString');
      expect(target.name).toBe('User input');
    });

    it('nil: keeps current when server is null', () => {
      const target = { name: null as any };
      const current = { name: 'User input' };
      keepCurrentField(target, current, 'name', 'nil');
      expect(target.name).toBe('User input');
    });

    it('emptyArray: keeps current when server array is empty', () => {
      const target = { tags: [] as string[] };
      const current = { tags: ['a', 'b'] };
      keepCurrentField(target, current, 'tags', 'emptyArray');
      expect(target.tags).toEqual(['a', 'b']);
    });

    it('nilArray: keeps current when server is null', () => {
      const target = { tags: null as any };
      const current = { tags: ['a'] };
      keepCurrentField(target, current, 'tags', 'nilArray');
      expect(target.tags).toEqual(['a']);
    });

    it('missingImageUrl: keeps current when server is empty', () => {
      const target = { img: '' };
      const current = { img: 'local.jpg' };
      keepCurrentField(target, current, 'img', 'missingImageUrl');
      expect(target.img).toBe('local.jpg');
    });
  });

  describe('normalizeNullableStrings', () => {
    it('converts null fields to empty strings', () => {
      const result = normalizeNullableStrings({
        name: null,
        description: null,
        budget: 'ok',
      } as any);
      expect(result.name).toBe('');
      expect(result.description).toBe('');
      expect(result.budget).toBe('ok');
    });
  });

  describe('normalizeMarkersForSave', () => {
    it('returns empty array for non-array input', () => {
      expect(normalizeMarkersForSave(null as any)).toEqual([]);
      expect(normalizeMarkersForSave(undefined as any)).toEqual([]);
    });

    it('nullifies local preview images', () => {
      const markers = [{ lat: 50, lng: 30, image: 'blob:http://localhost/abc' }];
      const result = normalizeMarkersForSave(markers);
      expect(result[0].image).toBeNull();
    });

    it('keeps server images', () => {
      const markers = [{ lat: 50, lng: 30, image: 'https://cdn.com/img.jpg' }];
      const result = normalizeMarkersForSave(markers);
      expect(result[0].image).toBe('https://cdn.com/img.jpg');
    });

    it('converts categories to numbers', () => {
      const markers = [{ lat: 50, lng: 30, categories: ['1', '2', 'abc'] }];
      const result = normalizeMarkersForSave(markers);
      expect(result[0].categories).toEqual([1, 2]);
    });
  });

  describe('normalizeGalleryForSave', () => {
    it('returns undefined for non-array', () => {
      expect(normalizeGalleryForSave(undefined)).toBeUndefined();
    });

    it('filters out empty strings', () => {
      expect(normalizeGalleryForSave(['', 'img.jpg', '  '])).toEqual(['img.jpg']);
    });

    it('filters out blob URLs', () => {
      expect(normalizeGalleryForSave(['blob:x', 'https://cdn.com/a.jpg'])).toEqual([
        'https://cdn.com/a.jpg',
      ]);
    });

    it('handles object items with url property', () => {
      const gallery = [
        { url: 'https://cdn.com/a.jpg' },
        { url: '' },
        { url: 'blob:x' },
      ];
      const result = normalizeGalleryForSave(gallery);
      expect(result).toHaveLength(1);
      expect((result as any)[0].url).toBe('https://cdn.com/a.jpg');
    });
  });

  describe('sanitizeCoverUrl', () => {
    it('returns null for blob URLs', () => {
      expect(sanitizeCoverUrl('blob:http://localhost/x')).toBeNull();
    });

    it('returns null for data URLs', () => {
      expect(sanitizeCoverUrl('data:image/png;base64,abc')).toBeNull();
    });

    it('returns the URL for server URLs', () => {
      expect(sanitizeCoverUrl('https://cdn.com/cover.jpg')).toBe('https://cdn.com/cover.jpg');
    });

    it('returns null for null/undefined', () => {
      expect(sanitizeCoverUrl(null)).toBeNull();
      expect(sanitizeCoverUrl(undefined)).toBeNull();
    });
  });

  describe('filterAllowedKeys', () => {
    it('keeps only allowed keys', () => {
      const data = { name: 'Trip', secret: 'x', slug: 'trip' };
      const result = filterAllowedKeys(data, ['name']);
      expect(result).toEqual({ name: 'Trip', slug: 'trip' });
      expect((result as any).secret).toBeUndefined();
    });

    it('always includes slug and image keys', () => {
      const data = { slug: 's', travel_image_thumb_url: 'img', travel_image_thumb_small_url: 'sm' };
      const result = filterAllowedKeys(data, []);
      expect(result).toEqual(data);
    });
  });

  describe('mergeOverridePreservingUserInput', () => {
    it('keeps current string when override is null', () => {
      const current = { name: 'My Trip', description: 'Desc' } as any;
      const override = { name: null, description: 'New desc' } as any;
      const result = mergeOverridePreservingUserInput(current, override);
      expect(result.name).toBe('My Trip');
      expect(result.description).toBe('New desc');
    });

    it('keeps current string when override is placeholder', () => {
      const current = { description: 'Real text' } as any;
      const override = { description: DRAFT_PLACEHOLDER_PREFIX } as any;
      const result = mergeOverridePreservingUserInput(current, override);
      expect(result.description).toBe('Real text');
    });

    it('keeps current string when override is empty', () => {
      const current = { plus: 'Good stuff' } as any;
      const override = { plus: '' } as any;
      const result = mergeOverridePreservingUserInput(current, override);
      expect(result.plus).toBe('Good stuff');
    });

    it('keeps current array when override is empty array', () => {
      const current = { categories: [1, 2] } as any;
      const override = { categories: [] } as any;
      const result = mergeOverridePreservingUserInput(current, override);
      expect(result.categories).toEqual([1, 2]);
    });

    it('uses override array when it has values', () => {
      const current = { categories: [1] } as any;
      const override = { categories: [3, 4] } as any;
      const result = mergeOverridePreservingUserInput(current, override);
      expect(result.categories).toEqual([3, 4]);
    });
  });
});
