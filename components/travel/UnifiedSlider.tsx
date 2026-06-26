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
import {
  buildNativeLoopData,
  getNativeLoopPageOffset,
  shouldEnableNativeLoop,
  toNativeLoopRawIndex,
  toNativeLoopRealIndex,
} from './sliderParts/nativeLoop';

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
    preloadCount: preloadCountProp = 1,
    blurBackground = true,
    onFirstImageLoad,
    mobileHeightPercent,
    onImagePress,
    firstImagePreloaded,
    fillContainer = false,
  } = props;

  const sliderInstanceId = useId();
  const nativePreloadCount = isWeb ? preloadCountProp : Math.max(preloadCountProp, 2);

  // Use the unified logic hook
  const logic = useSliderLogic({
    images,
    aspectRatio,
    autoPlay,
    autoPlayInterval,
    preloadCount: nativePreloadCount,
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
    hasMeasuredWidth,
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
  const nativeInitialLoopAlignmentDoneRef = useRef(false);
  const nativeInitialLoopAlignmentFrameRef = useRef<number | null>(null);
  const nativeLoopImagesLengthRef = useRef(images.length);

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

  // Seamless infinite loop (native only). When there is more than one image we
  // render a clone of the last image before the first and a clone of the first
  // after the last, so a swipe past either edge lands on a clone and is then
  // silently recentered onto the matching real slide. Raw indices live in
  // [0, n+1]; real indices live in [0, n-1]. Web keeps its own implementation.
  const loopEnabled = shouldEnableNativeLoop({
    isWeb,
    isTestEnv,
    imagesLength: images.length,
  });
  const loopData = useMemo<SliderImage[]>(() => {
    return buildNativeLoopData(images, loopEnabled);
  }, [images, loopEnabled]);

  const toRealIndex = useCallback(
    (rawIndex: number) => {
      return toNativeLoopRealIndex(rawIndex, images.length, loopEnabled);
    },
    [loopEnabled, images.length]
  );

  const toRawIndex = useCallback(
    (realIndex: number) => toNativeLoopRawIndex(realIndex, loopEnabled),
    [loopEnabled]
  );

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
          offset: toRawIndex(wrapped) * containerW,
          animated,
        });
        setActiveIndex(wrapped);
      }
    },
    [containerW, containerWRef, getScrollNode, images.length, reduceMotion, setActiveIndex, indexRef, toRawIndex]
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
      if (!loopEnabled || nativeInitialLoopAlignmentDoneRef.current || w <= 0) return;
      nativeInitialLoopAlignmentDoneRef.current = true;
      if (
        nativeInitialLoopAlignmentFrameRef.current != null &&
        typeof cancelAnimationFrame === 'function'
      ) {
        cancelAnimationFrame(nativeInitialLoopAlignmentFrameRef.current);
      }
      const align = () => {
        const liveWidth = containerWRef.current || w;
        listRef.current?.scrollToOffset({
          offset: getNativeLoopPageOffset({
            realIndex: indexRef.current,
            pageWidth: liveWidth,
            loopEnabled,
          }),
          animated: false,
        });
      };
      if (typeof requestAnimationFrame === 'function') {
        nativeInitialLoopAlignmentFrameRef.current = requestAnimationFrame(align);
      } else {
        align();
      }
    },
    [setContainerWidth, fillNative, loopEnabled, containerWRef, indexRef]
  );

  useEffect(() => {
    if (nativeLoopImagesLengthRef.current === images.length) return;
    nativeLoopImagesLengthRef.current = images.length;
    nativeInitialLoopAlignmentDoneRef.current = false;
  }, [images.length]);

  useEffect(() => {
    return () => {
      if (
        nativeInitialLoopAlignmentFrameRef.current != null &&
        typeof cancelAnimationFrame === 'function'
      ) {
        cancelAnimationFrame(nativeInitialLoopAlignmentFrameRef.current);
      }
    };
  }, []);

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
      if (loopEnabled) {
        const liveWidth = containerWRef.current || containerW || 1;
        const rawIndex = Math.round(offsetX / liveWidth);
        const n = images.length;
        if (rawIndex <= 0) {
          // Clone of the last image — jump to the real last slide.
          listRef.current?.scrollToOffset({ offset: n * liveWidth, animated: false });
          setActiveIndex(n - 1);
          return;
        }
        if (rawIndex >= n + 1) {
          // Clone of the first image — jump to the real first slide.
          listRef.current?.scrollToOffset({ offset: liveWidth, animated: false });
          setActiveIndex(0);
          return;
        }
        setActiveIndex(toRealIndex(rawIndex));
        return;
      }
      setActiveIndexFromOffset(offsetX);
    },
    [setActiveIndexFromOffset, loopEnabled, containerWRef, containerW, images.length, setActiveIndex, toRealIndex]
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
        : // Native loop clones repeat ids (last/first appear twice), so key by the
          // raw position to keep every cell uniquely identified.
          `${String(it.id)}|${index}`,
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

  // Loop clones can be unmounted when scrollToIndex is requested; fall back to a
  // direct offset scroll so the recenter jump never throws.
  const onScrollToIndexFailed = useCallback(
    (info: { index: number; averageItemLength: number }) => {
      const liveWidth = containerWRef.current || containerW || info.averageItemLength || 1;
      listRef.current?.scrollToOffset({ offset: info.index * liveWidth, animated: false });
    },
    [containerW, containerWRef]
  );

  // Viewability (native only)
  const setActiveIndexRef = useRef(setActiveIndex);
  setActiveIndexRef.current = setActiveIndex;
  const toRealIndexRef = useRef(toRealIndex);
  toRealIndexRef.current = toRealIndex;

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: Array<{ index: number | null }> }) => {
      const first = viewableItems.find((v) => v.index != null);
      if (first && typeof first.index === 'number') {
        const realIdx = toRealIndexRef.current(first.index);
        if (indexRef.current !== realIdx) setActiveIndexRef.current(realIdx);
      }
    }
  ).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 90,
    minimumViewTime: 80,
  }).current;

  // Render item for native FlatList.
  // NOTE: deps intentionally exclude `currentIndex`. Reading it through
  // `indexRef.current` keeps the renderItem identity stable across swipes, so the
  // FlatList does not re-create every mounted cell on each page change. The active
  // slide still re-renders because `extraData={currentIndex}` on the list re-runs
  // renderItem for visible cells, and Slide's memo comparator reacts to `isActive`.
  const renderItemNative = useCallback(
    ({ item, index }: { item: SliderImage; index: number }) => {
      // `index` is the raw FlatList position (includes loop clones). Map to the
      // real index for URI lookup, active state and neighbor preloading.
      const realIndex = toRealIndex(index);
      const uri = uriMap[realIndex] ?? item.url;
      const activeIdx = indexRef.current;
      // Fabric fix: wrap each slide in a View with explicit page dimensions.
      // Without this intermediate sized container, off-screen-mounted slides in
      // the horizontal paging FlatList don't receive a correct layout pass when
      // they scroll into view — the ExpoImage decodes (onLoad fires, bitmap is in
      // memory) but paints nothing, leaving slides 2+ blank/black on Android.
      // The explicit-size wrapper forces a full shadow-node layout commit per cell.
      return (
        <View style={{ width: containerW, height: effectiveContainerH }}>
          <Slide
            item={item}
            index={realIndex}
            uri={uri}
            containerW={containerW}
            slideHeight={effectiveContainerH}
            imagesLength={images.length}
            styles={styles}
            blurBackground={blurBackground}
            isActive={realIndex === activeIdx}
            imageProps={imageProps}
            fit={fit}
            onFirstImageLoad={onFirstImageLoad}
            onImagePress={onImagePress}
            firstImagePreloaded={firstImagePreloaded}
            preloadPriority={Math.abs(realIndex - activeIdx) <= Math.max(1, nativePreloadCount)}
            prepareBlur={Math.abs(realIndex - activeIdx) <= 1}
            contentAspectRatio={contentAspectRatio ?? aspectRatio}
          />
        </View>
      );
    },
    [toRealIndex, uriMap, containerW, effectiveContainerH, images.length, styles, blurBackground, indexRef, imageProps, fit, onFirstImageLoad, onImagePress, firstImagePreloaded, nativePreloadCount, contentAspectRatio, aspectRatio]
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
                    prepareBlur={Math.abs(index - currentIndex) <= 1}
                    contentAspectRatio={contentAspectRatio ?? aspectRatio}
                  />
                </View>
              );
            })}
          </ScrollView>
        </View>
      );
    }

    // Native: gate the FlatList until the real container width is measured.
    // getItemLayout, initialScrollIndex and the initial loop page offset are all
    // derived from containerW; on the very first synchronous render containerW
    // still equals the window width, while the actual list content width is
    // window − 2px (the 1px border on each side of the hero's sliderContainer).
    // Rendering the list before measurement makes paging snap to the window step
    // while the content steps by window−2, so the first frame shows the next
    // slide bleeding in on the right until a manual swipe. Waiting for the first
    // onLayout measurement (always accepted by setContainerWidth) keeps every
    // offset computation consistent from the first painted frame. Web has its own
    // ScrollView branch and DOM-based width sync, so it is unaffected.
    if (!isTestEnv && !hasMeasuredWidth) {
      return <View style={[styles.clip, isMobile && styles.clipMobile]} />;
    }

    // Native: use Animated.FlatList
    return (
      <View style={[styles.clip, isMobile && styles.clipMobile]}>
        <Animated.FlatList
          testID="slider-native-list"
          ref={listRef}
          data={loopData}
          keyExtractor={keyExtractor}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={16}
          nestedScrollEnabled
          directionalLockEnabled
          alwaysBounceHorizontal={false}
          alwaysBounceVertical={false}
          renderItem={renderItemNative}
          extraData={currentIndex}
          initialNumToRender={isTestEnv ? loopData.length : Math.min(loopData.length, isMobile ? 5 : 7)}
          windowSize={isTestEnv ? loopData.length : isMobile ? 5 : 7}
          maxToRenderPerBatch={isTestEnv ? loopData.length : isMobile ? 5 : 7}
          disableVirtualization={isTestEnv}
          maintainVisibleContentPosition={Platform.OS === 'ios' ? undefined : { minIndexForVisible: 0 }}
          disableIntervalMomentum
          getItemLayout={getItemLayout}
          bounces={false}
          decelerationRate={Platform.OS === 'ios' ? 'fast' : 0.98}
          removeClippedSubviews={true}
          updateCellsBatchingPeriod={isTestEnv ? 0 : 16}
          initialScrollIndex={isTestEnv ? undefined : toRawIndex(indexRef.current || 0)}
          onScrollToIndexFailed={onScrollToIndexFailed}
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
          // When filling the hero container, the parent owns the vertical
          // spacing/height — the mobile/tablet marginVertical would otherwise
          // show as an empty gap above (and below) the photo.
          fillNative && { marginVertical: 0 },
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
