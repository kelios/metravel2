// components/common/Slider.tsx
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
  TouchableOpacity,
  LayoutChangeEvent,
  Text,
  AppState,
  AccessibilityInfo,
  Platform,
  ActivityIndicator,
} from "react-native";
import { Image as ExpoImage } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  useAnimatedScrollHandler,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
  interpolate,
  Extrapolate,
} from "react-native-reanimated";
// ✅ УЛУЧШЕНИЕ: Импорт утилит для оптимизации изображений
import { optimizeImageUrl, getOptimalImageSize, buildVersionedImageUrl } from "@/utils/imageOptimization";
import { Feather } from "@expo/vector-icons";
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useResponsive } from '@/hooks/useResponsive';

/* -------------------------------------------------------------------------- */
/*                                  Types                                     */
/* -------------------------------------------------------------------------- */

export interface SliderImage {
  url: string;
  id: number | string;
  updated_at?: string;
  width?: number;
  height?: number;
}

export interface SliderProps {
  images: SliderImage[];
  showArrows?: boolean;
  showDots?: boolean;
  hideArrowsOnMobile?: boolean;
  aspectRatio?: number;
  autoPlay?: boolean;
  autoPlayInterval?: number;
  onIndexChanged?: (index: number) => void;
  imageProps?: Partial<React.ComponentProps<typeof ExpoImage>>;
  preloadCount?: number;
  blurBackground?: boolean;
  onFirstImageLoad?: () => void;
  mobileHeightPercent?: number;
  neutralFirstSlideErrorPlaceholder?: boolean;
}

export interface SliderRef {
  scrollTo: (index: number, animated?: boolean) => void;
  next: () => void;
  prev: () => void;
}

type LoadStatus = "loading" | "loaded" | "error";

const Arrow = memo(function Arrow({
  dir,
  onPress,
  isMobile,
  hideArrowsOnMobile,
  insets,
  dismissSwipeHint,
}: {
  dir: "left" | "right";
  onPress: () => void;
  isMobile: boolean;
  hideArrowsOnMobile?: boolean;
  insets: { left: number; right: number };
  dismissSwipeHint: () => void;
}) {
  const arrowOpacity = useSharedValue(1);
  const arrowScale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: arrowOpacity.value,
    transform: [{ scale: arrowScale.value }],
  }));

  const handlePressIn = useCallback(() => {
    arrowOpacity.value = withSpring(0.7, { damping: 15 });
    arrowScale.value = withSpring(0.95, { damping: 15 });
  }, [arrowOpacity, arrowScale]);

  const handlePressOut = useCallback(() => {
    arrowOpacity.value = withSpring(1, { damping: 15 });
    arrowScale.value = withSpring(1, { damping: 15 });
  }, [arrowOpacity, arrowScale]);

  const [isHovered, setIsHovered] = useState(false);

  const handleHover = useCallback(
    (hover: boolean) => {
      if (Platform.OS === "web" && !isMobile) {
        setIsHovered(hover);
        if (hover) {
          arrowOpacity.value = withSpring(1, { damping: 15 });
          arrowScale.value = withSpring(1.1, { damping: 15 });
        } else {
          arrowOpacity.value = withSpring(1, { damping: 15 });
          arrowScale.value = withSpring(1, { damping: 15 });
        }
      }
    },
    [isMobile, arrowOpacity, arrowScale]
  );

  const iconSize = isMobile ? 20 : 24;

  if (isMobile && hideArrowsOnMobile) return null;

  return (
    <TouchableOpacity
      onPress={() => {
        dismissSwipeHint();
        onPress();
      }}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      // @ts-ignore - web-only props
      onMouseEnter={() => handleHover(true)}
      onMouseLeave={() => handleHover(false)}
      accessibilityRole="button"
      accessibilityLabel={dir === "left" ? "Previous slide" : "Next slide"}
      hitSlop={12}
      activeOpacity={0.8}
      style={[
        styles.navBtn,
        isMobile ? styles.navBtnMobile : styles.navBtnDesktop,
        dir === "left"
          ? { left: NAV_BTN_OFFSET + (isMobile ? 8 : insets.left) }
          : { right: NAV_BTN_OFFSET + (isMobile ? 8 : insets.right) },
        Platform.OS === "web" && isHovered && styles.navBtnHover,
      ]}
    >
      <Animated.View style={animatedStyle}>
        <View style={styles.arrowIconContainer}>
          <Feather
            name={dir === "left" ? "chevron-left" : "chevron-right"}
            size={iconSize}
            color="#ffffff"
            style={styles.arrowIcon}
          />
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
});

