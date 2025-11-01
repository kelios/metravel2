// app/travels/[param].tsx
import React, {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  memo,
  useTransition,
} from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
  Pressable,
  DeviceEventEmitter,
  InteractionManager,
} from "react-native";

import { useLocalSearchParams } from "expo-router";
import { useQuery, keepPreviousData, useQueryClient } from "@tanstack/react-query";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image as ExpoImage } from "expo-image";
import { useIsFocused } from "@react-navigation/native";

import { fetchTravel, fetchTravelBySlug, fetchNearTravels } from "@/src/api/travels";
import type { Travel } from "@/src/types/types";
import InstantSEO from "@/components/seo/InstantSEO";

/* ---------- LCP-компонент грузим СИНХРОННО ---------- */
import Slider from "@/components/travel/Slider";

/* -------------------- helpers -------------------- */
const retry = async <T,>(fn: () => Promise<T>, tries = 2, delay = 900): Promise<T> => {
  try {
    return await fn();
  } catch (e) {
    if (tries <= 0) throw e;
    await new Promise((r) => setTimeout(r, delay));
    return retry(fn, tries - 1, delay);
  }
};

const withLazy = <T extends React.ComponentType<any>>(f: () => Promise<{ default: T }>) =>
  lazy(async () => {
    try {
      return await retry(f, 2, 900);
    } catch {
      return {
        default: ((props: any) => (
          <View style={{ padding: 12 }}>
            <Text>Component failed to load</Text>
          </View>
        )) as unknown as T,
      };
    }
  });

/* -------------------- lazy imports (второстепенные) -------------------- */
const TravelDescription = withLazy(() => import("@/components/travel/TravelDescription"));
const PointList = withLazy(() => import("@/components/travel/PointList"));
const NearTravelList = withLazy(() => import("@/components/travel/NearTravelList"));
const PopularTravelList = withLazy(() => import("@/components/travel/PopularTravelList"));
const ToggleableMap = withLazy(() => import("@/components/travel/ToggleableMapSection"));
const MapClientSide = withLazy(() => import("@/components/Map"));
const CompactSideBarTravel = withLazy(() => import("@/components/travel/CompactSideBarTravel"));

const LazyMaterialIcons = withLazy(() =>
  import("@expo/vector-icons/MaterialIcons").then((m: any) => ({
    default: m.MaterialIcons || m.default || m,
  }))
);

const WebViewComponent =
  Platform.OS === "web"
    ? (() => null) as React.ComponentType<any>
    : withLazy(() =>
      import("react-native-webview").then((m: any) => ({
        default: m.default ?? m.WebView,
      }))
    );

const BelkrajWidgetComponent =
  Platform.OS === "web"
    ? withLazy(() => import("@/components/belkraj/BelkrajWidget"))
    : (() => null) as React.ComponentType<any>;

/* -------------------- SuspenseList shim -------------------- */
const SList: React.FC<{
  children: React.ReactNode;
  revealOrder?: "forwards" | "backwards" | "together";
  tail?: "collapsed" | "hidden";
}> = (props) => {
  const Experimental = (React as any).unstable_SuspenseList || (React as any).SuspenseList;
  return Experimental ? <Experimental {...props} /> : <>{props.children}</>;
};

const Fallback = () => (
  <View style={styles.fallback}>
    <ActivityIndicator size="small" />
  </View>
);

const Icon: React.FC<{ name: string; size?: number; color?: string }> = ({
                                                                           name,
                                                                           size = 22,
                                                                           color,
                                                                         }) => (
  <Suspense fallback={<View style={{ width: size, height: size }} />}>
    <LazyMaterialIcons name={name} size={size} color={color} />
  </Suspense>
);

/* -------------------- consts -------------------- */
const MENU_WIDTH = 280;
const HEADER_OFFSET_DESKTOP = 72;
const HEADER_OFFSET_MOBILE = 56;
const MAX_CONTENT_WIDTH = 1200;

