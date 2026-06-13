import React, {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useId,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  forwardRef,
} from 'react';
import {
  View,
  FlatList,
  ScrollView,
  LayoutChangeEvent,
  Platform,
} from 'react-native';
import Animated, {
  useAnimatedScrollHandler,
  useSharedValue,
} from 'react-native-reanimated';
import { useThemedColors } from '@/hooks/useTheme';
import type { SliderImage, SliderProps, SliderRef } from './sliderParts/types';
import { buildUriNative, buildUriWeb, clamp, SLIDER_MAX_WIDTH } from './sliderParts/utils';
import { useSliderLogic } from './sliderParts/useSliderLogic';
import { createSliderStyles } from './sliderParts/styles';
import { injectSliderSnapStyles } from './sliderParts/snapStyleInjection';
import { findSliderNode } from './sliderParts/domNodes';
import SliderOverlays from './sliderParts/SliderOverlays';
import Slide from './sliderParts/Slide';

// Re-export types for consumers
export type { SliderImage, SliderProps, SliderRef } from './sliderParts/types';

const isTestEnv = process.env.NODE_ENV === 'test';
const isWeb = Platform.OS === 'web';

const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;

injectSliderSnapStyles();

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
    contentAspectRatio,
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
    fillContainer = false,
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

  // Flips to true once the web ScrollView DOM node is available, so effects
  // that attach listeners re-run after the node mounts (deps don't otherwise
  // change between initial render and node availability).
  const [nodeReady, setNodeReady] = useState(false);

  // Measured parent height — used when fillContainer is set so native slides
  // match the (clipped) hero height instead of the aspect-ratio-driven containerH.
  const [measuredH, setMeasuredH] = useState(0);

  // When the slider should fill its parent (e.g. the travel hero, which clips to a
  // fixed heroHeight), use the measured parent height for slides so the photo isn't
  // taller than the visible area and pushed toward the bottom. Native-only; web uses
  // a separate Slider.web implementation, so this never alters web layout.
  const fillNative = fillContainer && !isWeb;
  const effectiveContainerH = fillNative && measuredH > 0 ? measuredH : containerH;

  // Shared value for animated dots (native only)
  const x = useSharedValue(0);

  // Get scroll node (web only)
  const getScrollNode = useCallback(
    (): HTMLElement | null => findSliderNode('slider-scroll', sliderInstanceId),
    [sliderInstanceId]
  );

  // Get wrapper node (web only)
  const getWrapperNode = useCallback(
    (): HTMLElement | null => findSliderNode('slider-wrapper', sliderInstanceId),
    [sliderInstanceId]
  );

  // Mark node as ready once the web ScrollView DOM node mounts. containerW
  // becomes > 0 after layout, by which point the node exists in the DOM.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (nodeReady) return;
    if (getScrollNode()) setNodeReady(true);
  }, [getScrollNode, nodeReady, containerW]);

  // Sync container width from DOM (web only)
  const syncContainerWidthFromDom = useCallback(() => {
    if (Platform.OS !== 'web') return;
    const node = getWrapperNode();
    const w = node?.getBoundingClientRect?.()?.width ?? 0;
    if (!Number.isFinite(w) || w <= 0) return;
    if (Math.abs(containerWRef.current - w) > 4) {
      setContainerWidth(w);
      // Keep scroll aligned to the current index when width changes (prevents partial slide on first paint).
      const scrollNode = getScrollNode();
      if (scrollNode && !isDraggingRef.current) {
        const left = indexRef.current * w;
        if (Math.abs((scrollNode.scrollLeft || 0) - left) > 1) {
          const prevScrollBehavior = scrollNode.style.scrollBehavior;
          scrollNode.style.scrollBehavior = 'auto';
          scrollNode.classList.add('slider-snap-disabled');
          void scrollNode.offsetHeight;
          scrollNode.scrollLeft = left;
          requestAnimationFrame(() => {
            scrollNode.scrollLeft = left;
            scrollNode.classList.remove('slider-snap-disabled');
            scrollNode.style.scrollBehavior = prevScrollBehavior;
          });
        }
      }
    }
  }, [getScrollNode, getWrapperNode, containerWRef, indexRef, setContainerWidth]);

  // ResizeObserver for web
  useIsomorphicLayoutEffect(() => {
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
    [containerW, containerWRef, getScrollNode, images.length, reduceMotion, setActiveIndex, indexRef]
  );

  // Expose methods via ref
  useImperativeHandle(
    ref,
    (): SliderRef => ({
      scrollTo,
      next: () => {
        dismissSwipeHint();
        enablePrefetch();
        const target = (indexRef.current + 1) % Math.max(1, images.length);
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
      const { width: w, height: h } = e.nativeEvent.layout;
      setContainerWidth(w);
      if (fillNative && h > 0) {
        setMeasuredH((prev) => (Math.abs(prev - h) > 1 ? h : prev));
      }
    },
    [setContainerWidth, fillNative]
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
        const target = (indexRef.current + 1) % Math.max(1, images.length);
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
  }, [getScrollNode, dismissSwipeHint, enablePrefetch, indexRef, images.length, scrollTo, nodeReady]);

  // Mouse drag (web only)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const node = getScrollNode();
    if (!node) return;

    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      // Skip mouse drag on touch devices — let native scroll-snap handle it
      if ((e as any).sourceCapabilities?.firesTouchEvents) return;
      isDraggingRef.current = true;
      dragStartXRef.current = e.pageX;
      dragScrollLeftRef.current = node.scrollLeft;
      node.style.cursor = 'grabbing';
      node.style.scrollSnapType = 'none';
      node.style.userSelect = 'none';
    };

    // Coalesce scrollLeft writes to one per frame: multiple mousemove events
    // can fire within a single frame, and each synchronous scrollLeft write
    // forces layout. rAF batching keeps the drag visually identical (writes
    // are bounded by display refresh anyway) while avoiding layout thrashing.
    let pendingPageX = 0;
    let moveRaf: number | null = null;
    const flushMove = () => {
      moveRaf = null;
      const dx = pendingPageX - dragStartXRef.current;
      node.scrollLeft = dragScrollLeftRef.current - dx;
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      e.preventDefault();
      pendingPageX = e.pageX;
      if (moveRaf != null) return;
      moveRaf = requestAnimationFrame(flushMove);
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

    // Safari doesn't support 'scrollend' — use a scroll-idle fallback
    let scrollEndTimer: ReturnType<typeof setTimeout> | null = null;
    const supportsScrollEnd = 'onscrollend' in window;

    const onScrollForEnd = () => {
      if (supportsScrollEnd) return;
      if (scrollEndTimer) clearTimeout(scrollEndTimer);
      scrollEndTimer = setTimeout(onScrollEnd, 120);
    };

    node.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    node.addEventListener('mouseleave', onMouseLeave);
    if (supportsScrollEnd) {
      node.addEventListener('scrollend', onScrollEnd);
    }
    node.addEventListener('scroll', onScrollForEnd, { passive: true });
    return () => {
      node.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      node.removeEventListener('mouseleave', onMouseLeave);
      if (supportsScrollEnd) {
        node.removeEventListener('scrollend', onScrollEnd);
      }
      node.removeEventListener('scroll', onScrollForEnd);
      if (scrollEndTimer) clearTimeout(scrollEndTimer);
      if (moveRaf != null) cancelAnimationFrame(moveRaf);
    };
  }, [images.length, setActiveIndex, getScrollNode, containerWRef, indexRef, nodeReady]);

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
          slideHeight={effectiveContainerH}
          imagesLength={images.length}
          styles={styles}
          blurBackground={blurBackground}
          isActive={index === currentIndex}
          imageProps={imageProps}
          fit={fit}
          onFirstImageLoad={onFirstImageLoad}
          onImagePress={onImagePress}
          firstImagePreloaded={firstImagePreloaded}
          preloadPriority={Math.abs(index - currentIndex) <= Math.max(1, preloadCount)}
          contentAspectRatio={contentAspectRatio ?? aspectRatio}
        />
      );
    },
    [uriMap, containerW, effectiveContainerH, images.length, styles, blurBackground, currentIndex, imageProps, fit, onFirstImageLoad, onImagePress, firstImagePreloaded, preloadCount, contentAspectRatio, aspectRatio]
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
                    isActive={index === currentIndex}
                    imageProps={imageProps}
                    fit={fit}
                    onFirstImageLoad={onFirstImageLoad}
                    onImagePress={onImagePress}
                    firstImagePreloaded={firstImagePreloaded}
                    preloadPriority={Math.abs(index - currentIndex) <= Math.max(1, preloadCount)}
                    contentAspectRatio={contentAspectRatio ?? aspectRatio}
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
          removeClippedSubviews={Platform.OS === 'ios'}
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
    <View style={[styles.sliderStack, fillNative && { flex: 1, alignSelf: 'stretch' }]} testID="slider-stack">
      <View
        ref={wrapperRef}
        testID="slider-wrapper"
        {...(isWeb ? { dataSet: { sliderInstance: sliderInstanceId } } as any : {})}
        {...(isWeb ? ({ tabIndex: 0 } as any) : {})}
        onLayout={onLayout}
        style={[
          styles.wrapper,
          fillNative ? { flex: 1, width: '100%' } : { height: containerH },
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

        <SliderOverlays
          images={images}
          styles={styles}
          colors={colors}
          currentIndex={currentIndex}
          containerW={containerW}
          reduceMotion={reduceMotion}
          x={x}
          showArrows={showArrows}
          showDots={showDots}
          hideArrowsOnMobile={hideArrowsOnMobile}
          isMobile={isMobile}
          isTablet={isTablet}
          insets={insets}
          navOffset={navOffset}
          dismissSwipeHint={dismissSwipeHint}
          enablePrefetch={enablePrefetch}
          goPrev={() => {
            const target = (indexRef.current - 1 + images.length) % Math.max(1, images.length);
            scrollTo(target);
          }}
          goNext={() => {
            const target = (indexRef.current + 1) % Math.max(1, images.length);
            scrollTo(target);
          }}
        />
      </View>
    </View>
  );
};

const UnifiedSlider = forwardRef(UnifiedSliderComponent);

export default memo(UnifiedSlider);
