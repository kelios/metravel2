/**
 * #1146: SSG-preload и клиентский hero обязаны запрашивать ОДИН и тот же файл.
 *
 * Две независимые реализации отбора варианта (scripts/generate-seo-pages.js и
 * utils/travelMediaVariants.ts) уже расходились: preload грел один URL, а
 * `<img data-lcp>` просил другой, и hero приезжал дважды. Тест сравнивает обе
 * стороны на реальном манифесте обложки с прода.
 *
 * Плюс два инварианта самого srcset:
 *  - в hero-набор не попадают варианты с другим `fit` (cover обрезает кадр,
 *    contain вписывает — браузер выбирает по DPR, и композиция фото на разных
 *    телефонах получалась разной);
 *  - вариант не шире слота: манифест обложки 1080×1080 не содержит contain-варианта
 *    уже 1280, из-за чего мобильный слот 720 схлопывался в 1280
 *    (210 858 B против 95 182 B, замер прода 2026-07-30).
 */

const { buildTravelHeroPreloadData } = require('@/scripts/generate-seo-pages');
const { buildTravelSkeletonHtml } = require('@/scripts/ssg-skeletons');

import { Platform } from 'react-native';

import { buildResponsiveImagePropsPreferringMedia } from '@/utils/travelMediaVariants';
import { buildVersionedImageUrl } from '@/utils/imageOptimization';
import { createSafeImageUrl } from '@/utils/travelMedia';
import { PROD_GALLERY_ITEM } from '../fixtures/prodMediaManifest';

// SSG собирает разметку для браузера, поэтому клиентскую сторону сравниваем в web-режиме
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

// Тот же ключ на transform-роуте: с #1195 обе стороны (SSG и клиент) обязаны
// адресовать conversion именно так, иначе preload греет файл, который никто не просит.
const LEGACY_GALLERY_PATH =
  'https://metravel.by/media-resize/legacy/3994/conversions/HcQK2WZBkjkvHnupzbuIPA9ulGbifqOiIvgmkOlG-detail_hd.jpg';

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

const TRAVEL = { id: 129, updated_at: null };
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

describe('hero preload: SSG и клиент сходятся на одном файле', () => {
  const preload = buildTravelHeroPreloadData(TRAVEL, DETAIL);

  it('SSG отдаёт mobile и desktop варианты', () => {
    expect(preload?.mobile?.href).toBeTruthy();
    expect(preload?.desktop?.href).toBeTruthy();
  });

  it('mobile: href и srcSet совпадают с клиентскими', () => {
    const client = buildResponsiveImagePropsPreferringMedia(
      MEDIA_ENTRY as any,
      clientBaseSrc(),
      MOBILE_OPTIONS,
    );
    expect(preload.mobile.href).toBe(client.src);
    expect(preload.mobile.srcSet).toBe(client.srcSet);
  });

  it('desktop: href и srcSet совпадают с клиентскими', () => {
    const client = buildResponsiveImagePropsPreferringMedia(
      MEDIA_ENTRY as any,
      clientBaseSrc(),
      DESKTOP_OPTIONS,
    );
    expect(preload.desktop.href).toBe(client.src);
    expect(preload.desktop.srcSet).toBe(client.srcSet);
  });

  it('в hero-srcset только fit=contain', () => {
    for (const srcSet of [preload.mobile.srcSet, preload.desktop.srcSet]) {
      const fits = new Set(fitsOf(srcSet));
      expect(fits.has('cover')).toBe(false);
      expect([...fits]).toEqual(['contain']);
    }
  });

  it('мобильный hero не тянет вариант шире слота', () => {
    // 720-слот раньше схлопывался в манифестный hero_1280 (210 858 B).
    expect(preload.mobile.href).not.toMatch(/[?&]w=1280\b/);
    expect(Math.max(...widthsOf(preload.mobile.srcSet))).toBeLessThanOrEqual(800);
  });
});

