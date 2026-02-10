// app/travels/[param].tsx
import React, {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import {
  Animated,
  Platform,
  SafeAreaView,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { useIsFocused, useNavigation } from "@react-navigation/native";
import { useAuth } from '@/context/AuthContext';
import { METRICS } from '@/constants/layout';
import { useResponsive } from '@/hooks/useResponsive';

/* ✅ АРХИТЕКТУРА: Импорт кастомных хуков */
import { useTravelDetails } from "@/hooks/travel-details";
import InstantSEO from "@/components/seo/LazyInstantSEO";
import { buildCanonicalUrl } from "@/utils/seo";
import { createSafeJsonLd, stripHtml, getSafeOrigin } from "@/utils/travelDetailsSecure";
import { buildTravelSectionLinks } from "@/components/travel/sectionLinks";
import { SectionSkeleton } from '@/components/ui/SectionSkeleton';
import { TravelDetailPageSkeleton } from '@/components/travel/TravelDetailPageSkeleton';

import { TravelHeroSection } from "@/components/travel/details/TravelDetailsSections";
import { useTravelDetailsStyles } from "@/components/travel/details/TravelDetailsStyles";
import { withLazy } from "@/components/travel/details/TravelDetailsLazy";

/* ✅ PHASE 2: Accessibility (WCAG AAA) */
import { useAccessibilityAnnounce, useReducedMotion } from "@/hooks/useKeyboardNavigation";
import { useThemedColors } from "@/hooks/useTheme";
import { rIC } from '@/utils/rIC';

/* -------------------- helpers -------------------- */

const SkipToContentLink = withLazy(() => import("@/components/accessibility/SkipToContentLink"));
const AccessibilityAnnouncer = withLazy(() => import("@/components/accessibility/AccessibilityAnnouncer"));
const ScrollToTopButton = withLazy(() => import("@/components/ui/ScrollToTopButton"));
const ReadingProgressBar = withLazy(() => import("@/components/ui/ReadingProgressBar"));
const TravelSectionsSheet = withLazy(() => import("@/components/travel/TravelSectionsSheet"));
const TravelStickyActions = withLazy(() => import("@/components/travel/details/TravelStickyActions"));
const CompactSideBarTravel = withLazy(() => import("@/components/travel/CompactSideBarTravel"));
const TravelDeferredSections = withLazy(() =>
  import("@/components/travel/details/TravelDetailsDeferred").then((m) => ({
    default: m.TravelDeferredSections,
  }))
);

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

/* -------------------- Defer wrapper -------------------- */
const Defer: React.FC<{ when: boolean; children: React.ReactNode }> = ({ when, children }) => {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!when) return;

    if (Platform.OS === 'web') {
      // Use rIC so the browser can finish painting the LCP hero image and run
      // any pending layout work before we mount heavy deferred sections.
      // The 300 ms timeout is a safety net — on fast machines rIC fires much
      // sooner, but we never block the paint for more than one idle period.
      let cancelled = false;
      const kick = () => { if (!cancelled) setReady(true); };
      rIC(kick, 300);
      return () => { cancelled = true; };
    }
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
  const navigation = useNavigation();
  const [, startTransition] = useTransition();

  const isWebAutomation =
    Platform.OS === 'web' &&
    typeof navigator !== 'undefined' &&
    Boolean((navigator as any).webdriver);

  /* ✅ PHASE 2: Accessibility Hooks */
  const { announcement, priority: announcementPriority } = useAccessibilityAnnounce();
  // Note: useReducedMotion hook will be used in future for animation handling
  useReducedMotion();
  const themedColors = useThemedColors();
  const styles = useTravelDetailsStyles();

  // Web: avoid large layout shifts when switching from page skeleton → real content.
  // Keep skeleton mounted briefly and fade it out (no layout collapse).
  const [skeletonPhase, setSkeletonPhase] = useState<'loading' | 'fading' | 'hidden'>('loading')

  // ✅ АРХИТЕКТУРА: Использование кастомных хуков
  const travelDetails = useTravelDetails({
    isMobile,
    screenWidth,
    startTransition,
  })

  const { travel, isError, error, refetch, slug, isMissingParam } = travelDetails.data
  const { contentHorizontalPadding, sideMenuPlatformStyles } = travelDetails.layout
  const { anchors, scrollTo, scrollRef, activeSection, setActiveSection, forceOpenKey } =
    travelDetails.navigation
  const { lcpLoaded, setLcpLoaded, sliderReady, deferAllowed } = travelDetails.performance
  const { closeMenu, animatedX, menuWidthNum } = travelDetails.menu
  const { scrollY, contentHeight, viewportHeight, handleContentSizeChange, handleLayout } =
    travelDetails.scroll

  useEffect(() => {
    if (Platform.OS !== 'web') return
    if (!travel) {
      setSkeletonPhase('loading')
      return
    }

    // Let content paint first, then fade skeleton out, then unmount.
    setSkeletonPhase('fading')
    const t = setTimeout(() => setSkeletonPhase('hidden'), 220)
    return () => clearTimeout(t)
  }, [travel])

  const sectionLinks = useMemo(() => buildTravelSectionLinks(travel), [travel]);
  // Стабильный ключ для <Head> — используем slug (доступен сразу из URL),
  // чтобы Helmet instance НЕ пересоздавался при загрузке данных.
  // Это критично: если key меняется, react-helmet-async теряет meta-теги
  // при первичной загрузке страницы (race condition с requestAnimationFrame).
  const headKey = useMemo(
    () => `travel-${slug ?? travel?.id ?? "unknown"}`,
    [slug, travel?.id]
  );

  const {
    readyTitle,
    readyDesc,
    canonicalUrl,
    readyImage,
    firstImgOrigin,
    firstImg,
    jsonLd,
  } = useMemo(() => {
    const title = travel?.name ? `${travel.name} | MeTravel` : "MeTravel";
    const desc = stripToDescription(travel?.description);
    const canonical =
      typeof travel?.slug === "string" && travel.slug
        ? buildCanonicalUrl(`/travels/${travel.slug}`)
        : typeof travel?.id === "number"
          ? buildCanonicalUrl(`/travels/${travel.id}`)
          : slug
            ? buildCanonicalUrl(`/travels/${slug}`)
            : undefined;
    const rawFirst = travel?.gallery?.[0] || travel?.travel_image_thumb_url;
    const firstUrl = rawFirst
      ? typeof rawFirst === "string"
        ? rawFirst
        : rawFirst.url
      : undefined;
    const origin = firstUrl ? getOrigin(firstUrl) : null;

    const structuredData = createSafeJsonLd(travel);

    return {
      readyTitle: title,
      readyDesc: desc,
      canonicalUrl: canonical,
      readyImage: firstUrl,
      firstImgOrigin: origin,
      firstImg: firstUrl ? { url: firstUrl } : null,
      jsonLd: structuredData,
    };
  }, [travel, slug]);
  // ✅ FIX: Синхронизируем title экрана с navigation options,
  // чтобы useDocumentTitle из expo-router устанавливал правильный document.title
  // вместо пустой строки из HIDDEN = { title: '' }.
  // Также устанавливаем document.title напрямую через rAF, т.к. useDocumentTitle
  // из @react-navigation (родительский эффект) перезаписывает его пустой строкой
  // ПОСЛЕ нашего дочернего эффекта в том же цикле рендера.
  // rAF гарантирует, что наш document.title выставится после всех эффектов.
  useEffect(() => {
    if (readyTitle) {
      navigation.setOptions({ title: readyTitle });
      if (Platform.OS === 'web' && typeof document !== 'undefined') {
        const rafId = requestAnimationFrame(() => {
          document.title = readyTitle;
        });
        return () => cancelAnimationFrame(rafId);
      }
    }

    return undefined;
  }, [navigation, readyTitle]);

  const forceDeferMount = !!forceOpenKey;

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

  const scrollToMapSection = useCallback(() => {
    scrollToWithMenuClose('map');
  }, [scrollToWithMenuClose]);

  const handleFirstImageLoad = useCallback(() => {
    setLcpLoaded(true);
  }, [setLcpLoaded]);

  const scrollToComments = useCallback(() => {
    scrollToWithMenuClose('comments');
  }, [scrollToWithMenuClose]);

  // Memoize Animated.event handler to prevent ScrollView re-renders
  const scrollEventHandler = useMemo(
    () =>
      Animated.event(
        [{ nativeEvent: { contentOffset: { y: scrollY } } }],
        { useNativeDriver: false }
      ),
    [scrollY]
  );

  // Memoize inline styles to prevent new object allocations each render
  const wrapperStyle = useMemo(
    () => [
      styles.wrapper,
      { backgroundColor: themedColors.background },
      Platform.OS === 'web' &&
        ({
          backgroundImage: `linear-gradient(180deg, ${themedColors.background} 0%, ${themedColors.backgroundSecondary} 100%)`,
        } as any),
    ],
    [styles.wrapper, themedColors.background, themedColors.backgroundSecondary]
  );

  const sideMenuContainerStyle = useMemo(
    () => ({ width: menuWidthNum }),
    [menuWidthNum]
  );

  const sideMenuAnimatedStyle = useMemo(
    () => [
      styles.sideMenuBase,
      sideMenuPlatformStyles,
      {
        transform: [{ translateX: animatedX }],
        width: '100%' as any,
        zIndex: 1000,
        backgroundColor: themedColors.surface,
        borderRightColor: themedColors.border,
      },
    ],
    [styles.sideMenuBase, sideMenuPlatformStyles, animatedX, themedColors.surface, themedColors.border]
  );

  const scrollViewStyle = useMemo(
    () => [styles.scrollView, isMobile && { width: '100%' as any }],
    [styles.scrollView, isMobile]
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

  /* ---- user flags ---- */
  const { isSuperuser, userId } = useAuth();

  /* -------------------- SEO (must mount before early returns) -------------------- */
  // ⚠️ CRITICAL: InstantSEO must render from the FIRST render, not after async data loads.
  // react-helmet-async has a race condition on direct page loads: if a Helmet instance
  // mounts late (after requestAnimationFrame), meta tags are committed as empty.
  // Rendering it here with fallback values ensures the Helmet instance is stable.
  const seoBlock = isFocused ? (
    <InstantSEO
      headKey={headKey}
      title={readyTitle}
      description={readyDesc}
      canonical={canonicalUrl}
      image={readyImage}
      ogType="article"
      additionalTags={
        <>
          {firstImg?.url &&
            firstImgOrigin &&
            (Platform.OS !== 'web' ||
              typeof window === 'undefined' ||
              firstImgOrigin !== window.location.origin) && (
              <link rel="preconnect" href={firstImgOrigin} crossOrigin="anonymous" />
            )}
          <meta name="theme-color" content={themedColors.background} />
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
  ) : null;

  // NOTE: Skeleton gate is purely data-driven: show skeleton until `travel` is available.
  // Avoid delaying first paint with RAF, as it can increase CLS in perf audits.

  /* -------------------- READY -------------------- */

  // Пока данные путешествия не загружены — показываем простой лоадер,
  // но делаем это после инициализации всех хуков, чтобы не нарушать порядок.
  if (isMissingParam) {
    return (
      <>
        {seoBlock}
        <SafeAreaView style={styles.safeArea}>
          <View style={[styles.mainContainer, styles.mainContainerMobile]}>
            <Text style={styles.errorTitle}>
              Путешествие не найдено
            </Text>
            <Text style={styles.errorText}>
              В ссылке отсутствует идентификатор путешествия.
            </Text>
          </View>
        </SafeAreaView>
      </>
    );
  }

  if (isError) {
    return (
      <>
        {seoBlock}
        <SafeAreaView style={styles.safeArea}>
          <View style={[styles.mainContainer, styles.mainContainerMobile]}>
            <Text style={styles.errorTitle}>
              Не удалось загрузить путешествие
            </Text>
            <Text style={styles.errorText}>
              {error?.message || 'Попробуйте обновить страницу.'}
            </Text>
            <TouchableOpacity
              onPress={() => refetch()}
              style={styles.errorButton}
              accessibilityRole="button"
              accessibilityLabel="Повторить"
            >
              <Text style={styles.errorButtonText}>Повторить</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </>
    );
  }

  return (
    <>
      {seoBlock}

      {/* ✅ PHASE 2: Accessibility Components */}
      <Suspense fallback={null}>
        <SkipToContentLink targetId="travel-main-content" label="Skip to main content" />
      </Suspense>
      <Suspense fallback={null}>
        <AccessibilityAnnouncer message={announcement} priority={announcementPriority} id="travel-announcer" />
      </Suspense>

    <View
      testID="travel-details-page"
      id="travel-main-content"
      role="main"
      aria-label={`Travel details for ${travel?.name || 'travel'}`}
      style={wrapperStyle}
    >
      <SafeAreaView style={styles.safeArea}>
        <View style={[styles.mainContainer, isMobile && styles.mainContainerMobile]}>
          {/* Skeleton overlay inside stable layout (web only).
              Never unmount — use visibility/opacity to avoid CLS from DOM removal. */}
          {Platform.OS === 'web' && (
            <View
              pointerEvents="none"
              collapsable={false}
              style={{
                position: 'absolute',
                inset: 0,
                zIndex: skeletonPhase === 'hidden' ? -1 : 50,
                opacity: skeletonPhase === 'loading' ? 1 : 0,
                visibility: skeletonPhase === 'hidden' ? 'hidden' : 'visible',
                transition: 'opacity 200ms ease-out',
                contain: 'strict',
              } as any}
              aria-hidden={skeletonPhase !== 'loading'}
            >
              {skeletonPhase !== 'hidden' && <TravelDetailPageSkeleton />}
            </View>
          )}

          {/* If travel isn't ready yet, we still render the stable chrome underneath */}
          {/* (side menu/progress/scroll) but keep heavy sections gated */}

          {!isMobile && responsiveWidth >= METRICS.breakpoints.largeTablet && travel && (
            <View style={sideMenuContainerStyle}>
              <Defer when={deferAllowed}>
                <Animated.View
                  testID="travel-details-side-menu"
                  style={sideMenuAnimatedStyle}
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
            </View>
          )}

          {/* Прогресс-бар чтения */}
          {travel && contentHeight > viewportHeight && (
            <Suspense fallback={null}>
              <ReadingProgressBar
                scrollY={scrollY}
                contentHeight={contentHeight}
                viewportHeight={viewportHeight}
              />
            </Suspense>
          )}

          <ScrollView
            testID="travel-details-scroll"
            ref={scrollRef}
            contentContainerStyle={[styles.scrollContent]}
            keyboardShouldPersistTaps="handled"
            onScroll={scrollEventHandler}
            scrollEventThrottle={Platform.OS === 'web' ? 32 : 48}
            style={scrollViewStyle}
            nestedScrollEnabled
            onContentSizeChange={handleContentSizeChange}
            onLayout={handleLayout}
          >
            <View style={styles.contentOuter} collapsable={false}>
              <View
                style={[styles.contentWrapper, { paddingHorizontal: contentHorizontalPadding }]}
                collapsable={false}
              >
                {travel ? (
                  <SList revealOrder="forwards" tail="collapsed">
                    <View collapsable={false}>
                      <TravelHeroSection
                        travel={travel}
                        anchors={anchors}
                        isMobile={isMobile}
                        renderSlider={Platform.OS !== "web" ? true : sliderReady && lcpLoaded}
                        onFirstImageLoad={handleFirstImageLoad}
                        sectionLinks={sectionLinks}
                        onQuickJump={scrollToWithMenuClose}
                        deferExtras={!deferAllowed}
                      />
                    </View>

                    {responsiveWidth < METRICS.breakpoints.largeTablet && sectionLinks.length > 0 && (
                      <View style={styles.sectionTabsContainer}>
                        <Suspense fallback={null}>
                          <TravelSectionsSheet
                            links={sectionLinks}
                            activeSection={activeSection}
                            onNavigate={scrollToWithMenuClose}
                            testID="travel-sections-sheet-wrapper"
                          />
                        </Suspense>
                      </View>
                    )}

                    {/* -------- deferred heavy content -------- */}
                    <Defer when={deferAllowed || forceDeferMount || isWebAutomation}>
                      <Suspense fallback={<SectionSkeleton />}>
                        <TravelDeferredSections
                          travel={travel}
                          isMobile={isMobile}
                          forceOpenKey={forceOpenKey}
                          anchors={anchors}
                          scrollY={scrollY}
                          viewportHeight={viewportHeight}
                          scrollRef={scrollRef}
                          scrollToMapSection={scrollToMapSection}
                        />
                      </Suspense>
                    </Defer>
                  </SList>
                ) : (
                  // Underlay can be empty; skeleton overlay above provides the visual.
                  <View />
                )}
              </View>
            </View>
          </ScrollView>

          {/* ✅ Кнопка "Наверх" */}
          {travel && (
            <Suspense fallback={null}>
              <ScrollToTopButton scrollViewRef={scrollRef} scrollY={scrollY} threshold={300} />
            </Suspense>
          )}

          {/* 3.6: Sticky-bar действий на мобильном */}
          {isMobile && travel && (
            <Suspense fallback={null}>
              <TravelStickyActions
                travel={travel}
                scrollY={scrollY}
                scrollToComments={scrollToComments}
              />
            </Suspense>
          )}
         </View>
       </SafeAreaView>
     </View>
     </>
   );
}

// (no test-only exports)
