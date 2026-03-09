/**
 * Slider.web.tsx - Web-only slider component
 * This version does NOT use react-native-reanimated to avoid Worklets errors on web.
 * Uses CSS scroll-snap and standard React APIs instead.
 *
 * Performance optimizations:
 * - All slides stay mounted on web to avoid blank gaps during fast swipes
 * - Cached DOM node refs: no querySelector on every interaction
 * - Lazy URI computation: URIs built only for visible slides
 * - Memoized sub-components: arrows, dots don't re-render unnecessarily
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
import { useThemedColors } from '@/hooks/useTheme';
import { useResponsive } from '@/hooks/useResponsive';
import type { SliderProps, SliderRef } from './sliderParts/types';
import { buildUriWeb, SLIDER_MAX_WIDTH, DEFAULT_AR, MOBILE_HEIGHT_PERCENT } from './sliderParts/utils';
import { createSliderStyles, MAX_VISIBLE_DOTS } from './sliderParts/styles';
import Slide from './sliderParts/Slide';
import { useWebScrollInteraction } from './sliderParts/useWebScrollInteraction';
import { useSliderCore } from './sliderParts/useSliderCore';

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
      .slider-snap-disabled {
        scroll-snap-type: none !important;
        scroll-behavior: auto !important;
      }
      [data-testid="slider-scroll"]::-webkit-scrollbar { display: none !important; }
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

interface PaginationDotsProps {
  total: number;
  currentIndex: number;
  isMobile: boolean;
  styles: Record<string, any>;
}

/**
 * Instagram-style sliding window pagination dots.
 * Shows max MAX_VISIBLE_DOTS dots at a time. The active dot is slightly larger,
 * and dots at the edges of the visible window shrink to create a smooth
 * sliding effect when navigating through many slides.
 */
