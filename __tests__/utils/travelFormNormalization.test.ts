import {
  isLocalPreviewUrl,
  isEmptyImageValue,
  mergeMarkersPreserveImages,
  ensureRequiredDraftFields,
  normalizeDraftPlaceholders,
  isDraftPlaceholder,
  isBlankTravelContent,
  keepCurrentField,
  normalizeNullableStrings,
  normalizeMarkersForSave,
  normalizeGalleryForSave,
  normalizeGalleryImageIdsForSave,
  sanitizeCoverUrl,
  filterAllowedKeys,
  mergeOverridePreservingUserInput,
  DRAFT_PLACEHOLDER_PREFIX,
} from '@/utils/travelFormNormalization';
import { getEmptyFormData } from '@/utils/travelFormUtils';

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

    it('preserves local blob preview when matched by id after save', () => {
      // After save the server assigns an id and stores a fallback cover image;
      // the local blob preview must survive until the real point photo uploads.
      const server = [{ id: 5, lat: 53.123456, lng: 27.654321, image: 'https://cdn.com/og-default.png' }];
      const current = [{ id: 5, lat: 53.123456, lng: 27.654321, image: 'blob:http://localhost/point-preview' }];
      const result = mergeMarkersPreserveImages(server, current);
      expect(result[0].image).toBe('blob:http://localhost/point-preview');
    });

    it('preserves local blob preview for new (id==null) marker matched by exact coords', () => {
      const server = [{ id: 9, lat: 53.123456, lng: 27.654321, image: 'https://cdn.com/og-default.png' }];
      const current = [{ id: null, lat: 53.123456, lng: 27.654321, image: 'blob:http://localhost/abc' }];
      const result = mergeMarkersPreserveImages(server, current);
      expect(result[0].image).toBe('blob:http://localhost/abc');
    });

    it('preserves local blob preview when server rounds coords (tolerant match, id==null)', () => {
      // Local EXIF float vs server-rounded coords: strict ll-key would miss, but the
      // tolerant coordinate match must still carry over the blob preview.
      const server = [{ id: 12, lat: 53.1234561, lng: 27.6543209, image: 'https://cdn.com/og-default.png' }];
      const current = [{ id: null, lat: 53.12345678, lng: 27.65432123, image: 'blob:http://localhost/from-photo' }];
      const result = mergeMarkersPreserveImages(server, current);
      expect(result[0].image).toBe('blob:http://localhost/from-photo');
    });

    it('does not cross-match distant markers when coords differ beyond tolerance', () => {
      const server = [{ id: 1, lat: 53.5, lng: 27.5, image: 'https://cdn.com/og-default.png' }];
      const current = [{ id: null, lat: 50.0, lng: 30.0, image: 'blob:http://localhost/other' }];
      const result = mergeMarkersPreserveImages(server, current);
      expect(result[0].image).toBe('https://cdn.com/og-default.png');
    });

    it('round-trips: blob omitted from save payload but kept in local display list', () => {
      // 1) Payload to server must NOT contain the blob (fallback used instead).
      const localMarkers = [
        { id: null, lat: 53.123456, lng: 27.654321, image: 'blob:http://localhost/from-photo', categories: [] },
      ];
      const payload = normalizeMarkersForSave(localMarkers, 'https://cdn.com/fallback.jpg');
      expect(payload[0].image).toBe('https://cdn.com/fallback.jpg');
      expect(payload[0].image).not.toMatch(/^blob:/);

      // 2) Server echoes the saved marker (with id + fallback image); local display
      // list must keep the blob preview after merge.
      const serverMarkers = [
        { id: 42, lat: 53.123456, lng: 27.654321, image: 'https://cdn.com/fallback.jpg' },
      ];
      const merged = mergeMarkersPreserveImages(serverMarkers, localMarkers);
      expect(merged[0].id).toBe(42);
      expect(merged[0].image).toBe('blob:http://localhost/from-photo');
    });

    it('keeps a freshly added local marker missing from a stale server response', () => {
      // Stale autosave response (snapshot before point C was added) returns only A, B.
      const server = [
        { id: 1, lat: 53.1, lng: 27.1, image: 'https://cdn.com/a.jpg' },
        { id: 2, lat: 53.2, lng: 27.2, image: 'https://cdn.com/b.jpg' },
      ];
      // Local state already has a newly added no-category/no-photo point C (id==null).
      const current = [
        { id: 1, lat: 53.1, lng: 27.1, image: 'https://cdn.com/a.jpg' },
        { id: 2, lat: 53.2, lng: 27.2, image: 'https://cdn.com/b.jpg' },
        { id: null, lat: 53.95, lng: 27.6, image: null, categories: [] },
      ];
      const merged = mergeMarkersPreserveImages(server, current);
      expect(merged).toHaveLength(3);
      expect(merged.some(m => m.lat === 53.95 && m.lng === 27.6)).toBe(true);
    });

    it('does not duplicate a new marker that the server response already echoed', () => {
      const current = [{ id: null, lat: 53.95, lng: 27.6, image: null, categories: [] }];
      const server = [{ id: 99, lat: 53.95, lng: 27.6, image: null }];
      const merged = mergeMarkersPreserveImages(server, current);
      expect(merged).toHaveLength(1);
      expect(merged[0].id).toBe(99);
    });
  });

  describe('ensureRequiredDraftFields', () => {
    it('initializes missing array fields to empty arrays', () => {
      const result = ensureRequiredDraftFields({} as any);
      expect(result.categories).toEqual([]);
      expect(result.transports).toEqual([]);
      expect(result.travelImageThumbUrArr).toEqual([]);
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

    it('fills blank draft name with generated placeholder', () => {
      const result = ensureRequiredDraftFields({
        publish: false,
        moderation: false,
        name: '',
      } as any);
      expect(result.name).toContain(`${DRAFT_PLACEHOLDER_PREFIX}name__`);
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

    it('hides generated draft name placeholders from UI', () => {
      const result = normalizeDraftPlaceholders({
        name: `${DRAFT_PLACEHOLDER_PREFIX}name__abc123`,
      } as any);
      expect(result.name).toBe('');
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

    it('omits local preview images', () => {
      const markers = [{ lat: 50, lng: 30, image: 'blob:http://localhost/abc' }];
      const result = normalizeMarkersForSave(markers);
      expect(result[0].image).toBeUndefined();
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

    it('keeps id=null for new markers in existing route payloads', () => {
      const markers = [{ id: null, lat: 50, lng: 30, categories: [] }];
      const result = normalizeMarkersForSave(markers);
      expect(result[0].id).toBeNull();
    });

    it('uses fallback image when marker image is missing', () => {
      const markers = [{ lat: 50, lng: 30, image: '' }];
      const result = normalizeMarkersForSave([{ ...markers[0], id: 7 }], 'https://cdn.com/fallback.jpg');
      expect(result[0].image).toBe('https://cdn.com/fallback.jpg');
    });

    it('does not use local-preview fallback image', () => {
      const markers = [{ lat: 50, lng: 30, image: '' }];
      const result = normalizeMarkersForSave(markers, 'blob:http://localhost/fallback');
      expect(result[0].image).toBeUndefined();
    });

    it('uses fallback image for new marker when backend requires image field', () => {
      const markers = [{ id: null, lat: 50, lng: 30, image: 'blob:http://localhost/point-preview' }];
      const result = normalizeMarkersForSave(markers, 'https://cdn.com/fallback.jpg');
      expect(result[0].image).toBe('https://cdn.com/fallback.jpg');
    });

    it('drops a long /travel-image/ cover URL that would overflow the image column', () => {
      // Reproduces travel 225 upsert crash: the persisted point image was the
      // travel cover thumb (/travel-image/, 104 chars). Backend stores it verbatim
      // (only /address-image/ is stripped) → varchar(100) DataError on the whole save.
      const coverUrl =
        'https://metravel.by/travel-image/1322/conversions/CBhZRPPUEEgoHhl688XKiKDYpQMmdbKIfURYGH8P-thumb_200.jpg';
      expect(coverUrl.length).toBeGreaterThan(100);
      const result = normalizeMarkersForSave([{ id: null, lat: 50, lng: 30, image: coverUrl }], coverUrl);
      expect(result[0].image).toBeUndefined();
    });

    it('keeps an /address-image/ URL (backend strips prefix, fits the column)', () => {
      const addressImageUrl =
        'https://metravel.by/address-image/15730/conversions/1bd51dd2ad0b4be9a412168e97269354.webp';
      const result = normalizeMarkersForSave([{ id: 7, lat: 50, lng: 30, image: addressImageUrl }]);
      expect(result[0].image).toBe(addressImageUrl);
    });

    it('caps long point address to 100 chars (prod varchar(100) guard)', () => {
      const longAddress = 'Музей центральной части города '.repeat(10).trim();
      expect(longAddress.length).toBeGreaterThan(100);
      const result = normalizeMarkersForSave([{ id: 7, lat: 50, lng: 30, address: longAddress }]);
      expect((result[0].address as string).length).toBe(100);
      expect(result[0].address).toBe(longAddress.slice(0, 100));
    });

    it('keeps short address untouched and trims whitespace', () => {
      const result = normalizeMarkersForSave([{ id: 7, lat: 50, lng: 30, address: '  Гомель  ' }]);
      expect(result[0].address).toBe('Гомель');
    });
  });

  describe('normalizeGalleryForSave', () => {
    it('returns undefined for non-array', () => {
      expect(normalizeGalleryForSave(undefined)).toBeUndefined();
    });

    it('filters out empty strings', () => {
      expect(normalizeGalleryForSave(['', 'img.jpg', '  '])).toEqual([{ url: 'img.jpg' }]);
    });

    it('filters out blob URLs', () => {
      expect(normalizeGalleryForSave(['blob:x', 'https://cdn.com/a.jpg'])).toEqual([
        { url: 'https://cdn.com/a.jpg' },
      ]);
    });

    it('handles object items with url property', () => {
      const gallery = [
        { id: 77, url: 'https://cdn.com/a.jpg', caption: '  Несвижский замок  ' },
        { url: '' },
        { url: 'blob:x' },
      ];
      const result = normalizeGalleryForSave(gallery);
      expect(result).toHaveLength(1);
      expect((result as any)[0].url).toBe('https://cdn.com/a.jpg');
      expect((result as any)[0].id).toBe(77);
      expect((result as any)[0].caption).toBe('  Несвижский замок  ');
    });

    it('extracts id from gallery URL when id is missing', () => {
      const result = normalizeGalleryForSave([
        'https://metravel.by/gallery/3796/conversions/cover.webp',
      ]);
      expect((result as any)[0].id).toBe(3796);
      expect((result as any)[0].url).toContain('/gallery/3796/');
    });
  });

  describe('normalizeGalleryImageIdsForSave', () => {
    it('returns only numeric ids', () => {
      const result = normalizeGalleryImageIdsForSave([
        { id: 1, url: 'a' },
        { id: '2', url: 'b' },
        { id: 'bad', url: 'c' },
      ]);
      expect(result).toEqual([1, 2]);
    });

    it('returns empty array for non-array input', () => {
      expect(normalizeGalleryImageIdsForSave(undefined)).toEqual([]);
    });
  });

  describe('sanitizeCoverUrl', () => {
    it('returns null for blob URLs', () => {
      expect(sanitizeCoverUrl('blob:http://localhost/x')).toBeNull();
    });

    it('returns null for data URLs', () => {
      expect(sanitizeCoverUrl('data:image/png;base64,abc')).toBeNull();
    });

    it.each([
      'file:///data/user/0/by.metravel.app/cache/cover.jpg',
      'content://media/external/images/media/42',
      'ph://native-photo-id',
    ])('returns null for native local preview %s', (uri) => {
      expect(isLocalPreviewUrl(uri)).toBe(true);
      expect(sanitizeCoverUrl(uri)).toBeNull();
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

  describe('isBlankTravelContent', () => {
    const empty = () => getEmptyFormData('641');

    it('flags a freshly emptied form (getEmptyFormData) as blank', () => {
      expect(isBlankTravelContent(empty())).toBe(true);
    });

    it('flags a form filled only with draft placeholders as blank', () => {
      const data = {
        ...empty(),
        name: `${DRAFT_PLACEHOLDER_PREFIX}name__-x5zfsb`,
        description: DRAFT_PLACEHOLDER_PREFIX,
        plus: DRAFT_PLACEHOLDER_PREFIX,
        minus: DRAFT_PLACEHOLDER_PREFIX,
        recommendation: DRAFT_PLACEHOLDER_PREFIX,
      } as any;
      expect(isBlankTravelContent(data)).toBe(true);
    });

    it('does NOT flag a form with real description text', () => {
      const data = { ...empty(), description: '<p>Замок Болчув…</p>' } as any;
      expect(isBlankTravelContent(data)).toBe(false);
    });

    it('does NOT flag a form that only has route points', () => {
      const data = { ...empty(), coordsMeTravel: [{ id: 1, lat: 50.8, lng: 15.9 }] } as any;
      expect(isBlankTravelContent(data)).toBe(false);
    });

    it('does NOT flag a form that only has filter selections', () => {
      const data = { ...empty(), categories: [2] } as any;
      expect(isBlankTravelContent(data)).toBe(false);
    });

    it('ignores server echo fields (gallery/title) — they do not count as content', () => {
      const data = {
        ...empty(),
        gallery: [{ id: 1, url: 'x' }],
        title: 'Замок Болчув',
        travel_image_thumb_url: 'https://metravel.by/x.webp',
      } as any;
      expect(isBlankTravelContent(data)).toBe(true);
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
