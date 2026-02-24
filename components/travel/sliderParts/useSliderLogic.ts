import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, AppState, AccessibilityInfo } from 'react-native';
import { useSafeAreaInsetsSafe as useSafeAreaInsets } from '@/hooks/useSafeAreaInsetsSafe';
import { prefetchImage } from '@/components/ui/ImageCardMedia';
import { useResponsive } from '@/hooks/useResponsive';
import type { SliderImage } from './types';
import { clamp, clampInt, computeSliderHeight, DEFAULT_AR, MOBILE_HEIGHT_PERCENT } from './utils';

export interface UseSliderLogicOptions {
  images: SliderImage[];
  aspectRatio?: number;
  autoPlay?: boolean;
  autoPlayInterval?: number;
  preloadCount?: number;
  mobileHeightPercent?: number;
  onIndexChanged?: (index: number) => void;
  buildUri: (img: SliderImage, containerW: number, containerH: number, isFirst: boolean) => string;
}

export interface UseSliderLogicResult {
  // State
  containerW: number;
  containerH: number;
  currentIndex: number;
  reduceMotion: boolean;
  showSwipeHint: boolean;
  prefetchEnabled: boolean;

  // Refs
  indexRef: React.MutableRefObject<number>;
  containerWRef: React.MutableRefObject<number>;

  // Responsive
  isMobile: boolean;
  isTablet: boolean;
  winW: number;
  winH: number;
  insets: { left: number; right: number; top: number; bottom: number };

  // URI map
  uriMap: string[];

  // Methods
  setContainerWidth: (w: number) => void;
  setActiveIndex: (idx: number) => void;
  setActiveIndexFromOffset: (offsetX: number) => void;
  dismissSwipeHint: () => void;
  enablePrefetch: () => void;
  warmNeighbors: (idx: number) => void;

  // Navigation
  next: () => void;
  prev: () => void;
  scrollTo: (idx: number, animated?: boolean) => void;

  // Autoplay control
  pauseAutoplay: () => void;
  resumeAutoplay: () => void;
  scheduleAutoplay: () => void;
  clearAutoplay: () => void;
}

