// app/travels/[param].tsx
import React, {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import {
  ActivityIndicator,
  Animated,
  Platform,
  SafeAreaView,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  DeviceEventEmitter,
  useWindowDimensions,
} from "react-native";

import { useIsFocused } from "@react-navigation/native";
import { useAuth } from '@/context/AuthContext';
import { METRICS } from '@/constants/layout';
import { useResponsive } from '@/hooks/useResponsive';

import type { Travel } from "@/src/types/types";
/* ✅ АРХИТЕКТУРА: Импорт кастомных хуков */
import { useTravelDetails } from "@/hooks/useTravelDetails";
import { useActiveSection } from "@/hooks/useActiveSection";
import { useScrollNavigation } from "@/hooks/useScrollNavigation";
import { useMenuState } from "@/hooks/useMenuState";
import { useScrollListener } from "@/hooks/useTravelDetailsUtils";
import InstantSEO from "@/components/seo/InstantSEO";
import { createSafeJsonLd, stripHtml, createSafeImageUrl, getSafeOrigin } from "@/utils/travelDetailsSecure";
import ScrollToTopButton from "@/components/ScrollToTopButton";
import ReadingProgressBar from "@/components/ReadingProgressBar";
import TravelSectionsSheet from "@/components/travel/TravelSectionsSheet";
import { buildTravelSectionLinks } from "@/components/travel/sectionLinks";
import { ProgressiveWrapper } from '@/hooks/useProgressiveLoading';
import { optimizeImageUrl, getPreferredImageFormat } from "@/utils/imageOptimization";
import { injectCriticalStyles } from '@/styles/criticalCSS';
import { initPerformanceMonitoring } from '@/utils/performanceMonitoring';
import { SectionSkeleton } from '@/components/SectionSkeleton';
import { optimizeCriticalPath } from '@/utils/advancedPerformanceOptimization';

import { DESIGN_TOKENS } from '@/constants/designSystem';
import {
  TravelDeferredSections as TravelDeferredSectionsComponent,
  TravelHeroSection,
  useLCPPreload,
  OptimizedLCPHero,
} from "@/components/travel/details/TravelDetailsSections";
import type { AnchorsMap } from "@/components/travel/details/TravelDetailsTypes";
import { styles, HEADER_OFFSET_DESKTOP, HEADER_OFFSET_MOBILE } from "@/components/travel/details/TravelDetailsStyles";

/* ✅ PHASE 2: Accessibility (WCAG AAA) */
import SkipToContentLink from "@/components/accessibility/SkipToContentLink";
import AccessibilityAnnouncer from "@/components/accessibility/AccessibilityAnnouncer";
import { useAccessibilityAnnounce, useReducedMotion } from "@/hooks/useKeyboardNavigation";

/* -------------------- helpers -------------------- */
const retry = async <T,>(fn: () => Promise<T>, tries = 2, delay = 400): Promise<T> => {
  try {
    return await fn();
  } catch {
    if (tries <= 0) throw new Error('retry failed');
    await new Promise((r) => setTimeout(r, delay));
    return retry(fn, tries - 1, delay);
  }
}

const withLazy = <T extends React.ComponentType<any>>(f: () => Promise<{ default: T }>) =>
  lazy(async () => {
    try {
      return await retry(f, 2, 400);
    } catch {
      return {
        default: (() => (
          <View style={{ padding: DESIGN_TOKENS.spacing.md }}>
            <Text>Component failed to load</Text>
          </View>
        )) as unknown as T,
      };
    }
  });

const CompactSideBarTravel = withLazy(() => import("@/components/travel/CompactSideBarTravel"));

/* -------------------- SuspenseList shim -------------------- */
const SList: React.FC<{
  children: React.ReactNode;
  revealOrder?: "forwards" | "backwards" | "together";
  tail?: "collapsed" | "hidden";
}> = (props) => {
  const Experimental = (React as any).unstable_SuspenseList || (React as any).SuspenseList;
  return Experimental ? <Experimental {...props} /> : <>{props.children}</>;
};



/* -------------------- utils (используются из импортов) -------------------- */
// ✅ SECURITY: Функции перемещены в utils/travelDetailsSecure.ts:
// - stripHtml: защита от XSS
// - createSafeImageUrl: безопасное преобразование URL
// - getSafeOrigin: валидация origin

// Переадресация для обратной совместимости внутри компонента
const stripToDescription = (html?: string) => stripHtml(html).slice(0, 160);
const getOrigin = getSafeOrigin;
const buildVersioned = (url?: string, updated_at?: string | null, id?: any) =>
  createSafeImageUrl(url, updated_at, id);

/* -------------------- idle helper -------------------- */
const rIC = (cb: () => void, timeout = 300) => {
  if (typeof (window as any)?.requestIdleCallback === "function") {
    (window as any).requestIdleCallback(cb, { timeout });
  } else {
    setTimeout(cb, timeout);
  }
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
    rIC(kick, 500);
    const t = setTimeout(kick, 1000);
    return () => clearTimeout(t);
  }, [when]);
  return ready ? <>{children}</> : null;
};

