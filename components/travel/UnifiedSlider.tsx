import React, {
  memo,
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useMemo,
  useRef,
  forwardRef,
} from 'react';
import {
  View,
  FlatList,
  ScrollView,
  LayoutChangeEvent,
  Text,
  TouchableOpacity,
  Platform,
} from 'react-native';
import Animated, {
  useAnimatedScrollHandler,
  useSharedValue,
} from 'react-native-reanimated';
import Feather from '@expo/vector-icons/Feather';
import { useThemedColors } from '@/hooks/useTheme';
import type { SliderImage, SliderProps, SliderRef } from './sliderParts/types';
import { buildUriNative, buildUriWeb, clamp, SLIDER_MAX_WIDTH } from './sliderParts/utils';
import { useSliderLogic } from './sliderParts/useSliderLogic';
import { createSliderStyles } from './sliderParts/styles';
import Arrow from './sliderParts/Arrow';
import Dot from './sliderParts/Dot';
import Slide from './sliderParts/Slide';

// Re-export types for consumers
export type { SliderImage, SliderProps, SliderRef } from './sliderParts/types';

const isTestEnv = process.env.NODE_ENV === 'test';
const isWeb = Platform.OS === 'web';

// Inject CSS class for disabling scroll-snap during programmatic scrolling (web only)
if (isWeb && typeof document !== 'undefined') {
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

/* --------------------------------- Slider ---------------------------------- */

const UnifiedSliderComponent = (props: SliderProps, ref: React.Ref<SliderRef>) => {
  const colors = useThemedColors();
  const styles = useMemo(() => createSliderStyles(colors), [colors]);

  const {
    images,
    showArrows = true,
    showDots = true,
    hideArrowsOnMobile,
    aspectRatio,
    fit = 'contain',
    fullBleed = false,
    autoPlay = true,
    autoPlayInterval = 6000,
    onIndexChanged,
    imageProps,
    preloadCount = 1,
    blurBackground = true,
    onFirstImageLoad,
    mobileHeightPercent,
    onImagePress,
    firstImagePreloaded,
  } = props;

  const sliderInstanceId = useId();

  // Use the unified logic hook
  const logic = useSliderLogic({
    images,
    aspectRatio,
    autoPlay,
    autoPlayInterval,
    preloadCount,
    mobileHeightPercent,
    onIndexChanged,
    buildUri: (img, w, h, isFirst) => {
      if (isWeb) {
        return buildUriWeb(img, w, h, fit, isFirst);
      }
      return buildUriNative(img, w, h, isFirst);
    },
  });

  const {
    containerW,
    containerH,
    currentIndex,
    reduceMotion,
    indexRef,
    containerWRef,
    isMobile,
    isTablet,
    insets,
    uriMap,
    setContainerWidth,
    setActiveIndex,
    setActiveIndexFromOffset,
    dismissSwipeHint,
    enablePrefetch,
    pauseAutoplay,
    resumeAutoplay,
  } = logic;

  // Refs for scroll elements
  const listRef = useRef<FlatList<SliderImage>>(null);
  const scrollRef = useRef<any>(null);
  const wrapperRef = useRef<any>(null);
  const scrollIdleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDraggingRef = useRef(false);
  const dragStartXRef = useRef(0);
  const dragScrollLeftRef = useRef(0);

  // Shared value for animated dots (native only)
  const x = useSharedValue(0);

  // Get scroll node (web only)
  const getScrollNode = useCallback((): HTMLElement | null => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return null;
    try {
      const escaped = typeof CSS !== 'undefined' && CSS.escape
        ? CSS.escape(sliderInstanceId)
        : sliderInstanceId.replace(/[^a-zA-Z0-9_-]/g, (c) => `\\${c}`);
      const node = document.querySelector(
        `[data-testid="slider-scroll"][data-slider-instance="${escaped}"]`
      ) as HTMLElement | null;
      if (node) return node;
    } catch { /* noop */ }
    return document.querySelector('[data-testid="slider-scroll"]') as HTMLElement | null;
  }, [sliderInstanceId]);

  // Get wrapper node (web only)
  const getWrapperNode = useCallback((): HTMLElement | null => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return null;
    try {
      const escaped = typeof CSS !== 'undefined' && CSS.escape
        ? CSS.escape(sliderInstanceId)
        : sliderInstanceId.replace(/[^a-zA-Z0-9_-]/g, (c) => `\\${c}`);
      const node = document.querySelector(
        `[data-testid="slider-wrapper"][data-slider-instance="${escaped}"]`
      ) as HTMLElement | null;
      if (node) return node;
    } catch { /* noop */ }
    return document.querySelector('[data-testid="slider-wrapper"]') as HTMLElement | null;
  }, [sliderInstanceId]);

  // Sync container width from DOM (web only)
  const syncContainerWidthFromDom = useCallback(() => {
    if (Platform.OS !== 'web') return;
    const node = getWrapperNode();
    const w = node?.getBoundingClientRect?.()?.width ?? 0;
    if (!Number.isFinite(w) || w <= 0) return;
    if (Math.abs(containerWRef.current - w) > 4) {
      setContainerWidth(w);
    }
  }, [getWrapperNode, containerWRef, setContainerWidth]);

  // ResizeObserver for web
  useEffect(() => {
    if (Platform.OS !== 'web') return;
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
    (i: number, animated = !reduceMotion) => {
      const wrapped = clamp(i, 0, images.length - 1);

      if (isWeb) {
        const node = getScrollNode();
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
      } else {
        listRef.current?.scrollToOffset({
          offset: wrapped * containerW,
          animated,
        });
        setActiveIndex(wrapped);
      }
    },
    [containerW, getScrollNode, images.length, reduceMotion, setActiveIndex, indexRef]
  );

  // Expose methods via ref
  useImperativeHandle(
    ref,
    (): SliderRef => ({
      scrollTo,
      next: () => {
        dismissSwipeHint();
        enablePrefetch();
        const target = (indexRef.current + 1) % images.length;
        scrollTo(target);
      },
      prev: () => {
        dismissSwipeHint();
        enablePrefetch();
        const target = (indexRef.current - 1 + images.length) % Math.max(1, images.length);
        scrollTo(target);
      },
    }),
    [scrollTo, dismissSwipeHint, enablePrefetch, images.length, indexRef]
  );

  // Layout handler
  const onLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const w = e.nativeEvent.layout.width;
      setContainerWidth(w);
    },
    [setContainerWidth]
  );

  // Animated scroll handler (native only)
  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      x.value = e.contentOffset.x;
    },
  });

  // Momentum scroll end (native only)
  const onMomentumScrollEnd = useCallback(
    (e: any) => {
      const offsetX = e?.nativeEvent?.contentOffset?.x ?? 0;
      setActiveIndexFromOffset(offsetX);
    },
    [setActiveIndexFromOffset]
  );

  // Web scroll handler
  const handleScroll = useCallback(
    (_e: any) => {
      enablePrefetch();

      if (scrollIdleTimerRef.current) clearTimeout(scrollIdleTimerRef.current);
      scrollIdleTimerRef.current = setTimeout(() => {
        const node = getScrollNode();
        const xIdle = node?.scrollLeft ?? 0;
        const cwIdle = containerWRef.current || 1;
        const idx = Math.round(xIdle / cwIdle);
        setActiveIndex(idx);
      }, 80);
    },
    [enablePrefetch, getScrollNode, containerWRef, setActiveIndex]
  );

  // Keyboard navigation (web only)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        dismissSwipeHint();
        enablePrefetch();
        const target = (indexRef.current - 1 + images.length) % Math.max(1, images.length);
        scrollTo(target);
      } else if (e.key === 'ArrowRight') {
        dismissSwipeHint();
        enablePrefetch();
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
  }, [getScrollNode, dismissSwipeHint, enablePrefetch, indexRef, images.length, scrollTo]);

  // Mouse drag (web only)
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
  }, [images.length, setActiveIndex, getScrollNode, containerWRef, indexRef]);

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
      isWeb
        ? `${String(it.id)}|${String(it.updated_at ?? '')}|${String(it.url)}|${index}`
        : String(it.id),
    []
  );

  // Get item layout (native only)
  const getItemLayout = useCallback(
    (_: any, i: number) => ({
      length: containerW,
      offset: containerW * i,
      index: i,
    }),
    [containerW]
  );

  // Viewability (native only)
  const setActiveIndexRef = useRef(setActiveIndex);
  setActiveIndexRef.current = setActiveIndex;

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: Array<{ index: number | null }> }) => {
      const first = viewableItems.find((v) => v.index != null);
      if (first && typeof first.index === 'number') {
        const idx = first.index;
        if (indexRef.current !== idx) setActiveIndexRef.current(idx);
      }
    }
  ).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 90,
    minimumViewTime: 80,
  }).current;

  // Render item for native FlatList
  const renderItemNative = useCallback(
    ({ item, index }: { item: SliderImage; index: number }) => {
      const uri = uriMap[index] ?? item.url;
      return (
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
      );
    },
    [uriMap, containerW, containerH, images.length, styles, blurBackground, imageProps, onFirstImageLoad, onImagePress, firstImagePreloaded]
  );

  if (!images.length) return null;

  const navOffset = isMobile ? 8 : isTablet ? 12 : Math.max(44, 16 + Math.max(insets.left || 0, insets.right || 0));

  // RENDER: Platform-specific content
  const renderContent = () => {
    if (isWeb) {
      // Web: use ScrollView with CSS scroll-snap
      return (
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
              enablePrefetch();
              pauseAutoplay();
              dismissSwipeHint();
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
      );
    }

    // Native: use Animated.FlatList
    return (
      <View style={[styles.clip, isMobile && styles.clipMobile]}>
        <Animated.FlatList
          ref={listRef}
          data={images}
          keyExtractor={keyExtractor}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={16}
          renderItem={renderItemNative}
          initialNumToRender={isTestEnv ? images.length : 2}
          windowSize={isTestEnv ? images.length : 5}
          maxToRenderPerBatch={isTestEnv ? images.length : 3}
          disableVirtualization={isTestEnv}
          maintainVisibleContentPosition={Platform.OS === 'ios' ? undefined : { minIndexForVisible: 0 }}
          disableIntervalMomentum
          getItemLayout={getItemLayout}
          bounces={false}
          decelerationRate={Platform.OS === 'ios' ? 'fast' : 0.98}
          removeClippedSubviews={true}
          updateCellsBatchingPeriod={isTestEnv ? 0 : 50}
          initialScrollIndex={isTestEnv ? undefined : indexRef.current || 0}
          onScrollBeginDrag={() => {
            pauseAutoplay();
            dismissSwipeHint();
          }}
          onScrollEndDrag={resumeAutoplay}
          onMomentumScrollEnd={onMomentumScrollEnd}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
        />
      </View>
    );
  };

  return (
    <View style={styles.sliderStack} testID="slider-stack">
      <View
        ref={wrapperRef}
        testID="slider-wrapper"
        {...(isWeb ? { dataSet: { sliderInstance: sliderInstanceId } } as any : {})}
        onLayout={onLayout}
        style={[
          styles.wrapper,
          { height: containerH },
          isMobile && styles.wrapperMobile,
          isTablet && styles.wrapperTablet,
          isWeb && !fullBleed
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
        {renderContent()}

        {/* Navigation arrows */}
        {showArrows && images.length > 1 && !(isMobile && hideArrowsOnMobile) && (
          <>
            {isWeb ? (
              // Web arrows (TouchableOpacity + Feather icon)
              <>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Previous slide"
                  onPress={() => {
                    dismissSwipeHint();
                    enablePrefetch();
                    const target = (indexRef.current - 1 + images.length) % Math.max(1, images.length);
                    scrollTo(target);
                  }}
                  activeOpacity={0.9}
                  style={[styles.navBtn, { left: navOffset }]}
                  {...({ className: 'slider-nav-btn' } as any)}
                >
                  <View style={styles.arrowIconContainer}>
                    <Feather
                      name="chevron-left"
                      size={isMobile ? 16 : isTablet ? 18 : 20}
                      color="rgba(255,255,255,0.95)"
                      style={styles.arrowIcon}
                    />
                  </View>
                </TouchableOpacity>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Next slide"
                  onPress={() => {
                    dismissSwipeHint();
                    enablePrefetch();
                    const target = (indexRef.current + 1) % images.length;
                    scrollTo(target);
                  }}
                  activeOpacity={0.9}
                  style={[styles.navBtn, { right: navOffset }]}
                  {...({ className: 'slider-nav-btn' } as any)}
                >
                  <View style={styles.arrowIconContainer}>
                    <Feather
                      name="chevron-right"
                      size={isMobile ? 16 : isTablet ? 18 : 20}
                      color="rgba(255,255,255,0.95)"
                      style={styles.arrowIcon}
                    />
                  </View>
                </TouchableOpacity>
              </>
            ) : (
              // Native arrows (animated)
              <>
                <Arrow
                  dir="left"
                  onPress={() => {
                    dismissSwipeHint();
                    enablePrefetch();
                    const target = (indexRef.current - 1 + images.length) % Math.max(1, images.length);
                    scrollTo(target);
                  }}
                  isMobile={isMobile}
                  isTablet={isTablet}
                  hideArrowsOnMobile={hideArrowsOnMobile}
                  insets={insets}
                  dismissSwipeHint={dismissSwipeHint}
                  colors={colors}
                  styles={styles}
                />
                <Arrow
                  dir="right"
                  onPress={() => {
                    dismissSwipeHint();
                    enablePrefetch();
                    const target = (indexRef.current + 1) % images.length;
                    scrollTo(target);
                  }}
                  isMobile={isMobile}
                  isTablet={isTablet}
                  hideArrowsOnMobile={hideArrowsOnMobile}
                  insets={insets}
                  dismissSwipeHint={dismissSwipeHint}
                  colors={colors}
                  styles={styles}
                />
              </>
            )}
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
              {isWeb ? (
                // Web: static dots
                images.map((_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.dot,
                      i === currentIndex && styles.dotActive,
                    ]}
                  />
                ))
              ) : (
                // Native: animated dots
                images.map((_, i) => (
                  <View key={i} style={styles.dotWrap}>
                    <Dot
                      i={i}
                      x={x}
                      containerW={containerW}
                      total={images.length}
                      reduceMotion={reduceMotion}
                      dotStyle={styles.dot}
                    />
                  </View>
                ))
              )}
            </View>
          </View>
        )}
      </View>
    </View>
  );
};

const UnifiedSlider = forwardRef(UnifiedSliderComponent);

export default memo(UnifiedSlider);


