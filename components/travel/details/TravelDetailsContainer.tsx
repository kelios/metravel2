// app/travels/[param].tsx
import React, {
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import {
  Platform,
  useWindowDimensions,
  View,
} from "react-native";
import { useIsFocused, useNavigation } from "@react-navigation/native";
import { useRouter } from 'expo-router';
import { METRICS } from '@/constants/layout';
import { useTravelDetails } from '@/hooks/travel-details';

/* ✅ АРХИТЕКТУРА: Импорт кастомных хуков */
import TravelDetailsCriticalShell from "@/components/travel/details/TravelDetailsCriticalShell";
import { getTravelDetailsShellStyles } from "@/components/travel/details/TravelDetailsShellStyles";
import { withLazy } from "@/components/travel/details/TravelDetailsLazy";
import { MissingParamError, LoadError } from '@/components/travel/details/TravelDetailsErrorStates'
import TravelDetailsSeoBlock from '@/components/travel/details/TravelDetailsSeoBlock'
import TravelDetailsAccessibilityChrome from '@/components/travel/details/TravelDetailsAccessibilityChrome'
import TravelDetailsDeferredRuntimeSlot from '@/components/travel/details/TravelDetailsDeferredRuntimeSlot'

/* ✅ PHASE 2: Accessibility (WCAG AAA) */
import { useAccessibilityAnnounce } from "@/hooks/useAccessibilityAnnounce";
import { useThemedColors } from "@/hooks/useTheme";
import { useTravelDetailsTrace } from '@/hooks/useTravelDetailsTrace';
import { useSkeletonPhase } from '@/hooks/useSkeletonPhase';
import { useTravelDetailsContainerViewModel } from '@/components/travel/details/hooks/useTravelDetailsContainerViewModel';
import { useTravelDetailsHeadSync } from '@/components/travel/details/hooks/useTravelDetailsHeadSync';
const TravelDetailPageSkeleton = withLazy(() =>
  import('@/components/travel/TravelDetailPageSkeleton').then((m) => ({
    default: m.TravelDetailPageSkeleton,
  }))
);
const SKELETON_OVERLAY_FALLBACK_STYLE = { flex: 1 } as const

/* =================================================================== */

export default function TravelDetailsContainer() {
  const { width: screenWidth } = useWindowDimensions();
  const isMobile = screenWidth < METRICS.breakpoints.tablet;
  const navigation = useNavigation();
  const isFocused = useIsFocused();
  const router = useRouter();
  const [, startTransition] = useTransition();

  const isWebAutomation =
    Platform.OS === 'web' &&
    typeof navigator !== 'undefined' &&
    Boolean((navigator as any).webdriver);

  /* ✅ PHASE 2: Accessibility Hooks */
  const { announcement, priority: announcementPriority } = useAccessibilityAnnounce();
  const themedColors = useThemedColors();
  const styles = useMemo(() => getTravelDetailsShellStyles(themedColors), [themedColors]);
  const [showSkipToContentLink, setShowSkipToContentLink] = useState(Platform.OS !== 'web');

  // ✅ REFACTORED: Skeleton phase extracted to useSkeletonPhase hook

  // ✅ АРХИТЕКТУРА: Использование кастомных хуков
  const travelDetails = useTravelDetails({
    isMobile,
    screenWidth,
    startTransition,
  })

  const { travel, isLoading, isError, error, refetch, slug, isMissingParam } = travelDetails.data
  const { contentHorizontalPadding, sideMenuPlatformStyles } = travelDetails.layout
  const { anchors, scrollTo, scrollRef, activeSection, setActiveSection, forceOpenKey } =
    travelDetails.navigation
  const {
    lcpLoaded,
    setLcpLoaded,
    sliderReady,
    deferAllowed,
    postLcpRuntimeReady,
    heroEnhancersReady = postLcpRuntimeReady,
  } =
    travelDetails.performance
  const { closeMenu, animatedX, menuWidthNum } = travelDetails.menu
  const { scrollY, contentHeight, viewportHeight, handleContentSizeChange, handleLayout } =
    travelDetails.scroll

  useEffect(() => {
    if (Platform.OS === 'web') return;
    if (!travel || !travel.id || isLoading || isError) return;

    let cancelled = false;

    void import('@/hooks/useOfflineTravelCache')
      .then((mod) => {
        if (cancelled) return;
        return mod.cacheTravelOffline(travel.id, travel, true);
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [travel, isLoading, isError]);

  const skeletonPhase = useSkeletonPhase({ isDataReady: Boolean(travel) });

  // ✅ REFACTORED: Trace logic extracted to useTravelDetailsTrace hook
  useTravelDetailsTrace({
    travel,
    isLoading,
    isError,
    isMissingParam,
    slug,
    skeletonPhase,
    lcpLoaded,
    sliderReady,
    deferAllowed,
    postLcpRuntimeReady,
  })

  useEffect(() => {
    if (Platform.OS !== 'web') return undefined;

    const revealSkipLink = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || event.shiftKey) return;
      setShowSkipToContentLink(true);
    };

    window.addEventListener('keydown', revealSkipLink, { passive: true, once: true });
    return () => {
      window.removeEventListener('keydown', revealSkipLink);
    };
  }, []);

  const {
    criticalChromeReady,
    deferredChromeReady,
    handleFirstImageLoad,
    headKey,
    scrollEventHandler,
    scrollToComments,
    scrollToMapSection,
    scrollToWithMenuClose,
    scrollViewStyle,
    sectionLinks,
    seo: { readyTitle, readyDesc, canonicalUrl, readyImage, jsonLd },
    syncNavigationTitle,
    wrapperStyle,
  } = useTravelDetailsContainerViewModel({
    closeMenu,
    forceOpenKey,
    isMobile,
    isWebAutomation,
    lcpLoaded,
    navigationSetOptions: navigation.setOptions,
    postLcpRuntimeReady,
    scrollTo,
    scrollY,
    setActiveSection,
    setLcpLoaded,
    slug,
    styles,
    themedBackground: themedColors.background,
    themedBackgroundSecondary: themedColors.backgroundSecondary,
    travel,
  })
  useTravelDetailsHeadSync({
    canonicalUrl,
    isFocused,
    readyDesc,
    readyImage,
    readyTitle,
    syncNavigationTitle,
  })

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

  const seoBlock = (
    <TravelDetailsSeoBlock
      backgroundColor={themedColors.background}
      canonicalUrl={canonicalUrl}
      headKey={headKey}
      jsonLd={jsonLd}
      readyDesc={readyDesc}
      readyImage={readyImage}
      readyTitle={readyTitle}
    />
  );

  // NOTE: Skeleton gate is purely data-driven: show skeleton until `travel` is available.
  // Avoid delaying first paint with RAF, as it can increase CLS in perf audits.

  /* -------------------- READY -------------------- */

  // Пока данные путешествия не загружены — показываем простой лоадер,
  // но делаем это после инициализации всех хуков, чтобы не нарушать порядок.
  // ✅ REFACTORED: Error states extracted to TravelDetailsErrorStates
  if (isMissingParam) {
    return (
      <MissingParamError
        styles={styles}
        seoBlock={seoBlock}
        onGoHome={() => router.replace('/')}
      />
    );
  }

  if (isError) {
    return (
      <LoadError
        styles={styles}
        seoBlock={seoBlock}
        errorMessage={error?.message}
        onRetry={() => refetch()}
      />
    );
  }

  return (
    <>
      {seoBlock}

      <TravelDetailsAccessibilityChrome
        announcement={announcement}
        announcementPriority={announcementPriority}
        showSkipToContentLink={showSkipToContentLink}
      />

      <TravelDetailsCriticalShell
        travel={travel}
        isMobile={isMobile}
        screenWidth={screenWidth}
        wrapperStyle={wrapperStyle}
        styles={styles}
        skeletonPhase={skeletonPhase}
        skeletonFallback={<View style={SKELETON_OVERLAY_FALLBACK_STYLE} />}
        travelDetailSkeleton={<TravelDetailPageSkeleton />}
        scrollRef={scrollRef as any}
        scrollViewStyle={scrollViewStyle}
        scrollEventHandler={scrollEventHandler}
        handleContentSizeChange={handleContentSizeChange}
        handleLayout={handleLayout}
        contentHorizontalPadding={contentHorizontalPadding}
        anchors={anchors}
        sliderReady={sliderReady}
        lcpLoaded={lcpLoaded}
        onFirstImageLoad={handleFirstImageLoad}
        sectionLinks={sectionLinks}
        onQuickJump={scrollToWithMenuClose}
        deferHeroExtras={!heroEnhancersReady}
        forceOpenKey={forceOpenKey}
        activeSection={activeSection}
        closeMenu={closeMenu}
        onNavigate={scrollToWithMenuClose}
        menuWidthNum={menuWidthNum}
        animatedX={animatedX}
        sideMenuPlatformStyles={sideMenuPlatformStyles}
        mainAriaLabel={`Детали путешествия: ${travel?.name || 'путешествие'}`}
        deferredContent={
          <TravelDetailsDeferredRuntimeSlot
            travel={travel!}
            isMobile={isMobile}
            screenWidth={screenWidth}
            anchors={anchors}
            sectionLinks={sectionLinks}
            onNavigate={scrollToWithMenuClose}
            activeSection={activeSection}
            forceOpenKey={forceOpenKey}
            scrollY={scrollY}
            contentHeight={contentHeight}
            viewportHeight={viewportHeight}
            scrollViewRef={scrollRef as any}
            criticalChromeReady={criticalChromeReady}
            deferredChromeReady={deferredChromeReady}
            scrollToMapSection={scrollToMapSection}
            scrollToComments={scrollToComments}
          />
        }
      />
     </>
   );
}

// (no test-only exports)
