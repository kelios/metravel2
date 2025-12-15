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
  LayoutChangeEvent,
} from "react-native";

import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image as ExpoImage } from "expo-image";
import { useIsFocused } from "@react-navigation/native";
import { MaterialIcons } from "@expo/vector-icons";
import { useAuth } from '@/context/AuthContext';
import { METRICS } from '@/constants/layout';


/* ✅ УЛУЧШЕНИЕ: Импорт компонентов навигации и поделиться */
import NavigationArrows from "@/components/travel/NavigationArrows";
import ShareButtons from "@/components/travel/ShareButtons";
import TelegramDiscussionSection from "@/components/travel/TelegramDiscussionSection";
import type { Travel } from "@/src/types/types";
/* ✅ АРХИТЕКТУРА: Импорт кастомных хуков */
import { useTravelDetails } from "@/hooks/useTravelDetails";
import { useActiveSection } from "@/hooks/useActiveSection";
import { useScrollNavigation } from "@/hooks/useScrollNavigation";
import { useMenuState } from "@/hooks/useMenuState";
import InstantSEO from "@/components/seo/InstantSEO";
import ScrollToTopButton from "@/components/ScrollToTopButton";
import ReadingProgressBar from "@/components/ReadingProgressBar";
import TravelSectionTabs from "@/components/travel/TravelSectionTabs";
import { buildTravelSectionLinks, type TravelSectionLink } from "@/components/travel/sectionLinks";
import usePerformanceOptimization from '@/hooks/usePerformanceOptimization';
import { useProgressiveLoad, ProgressiveWrapper } from '@/hooks/useProgressiveLoading';
import { optimizeImageUrl, getOptimalImageSize, buildVersionedImageUrl as buildVersionedImageUrlLCP } from "@/utils/imageOptimization";
import { injectCriticalStyles } from '@/styles/criticalCSS';
import { initPerformanceMonitoring } from '@/utils/performanceMonitoring';
import { SectionSkeleton } from '@/components/SectionSkeleton';
import { OptimizedLCPImage } from '@/components/OptimizedLCPImage';
import { optimizeCriticalPath } from '@/utils/advancedPerformanceOptimization';
import { SkeletonLoader } from '@/components/SkeletonLoader';

/* ---------- LCP-компонент грузим СИНХРОННО ---------- */
import Slider from "@/components/travel/Slider";

/* ✅ УЛУЧШЕНИЕ: Skeleton loaders для улучшенного UX */
import { 
  DescriptionSkeleton, 
  MapSkeleton, 
  PointListSkeleton, 
  TravelListSkeleton
} from "@/components/travel/TravelDetailSkeletons";

/* ✅ УЛУЧШЕНИЕ: QuickFacts компонент для быстрых фактов */
import QuickFacts from "@/components/travel/QuickFacts";
/* ✅ БИЗНЕС-ОПТИМИЗАЦИЯ: Компоненты для engagement */
import AuthorCard from "@/components/travel/AuthorCard";
import CTASection from "@/components/travel/CTASection";
import { DESIGN_TOKENS } from '@/constants/designSystem';

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
          <View style={{ padding: DESIGN_TOKENS.spacing.md }}>
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

// Обёртка для ленивой загрузки секции "Экскурсии" (Belkraj) по скроллу на web
const ExcursionsLazySection: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // На native просто рендерим сразу
  if (Platform.OS !== "web") {
    return <>{children}</>;
  }

  const containerRef = useRef<any>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (visible) return; // уже показали
    if (typeof window === "undefined" || typeof document === "undefined") {
      setVisible(true);
      return;
    }

    // Если IntersectionObserver недоступен, показываем сразу
    if (!("IntersectionObserver" in window)) {
      setVisible(true);
      return;
    }

    // Получаем DOM-узел из ref React Native Web
    const rawNode = containerRef.current as any;
    const targetNode = rawNode?._nativeNode || rawNode?._domNode || rawNode || null;
    if (!targetNode) {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry && entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      {
        // Подгружаем чуть заранее, когда секция приближается к нижней границе экрана
        root: null,
        rootMargin: "200px 0px 0px 0px",
        threshold: 0.1,
      }
    );

    observer.observe(targetNode as Element);

    return () => {
      observer.disconnect();
    };
  }, [visible]);

  return (
    <View ref={containerRef} collapsable={false}>
      {visible ? children : null}
    </View>
  );
};

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

// ✅ УЛУЧШЕНИЕ: Более информативные fallbacks для разных компонентов
const DescriptionFallback = () => (
  <View style={styles.fallback}>
    <DescriptionSkeleton />
  </View>
);

const MapFallback = () => (
  <View style={styles.fallback}>
    <MapSkeleton />
  </View>
);

const PointListFallback = () => (
  <View style={styles.fallback}>
    <PointListSkeleton />
  </View>
);

const TravelListFallback = () => (
  <View style={styles.fallback}>
    <TravelListSkeleton count={3} />
  </View>
);

const TravelDetailsLoadingSkeleton = () => (
  <View
    style={[
      styles.wrapper,
      Platform.OS === "web" &&
        ({
          // @ts-ignore - web-specific CSS property
          backgroundImage: "linear-gradient(180deg, #ffffff 0%, #f9f8f2 100%)",
        } as any),
    ]}
  >
    <SafeAreaView style={styles.safeArea}>
      <View style={[styles.mainContainer, styles.mainContainerMobile]}>
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            Platform.OS === "web" && { paddingTop: HEADER_OFFSET_MOBILE },
          ]}
          style={styles.scrollView}
        >
          <View style={styles.contentOuter} collapsable={false}>
            <View style={[styles.contentWrapper, { paddingHorizontal: 16 }]} collapsable={false}>
              <View style={[styles.sectionContainer, styles.contentStable]}>
                <SkeletonLoader width="100%" height={320} borderRadius={16} />
                <View style={{ marginTop: 14 }}>
                  <SkeletonLoader width="70%" height={24} borderRadius={8} style={{ marginBottom: 10 }} />
                  <SkeletonLoader width="90%" height={16} borderRadius={8} style={{ marginBottom: 8 }} />
                  <SkeletonLoader width="82%" height={16} borderRadius={8} />
                </View>
              </View>

              <View style={[styles.sectionContainer, styles.contentStable]}>
                <Text style={styles.sectionHeaderText}>Описание</Text>
                <View style={{ marginTop: 12 }}>
                  <DescriptionSkeleton />
                </View>
              </View>

              <View style={[styles.sectionContainer, styles.contentStable]}>
                <Text style={styles.sectionHeaderText}>Карта маршрута</Text>
                <View style={{ marginTop: 12 }}>
                  <MapSkeleton />
                </View>
              </View>
            </View>
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  </View>
);

const Icon: React.FC<{ name: string; size?: number; color?: string }> = ({
  name,
  size = 22,
  color,
}) => (
  <Suspense fallback={<View style={{ width: size, height: size }} />}>
    <LazyMaterialIcons 
      // @ts-ignore - MaterialIcons name prop
      name={name} 
      size={size} 
      color={color} 
    />
  </Suspense>
);

