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

const {
  WIDTHS_BY_FAMILY,
  widthsFor,
  DEFAULT_WIDTHS,
  MASTER_DERIVATIVE_BY_FAMILY,
} = require('@/scripts/post-deploy-media-check');

type Profile = { routes: readonly string[]; derivatives: readonly { width: number }[] };

const profiles = Object.entries(IMAGE_STORAGE_POLICY_V1) as [string, Profile][];

const profileForRoute = (route: string): [string, Profile] | undefined =>
  profiles.find(([, profile]) => profile.routes.includes(route as never));

const derivativeRange = (profile: Profile) => {
  const widths = profile.derivatives.map((item) => item.width);
  return { small: Math.min(...widths), large: Math.max(...widths) };
};

/**
 * Семейства без собственного `routes` в контракте: это не отдельные профили
 * хранения, а legacy-роуты поверх чужих ключей. Каждому — свой профиль-эталон.
 */
const SYNTHETIC_FAMILY_PROFILES: Record<string, Profile> = {
  // Legacy обслуживает conversion-ключи travel-медиа.
  'media-resize-legacy': IMAGE_STORAGE_POLICY_V1.travelMedia,
  // `uploads/**` — фото тела старых статей, лестница та же, что у articleBody.
  'media-resize-uploads': IMAGE_STORAGE_POLICY_V1.articleBody,
};

describe('пост-деплой медиа-гейт: ступени сверены с IMAGE_STORAGE_POLICY_V1', () => {
  const families = [...WIDTHS_BY_FAMILY.keys()] as string[];
  const syntheticFamilies = Object.keys(SYNTHETIC_FAMILY_PROFILES);

  it.each(families.filter((family) => !syntheticFamilies.includes(family)))(
    '%s: small/large — крайние производные своего профиля',
    (family) => {
      const entry = profileForRoute(family);
      expect(entry).toBeDefined();
      expect(widthsFor(family)).toEqual(derivativeRange(entry![1]));
    },
  );

  it.each(syntheticFamilies)('%s: меряется лестницей профиля, чьи ключи обслуживает', (family) => {
    expect(widthsFor(family)).toEqual(derivativeRange(SYNTHETIC_FAMILY_PROFILES[family]));
  });

  it('ни одна ступень гейта не равна мастеру: мастер раздаётся no-store by design', () => {
    const masters = new Set(profiles.map(([, profile]) => (profile as any).master.width));
    for (const family of families) {
      const { small, large } = widthsFor(family);
      const entry = syntheticFamilies.includes(family) ? null : profileForRoute(family);
      const master = entry
        ? (entry[1] as any).master.width
        : (SYNTHETIC_FAMILY_PROFILES[family] as any).master.width;
      expect(large).not.toBe(master);
      expect(small).not.toBe(master);
      expect(masters.has(large) && large > master).toBe(false);
    }
  });

  // Отдельная таблица #1215: ширина мастера, которая обязана обслуживаться
  // производной. Она — тоже копия контракта и разъезжается так же молча.
  it.each([...MASTER_DERIVATIVE_BY_FAMILY.keys()] as string[])(
    '%s: заявленная ширина мастера совпадает с профилем контракта',
    (family) => {
      const entry = profileForRoute(family);
      expect(entry).toBeDefined();
      expect(MASTER_DERIVATIVE_BY_FAMILY.get(family).width).toBe((entry![1] as any).master.width);
    },
  );

  it('ширина мастера не дублирует производные ступени того же семейства', () => {
    for (const [family, rule] of MASTER_DERIVATIVE_BY_FAMILY as Map<string, { width: number }>) {
      const { small, large } = widthsFor(family);
      expect(rule.width).toBeGreaterThan(large);
      expect(rule.width).not.toBe(small);
    }
  });

  it('неизвестное семейство получает ступени по умолчанию, а не падает', () => {
    expect(widthsFor('unknown-family')).toEqual(DEFAULT_WIDTHS);
  });

  it('каждое семейство, которое гейт реально собирает, есть в таблице', () => {
    // Список — из `extractTargetsFromPayloads`; расхождение означает, что цель
    // добавили, а ступени для неё забыли, и она молча меряется дефолтом.
    for (const family of [
      'travel-image',
      'gallery',
      'travel-description-image',
      'address-image',
      'quest-cover',
      'media-resize-legacy',
      'media-resize-uploads',
    ]) {
      expect(WIDTHS_BY_FAMILY.has(family)).toBe(true);
    }
  });
});
