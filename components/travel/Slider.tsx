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
  useWindowDimensions,
  Platform,
  ActivityIndicator,
} from "react-native";
import { Image as ExpoImage } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  useAnimatedScrollHandler,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  runOnJS,
  interpolate,
  Extrapolate,
} from "react-native-reanimated";
// ✅ УЛУЧШЕНИЕ: Импорт утилит для оптимизации изображений
import { optimizeImageUrl, getOptimalImageSize, buildVersionedImageUrl } from "@/utils/imageOptimization";
import { Feather } from "@expo/vector-icons";

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
}

export interface SliderRef {
  scrollTo: (index: number, animated?: boolean) => void;
  next: () => void;
  prev: () => void;
}

type LoadStatus = "loading" | "loaded" | "error";

/* -------------------------------------------------------------------------- */

const DEFAULT_AR = 16 / 9;
const DOT_SIZE = 6;
const DOT_ACTIVE_SIZE = 24; // Увеличиваем для современного вида (широкая активная точка)
const NAV_BTN_OFFSET = 16;
const MOBILE_HEIGHT_PERCENT = 0.7;
const ARROW_ANIMATION_DURATION = 200;
const GLASS_BG = "rgba(255,255,255,0.55)";
const GLASS_BORDER = "rgba(255,255,255,0.35)";
const GLASS_CARD = "rgba(255,255,255,0.92)";

