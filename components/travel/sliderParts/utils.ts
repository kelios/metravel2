import { PixelRatio, Platform } from 'react-native';
import { METRICS } from '@/constants/layout';
import {
  buildVersionedImageUrl,
  getPreferredImageFormat,
  optimizeImageUrl,
} from '@/utils/imageOptimization';
import { buildResponsiveImagePropsFromMedia } from '@/utils/travelMediaVariants';
import type { SliderImage } from './types';

export const DEFAULT_AR = 16 / 9;
export const DOT_SIZE = 6;
export const DOT_ACTIVE_SIZE = 24;
export const NAV_BTN_OFFSET = 16;
export const MOBILE_HEIGHT_PERCENT = 0.7;

/** Max container width per breakpoint (used for maxWidth + image optimization caps) */
export const SLIDER_MAX_WIDTH = {
  mobile: 768,
  tablet: 960,
  desktop: 1280,
} as const;

export const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));

export const clampInt = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, Math.round(v)));

/**
 * Fraction of the slide width a finger drag must cover (without a flick) to
 * advance one slide. Standard carousels use ~25-33%; 30% feels natural on touch.
 */
export const SWIPE_DISTANCE_THRESHOLD_RATIO = 0.3;

/**
 * Minimum |velocity| (px/ms) that counts as a flick regardless of distance.
 * Tuned for touch: a deliberate flick easily clears this while a slow drag stays
 * below it, so a gentle hold-and-release snaps back.
 */
export const SWIPE_FLICK_VELOCITY = 0.3;

export interface ResolveSwipeTargetParams {
  currentIndex: number;
  /** Live track offset at release (negative = scrolled forward). */
  visualOffset: number;
  /** Drag velocity in px/ms (negative = moving left / towards next slide). */
  velocity: number;
  /** Measured slide width (same width snapOffsetForIndex uses). */
  width: number;
  maxIndex: number;
}

/**
 * Resolve which slide a horizontal swipe should land on.
 *
 * The target is anchored to the CURRENT index ±1 (one swipe = at most one slide)
 * instead of an absolute round across the whole track, so a swipe never snaps
 * back to the current slide unless the gesture was genuinely small.
 *
 * A swipe advances when EITHER the drag covered more than
 * `SWIPE_DISTANCE_THRESHOLD_RATIO` of a slide OR the release velocity is a flick
 * (`|velocity| >= SWIPE_FLICK_VELOCITY`) in the matching direction.
 */
export const resolveSwipeTargetIndex = ({
  currentIndex,
  visualOffset,
  velocity,
  width,
  maxIndex,
}: ResolveSwipeTargetParams): number => {
  const safeWidth = width > 0 ? width : 1;
  // Offset of the current slide's resting position (negative).
  const currentOffset = -clamp(currentIndex, 0, maxIndex) * safeWidth;
  // How far we dragged from the current slide. Positive = towards previous
  // (finger moved right), negative = towards next (finger moved left).
  const dragDelta = visualOffset - currentOffset;
  const distanceRatio = Math.abs(dragDelta) / safeWidth;

  const isFlick = Math.abs(velocity) >= SWIPE_FLICK_VELOCITY;
  const passedDistance = distanceRatio >= SWIPE_DISTANCE_THRESHOLD_RATIO;

  if (!isFlick && !passedDistance) {
    return clampInt(currentIndex, 0, maxIndex);
  }

  // Determine direction. A flick wins on its own sign; otherwise the drag sign.
  const direction = isFlick
    ? velocity < 0
      ? 1
      : -1
    : dragDelta < 0
      ? 1
      : -1;

  return clampInt(currentIndex + direction, 0, maxIndex);
};

export interface SliderViewportFlags {
  isMobile: boolean;
  isTablet: boolean;
}

export const getSliderViewportFlags = (width: number): SliderViewportFlags => {
  const safeWidth = Number.isFinite(width) && width > 0 ? width : 0;
  const { tablet, largeTablet } = METRICS.breakpoints;

  return {
    isMobile: safeWidth >= 0 && safeWidth < tablet,
    isTablet: safeWidth >= tablet && safeWidth < largeTablet,
  };
};

/* ---- Native buildUri (used by Slider.tsx) ---- */

// Ступени ширины для нативного hero.
//
// #1113: раньше активный слайд капился на 1024 в расчёте «дешевле, чем 1280».
// По факту 1024 вообще НЕ входит в whitelist прокси — на такой запрос сервер
// молча отдаёт оригинал, то есть главное фото статьи на Android всегда
// приходило несжатым. Замер прода 2026-07-28 (исходник 1024×576, 132 344 B):
//   w=1024 → 132 344 B (оригинал)   w=1280 → 118 046 B   w=800 → 53 104 B
//
// Активный слайд переведён на ту же ступень 800, что и соседи: это гарантированно
// ≤ оригинала (в отличие от 1280, который на квадратных 1080×1080 оригиналах
// галереи означал бы апскейл), и вдобавок соседний слайд после свайпа становится
// активным БЕЗ перезапроса URL — один вариант вместо двух.
export const NATIVE_SLIDER_ACTIVE_MAX_WIDTH = 800;
export const NATIVE_SLIDER_NEIGHBOUR_MAX_WIDTH = 800;
// Оригиналы галереи хранятся почти без сжатия (1080×1080 ≈ 325 КБ). q75 на прокси
// экономит меньше 20%, поэтому качество опущено до уровня, который заметно легче,
// но всё ещё выше того, что уже отдаётся mobile web (там q45/q35).
// Прокси квантует `q` шагом 10 (`snapQuality`), поэтому промежуточные значения
// вроде 55 всё равно превращаются в 60 — держим ступень явно. Соседей режем
// шириной, а не качеством: после свайпа сосед становится активным без
// перезапроса URL (800@q60 ≈ 111 КБ против 325 КБ у оригинала).
const NATIVE_SLIDER_ACTIVE_QUALITY = 60;
const NATIVE_SLIDER_NEIGHBOUR_QUALITY = 60;

