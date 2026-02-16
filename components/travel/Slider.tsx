import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  forwardRef,
  useImperativeHandle,
} from "react";
import {
  View,
  StyleSheet,
  FlatList,
  LayoutChangeEvent,
  Text,
  AppState,
  AccessibilityInfo,
  Platform,
} from "react-native";
import { prefetchImage } from '@/components/ui/ImageCardMedia';
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  useAnimatedScrollHandler,
  useSharedValue,
} from "react-native-reanimated";
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';
import { useResponsive } from '@/hooks/useResponsive';
import type { SliderImage, SliderProps, SliderRef } from './sliderParts/types';
import {
  DEFAULT_AR,
  MOBILE_HEIGHT_PERCENT,
  clamp,
  clampInt,
  buildUriNative as buildUri,
  computeSliderHeight,
} from './sliderParts/utils';
import Arrow from './sliderParts/Arrow';
import Dot from './sliderParts/Dot';
import Slide from './sliderParts/Slide';

// Re-export types for consumers that import from '@/components/travel/Slider'
export type { SliderImage, SliderProps, SliderRef } from './sliderParts/types';

/* --------------------------------- Theme ----------------------------------- */

const useSliderTheme = () => {
  const colors = useThemedColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return { colors, styles };
};

/* --------------------------------- Slider ---------------------------------- */

