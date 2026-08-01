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

describe('#1143: размытая подложка скелета не тянет полноразмерный hero', () => {
  const preload = buildTravelHeroPreloadData(TRAVEL, DETAIL);
  const html: string = buildTravelSkeletonHtml({ heroPreload: preload, name: 'Наш Вьетнам' });

  const blurUrls = (): string[] =>
    Array.from(
      html.matchAll(/class="ssg-travel-hero-blur[^"]*"[^>]*background-image:url\(&quot;(.*?)&quot;\)/g),
    ).map((m) => m[1].replace(/&amp;/g, '&'));

  it('обе подложки (mobile + desktop) отрисованы', () => {
    expect(blurUrls()).toHaveLength(2);
  });

  // #1167: подложка больше не берёт `lqip_url` из манифеста — это был отдельный файл
  // и отдельный вариант на каждую картинку. Берётся самая дешёвая ступень лестницы
  // того же изображения, и параметры обязаны совпадать с рантаймом
  // (`IMAGE_WIDTHS.heroBackdrop` / `IMAGE_QUALITY.heroBackdrop`), иначе SSG греет один
  // файл, а гидратация просит другой — инвариант #1146.
  it('подложка берёт дешёвую ступень лестницы, а не hero-вариант', () => {
    for (const url of blurUrls()) {
      expect(url).toMatch(/[?&]w=96\b/);
      expect(url).toMatch(/[?&]q=40\b/);
      expect(url).not.toMatch(/[?&]w=(480|640|800|1280|1920|2500)\b/);
    }
    expect(blurUrls()).not.toContain(preload.mobile.href);
    expect(blurUrls()).not.toContain(preload.desktop.href);
  });

  it('подложка заливается dominant_color до прихода картинки', () => {
    expect(html).toContain('background-color:#7b7e78');
  });

  it('без манифеста подложка делит запрос с hero (старое поведение)', () => {
    const bare = buildTravelHeroPreloadData(TRAVEL, { gallery: [{ id: 100, url: GALLERY_PATH }] });
    const bareHtml: string = buildTravelSkeletonHtml({ heroPreload: bare, name: 'x' });
    // Фолбэк строит подложку через прокси малой ширины, а не полноразмерным файлом.
    const urls = Array.from(
      bareHtml.matchAll(/class="ssg-travel-hero-blur[^"]*"[^>]*background-image:url\(&quot;(.*?)&quot;\)/g),
    ).map((m) => m[1].replace(/&amp;/g, '&'));
    expect(urls).toHaveLength(2);
    for (const url of urls) expect(url).toMatch(/[?&]w=96\b/);
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

  it('без явного fit поведение не меняется (карточки списка)', () => {
    const legacy = buildResponsiveImagePropsPreferringMedia(MEDIA_ENTRY as any, GALLERY_PATH, {
      maxWidth: 640,
      widths: [160, 320, 640],
      quality: 75,
      sizes: '100vw',
    });
    expect(legacy.src).toBe(`${GALLERY_PATH}?w=640&q=75&fit=cover`);
  });
});