/* =================================================================== */

export default function TravelDetailsContainer() {
  const { isMobile, width: responsiveWidth } = useResponsive();
  const { width: screenWidth } = useWindowDimensions();
  // Fallback to true if hook is unavailable (e.g., static render) while preserving hook order
  const useIsFocusedSafe = useIsFocused ?? (() => true);
  const isFocused = useIsFocusedSafe();
  const [, startTransition] = useTransition();

  /* ✅ PHASE 2: Accessibility Hooks */
  const { announcement, priority: announcementPriority } = useAccessibilityAnnounce();
  // Note: useReducedMotion hook will be used in future for animation handling
  useReducedMotion();

  // ✅ УЛУЧШЕНИЕ: Состояние для похожих путешествий (для навигации)
  const [relatedTravels, setRelatedTravels] = useState<Travel[]>([]);
  
  // ✅ АРХИТЕКТУРА: Использование кастомных хуков
  const { travel, isLoading, isError, error, refetch, slug, isMissingParam } = useTravelDetails();
  const { anchors, scrollTo, scrollRef } = useScrollNavigation() as { anchors: AnchorsMap; scrollTo: any; scrollRef: any };
  const [scrollRootEl, setScrollRootEl] = useState<HTMLElement | null>(null);
  const headerOffset = useMemo(
    () => (isMobile ? HEADER_OFFSET_MOBILE : HEADER_OFFSET_DESKTOP),
    [isMobile]
  );

  useEffect(() => {
    if (Platform.OS !== 'web') return;

    let cancelled = false;
    let attempts = 0;
    let rafId: number | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const readNode = (): HTMLElement | null => {
      const scrollViewAny = scrollRef.current as any;
      const node: HTMLElement | null =
        (typeof scrollViewAny?.getScrollableNode === 'function' && scrollViewAny.getScrollableNode()) ||
        scrollViewAny?._scrollNode ||
        scrollViewAny?._innerViewNode ||
        scrollViewAny?._nativeNode ||
        scrollViewAny?._domNode ||
        null;

      if (node && typeof node === 'object' && typeof (node as any).getBoundingClientRect === 'function') {
        return node;
      }

      return null;
    };

    const tick = () => {
      if (cancelled) return;
      attempts += 1;

      const node = readNode();
      if (node) {
        setScrollRootEl((prev) => (prev === node ? prev : node));
        return;
      }

      if (attempts >= 60) return;

      const raf =
        (typeof window !== 'undefined' && window.requestAnimationFrame) ||
        (typeof globalThis !== 'undefined' && (globalThis as any).requestAnimationFrame);

      if (typeof raf === 'function') {
        rafId = raf(() => tick()) as any;
      } else {
        timeoutId = setTimeout(() => tick(), 16);
      }
    };

    tick();

    return () => {
      cancelled = true;
      if (rafId != null && typeof window !== 'undefined' && typeof window.cancelAnimationFrame === 'function') {
        try {
          window.cancelAnimationFrame(rafId);
        } catch {
          // noop
        }
      }
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [scrollRef, slug]);

  const { activeSection, setActiveSection } = useActiveSection(anchors, headerOffset, scrollRootEl);
  const { closeMenu, animatedX, menuWidth, menuWidthNum, openMenuOnDesktop } = useMenuState(isMobile);
  const sectionLinks = useMemo(() => buildTravelSectionLinks(travel), [travel]);
  // Стабильный ключ для <Head>, чтобы избежать ReferenceError при отрисовке
  const headKey = useMemo(
    () => `travel-${travel?.id ?? slug ?? "unknown"}`,
    [travel?.id, slug]
  );

  const {
    readyTitle,
    readyDesc,
    canonicalUrl,
    readyImage,
    lcpPreloadImage,
    firstImgOrigin,
    firstImg,
    jsonLd,
  } = useMemo(() => {
    const title = travel?.name ? `${travel.name} | MeTravel` : "MeTravel";
    const desc = stripToDescription(travel?.description);
    const canonical =
      typeof travel?.slug === "string" && travel.slug
        ? `https://metravel.by/travels/${travel.slug}`
        : undefined;
    const rawFirst = travel?.gallery?.[0];
    const firstUrl = rawFirst
      ? typeof rawFirst === "string"
        ? rawFirst
        : rawFirst.url
      : undefined;
    const versioned = firstUrl
      ? buildVersioned(firstUrl, (rawFirst as any)?.updated_at, (rawFirst as any)?.id)
      : undefined;
    const lcpUrl =
      versioned &&
      optimizeImageUrl(versioned, {
        width: 1440,
        format: getPreferredImageFormat(),
        quality: 85,
        fit: "contain",
      });
    const origin = firstUrl ? getOrigin(firstUrl) : null;

    const structuredData = createSafeJsonLd(travel);

    return {
      readyTitle: title,
      readyDesc: desc,
      canonicalUrl: canonical,
      readyImage: firstUrl,
      lcpPreloadImage: lcpUrl ?? versioned ?? firstUrl,
      firstImgOrigin: origin,
      firstImg: firstUrl ? { url: firstUrl } : null,
      jsonLd: structuredData,
    };
  }, [travel]);
  const contentHorizontalPadding = useMemo(() => {
    // Mobile should use the full width with a compact, consistent gutter.
    if (isMobile) return 16;
    if (screenWidth >= 1600) return 80;
    if (screenWidth >= 1440) return 64;
    if (screenWidth >= 1024) return 48;
    if (screenWidth >= 768) return 32;
    return 16;
  }, [isMobile, screenWidth]);
  const sideMenuPlatformStyles =
    Platform.OS === "web"
      ? isMobile
        ? styles.sideMenuWebMobile
        : styles.sideMenuWebDesktop
      : styles.sideMenuNative;

  /* ---- open-section bridge ---- */
  const [forceOpenKey, setForceOpenKey] = useState<string | null>(null);
  const handleSectionOpen = useCallback((key: string) => {
    try {
      const dbg = Platform.OS === 'web' && typeof window !== 'undefined' && (window as any).__NAV_DEBUG__;
      if (dbg) {
        // eslint-disable-next-line no-console
        console.debug('[nav] open-section received', { key });
      }
    } catch {
      // noop
    }
    startTransition(() => setForceOpenKey(key));
  }, []);

  useEffect(() => {
    if (!forceOpenKey) return;

    try {
      const dbg = Platform.OS === 'web' && typeof window !== 'undefined' && (window as any).__NAV_DEBUG__;
      if (dbg) {
        // eslint-disable-next-line no-console
        console.debug('[nav] forceOpenKey effect', { forceOpenKey });
      }
    } catch {
      // noop
    }

    // Когда секции монтируются лениво, первый scrollTo может промахнуться.
    // Делаем несколько попыток с небольшим интервалом, чтобы дождаться DOM/layout.
    const timeouts: Array<ReturnType<typeof setTimeout>> = [];
    const MAX_ATTEMPTS = 10;
    const INTERVAL_MS = 120;

    for (let i = 0; i < MAX_ATTEMPTS; i += 1) {
      timeouts.push(
        setTimeout(() => {
          scrollTo(forceOpenKey);
        }, i * INTERVAL_MS)
      );
    }

    return () => {
      timeouts.forEach((t) => clearTimeout(t));
    };
  }, [forceOpenKey, scrollTo]);

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
    }, 800);
  }, []);

  // ✅ АРХИТЕКТУРА: anchors и scrollRef теперь создаются в useScrollNavigation
  const scrollY = useRef(new Animated.Value(0)).current;
  const [contentHeight, setContentHeight] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [showMobileSectionTabs, setShowMobileSectionTabs] = useState(false);
  const [heroBlockHeight, setHeroBlockHeight] = useState(0);
  const forceDeferMount = !!forceOpenKey;
  
  // ✅ АРХИТЕКТУРА: activeSection теперь управляется через useActiveSection
  
  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
    // По умолчанию считаем активной секцию галереи, чтобы в меню
    // всегда был выделен хотя бы один пункт при первом рендере
    setActiveSection("gallery");
  }, [slug, setActiveSection, scrollRef]);

  // Измеряем высоту контента для прогресс-бара
  const handleContentSizeChange = useCallback((_w: number, h: number) => {
    setContentHeight(h);
  }, []);

  const handleLayout = useCallback((e: any) => {
    setViewportHeight(e.nativeEvent.layout.height);
  }, []);

  // ✅ SECURITY: Используем useScrollListener хук вместо ручного управления памятью
  useScrollListener(
    scrollY,
    (value) => {
      if (isMobile) {
        const threshold = Math.max(140, (heroBlockHeight || 0) - 24);
        const next = value > threshold;
        setShowMobileSectionTabs((prev) => (prev === next ? prev : next));
      }
    },
    [isMobile, heroBlockHeight]
  );

  useEffect(() => {
    if (!isMobile) {
      if (showMobileSectionTabs) setShowMobileSectionTabs(false);
      return;
    }
  }, [isMobile, showMobileSectionTabs]);

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
            } catch {
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
  const [lcpLoaded, setLcpLoaded] = useState(false);
  const [sliderReady, setSliderReady] = useState(Platform.OS !== "web");
  const [deferAllowed, setDeferAllowed] = useState(false);

  useLCPPreload(travel, isMobile);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    if (!lcpLoaded) return;
    rIC(() => setSliderReady(true), 600);
  }, [lcpLoaded]);

  useEffect(() => {
    if (!isLoading) {
      setDeferAllowed(true);
    }
  }, [isLoading]);

  useEffect(() => {
    if (lcpLoaded) setDeferAllowed(true);
    else rIC(() => setDeferAllowed(true), 800);
  }, [lcpLoaded]);

  useEffect(() => {
    if (Platform.OS !== "web" || lcpLoaded) return;
    const timeout = setTimeout(() => setLcpLoaded(true), 2500);
    return () => clearTimeout(timeout);
  }, [lcpLoaded]);

  /* ---- show menu on desktop after defer ---- */
  useEffect(() => {
    if (deferAllowed && !isMobile) {
      openMenuOnDesktop();
    }
  }, [deferAllowed, isMobile, openMenuOnDesktop]);

  /* ---- user flags ---- */
  const { isSuperuser, userId } = useAuth();

  /* -------------------- READY -------------------- */

  // Пока данные путешествия не загружены — показываем простой лоадер,
  // но делаем это после инициализации всех хуков, чтобы не нарушать порядок.
  if (isMissingParam) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={[styles.mainContainer, styles.mainContainerMobile]}>
          <Text style={{ color: DESIGN_TOKENS.colors.text, fontSize: 16, fontWeight: '700', marginBottom: 8 }}>
            Путешествие не найдено
          </Text>
          <Text style={{ color: DESIGN_TOKENS.colors.textMuted, fontSize: 14, textAlign: 'center' }}>
            В ссылке отсутствует идентификатор путешествия.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (isError) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={[styles.mainContainer, styles.mainContainerMobile]}>
          <Text style={{ color: DESIGN_TOKENS.colors.text, fontSize: 16, fontWeight: '700', marginBottom: 8 }}>
            Не удалось загрузить путешествие
          </Text>
          <Text style={{ color: DESIGN_TOKENS.colors.textMuted, fontSize: 14, textAlign: 'center', marginBottom: 12 }}>
            {error?.message || 'Попробуйте обновить страницу.'}
          </Text>
          <TouchableOpacity
            onPress={() => refetch()}
            style={{
              paddingHorizontal: 14,
              paddingVertical: 10,
              borderRadius: 10,
              backgroundColor: DESIGN_TOKENS.colors.primary,
            }}
            accessibilityRole="button"
          >
            <Text style={{ color: '#fff', fontWeight: '700' }}>Повторить</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (!travel) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={[styles.mainContainer, styles.mainContainerMobile]}>
          <ActivityIndicator size="large" color={DESIGN_TOKENS.colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <>
      {/* ✅ PHASE 2: Accessibility Components */}
      <SkipToContentLink targetId="travel-main-content" label="Skip to main content" />
      <AccessibilityAnnouncer message={announcement} priority={announcementPriority} id="travel-announcer" />

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
      id="travel-main-content"
      role="main"
      aria-label={`Travel details for ${travel?.name || 'travel'}`}
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
          {!isMobile && Platform.OS !== 'web' && responsiveWidth >= METRICS.breakpoints.tablet && <View style={{ width: menuWidthNum }} />}

          {/* ✅ РЕДИЗАЙН: Адаптивное боковое меню */}
          {!isMobile && responsiveWidth >= METRICS.breakpoints.tablet && (
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
                    renderSlider={Platform.OS !== "web" ? true : sliderReady}
                    onFirstImageLoad={() => setLcpLoaded(true)}
                    sectionLinks={sectionLinks}
                    onQuickJump={scrollToWithMenuClose}
                  />
                  </View>

                  {isMobile && sectionLinks.length > 0 && (
                    <View style={styles.sectionTabsContainer}>
                      <TravelSectionsSheet
                        links={sectionLinks}
                        activeSection={activeSection}
                        onNavigate={scrollToWithMenuClose}
                        testID="travel-sections-sheet-wrapper"
                      />
                    </View>
                  )}

                  {/* -------- deferred heavy content -------- */}
                  <Defer when={deferAllowed || forceDeferMount}>
                    {forceDeferMount ? (
                      <TravelDeferredSectionsComponent
                        travel={travel}
                        isMobile={isMobile}
                        forceOpenKey={forceOpenKey}
                        anchors={anchors}
                        relatedTravels={relatedTravels}
                        setRelatedTravels={setRelatedTravels}
                        scrollY={scrollY}
                        viewportHeight={viewportHeight}
                        scrollRef={scrollRef}
                      />
                    ) : (
                      <ProgressiveWrapper 
                        config={{ priority: 'normal', rootMargin: '100px' }}
                        fallback={<SectionSkeleton />}
                      >
                        <TravelDeferredSectionsComponent
                          travel={travel}
                          isMobile={isMobile}
                          forceOpenKey={forceOpenKey}
                          anchors={anchors}
                          relatedTravels={relatedTravels}
                          setRelatedTravels={setRelatedTravels}
                          scrollY={scrollY}
                          viewportHeight={viewportHeight}
                          scrollRef={scrollRef}
                        />
                      </ProgressiveWrapper>
                    )}
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

export const __testables = {
  OptimizedLCPHero,
  useLCPPreload,
  TravelHeroSection,
};
