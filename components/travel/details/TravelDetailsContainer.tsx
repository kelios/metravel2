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
  ActivityIndicator,
  Animated,
  Platform,
  SafeAreaView,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { useIsFocused } from "@react-navigation/native";
import { useAuth } from '@/context/AuthContext';
import { METRICS } from '@/constants/layout';
import { useResponsive } from '@/hooks/useResponsive';

/* ✅ АРХИТЕКТУРА: Импорт кастомных хуков */
import { useTravelDetails } from "@/hooks/travel-details";
import InstantSEO from "@/components/seo/LazyInstantSEO";
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
      setReady(true);
      return;
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
  const { closeMenu, animatedX, menuWidth: _menuWidth, menuWidthNum } = travelDetails.menu
  const { scrollY, contentHeight, viewportHeight, handleContentSizeChange, handleLayout } =
    travelDetails.scroll
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
        ? `https://metravel.by/travels/${travel.slug}`
        : typeof travel?.id === "number" || typeof travel?.id === "string"
          ? `https://metravel.by/travels/${travel.id}`
          : typeof slug === "string" && slug
            ? `https://metravel.by/travels/${slug}`
            : undefined;
    const rawFirst = travel?.travel_image_thumb_url || travel?.gallery?.[0];
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
          {firstImg?.url && firstImgOrigin && (
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

  if (!travel) {
    return (
      <>
        {seoBlock}
        {Platform.OS === 'web' ? (
          <TravelDetailPageSkeleton />
        ) : (
          <SafeAreaView style={styles.safeArea}>
            <View style={[styles.mainContainer, styles.mainContainerMobile]}>
              <ActivityIndicator size="large" color={themedColors.primary} />
            </View>
          </SafeAreaView>
        )}
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
          {!isMobile && responsiveWidth >= METRICS.breakpoints.largeTablet && (
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
          {contentHeight > viewportHeight && (
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
            contentContainerStyle={[
              styles.scrollContent,
            ]}
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
                style={[
                  styles.contentWrapper,
                  { paddingHorizontal: contentHorizontalPadding },
                ]}
                collapsable={false}
              >
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
              </View>
            </View>
          </ScrollView>
          {/* ✅ Кнопка "Наверх" */}
          <Suspense fallback={null}>
            <ScrollToTopButton
              scrollViewRef={scrollRef}
              scrollY={scrollY}
              threshold={300}
            />
          </Suspense>
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

export const __testables = {
  TravelHeroSection,
};
