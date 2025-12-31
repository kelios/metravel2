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
import { MaterialIcons } from "@expo/vector-icons";
import { useIsFocused } from "@react-navigation/native";
import { useAuth } from '@/context/AuthContext';
import { METRICS } from '@/constants/layout';
import { useResponsive } from '@/hooks/useResponsive';
import FloatingActionButton from '@/components/ui/FloatingActionButton';

import type { Travel } from "@/src/types/types";
/* ✅ АРХИТЕКТУРА: Импорт кастомных хуков */
import { useTravelDetailsData } from "@/hooks/useTravelDetailsData";
import { useTravelDetailsLayout } from "@/hooks/useTravelDetailsLayout";
import { useTravelDetailsMenu } from "@/hooks/useTravelDetailsMenu";
import { useTravelDetailsNavigation } from "@/hooks/useTravelDetailsNavigation";
import { useTravelDetailsPerformance } from "@/hooks/useTravelDetailsPerformance";
import { useTravelDetailsScrollState } from "@/hooks/useTravelDetailsScrollState";
import InstantSEO from "@/components/seo/InstantSEO";
import { createSafeJsonLd, stripHtml, createSafeImageUrl, getSafeOrigin } from "@/utils/travelDetailsSecure";
import ScrollToTopButton from "@/components/ScrollToTopButton";
import ReadingProgressBar from "@/components/ReadingProgressBar";
import TravelSectionsSheet from "@/components/travel/TravelSectionsSheet";
import { buildTravelSectionLinks } from "@/components/travel/sectionLinks";
import { ProgressiveWrapper } from '@/hooks/useProgressiveLoading';
import { optimizeImageUrl, getPreferredImageFormat } from "@/utils/imageOptimization";
import { SectionSkeleton } from '@/components/SectionSkeleton';

import { DESIGN_TOKENS } from '@/constants/designSystem';
import {
  TravelDeferredSections as TravelDeferredSectionsComponent,
  TravelHeroSection,
  useLCPPreload,
  OptimizedLCPHero,
} from "@/components/travel/details/TravelDetailsSections";
import { styles } from "@/components/travel/details/TravelDetailsStyles";
import { withLazy } from "@/components/travel/details/TravelDetailsLazy";

/* ✅ PHASE 2: Accessibility (WCAG AAA) */
import SkipToContentLink from "@/components/accessibility/SkipToContentLink";
import AccessibilityAnnouncer from "@/components/accessibility/AccessibilityAnnouncer";
import { useAccessibilityAnnounce, useReducedMotion } from "@/hooks/useKeyboardNavigation";
import { useThemedColors } from "@/hooks/useTheme";

/* -------------------- helpers -------------------- */

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
  const themedColors = useThemedColors();

  // ✅ УЛУЧШЕНИЕ: Состояние для похожих путешествий (для навигации)
  const [relatedTravels, setRelatedTravels] = useState<Travel[]>([]);
  
  // ✅ АРХИТЕКТУРА: Использование кастомных хуков
  const { travel, isLoading, isError, error, refetch, slug, isMissingParam } = useTravelDetailsData();
  const { headerOffset, contentHorizontalPadding, sideMenuPlatformStyles } = useTravelDetailsLayout({
    isMobile,
    screenWidth,
  });
  const { anchors, scrollTo, scrollRef, activeSection, setActiveSection, forceOpenKey } =
    useTravelDetailsNavigation({
      headerOffset,
      slug,
      startTransition,
    });
  const { setLcpLoaded, sliderReady, deferAllowed } = useTravelDetailsPerformance({
    travel,
    isMobile,
    isLoading,
  });
  const { closeMenu, toggleMenu, isMenuOpen, animatedX, menuWidth, menuWidthNum } = useTravelDetailsMenu(isMobile, deferAllowed);
  const {
    scrollY,
    contentHeight,
    viewportHeight,
    setHeroBlockHeight,
    handleContentSizeChange,
    handleLayout,
  } = useTravelDetailsScrollState({ isMobile });
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
            <Text style={{ color: DESIGN_TOKENS.colors.textInverse, fontWeight: '700' }}>Повторить</Text>
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
      )}

    <View
      testID="travel-details-page"
      id="travel-main-content"
      role="main"
      aria-label={`Travel details for ${travel?.name || 'travel'}`}
      style={[
        styles.wrapper,
        { backgroundColor: themedColors.background },
        Platform.OS === "web" &&
          ({
            // @ts-ignore - web-specific CSS property
            backgroundImage: `linear-gradient(180deg, ${DESIGN_TOKENS.colors.background} 0%, ${DESIGN_TOKENS.colors.backgroundSecondary} 100%)`,
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
                    backgroundColor: themedColors.surface,
                    borderRightColor: themedColors.border,
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

          {/* ✅ НОВОЕ: FAB кнопка для открытия меню на мобильном */}
          {isMobile && !isMenuOpen && (
            <FloatingActionButton
              label="Меню"
              icon="☰"
              onPress={toggleMenu}
              position="bottom-left"
              accessibilityLabel="Открыть навигационное меню"
              testID="mobile-menu-fab"
              style={{
                bottom: 80,
                left: 16,
                zIndex: 999,
              }}
            />
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
                    lcpPreloadHref={lcpPreloadImage}
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
