/**
 * Ступени пост-деплой медиа-гейта обязаны совпадать с контрактом хранения.
 *
 * Гейт живёт в CommonJS-скрипте и импортировать TS-контракт не может, поэтому
 * таблица ширин в нём — копия. Копия молча расходится: после включения
 * `MEDIA_IMAGE_DERIVATIVE_READ_ENABLED` (#1180) гейт спрашивал фиксированную
 * `w=1920`, которой нет ни в одном профиле, получал fail-closed 400 и валил
 * каждый деплой 30 ложными ошибками. Этот тест — то, чего тогда не хватало.
 */
import { IMAGE_STORAGE_POLICY_V1 } from '@/constants/imageContract';

const { WIDTHS_BY_FAMILY, widthsFor, DEFAULT_WIDTHS } = require('@/scripts/post-deploy-media-check');

type Profile = { routes: readonly string[]; derivatives: readonly { width: number }[] };

const profiles = Object.entries(IMAGE_STORAGE_POLICY_V1) as [string, Profile][];

const profileForRoute = (route: string): [string, Profile] | undefined =>
  profiles.find(([, profile]) => profile.routes.includes(route as never));

const derivativeRange = (profile: Profile) => {
  const widths = profile.derivatives.map((item) => item.width);
  return { small: Math.min(...widths), large: Math.max(...widths) };
};

describe('пост-деплой медиа-гейт: ступени сверены с IMAGE_STORAGE_POLICY_V1', () => {
  const families = [...WIDTHS_BY_FAMILY.keys()] as string[];

  it.each(families.filter((family) => family !== 'media-resize-legacy'))(
    '%s: small/large — крайние производные своего профиля',
    (family) => {
      const entry = profileForRoute(family);
      expect(entry).toBeDefined();
      expect(widthsFor(family)).toEqual(derivativeRange(entry![1]));
    },
  );

  it('legacy-роут меряется лестницей travel-медиа: он обслуживает её conversion-ключи', () => {
    expect(widthsFor('media-resize-legacy')).toEqual(derivativeRange(IMAGE_STORAGE_POLICY_V1.travelMedia));
  });

  it('ни одна ступень гейта не равна мастеру: мастер раздаётся no-store by design', () => {
    const masters = new Set(profiles.map(([, profile]) => (profile as any).master.width));
    for (const family of families) {
      const { small, large } = widthsFor(family);
      const entry = family === 'media-resize-legacy' ? null : profileForRoute(family);
      const master = entry ? (entry[1] as any).master.width : IMAGE_STORAGE_POLICY_V1.travelMedia.master.width;
      expect(large).not.toBe(master);
      expect(small).not.toBe(master);
      expect(masters.has(large) && large > master).toBe(false);
    }
  });

  it('неизвестное семейство получает ступени по умолчанию, а не падает', () => {
    expect(widthsFor('unknown-family')).toEqual(DEFAULT_WIDTHS);
  });

  it('каждое семейство, которое гейт реально собирает, есть в таблице', () => {
    // Список — из `extractTargetsFromPayloads`; расхождение означает, что цель
    // добавили, а ступени для неё забыли, и она молча меряется дефолтом.
    for (const family of ['travel-image', 'gallery', 'address-image', 'quest-cover', 'media-resize-legacy']) {
      expect(WIDTHS_BY_FAMILY.has(family)).toBe(true);
    }
  });
});