/* -------------------------------------------------------------------------- */

const DEFAULT_AR = 16 / 9;
const DOT_SIZE = 6;
const DOT_ACTIVE_SIZE = 24; // Увеличиваем для современного вида (широкая активная точка)
const NAV_BTN_OFFSET = 16;
const MOBILE_HEIGHT_PERCENT = 0.7;
const GLASS_BORDER = "rgba(255,255,255,0.35)";

const appendCacheBust = (uri: string, token: number) => {
  if (!token) return uri;
  const sep = uri.includes("?") ? "&" : "?";
  return `${uri}${sep}retry=${token}`;
};

const buildUri = (img: SliderImage, containerWidth?: number, containerHeight?: number, isFirst: boolean = false) => {
  const versionedUrl = buildVersionedImageUrl(img.url, img.updated_at, img.id);

  // ✅ УЛУЧШЕНИЕ: Оптимизация размера изображения для контейнера
  if (containerWidth && img.width && img.height) {
    const aspectRatio = img.width / img.height;
    const optimalSize = getOptimalImageSize(containerWidth, containerHeight, aspectRatio);

    // Не обрезаем изображение по высоте: сохраняем исходные пропорции, подстраиваясь только по ширине
    return (
      optimizeImageUrl(versionedUrl, {
        width: optimalSize.width,
        format: "webp",
        quality: isFirst ? 90 : 85, // Выше качество для первого изображения
        fit: "contain",
      }) || versionedUrl
    );
  }

  return versionedUrl;
};
const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));

/* ------------------------------ Dot component ------------------------------ */

const Dot = memo(function Dot({
                                i,
                                x,
                                containerW,
                                total,
                                reduceMotion,
                              }: {
  i: number;
  x: Animated.SharedValue<number>;
  containerW: number;
  total: number;
  reduceMotion: boolean;
}) {
  const style = useAnimatedStyle(() => {
    const scrollPosition = x.value;
    const currentIndex = scrollPosition / (containerW || 1);
    
    // Плавная интерполяция для активной точки
    const inputRange = [i - 1, i, i + 1];
    const outputRange = [DOT_SIZE, DOT_ACTIVE_SIZE, DOT_SIZE];
    
    const width = interpolate(
      currentIndex,
      inputRange,
      outputRange,
      Extrapolate.CLAMP
    );
    
    const opacity = interpolate(
      currentIndex,
      inputRange,
      [0.3, 1, 0.3],
      Extrapolate.CLAMP
    );
    
    return {
      width: reduceMotion ? (Math.abs(currentIndex - i) < 0.5 ? DOT_ACTIVE_SIZE : DOT_SIZE) : width,
      height: DOT_SIZE,
      opacity: reduceMotion ? (Math.abs(currentIndex - i) < 0.5 ? 1 : 0.3) : opacity,
      borderRadius: DOT_SIZE / 2,
    };
  }, [containerW, total, reduceMotion, i]);

  return <Animated.View style={[styles.dot, style]} />;
});

/* --------------------------------- Slider ---------------------------------- */

