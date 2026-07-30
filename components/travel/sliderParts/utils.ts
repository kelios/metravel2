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

/** Вариант из media-манифеста уже прошёл через прокси, если несёт ширину. См. #1116. */
const MANIFEST_URL_HAS_PROXY_PARAMS = /[?&]w=\d+/;

/**
 * Плотность, на которую умножается ширина слота НЕпервых слайдов. Кап 2: на 2×
 * апскейла уже не видно, а 3× стоило бы ещё +60% байт при том же результате.
 */
const WEB_SLIDE_MAX_DENSITY = 2;

/**
 * #1113 убрал из URL параметр `dpr` — прокси его игнорирует, — но саму ширину
 * умножать на плотность не стал, хотя там же и указано, что retina-вариант
 * получается умножением ширины. В итоге слот считался в CSS-пикселях: слайд 390
 * CSS на iPhone (DPR 3) — это 1170 физических точек, а файл приезжал на 390–480,
 * то есть апскейл ×2.4–3. Выглядит это ровно как «размытая картинка», причём
 * только со второго слайда: у первого ширина фиксирована hero-контрактом
 * (`maxWidth`) и от измерения контейнера не зависит. Замер прода 2026-07-30,
 * `/travels/ourvietnam`, viewport 390: слайд 0 — `w=1280`, `naturalWidth` 1080;
 * слайды 1–2 — `w=640&q=75&fit=cover`, `naturalWidth` 640 на слот 368 CSS.
 *
 * На native та же проблема уже решена (см. `NATIVE_SLIDER_*_MAX_WIDTH`): ширина
 * там считается как `containerWidth * PixelRatio.get()` со ступенью 800 для всех
 * слайдов, поэтому свайп не меняет вариант. Web приводим к тому же принципу.
 *
 * Читаем `window.devicePixelRatio` (как `getOptimalImageSize` в `utils/imageProxy`),
 * а не `PixelRatio`: на web это одно и то же значение, зато при SSG/SSR (нет
 * `window`) плотность честно равна 1 и разметка не расходится с гидрацией.
 */
const getWebSlideDensity = (): number => {
  const raw = typeof window !== 'undefined' ? Number(window.devicePixelRatio) : 1;
  if (!Number.isFinite(raw) || raw <= 1) return 1;
  return Math.min(raw, WEB_SLIDE_MAX_DENSITY);
};

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
    // Первый слайд не трогаем: его ширина/качество завязаны на SSG-preload hero
    // (#1146), и любое расхождение снова превращает обложку в два файла.
    const density = isFirst ? 1 : getWebSlideDensity();
    const targetWidth = isFirst
      ? maxWidth
      : Math.min(Math.round(containerWidth * density), maxWidth);
    // На retina плотность уже даёт вдвое больше точек, поэтому качество можно
    // опустить: q65 снапится к 70 — той же ступени, на которой стоит мобильный
    // hero, так что все слайды мобильной галереи просят один профиль варианта.
    const quality = isFirst
      ? isMobileWidth
        ? 72
        : 82
      : density > 1
        ? 65
        : 78;
    const format = isFirst ? undefined : PREFERRED_FORMAT;

    const fromMedia = buildResponsiveImagePropsFromMedia(img.media, {
      maxWidth: targetWidth,
      widths: [320, 640, 720, 960, 1280],
      sizes: isMobileWidth ? '100vw' : '(max-width: 1280px) 100vw, 1280px',
      // #1146: без `fit` отбор из манифеста игнорировал режим кадрирования и брал
      // `hero_1280` даже под мобильный слот 720. После того как hero (SSG-preload +
      // TravelDetailsOptimizedLCPHero) перешёл на `w=800&q=70&fit=contain`, первый
      // слайд остался на `w=1280&q=78&fit=contain` — и одна и та же обложка приезжала
      // ДВУМЯ файлами: замер прода 2026-07-30 после деплоя, 95 482 B + 211 158 B,
      // суммарные байты галереи выросли 353 622 → 449 758. Передаём тот же `fit`,
      // что и hero: отбор идёт по одному правилу, адрес совпадает, файл один.
      fit: fitForUrl,
    });
    // #1119: `fromMedia.src` — это готовый ФАЙЛ-вариант из media-манифеста
    // (например `-detail_hd.jpg`), без параметров прокси. Возвращать его как есть
    // нельзя: этот URL уходит в префетч соседних слайдов
    // (`useSliderCore.warmNeighbors` → `prefetchImage`), и сосед приезжает
    // полноразмерным. Замер прода 2026-07-28 в чистой вкладке: две загрузки на
    // статью — 507+569 КБ на `rodniki-yuckovskie`, 444+451 КБ на `lysaya-gora-342m`,
    // при том что смонтированный слайд отдельно берёт вариант из `srcSet`.
    // Прогоняем вариант манифеста через прокси-параметры той же ширины, что и
    // остальные слайды: префетч и выбор браузера сходятся на одном адресе.
    if (fromMedia?.src) {
      // #1116: но если вариант УЖЕ несёт параметры прокси (`…?w=1280&q=78&fit=contain` —
      // так выглядят `card_640`/`hero_1280` в манифесте), пересобирать его нельзя.
      // `snapQuality` округляет 78 → 80, получается второй адрес того же файла: лишняя
      // конверсия на сервере и расхождение с SSG hero preload, который берёт
      // канонический manifest-URL. Прогоняем через прокси только «голые» файловые
      // варианты вроде `-detail_hd.jpg`, ради которых ветка и добавлялась.
      if (MANIFEST_URL_HAS_PROXY_PARAMS.test(fromMedia.src)) return fromMedia.src;
      return (
        optimizeImageUrl(fromMedia.src, {
          width: targetWidth,
          format,
          quality,
          fit: fitForUrl,
        }) || fromMedia.src
      );
    }
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
