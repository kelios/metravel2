// components/common/Slider.tsx
import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  forwardRef,
  Suspense,
} from "react";
import {
  StyleSheet,
  TouchableOpacity,
  View,
  LayoutChangeEvent,
  Platform,
  useWindowDimensions,
  Text,
} from "react-native";
import { Image as ExpoImage } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// ленивый импорт нативной карусели — только для iOS/Android
const NativeCarousel = React.lazy(() =>
  import("react-native-reanimated-carousel").then((m: any) => ({
    default: m.default,
  }))
);

// ленивые иконки
const LazyAnt = React.lazy(() =>
  import("@expo/vector-icons/AntDesign").then((m: any) => ({
    default: m.AntDesign || m.default,
  }))
);

interface SliderImage {
  url: string;
  id: number | string;
  updated_at?: string;
  width?: number;
  height?: number;
}

interface SliderProps {
  images: SliderImage[];
  showArrows?: boolean;
  showDots?: boolean;
  hideArrowsOnMobile?: boolean;
  aspectRatio?: number;
  autoPlay?: boolean;              // native
  autoPlayInterval?: number;       // native
  onIndexChanged?: (index: number) => void;
  imageProps?: Partial<React.ComponentProps<typeof ExpoImage>>;
  preloadCount?: number;
  blurBackground?: boolean;        // включено по умолчанию
}

const DEFAULT_ASPECT_RATIO = 16 / 9;
const NAV_BTN_OFFSET = 10;
const MOBILE_BREAKPOINT = 768;

const buildUri = (img: SliderImage) => {
  const ts = img.updated_at ? Date.parse(img.updated_at) : Number(img.id);
  return ts && Number.isFinite(ts) ? `${img.url}?v=${ts}` : img.url;
};

const IconBtn = memo(function IconBtn({
                                        name,
                                        size = 20,
                                        color = "#fff",
                                      }: {
  name: "left" | "right";
  size?: number;
  color?: string;
}) {
  return (
    <Suspense fallback={<Text style={{ color, fontSize: size }}>{name === "left" ? "‹" : "›"}</Text>}>
      {/* @ts-ignore */}
      <LazyAnt name={name} size={size} color={color} />
    </Suspense>
  );
});

const NavButton = memo(
  ({
     direction,
     onPress,
     offset,
   }: {
    direction: "left" | "right";
    onPress: () => void;
    offset: number;
  }) => (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.navBtn,
        direction === "left" ? { left: offset } : { right: offset },
      ]}
      accessibilityRole="button"
      accessibilityLabel={direction === "left" ? "Previous slide" : "Next slide"}
      hitSlop={10}
    >
      <IconBtn name={direction === "left" ? "left" : "right"} />
    </TouchableOpacity>
  )
);

/* --------------------------- WEB-карусель --------------------------- */