const buildUri = (img: SliderImage, containerWidth?: number, containerHeight?: number, isFirst: boolean = false) => {
  const versionedUrl = buildVersionedImageUrl(img.url, img.updated_at, img.id);
  
  // ✅ УЛУЧШЕНИЕ: Оптимизация размера изображения для контейнера
  if (containerWidth && img.width && img.height) {
    const aspectRatio = img.width / img.height;
    const optimalSize = getOptimalImageSize(containerWidth, containerHeight, aspectRatio);
    
    return optimizeImageUrl(versionedUrl, {
      width: optimalSize.width,
      height: optimalSize.height,
      format: 'webp',
      quality: isFirst ? 90 : 85, // Выше качество для первого изображения
      fit: 'cover',
    }) || versionedUrl;
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
  } = props;

  const insets = useSafeAreaInsets();
  const { width: winW, height: winH } = useWindowDimensions();
  const isMobile = winW < 768;

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
  const [showSwipeHint, setShowSwipeHint] = useState(images.length > 1);

  useEffect(() => {
    setLoadStatuses(images.map(() => "loading"));
    setShowSwipeHint(images.length > 1);
  }, [images]);

  const updateLoadStatus = useCallback((idx: number, status: LoadStatus) => {
    setLoadStatuses((prev) => {
      if (prev[idx] === status) return prev;
      const next = [...prev];
      next[idx] = status;
      return next;
    });
  }, []);
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
    () => images.map((img, idx) => buildUri(img, containerW, containerH ?? computeHeight(containerW), idx === 0)),
    [images, containerW, containerH, computeHeight]
  );

  // начальная высота по AR, потом обновляется при layout
  useEffect(() => {
    if (containerH == null) {
      setContainerH(computeHeight(containerW));
    }
  }, [containerH, computeHeight, containerW]);

  // пересчёт при изменении зависимостей
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
  const warmNeighbors = useCallback(
    (idx: number) => {
      for (let d = -preloadCount; d <= preloadCount; d++) {
        const t = idx + d;
        if (t < 0 || t >= images.length) continue;
        const u = uriMap[t];
        ExpoImage.prefetch?.(u).catch(() => {});
      }
    },
    [images.length, preloadCount, uriMap]
  );

  // автоплей
  const appState = useRef(AppState.currentState);
  const pausedByAppState = useRef(false);
  const pausedByTouch = useRef(false);
  const autoplayTimer = useRef<number | null>(null);

  const canAutoplay = useCallback(() => {
    return (
      autoPlay &&
      images.length > 1 &&
      !reduceMotion &&
      !pausedByAppState.current &&
      !pausedByTouch.current
    );
  }, [autoPlay, images.length, reduceMotion]);

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
    setCurrentIndex(target); // ✅ УЛУЧШЕНИЕ: Обновляем текущий индекс для счетчика
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
      setCurrentIndex(wrapped); // ✅ УЛУЧШЕНИЕ: Обновляем текущий индекс для счетчика
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
    setCurrentIndex(target); // ✅ УЛУЧШЕНИЕ: Обновляем текущий индекс для счетчика
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
    if (!images.length) return;
    // Первое изображение уже загружается с high priority, остальные откладываем
    if (Platform.OS === "web") {
      // На web откладываем prefetch соседних изображений
      const timer = setTimeout(() => warmNeighbors(0), 100);
      return () => clearTimeout(timer);
    } else {
      // На native можно prefetch сразу
      warmNeighbors(0);
    }
  }, [images.length, warmNeighbors]);

  if (!images.length) return null;

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
          setCurrentIndex(idx); // ✅ УЛУЧШЕНИЕ: Обновляем текущий индекс для счетчика
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
      const shouldBlur = blurBackground && (isPortrait || isSquareish);
      const slideHeight = containerH ?? computeHeight(containerW);
      const status = loadStatuses[index] ?? "loading";

      return (
        <View
          style={[styles.slide, { width: containerW, height: slideHeight }]}
        >
          {shouldBlur ? (
            <>
              <ExpoImage
                testID={`slider-blur-bg-${index}`}
                source={{ uri }}
                style={styles.blurBg}
                contentFit="cover"
                cachePolicy="disk"
                priority={index === 0 ? "high" : "low"}
                blurRadius={30}
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
                <View style={styles.placeholder} testID={`slider-placeholder-${index}`}>
                  <Feather name="image" size={32} color="#94a3b8" />
                  <Text style={styles.placeholderTitle}>Фото не загрузилось</Text>
                  <Text style={styles.placeholderSubtitle}>
                    Проверьте подключение или попробуйте позже
                  </Text>
                </View>
              ) : (
                <ExpoImage
                  testID={`slider-image-${index}`}
                  source={{ uri }}
                  style={styles.img}
                  contentFit="contain"
                  cachePolicy="disk"
                  priority={index === 0 ? "high" : "low"}
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
                    if (index === 0) onFirstImageLoad?.();
                  }}
                  onLoadStart={() => updateLoadStatus(index, "loading")}
                  onError={() => updateLoadStatus(index, "error")}
                  {...imageProps}
                />
              )}

              {status === "loading" && (
                <View
                  style={styles.loadingOverlay}
                  pointerEvents="none"
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
    ]
  );

  const Arrow = ({
                   dir,
                   onPress,
                 }: {
    dir: "left" | "right";
    onPress: () => void;
  }) => {
    if (isMobile && hideArrowsOnMobile) return null;

    const arrowOpacity = useSharedValue(1);
    const arrowScale = useSharedValue(1);

    const animatedStyle = useAnimatedStyle(() => ({
      opacity: arrowOpacity.value,
      transform: [{ scale: arrowScale.value }],
    }));

    const handlePressIn = () => {
      arrowOpacity.value = withSpring(0.7, { damping: 15 });
      arrowScale.value = withSpring(0.95, { damping: 15 });
    };

    const handlePressOut = () => {
      arrowOpacity.value = withSpring(1, { damping: 15 });
      arrowScale.value = withSpring(1, { damping: 15 });
    };

    const [isHovered, setIsHovered] = useState(false);

    const handleHover = useCallback((hover: boolean) => {
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
    }, [isMobile, arrowOpacity, arrowScale]);

    const iconSize = isMobile ? 20 : 24;

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
  };

  return (
    <View style={styles.sliderStack}>
      <View
        onLayout={onLayout}
        style={[
          styles.wrapper,
          { height: containerH ?? computeHeight(containerW) },
          isMobile && styles.wrapperMobile,
        ]}
        accessibilityRole="group"
        accessibilityLabel="Image slider"
      >
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
        initialNumToRender={1} // Уменьшаем до 1 для улучшения LCP (рендерим только первый слайд сразу)
        windowSize={2 + preloadCount} // Уменьшаем windowSize для меньшего initial render
        maxToRenderPerBatch={1 + preloadCount} // Уменьшаем batch size
        maintainVisibleContentPosition={Platform.OS === "ios" ? undefined : { minIndexForVisible: 0 }}
        disableIntervalMomentum={true}
        // removeClippedSubviews — отключено, чтобы избежать пустых слайдов на Android
        getItemLayout={getItemLayout}
        bounces={false}
        decelerationRate={Platform.select({ ios: "fast", default: 0.98 })}
        // убрано: snapToInterval/Alignment/disableIntervalMomentum — конфликтовало с pagingEnabled
        onScrollBeginDrag={() => {
          pausedByTouch.current = true;
          clearAutoplay();
          dismissSwipeHint();
        }}
        onScrollEndDrag={() => {
          pausedByTouch.current = false;
          scheduleAutoplay();
        }}
        onMomentumScrollEnd={() => {
          // синхронизация индекса на случай программного скролла
          const idx = Math.round((x.value || 0) / (containerW || 1));
          if (Number.isFinite(idx)) {
            const clampedIdx = clamp(idx, 0, images.length - 1);
            indexRef.current = clampedIdx;
            setCurrentIndex(clampedIdx); // ✅ УЛУЧШЕНИЕ: Обновляем текущий индекс для счетчика
          }
        }}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        extraData={containerW}
        />

        {showArrows && images.length > 1 && (
        <>
          <Arrow dir="left" onPress={prev} />
          <Arrow dir="right" onPress={next} />
        </>
      )}

      {/* ✅ УЛУЧШЕНИЕ: Счетчик изображений */}
      {images.length > 1 && (
        <View
          style={[styles.counter, isMobile && styles.counterMobile]}
          pointerEvents="box-none"
          accessibilityRole="text"
          accessibilityLabel={`Изображение ${currentIndex + 1} из ${images.length}`}
        >
          <View style={styles.counterContainer}>
            <Text style={styles.counterText}>
              {currentIndex + 1} / {images.length}
            </Text>
          </View>
        </View>
      )}

      {showDots && images.length > 1 && (
        <View
          style={[styles.dots, isMobile && styles.dotsMobile]}
          pointerEvents="box-none"
          accessibilityRole="tablist"
        >
          <View style={styles.dotsContainer}>
            {images.map((_, i) => (
              <TouchableOpacity
                key={`dot-${i}`}
                style={styles.dotWrap}
                accessibilityRole="tab"
                accessibilityState={{ selected: indexRef.current === i }}
                accessibilityLabel={`Go to slide ${i + 1}`}
                onPress={() => {
                  dismissSwipeHint();
                  scrollTo(i);
                }}
                hitSlop={8}
                activeOpacity={0.7}
              >
                <Dot
                  i={i}
                  x={x}
                  containerW={containerW}
                  total={images.length}
                  reduceMotion={reduceMotion}
                />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}
      </View>

      {images.length > 1 && showSwipeHint && (
        <View style={[styles.metaRow, isMobile && styles.metaRowMobile]}>
          <View style={[styles.swipeHint, isMobile && styles.swipeHintMobile]}>
            <Feather
              name={isMobile ? "smartphone" : "arrow-right"}
              size={12}
              color="#0f172a"
            />
            <Text style={styles.swipeHintText}>
              {isMobile
                ? "Свайпайте, чтобы увидеть больше"
                : "Используйте стрелки или клавиши ← →"}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
});

export default memo(Slider);

/* --------------------------------- Styles ---------------------------------- */

const styles = StyleSheet.create({
  sliderStack: {
    width: "100%",
  },
  wrapper: {
    width: "100%",
    backgroundColor: GLASS_BG,
    position: "relative",
    overflow: "hidden",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    ...Platform.select({
      web: {
        boxShadow: "0 25px 60px rgba(15,23,42,0.12)",
        backdropFilter: "blur(26px)",
      },
      ios: {
        shadowColor: "#0f172a",
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.12,
        shadowRadius: 24,
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
    backgroundColor: "rgba(255,255,255,0.6)",
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
    paddingHorizontal: 24,
    paddingVertical: 24,
    alignSelf: "stretch",
    maxWidth: 1280,
    width: "100%",
  },
  imageCardWrapperElevated: {
    ...Platform.select({
      web: {
        filter: "drop-shadow(0 25px 45px rgba(15,23,42,0.18))",
      },
      ios: {
        shadowColor: "#0f172a",
        shadowOpacity: 0.15,
        shadowRadius: 30,
        shadowOffset: { width: 0, height: 18 },
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
    borderRadius: 28,
    overflow: "hidden",
    backgroundColor: GLASS_CARD,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    justifyContent: "center",
    alignItems: "center",
    ...Platform.select({
      web: {
        backdropFilter: "blur(18px)",
      },
    }),
  },
  img: {
    width: "100%",
    height: "100%",
    borderRadius: 24,
  },
  placeholder: {
    width: "100%",
    height: "100%",
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.85)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 24,
  },
  placeholderTitle: {
    color: "#0f172a",
    fontSize: 16,
    fontWeight: "600",
    marginTop: 12,
    textAlign: "center",
  },
  placeholderSubtitle: {
    color: "#475569",
    fontSize: 13,
    marginTop: 4,
    textAlign: "center",
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
      ios: {
        shadowColor: "#0f172a",
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.12,
        shadowRadius: 12,
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
  arrowIcon: {
    textShadowColor: "rgba(15,23,42,0.35)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  dots: {
    position: "absolute",
    bottom: 16,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 10,
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
    paddingVertical: 6,
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
    zIndex: 10,
    ...Platform.select({
      web: {
        top: "16px",
        right: "16px",
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
    paddingVertical: 6,
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
    fontSize: 13,
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
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.35)",
  },
  swipeHintMobile: {
    marginTop: 8,
  },
  swipeHintText: {
    marginLeft: 8,
    fontSize: 12,
    color: "#0f172a",
    fontWeight: "500",
  },
});