/* -------------------- consts -------------------- */
// ✅ UX УЛУЧШЕНИЕ: Адаптивная ширина меню (увеличено для полного устранения скролла)
const getMenuWidth = (width: number) => {
  if (width >= 1200) return 380; // Десктоп (>1200px): 380px (было 360)
  if (width >= 768) return 320; // Планшеты (768-1200px): 320px (было 300)
  return '100%'; // Мобильные: 100% (fullscreen overlay)
};
const MENU_WIDTH_DESKTOP = 380; // ✅ UX: Увеличено с 360 для длинных названий погоды
const MENU_WIDTH_TABLET = 320;  // ✅ UX: Увеличено с 300 для полного устранения скролла
const HEADER_OFFSET_DESKTOP = 72;
const HEADER_OFFSET_MOBILE = 56;
const MAX_CONTENT_WIDTH = 1200;
const FAB_HINT_STORAGE_KEY = "travel:floatingMenu:hintShown";

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
  const isMobile = width <= METRICS.breakpoints.tablet;
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
    if (!first) return;

    // Handle both string URLs and object format
    const imageUrl = typeof first === 'string' ? first : first.url;
    const updatedAt = typeof first === 'string' ? undefined : first.updated_at;
    const id = typeof first === 'string' ? undefined : first.id;
    
    if (!imageUrl) return;

    const versionedHref = buildVersioned(imageUrl, updatedAt, id);
    const targetWidth = typeof window !== "undefined" ? Math.min(window.innerWidth || 1200, 1440) : 1200;
    const optimizedHref =
      optimizeImageUrl(versionedHref, {
        width: targetWidth,
        format: "webp",
        quality: 85,
        fit: "contain",
      }) || versionedHref;

    // Preload the exact URL that will be used for LCP (optimized), otherwise the preload can be wasted.
    if (!document.querySelector(`link[rel="preload"][as="image"][href="${optimizedHref}"]`)) {
      const link = document.createElement("link");
      link.rel = "preload";
      link.as = "image";
      link.href = optimizedHref;
      link.setAttribute("fetchpriority", "high");
      link.setAttribute("referrerpolicy", "no-referrer");
      document.head.appendChild(link);
    }

    const domains = [
      getOrigin(imageUrl),
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
  const baseSrc = buildVersionedImageUrlLCP(
    buildVersioned(img.url, img.updated_at ?? null, img.id),
    img.updated_at ?? null,
    img.id
  );
  const ratio = img.width && img.height ? img.width / img.height : 16 / 9;
  const targetWidth = typeof window !== "undefined" ? Math.min(window.innerWidth || 1200, 1440) : 1200;

  const optimizedSrc =
    optimizeImageUrl(baseSrc, {
      width: targetWidth,
      format: "webp",
      quality: 85,
      fit: "contain",
    }) || baseSrc;

  if (Platform.OS !== "web") {
    return (
      <View style={{ width: "100%", height: "100%" }}>
        <ExpoImage
          source={{ uri: optimizedSrc }}
          style={{ width: "100%", height: "100%", borderRadius: 12 }}
          contentFit="cover"
          cachePolicy="memory-disk"
          priority="high"
          onLoad={onLoad}
        />
      </View>
    );
  }

  return (
    <div style={{ width: "100%", height: "100%", contain: "layout style paint" as any }}>
      <img
        src={optimizedSrc}
        alt={alt || ""}
        width={img.width || 1200}
        height={img.height || Math.round(1200 / ratio)}
        style={{
          width: "100%",
          height: "100%",
          borderRadius: 12,
          display: "block",
          backgroundColor: "#e9e7df",
          objectFit: "cover",
        }}
        loading="eager"
        decoding="async"
        // @ts-ignore
        fetchpriority="high"
        referrerPolicy="no-referrer"
        data-lcp
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
  iconName?: string;
  highlight?: "default" | "positive" | "negative" | "info";
  badgeLabel?: string;
  open?: boolean;
  onToggle?: (next: boolean) => void;
  children: React.ReactNode;
}> = memo(
  ({
     title,
     initiallyOpen = false,
     forceOpen = false,
     iconName,
     highlight = "default",
     badgeLabel,
     open: controlledOpen,
     onToggle,
     children,
   }) => {
    const isControlled = typeof controlledOpen === "boolean";
    const [internalOpen, setInternalOpen] = useState(initiallyOpen);
    const open = isControlled ? (controlledOpen as boolean) : internalOpen;

    useEffect(() => {
      if (forceOpen) {
        if (isControlled) {
          onToggle?.(true);
        } else {
          setInternalOpen(true);
        }
      }
    }, [forceOpen, isControlled, onToggle]);

    const handleToggle = useCallback(() => {
      if (isControlled) {
        onToggle?.(!controlledOpen);
      } else {
        setInternalOpen((o) => !o);
      }
    }, [controlledOpen, isControlled, onToggle]);

    return (
      <View style={[styles.sectionContainer, styles.contentStable]} collapsable={false}>
        <TouchableOpacity
          accessibilityRole="button"
          onPress={handleToggle}
          style={[
            styles.sectionHeaderBtn,
            highlight === "positive" && styles.sectionHeaderPositive,
            highlight === "negative" && styles.sectionHeaderNegative,
            highlight === "info" && styles.sectionHeaderInfo,
            open && styles.sectionHeaderActive,
          ]}
          hitSlop={10}
          accessibilityLabel={`Раздел: ${title}`}
        >
          <View style={styles.sectionHeaderTitleWrap}>
            {iconName && (
              <View style={styles.sectionHeaderIcon}>
                <Icon name={iconName} size={18} color={DESIGN_TOKENS.colors.primary} />
              </View>
            )}
            <Text style={styles.sectionHeaderText}>{title}</Text>
          </View>
          <View style={styles.sectionHeaderRight}>
            {badgeLabel && <Text style={styles.sectionHeaderBadge}>{badgeLabel}</Text>}
            <Icon name={open ? "expand-less" : "expand-more"} size={22} />
          </View>
        </TouchableOpacity>
        {open ? <View style={{ marginTop: 12 }}>{children}</View> : null}
      </View>
    );
  }
);

/* -------------------- Lazy YouTube -------------------- */
const LazyYouTube: React.FC<{ url: string }> = ({ url }) => {
  const id = useMemo(() => getYoutubeId(url), [url]);
  const [mounted, setMounted] = useState(false);
  const [shouldAutoplay, setShouldAutoplay] = useState(false);

  const embedUrl = useMemo(() => {
    if (!id) return null;
    const params = [
      `autoplay=${shouldAutoplay ? 1 : 0}`,
      `mute=${shouldAutoplay ? 1 : 0}`,
      "playsinline=1",
      "rel=0",
      "modestbranding=1",
    ].join("&");
    return `https://www.youtube.com/embed/${id}?${params}`;
  }, [id, shouldAutoplay]);

  const handlePreviewPress = useCallback(() => {
    setMounted(true);
    setShouldAutoplay(true);
  }, []);

  if (!id) return null;

  if (!mounted) {
    return (
      <Pressable
        onPress={handlePreviewPress}
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
          <Icon name="play-circle-fill" size={64} color={DESIGN_TOKENS.colors.surface} />
          <Text style={styles.videoHintText}>Видео запустится автоматически</Text>
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
        backgroundColor: DESIGN_TOKENS.colors.text,
        contain: "layout style paint" as any,
      }}
    >
      <iframe
        src={embedUrl ?? undefined}
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
        <WebViewComponent
          source={{ uri: embedUrl ?? `https://www.youtube.com/embed/${id}` }}
          style={{ flex: 1 }}
          mediaPlaybackRequiresUserAction={false}
          allowsInlineMediaPlayback
          allowsFullscreenVideo
        />
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
  const { isMobile, headerOffset, width } = useResponsive();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  // ✅ УЛУЧШЕНИЕ: Состояние для похожих путешествий (для навигации)
  const [relatedTravels, setRelatedTravels] = useState<Travel[]>([]);
  const [showFabHint, setShowFabHint] = useState(false);

  // ✅ АРХИТЕКТУРА: Использование кастомных хуков
  const { travel, isLoading, isError, slug, isId } = useTravelDetails();
  const { anchors, scrollTo, scrollRef } = useScrollNavigation() as { anchors: AnchorsMap; scrollTo: any; scrollRef: any };
  const { activeSection, setActiveSection } = useActiveSection(anchors, headerOffset);
  const { menuOpen, toggleMenu, closeMenu, animatedX, menuWidth, menuWidthNum, openMenuOnDesktop } =
    useMenuState(isMobile);
  const sectionLinks = useMemo(() => buildTravelSectionLinks(travel), [travel]);
  const contentHorizontalPadding = useMemo(() => {
    if (width >= 1600) return 80;
    if (width >= 1440) return 64;
    if (width >= 1024) return 48;
    if (width >= 768) return 32;
    return 16;
  }, [width]);
  const sideMenuPlatformStyles =
    Platform.OS === "web"
      ? isMobile
        ? styles.sideMenuWebMobile
        : styles.sideMenuWebDesktop
      : styles.sideMenuNative;
  const fabTop = headerOffset + insets.top + 12;

  useLCPPreload(travel);

  /* ---- Inject critical CSS for faster First Paint ---- */
  useEffect(() => {
    if (Platform.OS === "web") {
      injectCriticalStyles();
      initPerformanceMonitoring();
      optimizeCriticalPath();
    }
  }, []);

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
    }, 2600);
  }, []);

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(FAB_HINT_STORAGE_KEY)
      .then((value) => {
        if (mounted && value !== "true") {
          setShowFabHint(true);
        }
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  const dismissFabHint = useCallback(() => {
    setShowFabHint(false);
    AsyncStorage.setItem(FAB_HINT_STORAGE_KEY, "true").catch(() => {});
  }, []);

  useEffect(() => {
    if (!showFabHint) return;
    const t = setTimeout(() => {
      dismissFabHint();
    }, 6500);
    return () => clearTimeout(t);
  }, [showFabHint, dismissFabHint]);

  // Обработчик плавающей кнопки меню (FAB) на мобильных
  const handleFabPress = useCallback(() => {
    // При нажатии всегда скрываем подсказку
    if (showFabHint) {
      dismissFabHint();
    }
    // Переключаем состояние бокового меню
    toggleMenu();
  }, [showFabHint, dismissFabHint, toggleMenu]);

  /* ---- user flags ---- */
  const { isSuperuser, userId } = useAuth();

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
      window.addEventListener("open-section", handler as unknown as EventListener, { passive: true } as any);
      return () => window.removeEventListener("open-section", handler as unknown as EventListener);
    } else {
      const sub = DeviceEventEmitter.addListener("open-section", handler);
      return () => sub.remove();
    }
  }, [handleSectionOpen]);

  // ✅ АРХИТЕКТУРА: anchors и scrollRef теперь создаются в useScrollNavigation
  const scrollY = useRef(new Animated.Value(0)).current;
  const [contentHeight, setContentHeight] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  
  // ✅ АРХИТЕКТУРА: activeSection теперь управляется через useActiveSection
  
  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
    // По умолчанию считаем активной секцию галереи, чтобы в меню
    // всегда был выделен хотя бы один пункт при первом рендере
    setActiveSection("gallery");
  }, [slug, setActiveSection]);

  // Измеряем высоту контента для прогресс-бара
  const handleContentSizeChange = useCallback((_w: number, h: number) => {
    setContentHeight(h);
  }, []);

  const handleLayout = useCallback((e: any) => {
    setViewportHeight(e.nativeEvent.layout.height);
  }, []);

  // ✅ АРХИТЕКТУРА: Intersection Observer логика теперь в useActiveSection
  // Остается только логика установки data-section-key атрибутов
  useEffect(() => {
    if (Platform.OS !== "web") return;
    
    const setupSectionAttributes = () => {
      Object.keys(anchors).forEach((key) => {
        const ref = anchors[key as keyof typeof anchors];
        if (ref?.current && Platform.OS === "web") {
          // Для React Native Web получаем DOM элемент
          setTimeout(() => {
            try {
              // @ts-ignore - для web используем DOM API
              const domNode = ref.current?._nativeNode || ref.current?._domNode || ref.current;
              if (domNode && domNode.setAttribute) {
                domNode.setAttribute("data-section-key", key);
              } else if (domNode && typeof domNode === "object" && "ownerDocument" in domNode) {
                // Если это уже DOM элемент
                (domNode as HTMLElement).setAttribute("data-section-key", key);
              }
            } catch (e) {
              // Игнорируем ошибки
            }
          }, 100);
        }
      });
    };

    // Устанавливаем атрибуты после монтирования
    setupSectionAttributes();

    // Observer регистрация теперь обрабатывается в useActiveSection
    // Нет необходимости в дополнительной регистрации здесь
  }, [anchors, headerOffset, activeSection]);

  // ✅ АРХИТЕКТУРА: scrollTo теперь приходит из useScrollNavigation
  // Расширяем scrollTo для добавления логики закрытия меню на мобильных
  const scrollToWithMenuClose = useCallback(
    (key: string) => {
      // Немедленно обновляем активную секцию при клике по меню,
      // чтобы подсветка в боковом меню менялась сразу (например, на "Видео").
      setActiveSection(key);
      scrollTo(key);
      if (isMobile) closeMenu();
    },
    [scrollTo, isMobile, closeMenu, setActiveSection]
  );

  /* ---- prefetch near travels ---- */
  // ✅ ИСПРАВЛЕНИЕ: Убираем prefetch, чтобы избежать дублирующихся запросов
  // Компонент NearTravelList сам загружает данные при монтировании
  // useEffect(() => {
  //   if (travel?.id) {
  //     rIC(() => {
  //       queryClient.prefetchQuery({
  //         queryKey: ["nearTravels", travel.id],
  //         queryFn: () => fetchNearTravels(travel.id as number),
  //       });
  //     }, 1100);
  //   }
  // }, [travel?.id, queryClient]);

  /* ---- LCP gate ---- */
  const [lcpLoaded, setLcpLoaded] = useState(Platform.OS !== "web");
  const [deferAllowed, setDeferAllowed] = useState(false);
  useEffect(() => {
    if (lcpLoaded) setDeferAllowed(true);
    else rIC(() => setDeferAllowed(true), 2000);
  }, [lcpLoaded]);

  useEffect(() => {
    if (Platform.OS !== "web" || lcpLoaded) return;
    const timeout = setTimeout(() => setLcpLoaded(true), 4500);
    return () => clearTimeout(timeout);
  }, [lcpLoaded]);

  /* ---- show menu on desktop after defer ---- */
  useEffect(() => {
    if (deferAllowed && !isMobile) {
      openMenuOnDesktop();
    }
  }, [deferAllowed, isMobile, openMenuOnDesktop]);

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
  const lcpPreloadImage = useMemo(() => {
    if (!firstImg?.url) return readyImage;
    const targetWidth = Math.min(width || 1200, 1440);
    return (
      optimizeImageUrl(readyImage, {
        width: targetWidth,
        format: "webp",
        quality: 85,
        fit: "contain",
      }) || readyImage
    );
  }, [firstImg?.url, readyImage, width]);
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
      author: travel.userName ? [{ "@type": "Person", name: travel.userName }] : undefined,
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
        <TravelDetailsLoadingSkeleton />
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
        <View style={styles.errorContainer}>
          <MaterialIcons name="error-outline" size={64} color={DESIGN_TOKENS.colors.primary} />
          <Text style={styles.errorTitle}>Не удалось загрузить путешествие</Text>
          <Text style={styles.errorText}>
            Возможно, страница была удалена или временно недоступна.
          </Text>
          <Pressable
            onPress={() => {
              if (typeof window !== 'undefined' && Platform.OS === 'web') {
                window.location.reload();
              } else {
                router.replace('/');
              }
            }}
            style={styles.errorButton}
            accessibilityRole="button"
            accessibilityLabel="Вернуться на главную"
          >
            <Text style={styles.errorButtonText}>Вернуться на главную</Text>
          </Pressable>
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
                  <link rel="preload" as="image" href={lcpPreloadImage} fetchPriority="high" />
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

    <View style={[
      styles.wrapper,
      Platform.OS === "web" && {
        // @ts-ignore - web-specific CSS property
        backgroundImage: "linear-gradient(180deg, #ffffff 0%, #f9f8f2 100%)",
      } as any,
    ]}>
      <SafeAreaView style={styles.safeArea}>
        <View style={[styles.mainContainer, isMobile && styles.mainContainerMobile]}>
          {/* ✅ РЕДИЗАЙН: Адаптивный spacer под меню */}
          {!isMobile && <View style={{ width: menuWidthNum }} />}

          {/* ✅ РЕДИЗАЙН: Адаптивное боковое меню */}
          <Defer when={deferAllowed}>
            <Animated.View
              style={[
                styles.sideMenuBase,
                sideMenuPlatformStyles,
                {
                  transform: [{ translateX: animatedX }],
                  width: menuWidth as any,
                  zIndex: 1000,
                },
              ]}
            >
              <Suspense fallback={<SectionSkeleton lines={8} />}>
                <CompactSideBarTravel
                  travel={travel}
                  isSuperuser={isSuperuser}
                  storedUserId={userId}
                  isMobile={isMobile}
                  refs={anchors}
                  links={sectionLinks}
                  closeMenu={closeMenu}
                  onNavigate={scrollToWithMenuClose}
                  activeSection={activeSection}
                />
              </Suspense>
            </Animated.View>
          </Defer>

          {/* ✅ РЕДИЗАЙН: Оптимизированная FAB кнопка (отступ от низа 80px)
              На мобильном скрываем FAB, когда открыто боковое меню, чтобы оно не перекрывалось. */}
          {isMobile && !menuOpen && (
            <Defer when={deferAllowed}>
              <>
                {showFabHint && (
                  <Pressable
                    onPress={dismissFabHint}
                    style={[
                      styles.fabHintBubble,
                      { top: Math.max(16, fabTop - 64) },
                      Platform.OS === "web" && styles.fabHintBubbleWeb,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel="Подсказка: меню разделов"
                  >
                    <Text style={styles.fabHintTitle}>Меню разделов</Text>
                    <Text style={styles.fabHintText}>Нажмите, чтобы увидеть содержание страницы</Text>
                  </Pressable>
                )}

                <TouchableOpacity
                  onPress={handleFabPress}
                  style={[
                    styles.fab,
                    { top: fabTop },
                    Platform.OS === "web" && styles.fabWeb,
                  ]}
                  hitSlop={16}
                  accessibilityRole="button"
                  accessibilityLabel="Открыть меню разделов"
                  activeOpacity={0.8}
                >
                  <View style={styles.fabInner}>
                    <Icon name={menuOpen ? "close" : "menu"} size={26} color={DESIGN_TOKENS.colors.surface} />
                  </View>
                </TouchableOpacity>
              </>
            </Defer>
          )}

          {/* Прогресс-бар чтения */}
          {contentHeight > viewportHeight && (
            <ReadingProgressBar
              scrollY={scrollY}
              contentHeight={contentHeight}
              viewportHeight={viewportHeight}
            />
          )}

          <ScrollView
            ref={scrollRef}
            contentContainerStyle={[
              styles.scrollContent,
              Platform.OS === "web" && isMobile && { paddingTop: HEADER_OFFSET_MOBILE },
            ]}
            keyboardShouldPersistTaps="handled"
            onScroll={Animated.event(
              [{ nativeEvent: { contentOffset: { y: scrollY } } }],
              { useNativeDriver: false }
            )}
            scrollEventThrottle={Platform.OS === 'web' ? 32 : 16}
            style={styles.scrollView}
            nestedScrollEnabled
            onContentSizeChange={handleContentSizeChange}
            onLayout={handleLayout}
          >
            <View style={styles.contentOuter} collapsable={false}>
              <View
                style={[
                  styles.contentWrapper,
                  { paddingHorizontal: contentHorizontalPadding },
                ]}
                collapsable={false}
              >
                <SList revealOrder="forwards" tail="collapsed">
                  <TravelHeroSection
                    travel={travel}
                    anchors={anchors}
                    isMobile={isMobile}
                    renderSlider={Platform.OS !== "web" ? true : lcpLoaded}
                    onFirstImageLoad={() => setLcpLoaded(true)}
                  />

                  {isMobile && sectionLinks.length > 0 && (
                    <View style={styles.sectionTabsContainer}>
                      <TravelSectionTabs
                        links={sectionLinks}
                        activeSection={activeSection}
                        onNavigate={scrollToWithMenuClose}
                        stickyOffset={headerOffset + 8}
                      />
                    </View>
                  )}

                  {/* -------- deferred heavy content -------- */}
                  <Defer when={deferAllowed}>
                    <ProgressiveWrapper 
                      config={{ priority: 'normal', rootMargin: '100px' }}
                      fallback={<SectionSkeleton />}
                    >
                      <TravelDeferredSections
                        travel={travel}
                        isMobile={isMobile}
                        forceOpenKey={forceOpenKey}
                        anchors={anchors}
                        relatedTravels={relatedTravels}
                        setRelatedTravels={setRelatedTravels}
                      />
                    </ProgressiveWrapper>
                  </Defer>
                </SList>
              </View>
            </View>
          </ScrollView>
            
          {/* ✅ Кнопка "Наверх" */}
          <ScrollToTopButton
            scrollViewRef={scrollRef}
            scrollY={scrollY}
            threshold={300}
          />
        </View>
      </SafeAreaView>
    </View>
    </>
  );
}