function WebCarousel({
                       images,
                       width: cw,
                       height: ch,
                       currentIndex,
                       onIndexChanged,
                       blurBackground,
                     }: {
  images: SliderImage[];
  width: number;
  height: number;
  currentIndex: number;
  onIndexChanged: (i: number) => void;
  blurBackground: boolean;
}) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const reducesMotion =
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    const node = scrollerRef.current;
    if (!node) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const idx = Math.round(node.scrollLeft / node.clientWidth);
        if (idx !== currentIndex)
          onIndexChanged(Math.max(0, Math.min(images.length - 1, idx)));
      });
    };
    node.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      node.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, [currentIndex, images.length, onIndexChanged]);

  const scrollToIndex = useCallback(
    (i: number) => {
      const node = scrollerRef.current;
      if (!node) return;
      const clamped = Math.max(0, Math.min(images.length - 1, i));
      node.scrollTo({
        left: clamped * node.clientWidth,
        behavior: reducesMotion ? "auto" : "smooth",
      });
    },
    [images.length, reducesMotion]
  );

  (WebCarousel as any)._scrollTo = scrollToIndex;

  // helper: вычисляем нужно ли показывать блюр (если изображение не заполняет контейнер)
  const needBlur = (w?: number, h?: number) => {
    if (!w || !h) return true; // безопасно включаем блюр, если нет размеров
    const scale = Math.min(cw / w, ch / h, 1); // не увеличиваем сверх natural
    const dw = Math.round(w * scale);
    const dh = Math.round(h * scale);
    return dw < cw || dh < ch; // есть "поля" — включаем подложку
  };

  return (
    <div
      ref={scrollerRef}
      style={{
        width: cw,
        height: ch,
        display: "grid",
        gridAutoFlow: "column",
        gridAutoColumns: "100%",
        overflowX: "auto",
        overflowY: "hidden",
        scrollSnapType: "x mandatory",
        scrollbarWidth: "none",
        WebkitOverflowScrolling: "touch",
      }}
    >
      {images.map((img, index) => {
        const uri = buildUri(img);
        const isFirst = index === 0;
        const w = img.width || undefined;
        const h = img.height || undefined;

        const showBlur = blurBackground && needBlur(w, h);

        return (
          <div
            key={img.id}
            style={{
              position: "relative",
              width: "100%",
              height: "100%",
              scrollSnapAlign: "center",
              contentVisibility: "auto",
              containIntrinsicSize: `${h ?? Math.round(cw / (16 / 9))}px`,
              contain: "paint layout size style",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "#e9e7df",
            } as React.CSSProperties}
          >
            {/* Фоновая подложка с блюром — только если изображение не заполняет рамку */}
            {showBlur && (
              <img
                src={uri}
                alt=""
                aria-hidden="true"
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  transform: "scale(1.05) translateZ(0)",
                  filter: "blur(10px)",
                  willChange: "transform, filter",
                  pointerEvents: "none",
                  zIndex: 1,
                }}
                loading={isFirst ? "eager" : "lazy"}
                decoding="async"
                // @ts-ignore
                fetchpriority={isFirst ? "low" : "low"}
              />
            )}

            {/* Основное изображение — сохраняем оригинальные размеры, НЕ растягиваем сверх natural */}
            <img
              src={uri}
              alt=""
              width={w}
              height={h}
              style={{
                position: "relative",
                zIndex: 2,
                display: "block",
                maxWidth: "100%",
                maxHeight: "100%",
                width: "auto",
                height: "auto",
                objectFit: "contain",   // сохраняет пропорции и не обрезает
                backfaceVisibility: "hidden",
              }}
              loading={isFirst ? "eager" : "lazy"}
              decoding="async"
              // @ts-ignore
              fetchpriority={isFirst ? "high" : "auto"}
            />
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------- Общий компонент ------------------------------- */

const Slider = forwardRef<any, SliderProps>(
  (
    {
      images,
      showArrows = true,
      showDots = true,
      hideArrowsOnMobile = false,
      aspectRatio = DEFAULT_ASPECT_RATIO,
      autoPlay = true, // только native
      autoPlayInterval = 8000,
      onIndexChanged,
      imageProps,
      preloadCount = 1,
      blurBackground = true,
    },
    _externalRef
  ) => {
    const { width: windowWidth, height: windowHeight } = useWindowDimensions();
    const insets = useSafeAreaInsets();

    const [containerWidth, setContainerWidth] = useState<number>(windowWidth);
    const [containerHeight, setContainerHeight] = useState<number>(0);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [loadedIndices, setLoadedIndices] = useState<Set<number>>(
      () => new Set([...Array(Math.min(preloadCount + 1, images.length)).keys()])
    );

    const firstAR = useMemo(() => {
      const first = images[0];
      return first?.width && first?.height
        ? first.width / first.height
        : aspectRatio;
    }, [images, aspectRatio]);

    const isMobile = containerWidth <= MOBILE_BREAKPOINT;
    const uriMap = useMemo(() => images.map(buildUri), [images]);

    useEffect(() => {
      const safeHeight = isMobile
        ? (windowHeight - insets.top - insets.bottom) * 0.75
        : containerWidth / firstAR;
      setContainerHeight(Math.max(160, safeHeight));
    }, [isMobile, containerWidth, firstAR, windowHeight, insets]);

    useEffect(() => {
      setCurrentIndex(0);
      setLoadedIndices(new Set([...Array(Math.min(preloadCount + 1, images.length)).keys()]));
    }, [images, preloadCount]);

    const handleIndexChanged = useCallback(
      (idx: number) => {
        setCurrentIndex(idx);
        onIndexChanged?.(idx);
        setLoadedIndices((prev) => {
          const nxt = new Set(prev);
          for (let i = -preloadCount; i <= preloadCount; i++) {
            const target = idx + i;
            if (target >= 0 && target < images.length) nxt.add(target);
          }
          return nxt;
        });
      },
      [images.length, onIndexChanged, preloadCount]
    );

    if (!images.length) return null;

    const navPrev = () => handleIndexChanged(Math.max(0, currentIndex - 1));
    const navNext = () => handleIndexChanged(Math.min(images.length - 1, currentIndex + 1));

    return (
      <View
        style={[styles.wrapper, { height: containerHeight }]}
        onLayout={(e: LayoutChangeEvent) => setContainerWidth(e.nativeEvent.layout.width)}
        accessibilityRole="group"
        accessibilityLabel="Image slider"
      >
        {containerWidth > 0 && containerHeight > 0 && (
          <>
            {Platform.OS === "web" ? (
              <WebCarousel
                images={images}
                width={containerWidth}
                height={containerHeight}
                currentIndex={currentIndex}
                onIndexChanged={handleIndexChanged}
                blurBackground={blurBackground}
              />
            ) : (
              <Suspense fallback={null}>
                <NativeCarousel
                  key={images.map((i) => `${i.id}_${i.updated_at ?? ""}`).join("-")}
                  data={images}
                  width={containerWidth}
                  height={containerHeight}
                  loop
                  autoPlay={autoPlay}
                  autoPlayInterval={autoPlayInterval}
                  onSnapToItem={handleIndexChanged}
                  renderItem={({ item, index }: { item: SliderImage; index: number }) => {
                    const dims = { width: item.width, height: item.height };
                    const uri = uriMap[index];
                    const isVisible = loadedIndices.has(index);
                    const isPriority = index === 0;

                    return (
                      <View style={styles.slide} collapsable={false}>
                        {isVisible && (
                          <>
                            {blurBackground && (
                              <ExpoImage
                                source={{ uri }}
                                contentFit="cover"
                                cachePolicy="disk"
                                priority={isPriority ? "high" : "low"}
                                style={styles.bg}
                                blurRadius={20}
                              />
                            )}
                            <ExpoImage
                              source={{ uri }}
                              contentFit="contain"
                              cachePolicy="disk"
                              priority={isPriority ? "high" : "low"}
                              transition={120}
                              contentPosition="center"
                              accessibilityIgnoresInvertColors
                              style={
                                dims.width && dims.height
                                  ? [styles.img, { aspectRatio: dims.width / dims.height }]
                                  : styles.img
                              }
                              {...imageProps}
                            />
                          </>
                        )}
                      </View>
                    );
                  }}
                />
              </Suspense>
            )}

            {showArrows && !(isMobile && hideArrowsOnMobile) && (
              <>
                <NavButton
                  direction="left"
                  offset={NAV_BTN_OFFSET}
                  onPress={() => {
                    if (Platform.OS === "web") {
                      // @ts-ignore
                      (WebCarousel as any)._scrollTo?.(currentIndex - 1);
                    }
                    navPrev();
                  }}
                />
                <NavButton
                  direction="right"
                  offset={NAV_BTN_OFFSET}
                  onPress={() => {
                    if (Platform.OS === "web") {
                      // @ts-ignore
                      (WebCarousel as any)._scrollTo?.(currentIndex + 1);
                    }
                    navNext();
                  }}
                />
              </>
            )}

            {showDots && (
              <View style={styles.dots} pointerEvents="box-none">
                {images.map((_, i) => {
                  const active = i === currentIndex;
                  return (
                    <TouchableOpacity
                      key={`dot-${i}`}
                      style={styles.dotWrapper}
                      onPress={() => {
                        if (Platform.OS === "web") {
                          // @ts-ignore
                          (WebCarousel as any)._scrollTo?.(i);
                        }
                        handleIndexChanged(i);
                      }}
                      hitSlop={12}
                    >
                      <View style={[styles.dot, active && styles.active]} />
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </>
        )}
      </View>
    );
  }
);

export default memo(Slider);

/* ---------------------------------- styles ---------------------------------- */

const styles = StyleSheet.create({
  wrapper: {
    width: "100%",
    backgroundColor: "#f9f8f2",
    position: "relative",
    overflow: "hidden",
    borderRadius: 12,
    ...Platform.select({
      web: { userSelect: "none" as any },
    }),
  },
  slide: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  bg: {
    ...StyleSheet.absoluteFillObject,
    transform: [{ scale: 1.05 }],
  },
  img: {
    width: "100%",
    height: "100%",
  },
  navBtn: {
    position: "absolute",
    top: "50%",
    marginTop: -20,
    backgroundColor: "rgba(0,0,0,0.4)",
    padding: 10,
    borderRadius: 20,
    zIndex: 10,
    ...Platform.select({ web: { cursor: "pointer" } }),
  },
  dots: {
    position: "absolute",
    bottom: 12,
    flexDirection: "row",
    alignSelf: "center",
  },
  dotWrapper: {
    marginHorizontal: 6,
    padding: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(0,0,0,0.2)",
  },
  active: {
    width: 10,
    height: 10,
    backgroundColor: "#000",
  },
});
