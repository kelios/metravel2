/**
 * Slider.web.tsx - Web-only slider component
 * This version does NOT use react-native-reanimated to avoid Worklets errors on web.
 * Uses CSS scroll-snap and standard React APIs instead.
 *
 * Performance optimizations:
 * - Slide virtualization: only current ±1 slides are fully rendered
 * - Cached DOM node refs: no querySelector on every interaction
 * - Lazy URI computation: URIs built only for visible slides
 * - Memoized sub-components: arrows, counter, dots don't re-render on slide change
 * - Consolidated event listeners: single effect for mouse/keyboard/scrollend
 */

import React, {
  memo,
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  forwardRef,
} from 'react';
import {
  Platform,
  View,
  ScrollView,
  LayoutChangeEvent,
  Text,
  TouchableOpacity,
} from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemedColors } from '@/hooks/useTheme';
import { useResponsive } from '@/hooks/useResponsive';
import type { SliderProps, SliderRef } from './sliderParts/types';
import { buildUriWeb, clamp, SLIDER_MAX_WIDTH, computeSliderHeight, DEFAULT_AR, MOBILE_HEIGHT_PERCENT } from './sliderParts/utils';
import { createSliderStyles } from './sliderParts/styles';
import Slide from './sliderParts/Slide';
import ImageCardMedia from '@/components/ui/ImageCardMedia';

// Re-export types for consumers that import from '@/components/travel/Slider.web'
export type { SliderImage, SliderProps, SliderRef } from './sliderParts/types';

