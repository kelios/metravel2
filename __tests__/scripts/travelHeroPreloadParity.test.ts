/**
 * #1146: preload hero и сам `<img data-lcp>` обязаны запрашивать ОДИН и тот же
 * файл. С #2766 вторая (статическая) реализация отбора варианта удалена вместе
 * с генератором тел статей: статью рендерит SSR, и preload и `<img>` строит
 * один и тот же `utils/travelMediaVariants.ts`. Здесь остаются инварианты
 * самого клиентского srcset на реальном манифесте обложки с прода:
 *  - в hero-набор не попадают варианты с другим `fit` (cover обрезает кадр,
 *    contain вписывает — браузер выбирает по DPR, и композиция фото на разных
 *    телефонах получалась разной);
 *  - вариант не шире слота: манифест обложки 1080×1080 не содержит contain-варианта
 *    уже 1280, из-за чего мобильный слот 720 схлопывался в 1280
 *    (210 858 B против 95 182 B, замер прода 2026-07-30).
 */

import { Platform } from 'react-native';

import { buildResponsiveImagePropsPreferringMedia } from '@/utils/travelMediaVariants';
import { buildVersionedImageUrl } from '@/utils/imageOptimization';
import { createSafeImageUrl } from '@/utils/travelMedia';
import { PROD_GALLERY_ITEM } from '../fixtures/prodMediaManifest';

// Hero собирается для браузера, поэтому клиентскую сторону меряем в web-режиме
// (на native srcSet не строится вовсе).
const originalOS = Platform.OS;
beforeAll(() => {
  (Platform as any).OS = 'web';
});
afterAll(() => {
  (Platform as any).OS = originalOS;
});

const GALLERY_PATH =
  'https://metravel.by/gallery/3994/conversions/HcQK2WZBkjkvHnupzbuIPA9ulGbifqOiIvgmkOlG-detail_hd.jpg';

// Реальный манифест первой картинки галереи travel #129 (прод, 2026-07-30).
const MEDIA_ENTRY = {
  id: 100,
  width: 1080,
  height: 1080,
  aspect_ratio: 1,
  dominant_color: '#7b7e78',
  blurhash: 'LSF=~=I_-o-;5^xuRPR:yGs,M{WZ',
  lqip_url: `${GALLERY_PATH}?w=32&q=35&fit=cover`,
  variants: {
    thumb_160: `${GALLERY_PATH}?w=160&q=70&fit=cover`,
    thumb_320: `${GALLERY_PATH}?w=320&q=72&fit=cover`,
    card_640: `${GALLERY_PATH}?w=640&q=75&fit=cover`,
    hero_1280: `${GALLERY_PATH}?w=1280&q=80&fit=contain`,
    hero_1920: `${GALLERY_PATH}?w=1920&q=80&fit=contain`,
    print_2500: `${GALLERY_PATH}?w=2500&q=88&fit=contain`,
    original: GALLERY_PATH,
  },
};

const DETAIL = {
  gallery: [{ id: 100, url: GALLERY_PATH }],
  media: { gallery: [MEDIA_ENTRY] },
};

// Те же значения, что просит TravelDetailsOptimizedLCPHero.
const MOBILE_OPTIONS = {
  maxWidth: 720,
  widths: [320, 480, 640, 720],
  quality: 70,
  format: 'auto' as const,
  fit: 'contain' as const,
  sizes: '100vw',
};
const DESKTOP_OPTIONS = {
  maxWidth: 1280,
  widths: [720, 960, 1280],
  quality: 80,
  format: 'auto' as const,
  fit: 'contain' as const,
  sizes: '(max-width: 1024px) 92vw, 720px',
};

// Ровно то, как TravelDetailsOptimizedLCPHero собирает базовый URL первого кадра.
const clientBaseSrc = (): string => {
  const gallery = DETAIL.gallery[0] as { id: number; url: string; updated_at?: string | null };
  return buildVersionedImageUrl(
    createSafeImageUrl(gallery.url, gallery.updated_at ?? null, gallery.id),
    gallery.updated_at ?? null,
    gallery.id,
  );
};

const fitsOf = (srcSet?: string): string[] =>
  Array.from(String(srcSet || '').matchAll(/fit=([a-z]+)/gi)).map((m) => m[1].toLowerCase());

const widthsOf = (srcSet?: string): number[] =>
  Array.from(String(srcSet || '').matchAll(/\s(\d+)w/g)).map((m) => Number(m[1]));

