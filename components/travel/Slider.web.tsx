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
  useLayoutEffect,
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
import { prefetchImage } from '@/components/ui/ImageCardMedia';

// Re-export types for consumers that import from '@/components/travel/Slider.web'
export type { SliderImage, SliderProps, SliderRef } from './sliderParts/types';

const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;

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
  // Track whether onLayout has fired so we can use CSS '100%' width before the first measurement
  const [layoutMeasured, setLayoutMeasured] = useState(false);

  // Refs
  const indexRef = useRef(0);
  const currentIndexRef = useRef(0);
  const containerWRef = useRef(winW);
  const scrollRef = useRef<any>(null);
  const wrapperRef = useRef<any>(null);
  const scrollIdleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDraggingRef = useRef(false);
  const dragStartXRef = useRef(0);
  const dragScrollLeftRef = useRef(0);
  const dragStartIndexRef = useRef(0);
  const autoplayTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const pausedByTouch = useRef(false);
  // Cached DOM node refs — set once, avoid querySelector on every interaction
  const scrollNodeRef = useRef<HTMLElement | null>(null);
  const wrapperNodeRef = useRef<HTMLElement | null>(null);

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

  const prefetchedUrisRef = useRef<Record<string, true>>({});

  const canPrefetchOnWeb = useCallback(() => {
    if (Platform.OS !== 'web') return false;
    if (isMobile) return false;
    if (typeof navigator === 'undefined') return false;
    const connection =
      (navigator as any).connection ||
      (navigator as any).mozConnection ||
      (navigator as any).webkitConnection;
    if (connection?.saveData) return false;
    const effectiveType = String(connection?.effectiveType || '').toLowerCase();
    if (effectiveType.includes('2g') || effectiveType === '3g') return false;
    return true;
  }, [isMobile]);

  useEffect(() => {
    if (!canPrefetchOnWeb()) return;
    if (images.length < 2) return;

    const candidates = [currentIndex - 1, currentIndex + 1, currentIndex + 2];
    for (const idx of candidates) {
      if (idx < 0 || idx >= images.length) continue;
      const uri = getUri(idx);
      if (!uri) continue;
      if (prefetchedUrisRef.current[uri]) continue;
      prefetchedUrisRef.current[uri] = true;
      prefetchImage(uri).catch(() => undefined);
    }
  }, [canPrefetchOnWeb, currentIndex, getUri, images.length]);

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
      indexRef.current = clampedIdx;
      currentIndexRef.current = clampedIdx;
      setCurrentIndex((prev) => (prev === clampedIdx ? prev : clampedIdx));
      onIndexChanged?.(clampedIdx);
    },
    [images.length, onIndexChanged]
  );

  // Extract underlying DOM element from a React Native Web ref
  const getDomNode = useCallback((ref: React.RefObject<any>): HTMLElement | null => {
    const r = ref.current;
    if (!r) return null;
    if (r instanceof HTMLElement) return r;
    if (r._nativeNode instanceof HTMLElement) return r._nativeNode;
    if (r._domNode instanceof HTMLElement) return r._domNode;
    if (typeof r.getNode === 'function') {
      const n = r.getNode();
      if (n instanceof HTMLElement) return n;
    }
    return null;
  }, []);

  // Resolve cached DOM nodes — try ref-captured nodes first, fall back to querySelector with escaped ID
  const resolveNodes = useCallback(() => {
    if (typeof document === 'undefined') return;
    if (!scrollNodeRef.current) {
      scrollNodeRef.current = getDomNode(scrollRef);
    }
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
      wrapperNodeRef.current = getDomNode(wrapperRef);
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
  }, [sliderInstanceId, getDomNode]);

  const snapScrollToIndex = useCallback(
    (idx: number, widthOverride?: number) => {
      const node = scrollNodeRef.current;
      if (!node) return;
      if (isDraggingRef.current) return;
      const w = widthOverride ?? containerWRef.current;
      if (!Number.isFinite(w) || w <= 0) return;
      const left = idx * w;
      if (Math.abs((node.scrollLeft || 0) - left) < 1) return;

      node.classList.add('slider-snap-disabled');
      void node.offsetHeight;
      node.scrollLeft = left;
      requestAnimationFrame(() => {
        node.scrollLeft = left;
        node.classList.remove('slider-snap-disabled');
      });
    },
    [containerWRef],
  );

  // Sync container width from DOM
  const syncContainerWidthFromDom = useCallback(() => {
    resolveNodes();
    const node = wrapperNodeRef.current;
    const w = node?.getBoundingClientRect?.()?.width ?? 0;
    if (!Number.isFinite(w) || w <= 0) return;
    if (Math.abs(containerWRef.current - w) > 4) {
      setContainerWidth(w);
      // Keep the scroll position aligned to the current index when width changes to avoid
      // showing a partial next/previous slide on first load.
      snapScrollToIndex(indexRef.current, w);
    }
  }, [resolveNodes, setContainerWidth, snapScrollToIndex]);

  // ResizeObserver
  useIsomorphicLayoutEffect(() => {
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
        const liveW = containerWRef.current;
        const left = wrapped * liveW;
        // Disable scroll-snap temporarily so programmatic scrollLeft is instant
        node.classList.add('slider-snap-disabled');
        void node.offsetHeight;
        node.scrollLeft = left;
        setActiveIndex(wrapped);
        // Double rAF: survive React re-render from setActiveIndex, then restore snap
        requestAnimationFrame(() => {
          node.scrollLeft = left;
          requestAnimationFrame(() => {
            node.scrollLeft = left;
            node.classList.remove('slider-snap-disabled');
          });
        });
      }
    },
    [resolveNodes, images.length, setActiveIndex, containerWRef]
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
      setLayoutMeasured(true);
      resolveNodes();
      snapScrollToIndex(indexRef.current, w);
    },
    [setContainerWidth, resolveNodes, snapScrollToIndex]
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
      dragStartIndexRef.current = indexRef.current;
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
      node.classList.add('slider-snap-disabled');
      node.scrollLeft = targetIdx * cw;
      setActiveIndex(targetIdx);
      requestAnimationFrame(() => {
        node.scrollLeft = targetIdx * cw;
        requestAnimationFrame(() => {
          node.classList.remove('slider-snap-disabled');
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
      const cur = dragStartIndexRef.current;
      const threshold = cw * 0.15;
      let target = cur;
      if (dx < -threshold) target = cur + 1;
      else if (dx > threshold) target = cur - 1;
      target = clamp(target, 0, Math.max(0, images.length - 1));
      snapToSlide(target);
      // Restore snap after programmatic settle.
      node.style.scrollSnapType = '';
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
      node.style.scrollSnapType = '';
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
      scrollNodeRef.current = null;
      wrapperNodeRef.current = null;
    };
  }, []);

  // Stable arrow callbacks
  const onPrev = useCallback(() => {
    const target = (currentIndexRef.current - 1 + images.length) % Math.max(1, images.length);
    scrollTo(target);
  }, [images.length, scrollTo]);

  const onNext = useCallback(() => {
    const target = (currentIndexRef.current + 1) % images.length;
    scrollTo(target);
  }, [images.length, scrollTo]);

  if (!images.length) return null;

  const navOffset = isMobile ? 8 : isTablet ? 12 : Math.max(44, 16 + Math.max(insets.left || 0, insets.right || 0));
  const slideHeight = fillContainer ? '100%' : computedH;
  const imagesLen = images.length;

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
          <ScrollView
            ref={scrollRef}
            horizontal
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
                  key={`${String(item.id)}|${index}`}
                  style={[styles.slide, { width: layoutMeasured ? containerW : '100%', height: containerH }, styles.slideSnap]}
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
                      isActive={index === currentIndex}
                      imageProps={imageProps}
                      onFirstImageLoad={onFirstImageLoad}
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