export function useSliderLogic(options: UseSliderLogicOptions): UseSliderLogicResult {
  const {
    images,
    aspectRatio = DEFAULT_AR,
    autoPlay = true,
    autoPlayInterval = 6000,
    preloadCount = 1,
    mobileHeightPercent = MOBILE_HEIGHT_PERCENT,
    onIndexChanged,
    buildUri,
  } = options;

  const insets = useSafeAreaInsets();
  const { width: winW, height: winH, isPhone, isLargePhone, isTablet: isTabletBp, isLargeTablet } = useResponsive();
  const isMobile = isPhone || isLargePhone;
  const isTablet = isTabletBp || isLargeTablet;
  const isWeb = Platform.OS === 'web';

  // State
  const [containerW, setContainerWState] = useState(winW);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [showSwipeHint, setShowSwipeHint] = useState(images.length > 1);
  const [prefetchEnabled, setPrefetchEnabled] = useState(!isWeb);

  // Refs
  const indexRef = useRef(0);
  const containerWRef = useRef(winW);
  const appState = useRef(AppState.currentState);
  const pausedByAppState = useRef(false);
  const pausedByTouch = useRef(false);
  const autoplayTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const scrollToFn = useRef<((idx: number, animated?: boolean) => void) | null>(null);

  // Check network conditions for web prefetch
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

  // First image aspect ratio
  const firstAR = (() => {
    const f = images[0];
    return f?.width && f?.height ? f.width / f.height : aspectRatio;
  })();

  // Compute height
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

  // URI map
  const uriMap = images.map((img, idx) =>
    buildUri(img, containerW, containerH, idx === 0)
  );

  // Swipe hint auto-dismiss
  useEffect(() => {
    setShowSwipeHint(images.length > 1);
  }, [images.length]);

  useEffect(() => {
    if (!showSwipeHint) return;
    const timer = setTimeout(() => setShowSwipeHint(false), 6500);
    return () => clearTimeout(timer);
  }, [showSwipeHint]);

  const dismissSwipeHint = useCallback(() => setShowSwipeHint(false), []);

  // Reduce motion detection
  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => {
      if (active) setReduceMotion(!!v);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (v) =>
      setReduceMotion(!!v)
    );
    return () => {
      // @ts-ignore
      sub?.remove?.();
      active = false;
    };
  }, []);

  // Container width setter
  const setContainerWidth = useCallback((w: number) => {
    if (Math.abs(w - containerWRef.current) > 2) {
      containerWRef.current = w;
      setContainerWState(w);
    }
  }, []);

  // Enable prefetch (for web, delayed until user interaction)
  const enablePrefetch = useCallback(() => {
    if (prefetchEnabled) return;
    if (!canPrefetchOnWeb()) return;
    setPrefetchEnabled(true);
  }, [prefetchEnabled, canPrefetchOnWeb]);

  // Warm neighbors (prefetch adjacent images)
  const warmNeighbors = useCallback(
    (idx: number) => {
      if (!prefetchEnabled && isWeb) return;
      if (!preloadCount) return;
      for (let d = -preloadCount; d <= preloadCount; d++) {
        if (d === 0) continue;
        const t = idx + d;
        if (t < 0 || t >= images.length) continue;
        const u = uriMap[t];
        if (u) {
          prefetchImage(u).catch(() => undefined);
        }
      }
    },
    [prefetchEnabled, isWeb, preloadCount, images.length, uriMap]
  );

  // Set active index
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

  // Set active index from scroll offset
  const setActiveIndexFromOffset = useCallback(
    (offsetX: number) => {
      if (!Number.isFinite(offsetX)) return;
      const idx = clampInt(offsetX / (containerW || 1), 0, Math.max(0, images.length - 1));
      if (indexRef.current !== idx) setActiveIndex(idx);
    },
    [containerW, images.length, setActiveIndex]
  );

  // Autoplay control
  const clearAutoplay = useCallback(() => {
    if (autoplayTimer.current != null) {
      clearInterval(autoplayTimer.current);
      autoplayTimer.current = null;
    }
  }, []);

  const autoplayAllowed = autoPlay && !isMobile;

  const canAutoplay = useCallback(() => {
    return (
      autoplayAllowed &&
      images.length > 1 &&
      !reduceMotion &&
      !pausedByAppState.current &&
      !pausedByTouch.current
    );
  }, [autoplayAllowed, images.length, reduceMotion]);

  // Navigation
  const next = useCallback(() => {
    dismissSwipeHint();
    if (!images.length) return;
    const target = (indexRef.current + 1) % images.length;
    scrollToFn.current?.(target);
  }, [images.length, dismissSwipeHint]);

  const prev = useCallback(() => {
    dismissSwipeHint();
    if (!images.length) return;
    const target = (indexRef.current - 1 + images.length) % Math.max(1, images.length);
    scrollToFn.current?.(target);
  }, [images.length, dismissSwipeHint]);

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

  // scrollTo - will be set by the component
  const scrollTo = useCallback(
    (idx: number, animated = !reduceMotion) => {
      const wrapped = clamp(idx, 0, images.length - 1);
      scrollToFn.current?.(wrapped, animated);
      setActiveIndex(wrapped);
    },
    [images.length, reduceMotion, setActiveIndex]
  );

  // AppState handling (for native autoplay)
  useEffect(() => {
    if (isWeb) return;
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
      // @ts-ignore
      sub?.remove?.();
    };
  }, [scheduleAutoplay, clearAutoplay, isWeb]);

  // Start autoplay on mount
  useEffect(() => {
    scheduleAutoplay();
    return clearAutoplay;
  }, [scheduleAutoplay, clearAutoplay]);

  // Initial prefetch
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
    // State
    containerW,
    containerH,
    currentIndex,
    reduceMotion,
    showSwipeHint,
    prefetchEnabled,

    // Refs
    indexRef,
    containerWRef,

    // Responsive
    isMobile,
    isTablet,
    winW,
    winH,
    insets,

    // URI map
    uriMap,

    // Methods
    setContainerWidth,
    setActiveIndex,
    setActiveIndexFromOffset,
    dismissSwipeHint,
    enablePrefetch,
    warmNeighbors,

    // Navigation
    next,
    prev,
    scrollTo,

    // Autoplay control
    pauseAutoplay,
    resumeAutoplay,
    scheduleAutoplay,
    clearAutoplay,
  };
}


