/**
 * Ступени пост-деплой медиа-гейта обязаны совпадать с контрактом хранения.
 *
 * Гейт живёт в CommonJS-скрипте и импортировать TS-контракт не может, поэтому
 * таблица ширин в нём — копия. Копия молча расходится: после включения
 * `MEDIA_IMAGE_DERIVATIVE_READ_ENABLED` (#1180) гейт спрашивал фиксированную
 * `w=1920`, которой нет ни в одном профиле, получал fail-closed 400 и валил
 * каждый деплой 30 ложными ошибками. Этот тест — то, чего тогда не хватало.
 */
import { IMAGE_STORAGE_POLICY_V1, LEGACY_UPLOAD_FIXED_WIDTH } from '@/constants/imageContract';

const {
  WIDTHS_BY_FAMILY,
  widthsFor,
  DEFAULT_WIDTHS,
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
};

describe('пост-деплой медиа-гейт: ступени сверены с IMAGE_STORAGE_POLICY_V1', () => {
  const families = [...WIDTHS_BY_FAMILY.keys()] as string[];
  const syntheticFamilies = Object.keys(SYNTHETIC_FAMILY_PROFILES);
  /** Класс без лестницы: меряется не профилем, а тем, что фронт реально просит. */
  const LADDERLESS_FAMILY = 'media-resize-uploads';
  const derivedFamilies = families.filter(
    (family) => !syntheticFamilies.includes(family) && family !== LADDERLESS_FAMILY,
  );

  it.each(derivedFamilies)('%s: small/large — крайние производные своего профиля', (family) => {
    const entry = profileForRoute(family);
    expect(entry).toBeDefined();
    expect(widthsFor(family)).toEqual(derivativeRange(entry![1]));
  });

  it.each(syntheticFamilies)('%s: меряется лестницей профиля, чьи ключи обслуживает', (family) => {
    expect(widthsFor(family)).toEqual(derivativeRange(SYNTHETIC_FAMILY_PROFILES[family]));
  });

  /**
   * Раньше этот класс был приписан профилю `articleBody`, и потолок ему доставался
   * оттуда же. Приписка неверна по существу: durable-производных у `uploads/**` нет
   * ни одной, класс живёт только явным `f=jpeg`, а фронт просит у него РОВНО одну
   * ширину. Пока потолок был 1600, разница не проявлялась; когда профиль дорос до
   * 1920, гейт начал бы мерить класс шириной, которой у него нет (#1373).
   */
  it(`${LADDERLESS_FAMILY}: меряется шириной, которую фронт реально просит`, () => {
    expect(widthsFor(LADDERLESS_FAMILY)).toEqual({
      small: derivativeRange(IMAGE_STORAGE_POLICY_V1.articleBody).small,
      large: LEGACY_UPLOAD_FIXED_WIDTH,
    });
  });

  /**
   * Первое из двух свойств каждой ступени: она обязана быть ОБЪЯВЛЕННОЙ
   * производной своего профиля — ширину вне профиля durable-чтение отвечает 400,
   * и гейт мерил бы фикцию.
   */
  it('каждая ступень гейта — объявленная производная своего профиля', () => {
    for (const family of families) {
      // У `uploads/**` своих производных нет; ширины ему режет `articleBody`, чьи
      // ключи он обслуживает, — обе обязаны быть объявленными ступенями профиля.
      const profile =
        family === LADDERLESS_FAMILY
          ? (IMAGE_STORAGE_POLICY_V1.articleBody as unknown as Profile)
          : syntheticFamilies.includes(family)
            ? SYNTHETIC_FAMILY_PROFILES[family]
            : profileForRoute(family)![1];
      const derivatives = profile.derivatives.map((item) => item.width);
      const { small, large } = widthsFor(family);

      expect({
        family,
        small: derivatives.includes(small),
        large: derivatives.includes(large),
      }).toEqual({ family, small: true, large: true });
    }
  });

  /**
   * Второе свойство — tripwire, снятие которого уже один раз пропустило дрейф:
   * ни одна ступень гейта не равна ширине мастера своего профиля. Мастер
   * раздаётся `no-store` by design, и проба по его ширине — ложная ошибка на
   * каждый деплой. Однодневное исключение «у articleBody есть производная
   * content_1920 в ширину мастера» бэкенд снял shrink-коммитом `9136878`
   * («SHALL NOT expose … content_1920»), и правило снова без исключений (#1373).
   */
  it('ни одна ступень гейта не равна ширине мастера своего профиля', () => {
    for (const family of families) {
      const profile =
        family === LADDERLESS_FAMILY
          ? (IMAGE_STORAGE_POLICY_V1.articleBody as unknown as Profile)
          : syntheticFamilies.includes(family)
            ? SYNTHETIC_FAMILY_PROFILES[family]
            : profileForRoute(family)![1];
      const master = (profile as unknown as { master: { width: number } }).master.width;
      const { small, large } = widthsFor(family);

      expect({ family, smallIsMaster: small === master, largeIsMaster: large === master }).toEqual({
        family,
        smallIsMaster: false,
        largeIsMaster: false,
      });
    }
  });

  /**
   * #1373, обе фазы. Сначала зеркало обещало МЕНЬШЕ бэкенда (потолок 1600 против
   * живой производной 1920) — гейт валил каждый деплой ложной `ladder_exceeds_family`.
   * Потолок подняли до 1920 — и тем же днём бэкенд снял `content_1920` shrink-
   * коммитом `9136878`: теперь 1920 — только мастер с `no-store`, и потолок 1920
   * стал бы ложной ошибкой уже в другую сторону. Потолок обязан приезжать из
   * контракта и быть СТРОГО ниже ширины мастера.
   */
  it('travel-description-image: потолок гейта — верхняя производная articleBody, ниже ширины мастера', () => {
    const articleBody = IMAGE_STORAGE_POLICY_V1.articleBody as unknown as Profile & {
      master: { width: number };
    };
    const widest = Math.max(...articleBody.derivatives.map((item) => item.width));

    expect({
      gateCeiling: widthsFor('travel-description-image').large,
      widestDerivative: widest,
    }).toEqual({ gateCeiling: 1600, widestDerivative: 1600 });
    expect(widest).toBeLessThan(articleBody.master.width);
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