/* -------------------- utils -------------------- */
const getYoutubeId = (url?: string | null) => {
  if (!url) return null;
  const m =
    url.match(/(?:youtu\.be\/|shorts\/|embed\/|watch\?v=|watch\?.*?v%3D)([^?&/#]+)/) ||
    url.match(/youtube\.com\/.*?[?&]v=([^?&#]+)/);
  return m?.[1] ?? null;
};

const stripToDescription = (html?: string) => {
  const plain = (html || "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return (plain || "Найди место для путешествия и поделись своим опытом.").slice(0, 160);
};

const getOrigin = (url?: string) => {
  try {
    return url ? new URL(url.replace(/^http:\/\//i, "https://")).origin : null;
  } catch {
    return null;
  }
};

const buildVersioned = (url?: string, updated_at?: string | null, id?: any) => {
  if (!url) return "";
  const base = url.replace(/^http:\/\//i, "https://");
  const ver = updated_at ? Date.parse(updated_at) : id ? Number(id) : 0;
  return ver && Number.isFinite(ver) ? `${base}?v=${ver}` : base;
};

/* -------------------- idle helper -------------------- */
const rIC = (cb: () => void, timeout = 900) => {
  if (typeof (window as any)?.requestIdleCallback === "function") {
    (window as any).requestIdleCallback(cb, { timeout });
  } else {
    setTimeout(cb, timeout);
  }
};

/* -------------------- hooks -------------------- */
const useResponsive = () => {
  const { width } = useWindowDimensions();
  const isMobile = width <= 768;
  return {
    isMobile,
    headerOffset: isMobile ? HEADER_OFFSET_MOBILE : HEADER_OFFSET_DESKTOP,
    width,
  };
};

const useLCPPreload = (travel?: Travel) => {
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const first = travel?.gallery?.[0];
    if (!first?.url) return;

    const href = buildVersioned(first.url, first.updated_at, first.id);
    if (!document.querySelector(`link[rel="preload"][as="image"][href="${href}"]`)) {
      const link = document.createElement("link");
      link.rel = "preload";
      link.as = "image";
      link.href = href;
      link.setAttribute("fetchpriority", "high");
      link.setAttribute("referrerpolicy", "no-referrer");
      document.head.appendChild(link);
    }

    const domains = [
      getOrigin(first.url),
      "https://maps.googleapis.com",
      "https://img.youtube.com",
      "https://api.metravel.by",
    ].filter(Boolean) as string[];

    domains.forEach((d) => {
      if (!document.querySelector(`link[rel="preconnect"][href="${d}"]`)) {
        const l = document.createElement("link");
        l.rel = "preconnect";
        l.href = d;
        l.crossOrigin = "anonymous";
        document.head.appendChild(l);
      }
    });
  }, [travel?.gallery]);
};

/* -------------------- LCP Hero -------------------- */
type ImgLike = {
  url: string;
  width?: number;
  height?: number;
  updated_at?: string | null;
  id?: number | string;
};

const OptimizedLCPHero: React.FC<{ img: ImgLike; alt?: string; onLoad?: () => void }> = ({
                                                                                           img,
                                                                                           alt,
                                                                                           onLoad,
                                                                                         }) => {
  const src = buildVersioned(img.url, img.updated_at ?? null, img.id);
  const ratio = img.width && img.height ? img.width / img.height : 16 / 9;

  if (Platform.OS !== "web") {
    return (
      <View style={styles.sliderContainer}>
        <ExpoImage
          source={{ uri: src }}
          style={{ width: "100%", aspectRatio: ratio, borderRadius: 12 }}
          contentFit="cover"
          cachePolicy="memory-disk"
          priority="high"
          onLoad={onLoad}
        />
      </View>
    );
  }

  return (
    <div style={{ width: "100%", contain: "layout style paint" as any }}>
      <img
        src={src}
        alt={alt || ""}
        width={img.width || 1200}
        height={img.height || Math.round(1200 / ratio)}
        style={{
          width: "100%",
          height: "auto",
          aspectRatio: String(ratio),
          borderRadius: 12,
          display: "block",
          background: "#e9e7df",
        }}
        loading="eager"
        decoding="async"
        // @ts-ignore
        fetchpriority="high"
        referrerPolicy="no-referrer"
        onLoad={onLoad as any}
      />
    </div>
  );
};

/* -------------------- Collapsible section -------------------- */
const CollapsibleSection: React.FC<{
  title: string;
  initiallyOpen?: boolean;
  forceOpen?: boolean;
  children: React.ReactNode;
}> = memo(({ title, initiallyOpen = false, forceOpen = false, children }) => {
  const [open, setOpen] = useState(initiallyOpen);
  useEffect(() => {
    if (forceOpen) setOpen(true);
  }, [forceOpen]);

  return (
    <View style={[styles.sectionContainer, styles.contentStable]} collapsable={false}>
      <TouchableOpacity
        accessibilityRole="button"
        onPress={() => setOpen((o) => !o)}
        style={styles.sectionHeaderBtn}
        hitSlop={10}
        accessibilityLabel={`Раздел: ${title}`}
      >
        <Text style={styles.sectionHeaderText}>{title}</Text>
        <Icon name={open ? "expand-less" : "expand-more"} size={22} />
      </TouchableOpacity>
      {open ? <View style={{ marginTop: 12 }}>{children}</View> : null}
    </View>
  );
});

/* -------------------- Lazy YouTube -------------------- */
const LazyYouTube: React.FC<{ url: string }> = ({ url }) => {
  const id = useMemo(() => getYoutubeId(url), [url]);
  const [mounted, setMounted] = useState(false);
  if (!id) return null;

  if (!mounted) {
    return (
      <Pressable
        onPress={() => setMounted(true)}
        style={styles.videoContainer}
        accessibilityRole="button"
        accessibilityLabel="Смотреть видео"
      >
        <ExpoImage
          source={{ uri: `https://img.youtube.com/vi/${id}/hqdefault.jpg` }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          cachePolicy="memory-disk"
        />
        <View style={styles.playOverlay}>
          <Icon name="play-circle-fill" size={64} color="#ffffff" />
        </View>
      </Pressable>
    );
  }

  return Platform.OS === "web" ? (
    <div
      style={{
        width: "100%",
        aspectRatio: "16 / 9",
        borderRadius: 12,
        overflow: "hidden",
        background: "#000",
        contain: "layout style paint" as any,
      }}
    >
      <iframe
        src={`https://www.youtube.com/embed/${id}`}
        width="100%"
        height="100%"
        style={{ border: "none", display: "block" }}
        loading="lazy"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        title="YouTube video"
      />
    </div>
  ) : (
    <Suspense fallback={<Fallback />}>
      <View style={styles.videoContainer}>
        <WebViewComponent source={{ uri: `https://www.youtube.com/embed/${id}` }} style={{ flex: 1 }} />
      </View>
    </Suspense>
  );
};

/* -------------------- Defer wrapper -------------------- */
const Defer: React.FC<{ when: boolean; children: React.ReactNode }> = ({ when, children }) => {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!when) return;
    let done = false;
    const kick = () => {
      if (!done) {
        done = true;
        setReady(true);
      }
    };
    rIC(kick, 1500);
    const t = setTimeout(kick, 2600);
    return () => clearTimeout(t);
  }, [when]);
  return ready ? <>{children}</> : null;
};

/* =================================================================== */

export default function TravelDetails() {
  const { isMobile, headerOffset } = useResponsive();
  const insets = useSafeAreaInsets();
  const [menuOpen, setMenuOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const { param } = useLocalSearchParams();
  const slug = Array.isArray(param) ? param[0] : (param ?? "");
  const idNum = Number(slug);
  const isId = !Number.isNaN(idNum);

  const queryClient = useQueryClient();

  const { data: travel, isLoading, isError } = useQuery<Travel>({
    queryKey: ["travel", slug],
    queryFn: () => (isId ? fetchTravel(idNum) : fetchTravelBySlug(slug)),
    staleTime: 600_000,
    placeholderData: keepPreviousData,
  });

  useLCPPreload(travel);

  /* ---- warm up heavy lazy chunks on web (без Slider) ---- */
  useEffect(() => {
    if (Platform.OS !== "web") return;
    rIC(() => {
      Promise.allSettled([
        import("@/components/travel/TravelDescription"),
        import("@/components/travel/PointList"),
        import("@/components/travel/NearTravelList"),
        import("@/components/travel/PopularTravelList"),
        import("@/components/travel/ToggleableMapSection"),
        import("@/components/Map"),
        import("@expo/vector-icons/MaterialIcons"),
      ]);
    }, 800);
  }, []);

  /* ---- user flags ---- */
  const [isSuperuser, setIsSuperuser] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => {
    let mounted = true;
    AsyncStorage.multiGet(["isSuperuser", "userId"])
      .then(([[, su], [, uid]]) => {
        if (mounted) {
          setIsSuperuser(su === "true");
          setUserId(uid);
        }
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  /* ---- open-section bridge ---- */
  const [forceOpenKey, setForceOpenKey] = useState<string | null>(null);
  const handleSectionOpen = useCallback((key: string) => {
    startTransition(() => setForceOpenKey(key));
  }, []);
  useEffect(() => {
    const handler =
      Platform.OS === "web"
        ? (e: any) => handleSectionOpen(e?.detail?.key ?? "")
        : (key: string) => handleSectionOpen(key);

    if (Platform.OS === "web") {
      window.addEventListener("open-section", handler as EventListener, { passive: true } as any);
      return () => window.removeEventListener("open-section", handler as EventListener);
    } else {
      const sub = DeviceEventEmitter.addListener("open-section", handler);
      return () => sub.remove();
    }
  }, [handleSectionOpen]);

  /* ---- anchors ---- */
  const anchors = useMemo(
    () => ({
      gallery: React.createRef<View>(),
      video: React.createRef<View>(),
      description: React.createRef<View>(),
      recommendation: React.createRef<View>(),
      plus: React.createRef<View>(),
      minus: React.createRef<View>(),
      map: React.createRef<View>(),
      points: React.createRef<View>(),
      near: React.createRef<View>(),
      popular: React.createRef<View>(),
      excursions: React.createRef<View>(),
    }),
    []
  );

  const scrollRef = useRef<ScrollView>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [slug]);

  const scrollTo = useCallback(
    (k: keyof typeof anchors) => {
      const node = anchors[k]?.current;
      if (!node || !scrollRef.current) return;
      // @ts-ignore RN Web + Native
      node.measureLayout(
        scrollRef.current!.getInnerViewNode(),
        (_x: number, y: number) => {
          scrollRef.current!.scrollTo({ y: Math.max(0, y - headerOffset), animated: true });
        },
        () => {}
      );
      if (isMobile) closeMenu();
    },
    [anchors, headerOffset, isMobile]
  );

  /* ---- side menu animation ---- */
  const animatedX = useRef(new Animated.Value(-MENU_WIDTH)).current;
  const animateMenu = useCallback(
    (open: boolean) => {
      Animated.timing(animatedX, {
        toValue: open ? 0 : -MENU_WIDTH,
        duration: 230,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    },
    [animatedX]
  );
  const toggleMenu = () => {
    const n = !menuOpen;
    setMenuOpen(n);
    animateMenu(n);
  };
  const closeMenu = () => {
    if (menuOpen) {
      setMenuOpen(false);
      animateMenu(false);
    }
  };

  /* ---- prefetch near travels ---- */
  useEffect(() => {
    if (travel?.id) {
      rIC(() => {
        queryClient.prefetchQuery({
          queryKey: ["nearTravels", travel.id],
          queryFn: () => fetchNearTravels(travel.id as number),
        });
      }, 1100);
    }
  }, [travel?.id, queryClient]);

  /* ---- LCP gate ---- */
  const [lcpLoaded, setLcpLoaded] = useState(false);
  const [deferAllowed, setDeferAllowed] = useState(false);
  useEffect(() => {
    if (lcpLoaded) setDeferAllowed(true);
    else rIC(() => setDeferAllowed(true), 2000);
  }, [lcpLoaded]);

  /* ---- show menu on desktop after defer ---- */
  useEffect(() => {
    if (deferAllowed && !isMobile) {
      animatedX.setValue(0);
      setMenuOpen(true);
    }
  }, [deferAllowed, isMobile, animatedX]);

  const SITE = process.env.EXPO_PUBLIC_SITE_URL || "https://metravel.by";
  const isFocused = useIsFocused();
  const canonicalUrl = `${SITE}/travels/${slug}`;

  const loadingTitle = "MeTravel — Путешествие";
  const loadingDesc = "Загружаем описание путешествия…";
  const errorTitle = "MeTravel — Ошибка загрузки";
  const errorDesc = "Не удалось загрузить путешествие.";
  const readyTitle = travel?.name ? `${travel.name} — MeTravel` : loadingTitle;
  const readyDesc = stripToDescription(travel?.description);
  const firstImg = (travel?.gallery?.[0] ?? null) as unknown as ImgLike | null;
  const readyImage = firstImg?.url
    ? buildVersioned(firstImg.url, firstImg.updated_at ?? null, firstImg.id)
    : `${SITE}/og-preview.jpg`;
  const firstImgOrigin = getOrigin(firstImg?.url);
  const headKey = `travel-${slug}`;
  const firstRatio =
    (firstImg?.width && firstImg?.height ? firstImg.width / firstImg.height : undefined) || 16 / 9;

  const jsonLd =
    travel &&
    ({
      "@context": "https://schema.org",
      "@type": "Article",
      headline: travel.name,
      image: [readyImage],
      dateModified: travel.updated_at ?? undefined,
      datePublished: travel.created_at ?? undefined,
      author: travel.author?.name ? [{ "@type": "Person", name: travel.author.name }] : undefined,
      mainEntityOfPage: canonicalUrl,
      description: readyDesc,
    } as const);

  /* -------------------- LOADING -------------------- */
  if (isLoading) {
    return (
      <>
        {isFocused && (
          <InstantSEO
            headKey={headKey}
            title={loadingTitle}
            description={loadingDesc}
            canonical={canonicalUrl}
            image={`${SITE}/og-preview.jpg`}
            ogType="article"
            additionalTags={<meta name="theme-color" content="#f9f8f2" />}
          />
        )}
        <View style={styles.center}>
          <ActivityIndicator size="large" />
        </View>
      </>
    );
  }

  /* -------------------- ERROR -------------------- */
  if (isError || !travel) {
    return (
      <>
        {isFocused && (
          <InstantSEO
            headKey={headKey}
            title={errorTitle}
            description={errorDesc}
            canonical={canonicalUrl}
            image={`${SITE}/og-preview.jpg`}
            ogType="article"
            additionalTags={<meta name="theme-color" content="#f9f8f2" />}
          />
        )}
        <View style={styles.center}>
          <Text>Ошибка загрузки</Text>
        </View>
      </>
    );
  }

  /* -------------------- READY -------------------- */
  return (
    <>
      {isFocused && (
        <InstantSEO
          headKey={headKey}
          title={readyTitle}
          description={readyDesc}
          canonical={canonicalUrl}
          image={readyImage}
          ogType="article"
          additionalTags={
            <>
              {firstImg?.url && (
                <>
                  <link rel="preload" as="image" href={readyImage} fetchpriority="high" />
                  {firstImgOrigin && <link rel="preconnect" href={firstImgOrigin} crossOrigin="anonymous" />}
                </>
              )}
              <meta name="theme-color" content="#f9f8f2" />
              {jsonLd && (
                <script
                  type="application/ld+json"
                  dangerouslySetInnerHTML={{
                    __html: JSON.stringify(jsonLd),
                  }}
                />
              )}
            </>
          }
        />
      )}

      <View style={styles.wrapper}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.mainContainer}>
            {/* spacer under desktop menu */}
            {!isMobile && <View style={{ width: MENU_WIDTH }} />}

            {/* side menu (deferred) */}
            <Defer when={deferAllowed}>
              <Animated.View
                style={[
                  styles.sideMenu,
                  {
                    transform: [{ translateX: animatedX }],
                    width: MENU_WIDTH,
                    zIndex: 1000,
                  },
                ]}
              >
                <Suspense fallback={<Fallback />}>
                  <CompactSideBarTravel
                    travel={travel}
                    isSuperuser={isSuperuser}
                    storedUserId={userId}
                    isMobile={isMobile}
                    refs={anchors}
                    closeMenu={() => closeMenu()}
                    onNavigate={scrollTo}
                  />
                </Suspense>
              </Animated.View>
            </Defer>

            {/* mobile FAB */}
            {isMobile && (
              <Defer when={deferAllowed}>
                <TouchableOpacity
                  onPress={toggleMenu}
                  style={[styles.fab, { top: insets.top + 10 }]}
                  hitSlop={12}
                  accessibilityRole="button"
                  accessibilityLabel="Открыть меню разделов"
                >
                  <Icon name={menuOpen ? "close" : "menu"} size={24} color="#fff" />
                </TouchableOpacity>
              </Defer>
            )}

            <ScrollView
              ref={scrollRef}
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              style={styles.scrollView}
              nestedScrollEnabled
              scrollEventThrottle={16}
            >
              <View style={styles.contentOuter} collapsable={false}>
                <View style={styles.contentWrapper} collapsable={false}>
                  <SList revealOrder="forwards" tail="collapsed">
                    <View ref={anchors.gallery} collapsable={false} />

                    {!!firstImg && (
                      <View style={[styles.sectionContainer, styles.contentStable]} collapsable={false}>
                        <View style={styles.sliderContainer} collapsable={false}>
                          {/* LCP: синхронный Slider */}
                          <Slider
                            key={isMobile ? "mobile" : "desktop"}
                            images={travel.gallery}
                            showArrows={!isMobile}
                            hideArrowsOnMobile
                            showDots={isMobile}
                            preloadCount={isMobile ? 1 : 2}
                            blurBackground
                            aspectRatio={
                              (firstImg?.width && firstImg?.height
                                ? firstImg.width / firstImg.height
                                : 16 / 9) as number
                            }
                            mobileHeightPercent={0.7}
                            onFirstImageLoad={() => setLcpLoaded(true)}
                          />
                        </View>
                      </View>
                    )}

                    {/* -------- deferred heavy content -------- */}
                    <Defer when={deferAllowed}>
                      <DeferredContent
                        travel={travel}
                        isMobile={isMobile}
                        forceOpenKey={forceOpenKey}
                        anchors={anchors}
                      />
                    </Defer>
                  </SList>
                </View>
              </View>
            </ScrollView>
          </View>
        </SafeAreaView>
      </View>
    </>
  );
}

/* -------------------- Deferred sections -------------------- */
const DeferredContent: React.FC<{
  travel: Travel;
  isMobile: boolean;
  forceOpenKey: string | null;
  anchors: {
    gallery: React.RefObject<View>;
    video: React.RefObject<View>;
    description: React.RefObject<View>;
    recommendation: React.RefObject<View>;
    plus: React.RefObject<View>;
    minus: React.RefObject<View>;
    map: React.RefObject<View>;
    points: React.RefObject<View>;
    near: React.RefObject<View>;
    popular: React.RefObject<View>;
    excursions: React.RefObject<View>;
  };
}> = ({ travel, isMobile, forceOpenKey, anchors }) => {
  const [canRenderHeavy, setCanRenderHeavy] = useState(Platform.OS === "web");

  useEffect(() => {
    if (Platform.OS !== "web") {
      const task = InteractionManager.runAfterInteractions(() => setCanRenderHeavy(true));
      return () => task.cancel();
    }
  }, []);

  const [visible, setVisible] = useState({
    map: Platform.OS !== "web",
    near: true,
    popular: true,
    excursions: true,
  });

  useEffect(() => {
    setVisible((v) => ({ ...v, map: v.map || Platform.OS === "web" }));
  }, []);

  return (
    <>
      {[
        { key: "description", ref: anchors.description, html: travel.description, title: travel.name },
        { key: "recommendation", ref: anchors.recommendation, html: travel.recommendation, title: "Рекомендации" },
        { key: "plus", ref: anchors.plus, html: travel.plus, title: "Плюсы" },
        { key: "minus", ref: anchors.minus, html: travel.minus, title: "Минусы" },
      ].map(({ key, ref, html, title }) =>
        html ? (
          <Suspense key={key} fallback={<Fallback />}>
            <View ref={ref} collapsable={false}>
              <CollapsibleSection title={title} initiallyOpen={!isMobile} forceOpen={forceOpenKey === key}>
                <View style={styles.descriptionContainer}>
                  <TravelDescription title={title} htmlContent={html} noBox />
                </View>
              </CollapsibleSection>
            </View>
          </Suspense>
        ) : null
      )}

      {travel.youtube_link && (
        <View style={[styles.sectionContainer, styles.contentStable]} ref={anchors.video} collapsable={false}>
          <Text style={styles.sectionHeaderText}>Видео</Text>
          <View style={{ marginTop: 12 }}>
            <LazyYouTube url={travel.youtube_link} />
          </View>
        </View>
      )}

      {Platform.OS === "web" &&
        visible.excursions &&
        (travel.travelAddress?.length ?? 0) > 0 && (
          <Suspense fallback={<Fallback />}>
            <View ref={anchors.excursions} style={[styles.sectionContainer, styles.contentStable]} collapsable={false}>
              <Text style={styles.sectionHeaderText}>Экскурсии</Text>
              <View style={{ marginTop: 12 }}>
                <BelkrajWidgetComponent
                  countryCode={travel.countryCode}
                  points={travel.travelAddress}
                  collapsedHeight={600}
                  expandedHeight={1000}
                />
              </View>
            </View>
          </Suspense>
        )}

      <View ref={anchors.map} style={[styles.sectionContainer, styles.contentStable]} collapsable={false}>
        <Text style={styles.sectionHeaderText}></Text>
        <View style={{ marginTop: 12 }}>
          {canRenderHeavy && visible.map && (travel.coordsMeTravel?.length ?? 0) > 0 && (
            <Suspense fallback={<Fallback />}>
              <ToggleableMap>
                <MapClientSide travel={{ data: travel.travelAddress }} />
              </ToggleableMap>
            </Suspense>
          )}
        </View>
      </View>

      <View ref={anchors.points} style={[styles.sectionContainer, styles.contentStable]} collapsable={false}>
        <Text style={styles.sectionHeaderText}></Text>
        <View style={{ marginTop: 12 }}>
          {travel.travelAddress && (
            <Suspense fallback={<Fallback />}>
              <PointList points={travel.travelAddress} />
            </Suspense>
          )}
        </View>
      </View>

      <View ref={anchors.near} style={[styles.sectionContainer, styles.contentStable]} collapsable={false}>
        <Text style={styles.sectionHeaderText}></Text>
        <View style={{ marginTop: 12 }}>
          {visible.near && travel.travelAddress && (
            <Suspense fallback={<Fallback />}>
              <NearTravelList travel={travel} />
            </Suspense>
          )}
        </View>
      </View>

      <View ref={anchors.popular} style={[styles.sectionContainer, styles.contentStable]} collapsable={false}>
        <Text style={styles.sectionHeaderText}></Text>
        <View style={{ marginTop: 12 }}>
          {visible.popular && (
            <Suspense fallback={<Fallback />}>
              <PopularTravelList />
            </Suspense>
          )}
        </View>
      </View>
    </>
  );
};

/* -------------------- styles -------------------- */
const ANDROID_ELEVATION_CARD = Platform.select({ android: 2, default: 0 });
const ANDROID_ELEVATION_MENU = Platform.select({ android: 5, default: 0 });

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: "#f9f8f2" },
  safeArea: { flex: 1 },
  mainContainer: { flex: 1, flexDirection: "row" },

  sideMenu: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    backgroundColor: "#fff",
    shadowColor: Platform.OS === "ios" ? "#000" : "transparent",
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: Platform.OS === "ios" ? 0.1 : 0,
    shadowRadius: Platform.OS === "ios" ? 4 : 0,
    elevation: ANDROID_ELEVATION_MENU,
  },

  fab: {
    position: "absolute",
    right: 14,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(47,51,46,0.72)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1001,
  },

  scrollView: { flex: 1, backgroundColor: "#f9f8f2" },
  scrollContent: {
    paddingBottom: 40,
    minHeight: Platform.OS === "web" ? ("100vh" as any) : undefined,
  },
  contentOuter: { width: "100%", alignItems: "center" },
  contentWrapper: {
    flex: 1,
    width: "100%",
    maxWidth: MAX_CONTENT_WIDTH,
    paddingHorizontal: 16,
  },

  sectionContainer: {
    width: "100%",
    maxWidth: MAX_CONTENT_WIDTH,
    alignSelf: "center",
    marginBottom: 16,
  },

  contentStable: {
    contain: "layout style paint" as any,
  },

  sectionHeaderBtn: {
    width: "100%",
    minHeight: 44,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
    backgroundColor: "#ffffff",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: Platform.OS === "ios" ? "#000" : "transparent",
    shadowOpacity: Platform.OS === "ios" ? 0.06 : 0,
    shadowRadius: Platform.OS === "ios" ? 2 : 0,
    shadowOffset: { width: 0, height: 1 },
    elevation: ANDROID_ELEVATION_CARD,
  },

  sectionHeaderText: { fontSize: 16, fontWeight: "600" },

  sliderContainer: { width: "100%" },

  videoContainer: {
    width: "100%",
    aspectRatio: 16 / 9,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#000",
  },

  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },

  descriptionContainer: {
    width: "100%",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    shadowColor: Platform.OS === "ios" ? "#000" : "transparent",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: Platform.OS === "ios" ? 0.05 : 0,
    shadowRadius: Platform.OS === "ios" ? 2 : 0,
    elevation: ANDROID_ELEVATION_CARD,
  },

  fallback: { paddingVertical: 24, alignItems: "center" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#f9f8f2" },
});