const Slider = forwardRef<SliderRef, SliderProps>((props, ref) => {
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
    neutralFirstSlideErrorPlaceholder = false,
  } = props;

  const insets = useSafeAreaInsets();
  const { width: winW, height: winH, isPhone, isLargePhone } = useResponsive();
  const isMobile = isPhone || isLargePhone;

  const [containerW, setContainerW] = useState(winW);
  const [containerH, setContainerH] = useState<number | null>(null);
  const listRef = useRef<FlatList<SliderImage>>(null);

  const indexRef = useRef(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  // ✅ УЛУЧШЕНИЕ: Состояние для текущего индекса (для счетчика)
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loadStatuses, setLoadStatuses] = useState<LoadStatus[]>(() =>
    images.map(() => "loading")
  );
  const [retryTokens, setRetryTokens] = useState<number[]>(() => images.map(() => 0));
  const [showSwipeHint, setShowSwipeHint] = useState(images.length > 1);
  const [prefetchEnabled, setPrefetchEnabled] = useState(Platform.OS !== "web");

  useEffect(() => {
    setLoadStatuses(images.map(() => "loading"));
    setRetryTokens(images.map(() => 0));
    setShowSwipeHint(images.length > 1);
    setPrefetchEnabled(Platform.OS !== "web");
  }, [images]);

  const updateLoadStatus = useCallback((idx: number, status: LoadStatus) => {
    setLoadStatuses((prev) => {
      if (prev[idx] === status) return prev;
      const next = [...prev];
      next[idx] = status;
      return next;
    });
  }, []);

  const retryImage = useCallback(
    (idx: number) => {
      setRetryTokens((prev) => {
        const next = [...prev];
        next[idx] = (next[idx] ?? 0) + 1;
        return next;
      });
      updateLoadStatus(idx, "loading");
      if (idx === 0) {
        onFirstImageLoad?.();
        if (!prefetchEnabled) {
          setPrefetchEnabled(true);
        }
      }
    },
    [onFirstImageLoad, prefetchEnabled, updateLoadStatus]
  );
  const dismissSwipeHint = useCallback(() => setShowSwipeHint(false), []);
  useEffect(() => {
    if (!showSwipeHint) return;
    const timer = setTimeout(() => setShowSwipeHint(false), 6500);
    return () => clearTimeout(timer);
  }, [showSwipeHint]);

  // Сначала вычисляем firstAR, так как он нужен для computeHeight
  const firstAR = useMemo(() => {
    const f = images[0];
    return f?.width && f?.height ? f.width / f.height : aspectRatio;
  }, [images, aspectRatio]);

  // Затем вычисляем computeHeight, так как он нужен для uriMap
  const computeHeight = useCallback(
    (w: number) => {
      if (!images.length) return 0;
      if (isMobile) {
        const mobileHeight = winH * mobileHeightPercent;
        return clamp(mobileHeight, 200, winH * 0.8);
      } else {
        const h = w / firstAR;
        return clamp(h, 320, 640);
      }
    },
    [firstAR, images.length, isMobile, winH, mobileHeightPercent]
  );

  // ✅ УЛУЧШЕНИЕ: Оптимизированные URL изображений с учетом размеров контейнера
  // Теперь computeHeight доступен, так как определен выше
  const uriMap = useMemo(
    () =>
      images.map((img, idx) => {
        const base = buildUri(
          img,
          containerW,
          containerH ?? computeHeight(containerW),
          idx === 0
        );
        return appendCacheBust(base, retryTokens[idx] ?? 0);
      }),
    [images, containerW, containerH, computeHeight, retryTokens]
  );

  // начальная высота по AR, потом обновляется при layout
  useEffect(() => {
    setContainerH(computeHeight(containerW));
  }, [containerW, computeHeight]);

  // reduce motion из ОС
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

  // прогрев соседних изображений
  const effectivePreload = prefetchEnabled ? preloadCount : 0;

  const warmNeighbors = useCallback(
    (idx: number) => {
      if (effectivePreload <= 0) return;
      for (let d = -effectivePreload; d <= effectivePreload; d++) {
        const t = idx + d;
        if (t < 0 || t >= images.length) continue;
        const u = uriMap[t];
        ExpoImage.prefetch?.(u).catch(() => {});
      }
    },
    [images.length, effectivePreload, uriMap]
  );

  // автоплей
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
    indexRef.current = target;
    setCurrentIndex((prev) => (prev === target ? prev : target));
    // программный скролл
    listRef.current?.scrollToOffset({
      offset: target * containerW,
      animated: !reduceMotion,
    });
  }, [images.length, containerW, reduceMotion, dismissSwipeHint]);

  const scheduleAutoplay = useCallback(() => {
    clearAutoplay();
    if (!canAutoplay()) return;
    autoplayTimer.current = setInterval(() => {
      runOnJS(next)();
    }, Math.max(2500, autoPlayInterval)) as unknown as number;
  }, [autoPlayInterval, canAutoplay, clearAutoplay, next]);

  // жизненный цикл приложения
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

  // скролл синх
  const x = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      x.value = e.contentOffset.x;
    },
  });

  // imperative API
  const scrollTo = useCallback(
    (i: number, animated = !reduceMotion) => {
      const wrapped = clamp(i, 0, images.length - 1);
      listRef.current?.scrollToOffset({
        offset: wrapped * containerW,
        animated,
      });
      indexRef.current = wrapped;
      setCurrentIndex((prev) => (prev === wrapped ? prev : wrapped));
      warmNeighbors(wrapped);
      onIndexChanged?.(wrapped);
    },
    [containerW, images.length, onIndexChanged, reduceMotion, warmNeighbors]
  );

  const prev = useCallback(() => {
    dismissSwipeHint();
    if (!images.length) return;
    const target = (indexRef.current - 1 + images.length) % Math.max(1, images.length);
    indexRef.current = target;
    setCurrentIndex((p) => (p === target ? p : target));
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
      if (Math.abs(w - containerW) > 2) setContainerW(w);
    },
    [containerW]
  );

  // прогреть стартовые (отложено для улучшения LCP)
  useEffect(() => {
    if (!images.length || !prefetchEnabled) return;
    // Первое изображение уже загружается с high priority, остальные откладываем
    if (Platform.OS === "web") {
      const timer = setTimeout(() => warmNeighbors(0), 200);
      return () => clearTimeout(timer);
    }
    warmNeighbors(0);
  }, [images.length, warmNeighbors, prefetchEnabled]);

  const keyExtractor = useCallback((it: SliderImage) => String(it.id), []);
  const getItemLayout = useCallback(
    (_: any, i: number) => ({
      length: containerW,
      offset: containerW * i,
      index: i,
    }),
    [containerW]
  );

  // надёжный апдейт текущего индекса
  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: Array<{ index: number | null }> }) => {
      const first = viewableItems.find((v) => v.index != null);
      if (first && typeof first.index === "number") {
        const idx = first.index;
        if (indexRef.current !== idx) {
          indexRef.current = idx;
          setCurrentIndex((prev) => (prev === idx ? prev : idx));
          onIndexChanged?.(idx);
          warmNeighbors(idx);
        }
      }
    }
  ).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 60,
    minimumViewTime: 50,
  }).current;

  const renderItem = useCallback(
    ({ item, index }: { item: SliderImage; index: number }) => {
      const uri = uriMap[index];
      const ratio =
        item.width && item.height ? item.width / item.height : aspectRatio;
      const isPortrait = ratio < 0.95;
      const isSquareish = ratio >= 0.95 && ratio <= 1.1;
      // Фон всегда та же фотография, растянутая и заблюренная, если blurBackground включен

      const shouldBlur = blurBackground;
      const slideHeight = containerH ?? computeHeight(containerW);
      const status = loadStatuses[index] ?? "loading";
      const isFirstSlide = index === 0;
      const mainPriority = isFirstSlide ? "high" : "low";
      const shouldRenderBlurBg =
        shouldBlur &&
        !(Platform.OS === "web" && isFirstSlide && status !== "loaded");

      return (
        <View style={[styles.slide, { width: containerW, height: slideHeight }]}> 
          {shouldRenderBlurBg ? (
            <>
              <ExpoImage
                testID={`slider-blur-bg-${index}`}
                source={{ uri }}
                style={styles.blurBg}
                contentFit="cover"
                cachePolicy="disk"
                priority="low"
                blurRadius={12}
              />
              <View style={styles.blurOverlay} />
            </>
          ) : (
            <View style={styles.flatBackground} testID={`slider-flat-bg-${index}`} />
          )}

          <View
            style={[
              styles.imageCardWrapper,
              (isPortrait || isSquareish) && styles.imageCardWrapperElevated,
            ]}
          >
            <View style={styles.imageCardSurface}>
              {status === "error" ? (
                neutralFirstSlideErrorPlaceholder && isFirstSlide ? (
                  <View
                    style={styles.neutralPlaceholder}
                    testID={`slider-neutral-placeholder-${index}`}
                  />
                ) : (
                  <View style={styles.placeholder} testID={`slider-placeholder-${index}`}>
                    <Feather name="image" size={32} color="#94a3b8" />
                    <Text style={styles.placeholderTitle}>Фото не загрузилось</Text>
                    <Text style={styles.placeholderSubtitle}>
                      Проверьте подключение или попробуйте позже
                    </Text>
                    <TouchableOpacity
                      onPress={() => retryImage(index)}
                      style={styles.retryBtn}
                      accessibilityRole="button"
                      accessibilityLabel="Повторить загрузку фото"
                      hitSlop={10}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.retryBtnText}>Повторить</Text>
                    </TouchableOpacity>
                  </View>
                )
              ) : (
                <ExpoImage
                  testID={`slider-image-${index}`}
                  source={{ uri }}
                  style={styles.img}
                  // Сохраняем оригинальные пропорции без обрезки, пустые области заполняет размытый фон
                  contentFit="contain"
                  cachePolicy="disk"
                  priority={mainPriority as any}
                  transition={reduceMotion ? 0 : 250}
                  contentPosition="center"
                  accessibilityIgnoresInvertColors
                  accessibilityRole="image"
                  accessibilityLabel={
                    item.width && item.height
                      ? `Изображение ${index + 1} из ${images.length}`
                      : `Фотография путешествия ${index + 1} из ${images.length}`
                  }
                  onLoad={() => {
                    updateLoadStatus(index, "loaded");
                    if (index === 0) {
                      onFirstImageLoad?.();
                      if (!prefetchEnabled) {
                        setPrefetchEnabled(true);
                      }
                    }
                  }}
                  onLoadStart={() => updateLoadStatus(index, "loading")}
                  onError={() => updateLoadStatus(index, "error")}
                  {...imageProps}
                />
              )}

              {status === "loading" && (
                <View
                  style={[
                    styles.loadingOverlay,
                  ]}
                  testID={`slider-loading-overlay-${index}`}
                >
                  <ActivityIndicator color="#0f172a" />
                </View>
              )}
            </View>
          </View>
        </View>
      );
    },
    [
      uriMap,
      blurBackground,
      containerW,
      containerH,
      computeHeight,
      onFirstImageLoad,
      imageProps,
      reduceMotion,
      images.length,
      loadStatuses,
      aspectRatio,
      updateLoadStatus,
      retryImage,
      prefetchEnabled,
      neutralFirstSlideErrorPlaceholder,
    ]
  );

  if (!images.length) return null;

  return (
    <View style={styles.sliderStack}>
      <View
        onLayout={onLayout}
        style={[
          styles.wrapper,
          { height: containerH ?? computeHeight(containerW) },
          isMobile && styles.wrapperMobile,
        ]}
      >
        <Animated.FlatList
          ref={listRef}
          data={images}
          keyExtractor={keyExtractor}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={Platform.OS === "web" ? 32 : 16}
          renderItem={renderItem}
          initialNumToRender={1}
          windowSize={2 + Math.max(0, effectivePreload)}
          maxToRenderPerBatch={1 + Math.max(0, effectivePreload)}
          maintainVisibleContentPosition={Platform.OS === "ios" ? undefined : { minIndexForVisible: 0 }}
          disableIntervalMomentum
          getItemLayout={getItemLayout}
          bounces={false}
          decelerationRate={Platform.OS === "ios" ? "fast" : 0.98}
          onScrollBeginDrag={() => {
            pausedByTouch.current = true;
            clearAutoplay();
            dismissSwipeHint();
            if (!prefetchEnabled) {
              setPrefetchEnabled(true);
            }
          }}
          onScrollEndDrag={() => {
            pausedByTouch.current = false;
            scheduleAutoplay();
          }}
          onMomentumScrollEnd={() => {
            const idx = Math.round((x.value || 0) / (containerW || 1));
            if (Number.isFinite(idx)) {
              const clampedIdx = clamp(idx, 0, images.length - 1);
              indexRef.current = clampedIdx;
              setCurrentIndex((prev) => (prev === clampedIdx ? prev : clampedIdx));
            }
          }}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
        />
        {showArrows && images.length > 1 && (
          <>
            <Arrow
              dir="left"
              onPress={prev}
              isMobile={isMobile}
              hideArrowsOnMobile={hideArrowsOnMobile}
              insets={insets}
              dismissSwipeHint={dismissSwipeHint}
            />
            <Arrow
              dir="right"
              onPress={next}
              isMobile={isMobile}
              hideArrowsOnMobile={hideArrowsOnMobile}
              insets={insets}
              dismissSwipeHint={dismissSwipeHint}
            />
          </>
        )}

        {/* Instagram-style 1/N counter */}
        {images.length > 1 && (
          <View
            style={[
              styles.counter,
              isMobile && styles.counterMobile,
            ]}
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
          <View
            style={[
              styles.dots,
              isMobile && styles.dotsMobile,
            ]}
          >
            <View style={styles.dotsContainer}>
              {images.map((_, i) => (
                <View key={i} style={styles.dotWrap}>
                  <Dot
                    i={i}
                    x={x}
                    containerW={containerW}
                    total={images.length}
                    reduceMotion={reduceMotion}
                  />
                </View>
              ))}
            </View>
          </View>
        )}
      </View>
    </View>
  );
});