describe('hero srcset на legacy-манифесте вариантов', () => {
  // Клиентская сторона считается в web-режиме, который ставит beforeAll, — не на сборе describe.
  let mobile: ReturnType<typeof buildResponsiveImagePropsPreferringMedia>;
  let desktop: ReturnType<typeof buildResponsiveImagePropsPreferringMedia>;
  beforeAll(() => {
    mobile = buildResponsiveImagePropsPreferringMedia(MEDIA_ENTRY as any, clientBaseSrc(), MOBILE_OPTIONS);
    desktop = buildResponsiveImagePropsPreferringMedia(MEDIA_ENTRY as any, clientBaseSrc(), DESKTOP_OPTIONS);
  });

  it('отдаёт mobile и desktop варианты', () => {
    expect(mobile.src).toBeTruthy();
    expect(desktop.src).toBeTruthy();
  });

  it('в hero-srcset нет ни одного cover-варианта', () => {
    // Инвариант — про кадрирование, а не про наличие параметра: с #1204 адреса
    // family-роута собираются без `fit` вовсе (его ставит только legacy-роут, см.
    // `servedFromDurableFamily` в `utils/imageProxy.ts`), а вариант манифеста
    // приносит свой `fit` в самом URL. Смешать contain с cover по-прежнему нельзя.
    for (const srcSet of [mobile.srcSet, desktop.srcSet]) {
      const fits = new Set(fitsOf(srcSet));
      expect(fits.has('cover')).toBe(false);
      expect([...fits].every((fit) => fit === 'contain')).toBe(true);
    }
  });

  it('мобильный hero не тянет вариант шире слота', () => {
    // 720-слот раньше схлопывался в манифестный hero_1280 (210 858 B).
    expect(mobile.src).not.toMatch(/[?&]w=1280\b/);
    expect(Math.max(...widthsOf(mobile.srcSet))).toBeLessThanOrEqual(800);
  });
});

describe('buildResponsiveImagePropsFromMedia: фильтр по fit', () => {
  it('cover-слот по-прежнему берёт cover-варианты манифеста', () => {
    const cover = buildResponsiveImagePropsPreferringMedia(MEDIA_ENTRY as any, GALLERY_PATH, {
      maxWidth: 640,
      widths: [160, 320, 640],
      quality: 75,
      fit: 'cover',
      sizes: '100vw',
    });
    expect(cover.src).toContain('fit=cover');
    expect(new Set(fitsOf(cover.srcSet))).toEqual(new Set(['cover']));
  });

  it('без явного fit отбор варианта не меняется, и адрес остаётся на family-роуте', () => {
    const picked = buildResponsiveImagePropsPreferringMedia(MEDIA_ENTRY as any, GALLERY_PATH, {
      maxWidth: 640,
      widths: [160, 320, 640],
      quality: 75,
      sizes: '100vw',
    });
    // Отбор варианта прежний (`card_640`, `fit=cover`), и с #1204 адрес манифеста
    // больше не переписывается: family-роут отдаёт ту же производную побайтно
    // (проба прода 15.09.2026) и с #1920 кэшируется nginx.
    expect(picked.src).toBe(`${GALLERY_PATH}?w=640&q=75&fit=cover`);
  });
});

/**
 * #1203: те же инварианты на манифесте, который прод отдаёт СЕЙЧАС — с готовыми
 * `src`/`srcset*` и адресами без `q=`/`fit=`. Блок выше проверяет legacy-формат
 * `variants`, оставшийся фолбэком.
 */
describe('#1203 hero srcset на готовых источниках манифеста', () => {
  const PROD_DETAIL = {
    gallery: [{ id: PROD_GALLERY_ITEM.id, url: String(PROD_GALLERY_ITEM.variants?.original ?? '') }],
    media: { gallery: [PROD_GALLERY_ITEM] },
  };

  const clientProps = (options: typeof MOBILE_OPTIONS | typeof DESKTOP_OPTIONS) =>
    buildResponsiveImagePropsPreferringMedia(
      PROD_GALLERY_ITEM as any,
      String(PROD_DETAIL.gallery[0].url),
      options,
    );
  let mobile: ReturnType<typeof clientProps>;
  let desktop: ReturnType<typeof clientProps>;
  beforeAll(() => {
    mobile = clientProps(MOBILE_OPTIONS);
    desktop = clientProps(DESKTOP_OPTIONS);
  });

  it('мобильный hero остаётся на ступени слота, а не уезжает на contain-набор', () => {
    // `srcset_contain` этой картинки начинается с 720: если бы источником стал
    // набор одного слота, мобильный hero прыгнул бы на 960.
    expect(widthsOf(mobile.srcSet)).toEqual([320, 480, 640, 720]);
    expect(mobile.src).toMatch(/[?&]w=720\b/);
  });

  it('адреса идут w-only — ни q=, ни fit= в них не появляется', () => {
    for (const srcSet of [mobile.srcSet, desktop.srcSet]) {
      expect(srcSet).not.toMatch(/[?&]q=/);
      expect(srcSet).not.toMatch(/[?&]fit=/);
    }
  });
});
