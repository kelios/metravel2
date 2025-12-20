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
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Pressable,
  DeviceEventEmitter,
  InteractionManager,
  LayoutChangeEvent,
  useWindowDimensions,
} from "react-native";

import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image as ExpoImage } from "expo-image";
import { useIsFocused } from "@react-navigation/native";
import { useAuth } from '@/context/AuthContext';
import { METRICS } from '@/constants/layout';
import { LAYOUT } from '@/constants/layout';
import { useResponsive } from '@/hooks/useResponsive';


/* ✅ УЛУЧШЕНИЕ: Импорт компонентов навигации и поделиться */
import NavigationArrows from "@/components/travel/NavigationArrows";
import ShareButtons from "@/components/travel/ShareButtons";
import TelegramDiscussionSection from "@/components/travel/TelegramDiscussionSection";
import WeatherWidget from "@/components/WeatherWidget";
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
import { useProgressiveLoad, ProgressiveWrapper } from '@/hooks/useProgressiveLoading';
import { useLazyMap } from '@/hooks/useLazyMap';
import { optimizeImageUrl, buildVersionedImageUrl as buildVersionedImageUrlLCP } from "@/utils/imageOptimization";
import { injectCriticalStyles } from '@/styles/criticalCSS';
import { initPerformanceMonitoring } from '@/utils/performanceMonitoring';
import { SectionSkeleton } from '@/components/SectionSkeleton';
import { optimizeCriticalPath } from '@/utils/advancedPerformanceOptimization';
import { SkeletonLoader } from '@/components/SkeletonLoader';
import ReservedSpace from '@/components/ReservedSpace';

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
  const containerRef = useRef<any>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (Platform.OS !== "web") {
      setVisible(true);
      return;
    }

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

  if (Platform.OS !== "web") {
    return <>{children}</>;
  }

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
  <View style={styles.travelListFallback}>
    <TravelListSkeleton count={3} />
  </View>
);