export const buildUriNative = (
  img: SliderImage,
  containerWidth?: number,
  _containerHeight?: number,
  isFirst: boolean = false,
) => {
  const versionedUrl = buildVersionedImageUrl(img.url, img.updated_at, img.id);
  const isWeb = Platform.OS === 'web';

  if (isWeb) {
    if (containerWidth && img.width && img.height) {
      const cappedWidth = Math.min(containerWidth, SLIDER_MAX_WIDTH.tablet);
      const quality = isFirst ? 45 : 35;
      return (
        optimizeImageUrl(versionedUrl, {
          width: cappedWidth,
          quality,
          fit: 'contain',
        }) || versionedUrl
      );
    }
    return versionedUrl;
  }

  if (!containerWidth) return versionedUrl;

  // Размер запрашиваем от реального DPR устройства (`PixelRatio`), а не от
  // `window.devicePixelRatio`: в RN его нет, и `getOptimalImageSize` на девайсе
  // молча считает DPR = 1. Раньше ветка вообще требовала `img.width/height`, но
  // gallery-пейлоад их не отдаёт — и слайдер тянул НЕсжатый оригинал (325 КБ
  // против 111 КБ у w=800). На статье с 64 фото тела это съедало канал первым.
  const dpr = Math.min(PixelRatio.get() || 1, 3);
  const width = Math.min(
    Math.round(containerWidth * dpr),
    isFirst ? NATIVE_SLIDER_ACTIVE_MAX_WIDTH : NATIVE_SLIDER_NEIGHBOUR_MAX_WIDTH,
  );

  return (
    optimizeImageUrl(versionedUrl, {
      width,
      quality: isFirst ? NATIVE_SLIDER_ACTIVE_QUALITY : NATIVE_SLIDER_NEIGHBOUR_QUALITY,
      fit: 'contain',
    }) || versionedUrl
  );
};

/* ---- Web buildUri (used by Slider.web.tsx) ---- */

// Compute preferred format once at module level (never changes at runtime)
const PREFERRED_FORMAT =
  Platform.OS === 'web' ? getPreferredImageFormat() : undefined;

export const buildUriWeb = (
  img: SliderImage,
  containerWidth?: number,
  _containerHeight?: number,
  fit: 'contain' | 'cover' = 'contain',
  isFirst: boolean = false,
) => {
  const versionedUrl = buildVersionedImageUrl(img.url, img.updated_at, img.id);
  const fitForUrl: 'contain' | 'cover' = fit === 'cover' ? 'contain' : fit;

  if (containerWidth) {
    const isMobileWidth = containerWidth <= SLIDER_MAX_WIDTH.mobile;
    const maxWidth = isFirst
      ? isMobileWidth
        ? 720
        : SLIDER_MAX_WIDTH.desktop
      : isMobileWidth
        ? SLIDER_MAX_WIDTH.mobile
        : SLIDER_MAX_WIDTH.desktop;
    const targetWidth = isFirst ? maxWidth : Math.min(containerWidth, maxWidth);
    const quality = isFirst
      ? isMobileWidth
        ? 72
        : 82
      : isMobileWidth
        ? 78
        : 78;
    const fromMedia = buildResponsiveImagePropsFromMedia(img.media, {
      maxWidth: targetWidth,
      widths: [320, 640, 720, 960, 1280],
      sizes: isMobileWidth ? '100vw' : '(max-width: 1280px) 100vw, 1280px',
    });
    if (fromMedia?.src) return fromMedia.src;

    const format = isFirst ? undefined : PREFERRED_FORMAT;
    // #1113: здесь считался `dpr` для соседних слайдов («кап до dpr 2, чтобы свайп
    // 1→2 не стопорился о декод»). Прокси параметр игнорирует — замер прода
    // 2026-07-28 даёт байт-в-байт одинаковый ответ для dpr отсутствующего / 2 / 3, —
    // так что кап никогда не действовал, а значение лишь плодило варианты URL.
    // Ширина слайдов уже задана `targetWidth`; если понадобится retina-вариант,
    // умножать нужно её, а не полагаться на серверный `dpr`.
    return (
      optimizeImageUrl(versionedUrl, {
        width: targetWidth,
        format,
        quality,
        fit: fitForUrl,
      }) || versionedUrl
    );
  }

  return versionedUrl;
};

/* ---- Shared computeHeight ---- */

export const computeSliderHeight = (
  w: number,
  opts: {
    imagesLength: number;
    isMobile: boolean;
    isTablet?: boolean;
    winH: number;
    insetsTop: number;
    insetsBottom: number;
    mobileHeightPercent: number;
    firstAR: number;
  },
) => {
  if (!opts.imagesLength) return 0;

  const ar = opts.firstAR || DEFAULT_AR;
  const arDriven = w / ar;

  if (opts.isMobile) {
    const viewportH = Math.max(0, opts.winH);
    const mobileH = viewportH * opts.mobileHeightPercent;
    return clamp(mobileH, 200, viewportH);
  }

  if (opts.isTablet) {
    const maxH = opts.winH * 0.7;
    return clamp(arDriven, 350, maxH);
  }

  // Desktop
  const maxH = opts.winH * 0.7;
  return clamp(arDriven, 400, maxH);
};
