/**
 * @jest-environment jsdom
 *
 * Unit tests for normalizeTravelItem — the central normalization layer that
 * every travel list/detail payload passes through.
 *
 * Highest-value coverage target because:
 * - All travel data (list + details) flows through this function.
 * - The gallery-ordering logic (declared order + explicit `order` field) is
 *   newly added and previously had no dedicated test.
 */

import { normalizeTravelItem } from '@/api/travelsNormalize';

describe('normalizeTravelItem', () => {
  describe('title normalization', () => {
    it('collapses consecutive spaces in name', () => {
      const out = normalizeTravelItem({ name: 'Модынь  -   одна' });
      expect(out.name).toBe('Модынь - одна');
    });

    it('falls back to title when name is empty', () => {
      const out = normalizeTravelItem({ name: '   ', title: 'Backup  Title' });
      expect(out.name).toBe('Backup Title');
    });

    it('uses title when name is absent', () => {
      const out = normalizeTravelItem({ title: 'Only  Title' });
      expect(out.name).toBe('Only Title');
    });
  });

  describe('url canonicalization', () => {
    it('rewrites non-canonical url to /travels/<slug>', () => {
      const out = normalizeTravelItem({ id: 42, slug: 'my-trip', url: 'test' });
      expect(out.url).toBe('/travels/my-trip');
    });

    it('falls back to numeric id when slug missing', () => {
      const out = normalizeTravelItem({ id: 99, url: 'whatever' });
      expect(out.url).toBe('/travels/99');
    });

    it('does not synthesize url when API provided none', () => {
      const out = normalizeTravelItem({ id: 42, slug: 'my-trip' });
      expect(out.url).toBeUndefined();
    });
  });

  describe('draft placeholder stripping', () => {
    it('replaces __draft_placeholder__ with empty string for rich text fields', () => {
      const out = normalizeTravelItem({
        description: '__draft_placeholder__',
        plus: '__draft_placeholder__',
        minus: '__draft_placeholder__',
        recommendation: '__draft_placeholder__',
        youtube_link: '__draft_placeholder__',
      });
      expect(out.description).toBe('');
      expect(out.plus).toBe('');
      expect(out.minus).toBe('');
      expect(out.recommendation).toBe('');
      expect(out.youtube_link).toBe('');
    });
  });

  describe('image URL normalization', () => {
    it('upgrades first-party http cover to https', () => {
      const out = normalizeTravelItem({
        travel_image_thumb_url: 'http://metravel.by/travel-image/1/x.webp',
      });
      expect(out.travel_image_thumb_url).toBe('https://metravel.by/travel-image/1/x.webp');
    });

    it('strips invalid /api prefix from media path and absolutizes', () => {
      const out = normalizeTravelItem({
        travel_image_thumb_url: '/api/gallery/1/cover.webp',
      });
      expect(out.travel_image_thumb_url).toBe(`${window.location.origin}/gallery/1/cover.webp`);
    });

    it('keeps localhost http urls untouched (private host)', () => {
      const url = 'http://localhost/gallery/1/cover.webp';
      const out = normalizeTravelItem({ travel_image_thumb_url: url });
      expect(out.travel_image_thumb_url).toBe(url);
    });

    it('rewrites first-party media urls embedded in rich text description', () => {
      const out = normalizeTravelItem({
        description: '<p><img src="http://metravel.by/gallery/5/a.webp"></p>',
      });
      expect(out.description).toBe('<p><img src="https://metravel.by/gallery/5/a.webp"></p>');
    });
  });

  describe('userIds and user.id derivation', () => {
    it('joins array userIds into a comma-separated string', () => {
      const out = normalizeTravelItem({ userIds: [1, 2, 3] });
      expect(out.userIds).toBe('1,2,3');
    });

    it('derives user.id from first userId when user object missing', () => {
      const out = normalizeTravelItem({ userIds: '7,8', userName: 'Alice' });
      expect((out.user as { id: number; name: string }).id).toBe(7);
      expect((out.user as { id: number; name: string }).name).toBe('Alice');
    });

    it('keeps existing user.id when already present', () => {
      const out = normalizeTravelItem({ userIds: '7,8', user: { id: 55 } });
      expect((out.user as { id: number }).id).toBe(55);
    });
  });

  describe('gallery ordering — declared order', () => {
    it('reorders gallery objects by ids declared in travelImageThumbUrlArr', () => {
      const out = normalizeTravelItem({
        gallery: [
          { id: 1, url: 'https://metravel.by/gallery/1/a.webp' },
          { id: 2, url: 'https://metravel.by/gallery/2/b.webp' },
          { id: 3, url: 'https://metravel.by/gallery/3/c.webp' },
        ],
        travelImageThumbUrlArr: [3, 1, 2],
      });
      expect((out.gallery as { id: number }[]).map((g) => g.id)).toEqual([3, 1, 2]);
    });

    it('extracts ids from gallery url paths when declared order uses url strings', () => {
      const out = normalizeTravelItem({
        gallery: [
          { url: 'https://metravel.by/gallery/10/a.webp' },
          { url: 'https://metravel.by/gallery/20/b.webp' },
        ],
        thumbs200ForCollectionArr: [
          'https://metravel.by/gallery/20/b.webp',
          'https://metravel.by/gallery/10/a.webp',
        ],
      });
      expect((out.gallery as { url: string }[]).map((g) => g.url)).toEqual([
        'https://metravel.by/gallery/20/b.webp',
        'https://metravel.by/gallery/10/a.webp',
      ]);
    });

    it('falls back to next candidate array when first is empty', () => {
      const out = normalizeTravelItem({
        gallery: [
          { id: 1, url: 'https://metravel.by/gallery/1/a.webp' },
          { id: 2, url: 'https://metravel.by/gallery/2/b.webp' },
        ],
        travelImageThumbUrlArr: [],
        travelImageAddress: [2, 1],
      });
      expect((out.gallery as { id: number }[]).map((g) => g.id)).toEqual([2, 1]);
    });

    it('leaves single-item gallery untouched', () => {
      const out = normalizeTravelItem({
        gallery: [{ id: 1, url: 'https://metravel.by/gallery/1/a.webp' }],
        travelImageThumbUrlArr: [99],
      });
      expect((out.gallery as { id: number }[]).map((g) => g.id)).toEqual([1]);
    });
  });

  describe('gallery ordering — explicit order field', () => {
    it('sorts gallery by explicit numeric order field', () => {
      const out = normalizeTravelItem({
        gallery: [
          { id: 1, url: 'https://metravel.by/gallery/1/a.webp', order: 2 },
          { id: 2, url: 'https://metravel.by/gallery/2/b.webp', order: 0 },
          { id: 3, url: 'https://metravel.by/gallery/3/c.webp', order: 1 },
        ],
      });
      expect((out.gallery as { id: number }[]).map((g) => g.id)).toEqual([2, 3, 1]);
    });

    it('explicit order overrides declared order', () => {
      const out = normalizeTravelItem({
        gallery: [
          { id: 1, url: 'https://metravel.by/gallery/1/a.webp', order: 1 },
          { id: 2, url: 'https://metravel.by/gallery/2/b.webp', order: 0 },
        ],
        travelImageThumbUrlArr: [1, 2],
      });
      expect((out.gallery as { id: number }[]).map((g) => g.id)).toEqual([2, 1]);
    });

    it('keeps gallery order stable when no ordering hints present', () => {
      const out = normalizeTravelItem({
        gallery: [
          { id: 5, url: 'https://metravel.by/gallery/5/a.webp' },
          { id: 9, url: 'https://metravel.by/gallery/9/b.webp' },
        ],
      });
      expect((out.gallery as { id: number }[]).map((g) => g.id)).toEqual([5, 9]);
    });
  });

  describe('robustness', () => {
    it('returns an object for non-object input', () => {
      expect(normalizeTravelItem(null)).toEqual({});
      expect(normalizeTravelItem(undefined)).toEqual({});
      expect(normalizeTravelItem('garbage')).toEqual({});
    });

    it('drops falsy gallery entries', () => {
      const out = normalizeTravelItem({
        gallery: [
          { id: 1, url: 'https://metravel.by/gallery/1/a.webp' },
          null,
          { id: 2, url: 'https://metravel.by/gallery/2/b.webp' },
        ],
      });
      expect((out.gallery as unknown[]).length).toBe(2);
    });
  });
});
