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
} from "react-native";
import { Image as ExpoImage } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  useAnimatedScrollHandler,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
} from "react-native-reanimated";

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

/* -------------------------------------------------------------------------- */

const DEFAULT_AR = 16 / 9;
const DOT_SIZE = 8;
const DOT_ACTIVE_SIZE = 12;
const NAV_BTN_OFFSET = 10;
const MOBILE_HEIGHT_PERCENT = 0.7;

const buildUri = (img: SliderImage) => {
  const ts = img.updated_at ? Date.parse(img.updated_at) : Number(img.id);
  return ts && Number.isFinite(ts) ? `${img.url}?v=${ts}` : img.url;
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
    const idx = clamp(Math.round(x.value / (containerW || 1)), 0, total - 1);
    const active = idx === i;
    const size = withTiming(active ? DOT_ACTIVE_SIZE : DOT_SIZE, {
      duration: reduceMotion ? 0 : 160,
    });
    const opacity = withTiming(active ? 1 : 0.45, {
      duration: reduceMotion ? 0 : 160,
    });
    return { width: size, height: size, opacity };
  }, [containerW, total, reduceMotion]);

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

  const uriMap = useMemo(() => images.map(buildUri), [images]);

  const firstAR = useMemo(() => {
    const f = images[0];
    return f?.width && f?.height ? f.width / f.height : aspectRatio;
  }, [images, aspectRatio]);

  // мгновенный fallback высоты, чтобы не было высоты 0 при первом рендере
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
    if (!images.length) return;
    const target = (indexRef.current + 1) % images.length;
    // программный скролл
    listRef.current?.scrollToOffset({
      offset: target * containerW,
      animated: !reduceMotion,
    });
  }, [images.length, containerW, reduceMotion]);

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
      warmNeighbors(wrapped);
      onIndexChanged?.(wrapped);
    },
    [containerW, images.length, onIndexChanged, reduceMotion, warmNeighbors]
  );

  const prev = useCallback(() => {
    if (!images.length) return;
    const target = (indexRef.current - 1 + images.length) % Math.max(1, images.length);
    scrollTo(target);
  }, [images.length, scrollTo]);

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

  // прогреть стартовые
  useEffect(() => {
    if (images.length) warmNeighbors(0);
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
      return (
        <View style={{ width: containerW, height: containerH ?? computeHeight(containerW) }}>
          {blurBackground && (
            <ExpoImage
              source={{ uri }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              cachePolicy="disk"
              priority={index === 0 ? "high" : "low"}
              blurRadius={20}
            />
          )}
          <ExpoImage
            source={{ uri }}
            style={styles.img}
            contentFit="contain"
            cachePolicy="disk"
            priority={index === 0 ? "high" : "low"}
            transition={reduceMotion ? 0 : 150}
            contentPosition="center"
            accessibilityIgnoresInvertColors
            onLoad={() => {
              if (index === 0) onFirstImageLoad?.();
            }}
            {...imageProps}
          />
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

    return (
      <TouchableOpacity
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={dir === "left" ? "Previous slide" : "Next slide"}
        hitSlop={10}
        style={[
          styles.navBtn,
          isMobile ? styles.navBtnMobile : styles.navBtnDesktop,
          dir === "left"
            ? { left: NAV_BTN_OFFSET + (isMobile ? 5 : insets.left) }
            : { right: NAV_BTN_OFFSET + (isMobile ? 5 : insets.right) },
        ]}
      >
        <Text style={[styles.navIcon, isMobile && styles.navIconMobile]}>
          {dir === "left" ? "‹" : "›"}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
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
        initialNumToRender={Math.min(images.length, 2)}
        windowSize={3 + preloadCount * 2}
        maxToRenderPerBatch={2 + preloadCount}
        // removeClippedSubviews — отключено, чтобы избежать пустых слайдов на Android
        getItemLayout={getItemLayout}
        bounces={false}
        decelerationRate={Platform.select({ ios: "fast", default: 0.98 })}
        // убрано: snapToInterval/Alignment/disableIntervalMomentum — конфликтовало с pagingEnabled
        onScrollBeginDrag={() => {
          pausedByTouch.current = true;
          clearAutoplay();
        }}
        onScrollEndDrag={() => {
          pausedByTouch.current = false;
          scheduleAutoplay();
        }}
        onMomentumScrollEnd={() => {
          // синхронизация индекса на случай программного скролла
          const idx = Math.round((x.value || 0) / (containerW || 1));
          if (Number.isFinite(idx)) {
            indexRef.current = clamp(idx, 0, images.length - 1);
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

      {showDots && images.length > 1 && (
        <View
          style={[styles.dots, isMobile && styles.dotsMobile]}
          pointerEvents="box-none"
          accessibilityRole="tablist"
        >
          {images.map((_, i) => (
            <TouchableOpacity
              key={`dot-${i}`}
              style={styles.dotWrap}
              accessibilityRole="tab"
              accessibilityState={{ selected: indexRef.current === i }}
              accessibilityLabel={`Go to slide ${i + 1}`}
              onPress={() => scrollTo(i)}
              hitSlop={12}
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
      )}
    </View>
  );
});

export default memo(Slider);

/* --------------------------------- Styles ---------------------------------- */

const styles = StyleSheet.create({
  wrapper: {
    width: "100%",
    backgroundColor: "#f9f8f2",
    position: "relative",
    overflow: "hidden",
    borderRadius: 12,
  },
  wrapperMobile: {
    borderRadius: 8,
    marginVertical: 8,
  },
  img: {
    width: "100%",
    height: "100%",
  },
  navBtn: {
    position: "absolute",
    top: "50%",
    marginTop: -20,
    backgroundColor: "rgba(0,0,0,0.42)",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 22,
    zIndex: 10,
  },
  navBtnDesktop: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 22,
  },
  navBtnMobile: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  navIcon: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "600",
    lineHeight: 22,
  },
  navIconMobile: {
    fontSize: 18,
    lineHeight: 18,
  },
  dots: {
    position: "absolute",
    bottom: 12,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    gap: 10,
  },
  dotsMobile: {
    bottom: 8,
  },
  dotWrap: {
    padding: 6,
  },
  dot: {
    backgroundColor: "#000",
    borderRadius: 999,
  },
});