const SliderComponent = (props: SliderProps, ref: React.Ref<SliderRef>) => {
  const { colors, styles } = useSliderTheme();
  const {
    images,
    showArrows = true,
    showDots = true,
    hideArrowsOnMobile,
    aspectRatio = DEFAULT_AR,
    autoPlay = true,
    autoPlayInterval = 6000,
    onIndexChanged,
    imageProps,
    preloadCount = 1,
    blurBackground = true,
    onFirstImageLoad,
    mobileHeightPercent = MOBILE_HEIGHT_PERCENT,
    onImagePress,
    firstImagePreloaded,
  } = props;

  const insets = useSafeAreaInsets();
  const { width: winW, height: winH, isPhone, isLargePhone } = useResponsive();
  const isMobile = isPhone || isLargePhone;

  const isTestEnv = process.env.NODE_ENV === 'test';
  const isWeb = Platform.OS === 'web';
  const canPrefetchOnWeb = useMemo(() => {
    if (Platform.OS !== 'web') return true;
    if (isMobile) return false;
    if (typeof navigator === 'undefined') return false;
    const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
    if (connection?.saveData) return false;
    const effectiveType = String(connection?.effectiveType || '').toLowerCase();
    if (effectiveType.includes('2g') || effectiveType === '3g') return false;
    return true;
  }, [isMobile]);

  const [containerW, setContainerW] = useState(winW);
  const containerWRef = useRef(winW);
  const listRef = useRef<FlatList<SliderImage>>(null);

  const indexRef = useRef(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showSwipeHint, setShowSwipeHint] = useState(images.length > 1);
  const prefetchEnabledRef = useRef(Platform.OS !== 'web');

  useEffect(() => {
    setShowSwipeHint(images.length > 1);
    prefetchEnabledRef.current = Platform.OS !== 'web';
  }, [images]);

  const dismissSwipeHint = useCallback(() => setShowSwipeHint(false), []);
  useEffect(() => {
    if (!showSwipeHint) return;
    const timer = setTimeout(() => setShowSwipeHint(false), 6500);
    return () => clearTimeout(timer);
  }, [showSwipeHint]);

  const firstAR = useMemo(() => {
    const f = images[0];
    return f?.width && f?.height ? f.width / f.height : aspectRatio;
  }, [images, aspectRatio]);

  const computeHeight = useCallback(
    (w: number) =>
      computeSliderHeight(w, {
        imagesLength: images.length,
        isMobile,
        winH,
        insetsTop: insets.top || 0,
        insetsBottom: insets.bottom || 0,
        mobileHeightPercent,
        firstAR,
      }),
    [firstAR, images.length, insets.bottom, insets.top, isMobile, winH, mobileHeightPercent]
  );

  const containerH = useMemo(() => computeHeight(containerW), [computeHeight, containerW]);

  const uriMap = useMemo(
    () =>
      images.map((img, idx) =>
        buildUri(img, containerW, containerH, idx === 0)
      ),
    [images, containerW, containerH]
  );

  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => {
      if (active) setReduceMotion(!!v);
    });
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", (v) =>
      setReduceMotion(!!v)
    );
    return () => {
      // @ts-ignore
      sub?.remove?.();
      active = false;
    };
  }, []);

  const warmNeighbors = useCallback(
    (idx: number) => {
      if (!prefetchEnabledRef.current) return;
      if (!preloadCount) return;
      for (let d = -preloadCount; d <= preloadCount; d++) {
        if (d === 0) continue;
        const t = idx + d;
        if (t < 0 || t >= images.length) continue;
        const u = uriMap[t];
        prefetchImage(u).catch((error) => {
          if (__DEV__) {
            console.warn('[Slider] Ошибка прелоадинга изображения:', error);
          }
        });
      }
    },
    [images.length, preloadCount, uriMap]
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

  const appState = useRef(AppState.currentState);
  const pausedByAppState = useRef(false);
  const pausedByTouch = useRef(false);
  const autoplayTimer = useRef<number | null>(null);

  const autoplayAllowed = autoPlay && !isMobile && Platform.OS !== "web";

  const canAutoplay = useCallback(() => {
    return (
      autoplayAllowed &&
      images.length > 1 &&
      !reduceMotion &&
      !pausedByAppState.current &&
      !pausedByTouch.current
    );
  }, [autoplayAllowed, images.length, reduceMotion]);

  const clearAutoplay = useCallback(() => {
    if (autoplayTimer.current != null) {
      clearInterval(autoplayTimer.current);
      autoplayTimer.current = null;
    }
  }, []);

  const next = useCallback(() => {
    dismissSwipeHint();
    if (!images.length) return;
    const target = (indexRef.current + 1) % images.length;
    listRef.current?.scrollToOffset({
      offset: target * containerW,
      animated: !reduceMotion,
    });
    setActiveIndex(target);
  }, [images.length, containerW, reduceMotion, dismissSwipeHint, setActiveIndex]);

  const scheduleAutoplay = useCallback(() => {
    clearAutoplay();
    if (!canAutoplay()) return;
    autoplayTimer.current = setInterval(() => {
      next();
    }, Math.max(2500, autoPlayInterval)) as unknown as number;
  }, [autoPlayInterval, canAutoplay, clearAutoplay, next]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => {
      const wasBg = appState.current.match(/inactive|background/);
      appState.current = s;
      if (s === "active" && wasBg) {
        pausedByAppState.current = false;
        scheduleAutoplay();
      } else if (s !== "active") {
        pausedByAppState.current = true;
        clearAutoplay();
      }
    });
    return () => {
      // @ts-ignore
      sub?.remove?.();
    };
  }, [scheduleAutoplay, clearAutoplay]);

  useEffect(() => {
    scheduleAutoplay();
    return clearAutoplay;
  }, [scheduleAutoplay, clearAutoplay]);

  const x = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      x.value = e.contentOffset.x;
    },
  });

  const onMomentumScrollEnd = useCallback(
    (e: any) => {
      const offsetX = e?.nativeEvent?.contentOffset?.x ?? 0;
      setActiveIndexFromOffset(offsetX);
    },
    [setActiveIndexFromOffset]
  );

  const scrollTo = useCallback(
    (i: number, animated = !reduceMotion) => {
      const wrapped = clamp(i, 0, images.length - 1);
      listRef.current?.scrollToOffset({
        offset: wrapped * containerW,
        animated,
      });
      setActiveIndex(wrapped);
    },
    [containerW, images.length, reduceMotion, setActiveIndex]
  );

  const prev = useCallback(() => {
    dismissSwipeHint();
    if (!images.length) return;
    const target = (indexRef.current - 1 + images.length) % Math.max(1, images.length);
    scrollTo(target);
  }, [images.length, scrollTo, dismissSwipeHint]);

  useImperativeHandle(
    ref,
    (): SliderRef => ({
      scrollTo,
      next,
      prev,
    }),
    [scrollTo, next, prev]
  );

  const onLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const w = e.nativeEvent.layout.width;
      if (Math.abs(w - containerWRef.current) > 2) {
        containerWRef.current = w;
        setContainerW(w);
      }
    },
    []
  );

  useEffect(() => {
    if (!images.length || !prefetchEnabledRef.current) return;

    let timer: ReturnType<typeof setTimeout> | null = null;

    if (Platform.OS === "web") {
      timer = setTimeout(() => warmNeighbors(0), 200);
    } else {
      warmNeighbors(0);
    }

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [images.length, warmNeighbors]);

  const keyExtractor = useCallback((it: SliderImage) => String(it.id), []);
  const getItemLayout = useCallback(
    (_: any, i: number) => ({
      length: containerW,
      offset: containerW * i,
      index: i,
    }),
    [containerW]
  );

  const setActiveIndexRef = useRef(setActiveIndex);
  setActiveIndexRef.current = setActiveIndex;

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: Array<{ index: number | null }> }) => {
      const first = viewableItems.find((v) => v.index != null);
      if (first && typeof first.index === "number") {
        const idx = first.index;
        if (indexRef.current !== idx) setActiveIndexRef.current(idx);
      }
    }
  ).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 90,
    minimumViewTime: 80,
  }).current;

  const renderItem = useCallback(
    ({ item, index }: { item: SliderImage; index: number }) => {
      const uri = uriMap[index] ?? item.url;
      const slideHeight = containerH ?? computeHeight(containerW);

      return (
        <Slide
          item={item}
          index={index}
          uri={uri}
          containerW={containerW}
          slideHeight={slideHeight}
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
    [
      uriMap,
      blurBackground,
      containerW,
      containerH,
      computeHeight,
      onFirstImageLoad,
      onImagePress,
      imageProps,
      images.length,
      styles,
      firstImagePreloaded,
    ]
  );

  if (!images.length) return null;

  return (
    <View style={styles.sliderStack}>
      <View
        onLayout={onLayout}
        style={[
          styles.wrapper,
          { height: containerH },
          isMobile && styles.wrapperMobile,
        ]}
      >
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
            renderItem={renderItem}
            initialNumToRender={isTestEnv ? images.length : (isWeb ? 1 : 2)}
            windowSize={isTestEnv ? images.length : (isWeb ? 3 : 5)}
            maxToRenderPerBatch={isTestEnv ? images.length : (isWeb ? 1 : 3)}
            disableVirtualization={isTestEnv}
            maintainVisibleContentPosition={Platform.OS === "ios" ? undefined : { minIndexForVisible: 0 }}
            disableIntervalMomentum
            getItemLayout={getItemLayout}
            bounces={false}
            decelerationRate={Platform.OS === "ios" ? "fast" : 0.98}
            removeClippedSubviews={!isWeb}
            updateCellsBatchingPeriod={isTestEnv ? 0 : 50}
            initialScrollIndex={isTestEnv ? undefined : indexRef.current || 0}
            onScrollBeginDrag={() => {
              pausedByTouch.current = true;
              clearAutoplay();
              dismissSwipeHint();
              if (Platform.OS !== 'web') return;
              if (!prefetchEnabledRef.current && canPrefetchOnWeb) {
                prefetchEnabledRef.current = true;
              }
            }}
            onScrollEndDrag={() => {
              pausedByTouch.current = false;
              scheduleAutoplay();
            }}
            onMomentumScrollEnd={onMomentumScrollEnd}
            onViewableItemsChanged={onViewableItemsChanged}
            viewabilityConfig={viewabilityConfig}
          />
        </View>

        {showArrows && images.length > 1 && (
          <>
            <Arrow
              dir="left"
              onPress={prev}
              isMobile={isMobile}
              hideArrowsOnMobile={hideArrowsOnMobile}
              insets={insets}
              dismissSwipeHint={dismissSwipeHint}
              colors={colors}
              styles={styles}
            />
            <Arrow
              dir="right"
              onPress={next}
              isMobile={isMobile}
              hideArrowsOnMobile={hideArrowsOnMobile}
              insets={insets}
              dismissSwipeHint={dismissSwipeHint}
              colors={colors}
              styles={styles}
            />
          </>
        )}

        {/* Instagram-style 1/N counter */}
        {images.length > 1 && (
          <View
            style={[styles.counter, isMobile && styles.counterMobile, { pointerEvents: 'none' }]}
          >
            <View style={styles.counterContainer}>
              <Text style={styles.counterText}>
                {currentIndex + 1}/{images.length}
              </Text>
            </View>
          </View>
        )}

        {/* Instagram-style pagination dots */}
        {showDots && images.length > 1 && (
          <View style={[styles.dots, isMobile && styles.dotsMobile, { pointerEvents: 'none' }]}>
            <View style={styles.dotsContainer}>
              {images.map((_, i) => (
                <View key={i} style={styles.dotWrap}>
                  <Dot i={i} x={x} containerW={containerW} total={images.length} reduceMotion={reduceMotion} dotStyle={styles.dot} />
                </View>
              ))}
            </View>
          </View>
        )}
      </View>
    </View>
  );
};

const Slider = forwardRef(SliderComponent);

export default memo(Slider);

/* --------------------------------- Styles ---------------------------------- */

const DOT_SIZE = 6;

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create<Record<string, any>>({
  sliderStack: {
    width: "100%",
  },
  wrapper: {
    width: "100%",
    backgroundColor: "transparent",
    position: "relative",
    borderRadius: DESIGN_TOKENS.radii.md,
    borderWidth: 0,
    borderColor: "transparent",
  },
  wrapperMobile: {
    borderRadius: DESIGN_TOKENS.radii.md,
    marginVertical: 8,
  },
  clip: {
    flex: 1,
    overflow: 'hidden',
    borderRadius: DESIGN_TOKENS.radii.md,
    backgroundColor: "transparent",
    ...Platform.select<any>({
      web: { willChange: 'transform', contain: 'paint' },
      default: {},
    }),
  },
  clipMobile: {
    borderRadius: DESIGN_TOKENS.radii.md,
  },
  slide: {
    flex: 1,
    position: "relative",
    backgroundColor: "transparent",
    ...Platform.select<any>({
      web: { contain: 'content', willChange: 'transform' },
      default: {},
    }),
  },
  blurBg: {
    ...StyleSheet.absoluteFillObject,
  },
  flatBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#1a1a1a',
  },
  img: {
    width: "100%",
    height: "100%",
    borderRadius: 0,
  },
  neutralPlaceholder: {
    width: "100%",
    height: "100%",
    borderRadius: 0,
    backgroundColor: colors.backgroundSecondary,
  },
  navBtn: {
    position: "absolute",
    top: "50%",
    marginTop: -24,
    backgroundColor: colors.overlayLight,
    borderWidth: 1,
    borderColor: colors.borderLight,
    width: 48,
    height: 48,
    borderRadius: 24,
    zIndex: 50,
    justifyContent: "center",
    alignItems: "center",
    ...Platform.select<any>({
      web: {
        cursor: "pointer",
        transition: "background-color 0.2s ease",
        backdropFilter: "blur(12px)",
        contain: "layout",
      },
    }),
  },
  navBtnDesktop: {
    width: 48,
    height: 48,
  },
  navBtnMobile: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.overlayLight,
  },
  navBtnHover: {
    backgroundColor: colors.surface,
  },
  arrowIconContainer: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  arrowIcon: {},
  dots: {
    position: "absolute",
    bottom: 16,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: DESIGN_TOKENS.zIndex.fixed,
  },
  dotsMobile: {
    bottom: 12,
  },
  dotsContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.overlayLight,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...Platform.select({
      web: {
        backdropFilter: "blur(8px)",
      },
    }),
  },
  dotWrap: {
    paddingHorizontal: 4,
    paddingVertical: DESIGN_TOKENS.spacing.xs,
  },
  dot: {
    backgroundColor: colors.textMuted,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    ...Platform.select({
      web: {
        transition: "width 0.25s ease, opacity 0.25s ease",
      },
    }),
  },
  counter: {
    position: "absolute",
    top: 16,
    left: 16,
    zIndex: DESIGN_TOKENS.zIndex.fixed,
    ...Platform.select({
      web: {
        top: 16,
        left: 16,
      },
    }),
  },
  counterMobile: {
    top: 12,
    left: 12,
  },
  counterContainer: {
    backgroundColor: colors.overlayLight,
    paddingHorizontal: 12,
    paddingVertical: DESIGN_TOKENS.spacing.xs,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...Platform.select({
      web: {
        backdropFilter: "blur(8px)",
      },
    }),
  },
  counterText: {
    color: colors.text,
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    fontWeight: "600",
    fontFamily: Platform.OS === "web" ? "system-ui, -apple-system" : undefined,
    letterSpacing: 0.5,
  },
});