describe('#1208: у SSG-hero ровно один растр', () => {
  const preload = buildTravelHeroPreloadData(TRAVEL, DETAIL);
  const html: string = buildTravelSkeletonHtml({ heroPreload: preload, name: 'Наш Вьетнам' });

  it('в скелете нет ни одного blur-слоя и ни одного фонового изображения', () => {
    // Раньше поля letterbox заливали два `<div class="ssg-travel-hero-blur">` с
    // `background-image` — второй запрос и второй декод на самой тяжёлой странице.
    expect(html).not.toContain('ssg-travel-hero-blur');
    expect(html).not.toContain('background-image');
  });

  it('в скелете ровно одна картинка hero — сам <img>', () => {
    expect(Array.from(html.matchAll(/<img\b/g))).toHaveLength(1);
    expect(html).toContain('class="ssg-travel-hero-img"');
  });

  it('поля заливает dominant_color прямо на контейнере hero', () => {
    expect(html).toMatch(/class="ssg-travel-hero" style="background-color:#7b7e78"/);
  });

  it('без dominant_color заливка не выдумывается', () => {
    const bare = buildTravelHeroPreloadData(TRAVEL, { gallery: [{ id: 100, url: GALLERY_PATH }] });
    const bareHtml: string = buildTravelSkeletonHtml({ heroPreload: bare, name: 'x' });
    expect(bareHtml).not.toContain('ssg-travel-hero-blur');
    expect(bareHtml).not.toContain('background-color:');
    expect(Array.from(bareHtml.matchAll(/<img\b/g))).toHaveLength(1);
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

  it('без явного fit отбор варианта не меняется, но conversion уходит на legacy-роут', () => {
    const legacy = buildResponsiveImagePropsPreferringMedia(MEDIA_ENTRY as any, GALLERY_PATH, {
      maxWidth: 640,
      widths: [160, 320, 640],
      quality: 75,
      sizes: '100vw',
    });
    // Отбор варианта прежний (`card_640`, `fit=cover`) — меняется только адрес:
    // family-роут в proxy-contract v4 это `source_passthrough` и отдал бы мастер
    // с `no-store`, а `legacy_conversion` режет по лестнице и кэширует (#1195).
    expect(legacy.src).toBe(`${LEGACY_GALLERY_PATH}?w=640&q=75&fit=cover`);
  });
});

/**
 * #1203: тот же инвариант «preload == запрос `<img>`», но на манифесте, который
 * прод отдаёт СЕЙЧАС — с готовыми `src`/`srcset*` и адресами без `q=`/`fit=`.
 *
 * Блок выше проверяет legacy-формат `variants`, оставшийся фолбэком. Если бы
 * SSG и клиент разошлись именно на новом формате, hero снова качался бы дважды,
 * а старые фикстуры этого не заметили бы.
 */
describe('#1203 hero preload на готовых источниках манифеста', () => {
  const PROD_DETAIL = {
    gallery: [{ id: PROD_GALLERY_ITEM.id, url: String(PROD_GALLERY_ITEM.variants?.original ?? '') }],
    media: { gallery: [PROD_GALLERY_ITEM] },
  };

  const preload = buildTravelHeroPreloadData({ id: 544, updated_at: null }, PROD_DETAIL);

  const clientProps = (options: typeof MOBILE_OPTIONS | typeof DESKTOP_OPTIONS) =>
    buildResponsiveImagePropsPreferringMedia(
      PROD_GALLERY_ITEM as any,
      String(PROD_DETAIL.gallery[0].url),
      options,
    );

  // Манифест отдаёт относительные пути, и каждая сторона резолвит их против
  // своего origin: SSG — против API-хоста сборки, клиент — против рантайм-origin.
  // В одном окружении это один и тот же хост, а в тестовой среде — нет, поэтому
  // сравнивается адрес файла со ступенью. Именно его совпадение решает, приедет
  // hero одним запросом или двумя.
  const addressOf = (url: string | undefined): string => {
    const parsed = new URL(String(url ?? ''));
    return `${parsed.pathname}${parsed.search}`;
  };
  const addressesOf = (srcSet: string | undefined): string[] =>
    String(srcSet ?? '')
      .split(',')
      .map((candidate) => candidate.trim())
      .filter(Boolean)
      .map((candidate) => {
        const [url, descriptor] = candidate.split(/\s+/);
        return `${addressOf(url)} ${descriptor}`;
      });

  it('mobile: href и srcSet совпадают с клиентскими', () => {
    const client = clientProps(MOBILE_OPTIONS);
    expect(addressOf(preload.mobile.href)).toBe(addressOf(client.src));
    expect(addressesOf(preload.mobile.srcSet)).toEqual(addressesOf(client.srcSet));
  });

  it('desktop: href и srcSet совпадают с клиентскими', () => {
    const client = clientProps(DESKTOP_OPTIONS);
    expect(addressOf(preload.desktop.href)).toBe(addressOf(client.src));
    expect(addressesOf(preload.desktop.srcSet)).toEqual(addressesOf(client.srcSet));
  });

  it('мобильный hero остаётся на ступени слота, а не уезжает на contain-набор', () => {
    // `srcset_contain` этой картинки начинается с 720: если бы источником стал
    // набор одного слота, мобильный preload прыгнул бы на 960.
    expect(widthsOf(preload.mobile.srcSet)).toEqual([320, 480, 640, 720]);
    expect(preload.mobile.href).toMatch(/[?&]w=720\b/);
  });

  it('адреса идут w-only — ни q=, ни fit= в них не появляется', () => {
    for (const srcSet of [preload.mobile.srcSet, preload.desktop.srcSet]) {
      expect(srcSet).not.toMatch(/[?&]q=/);
      expect(srcSet).not.toMatch(/[?&]fit=/);
    }
  });
});