// Inject CSS classes for slider functionality and hover effects
if (typeof document !== 'undefined') {
  const STYLE_ID = 'slider-snap-override';
  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .slider-snap-disabled { scroll-snap-type: none !important; }
      [data-testid="slider-wrapper"]:hover [aria-label="Previous slide"],
      [data-testid="slider-wrapper"]:hover [aria-label="Next slide"] {
        opacity: 1 !important;
      }
      [aria-label="Previous slide"]:hover,
      [aria-label="Next slide"]:hover { 
        background-color: rgba(0,0,0,0.5) !important; 
        border-color: rgba(255,255,255,0.3) !important;
        transform: scale(1.08) !important;
      }
      [aria-label="Previous slide"]:active,
      [aria-label="Next slide"]:active { transform: scale(0.95) !important; }
    `;
    document.head.appendChild(style);
  }
}

/* ---------- Virtualization window size (current ± WINDOW) ---------- */
const VIRTUAL_WINDOW = 2;

/* ---------- Memoized sub-components ---------- */

interface NavArrowsProps {
  imagesLen: number;
  isMobile: boolean;
  isTablet: boolean;
  hideArrowsOnMobile?: boolean;
  navOffset: number;
  styles: Record<string, any>;
  onPrev: () => void;
  onNext: () => void;
}

const NavArrows = memo(function NavArrows({
  imagesLen,
  isMobile,
  isTablet,
  hideArrowsOnMobile,
  navOffset,
  styles,
  onPrev,
  onNext,
}: NavArrowsProps) {
  if (imagesLen < 2 || (isMobile && hideArrowsOnMobile)) return null;
  const iconSize = isMobile ? 16 : isTablet ? 18 : 20;
  return (
    <>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Previous slide"
        onPress={onPrev}
        activeOpacity={0.9}
        style={[styles.navBtn, { left: navOffset }]}
        {...({ className: 'slider-nav-btn' } as any)}
      >
        <View style={styles.arrowIconContainer}>
          <Feather name="chevron-left" size={iconSize} color="rgba(255,255,255,0.95)" style={styles.arrowIcon} />
        </View>
      </TouchableOpacity>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Next slide"
        onPress={onNext}
        activeOpacity={0.9}
        style={[styles.navBtn, { right: navOffset }]}
        {...({ className: 'slider-nav-btn' } as any)}
      >
        <View style={styles.arrowIconContainer}>
          <Feather name="chevron-right" size={iconSize} color="rgba(255,255,255,0.95)" style={styles.arrowIcon} />
        </View>
      </TouchableOpacity>
    </>
  );
});

interface CounterProps {
  currentIndex: number;
  total: number;
  isMobile: boolean;
  styles: Record<string, any>;
}

const Counter = memo(function Counter({ currentIndex, total, isMobile, styles }: CounterProps) {
  if (total < 2) return null;
  return (
    <View style={[styles.counter, isMobile && styles.counterMobile, { pointerEvents: 'none' }]}>
      <View style={styles.counterContainer}>
        <Text style={styles.counterText}>
          {currentIndex + 1}/{total}
        </Text>
      </View>
    </View>
  );
});

interface PaginationDotsProps {
  total: number;
  currentIndex: number;
  isMobile: boolean;
  styles: Record<string, any>;
}

const PaginationDots = memo(function PaginationDots({ total, currentIndex, isMobile, styles }: PaginationDotsProps) {
  const dots = useMemo(() => {
    const arr = [];
    for (let i = 0; i < total; i++) {
      arr.push(
        <View key={i} style={[styles.dot, i === currentIndex && styles.dotActive]} />,
      );
    }
    return arr;
  }, [total, currentIndex, styles.dot, styles.dotActive]);

  if (total < 2) return null;

  return (
    <View style={[styles.dots, isMobile && styles.dotsMobile, { pointerEvents: 'none' }]}>
      <View style={styles.dotsContainer}>{dots}</View>
    </View>
  );
});

/* --------------------------------- Slider ---------------------------------- */

const SliderWebComponent = (props: SliderProps, ref: React.Ref<SliderRef>) => {
  const colors = useThemedColors();
  const styles = useMemo(() => createSliderStyles(colors), [colors]);

  const {
    images,
    showArrows = true,
    showDots = true,
    hideArrowsOnMobile,
    aspectRatio = DEFAULT_AR,
    fit = 'contain',
    fullBleed = false,
    autoPlay = true,
    autoPlayInterval = 6000,
    onIndexChanged,
    imageProps,
    preloadCount: _preloadCount = 1,
    blurBackground = true,
    onFirstImageLoad,
    mobileHeightPercent = MOBILE_HEIGHT_PERCENT,
    onImagePress,
    firstImagePreloaded,
    fillContainer = false,
  } = props;

  const sliderInstanceId = useId();
  const insets = useSafeAreaInsets();
  const { width: winW, height: winH, isPhone, isLargePhone, isTablet: isTabletBp, isLargeTablet } = useResponsive();
  const isMobile = isPhone || isLargePhone;
  const isTablet = isTabletBp || isLargeTablet;

  // State
  const [containerW, setContainerWState] = useState(winW);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [, setLoadedIndexes] = useState<Record<number, true>>(
    firstImagePreloaded ? { 0: true } : {},
  );
  const [transitionOverlayFrom, setTransitionOverlayFrom] = useState<number | null>(null);
  const [transitionOverlayVisible, setTransitionOverlayVisible] = useState(false);
  const [transitionOverlayFading, setTransitionOverlayFading] = useState(false);

  // Refs
  const indexRef = useRef(0);
  const containerWRef = useRef(winW);
  const scrollRef = useRef<any>(null);
  const wrapperRef = useRef<any>(null);
  const scrollIdleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDraggingRef = useRef(false);
  const dragStartXRef = useRef(0);
  const dragScrollLeftRef = useRef(0);
  const autoplayTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const pausedByTouch = useRef(false);
  // Cached DOM node refs — set once, avoid querySelector on every interaction
  const scrollNodeRef = useRef<HTMLElement | null>(null);
  const wrapperNodeRef = useRef<HTMLElement | null>(null);
  const loadedIndexesRef = useRef<Record<number, true>>(firstImagePreloaded ? { 0: true } : {});
  const overlayToRef = useRef<number | null>(null);
  const overlayHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearOverlayHideTimer = useCallback(() => {
    if (overlayHideTimerRef.current) {
      clearTimeout(overlayHideTimerRef.current);
      overlayHideTimerRef.current = null;
    }
  }, []);

  const hideTransitionOverlay = useCallback(() => {
    clearOverlayHideTimer();
    setTransitionOverlayVisible(false);
    setTransitionOverlayFading(false);
    setTransitionOverlayFrom(null);
    overlayToRef.current = null;
  }, [clearOverlayHideTimer]);

  const startTransitionOverlay = useCallback((fromIndex: number, toIndex: number) => {
    clearOverlayHideTimer();
    setTransitionOverlayFrom(fromIndex);
    setTransitionOverlayVisible(true);
    setTransitionOverlayFading(false);
    overlayToRef.current = toIndex;
  }, [clearOverlayHideTimer]);

  // First image aspect ratio
  const firstAR = useMemo(() => {
    const f = images[0];
    return f?.width && f?.height ? f.width / f.height : aspectRatio;
  }, [images, aspectRatio]);

  // Compute height (ignored when fillContainer is true)
  const computedH = useMemo(() => computeSliderHeight(containerW, {
    imagesLength: images.length,
    isMobile,
    isTablet,
    winH,
    insetsTop: insets.top || 0,
    insetsBottom: insets.bottom || 0,
    mobileHeightPercent,
    firstAR,
  }), [containerW, images.length, isMobile, isTablet, winH, insets.top, insets.bottom, mobileHeightPercent, firstAR]);
  
  // When fillContainer, use '100%' for height
  const containerH = fillContainer ? '100%' : computedH;

  // Lazy URI builder — compute URI on demand instead of for all images upfront
  const getUri = useCallback(
    (index: number): string => {
      const img = images[index];
      if (!img) return '';
      return buildUriWeb(img, containerW, computedH, fit, index === 0);
    },
    [images, containerW, computedH, fit],
  );

  // Container width setter
  const setContainerWidth = useCallback((w: number) => {
    if (Math.abs(w - containerWRef.current) > 2) {
      containerWRef.current = w;
      setContainerWState(w);
    }
  }, []);

  // Set active index
  const setActiveIndex = useCallback(
    (idx: number) => {
      const clampedIdx = clamp(idx, 0, Math.max(0, images.length - 1));
      const prevIdx = indexRef.current;
      const prevLoaded = !!loadedIndexesRef.current[prevIdx];
      const nextLoaded = !!loadedIndexesRef.current[clampedIdx];

      if (clampedIdx !== prevIdx) {
        if (prevLoaded && !nextLoaded) {
          startTransitionOverlay(prevIdx, clampedIdx);
        } else {
          hideTransitionOverlay();
        }
      }

      indexRef.current = clampedIdx;
      setCurrentIndex((prev) => (prev === clampedIdx ? prev : clampedIdx));
      onIndexChanged?.(clampedIdx);
    },
    [hideTransitionOverlay, images.length, onIndexChanged, startTransitionOverlay]
  );

  const handleSlideLoad = useCallback((index: number) => {
    setLoadedIndexes((prev) => {
      if (prev[index]) return prev;
      const next = { ...prev, [index]: true as const };
      loadedIndexesRef.current = next;
      return next;
    });

    if (overlayToRef.current === index && transitionOverlayVisible) {
      clearOverlayHideTimer();
      setTransitionOverlayFading(true);
      overlayHideTimerRef.current = setTimeout(() => {
        hideTransitionOverlay();
      }, 180);
    }
  }, [clearOverlayHideTimer, hideTransitionOverlay, transitionOverlayVisible]);

  useEffect(() => {
    const initialLoaded = firstImagePreloaded ? ({ 0: true } as Record<number, true>) : {};
    loadedIndexesRef.current = initialLoaded;
    setLoadedIndexes(initialLoaded);
    hideTransitionOverlay();
  }, [firstImagePreloaded, images, hideTransitionOverlay]);

  // Resolve cached DOM nodes — try ref-captured nodes first, fall back to querySelector with escaped ID
  const resolveNodes = useCallback(() => {
    if (typeof document === 'undefined') return;
    if (!scrollNodeRef.current) {
      // Try querySelector with CSS.escape to handle special chars in useId() output
      try {
        const escaped = typeof CSS !== 'undefined' && CSS.escape
          ? CSS.escape(sliderInstanceId)
          : sliderInstanceId.replace(/[^a-zA-Z0-9_-]/g, (c) => `\\${c}`);
        scrollNodeRef.current = document.querySelector(
          `[data-testid="slider-scroll"][data-slider-instance="${escaped}"]`,
        ) as HTMLElement | null;
      } catch {
        scrollNodeRef.current = null;
      }
      // Final fallback: first slider-scroll on the page
      if (!scrollNodeRef.current) {
        scrollNodeRef.current = document.querySelector('[data-testid="slider-scroll"]') as HTMLElement | null;
      }
    }
    if (!wrapperNodeRef.current) {
      try {
        const escaped = typeof CSS !== 'undefined' && CSS.escape
          ? CSS.escape(sliderInstanceId)
          : sliderInstanceId.replace(/[^a-zA-Z0-9_-]/g, (c) => `\\${c}`);
        wrapperNodeRef.current = document.querySelector(
          `[data-testid="slider-wrapper"][data-slider-instance="${escaped}"]`,
        ) as HTMLElement | null;
      } catch {
        wrapperNodeRef.current = null;
      }
      if (!wrapperNodeRef.current) {
        wrapperNodeRef.current = document.querySelector('[data-testid="slider-wrapper"]') as HTMLElement | null;
      }
    }
  }, [sliderInstanceId]);

  // Sync container width from DOM
  const syncContainerWidthFromDom = useCallback(() => {
    resolveNodes();
    const node = wrapperNodeRef.current;
    const w = node?.getBoundingClientRect?.()?.width ?? 0;
    if (!Number.isFinite(w) || w <= 0) return;
    if (Math.abs(containerWRef.current - w) > 4) {
      setContainerWidth(w);
    }
  }, [resolveNodes, setContainerWidth]);

  // ResizeObserver
  useEffect(() => {
    syncContainerWidthFromDom();

    const node = wrapperNodeRef.current;
    if (!node) return;

    const canUseResizeObserver =
      typeof (globalThis as any).ResizeObserver !== 'undefined' &&
      typeof node === 'object' &&
      node?.nodeType === 1;

    let ro: ResizeObserver | null = null;
    if (canUseResizeObserver) {
      ro = new ResizeObserver(() => syncContainerWidthFromDom());
      ro.observe(node as Element);
    } else if (typeof window !== 'undefined') {
      window.addEventListener('resize', syncContainerWidthFromDom);
    }

    return () => {
      ro?.disconnect();
      if (typeof window !== 'undefined') {
        window.removeEventListener('resize', syncContainerWidthFromDom);
      }
    };
  }, [syncContainerWidthFromDom]);

  // ScrollTo implementation
  const scrollTo = useCallback(
    (i: number, _animated = true) => {
      const wrapped = clamp(i, 0, images.length - 1);
      resolveNodes();
      const node = scrollNodeRef.current;
      if (node) {
        const currentIdx = indexRef.current;
        const isWrapJump =
          images.length > 1 &&
          ((currentIdx === 0 && wrapped === images.length - 1) ||
            (currentIdx === images.length - 1 && wrapped === 0));
        const prevScrollBehavior = node.style.scrollBehavior;
        if (isWrapJump) {
          node.style.scrollBehavior = 'auto';
        }
        const liveW = containerWRef.current || containerW;
        const left = wrapped * liveW;
        // Disable scroll-snap temporarily
        node.classList.add('slider-snap-disabled');
        void node.offsetHeight;
        node.scrollLeft = left;
        setActiveIndex(wrapped);
        // Triple rAF to ensure browser has painted
        requestAnimationFrame(() => {
          node.scrollLeft = left;
          requestAnimationFrame(() => {
            node.scrollLeft = left;
            requestAnimationFrame(() => {
              node.classList.remove('slider-snap-disabled');
              if (isWrapJump) {
                node.style.scrollBehavior = prevScrollBehavior;
              }
            });
          });
        });
      }
    },
    [containerW, resolveNodes, images.length, setActiveIndex]
  );

  // Expose methods via ref
  useImperativeHandle(
    ref,
    (): SliderRef => ({
      scrollTo,
      next: () => {
        const target = (indexRef.current + 1) % images.length;
        scrollTo(target);
      },
      prev: () => {
        const target = (indexRef.current - 1 + images.length) % Math.max(1, images.length);
        scrollTo(target);
      },
    }),
    [scrollTo, images.length]
  );

  // Layout handler
  const onLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const w = e.nativeEvent.layout.width;
      setContainerWidth(w);
    },
    [setContainerWidth]
  );

  // Web scroll handler
  const handleScroll = useCallback(
    (_e: any) => {
      if (scrollIdleTimerRef.current) clearTimeout(scrollIdleTimerRef.current);
      scrollIdleTimerRef.current = setTimeout(() => {
        const node = scrollNodeRef.current;
        const xIdle = node?.scrollLeft ?? 0;
        const cwIdle = containerWRef.current || 1;
        const idx = Math.round(xIdle / cwIdle);
        setActiveIndex(idx);
      }, 80);
    },
    [setActiveIndex]
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
    return autoplayAllowed && images.length > 1 && !pausedByTouch.current;
  }, [autoplayAllowed, images.length]);

  const scheduleAutoplay = useCallback(() => {
    clearAutoplay();
    if (!canAutoplay()) return;
    autoplayTimer.current = setInterval(() => {
      const target = (indexRef.current + 1) % images.length;
      scrollTo(target);
    }, Math.max(2500, autoPlayInterval));
  }, [autoPlayInterval, canAutoplay, clearAutoplay, images.length, scrollTo]);

  const pauseAutoplay = useCallback(() => {
    pausedByTouch.current = true;
    clearAutoplay();
  }, [clearAutoplay]);

  const resumeAutoplay = useCallback(() => {
    pausedByTouch.current = false;
    scheduleAutoplay();
  }, [scheduleAutoplay]);

  // Start autoplay on mount
  useEffect(() => {
    scheduleAutoplay();
    return clearAutoplay;
  }, [scheduleAutoplay, clearAutoplay]);

  // Consolidated effect: keyboard navigation + mouse drag + scrollend + idle timer cleanup
  useEffect(() => {
    if (typeof window === 'undefined') return;
    resolveNodes();
    const node = scrollNodeRef.current;
    if (!node) return;

    // Keyboard navigation
    const parent = (node.closest?.('[data-testid="slider-wrapper"]') || node.parentElement?.parentElement) as HTMLElement | null;
    if (parent) parent.setAttribute('tabindex', '0');

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        const target = (indexRef.current - 1 + images.length) % Math.max(1, images.length);
        scrollTo(target);
      } else if (e.key === 'ArrowRight') {
        const target = (indexRef.current + 1) % images.length;
        scrollTo(target);
      }
    };

    // Mouse drag
    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      isDraggingRef.current = true;
      dragStartXRef.current = e.pageX;
      dragScrollLeftRef.current = node.scrollLeft;
      node.style.cursor = 'grabbing';
      node.style.scrollSnapType = 'none';
      node.style.userSelect = 'none';
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      e.preventDefault();
      const dx = e.pageX - dragStartXRef.current;
      node.scrollLeft = dragScrollLeftRef.current - dx;
    };

    const snapToSlide = (targetIdx: number) => {
      const cw = containerWRef.current || 1;
      node.scrollLeft = targetIdx * cw;
      setActiveIndex(targetIdx);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          node.style.scrollSnapType = 'x mandatory';
        });
      });
    };

    const onMouseUp = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      node.style.cursor = '';
      node.style.userSelect = '';
      const dx = e.pageX - dragStartXRef.current;
      const cw = containerWRef.current || 1;
      const cur = indexRef.current;
      const threshold = cw * 0.15;
      let target = cur;
      if (dx < -threshold) target = cur + 1;
      else if (dx > threshold) target = cur - 1;
      target = clamp(target, 0, Math.max(0, images.length - 1));
      snapToSlide(target);
    };

    const onMouseLeave = () => {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      node.style.cursor = '';
      node.style.userSelect = '';
      const cw = containerWRef.current || 1;
      const idx = Math.round(node.scrollLeft / cw);
      const target = clamp(idx, 0, Math.max(0, images.length - 1));
      snapToSlide(target);
    };

    const onScrollEnd = () => {
      const cw = containerWRef.current || 1;
      const idx = Math.round(node.scrollLeft / cw);
      const target = clamp(idx, 0, Math.max(0, images.length - 1));
      setActiveIndex(target);
    };

    parent?.addEventListener('keydown', handleKeyDown as EventListener);
    node.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    node.addEventListener('mouseleave', onMouseLeave);
    node.addEventListener('scrollend', onScrollEnd);

    return () => {
      parent?.removeEventListener('keydown', handleKeyDown as EventListener);
      node.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      node.removeEventListener('mouseleave', onMouseLeave);
      node.removeEventListener('scrollend', onScrollEnd);
      if (scrollIdleTimerRef.current) {
        clearTimeout(scrollIdleTimerRef.current);
        scrollIdleTimerRef.current = null;
      }
    };
  }, [images.length, setActiveIndex, scrollTo, resolveNodes]);

  // Invalidate cached DOM nodes on unmount
  useEffect(() => {
    return () => {
      clearOverlayHideTimer();
      scrollNodeRef.current = null;
      wrapperNodeRef.current = null;
    };
  }, [clearOverlayHideTimer]);

  // Stable arrow callbacks
  const onPrev = useCallback(() => {
    const target = (indexRef.current - 1 + images.length) % Math.max(1, images.length);
    scrollTo(target);
  }, [images.length, scrollTo]);

  const onNext = useCallback(() => {
    const target = (indexRef.current + 1) % images.length;
    scrollTo(target);
  }, [images.length, scrollTo]);

  if (!images.length) return null;

  const navOffset = isMobile ? 8 : isTablet ? 12 : Math.max(44, 16 + Math.max(insets.left || 0, insets.right || 0));
  const slideHeight = fillContainer ? '100%' : computedH;
  const imagesLen = images.length;
  const overlayUri = transitionOverlayFrom != null ? getUri(transitionOverlayFrom) : '';

  return (
    <View style={[styles.sliderStack, fillContainer && { height: '100%' }]} testID="slider-stack">
      <View
        ref={wrapperRef}
        testID="slider-wrapper"
        {...({ dataSet: { sliderInstance: sliderInstanceId } } as any)}
        onLayout={onLayout}
        style={[
          styles.wrapper,
          { height: containerH },
          isMobile && !fillContainer && styles.wrapperMobile,
          isTablet && !fillContainer && styles.wrapperTablet,
          !fullBleed
            ? ({
                maxWidth: isMobile
                  ? undefined
                  : isTablet
                    ? SLIDER_MAX_WIDTH.tablet
                    : SLIDER_MAX_WIDTH.desktop,
                marginHorizontal: 'auto',
              } as any)
            : null,
        ]}
      >
        <View style={styles.clip} testID="slider-clip">
          {transitionOverlayVisible && transitionOverlayFrom != null && !!overlayUri ? (
            <View
              pointerEvents="none"
              testID="slider-transition-overlay"
              style={[
                {
                  position: 'absolute',
                  inset: 0,
                  zIndex: 30,
                  opacity: transitionOverlayFading ? 0 : 1,
                } as any,
                Platform.OS === 'web'
                  ? ({ transition: 'opacity 180ms ease' } as any)
                  : null,
              ]}
            >
              <ImageCardMedia
                src={overlayUri}
                fit={fit}
                blurBackground={blurBackground}
                blurRadius={12}
                priority="high"
                loading="eager"
                transition={0}
                style={styles.img}
                alt="Предыдущий слайд"
                imageProps={{
                  contentPosition: 'center',
                  accessibilityRole: 'image',
                  accessibilityLabel: 'Предыдущий слайд',
                }}
              />
            </View>
          ) : null}
          <ScrollView
            ref={scrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            scrollEventThrottle={100}
            style={[styles.scrollView, styles.scrollSnap]}
            contentContainerStyle={[styles.scrollContent, { height: containerH }]}
            onScrollBeginDrag={pauseAutoplay}
            onScrollEndDrag={resumeAutoplay}
            onScroll={handleScroll}
            testID="slider-scroll"
            {...({ dataSet: { sliderInstance: sliderInstanceId } } as any)}
          >
            {images.map((item, index) => {
              // Virtualization: only render Slide for slides within the visible window
              const distanceToCurrent = Math.abs(index - currentIndex);
              const inWindow = distanceToCurrent <= VIRTUAL_WINDOW;
              const preloadPriority = distanceToCurrent <= 1;

              return (
                <View
                  key={`${String(item.id)}|${String(item.updated_at ?? '')}|${String(item.url)}|${index}`}
                  style={[styles.slide, { width: containerW, height: containerH }, styles.slideSnap]}
                >
                  {inWindow ? (
                    <Slide
                      item={item}
                      index={index}
                      uri={getUri(index)}
                      containerW={containerW}
                      slideHeight={slideHeight}
                      imagesLength={imagesLen}
                      styles={styles}
                      blurBackground={blurBackground}
                      imageProps={imageProps}
                      onFirstImageLoad={onFirstImageLoad}
                      onSlideLoad={handleSlideLoad}
                      onImagePress={onImagePress}
                      firstImagePreloaded={firstImagePreloaded}
                      preloadPriority={preloadPriority}
                      fit={fit}
                    />
                  ) : null}
                </View>
              );
            })}
          </ScrollView>
        </View>

        {/* Navigation arrows */}
        {showArrows && (
          <NavArrows
            imagesLen={imagesLen}
            isMobile={isMobile}
            isTablet={isTablet}
            hideArrowsOnMobile={hideArrowsOnMobile}
            navOffset={navOffset}
            styles={styles}
            onPrev={onPrev}
            onNext={onNext}
          />
        )}

        {/* Counter (Instagram-style 1/N) */}
        <Counter currentIndex={currentIndex} total={imagesLen} isMobile={isMobile} styles={styles} />

        {/* Pagination dots */}
        {showDots && (
          <PaginationDots total={imagesLen} currentIndex={currentIndex} isMobile={isMobile} styles={styles} />
        )}
      </View>
    </View>
  );
};

const SliderWeb = forwardRef(SliderWebComponent);

export default memo(SliderWeb);