export default memo(Slider);

/* --------------------------------- Styles ---------------------------------- */

const styles = StyleSheet.create<Record<string, any>>({
  sliderStack: {
    width: "100%",
  },
  wrapper: {
    width: "100%",
    backgroundColor: "transparent",
    position: "relative",
    overflow: "hidden",
    borderRadius: 12,
    borderWidth: 0,
    borderColor: "transparent",
    ...Platform.select({
      web: {
        boxShadow: "0 25px 60px rgba(15,23,42,0.12)",
        backdropFilter: "blur(26px)",
      },
      android: {
        elevation: 8,
      },
    }),
  },
  wrapperMobile: {
    borderRadius: 16,
    marginVertical: 8,
  },
  slide: {
    flex: 1,
    position: "relative",
    overflow: "hidden",
    backgroundColor: "transparent",
  },
  blurBg: {
    ...StyleSheet.absoluteFillObject,
  },
  blurOverlay: {
    ...StyleSheet.absoluteFillObject,
    // Более лёгкая вуаль, чтобы был виден реальный блюр фото, а не плоский белый фон
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  flatBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(248,250,252,0.9)",
    ...Platform.select({
      web: {
        backgroundImage:
          "linear-gradient(135deg, rgba(255,255,255,0.85) 0%, rgba(229,235,241,0.75) 100%)",
      },
    }),
  },
  imageCardWrapper: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    // Без внутренних отступов: фото идёт от края до края внутри слайдера
    paddingHorizontal: 0,
    paddingVertical: 0,
    alignSelf: "stretch",
    maxWidth: 1280,
    width: "100%",
  },
  imageCardWrapperElevated: {
    ...Platform.select({
      web: {
        filter: "drop-shadow(0 25px 45px rgba(15,23,42,0.18))",
      },
      android: {
        elevation: 10,
      },
    }),
  },
  imageCardSurface: {
    width: "100%",
    height: "100%",
    alignSelf: "center",
    borderRadius: 0,
    overflow: "hidden",
    backgroundColor: "transparent",
    borderWidth: 0,
    borderColor: "transparent",
    justifyContent: "center",
    alignItems: "center",
  },
  img: {
    width: "100%",
    height: "100%",
    borderRadius: 0,
  },
  placeholder: {
    width: "100%",
    height: "100%",
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.85)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: DESIGN_TOKENS.spacing.xs,
    paddingVertical: DESIGN_TOKENS.spacing.xs,
  },
  neutralPlaceholder: {
    width: "100%",
    height: "100%",
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.04)",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
    ...Platform.select({
      web: {
        backgroundImage:
          "linear-gradient(180deg, rgba(0,0,0,0.04) 0%, rgba(0,0,0,0.02) 100%)",
        boxSizing: "border-box",
      },
    }),
  },
  placeholderTitle: {
    color: "#0f172a",
    fontSize: DESIGN_TOKENS.typography.sizes.md,
    fontWeight: "600",
    marginTop: 12,
    textAlign: "center",
  },
  placeholderSubtitle: {
    color: "#475569",
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    marginTop: 4,
    textAlign: "center",
  },
  retryBtn: {
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#0f172a",
    ...Platform.select({
      web: {
        cursor: "pointer",
      },
    }),
  },
  retryBtnText: {
    color: "#ffffff",
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    fontWeight: "600",
  },
  loadingOverlay: {
    position: "absolute",
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.45)",
  },
  navBtn: {
    position: "absolute",
    top: "50%",
    marginTop: -24,
    backgroundColor: "rgba(255,255,255,0.35)",
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    width: 48,
    height: 48,
    borderRadius: 24,
    zIndex: 10,
    justifyContent: "center",
    alignItems: "center",
    ...Platform.select({
      web: {
        cursor: "pointer",
        transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
        boxShadow: "0 12px 24px rgba(15,23,42,0.15)",
        backdropFilter: "blur(16px)",
      },
      android: {
        elevation: 6,
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
    backgroundColor: "rgba(255,255,255,0.4)",
  },
  navBtnHover: {
    backgroundColor: "rgba(255,255,255,0.85)",
    ...Platform.select({
      web: {
        boxShadow: "0 16px 42px rgba(15,23,42,0.25)",
      },
    }),
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
    zIndex: DESIGN_TOKENS.zIndex.fixed, // 300 - ниже navBtn
  },
  dotsMobile: {
    bottom: 12,
  },
  dotsContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.65)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
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
    backgroundColor: "rgba(15,23,42,0.6)",
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    ...Platform.select({
      web: {
        transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
      },
    }),
  },
  // ✅ УЛУЧШЕНИЕ: Счетчик изображений
  counter: {
    position: "absolute",
    top: 16,
    right: 16,
    zIndex: DESIGN_TOKENS.zIndex.fixed, // 300
    ...Platform.select({
      web: {
        top: 16,
        right: 16,
      },
    }),
  },
  counterMobile: {
    top: 12,
    right: 12,
  },
  counterContainer: {
    backgroundColor: "rgba(255,255,255,0.75)",
    paddingHorizontal: 12,
    paddingVertical: DESIGN_TOKENS.spacing.xs,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    ...Platform.select({
      web: {
        backdropFilter: "blur(8px)",
      },
    }),
  },
  counterText: {
    color: "#0f172a",
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    fontWeight: "600",
    fontFamily: Platform.OS === "web" ? "system-ui, -apple-system" : undefined,
    letterSpacing: 0.5,
  },
  metaRow: {
    width: "100%",
    marginTop: 12,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  metaRowMobile: {
    alignItems: "center",
  },
  swipeHint: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.7)",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: DESIGN_TOKENS.spacing.xs,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.35)",
  },
  swipeHintMobile: {
    marginTop: 8,
  },
  swipeHintText: {
    marginLeft: 8,
    fontSize: DESIGN_TOKENS.typography.sizes.xs,
    color: "#0f172a",
    fontWeight: "500",
  },
});
