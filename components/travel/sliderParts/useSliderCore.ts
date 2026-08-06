import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, AppState, AccessibilityInfo, useWindowDimensions } from 'react-native';
import { useSafeAreaInsetsSafe as useSafeAreaInsets } from '@/hooks/useSafeAreaInsetsSafe';
import { prefetchImage } from '@/components/ui/ImageCardMedia';
import type { SliderImage } from './types';
import {
  clamp,
  clampInt,
  computeSliderHeight,
  DEFAULT_AR,
  getSliderViewportFlags,
  MOBILE_HEIGHT_PERCENT,
} from './utils';

/**
 * Признак того, что URL уже прошёл через прокси-сайзинг. Без ширины `buildUri*`
 * отдаёт полноразмерный оригинал — такой адрес нельзя греть префетчем (#1119).
 */
const HAS_PROXY_SIZING = /[?&]w=\d+/;

/**
 * #1293: предохранитель ожидания hero перед прогревом соседей на mobile web.
 * 2,5 с выбраны как «дольше нормальной загрузки LCP-кадра даже на медленном 4G»
 * (замер прода: hero приезжал к 2,3 с) — если картинка застряла, соседи всё
 * равно начнут греться и свайп не останется без предзагрузки.
 */
const HERO_PAINT_WAIT_MAX_MS = 2500;
const HERO_PAINT_POLL_MS = 120;

export interface UseSliderCoreOptions {
  images: SliderImage[];
  aspectRatio?: number;
  autoPlay?: boolean;
  autoPlayInterval?: number;
  preloadCount?: number;
  mobileHeightPercent?: number;
  onIndexChanged?: (index: number) => void;
  buildUri: (img: SliderImage, containerW: number, containerH: number, isFirst: boolean) => string;
  deferWebPrefetchUntilInteraction?: boolean;
  handleAppState?: boolean;
  includeUriMap?: boolean;
}

export interface UseSliderCoreResult {
  containerW: number;
  containerH: number;
  hasMeasuredWidth: boolean;
  currentIndex: number;
  reduceMotion: boolean;
  showSwipeHint: boolean;
  prefetchEnabled: boolean;
  indexRef: React.MutableRefObject<number>;
  containerWRef: React.MutableRefObject<number>;
  isMobile: boolean;
  isTablet: boolean;
  winW: number;
  winH: number;
  insets: { left: number; right: number; top: number; bottom: number };
  uriMap: string[];
  getUri: (idx: number) => string;
  setContainerWidth: (w: number) => void;
  setActiveIndex: (idx: number) => void;
  setActiveIndexFromOffset: (offsetX: number) => void;
  dismissSwipeHint: () => void;
  enablePrefetch: () => void;
  warmNeighbors: (idx: number) => void;
  next: () => void;
  prev: () => void;
  scrollTo: (idx: number, animated?: boolean) => void;
  setScrollToImpl: (fn: ((idx: number, animated?: boolean) => void) | null) => void;
  pauseAutoplay: () => void;
  resumeAutoplay: () => void;
  scheduleAutoplay: () => void;
  clearAutoplay: () => void;
}

