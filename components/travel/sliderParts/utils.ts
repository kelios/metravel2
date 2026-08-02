import { PixelRatio, Platform } from 'react-native';
import { METRICS } from '@/constants/layout';
import { IMAGE_QUALITY } from '@/constants/imageContract';
import { buildVersionedImageUrl, optimizeImageUrl } from '@/utils/imageOptimization';
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
// Прокси квантует `q` вверх к ступени опубликованного набора
// (`20…90`, включая отдельную q85). Значение 55 всё равно превращается в 60,
// поэтому держим ступень явно. Соседей режем
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

/** Вариант из media-манифеста уже прошёл через прокси, если несёт ширину. См. #1116. */
const MANIFEST_URL_HAS_PROXY_PARAMS = /[?&]w=\d+/;

/**
 * Ступень мобильного слайда. Совпадает с верхней ступенью `IMAGE_WIDTHS.travelHeroMobile`
 * и с тем, что просит SSG-preload hero, — инвариант #1146.
 */
const WEB_SLIDE_MOBILE_WIDTH = 720;

/**
 * #1210: ширина слайда — функция БРЕЙКПОИНТА, а не измеренного контейнера.
 *
 * Раньше НЕпервые слайды считали ширину как `containerWidth × devicePixelRatio`.
 * `useSliderCore` стартует с `containerW = winW` и подменяет её измеренной шириной
 * слайда, поэтому один и тот же слот успевал попросить ДВЕ разные ступени: замер
 * прода 2026-08-02 (Pixel-эмуляция 412×823, DPR 1.75, CPU 4×, throttling) на
 * `/travels/tropa-vedm-harzer-hexenstieg-…`:
 *   412 × 1.75 = 721 → вариант манифеста `w=800`   (7741 мс)
 *   390 × 1.75 = 683 → вариант манифеста `w=720`   (7861 мс, +120 мс)
 * и так по каждому соседнему слайду. Вес лишней ступени, `content-length` с прода
 * того же дня: `gallery/544/gallery/952c9b15….JPG` w=800 — 152 640 B (нужный w=720
 * весит 126 194 B), `90d52510….JPG` w=800 — 92 757 B (w=720 — 76 100 B). То есть
 * страница тянула четверть мегабайта, которую тут же выбрасывала.
 *
 * Плотность и `format` убраны вместе с этим: обе величины делали адрес соседа
 * отличным от адреса первого слайда (`f=webp`, q80 против q70), то есть фото,
 * сменившее индекс, скачивалось заново. Теперь весь слайдер на одной ступени —
 * ровно так, как это уже сделано на native (`NATIVE_SLIDER_*_MAX_WIDTH`, где
 * активный и соседний слайды намеренно равны, чтобы свайп не перезапрашивал файл).
 *
 * Расплата за это — соседний слайд на DPR 1 просит 720 вместо 480. Ступень
 * покрывает слот 390 CSS на любом реальном телефоне (DPR ≥ 2), и это тот же файл,
 * который слайдеру уже понадобился под первый слайд, поэтому на кэш он ложится
 * бесплатно.
 */
export const buildUriWeb = (
  img: SliderImage,
  containerWidth?: number,
  _containerHeight?: number,
  fit: 'contain' | 'cover' = 'contain',
) => {
  const versionedUrl = buildVersionedImageUrl(img.url, img.updated_at, img.id);
  const fitForUrl: 'contain' | 'cover' = fit === 'cover' ? 'contain' : fit;

  if (containerWidth) {
    const isMobileWidth = containerWidth <= SLIDER_MAX_WIDTH.mobile;
    // Один слайдер — одна ступень. Значение и качество берутся от первого слайда,
    // который синхронизирован с SSG-preload hero каноническими q70/q80 (#1146):
    // любое расхождение снова превращает обложку в два файла.
    const targetWidth = isMobileWidth ? WEB_SLIDE_MOBILE_WIDTH : SLIDER_MAX_WIDTH.desktop;
    const quality = isMobileWidth ? IMAGE_QUALITY.small : IMAGE_QUALITY.large;

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
