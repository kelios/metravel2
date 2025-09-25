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
  autoPlay?: boolean;
  autoPlayInterval?: number;
  onIndexChanged?: (index: number) => void;
  imageProps?: Partial<React.ComponentProps<typeof ExpoImage>>;
  preloadCount?: number;
  blurBackground?: boolean;
  onFirstImageLoad?: () => void;
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

interface OptimizedWebCarouselProps {
  images: SliderImage[];
  width: number;
  height: number;
  currentIndex: number;
  onIndexChanged: (i: number) => void;
  blurBackground: boolean;
  onFirstImageLoad?: () => void;
}

function OptimizedWebCarousel({
                                images,
                                width: cw,
                                height: ch,
                                currentIndex,
                                onIndexChanged,
                                blurBackground,
                                onFirstImageLoad,
                              }: OptimizedWebCarouselProps) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const reducesMotion =
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const [loadedImages, setLoadedImages] = useState<Set<number>>(new Set());

  const imagesKey = useMemo(
    () => images.map((i) => `${i.id}_${i.updated_at ?? ""}`).join("|"),
    [images]
  );

  // сброс позиции при смене статьи/набора картинок — чтобы не "улетало" в обратную сторону
  useEffect(() => {
    const node = scrollerRef.current;
    if (node) node.scrollTo({ left: 0, behavior: "auto" });
  }, [imagesKey]);

  const handleImageLoad = useCallback(
    (index: number) => {
      setLoadedImages((prev) => {
        if (prev.has(index)) return prev;
        const next = new Set(prev);
        next.add(index);
        return next;
      });
      if (index === 0) {
        onFirstImageLoad?.();
        (window as any).__LCP_LOADED ||= true;
        if ((window as any).gtag) {
          (window as any).gtag("event", "LCP_loaded", {
            event_category: "Performance",
            event_label: "Slider LCP",
          });
        }
      }
    },
    [onFirstImageLoad]
  );

  // предзагрузка следующего
  useEffect(() => {
    if (images.length > 1) {
      const nextIndex = (currentIndex + 1) % images.length;
      const nextImg = images[nextIndex];
      if (nextImg) {
        const link = document.createElement("link");
        link.rel = "preload";
        link.as = "image";
        link.href = buildUri(nextImg);
        document.head.appendChild(link);
        setTimeout(() => link.remove(), 5000);
      }
    }
  }, [currentIndex, images]);

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

  // ЦИКЛИЧЕСКИЙ scrollTo (wrap-around)
  const scrollToIndex = useCallback(
    (i: number) => {
      const node = scrollerRef.current;
      if (!node) return;
      const len = images.length;
      if (len === 0) return;
      const wrapped = ((i % len) + len) % len; // модуль по длине
      node.scrollTo({
        left: wrapped * node.clientWidth,
        behavior: reducesMotion ? "auto" : "smooth",
      });
    },
    [images.length, reducesMotion]
  );

  (OptimizedWebCarousel as any)._scrollTo = scrollToIndex;

  const needBlur = (w?: number, h?: number) => {
    if (!w || !h) return true;
    const scale = Math.min(cw / w, ch / h, 1);
    const dw = Math.round(w * scale);
    const dh = Math.round(h * scale);
    return dw < cw || dh < ch;
  };

  const containerStyle = useMemo(
    () => ({
      width: cw,
      height: ch,
      display: "grid" as const,
      gridAutoFlow: "column" as const,
      gridAutoColumns: "100%",
      overflowX: "auto" as const,
      overflowY: "hidden" as const,
      scrollSnapType: "x mandatory" as const,
      scrollbarWidth: "none" as const,
      WebkitOverflowScrolling: "touch" as const,
      contain: "layout paint style" as const,
    }),
    [cw, ch]
  );

  const slideStyle = useMemo(
    () => ({
      position: "relative" as const,
      width: "100%",
      height: "100%",
      scrollSnapAlign: "center" as const,
      contentVisibility: "auto" as const,
      contain: "paint layout size style" as const,
      display: "flex" as const,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      background: "#e9e7df",
    }),
    []
  );

  return (
    <div ref={scrollerRef} style={containerStyle}>
      {images.map((img, index) => {
        const uri = buildUri(img);
        const isFirst = index === 0;
        const w = img.width || 1200;
        const h = img.height || Math.round(1200 / DEFAULT_ASPECT_RATIO);

        const showBlur = blurBackground && needBlur(img.width, img.height);

        return (
          <div key={img.id} style={slideStyle}>
            {/* Фоновая подложка с блюром — всегда под фото */}
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

            {/* Основное изображение */}
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
                objectFit: "contain",
                backfaceVisibility: "hidden",
                opacity: 0,
                transition: "opacity 0.25s ease-in-out",
              }}
              loading={isFirst ? "eager" : "lazy"}
              decoding="async"
              // @ts-ignore
              fetchpriority={isFirst ? "high" : "auto"}
              onLoad={(e) => {
                (e.currentTarget as HTMLImageElement).style.opacity = "1";
                handleImageLoad(index);
              }}
            />
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------- Основной компонент ------------------------------- */

const Slider = forwardRef<any, SliderProps>(
  (
    {
      images,
      showArrows = true,
      showDots = true,
      hideArrowsOnMobile = false,
      aspectRatio = DEFAULT_ASPECT_RATIO,
      autoPlay = true,
      autoPlayInterval = 8000,
      onIndexChanged,
      imageProps,
      preloadCount = 1,
      blurBackground = true,
      onFirstImageLoad,
    },
    _externalRef
  ) => {
    const { width: windowWidth, height: windowHeight } = useWindowDimensions();
    const insets = useSafeAreaInsets();

    const [containerWidth, setContainerWidth] = useState<number>(windowWidth);
    const [containerHeight, setContainerHeight] = useState<number>(0);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [loadedIndices, setLoadedIndices] = useState<Set<number>>(
      () => new Set([0])
    );

    // натив: какие картинки уже загрузились
    const [loadedImages, setLoadedImages] = useState<Set<number>>(new Set([0]));

    const handleImageLoad = useCallback(
      (index: number) => {
        setLoadedImages((prev) => {
          if (prev.has(index)) return prev;
          const next = new Set(prev);
          next.add(index);
          return next;
        });
        if (index === 0) onFirstImageLoad?.();
      },
      [onFirstImageLoad]
    );

    const firstAR = useMemo(() => {
      const first = images[0];
      return first?.width && first?.height
        ? first.width / first.height
        : aspectRatio;
    }, [images, aspectRatio]);

    const isMobile = containerWidth <= MOBILE_BREAKPOINT;
    const uriMap = useMemo(() => images.map(buildUri), [images]);

    // фиксированная высота, чтобы не было CLS
    useEffect(() => {
      const calculateHeight = () => {
        if (isMobile) {
          return Math.max(
            160,
            (windowHeight - insets.top - insets.bottom) * 0.75
          );
        } else {
          const calculatedHeight = containerWidth / firstAR;
          return Math.max(300, Math.min(600, calculatedHeight));
        }
      };
      setContainerHeight(calculateHeight());
    }, [isMobile, containerWidth, firstAR, windowHeight, insets]);

    const imagesKey = useMemo(
      () => images.map((i) => `${i.id}_${i.updated_at ?? ""}`).join("|"),
      [images]
    );

    useEffect(() => {
      setCurrentIndex(0);
      setLoadedIndices(new Set([0]));
      setLoadedImages(new Set([0]));
    }, [imagesKey]);

    const handleIndexChanged = useCallback(
      (idx: number) => {
        setCurrentIndex(idx);
        onIndexChanged?.(idx);

        setLoadedIndices((prev) => {
          const nxt = new Set(prev);
          for (let i = -preloadCount; i <= preloadCount; i++) {
            const t = idx + i;
            if (t >= 0 && t < images.length) nxt.add(t);
          }
          return nxt;
        });
      },
      [images.length, onIndexChanged, preloadCount]
    );

    if (!images.length) return null;

    // wrap helpers
    const wrapIndex = (i: number) => {
      const len = images.length;
      return ((i % len) + len) % len;
    };

    const navPrev = () => handleIndexChanged(wrapIndex(currentIndex - 1));
    const navNext = () => handleIndexChanged(wrapIndex(currentIndex + 1));

    const handlePrev = useCallback(() => {
      if (Platform.OS === "web") {
        (OptimizedWebCarousel as any)._scrollTo?.(currentIndex - 1); // внутри уже wrap
      }
      navPrev();
    }, [currentIndex]);

    const handleNext = useCallback(() => {
      if (Platform.OS === "web") {
        (OptimizedWebCarousel as any)._scrollTo?.(currentIndex + 1); // внутри уже wrap
      }
      navNext();
    }, [currentIndex]);

    const handleDotPress = useCallback(
      (i: number) => {
        const wrapped = wrapIndex(i);
        if (Platform.OS === "web") {
          (OptimizedWebCarousel as any)._scrollTo?.(wrapped);
        }
        handleIndexChanged(wrapped);
      },
      [handleIndexChanged]
    );

    return (
      <View
        style={[styles.wrapper, { height: containerHeight }]}
        onLayout={(e: LayoutChangeEvent) => {
          const newWidth = e.nativeEvent.layout.width;
          if (Math.abs(newWidth - containerWidth) > 10) {
            setContainerWidth(newWidth);
          }
        }}
        accessibilityRole="group"
        accessibilityLabel="Image slider"
      >
        {containerWidth > 0 && containerHeight > 0 && (
          <>
            {Platform.OS === "web" ? (
              <OptimizedWebCarousel
                images={images}
                width={containerWidth}
                height={containerHeight}
                currentIndex={currentIndex}
                onIndexChanged={handleIndexChanged}
                blurBackground={blurBackground}
                onFirstImageLoad={onFirstImageLoad}
              />
            ) : (
              <Suspense
                fallback={
                  <View
                    style={[styles.slide, { width: containerWidth, height: containerHeight }]}
                  >
                    <ExpoImage
                      source={{ uri: uriMap[0] }}
                      style={styles.img}
                      contentFit="contain"
                      priority="high"
                      onLoad={() => handleImageLoad(0)}
                    />
                  </View>
                }
              >
                <NativeCarousel
                  key={imagesKey}
                  data={images}
                  width={containerWidth}
                  height={containerHeight}
                  loop // native уже бесконечный
                  autoPlay={autoPlay}
                  autoPlayInterval={autoPlayInterval}
                  onSnapToItem={handleIndexChanged}
                  renderItem={({ item, index }: { item: SliderImage; index: number }) => {
                    const dims = { width: item.width, height: item.height };
                    const uri = uriMap[index];
                    const isVisible = loadedIndices.has(index);
                    const isPriority = index === 0;
                    const isLoaded = loadedImages.has(index);

                    if (!isVisible) {
                      return <View style={[styles.slide, { backgroundColor: "#e9e7df" }]} />;
                    }

                    return (
                      <View style={styles.slide} collapsable={false}>
                        {/* Фон с блюром — всегда под фото */}
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
                          style={[
                            styles.img,
                            dims.width && dims.height ? { aspectRatio: dims.width / dims.height } : {},
                            { opacity: isLoaded ? 1 : 0 },
                          ]}
                          onLoad={() => handleImageLoad(index)}
                          {...imageProps}
                        />
                      </View>
                    );
                  }}
                />
              </Suspense>
            )}

            {showArrows && !(isMobile && hideArrowsOnMobile) && images.length > 1 && (
              <>
                <NavButton direction="left" offset={NAV_BTN_OFFSET} onPress={handlePrev} />
                <NavButton direction="right" offset={NAV_BTN_OFFSET} onPress={handleNext} />
              </>
            )}

            {showDots && images.length > 1 && (
              <View style={styles.dots} pointerEvents="box-none">
                {images.map((_, i) => {
                  const active = i === currentIndex;
                  return (
                    <TouchableOpacity
                      key={`dot-${i}`}
                      style={styles.dotWrapper}
                      onPress={() => handleDotPress(i)}
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

/* ---------------------------------- Стили ---------------------------------- */

const styles = StyleSheet.create({
  wrapper: {
    width: "100%",
    backgroundColor: "#f9f8f2",
    position: "relative",
    overflow: "hidden",
    borderRadius: 12,
    ...Platform.select({ web: { userSelect: "none" as any } }),
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
    zIndex: 2, // Важно: основное изображение должно быть выше блюра
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
    zIndex: 3, // Точки должны быть выше всего
  },
  dotWrapper: { marginHorizontal: 6, padding: 6 },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(0,0,0,0.2)",
  },
  active: { width: 10, height: 10, backgroundColor: "#000" },
});