const TravelDetailsLoadingSkeleton = () => (
  <View
    testID="travel-details-loading"
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
          ]}
          style={styles.scrollView}
        >
          <View style={styles.contentOuter} collapsable={false}>
            <View style={[styles.contentWrapper, { paddingHorizontal: 16 }]} collapsable={false}>
              <View style={[styles.sectionContainer, styles.contentStable]}>
                {Platform.OS === 'web' ? (
                  <>
                    <SkeletonLoader width="100%" height={320} borderRadius={16} />
                    <View style={{ marginTop: 14 }}>
                      <SkeletonLoader width="70%" height={24} borderRadius={8} style={{ marginBottom: 10 }} />
                      <SkeletonLoader width="90%" height={16} borderRadius={8} style={{ marginBottom: 8 }} />
                      <SkeletonLoader width="82%" height={16} borderRadius={8} />
                    </View>
                  </>
                ) : (
                  <>
                    <ReservedSpace testID="travel-details-loading-hero-reserved" height={320} style={{ borderRadius: 16 }} />
                    <View style={{ marginTop: 14 }}>
                      <ReservedSpace testID="travel-details-loading-title-reserved" height={24} width="70%" style={{ borderRadius: 8, marginBottom: 10 }} />
                      <ReservedSpace testID="travel-details-loading-subtitle-reserved" height={16} width="90%" style={{ borderRadius: 8, marginBottom: 8 }} />
                      <ReservedSpace testID="travel-details-loading-subtitle2-reserved" height={16} width="82%" style={{ borderRadius: 8 }} />
                    </View>
                  </>
                )}
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

    // Use prefetch (instead of preload) to avoid "preloaded but not used" warnings when the hero image
    // isn't consumed immediately (e.g. route transitions / hydration timing).
    if (!document.querySelector(`link[rel="prefetch"][as="image"][href="${optimizedHref}"]`)) {
      const link = document.createElement("link");
      link.rel = "prefetch";
      link.as = "image";
      link.href = optimizedHref;
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
  const [loadError, setLoadError] = useState(false);
  const [retryToken, setRetryToken] = useState(0);
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

  const srcWithRetry = useMemo(() => {
    if (!retryToken) return optimizedSrc;
    const sep = optimizedSrc.includes("?") ? "&" : "?";
    return `${optimizedSrc}${sep}retry=${retryToken}`;
  }, [optimizedSrc, retryToken]);

  const handleRetry = useCallback(() => {
    setLoadError(false);
    setRetryToken((t) => t + 1);
  }, []);

  if (Platform.OS !== "web") {
    return (
      <View style={{ width: "100%", height: "100%" }}>
        {loadError ? (
          <View
            style={{
              width: "100%",
              height: "100%",
              borderRadius: 12,
              backgroundColor: "#e9e7df",
              alignItems: "center",
              justifyContent: "center",
              padding: 16,
            }}
          >
            <Text style={{ color: "#0f172a", fontWeight: "600", marginBottom: 6 }}>
              Фото не загрузилось
            </Text>
            <Text style={{ color: "#475569", textAlign: "center", marginBottom: 12 }}>
              Проверьте подключение или попробуйте позже
            </Text>
            <Pressable
              onPress={handleRetry}
              accessibilityRole="button"
              accessibilityLabel="Повторить загрузку фото"
              style={({ pressed }) => [
                {
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  borderRadius: 999,
                  backgroundColor: "#0f172a",
                },
                pressed && { opacity: 0.9 },
              ]}
            >
              <Text style={{ color: "#ffffff", fontWeight: "600" }}>Повторить</Text>
            </Pressable>
          </View>
        ) : (
          <ExpoImage
            source={{ uri: srcWithRetry }}
            style={{ width: "100%", height: "100%", borderRadius: 12 }}
            contentFit="cover"
            cachePolicy="memory-disk"
            priority="high"
            onLoad={() => {
              setLoadError(false);
              onLoad?.();
            }}
            onError={() => setLoadError(true)}
          />
        )}
      </View>
    );
  }

  return (
    <div style={{ width: "100%", height: "100%", contain: "layout style paint" as any }}>
      {loadError ? (
        <div
          style={{
            width: "100%",
            height: "100%",
            borderRadius: 12,
            backgroundColor: "#e9e7df",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "column",
            padding: 16,
            boxSizing: "border-box",
          }}
        >
          <div style={{ fontWeight: 600, color: "#0f172a", marginBottom: 6 }}>Фото не загрузилось</div>
          <div style={{ color: "#475569", textAlign: "center", marginBottom: 12 }}>
            Проверьте подключение или попробуйте позже
          </div>
          <button
            type="button"
            onClick={handleRetry as any}
            style={{
              padding: "10px 14px",
              borderRadius: 999,
              border: "none",
              backgroundColor: "#0f172a",
              color: "#ffffff",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Повторить
          </button>
        </div>
      ) : (
        <img
          src={srcWithRetry}
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
          onError={() => setLoadError(true)}
        />
      )}
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
  const { isMobile, width } = useResponsive();
  const headerOffset = 0;
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [, startTransition] = useTransition();
  // ✅ УЛУЧШЕНИЕ: Состояние для похожих путешествий (для навигации)
  const [relatedTravels, setRelatedTravels] = useState<Travel[]>([]);
  
  // ✅ АРХИТЕКТУРА: Использование кастомных хуков
  const { travel, isLoading, isError, slug, isId } = useTravelDetails();
  const { anchors, scrollTo, scrollRef } = useScrollNavigation() as { anchors: AnchorsMap; scrollTo: any; scrollRef: any };
  const { activeSection, setActiveSection } = useActiveSection(anchors, headerOffset);
  const { closeMenu, animatedX, menuWidth, menuWidthNum, openMenuOnDesktop } = useMenuState(isMobile);
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
  const [showMobileSectionTabs, setShowMobileSectionTabs] = useState(false);
  const [showStickyActions, setShowStickyActions] = useState(false);
  const [stickyActionsHeight, setStickyActionsHeight] = useState(0);
  const [heroBlockHeight, setHeroBlockHeight] = useState(0);
  
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

  useEffect(() => {
    if (!isMobile) {
      if (showMobileSectionTabs) setShowMobileSectionTabs(false);
      if (showStickyActions) setShowStickyActions(false);
      return;
    }

    // Порог появления навигации/действий — сразу после hero-блока (измеряется по факту)
    // Фоллбек 140px — если измерение ещё не произошло.
    const threshold = Math.max(140, (heroBlockHeight || 0) - 24);
    const id = scrollY.addListener(({ value }) => {
      const next = value > threshold;
      setShowMobileSectionTabs((prev) => (prev === next ? prev : next));
      setShowStickyActions((prev) => (prev === next ? prev : next));
    });
    return () => {
      scrollY.removeListener(id);
    };
  }, [heroBlockHeight, isMobile, scrollY, showMobileSectionTabs, showStickyActions]);

  const stickyActionsBottomOffset = useMemo(() => {
    if (!isMobile) return 0;
    // На мобильных (включая mobile web) держим sticky-панель над нижней док/таб-панелью
    // и учитываем safe-area.
    return insets.bottom + LAYOUT.tabBarHeight + 8;
  }, [insets.bottom, isMobile]);

  const scrollBottomPadding = useMemo(() => {
    if (!isMobile) return 0;
    if (!showStickyActions) return 0;
    // +16 — небольшой зазор, чтобы последний контент не прилипал к панели
    return stickyActionsBottomOffset + stickyActionsHeight + 16;
  }, [isMobile, showStickyActions, stickyActionsBottomOffset, stickyActionsHeight]);

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
          <Suspense fallback={<View style={{ width: 64, height: 64 }} />}>
            <LazyMaterialIcons
              // @ts-ignore - MaterialIcons name prop
              {...({ name: 'error-outline', size: 64, color: DESIGN_TOKENS.colors.primary } as any)}
            />
          </Suspense>
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

    <View
      testID="travel-details-page"
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
        <View style={[styles.mainContainer, isMobile && styles.mainContainerMobile]}>
          {/* ✅ РЕДИЗАЙН: Адаптивный spacer под меню */}
          {!isMobile && width >= METRICS.breakpoints.tablet && <View style={{ width: menuWidthNum }} />}

          {/* ✅ РЕДИЗАЙН: Адаптивное боковое меню */}
          {!isMobile && width >= METRICS.breakpoints.tablet && (
            <Defer when={deferAllowed}>
              <Animated.View
                testID="travel-details-side-menu"
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
          )}

          {/* ✅ РЕДИЗАЙН: Оптимизированная FAB кнопка (отступ от низа 80px)
              На мобильном скрываем FAB, когда открыто боковое меню, чтобы оно не перекрывалось. */}

          {/* Прогресс-бар чтения */}
          {contentHeight > viewportHeight && (
            <ReadingProgressBar
              scrollY={scrollY}
              contentHeight={contentHeight}
              viewportHeight={viewportHeight}
            />
          )}

          <ScrollView
            testID="travel-details-scroll"
            ref={scrollRef}
            contentContainerStyle={[
              styles.scrollContent,
              isMobile && showStickyActions && { paddingBottom: scrollBottomPadding },
            ]}
            keyboardShouldPersistTaps="handled"
            onScroll={Animated.event(
              [{ nativeEvent: { contentOffset: { y: scrollY } } }],
              { useNativeDriver: false }
            )}
            scrollEventThrottle={Platform.OS === 'web' ? 32 : 16}
            style={[styles.scrollView, isMobile && { width: '100%' }]}
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
                  <View
                    collapsable={false}
                    onLayout={(e) => {
                      const h = e.nativeEvent.layout.height;
                      setHeroBlockHeight((prev) => (prev === h ? prev : h));
                    }}
                  >
                  <TravelHeroSection
                    travel={travel}
                    anchors={anchors}
                    isMobile={isMobile}
                    renderSlider={Platform.OS !== "web" ? true : lcpLoaded}
                    onFirstImageLoad={() => setLcpLoaded(true)}
                    sectionLinks={sectionLinks}
                    onQuickJump={scrollToWithMenuClose}
                  />
                </View>

                  {isMobile && showMobileSectionTabs && sectionLinks.length > 0 && (
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
                        scrollY={scrollY}
                        viewportHeight={viewportHeight}
                      />
                      <TravelEngagementSection travel={travel} isMobile={isMobile} />
                    </ProgressiveWrapper>
                  </Defer>
                </SList>
              </View>
            </View>
          </ScrollView>

          {/* ✅ Sticky-панель действий отключена на мобильных, чтобы не мешать чтению */}
          {/* {isMobile && showStickyActions && (
            <View
              testID="travel-details-sticky-actions"
              pointerEvents="box-none"
              style={[
                styles.stickyActionsWrap,
                {
                  bottom: stickyActionsBottomOffset,
                },
              ]}
            >
              <View
                style={styles.stickyActionsInner}
                onLayout={(e) => {
                  const h = e.nativeEvent.layout.height;
                  setStickyActionsHeight((prev) => (prev === h ? prev : h));
                }}
              >
                <ShareButtons travel={travel} variant="sticky" />
              </View>
            </View>
          )} */}
            
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
  scrollY: Animated.Value;
  viewportHeight: number;
}> = ({ travel, isMobile, forceOpenKey, anchors, relatedTravels, setRelatedTravels, scrollY, viewportHeight }) => {
  const [canRenderHeavy, setCanRenderHeavy] = useState(false);
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
        showExcursions={showExcursions}
      />

      <TravelRelatedContent
        travel={travel}
        anchors={anchors}
        relatedTravels={relatedTravels}
        setRelatedTravels={setRelatedTravels}
        scrollY={scrollY}
        viewportHeight={viewportHeight}
      />

      <TravelEngagementSection travel={travel} isMobile={isMobile} />
    </>
  );
};

const HERO_QUICK_JUMP_KEYS = ["map", "description", "points"] as const;

const TravelHeroSection: React.FC<{
  travel: Travel;
  anchors: AnchorsMap;
  isMobile: boolean;
  renderSlider?: boolean;
  onFirstImageLoad: () => void;
  sectionLinks: TravelSectionLink[];
  onQuickJump: (key: string) => void;
}> = ({
  travel,
  anchors,
  isMobile,
  renderSlider = true,
  onFirstImageLoad,
  sectionLinks,
  onQuickJump,
}) => {
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
  const quickJumpLinks = useMemo(() => {
    return HERO_QUICK_JUMP_KEYS.map((key) => sectionLinks.find((link) => link.key === key)).filter(
      Boolean
    ) as TravelSectionLink[];
  }, [sectionLinks]);

  return (
    <>
      <View
        ref={anchors.gallery}
        testID="travel-details-section-gallery"
        collapsable={false}
        {...(Platform.OS === "web"
          ? {
              // @ts-ignore - устанавливаем data-атрибут для Intersection Observer
              "data-section-key": "gallery",
            }
          : {})}
      />

      {!!firstImg && (
        <View
          testID="travel-details-hero"
          style={[styles.sectionContainer, styles.contentStable]}
          collapsable={false}
        >
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

      <View
        testID="travel-details-quick-facts"
        style={[styles.sectionContainer, styles.contentStable, styles.quickFactsContainer]}
      >
        <QuickFacts travel={travel} />
      </View>

      {isMobile && travel.travelAddress && (
        <View style={[styles.sectionContainer, styles.contentStable, { marginTop: 16 }]}>
          <Suspense fallback={null}>
            <WeatherWidget points={travel.travelAddress as any} />
          </Suspense>
        </View>
      )}

      {quickJumpLinks.length > 0 && (
        <View style={[styles.sectionContainer, styles.contentStable, styles.quickJumpWrapper]}>
          {isMobile ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.quickJumpScrollContent}
              style={styles.quickJumpScroll}
            >
              {quickJumpLinks.map((link) => (
                <Pressable
                  key={link.key}
                  onPress={() => onQuickJump(link.key)}
                  style={({ pressed }) => [styles.quickJumpChip, pressed && styles.quickJumpChipPressed]}
                  accessibilityRole="button"
                  accessibilityLabel={`Перейти к разделу ${link.label}`}
                >
                  <Icon name={link.icon} size={18} color={DESIGN_TOKENS.colors.primary} />
                  <Text style={styles.quickJumpLabel}>{link.label}</Text>
                </Pressable>
              ))}
            </ScrollView>
          ) : (
            quickJumpLinks.map((link) => (
              <Pressable
                key={link.key}
                onPress={() => onQuickJump(link.key)}
                style={({ pressed }) => [styles.quickJumpChip, pressed && styles.quickJumpChipPressed]}
                accessibilityRole="button"
                accessibilityLabel={`Перейти к разделу ${link.label}`}
              >
                <Icon name={link.icon} size={18} color={DESIGN_TOKENS.colors.primary} />
                <Text style={styles.quickJumpLabel}>{link.label}</Text>
              </Pressable>
            ))
          )}
        </View>
      )}

      {isMobile && (
        <View
          testID="travel-details-primary-actions"
          style={[styles.sectionContainer, styles.contentStable, styles.shareButtonsContainer]}
        >
          <ShareButtons travel={travel} />
        </View>
      )}

      {!isMobile && (
        <View
          testID="travel-details-author"
          style={[styles.sectionContainer, styles.contentStable, styles.authorCardContainer]}
        >
          <Text style={styles.sectionHeaderText}>Автор</Text>
          <Text style={styles.sectionSubtitle}>Профиль, соцсети и другие путешествия автора</Text>
          <View style={{ marginTop: 12 }}>
            <AuthorCard travel={travel} />
          </View>
        </View>
      )}
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

  const stripHtml = useCallback((value?: string | null) => {
    if (!value) return "";
    return value
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }, []);

  const extractSnippets = useCallback((value?: string | null, maxSentences = 1) => {
    const text = stripHtml(value);
    if (!text) return "";
    const matches = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [];
    const parts = matches.map((p) => p.trim()).filter(Boolean);
    return parts.slice(0, Math.max(1, maxSentences)).join(" ");
  }, [stripHtml]);

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

  const decisionSummary = useMemo(() => {
    const items: Array<{ label: string; text: string; tone: "info" | "positive" | "negative" }> = [];
    const rec = extractSnippets(travel.recommendation, 2);
    const plus = extractSnippets(travel.plus, 1);
    const minus = extractSnippets(travel.minus, 1);

    if (rec) items.push({ label: "Совет", text: rec, tone: "info" });
    if (plus) items.push({ label: "Плюс", text: plus, tone: "positive" });
    if (minus) items.push({ label: "Минус", text: minus, tone: "negative" });

    return items.slice(0, 3);
  }, [extractSnippets, travel.minus, travel.plus, travel.recommendation]);

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

                {decisionSummary.length > 0 && (
                  <View style={styles.decisionSummaryBox}>
                    <Text style={styles.decisionSummaryTitle}>Коротко по делу</Text>
                    <View style={styles.decisionSummaryList}>
                      {decisionSummary.map((item, idx) => (
                        <View key={`${item.label}-${idx}`} style={styles.decisionSummaryRow}>
                          <View
                            style={[
                              styles.decisionSummaryBadge,
                              item.tone === "positive" && styles.decisionSummaryBadgePositive,
                              item.tone === "negative" && styles.decisionSummaryBadgeNegative,
                              item.tone === "info" && styles.decisionSummaryBadgeInfo,
                            ]}
                          >
                            <Text
                              style={[
                                styles.decisionSummaryBadgeText,
                                item.tone === "positive" && styles.decisionSummaryBadgeTextPositive,
                                item.tone === "negative" && styles.decisionSummaryBadgeTextNegative,
                                item.tone === "info" && styles.decisionSummaryBadgeTextInfo,
                              ]}
                            >
                              {item.label}
                            </Text>
                          </View>
                          <Text style={styles.decisionSummaryText}>{item.text}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

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
  showExcursions: boolean;
}> = ({ travel, anchors, canRenderHeavy, showExcursions }) => {
  const { width } = useWindowDimensions();
  const hasMapData = (travel.coordsMeTravel?.length ?? 0) > 0;
  const { shouldLoad: shouldLoadMap, setElementRef } = useLazyMap({ enabled: Platform.OS === 'web' });
  const shouldRenderMap = canRenderHeavy && (Platform.OS !== 'web' || shouldLoadMap) && hasMapData;

  const isMobileWeb = Platform.OS === 'web' && width <= METRICS.breakpoints.tablet;

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
                <View style={{ marginTop: 12, minHeight: 600 }}>
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
        testID="travel-details-map"
        style={[styles.sectionContainer, styles.contentStable]}
        collapsable={false}
        {...(Platform.OS === "web" ? { "data-section-key": "map", "data-map-for-pdf": "1" } : {})}
      >
        {Platform.OS === 'web' && (
          <View
            collapsable={false}
            // @ts-ignore - ref callback for RNW
            ref={(node: any) => {
              const target = node?._nativeNode || node?._domNode || node || null;
              setElementRef(target as any);
            }}
          />
        )}
        <Text style={styles.sectionHeaderText}>Карта маршрута</Text>
        <Text style={styles.sectionSubtitle}>Посмотрите последовательность точек на живой карте</Text>
        <View style={{ marginTop: 12 }}>
          {hasMapData ? (
            <ToggleableMap
              initiallyOpen={isMobileWeb ? false : true}
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
        testID="travel-details-points"
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
  scrollY: Animated.Value;
  viewportHeight: number;
}> = ({ travel, anchors, relatedTravels, setRelatedTravels, scrollY, viewportHeight }) => {
  const isWeb = Platform.OS === 'web';
  const preloadMargin = 200;

  const { shouldLoad: shouldLoadNearWeb, setElementRef: setNearRefWeb } = useProgressiveLoad({
    priority: 'low',
    rootMargin: `${preloadMargin}px`,
    threshold: 0.1,
    fallbackDelay: 1500,
  });
  const { shouldLoad: shouldLoadPopularWeb, setElementRef: setPopularRefWeb } = useProgressiveLoad({
    priority: 'low',
    rootMargin: `${preloadMargin}px`,
    threshold: 0.1,
    fallbackDelay: 1500,
  });

  const [nearTop, setNearTop] = useState<number | null>(null);
  const [popularTop, setPopularTop] = useState<number | null>(null);
  const [shouldLoadNearNative, setShouldLoadNearNative] = useState(false);
  const [shouldLoadPopularNative, setShouldLoadPopularNative] = useState(false);

  useEffect(() => {
    if (isWeb) return;
    if (!viewportHeight || viewportHeight <= 0) return;

    const id = scrollY.addListener(({ value }) => {
      const bottomY = value + viewportHeight + preloadMargin;

      if (nearTop != null) {
        const nextNear = bottomY >= nearTop;
        setShouldLoadNearNative((prev) => (prev === nextNear ? prev : nextNear));
      }

      if (popularTop != null) {
        const nextPopular = bottomY >= popularTop;
        setShouldLoadPopularNative((prev) => (prev === nextPopular ? prev : nextPopular));
      }
    });

    return () => {
      scrollY.removeListener(id);
    };
  }, [isWeb, nearTop, popularTop, preloadMargin, scrollY, viewportHeight]);

  const shouldLoadNear = isWeb ? shouldLoadNearWeb : shouldLoadNearNative;
  const shouldLoadPopular = isWeb ? shouldLoadPopularWeb : shouldLoadPopularNative;

  return (
    <>
    <View
      ref={anchors.near}
      style={[styles.sectionContainer, styles.contentStable]}
      collapsable={false}
      onLayout={isWeb ? undefined : (e: LayoutChangeEvent) => {
        const y = e.nativeEvent.layout.y;
        setNearTop((prev) => (prev === y ? prev : y));
      }}
      {...(Platform.OS === "web" ? { "data-section-key": "near" } : {})}
    >
      {Platform.OS === 'web' ? (
        <View
          collapsable={false}
          // @ts-ignore - ref callback for RNW
          ref={(node: any) => {
            const target = node?._nativeNode || node?._domNode || node || null;
            setNearRefWeb(target);
          }}
        />
      ) : (
        <View />
      )}
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
        {travel.travelAddress &&
          (shouldLoadNear ? (
            <View testID="travel-details-near-loaded">
              <Suspense fallback={<TravelListFallback />}>
                <NearTravelList
                  travel={travel}
                  onTravelsLoaded={(travels) => setRelatedTravels(travels)}
                />
              </Suspense>
            </View>
          ) : (
            <View testID="travel-details-near-placeholder" style={styles.lazySectionReserved}>
              <TravelListSkeleton count={3} />
            </View>
          ))}
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
      onLayout={isWeb ? undefined : (e: LayoutChangeEvent) => {
        const y = e.nativeEvent.layout.y;
        setPopularTop((prev) => (prev === y ? prev : y));
      }}
      {...(Platform.OS === "web" ? { "data-section-key": "popular" } : {})}
    >
      {Platform.OS === 'web' ? (
        <View
          collapsable={false}
          // @ts-ignore - ref callback for RNW
          ref={(node: any) => {
            const target = node?._nativeNode || node?._domNode || node || null;
            setPopularRefWeb(target);
          }}
        />
      ) : (
        <View />
      )}
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
        {shouldLoadPopular ? (
          <View testID="travel-details-popular-loaded">
            <Suspense fallback={<TravelListFallback />}>
              <PopularTravelList />
            </Suspense>
          </View>
        ) : (
          <View testID="travel-details-popular-placeholder" style={styles.lazySectionReserved}>
            <TravelListSkeleton count={3} />
          </View>
        )}
      </View>
    </View>
    </>
  );
};

const TravelEngagementSection: React.FC<{ travel: Travel; isMobile: boolean }> = ({ travel, isMobile }) => (
  <>
    <View testID="travel-details-telegram" style={[styles.sectionContainer, styles.authorCardContainer]}>
      <TelegramDiscussionSection travel={travel} />
    </View>

    {!isMobile && (
      <View testID="travel-details-share" style={[styles.sectionContainer, styles.shareButtonsContainer]}>
        <ShareButtons travel={travel} />
      </View>
    )}

    <View testID="travel-details-cta" style={[styles.sectionContainer, styles.ctaContainer]}>
      <CTASection travel={travel} />
    </View>
  </>
);

/* -------------------- styles -------------------- */
const styles = StyleSheet.create({
  // ✅ РЕДИЗАЙН: Светлый современный фон
  wrapper: { 
    flex: 1, 
    backgroundColor: DESIGN_TOKENS.colors.background,
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
  stickyActionsWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    zIndex: 2000,
  },
  stickyActionsInner: {
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: DESIGN_TOKENS.colors.surface,
    borderWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.08)',
    ...Platform.select({
      web: ({
        // @ts-ignore - web-only shadow
        boxShadow: '0px 8px 24px rgba(15, 23, 42, 0.12)',
      } as any),
      default: {
        elevation: 6,
      },
    }),
  },
  lazySectionReserved: {
    width: '100%',
    minHeight: Platform.select({
      web: 560,
      default: 520,
    }),
  },

  // ✅ РЕДИЗАЙН: Адаптивное боковое меню
  sideMenuBase: {
    backgroundColor: DESIGN_TOKENS.colors.surface,
    borderRightWidth: 1,
    borderRightColor: DESIGN_TOKENS.colors.borderLight,
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
  sectionContainer: {
    marginBottom: DESIGN_TOKENS.spacing.xxl,
    paddingHorizontal: Platform.select({
      default: DESIGN_TOKENS.spacing.lg,
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

  quickJumpWrapper: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: DESIGN_TOKENS.spacing.md,
  },
  quickJumpScroll: {
    flexGrow: 0,
  },
  quickJumpScrollContent: {
    paddingRight: DESIGN_TOKENS.spacing.md,
  },
  quickJumpChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: DESIGN_TOKENS.colors.borderLight,
    backgroundColor: DESIGN_TOKENS.colors.surface,
    marginRight: DESIGN_TOKENS.spacing.sm,
    marginBottom: DESIGN_TOKENS.spacing.sm,
    ...Platform.select({
      web: {
        boxShadow: DESIGN_TOKENS.shadows.light,
      } as any,
      default: DESIGN_TOKENS.shadowsNative.light,
    }),
  },
  quickJumpChipPressed: {
    backgroundColor: DESIGN_TOKENS.colors.primaryLight,
    borderColor: DESIGN_TOKENS.colors.borderAccent,
  },
  quickJumpLabel: {
    fontSize: 14,
    fontWeight: "600" as any,
    color: DESIGN_TOKENS.colors.text,
    marginLeft: 8,
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

  decisionSummaryBox: {
    marginBottom: DESIGN_TOKENS.spacing.xl,
    padding: DESIGN_TOKENS.spacing.xl,
    borderRadius: DESIGN_TOKENS.radii.lg,
    borderWidth: 1,
    borderColor: DESIGN_TOKENS.colors.borderLight,
    backgroundColor: DESIGN_TOKENS.colors.surface,
    ...Platform.select({
      web: {
        boxShadow: DESIGN_TOKENS.shadows.card,
      } as any,
      default: DESIGN_TOKENS.shadowsNative.medium,
    }),
  },
  decisionSummaryTitle: {
    fontSize: DESIGN_TOKENS.typography.sizes.lg,
    fontWeight: DESIGN_TOKENS.typography.weights.semibold as any,
    color: DESIGN_TOKENS.colors.text,
    marginBottom: DESIGN_TOKENS.spacing.sm,
  },
  decisionSummaryList: {
    gap: DESIGN_TOKENS.spacing.sm,
  },
  decisionSummaryRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: DESIGN_TOKENS.spacing.sm,
  },
  decisionSummaryBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  decisionSummaryBadgeInfo: {
    backgroundColor: 'rgba(59, 130, 246, 0.10)',
    borderColor: 'rgba(59, 130, 246, 0.18)',
  },
  decisionSummaryBadgePositive: {
    backgroundColor: 'rgba(34, 197, 94, 0.10)',
    borderColor: 'rgba(34, 197, 94, 0.18)',
  },
  decisionSummaryBadgeNegative: {
    backgroundColor: 'rgba(239, 68, 68, 0.10)',
    borderColor: 'rgba(239, 68, 68, 0.18)',
  },
  decisionSummaryBadgeText: {
    fontSize: 12,
    fontWeight: '800' as any,
    letterSpacing: 0.2,
  },
  decisionSummaryBadgeTextInfo: {
    color: '#1d4ed8',
  },
  decisionSummaryBadgeTextPositive: {
    color: '#15803d',
  },
  decisionSummaryBadgeTextNegative: {
    color: '#b91c1c',
  },
  decisionSummaryText: {
    flex: 1,
    fontSize: DESIGN_TOKENS.typography.sizes.md,
    lineHeight: Platform.select({ default: 24, web: 22 }),
    color: DESIGN_TOKENS.colors.text,
    fontWeight: DESIGN_TOKENS.typography.weights.medium as any,
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

  // ✅ РЕДИЗАЙН: Современные карточки с улучшенными тенями
  // ✅ РЕДИЗАЙН: Унифицированные карточки с единой системой радиусов (12px)
  sectionHeaderBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Platform.select({
      default: DESIGN_TOKENS.spacing.lg,
      web: DESIGN_TOKENS.spacing.xl,
    }),
    paddingHorizontal: Platform.select({
      default: DESIGN_TOKENS.spacing.lg,
      web: DESIGN_TOKENS.spacing.xl,
    }),
    backgroundColor: DESIGN_TOKENS.colors.surface,
    borderRadius: DESIGN_TOKENS.radii.lg,
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: DESIGN_TOKENS.colors.borderLight,
    minHeight: 64,
    ...Platform.select({
      web: {
        boxShadow: DESIGN_TOKENS.shadows.card,
      } as any,
      default: DESIGN_TOKENS.shadowsNative.medium,
    }),
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
    flexShrink: 1,
    flexGrow: 1,
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
    flexShrink: 0,
  },
  sectionHeaderBadge: {
    fontSize: Platform.select({ default: 11, web: 12 }),
    fontWeight: DESIGN_TOKENS.typography.weights.semibold as any,
    color: DESIGN_TOKENS.colors.textMuted,
    backgroundColor: DESIGN_TOKENS.colors.surfaceMuted,
    paddingHorizontal: DESIGN_TOKENS.spacing.sm,
    paddingVertical: DESIGN_TOKENS.spacing.xxs,
    borderRadius: DESIGN_TOKENS.radii.pill,
    flexShrink: 0,
  },

  sectionHeaderText: { 
    fontSize: Platform.select({
      default: 20,
      web: 24,
    }),
    fontWeight: '700' as any,
    color: DESIGN_TOKENS.colors.text,
    letterSpacing: -0.4,
    lineHeight: Platform.select({
      default: 28,
      web: 32,
    }),
    flexShrink: 1,
  },
  sectionSubtitle: {
    fontSize: Platform.select({ default: 14, web: 16 }),
    color: DESIGN_TOKENS.colors.textMuted,
    marginTop: DESIGN_TOKENS.spacing.sm,
    lineHeight: Platform.select({ default: 22, web: 24 }),
  },

  sliderContainer: { 
    width: "100%",
    borderRadius: DESIGN_TOKENS.radii.lg,
    overflow: "hidden",
    marginBottom: Platform.select({
      default: DESIGN_TOKENS.spacing.lg,
      web: DESIGN_TOKENS.spacing.xl,
    }),
    ...Platform.select({
      web: {
        boxShadow: DESIGN_TOKENS.shadows.heavy,
      } as any,
      default: DESIGN_TOKENS.shadowsNative.heavy,
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
    borderRadius: DESIGN_TOKENS.radii.lg,
    padding: Platform.select({
      default: DESIGN_TOKENS.spacing.lg,
      web: DESIGN_TOKENS.spacing.xl,
    }),
    borderWidth: 1,
    borderColor: DESIGN_TOKENS.colors.borderLight,
    ...Platform.select({
      web: {
        boxShadow: DESIGN_TOKENS.shadows.card,
      } as any,
      default: DESIGN_TOKENS.shadowsNative.medium,
    }),
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
  travelListFallback: {
    width: '100%',
    minHeight: Platform.select({
      web: 560,
      default: 520,
    }),
    justifyContent: 'center',
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