/* -------------------- Deferred sections -------------------- */
type AnchorsMap = {
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

const TravelDeferredSections: React.FC<{
  travel: Travel;
  isMobile: boolean;
  forceOpenKey: string | null;
  anchors: AnchorsMap;
  relatedTravels: Travel[];
  setRelatedTravels: React.Dispatch<React.SetStateAction<Travel[]>>;
}> = ({ travel, isMobile, forceOpenKey, anchors, relatedTravels, setRelatedTravels }) => {
  const [canRenderHeavy, setCanRenderHeavy] = useState(false);
  const [showMap, setShowMap] = useState(Platform.OS !== "web");
  const [showExcursions] = useState(true);

  useEffect(() => {
    if (Platform.OS !== "web") {
      const task = InteractionManager.runAfterInteractions(() => setCanRenderHeavy(true));
      return () => task.cancel();
    }
  }, []);

  useEffect(() => {
    if (Platform.OS === "web") {
      rIC(() => {
        setCanRenderHeavy(true);
        setShowMap(true);
      }, 3500);
    }
  }, []);

  return (
    <>
      <TravelContentSections
        travel={travel}
        isMobile={isMobile}
        anchors={anchors}
        forceOpenKey={forceOpenKey}
      />

      <TravelVisualSections
        travel={travel}
        anchors={anchors}
        canRenderHeavy={canRenderHeavy}
        showMap={showMap}
        showExcursions={showExcursions}
      />

      <TravelRelatedContent
        travel={travel}
        anchors={anchors}
        relatedTravels={relatedTravels}
        setRelatedTravels={setRelatedTravels}
      />

      <TravelEngagementSection travel={travel} />
    </>
  );
};

const TravelHeroSection: React.FC<{
  travel: Travel;
  anchors: AnchorsMap;
  isMobile: boolean;
  renderSlider?: boolean;
  onFirstImageLoad: () => void;
}> = ({ travel, anchors, isMobile, renderSlider = true, onFirstImageLoad }) => {
  const { width: winW, height: winH } = useWindowDimensions();
  const [heroContainerWidth, setHeroContainerWidth] = useState<number | null>(null);
  const firstImg = (travel?.gallery?.[0] ?? null) as unknown as ImgLike | null;
  const aspectRatio =
    (firstImg?.width && firstImg?.height ? firstImg.width / firstImg.height : undefined) || 16 / 9;
  const resolvedWidth = heroContainerWidth ?? winW;
  const heroHeight = useMemo(() => {
    if (!resolvedWidth) return undefined;
    if (isMobile) {
      const mobileHeight = winH * 0.7;
      return Math.max(200, Math.min(mobileHeight, winH * 0.8));
    }
    const h = resolvedWidth / (aspectRatio || 16 / 9);
    return Math.max(320, Math.min(h, 640));
  }, [aspectRatio, isMobile, winH, resolvedWidth]);
  const galleryImages = useMemo(
    () =>
      travel.gallery?.map((item, index) =>
        typeof item === "string"
          ? { url: item, id: index }
          : { ...item, id: item.id || index }
      ) || [],
    [travel.gallery]
  );
  const heroAlt = travel?.name ? `Фотография маршрута «${travel.name}»` : "Фото путешествия";
  const shouldShowOptimizedHero = Platform.OS === "web" && !!firstImg;

  return (
    <>
      <View
        ref={anchors.gallery}
        collapsable={false}
        {...(Platform.OS === "web"
          ? {
              // @ts-ignore - устанавливаем data-атрибут для Intersection Observer
              "data-section-key": "gallery",
            }
          : {})}
      />

      {!!firstImg && (
        <View style={[styles.sectionContainer, styles.contentStable]} collapsable={false}>
          <View
            style={styles.sliderContainer}
            collapsable={false}
            onLayout={(e: LayoutChangeEvent) => {
              const w = e.nativeEvent.layout.width;
              if (w && Math.abs((heroContainerWidth ?? 0) - w) > 2) {
                setHeroContainerWidth(w);
              }
            }}
          >
            {shouldShowOptimizedHero && !renderSlider && (
              <View style={heroHeight ? { height: heroHeight } : undefined}>
                <OptimizedLCPHero
                  img={{
                    url: typeof firstImg === "string" ? firstImg : firstImg.url,
                    width: firstImg.width,
                    height: firstImg.height,
                    updated_at: firstImg.updated_at,
                    id: firstImg.id,
                  }}
                  alt={heroAlt}
                  onLoad={onFirstImageLoad}
                />
              </View>
            )}

            {(Platform.OS !== "web" || renderSlider) && (
              <Slider
                key={`${isMobile ? "mobile" : "desktop"}-${renderSlider ? "ready" : "pending"}`}
                images={galleryImages}
                showArrows={!isMobile}
                hideArrowsOnMobile
                showDots={isMobile}
                preloadCount={isMobile ? 1 : 2}
                blurBackground
                aspectRatio={aspectRatio as number}
                mobileHeightPercent={0.7}
                onFirstImageLoad={onFirstImageLoad}
              />
            )}
          </View>
        </View>
      )}

      <View style={[styles.sectionContainer, styles.contentStable, styles.quickFactsContainer]}>
        <QuickFacts travel={travel} />
      </View>

      <View style={[styles.sectionContainer, styles.contentStable, styles.authorCardContainer]}>
        <Text style={styles.sectionHeaderText}>Автор</Text>
        <Text style={styles.sectionSubtitle}>Профиль, соцсети и другие путешествия автора</Text>
        <View style={{ marginTop: 12 }}>
          <AuthorCard travel={travel} />
        </View>
      </View>
    </>
  );
};

const TravelContentSections: React.FC<{
  travel: Travel;
  isMobile: boolean;
  anchors: AnchorsMap;
  forceOpenKey: string | null;
}> = ({ travel, isMobile, anchors, forceOpenKey }) => {
  type InsightKey = "recommendation" | "plus" | "minus";

  const hasRecommendation = Boolean(travel.recommendation?.trim());
  const hasPlus = Boolean(travel.plus?.trim());
  const hasMinus = Boolean(travel.minus?.trim());

  const insightConfigs = useMemo(
    () =>
      [
        hasRecommendation && {
          key: "recommendation" as InsightKey,
          label: "Советы",
        },
        hasPlus && {
          key: "plus" as InsightKey,
          label: "Понравилось",
        },
        hasMinus && {
          key: "minus" as InsightKey,
          label: "Не зашло",
        },
      ].filter(Boolean) as Array<{ key: InsightKey; label: string }>,
    [hasRecommendation, hasPlus, hasMinus]
  );

  const shouldUseMobileInsights = isMobile && insightConfigs.length > 0;
  const [mobileInsightKey, setMobileInsightKey] = useState<InsightKey | null>(() =>
    shouldUseMobileInsights ? insightConfigs[0]?.key ?? null : null
  );

  const defaultInsightKey = shouldUseMobileInsights ? insightConfigs[0]?.key ?? null : null;

  useEffect(() => {
    if (!shouldUseMobileInsights) {
      if (mobileInsightKey !== null) {
        setMobileInsightKey(null);
      }
      return;
    }

    if (
      forceOpenKey &&
      (forceOpenKey === "recommendation" || forceOpenKey === "plus" || forceOpenKey === "minus")
    ) {
      if (mobileInsightKey !== forceOpenKey) {
        setMobileInsightKey(forceOpenKey as InsightKey);
      }
      return;
    }

    if (!mobileInsightKey && defaultInsightKey) {
      setMobileInsightKey(defaultInsightKey);
    }
  }, [defaultInsightKey, forceOpenKey, mobileInsightKey, shouldUseMobileInsights]);

  const buildInsightControl = useCallback(
    (key: InsightKey) =>
      shouldUseMobileInsights
        ? {
            open: mobileInsightKey === key,
            onToggle: () =>
              setMobileInsightKey((prev) => (prev === key ? null : key)),
          }
        : {},
    [mobileInsightKey, shouldUseMobileInsights]
  );

  return (
    <>
      {travel.description && (
        <Suspense fallback={<DescriptionFallback />}>
          <View
            ref={anchors.description}
            collapsable={false}
            {...(Platform.OS === "web" ? { "data-section-key": "description" } : {})}
          >
            <CollapsibleSection
              title={travel.name}
              initiallyOpen
              forceOpen={forceOpenKey === "description"}
              iconName="menu-book"
              highlight="info"
            >
              <View style={styles.descriptionContainer}>
                <View style={styles.descriptionIntroWrapper}>
                  <Text style={styles.descriptionIntroTitle}>Описание маршрута</Text>
                  <Text style={styles.descriptionIntroText}>
                    {`${travel.number_days || 0} ${travel.number_days === 1 ? "день" : travel.number_days < 5 ? "дня" : "дней"}`}
                    {travel.countryName ? ` · ${travel.countryName}` : ""}
                    {travel.monthName ? ` · лучший сезон: ${travel.monthName.toLowerCase()}` : ""}
                  </Text>
                </View>
                <TravelDescription title={travel.name} htmlContent={travel.description} noBox />
                {Platform.OS === "web" && (
                  <Pressable
                    onPress={() => {
                      if (typeof window !== "undefined") {
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }
                    }}
                    style={styles.backToTopWrapper}
                    accessibilityRole="button"
                    accessibilityLabel="Назад к началу страницы"
                  >
                    <Text style={styles.backToTopText}>Назад к началу</Text>
                  </Pressable>
                )}
              </View>
            </CollapsibleSection>
          </View>
        </Suspense>
      )}

      {travel.youtube_link && (
        <View
          style={[styles.sectionContainer, styles.contentStable]}
          ref={anchors.video}
          collapsable={false}
          {...(Platform.OS === "web" ? { "data-section-key": "video" } : {})}
        >
          <Text style={styles.sectionHeaderText}>Видео</Text>
          <Text style={styles.sectionSubtitle}>Одно нажатие — и ролик начнёт проигрываться</Text>
          <View style={{ marginTop: 12 }}>
            <LazyYouTube url={travel.youtube_link} />
          </View>
        </View>
      )}

      {shouldUseMobileInsights && (
        <View style={[styles.sectionContainer, styles.mobileInsightTabsWrapper]}>
          <Text style={styles.mobileInsightLabel}>Быстрый доступ к разделам</Text>
          <View style={styles.mobileInsightTabs}>
            {insightConfigs.map((section) => (
              <Pressable
                key={section.key}
                onPress={() => setMobileInsightKey(section.key)}
                style={[
                  styles.mobileInsightChip,
                  mobileInsightKey === section.key && styles.mobileInsightChipActive,
                ]}
                accessibilityRole="button"
                accessibilityLabel={`Показать раздел ${section.label}`}
              >
                <Text
                  style={[
                    styles.mobileInsightChipText,
                    mobileInsightKey === section.key && styles.mobileInsightChipTextActive,
                  ]}
                >
                  {section.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {travel.recommendation && (
        <Suspense fallback={<DescriptionFallback />}>
          <View
            ref={anchors.recommendation}
            collapsable={false}
            {...(Platform.OS === "web" ? { "data-section-key": "recommendation" } : {})}
          >
            <CollapsibleSection
              title="Рекомендации"
              initiallyOpen={!isMobile}
              forceOpen={!isMobile && forceOpenKey === "recommendation"}
              iconName="tips-and-updates"
              highlight="info"
              badgeLabel="Опыт автора"
              {...buildInsightControl("recommendation")}
            >
              <View style={styles.descriptionContainer}>
                <TravelDescription title="Рекомендации" htmlContent={travel.recommendation} noBox />
              </View>
            </CollapsibleSection>
          </View>
        </Suspense>
      )}

      {travel.plus && (
        <Suspense fallback={<DescriptionFallback />}>
          <View
            ref={anchors.plus}
            collapsable={false}
            {...(Platform.OS === "web" ? { "data-section-key": "plus" } : {})}
          >
            <CollapsibleSection
              title="Плюсы"
              initiallyOpen={!isMobile}
              forceOpen={!isMobile && forceOpenKey === "plus"}
              iconName="thumb-up-alt"
              highlight="positive"
              badgeLabel="Что понравилось"
              {...buildInsightControl("plus")}
            >
              <View style={styles.descriptionContainer}>
                <TravelDescription title="Плюсы" htmlContent={travel.plus} noBox />
              </View>
            </CollapsibleSection>
          </View>
        </Suspense>
      )}

      {travel.minus && (
        <Suspense fallback={<DescriptionFallback />}>
          <View
            ref={anchors.minus}
            collapsable={false}
            {...(Platform.OS === "web" ? { "data-section-key": "minus" } : {})}
          >
            <CollapsibleSection
              title="Минусы"
              initiallyOpen={!isMobile}
              forceOpen={!isMobile && forceOpenKey === "minus"}
              iconName="thumb-down-alt"
              highlight="negative"
              badgeLabel="Что смутило"
              {...buildInsightControl("minus")}
            >
              <View style={styles.descriptionContainer}>
                <TravelDescription title="Минусы" htmlContent={travel.minus} noBox />
              </View>
            </CollapsibleSection>
          </View>
        </Suspense>
      )}
    </>
  );
};

const TravelVisualSections: React.FC<{
  travel: Travel;
  anchors: AnchorsMap;
  canRenderHeavy: boolean;
  showMap: boolean;
  showExcursions: boolean;
}> = ({ travel, anchors, canRenderHeavy, showMap, showExcursions }) => {
  const hasMapData = (travel.coordsMeTravel?.length ?? 0) > 0;
  const shouldRenderMap = canRenderHeavy && showMap && hasMapData;

  return (
    <>
      {Platform.OS === "web" &&
        showExcursions &&
        (travel.travelAddress?.length ?? 0) > 0 && (
          <Suspense fallback={<Fallback />}>
            <ExcursionsLazySection>
              <View
                ref={anchors.excursions}
                style={[styles.sectionContainer, styles.contentStable]}
                collapsable={false}
                {...(Platform.OS === "web" ? { "data-section-key": "excursions" } : {})}
              >
                <Text style={styles.sectionHeaderText}>Экскурсии</Text>
                <View style={{ marginTop: 12 }}>
                  <BelkrajWidgetComponent
                    countryCode={travel.countryCode}
                    points={travel.travelAddress as any}
                    collapsedHeight={600}
                    expandedHeight={1000}
                  />
                </View>
              </View>
            </ExcursionsLazySection>
          </Suspense>
        )}

      <View
        ref={anchors.map}
        style={[styles.sectionContainer, styles.contentStable]}
        collapsable={false}
        {...(Platform.OS === "web" ? { "data-section-key": "map", "data-map-for-pdf": "1" } : {})}
      >
        <Text style={styles.sectionHeaderText}>Карта маршрута</Text>
        <Text style={styles.sectionSubtitle}>Посмотрите последовательность точек на живой карте</Text>
        <View style={{ marginTop: 12 }}>
          {hasMapData ? (
            <ToggleableMap
              initiallyOpen
              isLoading={!shouldRenderMap}
              loadingLabel="Подгружаем карту маршрута..."
            >
              {shouldRenderMap ? (
                <Suspense fallback={<MapFallback />}>
                  <MapClientSide travel={{ data: travel.travelAddress as any }} />
                </Suspense>
              ) : null}
            </ToggleableMap>
          ) : (
            <View style={styles.mapEmptyState}>
              <Text style={styles.mapEmptyText}>Маршрут ещё не добавлен</Text>
            </View>
          )}
        </View>
      </View>

      <View
        ref={anchors.points}
        style={[styles.sectionContainer, styles.contentStable]}
        collapsable={false}
        {...(Platform.OS === "web" ? { "data-section-key": "points" } : {})}
      >
        <Text style={styles.sectionHeaderText}>Координаты мест</Text>
        <View style={{ marginTop: 12 }}>
          {travel.travelAddress && (
            <Suspense fallback={<PointListFallback />}>
              <PointList points={travel.travelAddress as any} baseUrl={travel.url} />
            </Suspense>
          )}
        </View>
      </View>
    </>
  );
};

const TravelRelatedContent: React.FC<{
  travel: Travel;
  anchors: AnchorsMap;
  relatedTravels: Travel[];
  setRelatedTravels: React.Dispatch<React.SetStateAction<Travel[]>>;
}> = ({ travel, anchors, relatedTravels, setRelatedTravels }) => (
  <>
    <View
      ref={anchors.near}
      style={[styles.sectionContainer, styles.contentStable]}
      collapsable={false}
      {...(Platform.OS === "web" ? { "data-section-key": "near" } : {})}
    >
      <Text style={styles.sectionHeaderText}>Рядом (~60км)</Text>
      <Text style={[styles.sectionSubtitle, styles.nearSubtitle]}>
        Маршруты поблизости — пригодятся для импровизации
      </Text>
      <View style={styles.sectionBadgeRow}>
        <View style={[styles.sectionBadgePill, styles.sectionBadgeNear]}>
          <Text style={[styles.sectionBadgeText, styles.sectionBadgeTextNear]}>
            Рядом с этим маршрутом
          </Text>
        </View>
      </View>
      <View style={{ marginTop: 12 }}>
        {travel.travelAddress && (
          <Suspense fallback={<TravelListFallback />}>
            <NearTravelList
              travel={travel}
              onTravelsLoaded={(travels) => setRelatedTravels(travels)}
            />
          </Suspense>
        )}
      </View>
    </View>

    {relatedTravels.length > 0 && (
      <View style={[styles.sectionContainer, styles.navigationArrowsContainer]}>
        <NavigationArrows currentTravel={travel} relatedTravels={relatedTravels} />
      </View>
    )}

    <View
      ref={anchors.popular}
      style={[styles.sectionContainer, styles.contentStable]}
      collapsable={false}
      {...(Platform.OS === "web" ? { "data-section-key": "popular" } : {})}
    >
      <Text style={styles.sectionHeaderText}>Популярные путешествия</Text>
      <Text style={[styles.sectionSubtitle, styles.popularSubtitle]}>
        Самые просматриваемые направления за последнюю неделю
      </Text>
      <View style={styles.sectionBadgeRow}>
        <View style={[styles.sectionBadgePill, styles.sectionBadgePopular]}>
          <Text style={[styles.sectionBadgeText, styles.sectionBadgeTextPopular]}>
            Тренды сообщества
          </Text>
        </View>
      </View>
      <View style={{ marginTop: 12 }}>
        <Suspense fallback={<TravelListFallback />}>
          <PopularTravelList />
        </Suspense>
      </View>
    </View>
  </>
);

const TravelEngagementSection: React.FC<{ travel: Travel }> = ({ travel }) => (
  <>
    <View style={[styles.sectionContainer, styles.authorCardContainer]}>
      <TelegramDiscussionSection travel={travel} />
    </View>

    <View style={[styles.sectionContainer, styles.shareButtonsContainer]}>
      <ShareButtons travel={travel} />
    </View>

    <View style={[styles.sectionContainer, styles.ctaContainer]}>
      <CTASection travel={travel} />
    </View>
  </>
);

/* -------------------- styles -------------------- */
const ANDROID_ELEVATION_CARD = Platform.select({ android: 2, default: 0 });
const ANDROID_ELEVATION_MENU = Platform.select({ android: 5, default: 0 });

const styles = StyleSheet.create({
  // ✅ РЕДИЗАЙН: Современный градиентный фон
  wrapper: { 
    flex: 1, 
    backgroundColor: DESIGN_TOKENS.colors.surface,
  },
  safeArea: { flex: 1 },
  mainContainer: { 
    flex: 1, 
    flexDirection: "row",
    maxWidth: 1440,
    width: "100%",
    marginHorizontal: "auto" as any,
  },
  mainContainerMobile: {
    flexDirection: "column",
    alignItems: "stretch",
  },

  // ✅ РЕДИЗАЙН: Адаптивное боковое меню с glassmorphism
  sideMenuBase: {
    backgroundColor: DESIGN_TOKENS.colors.surface,
    shadowColor: DESIGN_TOKENS.colors.text,
    borderRightColor: "rgba(0, 0, 0, 0.06)",
  },
  
  root: {
    flex: 1,
    backgroundColor: DESIGN_TOKENS.colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: Platform.select({
      default: DESIGN_TOKENS.spacing.xxl,
      web: DESIGN_TOKENS.spacing.xl,
    }),
  },
  
  contentContainer: {
    maxWidth: MAX_CONTENT_WIDTH,
    width: "100%",
    alignSelf: "center",
    paddingHorizontal: Platform.select({
      default: DESIGN_TOKENS.spacing.md,
      web: DESIGN_TOKENS.spacing.xl,
    }),
    paddingTop: Platform.select({
      default: DESIGN_TOKENS.spacing.sm,
      web: DESIGN_TOKENS.spacing.lg,
    }),
  },
  
  sectionContainer: {
    marginBottom: DESIGN_TOKENS.spacing.xl,
    paddingHorizontal: Platform.select({
      default: DESIGN_TOKENS.spacing.md,
      web: 0,
    }),
  },
  
  contentStable: {
    // Предотвращает layout shift при загрузке контента
    minHeight: 48,
  },
  
  contentOuter: {
    flex: 1,
  },
  
  contentWrapper: {
    flex: 1,
  },
  
  sectionTabsContainer: {
    marginBottom: DESIGN_TOKENS.spacing.md,
  },
  
  quickFactsContainer: {
    marginBottom: DESIGN_TOKENS.spacing.md,
  },
  
  descriptionIntroWrapper: {
    marginBottom: DESIGN_TOKENS.spacing.lg,
  },
  
  descriptionIntroTitle: {
    fontSize: DESIGN_TOKENS.typography.sizes.lg,
    fontWeight: DESIGN_TOKENS.typography.weights.semibold as any,
    color: DESIGN_TOKENS.colors.text,
    marginBottom: DESIGN_TOKENS.spacing.sm,
  },
  
  descriptionIntroText: {
    fontSize: DESIGN_TOKENS.typography.sizes.md,
    color: DESIGN_TOKENS.colors.textMuted,
    lineHeight: 24,
  },
  
  backToTopWrapper: {
    alignItems: 'center',
    paddingVertical: DESIGN_TOKENS.spacing.lg,
  },
  
  backToTopText: {
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    color: DESIGN_TOKENS.colors.textMuted,
  },
  
  navigationArrowsContainer: {
    marginBottom: DESIGN_TOKENS.spacing.xl,
  },
  
  authorCardContainer: {
    marginBottom: DESIGN_TOKENS.spacing.md,
  },
  
  shareButtonsContainer: {
    marginBottom: DESIGN_TOKENS.spacing.md,
  },
  
  ctaContainer: {
    marginTop: DESIGN_TOKENS.spacing.xl,
  },
  
  sideMenuNative: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
  },
  sideMenuWebDesktop: {
    position: "sticky" as any,
    top: HEADER_OFFSET_DESKTOP as any,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    backdropFilter: "blur(20px)" as any,
  },
  sideMenuWebMobile: {
    position: "fixed" as any,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: DESIGN_TOKENS.colors.surface,
    borderRightWidth: 0,
    maxHeight: "100vh" as any,
    overflowY: "auto" as any,
    paddingTop: HEADER_OFFSET_MOBILE + 32,
  },

  // ✅ РЕДИЗАЙН: Оптимизированная FAB с градиентом (отступ от низа 80px)
  fab: {
    position: "absolute",
    right: 16,
    width: 56, // ✅ Размер 56px × 56px
    height: 56,
    borderRadius: 28, // ✅ Круглая форма (50% от размера)
    backgroundColor: DESIGN_TOKENS.colors.primary,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1001, // ✅ Z-index: 1001
    shadowColor: DESIGN_TOKENS.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 24, // ✅ Уровень 3 теней для FAB
    elevation: 12,
  },
  fabWeb: {
    cursor: "pointer" as any,
    // @ts-ignore - Web-specific CSS properties
    transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)" as any,
    // @ts-ignore
    backgroundImage: "linear-gradient(135deg, #ff9f5a 0%, #ff6b35 100%)" as any,
    ":hover": {
      transform: "scale(1.1) translateY(-2px)" as any,
      shadowOpacity: 0.5 as any,
    } as any,
  },
  fabInner: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  fabHintBubble: {
    position: "absolute",
    right: 12,
    paddingHorizontal: 14,
    paddingVertical: DESIGN_TOKENS.spacing.sm,
    borderRadius: 16,
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    maxWidth: 240,
    zIndex: 1002,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 10,
  },
  fabHintBubbleWeb: {
    cursor: "pointer" as any,
  },
  fabHintTitle: {
    color: DESIGN_TOKENS.colors.surface,
    fontWeight: "600",
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
  },
  fabHintText: {
    color: "rgba(248, 250, 252, 0.92)",
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    lineHeight: 18,
    marginTop: 4,
  },

  pdfButtonContainer: {
    position: "absolute",
    right: 16,
    bottom: 32,
    zIndex: 900,
  },
  pdfButton: {
    paddingHorizontal: DESIGN_TOKENS.spacing.lg,
    paddingVertical: DESIGN_TOKENS.spacing.sm,
    borderRadius: 999,
    backgroundColor: "#111827",
    shadowColor: DESIGN_TOKENS.colors.text,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.16,
    shadowRadius: 8,
  },
  pdfButtonText: {
    color: DESIGN_TOKENS.colors.surface,
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    fontWeight: "600",
    letterSpacing: 0.3,
  },

  // ✅ РЕДИЗАЙН: Современные карточки с улучшенными тенями
  // ✅ РЕДИЗАЙН: Унифицированные карточки с единой системой радиусов (12px)
  sectionHeaderBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Platform.select({
      default: DESIGN_TOKENS.spacing.md,
      web: DESIGN_TOKENS.spacing.lg,
    }),
    paddingHorizontal: Platform.select({
      default: DESIGN_TOKENS.spacing.md,
      web: DESIGN_TOKENS.spacing.lg,
    }),
    backgroundColor: DESIGN_TOKENS.colors.surface,
    borderRadius: DESIGN_TOKENS.radii.md,
    justifyContent: "space-between",
    shadowColor: DESIGN_TOKENS.colors.text,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: DESIGN_TOKENS.colors.borderLight,
    minHeight: 56,
  },
  sectionHeaderPositive: {
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    borderColor: "rgba(16, 185, 129, 0.4)",
  },
  sectionHeaderNegative: {
    backgroundColor: "rgba(248, 113, 113, 0.12)",
    borderColor: "rgba(248, 113, 113, 0.4)",
  },
  sectionHeaderInfo: {
    backgroundColor: "rgba(96, 165, 250, 0.12)",
    borderColor: "rgba(96, 165, 250, 0.4)",
  },
  sectionHeaderActive: {
    shadowOpacity: 0.10,
    shadowRadius: 10,
    borderColor: DESIGN_TOKENS.colors.primary,
    backgroundColor: DESIGN_TOKENS.colors.primarySoft,
  },
  sectionHeaderTitleWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: DESIGN_TOKENS.spacing.sm,
    flex: 1,
  },
  
  sectionHeaderIcon: {
    width: Platform.select({ default: 32, web: 36 }),
    height: Platform.select({ default: 32, web: 36 }),
    borderRadius: Platform.select({ default: 16, web: 18 }),
    backgroundColor: DESIGN_TOKENS.colors.primarySoft,
    justifyContent: "center",
    alignItems: "center",
  },
  sectionHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: DESIGN_TOKENS.spacing.sm,
  },
  sectionHeaderBadge: {
    fontSize: Platform.select({ default: 11, web: 12 }),
    fontWeight: DESIGN_TOKENS.typography.weights.semibold as any,
    color: DESIGN_TOKENS.colors.textMuted,
    backgroundColor: DESIGN_TOKENS.colors.surfaceMuted,
    paddingHorizontal: DESIGN_TOKENS.spacing.sm,
    paddingVertical: DESIGN_TOKENS.spacing.xxs,
    borderRadius: DESIGN_TOKENS.radii.pill,
  },

  sectionHeaderText: { 
    fontSize: Platform.select({
      default: 18,
      web: 20,
    }),
    fontWeight: DESIGN_TOKENS.typography.weights.semibold as any,
    color: DESIGN_TOKENS.colors.text,
    letterSpacing: -0.3,
    lineHeight: Platform.select({
      default: 24,
      web: 28,
    }),
    flex: 1,
  },
  sectionSubtitle: {
    fontSize: Platform.select({ default: 13, web: 14 }),
    color: DESIGN_TOKENS.colors.textMuted,
    marginTop: DESIGN_TOKENS.spacing.xs,
    lineHeight: Platform.select({ default: 18, web: 20 }),
  },

  sliderContainer: { 
    width: "100%",
    borderRadius: DESIGN_TOKENS.radii.lg,
    overflow: "hidden",
    marginBottom: Platform.select({
      default: DESIGN_TOKENS.spacing.md,
      web: DESIGN_TOKENS.spacing.lg,
    }),
    // Объединенные стили теней
    ...Platform.select({
      web: {
        boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
      },
      default: {
        shadowColor: DESIGN_TOKENS.colors.text,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.10,
        shadowRadius: 12,
        elevation: 4,
      },
    }),
  },

  videoContainer: {
    width: "100%",
    aspectRatio: 16 / 9,
    borderRadius: DESIGN_TOKENS.radii.md,
    overflow: "hidden",
    backgroundColor: DESIGN_TOKENS.colors.text,
    // Объединенные стили теней
    ...Platform.select({
      web: {
        boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
      },
      default: {
        shadowColor: DESIGN_TOKENS.colors.text,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 3,
      },
    }),
  },

  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: DESIGN_TOKENS.spacing.lg,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  videoHintText: {
    color: DESIGN_TOKENS.colors.surface,
    fontSize: Platform.select({ default: 12, web: 13 }),
    marginTop: DESIGN_TOKENS.spacing.sm,
    textAlign: "center",
    fontWeight: DESIGN_TOKENS.typography.weights.medium as any,
  },

  descriptionContainer: {
    width: "100%",
    backgroundColor: DESIGN_TOKENS.colors.surface,
    borderRadius: DESIGN_TOKENS.radii.md,
    padding: Platform.select({
      default: DESIGN_TOKENS.spacing.md,
      web: DESIGN_TOKENS.spacing.lg,
    }),
    shadowColor: DESIGN_TOKENS.colors.text,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: DESIGN_TOKENS.colors.borderLight,
  },

  mobileInsightTabsWrapper: {
    backgroundColor: "rgba(15, 23, 42, 0.03)",
    padding: DESIGN_TOKENS.spacing.lg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.3)",
  },
  mobileInsightLabel: {
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    fontWeight: "600",
    color: "#1f2937",
    marginBottom: 8,
  },
  mobileInsightTabs: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: DESIGN_TOKENS.spacing.sm,
  },
  mobileInsightChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: "rgba(148, 163, 184, 0.2)",
  },
  mobileInsightChipActive: {
    backgroundColor: "#1f2937",
  },
  mobileInsightChipText: {
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    fontWeight: "500",
    color: "#475569",
  },
  mobileInsightChipTextActive: {
    color: "#f8fafc",
  },

  mapEmptyState: {
    width: "100%",
    padding: DESIGN_TOKENS.spacing.xl,
    borderRadius: 16,
    backgroundColor: DESIGN_TOKENS.colors.surface,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "rgba(148, 163, 184, 0.7)",
    alignItems: "center",
    justifyContent: "center",
  },
  mapEmptyText: {
    fontSize: DESIGN_TOKENS.typography.sizes.md,
    fontWeight: "600",
    color: "#475569",
  },
  nearSubtitle: {
    color: "#047857",
  },
  popularSubtitle: {
    color: "#b45309",
  },
  sectionBadgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 12,
    gap: DESIGN_TOKENS.spacing.sm,
  },
  sectionBadgePill: {
    paddingHorizontal: 12,
    paddingVertical: DESIGN_TOKENS.spacing.xs,
    borderRadius: 999,
  },
  sectionBadgeNear: {
    backgroundColor: "rgba(16, 185, 129, 0.18)",
  },
  sectionBadgePopular: {
    backgroundColor: "rgba(249, 115, 22, 0.18)",
  },
  sectionBadgeText: {
    fontSize: DESIGN_TOKENS.typography.sizes.xs,
    fontWeight: "600",
    color: "#1f2937",
  },
  sectionBadgeTextNear: {
    color: "#065f46",
  },
  sectionBadgeTextPopular: {
    color: "#9a3412",
  },

  fallback: { paddingVertical: 32, alignItems: "center" },
  center: { 
    flex: 1, 
    justifyContent: "center", 
    alignItems: "center", 
    backgroundColor: DESIGN_TOKENS.colors.transparent,
  },
  
  // ✅ УЛУЧШЕНИЕ: Стили для страницы ошибки
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f9f8f2",
    paddingHorizontal: DESIGN_TOKENS.spacing.md,
    paddingVertical: 40,
  },
  errorTitle: {
    fontSize: DESIGN_TOKENS.typography.sizes.lg,
    fontWeight: "600",
    color: "#1f2937",
    marginTop: DESIGN_TOKENS.spacing.lg,
    marginBottom: 8,
    textAlign: "center",
    fontFamily: "Georgia",
  },
  errorText: {
    fontSize: DESIGN_TOKENS.typography.sizes.md,
    color: "#6b7280",
    textAlign: "center",
    marginBottom: DESIGN_TOKENS.spacing.xl,
    lineHeight: 24,
  },
  errorButton: {
    backgroundColor: DESIGN_TOKENS.colors.primary,
    paddingHorizontal: DESIGN_TOKENS.spacing.xl,
    paddingVertical: 12,
    borderRadius: 8,
    ...Platform.select({
      web: {
        cursor: "pointer",
        transition: "all 0.2s ease",
        ":hover": {
          backgroundColor: "#ff8c42",
        } as any,
      },
    }),
  },
  errorButtonText: {
    color: DESIGN_TOKENS.colors.surface,
    fontSize: DESIGN_TOKENS.typography.sizes.md,
    fontWeight: "600",
  },
});
