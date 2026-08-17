import { normalizeTravelPreview, resolveTravelUrl } from '@/utils/subscriptionsHelpers';

describe('subscriptions.helpers', () => {
  describe('normalizeTravelPreview', () => {
    it('normalizes primitive fields and coerces id', () => {
      const preview = normalizeTravelPreview({
        id: '42',
        slug: 'trip',
        name: 'Trip Name',
        travel_image_thumb_url: '/a.jpg',
        city: 'Minsk',
      });

      expect(preview).toEqual(
        expect.objectContaining({
          id: 42,
          slug: 'trip',
          name: 'Trip Name',
          travel_image_thumb_url: '/a.jpg',
          city: 'Minsk',
        })
      );
    });

    it('falls back to numeric zero id when source is invalid', () => {
      const preview = normalizeTravelPreview({ id: 'abc', _id: null } as any);
      expect(preview.id).toBe(0);
    });
  });

  describe('resolveTravelUrl', () => {
    it('uses explicit url when present', () => {
      expect(resolveTravelUrl({ id: 1, url: '/custom/url' })).toBe('/custom/url');
    });

    it('falls back to slug when url is missing', () => {
      expect(resolveTravelUrl({ id: 1, slug: 'my-trip' })).toBe('/travels/my-trip');
    });

    it('falls back to id when both url and slug are missing', () => {
      expect(resolveTravelUrl({ id: 77 })).toBe('/travels/77');
    });

    // #1185: поле объявлено как number, но с бэкенда приходит и null — шаблон
    // отдавал строку `/travels/null`, и карточка вела на 404.
    it('returns an empty string when there is no usable identity', () => {
      expect(resolveTravelUrl({ id: null } as any)).toBe('');
      expect(resolveTravelUrl({ id: undefined } as any)).toBe('');
      expect(resolveTravelUrl({ id: 0 })).toBe('');
      expect(resolveTravelUrl({ id: Number.NaN })).toBe('');
    });

    // #1438: результат уходит прямо в `href` карточки каталога — это
    // единственный настоящий `<a>` с travel-адресом на странице статьи.
    // Серверное поле `url` пропускалось без проверки сегмента.
    it.each(['/travels/null', '/travels/undefined', '/travels/0', 'https://metravel.by/travels/null'])(
      'does not pass the unusable backend url %p through to the href',
      (url) => {
        expect(resolveTravelUrl({ id: null, url } as any)).toBe('');
      },
    );

    it('still prefers a healthy backend url and keeps non-travel links intact', () => {
      expect(resolveTravelUrl({ id: null, url: '/travels/grodno' } as any)).toBe('/travels/grodno');
      expect(resolveTravelUrl({ id: 1, url: '/custom/url?a=1#b' })).toBe('/custom/url');
    });

    it('falls back to the id when the backend url is unusable', () => {
      expect(resolveTravelUrl({ id: 77, url: '/travels/null' })).toBe('/travels/77');
    });
  });
});

