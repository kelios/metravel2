import { Platform } from 'react-native';

import { shouldShowBrandRow, shouldShowHeaderContextBar } from '@/components/layout/customHeaderModel';
import {
  HEADER_HEIGHT_FALLBACK,
  getHeaderVariantForBand,
} from '@/components/layout/headerLayoutContract';
import { buildCriticalCSS } from '@/utils/criticalCSSBuilder';

// #2100: на телефоне бренд-строка только у разделов навигации; вложенный экран — одна строка «←».
describe('shouldShowBrandRow', () => {
  const prevOS = Platform.OS;
  beforeAll(() => {
    (Platform.OS as any) = 'web';
  });
  afterAll(() => {
    (Platform.OS as any) = prevOS;
  });

  it.each(['/', '/search', '/map', '/quests', '/profile', '/travelsby'])(
    'раздел навигации %s сохраняет бренд-строку на телефоне',
    (path) => {
      expect(shouldShowBrandRow(path, true)).toBe(true);
    },
  );

  it.each(['/trips', '/trips/my', '/contact', '/about', '/settings', '/messages', '/places', '/roulette', '/travels/some-slug', '/history', '/favorites'])(
    'вложенный экран %s на телефоне — без бренд-строки',
    (path) => {
      expect(shouldShowBrandRow(path, true)).toBe(false);
    },
  );

  it.each(['/trips/my', '/contact', '/travels/some-slug', '/'])('desktop и 768–1279 не меняются: %s', (path) => {
    expect(shouldShowBrandRow(path, false)).toBe(true);
  });

  it('вложенный экран без бренд-строки всегда несёт строку «←» (иначе сверху пусто)', () => {
    for (const path of ['/trips', '/trips/my', '/contact', '/about', '/settings', '/messages', '/places', '/roulette', '/history', '/favorites', '/subscriptions', '/userpoints', '/travel/new']) {
      if (!shouldShowBrandRow(path, true)) {
        expect([path, shouldShowHeaderContextBar(path, true, false, true)]).toEqual([path, true]);
      }
    }
  });

  it('контракт высоты: вложенный экран телефона резервирует только строку экрана', () => {
    expect(getHeaderVariantForBand('mobile', true, false)).toBe('mobile-screen');
    expect(HEADER_HEIGHT_FALLBACK['mobile-screen']).toBe(54);
    expect(getHeaderVariantForBand('mobile', true)).toBe('mobile-bar');
    expect(getHeaderVariantForBand('mobile', false, false)).toBe('mobile-nobar');
  });

  it('critical CSS прячет бренд-строку по метке только ниже 768 px', () => {
    const css = buildCriticalCSS();
    const start = css.indexOf('@media (max-width:767.98px){');
    expect(start).toBeGreaterThan(-1);
    const block = css.slice(start, css.indexOf('}\n', css.indexOf('[data-header-brand="phone-hidden"] [data-header-inner="true"]')) + 1);
    expect(block).toContain('[data-header-brand="phone-hidden"] [data-header-inner="true"]{display:none !important}');
    expect(block).toContain('[data-header-brand="phone-hidden"]{padding-bottom:0 !important;min-height:0 !important}');
  });
});