const PaginationDots = memo(function PaginationDots({ total, currentIndex, isMobile, styles }: PaginationDotsProps) {
  const dots = useMemo(() => {
    if (total <= MAX_VISIBLE_DOTS) {
      // Few slides — show all dots, no sliding window needed
      const arr = [];
      for (let i = 0; i < total; i++) {
        arr.push(
          <View key={i} style={[styles.dot, i === currentIndex && styles.dotActive]} />,
        );
      }
      return arr;
    }

    // Sliding window: center the active dot within the visible range
    const half = Math.floor(MAX_VISIBLE_DOTS / 2);
    let windowStart = currentIndex - half;
    let windowEnd = currentIndex + half;

    // Clamp to boundaries
    if (windowStart < 0) {
      windowStart = 0;
      windowEnd = MAX_VISIBLE_DOTS - 1;
    }
    if (windowEnd >= total) {
      windowEnd = total - 1;
      windowStart = total - MAX_VISIBLE_DOTS;
    }

    const arr = [];
    for (let i = windowStart; i <= windowEnd; i++) {
      const distFromActive = Math.abs(i - currentIndex);
      const isEdge = i === windowStart || i === windowEnd;
      const isActive = i === currentIndex;

      let dotStyle;
      if (isActive) {
        dotStyle = [styles.dot, styles.dotActive];
      } else if (isEdge && distFromActive >= 2) {
        dotStyle = [styles.dot, styles.dotTiny];
      } else if (distFromActive >= 2) {
        dotStyle = [styles.dot, styles.dotSmall];
      } else {
        dotStyle = [styles.dot];
      }

      arr.push(<View key={i} style={dotStyle} />);
    }
    return arr;
  }, [total, currentIndex, styles.dot, styles.dotActive, styles.dotSmall, styles.dotTiny]);

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
    hideArrowsOnMobile = true,
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
  const { isPhone, isLargePhone } = useResponsive();
  const isMobileDevice = isPhone || isLargePhone;
  const {
    containerW,
    containerH: coreContainerH,
    currentIndex,
    indexRef,
    containerWRef,
    isMobile,
    isTablet,
    insets,
    getUri,
    setContainerWidth,
    setActiveIndexFromOffset,
    dismissSwipeHint,
    enablePrefetch,
    scrollTo,
    setScrollToImpl,
    pauseAutoplay,
    resumeAutoplay,
  } = useSliderCore({
    images,
    aspectRatio,
    autoPlay,
    autoPlayInterval,
    preloadCount: isMobileDevice ? Math.max(_preloadCount, 2) : _preloadCount,
    mobileHeightPercent,
    onIndexChanged,
    buildUri: (img, w, h, isFirst) => buildUriWeb(img, w, h, fit, isFirst),
    deferWebPrefetchUntilInteraction: true,
    handleAppState: false,
    includeUriMap: false,
  });

  // Track whether onLayout has fired so we can use CSS '100%' width before the first measurement
  const [layoutMeasured, setLayoutMeasured] = useState(false);
  const [measuredSlideWidth, setMeasuredSlideWidth] = useState<number | null>(null);

  // Refs
  const currentIndexRef = useRef(0);
  const scrollRef = useRef<any>(null);
  const wrapperRef = useRef<any>(null);
  // Cached DOM node refs — set once, avoid querySelector on every interaction
  const scrollNodeRef = useRef<HTMLElement | null>(null);
  const wrapperNodeRef = useRef<HTMLElement | null>(null);
  const scrollAnimationFrameRef = useRef<number | null>(null);
  const scrollAnimationIdRef = useRef(0);

  const computedH = coreContainerH;
  const containerH = fillContainer ? '100%' : computedH;
  const renderedSlideWidth = measuredSlideWidth ?? containerW;

  const cancelScrollAnimation = useCallback(() => {
    if (scrollAnimationFrameRef.current != null && typeof window !== 'undefined') {
      window.cancelAnimationFrame(scrollAnimationFrameRef.current);
      scrollAnimationFrameRef.current = null;
    }
    scrollNodeRef.current?.classList.remove('slider-snap-disabled');
    scrollAnimationIdRef.current += 1;
  }, []);

  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

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
      cancelScrollAnimation();
      const w = widthOverride ?? containerWRef.current;
      if (!Number.isFinite(w) || w <= 0) return;
      const left = idx * w;
      if (Math.abs((node.scrollLeft || 0) - left) < 1) return;

      node.classList.add('slider-snap-disabled');
      void node.offsetHeight;
      node.scrollLeft = left;
      requestAnimationFrame(() => {
        node.scrollLeft = left;
        requestAnimationFrame(() => {
          node.classList.remove('slider-snap-disabled');
        });
      });
    },
    [cancelScrollAnimation, containerWRef],
  );

  // Sync container width from DOM
  const syncContainerWidthFromDom = useCallback(() => {
    resolveNodes();
    const wrapperNode = wrapperNodeRef.current;
    const scrollNode = scrollNodeRef.current;
    const w = wrapperNode?.getBoundingClientRect?.()?.width ?? 0;
    if (!Number.isFinite(w) || w <= 0) return;
    setMeasuredSlideWidth(w);
    setLayoutMeasured(true);
    if (Math.abs(containerWRef.current - w) > 4) {
      setContainerWidth(w);
    }

    if (scrollNode) {
      const targetLeft = indexRef.current * w;
      if (Math.abs((scrollNode.scrollLeft || 0) - targetLeft) > 1) {
        // Keep the scroll position aligned to the current index when width changes
        // or when DOM nodes resolve after the initial layout pass.
        snapScrollToIndex(indexRef.current, w);
      }
    }
  }, [containerWRef, indexRef, resolveNodes, setContainerWidth, snapScrollToIndex]);

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

  // Web-specific scroll implementation is injected into the shared slider core.
  // Uses direct scrollLeft assignment with snap-disabled class because
  // node.scrollTo() is silently blocked by scroll-snap-type: x mandatory in Chromium.
  const scrollToDom = useCallback(
    (i: number, animated = true) => {
      const wrapped = Math.max(0, Math.min(i, images.length - 1));
      resolveNodes();
      const node = scrollNodeRef.current;
      if (node) {
        const liveW = containerWRef.current;
        const left = wrapped * liveW;
        if (Math.abs((node.scrollLeft || 0) - left) < 1) {
          return;
        }
        cancelScrollAnimation();

        if (!animated) {
          node.classList.add('slider-snap-disabled');
          void node.offsetHeight;
          node.scrollLeft = left;
          requestAnimationFrame(() => {
            node.scrollLeft = left;
            requestAnimationFrame(() => {
              node.classList.remove('slider-snap-disabled');
            });
          });
          return;
        }

        const animationId = scrollAnimationIdRef.current + 1;
        scrollAnimationIdRef.current = animationId;
        const startLeft = node.scrollLeft || 0;
        const delta = left - startLeft;
        const duration = Math.max(180, Math.min(320, Math.abs(delta) * 0.35));
        const startTs = typeof performance !== 'undefined' ? performance.now() : Date.now();
        node.classList.add('slider-snap-disabled');

        const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
        const step = (ts: number) => {
          if (scrollAnimationIdRef.current !== animationId) return;
          const elapsed = ts - startTs;
          const progress = duration <= 0 ? 1 : Math.min(1, elapsed / duration);
          node.scrollLeft = startLeft + delta * easeOutCubic(progress);
          if (progress < 1) {
            scrollAnimationFrameRef.current = window.requestAnimationFrame(step);
            return;
          }
          node.scrollLeft = left;
          scrollAnimationFrameRef.current = null;
          requestAnimationFrame(() => {
            if (scrollAnimationIdRef.current !== animationId) return;
            node.classList.remove('slider-snap-disabled');
          });
        };

        scrollAnimationFrameRef.current = window.requestAnimationFrame(step);
      }
    },
    [cancelScrollAnimation, resolveNodes, images.length, containerWRef]
  );

  useEffect(() => {
    setScrollToImpl(scrollToDom);
    // Note: Do NOT reset to null on cleanup — this causes race conditions where
    // scrollToFn.current is null between effect cleanup and re-run, breaking
    // arrow button clicks. The ref will be updated with the new function on next render.
  }, [scrollToDom, setScrollToImpl]);

  // Expose methods via ref
  useImperativeHandle(
    ref,
    (): SliderRef => ({
      scrollTo,
      next: () => {
        const cur = currentIndexRef.current;
        const target = Math.min(images.length - 1, cur + 1);
        if (target === cur) return;
        scrollTo(target);
      },
      prev: () => {
        const cur = currentIndexRef.current;
        const target = Math.max(0, cur - 1);
        if (target === cur) return;
        scrollTo(target);
      },
    }),
    [images.length, scrollTo]
  );

  // Layout handler
  const onLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const w = e.nativeEvent.layout.width;
      setMeasuredSlideWidth(w);
      setContainerWidth(w);
      setLayoutMeasured(true);
      resolveNodes();
      snapScrollToIndex(indexRef.current, w);
    },
    [indexRef, setContainerWidth, resolveNodes, snapScrollToIndex]
  );

  // Consolidated web scroll/drag/keyboard/touch interaction (E6.2)
  useWebScrollInteraction({
    slideCount: images.length,
    containerWRef,
    indexRef,
    scrollNodeRef,
    wrapperNodeRef,
    resolveNodes,
    scrollTo,
    setActiveIndexFromOffset,
    cancelScrollAnimation,
    enablePrefetch,
    dismissSwipeHint,
    pauseAutoplay,
    resumeAutoplay,
    isMobile,
  });

  // Invalidate cached DOM nodes on unmount
  useEffect(() => {
    return () => {
      cancelScrollAnimation();
      scrollNodeRef.current = null;
      wrapperNodeRef.current = null;
    };
  }, [cancelScrollAnimation]);

  // Stable arrow callbacks — no wrap-around (Instagram-style: stop at boundaries)
  const onPrev = useCallback(() => {
    const cur = currentIndexRef.current;
    const target = Math.max(0, cur - 1);
    if (target === cur) return;
    scrollTo(target);
  }, [scrollTo]);

  const onNext = useCallback(() => {
    const cur = currentIndexRef.current;
    const target = Math.min(images.length - 1, cur + 1);
    if (target === cur) return;
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
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            scrollEventThrottle={16}
            style={[styles.scrollView, isMobile ? styles.scrollSnapMobile : styles.scrollSnapDesktop]}
            contentContainerStyle={[styles.scrollContent, { height: containerH }]}
            onScrollBeginDrag={pauseAutoplay}
            onScrollEndDrag={resumeAutoplay}
            testID="slider-scroll"
            {...({ dataSet: { sliderInstance: sliderInstanceId } } as any)}
          >
            {images.map((item, index) => {
              const distanceToCurrent = Math.abs(index - currentIndex);
              const preloadPriority = distanceToCurrent <= (isMobile ? 2 : 1);

              return (
                <View
                  key={`${String(item.id)}|${index}`}
                  testID={`slider-slide-${index}`}
                  {...({ dataSet: { testid: `slider-slide-${index}` } } as any)}
                  style={[
                    styles.slide,
                    { width: layoutMeasured ? renderedSlideWidth : '100%', height: containerH },
                    Platform.OS === 'web'
                      ? ({ pointerEvents: 'none', touchAction: isMobile ? 'pan-y pinch-zoom' : 'pan-x' } as any)
                      : null,
                    styles.slideSnap,
                  ]}
                >
                  <Slide
                    item={item}
                    index={index}
                    uri={getUri(index)}
                    containerW={renderedSlideWidth}
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
                </View>
              );
            })}
          </ScrollView>
        </View>

        {/* Navigation arrows — hidden at boundaries (Instagram-style) */}
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

        {imagesLen > 1 && (
          <View style={[styles.counter, isMobile && styles.counterMobile, { pointerEvents: 'none' }]}>
            <View style={styles.counterContainer}>
              <Text style={styles.counterText}>
                {currentIndex + 1}/{imagesLen}
              </Text>
            </View>
          </View>
        )}

        {/* Instagram-style sliding window pagination dots */}
        {showDots && (
          <PaginationDots total={imagesLen} currentIndex={currentIndex} isMobile={isMobile} styles={styles} />
        )}
      </View>
    </View>
  );
};

const SliderWeb = forwardRef(SliderWebComponent);

export default memo(SliderWeb);
