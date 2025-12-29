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
import ImageCardMedia from '@/components/ui/ImageCardMedia';
import { prefetchImage } from '@/components/ui/ImageCardMedia';
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
import { optimizeImageUrl, getOptimalImageSize, buildVersionedImageUrl, getPreferredImageFormat } from "@/utils/imageOptimization";
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
  imageProps?: any;
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
    [arrowOpacity, arrowScale, isMobile]
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
          ? { left: NAV_BTN_OFFSET + 4 + (isMobile ? 8 : insets.left) }
          : { right: NAV_BTN_OFFSET + 4 + (isMobile ? 8 : insets.right) },
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
// Мобильная высота: 60% высоты экрана (фиксировано)
const MOBILE_HEIGHT_PERCENT = 0.6;
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
        format: getPreferredImageFormat(),
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

// NOTE: avoid TS generics in forwardRef to prevent runtime parsing issues if the file is consumed untranspiled
const SliderComponent = (props: SliderProps, ref: React.Ref<SliderRef>) => {
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

  const isTestEnv = process.env.NODE_ENV === 'test';

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
        // На мобильных целимся в фиксированные 80% высоты viewport.
        // Верхняя граница — не меньше самого target (чтобы не съедать высоту), даже если safe-area большая.
        const viewportH = Math.max(0, winH);
        const targetH = viewportH * mobileHeightPercent;
        const safeMax = Math.max(targetH, viewportH - (insets.top || 0) - (insets.bottom || 0));
        return clamp(targetH, 280, safeMax || targetH);
      } else {
        const h = w / firstAR;
        return clamp(h, 320, 640);
      }
    },
    [firstAR, images.length, insets.bottom, insets.top, isMobile, winH, mobileHeightPercent]
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
      if (!prefetchEnabled) return;
      if (!effectivePreload) return;
      for (let d = -effectivePreload; d <= effectivePreload; d++) {
        if (d === 0) continue;
        const t = idx + d;
        if (t < 0 || t >= images.length) continue;
        const u = uriMap[t];
        prefetchImage(u).catch((error) => {
          // ✅ ИСПРАВЛЕНИЕ: Логируем ошибки прелоадинга изображений
          if (__DEV__) {
            console.warn('[Slider] Ошибка прелоадинга изображения:', error);
          }
        });
      }
    },
    [prefetchEnabled, images.length, effectivePreload, uriMap]
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
    // программный скролл
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
        if (indexRef.current !== idx) setActiveIndex(idx);
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
      // Показываем размытый фон на всех платформах, но сохраняем legacy-поведение для web первого слайда:
      // пока он не загрузился — используем плоский фон, чтобы избежать расхождений с тестами/LCP.
      const shouldRenderBlurBg =
        shouldBlur &&
        status !== "error" &&
        !(Platform.OS === "web" && isFirstSlide && status !== "loaded");

      const useElevatedWrapper = Platform.OS === 'web' && !isMobile && (isPortrait || isSquareish);
      // Показываем всю картинку: используем contain на всех платформах
      const mainFit: 'cover' | 'contain' = 'contain';

      return (
        <View style={[styles.slide, { width: containerW, height: slideHeight }]}> 
          {shouldRenderBlurBg ? (
            <>
              <ImageCardMedia
                testID={`slider-blur-bg-${index}`}
                src={uri}
                // Фон должен полностью заполнять область — используем cover
                fit="cover"
                blurBackground
                blurRadius={12}
                blurOnly
                priority="low"
                loading="lazy"
                style={styles.blurBg}
              />
            </>
          ) : (
            <View style={styles.flatBackground} testID={`slider-flat-bg-${index}`} />
          )}

          <View
            style={[
              styles.imageCardWrapper,
              useElevatedWrapper && styles.imageCardWrapperElevated,
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
                <ImageCardMedia
                  src={uri}
                  fit={mainFit}
                  // Background blur is rendered as a separate layer above.
                  // Keeping blur here too can cause positioning/artifacts on mobile.
                  blurBackground={Platform.OS === 'web' ? shouldRenderBlurBg : shouldBlur}
                  priority={mainPriority as any}
                  loading={Platform.OS === 'web' ? (isFirstSlide ? 'eager' : 'lazy') : 'lazy'}
                  transition={reduceMotion ? 0 : 250}
                  style={styles.img}
                  alt={
                    item.width && item.height
                      ? `Изображение ${index + 1} из ${images.length}`
                      : `Фотография путешествия ${index + 1} из ${images.length}`
                  }
                  imageProps={{
                    ...(imageProps || {}),
                    // Ensure contain images are centered across platforms.
                    contentPosition: 'center',
                    testID: `slider-image-${index}`,
                    accessibilityIgnoresInvertColors: true,
                    accessibilityRole: 'image',
                    accessibilityLabel:
                      item.width && item.height
                        ? `Изображение ${index + 1} из ${images.length}`
                        : `Фотография путешествия ${index + 1} из ${images.length}`,
                    onLoadStart: () => updateLoadStatus(index, 'loading'),
                  }}
                  onLoad={() => {
                    updateLoadStatus(index, "loaded");
                    if (index === 0) {
                      onFirstImageLoad?.();
                      if (!prefetchEnabled) {
                        setPrefetchEnabled(true);
                      }
                    }
                  }}
                  onError={() => updateLoadStatus(index, "error")}
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
      isMobile,
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
        <View style={[styles.clip, isMobile && styles.clipMobile]}>
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
            initialNumToRender={isTestEnv ? images.length : 1}
            windowSize={isTestEnv ? images.length : 2 + Math.max(0, effectivePreload)}
            maxToRenderPerBatch={isTestEnv ? images.length : 1 + Math.max(0, effectivePreload)}
            disableVirtualization={isTestEnv}
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
          <View style={[styles.counter, isMobile && styles.counterMobile]} pointerEvents="none">
            <View style={styles.counterContainer}>
              <Text style={styles.counterText}>
                {currentIndex + 1}/{images.length}
              </Text>
            </View>
          </View>
        )}

        {/* Instagram-style pagination dots */}
        {showDots && images.length > 1 && (
          <View style={[styles.dots, isMobile && styles.dotsMobile]} pointerEvents="none">
            <View style={styles.dotsContainer}>
              {images.map((_, i) => (
                <View key={i} style={styles.dotWrap}>
                  <Dot i={i} x={x} containerW={containerW} total={images.length} reduceMotion={reduceMotion} />
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

const styles = StyleSheet.create<Record<string, any>>({
  sliderStack: {
    width: "100%",
  },
  wrapper: {
    width: "100%",
    backgroundColor: "transparent",
    position: "relative",
    borderRadius: 12,
    borderWidth: 0,
    borderColor: "transparent",
    ...Platform.select({
      web: {
        boxShadow: "0 14px 34px rgba(15,23,42,0.10)",
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
  clip: {
    flex: 1,
    overflow: 'hidden',
    borderRadius: 12,
    backgroundColor: "transparent",
  },
  clipMobile: {
    borderRadius: 16,
  },
  slide: {
    flex: 1,
    position: "relative",
    backgroundColor: "transparent",
  },
  blurBg: {
    ...StyleSheet.absoluteFillObject,
  },
  flatBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#f1f5f9",
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
        boxShadow: "0 18px 42px rgba(15,23,42,0.12)",
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
    zIndex: 50,
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