export function useSliderCore(options: UseSliderCoreOptions): UseSliderCoreResult {
  const {
    images,
    aspectRatio = DEFAULT_AR,
    autoPlay = true,
    autoPlayInterval = 6000,
    preloadCount = 1,
    mobileHeightPercent = MOBILE_HEIGHT_PERCENT,
    onIndexChanged,
    buildUri,
    deferWebPrefetchUntilInteraction = Platform.OS === 'web',
    handleAppState = Platform.OS !== 'web',
    includeUriMap = true,
  } = options;

  const insets = useSafeAreaInsets();
  const { width: winW, height: winH } = useWindowDimensions();
  const { isMobile, isTablet } = useMemo(
    () => getSliderViewportFlags(winW),
    [winW],
  );
  const isWeb = Platform.OS === 'web';

  const [containerW, setContainerWState] = useState(winW);
  const [hasMeasuredWidth, setHasMeasuredWidth] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [showSwipeHint, setShowSwipeHint] = useState(images.length > 1);
  const [prefetchEnabled, setPrefetchEnabled] = useState(!deferWebPrefetchUntilInteraction);

  const indexRef = useRef(0);
  const containerWRef = useRef(winW);
  const appState = useRef(AppState.currentState);
  const pausedByAppState = useRef(false);
  const pausedByTouch = useRef(false);
  const autoplayTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const scrollToFn = useRef<((idx: number, animated?: boolean) => void) | null>(null);
  const uriCacheRef = useRef<Map<number, string>>(new Map());

  const canPrefetchOnWeb = useCallback(() => {
    if (!isWeb) return true;
    if (typeof navigator === 'undefined') return false;
    const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
    if (connection?.saveData) return false;
    const effectiveType = String(connection?.effectiveType || '').toLowerCase();
    if (effectiveType.includes('2g') || effectiveType === '3g') return false;
    return true;
  }, [isWeb]);

  const firstAR = useMemo(() => {
    const f = images[0];
    return f?.width && f?.height ? f.width / f.height : aspectRatio;
  }, [images, aspectRatio]);

  const computeHeight = useCallback(
    (w: number) =>
      computeSliderHeight(w, {
        imagesLength: images.length,
        isMobile,
        isTablet,
        winH,
        insetsTop: insets.top || 0,
        insetsBottom: insets.bottom || 0,
        mobileHeightPercent,
        firstAR,
      }),
    [firstAR, images.length, insets.bottom, insets.top, isMobile, isTablet, winH, mobileHeightPercent]
  );

  const containerH = computeHeight(containerW);

  useEffect(() => {
    uriCacheRef.current.clear();
  }, [images, containerW, containerH, buildUri]);

  const getUri = useCallback(
    (idx: number) => {
      const cached = uriCacheRef.current.get(idx);
      if (cached) return cached;
      const img = images[idx];
      if (!img) return '';
      const nextUri = buildUri(img, containerW, containerH, idx === 0);
      uriCacheRef.current.set(idx, nextUri);
      return nextUri;
    },
    [images, containerW, containerH, buildUri]
  );

  const uriMap = useMemo(() => (includeUriMap ? images.map((_, idx) => getUri(idx)) : []), [images, getUri, includeUriMap]);

  useEffect(() => {
    setShowSwipeHint(images.length > 1);
  }, [images.length]);

  useEffect(() => {
    if (!showSwipeHint) return;
    const timer = setTimeout(() => setShowSwipeHint(false), 1000);
    return () => clearTimeout(timer);
  }, [showSwipeHint]);

  const dismissSwipeHint = useCallback(() => setShowSwipeHint(false), []);

  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => {
      if (active) setReduceMotion(!!v);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (v) => setReduceMotion(!!v));
    return () => {
      // @ts-ignore -- AccessibilityInfo subscription type changed between RN versions, remove() may not exist
      sub?.remove?.();
      active = false;
    };
  }, []);

  // Track if we've received the first real measurement from onLayout
  const hasInitialMeasurement = useRef(false);

  // Stabilize containerW to prevent URI cache invalidation on minor width changes
  // (e.g., mobile address bar appearing/disappearing during scroll)
  // Allow first measurement unconditionally, then apply 50px threshold
  const setContainerWidth = useCallback((w: number) => {
    const prevWidth = containerWRef.current;
    containerWRef.current = w;

    // Always accept first real measurement from onLayout
    if (!hasInitialMeasurement.current) {
      hasInitialMeasurement.current = true;
      setContainerWState(w);
      setHasMeasuredWidth(true);
      return;
    }

    // After first measurement, only update React state on significant changes (>50px)
    // but keep the live ref in sync so scroll/index math always uses the actual width.
    if (Math.abs(w - prevWidth) > 50) {
      setContainerWState(w);
    }
  }, []);

  const enablePrefetch = useCallback(() => {
    if (prefetchEnabled) return;
    if (!canPrefetchOnWeb()) return;
    setPrefetchEnabled(true);
  }, [prefetchEnabled, canPrefetchOnWeb]);

  const warmNeighbors = useCallback(
    (idx: number) => {
      if (!preloadCount) return;
      if (isWeb && !prefetchEnabled) return;
      for (let d = -preloadCount; d <= preloadCount; d++) {
        if (d === 0) continue;
        // Native: FlatList и так держит смонтированными текущий ±1, и такой слайд
        // грузит свой URL сам. Префетч поверх этого не склеивается с загрузкой
        // смонтированной картинки — файл уезжает по сети дважды (видно в
        // access-логе прода). Греем только то, что ещё не смонтировано.
        if (!isWeb && Math.abs(d) < 2) continue;
        const t = idx + d;
        if (t < 0 || t >= images.length) continue;
        const u = getUri(t);
        if (!u) continue;
        // #1119: `buildUri*` отдаёт URL БЕЗ прокси-параметров, когда ширина
        // контейнера ещё не измерена (`containerWidth` = 0 на первом рендере) —
        // это полноразмерный оригинал. Смонтированный слайд такой адрес не
        // использует: он берёт кандидата из `srcSet`. А префетч использовал, и
        // сосед приезжал целиком: замер прода 2026-07-28 в чистой вкладке —
        // 305+423 КБ на `dolina-pyati-ozer`, 507+569 КБ на `rodniki-yuckovskie`.
        // Такой URL греть бессмысленно вдвойне: он и тяжёлый, и не тот, что
        // потом понадобится. Пропускаем — на следующем проходе, после измерения,
        // `getUri` вернёт уже нормальный адрес.
        if (!HAS_PROXY_SIZING.test(u)) continue;
        prefetchImage(u).catch(() => undefined);
      }
    },
    [preloadCount, isWeb, prefetchEnabled, images.length, getUri]
  );

  useEffect(() => {
    if (!images.length) return;
    if (!hasMeasuredWidth && !isWeb) return;
    warmNeighbors(indexRef.current);
  }, [hasMeasuredWidth, images.length, isWeb, warmNeighbors]);

  const setActiveIndex = useCallback(
    (idx: number) => {
      const clampedIdx = clamp(idx, 0, Math.max(0, images.length - 1));
      indexRef.current = clampedIdx;
      setCurrentIndex((prev) => (prev === clampedIdx ? prev : clampedIdx));
      onIndexChanged?.(clampedIdx);
      warmNeighbors(clampedIdx);
    },
    [images.length, onIndexChanged, warmNeighbors]
  );

  const setActiveIndexFromOffset = useCallback(
    (offsetX: number) => {
      if (!Number.isFinite(offsetX)) return;
      const liveWidth = containerWRef.current || containerW || 1;
      const idx = clampInt(offsetX / liveWidth, 0, Math.max(0, images.length - 1));
      if (indexRef.current !== idx) setActiveIndex(idx);
    },
    [containerW, images.length, setActiveIndex]
  );

  const clearAutoplay = useCallback(() => {
    if (autoplayTimer.current != null) {
      clearInterval(autoplayTimer.current);
      autoplayTimer.current = null;
    }
  }, []);

  const autoplayAllowed = autoPlay && !isMobile;

  const canAutoplay = useCallback(() => {
    return autoplayAllowed && images.length > 1 && !reduceMotion && !pausedByAppState.current && !pausedByTouch.current;
  }, [autoplayAllowed, images.length, reduceMotion]);

  const setScrollToImpl = useCallback((fn: ((idx: number, animated?: boolean) => void) | null) => {
    scrollToFn.current = fn;
  }, []);

  const scrollTo = useCallback(
    (idx: number, animated = !reduceMotion) => {
      const wrapped = clamp(idx, 0, images.length - 1);
      scrollToFn.current?.(wrapped, animated);
      setActiveIndex(wrapped);
    },
    [images.length, reduceMotion, setActiveIndex]
  );

  const next = useCallback(() => {
    dismissSwipeHint();
    if (!images.length) return;
    const target = (indexRef.current + 1) % images.length;
    scrollTo(target);
  }, [images.length, dismissSwipeHint, scrollTo]);

  const prev = useCallback(() => {
    dismissSwipeHint();
    if (!images.length) return;
    const target = (indexRef.current - 1 + images.length) % Math.max(1, images.length);
    scrollTo(target);
  }, [images.length, dismissSwipeHint, scrollTo]);

  const scheduleAutoplay = useCallback(() => {
    clearAutoplay();
    if (!canAutoplay()) return;
    autoplayTimer.current = setInterval(() => {
      next();
    }, Math.max(2500, autoPlayInterval));
  }, [autoPlayInterval, canAutoplay, clearAutoplay, next]);

  const pauseAutoplay = useCallback(() => {
    pausedByTouch.current = true;
    clearAutoplay();
  }, [clearAutoplay]);

  const resumeAutoplay = useCallback(() => {
    pausedByTouch.current = false;
    scheduleAutoplay();
  }, [scheduleAutoplay]);

  useEffect(() => {
    if (!handleAppState) return;
    const sub = AppState.addEventListener('change', (s) => {
      const wasBg = appState.current.match(/inactive|background/);
      appState.current = s;
      if (s === 'active' && wasBg) {
        pausedByAppState.current = false;
        scheduleAutoplay();
      } else if (s !== 'active') {
        pausedByAppState.current = true;
        clearAutoplay();
      }
    });
    return () => {
      // @ts-ignore -- AppState subscription type changed between RN versions, remove() may not exist
      sub?.remove?.();
    };
  }, [scheduleAutoplay, clearAutoplay, handleAppState]);

  useEffect(() => {
    scheduleAutoplay();
    return clearAutoplay;
  }, [scheduleAutoplay, clearAutoplay]);

  // On mobile web, auto-enable prefetch shortly after mount since users swipe immediately.
  // On desktop web, prefetch is deferred until first interaction (hover/keyboard).
  //
  // #1293: но НЕ раньше, чем допечатается hero. Соседи стартовали через ~200 мс
  // после монтирования и делили канал с LCP-кадром: замер прода 2026-08-06,
  // mobile 412 / 1.6 Мбит — hero `?w=720` качался 503 → 2 315 мс, а два соседних
  // слайда (64,5 + 110,4 КБ) уходили в сеть уже на 1 386 мс. Lighthouse списывал
  // на это 77 % LCP (Load Time 6 775 мс из 8 800 мс). Ждём готовности hero, но с
  // предохранителем: если картинка почему-то не догружается, свайп не должен
  // остаться без предзагруженных соседей навсегда.
  useEffect(() => {
    if (!isWeb || !isMobile || prefetchEnabled) return;
    if (typeof document === 'undefined') return;

    let timer: ReturnType<typeof setTimeout> | null = null;
    const startedAt = typeof performance !== 'undefined' ? performance.now() : 0;

    const heroPainted = () => {
      const hero = document.querySelector<HTMLImageElement>('img[data-lcp], img[data-ssg-lcp="true"]');
      // Нет hero-узла — ждать нечего (страница без hero-картинки).
      if (!hero) return true;
      return hero.complete && hero.naturalWidth > 0;
    };

    const tick = () => {
      const elapsed = (typeof performance !== 'undefined' ? performance.now() : 0) - startedAt;
      if (heroPainted() || elapsed >= HERO_PAINT_WAIT_MAX_MS) {
        if (canPrefetchOnWeb()) setPrefetchEnabled(true);
        return;
      }
      timer = setTimeout(tick, HERO_PAINT_POLL_MS);
    };

    timer = setTimeout(tick, 100);
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [isWeb, isMobile, prefetchEnabled, canPrefetchOnWeb]);

  useEffect(() => {
    if (!images.length || (isWeb && !prefetchEnabled)) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    if (isWeb) {
      timer = setTimeout(() => warmNeighbors(0), isMobile ? 100 : 200);
    } else {
      warmNeighbors(0);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [images.length, warmNeighbors, isWeb, isMobile, prefetchEnabled]);

  return {
    containerW,
    containerH,
    hasMeasuredWidth,
    currentIndex,
    reduceMotion,
    showSwipeHint,
    prefetchEnabled,
    indexRef,
    containerWRef,
    isMobile,
    isTablet,
    winW,
    winH,
    insets,
    uriMap,
    getUri,
    setContainerWidth,
    setActiveIndex,
    setActiveIndexFromOffset,
    dismissSwipeHint,
    enablePrefetch,
    warmNeighbors,
    next,
    prev,
    scrollTo,
    setScrollToImpl,
    pauseAutoplay,
    resumeAutoplay,
    scheduleAutoplay,
    clearAutoplay,
  };
}
