import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, AppState, AccessibilityInfo } from 'react-native';
import { useSafeAreaInsetsSafe as useSafeAreaInsets } from '@/hooks/useSafeAreaInsetsSafe';
import { prefetchImage } from '@/components/ui/ImageCardMedia';
import { useResponsive } from '@/hooks/useResponsive';
import type { SliderImage } from './types';
import { clamp, clampInt, computeSliderHeight, DEFAULT_AR, MOBILE_HEIGHT_PERCENT } from './utils';

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
  const { width: winW, height: winH, isPhone, isLargePhone, isTablet: isTabletBp, isLargeTablet } = useResponsive();
  const isMobile = isPhone || isLargePhone;
  const isTablet = isTabletBp || isLargeTablet;
  const isWeb = Platform.OS === 'web';

  const [containerW, setContainerWState] = useState(winW);
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
    if (isMobile) return false;
    if (typeof navigator === 'undefined') return false;
    const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
    if (connection?.saveData) return false;
    const effectiveType = String(connection?.effectiveType || '').toLowerCase();
    if (effectiveType.includes('2g') || effectiveType === '3g') return false;
    return true;
  }, [isWeb, isMobile]);

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
    const timer = setTimeout(() => setShowSwipeHint(false), 6500);
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
        const t = idx + d;
        if (t < 0 || t >= images.length) continue;
        const u = getUri(t);
        if (u) prefetchImage(u).catch(() => undefined);
      }
    },
    [preloadCount, isWeb, prefetchEnabled, images.length, getUri]
  );

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
      const idx = clampInt(offsetX / (containerW || 1), 0, Math.max(0, images.length - 1));
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

  useEffect(() => {
    if (!images.length || (isWeb && !prefetchEnabled)) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    if (isWeb) {
      timer = setTimeout(() => warmNeighbors(0), 200);
    } else {
      warmNeighbors(0);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [images.length, warmNeighbors, isWeb, prefetchEnabled]);

  return {
    containerW,
    containerH,
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
