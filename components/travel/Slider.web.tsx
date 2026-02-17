/**
 * Slider.web.tsx - Web-only slider component
 * This version does NOT use react-native-reanimated to avoid Worklets errors on web.
 * Uses CSS scroll-snap and standard React APIs instead.
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
import type { SliderImage, SliderProps, SliderRef } from './sliderParts/types';
import { buildUriWeb, clamp, SLIDER_MAX_WIDTH, computeSliderHeight, DEFAULT_AR, MOBILE_HEIGHT_PERCENT } from './sliderParts/utils';
import { createSliderStyles } from './sliderParts/styles';
import Slide from './sliderParts/Slide';

// Re-export types for consumers that import from '@/components/travel/Slider.web'
export type { SliderImage, SliderProps, SliderRef } from './sliderParts/types';

// Inject CSS class for disabling scroll-snap during programmatic scrolling
if (typeof document !== 'undefined') {
  const STYLE_ID = 'slider-snap-override';
  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = '.slider-snap-disabled { scroll-snap-type: none !important; }';
    document.head.appendChild(style);
  }
}

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
  } = props;

  const sliderInstanceId = useId();
  const insets = useSafeAreaInsets();
  const { width: winW, height: winH, isPhone, isLargePhone, isTablet: isTabletBp, isLargeTablet } = useResponsive();
  const isMobile = isPhone || isLargePhone;
  const isTablet = isTabletBp || isLargeTablet;

  // State
  const [containerW, setContainerWState] = useState(winW);
  const [currentIndex, setCurrentIndex] = useState(0);

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

  // First image aspect ratio
  const firstAR = (() => {
    const f = images[0];
    return f?.width && f?.height ? f.width / f.height : aspectRatio;
  })();

  // Compute height
  const containerH = useMemo(() => computeSliderHeight(containerW, {
    imagesLength: images.length,
    isMobile,
    isTablet,
    winH,
    insetsTop: insets.top || 0,
    insetsBottom: insets.bottom || 0,
    mobileHeightPercent,
    firstAR,
  }), [containerW, images.length, isMobile, isTablet, winH, insets.top, insets.bottom, mobileHeightPercent, firstAR]);

  // URI map
  const uriMap = useMemo(() => images.map((img, idx) =>
    buildUriWeb(img, containerW, containerH, fit, idx === 0)
  ), [images, containerW, containerH, fit]);

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
      setCurrentIndex((prev) => (prev === clampedIdx ? prev : clampedIdx));
      onIndexChanged?.(clampedIdx);
    },
    [images.length, onIndexChanged]
  );

  // Get scroll node
  const getScrollNode = useCallback((): HTMLElement | null => {
    if (typeof document === 'undefined') return null;
    return document.querySelector(
      `[data-testid="slider-scroll"][data-slider-instance="${sliderInstanceId}"]`
    ) as HTMLElement | null;
  }, [sliderInstanceId]);

  // Get wrapper node
  const getWrapperNode = useCallback((): HTMLElement | null => {
    if (typeof document === 'undefined') return null;
    return document.querySelector(
      `[data-testid="slider-wrapper"][data-slider-instance="${sliderInstanceId}"]`
    ) as HTMLElement | null;
  }, [sliderInstanceId]);

  // Sync container width from DOM
  const syncContainerWidthFromDom = useCallback(() => {
    const node = getWrapperNode();
    const w = node?.getBoundingClientRect?.()?.width ?? 0;
    if (!Number.isFinite(w) || w <= 0) return;
    if (Math.abs(containerWRef.current - w) > 4) {
      setContainerWidth(w);
    }
  }, [getWrapperNode, setContainerWidth]);

  // ResizeObserver
  useEffect(() => {
    syncContainerWidthFromDom();

    const node = getWrapperNode();
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
  }, [syncContainerWidthFromDom, getWrapperNode]);

  // ScrollTo implementation
  const scrollTo = useCallback(
    (i: number, _animated = true) => {
      const wrapped = clamp(i, 0, images.length - 1);
      const node = getScrollNode();
      if (node) {
        const left = wrapped * containerW;
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
            });
          });
        });
      }
    },
    [containerW, getScrollNode, images.length, setActiveIndex]
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
        const node = getScrollNode();
        const xIdle = node?.scrollLeft ?? 0;
        const cwIdle = containerWRef.current || 1;
        const idx = Math.round(xIdle / cwIdle);
        setActiveIndex(idx);
      }, 80);
    },
    [getScrollNode, setActiveIndex]
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

  // Keyboard navigation
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        const target = (indexRef.current - 1 + images.length) % Math.max(1, images.length);
        scrollTo(target);
      } else if (e.key === 'ArrowRight') {
        const target = (indexRef.current + 1) % images.length;
        scrollTo(target);
      }
    };
    const node = getScrollNode();
    if (!node) return;
    const parent = (node.closest?.('[data-testid="slider-wrapper"]') || node.parentElement?.parentElement) as HTMLElement | null;
    if (!parent) return;
    parent.setAttribute('tabindex', '0');
    parent.addEventListener('keydown', handleKeyDown as EventListener);
    return () => {
      parent.removeEventListener('keydown', handleKeyDown as EventListener);
    };
  }, [getScrollNode, images.length, scrollTo]);

  // Mouse drag
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const node = getScrollNode();
    if (!node) return;

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

    node.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    node.addEventListener('mouseleave', onMouseLeave);
    node.addEventListener('scrollend', onScrollEnd);
    return () => {
      node.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      node.removeEventListener('mouseleave', onMouseLeave);
      node.removeEventListener('scrollend', onScrollEnd);
    };
  }, [images.length, setActiveIndex, getScrollNode]);

  // Cleanup scroll idle timer
  useEffect(() => {
    return () => {
      if (scrollIdleTimerRef.current) {
        clearTimeout(scrollIdleTimerRef.current);
        scrollIdleTimerRef.current = null;
      }
    };
  }, []);

  // Key extractor
  const keyExtractor = useCallback(
    (it: SliderImage, index: number) =>
      `${String(it.id)}|${String(it.updated_at ?? '')}|${String(it.url)}|${index}`,
    []
  );

  if (!images.length) return null;

  const navOffset = isMobile ? 8 : isTablet ? 12 : Math.max(44, 16 + Math.max(insets.left || 0, insets.right || 0));

  return (
    <View style={styles.sliderStack} testID="slider-stack">
      <View
        ref={wrapperRef}
        testID="slider-wrapper"
        {...({ dataSet: { sliderInstance: sliderInstanceId } } as any)}
        onLayout={onLayout}
        style={[
          styles.wrapper,
          { height: containerH },
          isMobile && styles.wrapperMobile,
          isTablet && styles.wrapperTablet,
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
            scrollEventThrottle={100}
            style={[styles.scrollView, styles.scrollSnap]}
            contentContainerStyle={[styles.scrollContent, { height: containerH }]}
            onScrollBeginDrag={() => {
              pauseAutoplay();
            }}
            onScrollEndDrag={resumeAutoplay}
            onScroll={handleScroll}
            testID="slider-scroll"
            {...({ dataSet: { sliderInstance: sliderInstanceId } } as any)}
          >
            {images.map((item, index) => {
              const uri = uriMap[index] ?? item.url;

              return (
                <View
                  key={keyExtractor(item, index)}
                  style={[styles.slide, { width: containerW, height: containerH }, styles.slideSnap]}
                >
                  <Slide
                    item={item}
                    index={index}
                    uri={uri}
                    containerW={containerW}
                    slideHeight={containerH}
                    imagesLength={images.length}
                    styles={styles}
                    blurBackground={blurBackground}
                    imageProps={imageProps}
                    onFirstImageLoad={onFirstImageLoad}
                    onImagePress={onImagePress}
                    firstImagePreloaded={firstImagePreloaded}
                  />
                </View>
              );
            })}
          </ScrollView>
        </View>

        {/* Navigation arrows */}
        {showArrows && images.length > 1 && !(isMobile && hideArrowsOnMobile) && (
          <>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Previous slide"
              onPress={() => {
                const target = (indexRef.current - 1 + images.length) % Math.max(1, images.length);
                scrollTo(target);
              }}
              activeOpacity={0.8}
              style={[styles.navBtn, { left: navOffset }]}
            >
              <View style={styles.arrowIconContainer}>
                <Feather
                  name="chevron-left"
                  size={isMobile ? 20 : isTablet ? 22 : 24}
                  color={colors.textOnDark}
                  style={styles.arrowIcon}
                />
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Next slide"
              onPress={() => {
                const target = (indexRef.current + 1) % images.length;
                scrollTo(target);
              }}
              activeOpacity={0.8}
              style={[styles.navBtn, { right: navOffset }]}
            >
              <View style={styles.arrowIconContainer}>
                <Feather
                  name="chevron-right"
                  size={isMobile ? 20 : isTablet ? 22 : 24}
                  color={colors.textOnDark}
                  style={styles.arrowIcon}
                />
              </View>
            </TouchableOpacity>
          </>
        )}

        {/* Counter (Instagram-style 1/N) */}
        {images.length > 1 && (
          <View style={[styles.counter, isMobile && styles.counterMobile, { pointerEvents: 'none' }]}>
            <View style={styles.counterContainer}>
              <Text style={styles.counterText}>
                {currentIndex + 1}/{images.length}
              </Text>
            </View>
          </View>
        )}

        {/* Pagination dots */}
        {showDots && images.length > 1 && (
          <View style={[styles.dots, isMobile && styles.dotsMobile, { pointerEvents: 'none' }]}>
            <View style={styles.dotsContainer}>
              {images.map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.dot,
                    i === currentIndex && styles.dotActive,
                  ]}
                />
              ))}
            </View>
          </View>
        )}
      </View>
    </View>
  );
};

const SliderWeb = forwardRef(SliderWebComponent);

export default memo(SliderWeb);
