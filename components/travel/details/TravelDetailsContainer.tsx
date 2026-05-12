import React, { useEffect, useMemo, useState, useTransition } from 'react'
import { Animated, Platform, useWindowDimensions } from 'react-native'
import { useIsFocused, useNavigation } from '@react-navigation/native'
import { useRouter } from 'expo-router'

import { METRICS } from '@/constants/layout'
import { useAccessibilityAnnounce } from '@/hooks/useAccessibilityAnnounce'
import { useSkeletonPhase } from '@/hooks/useSkeletonPhase'
import { useThemedColors } from '@/hooks/useTheme'
import { useTravelDetails } from '@/hooks/travel-details'
import { useTravelDetailsTrace } from '@/hooks/useTravelDetailsTrace'
import { getTravelDetailsShellStyles } from '@/components/travel/details/TravelDetailsShellStyles'
import { isTravelDetailsFirstScreenReady } from '@/components/travel/details/travelDetailsCriticalShellModel'
import TravelDetailsAccessibilityChrome from '@/components/travel/details/TravelDetailsAccessibilityChrome'
import TravelDetailsCriticalShell from '@/components/travel/details/TravelDetailsCriticalShell'
import TravelDetailsDeferredRuntimeSlot from '@/components/travel/details/TravelDetailsDeferredRuntimeSlot'
import { LoadError, MissingParamError } from '@/components/travel/details/TravelDetailsErrorStates'
import TravelDetailsLoadingFallback from '@/components/travel/details/TravelDetailsLoadingFallback'
import TravelDetailsSeoBlock from '@/components/travel/details/TravelDetailsSeoBlock'
import { useTravelDetailsContainerViewModel } from '@/components/travel/details/hooks/useTravelDetailsContainerViewModel'
import { useTravelDetailsHeadSync } from '@/components/travel/details/hooks/useTravelDetailsHeadSync'
import type { Travel } from '@/types/types'

function isWebAutomation() {
  return (
    Platform.OS === 'web' &&
    typeof navigator !== 'undefined' &&
    Boolean((navigator as { webdriver?: boolean }).webdriver)
  )
}

function useShowSkipToContentLink() {
  const [isVisible, setIsVisible] = useState(Platform.OS !== 'web')

  useEffect(() => {
    if (Platform.OS !== 'web') return undefined

    const revealOnFirstForwardTab = (event: KeyboardEvent) => {
      if (event.key === 'Tab' && !event.shiftKey) setIsVisible(true)
    }

    window.addEventListener('keydown', revealOnFirstForwardTab, { passive: true, once: true })
    return () => window.removeEventListener('keydown', revealOnFirstForwardTab)
  }, [])

  return isVisible
}

function useOfflineTravelCache(travel: Travel | undefined, isLoading: boolean, isError: boolean) {
  useEffect(() => {
    if (Platform.OS === 'web' || !travel?.id || isLoading || isError) return undefined

    let cancelled = false

    void import('@/hooks/useOfflineTravelCache')
      .then((module) => {
        if (!cancelled) return module.cacheTravelOffline(travel.id, travel, true)
        return undefined
      })
      .catch(() => undefined)

    return () => {
      cancelled = true
    }
  }, [travel, isLoading, isError])
}

type DeferredRuntimeArgs = {
  activeSection: string | null
  anchors: any
  contentHeight: number
  criticalChromeReady: boolean
  deferredChromeReady: boolean
  forceOpenKey: string | null
  isMobile: boolean
  onNavigate: (key: string) => void
  screenWidth: number
  scrollToComments: () => void
  scrollToMapSection: () => void
  scrollViewRef: React.RefObject<any>
  scrollY: Animated.Value
  sectionLinks: any[]
  travel: Travel | undefined
  viewportHeight: number
}

function useDeferredRuntimeContent({
  activeSection,
  anchors,
  contentHeight,
  criticalChromeReady,
  deferredChromeReady,
  forceOpenKey,
  isMobile,
  onNavigate,
  screenWidth,
  scrollToComments,
  scrollToMapSection,
  scrollViewRef,
  scrollY,
  sectionLinks,
  travel,
  viewportHeight,
}: DeferredRuntimeArgs) {
  return useMemo(() => {
    if (!travel) return null

    return (
      <TravelDetailsDeferredRuntimeSlot
        travel={travel}
        isMobile={isMobile}
        screenWidth={screenWidth}
        anchors={anchors}
        sectionLinks={sectionLinks}
        onNavigate={onNavigate}
        activeSection={activeSection}
        forceOpenKey={forceOpenKey}
        scrollY={scrollY}
        contentHeight={contentHeight}
        viewportHeight={viewportHeight}
        scrollViewRef={scrollViewRef}
        criticalChromeReady={criticalChromeReady}
        deferredChromeReady={deferredChromeReady}
        scrollToMapSection={scrollToMapSection}
        scrollToComments={scrollToComments}
      />
    )
  }, [
    activeSection,
    anchors,
    contentHeight,
    criticalChromeReady,
    deferredChromeReady,
    forceOpenKey,
    isMobile,
    onNavigate,
    screenWidth,
    scrollToComments,
    scrollToMapSection,
    scrollViewRef,
    scrollY,
    sectionLinks,
    travel,
    viewportHeight,
  ])
}

export default function TravelDetailsContainer() {
  const { width: screenWidth } = useWindowDimensions()
  const isMobile = screenWidth < METRICS.breakpoints.tablet
  const isFocused = useIsFocused()
  const navigation = useNavigation()
  const router = useRouter()
  const [, startTransition] = useTransition()

  const { announcement, priority: announcementPriority } = useAccessibilityAnnounce()
  const colors = useThemedColors()
  const styles = useMemo(() => getTravelDetailsShellStyles(colors), [colors])
  const showSkipToContentLink = useShowSkipToContentLink()

  const details = useTravelDetails({ isMobile, screenWidth, startTransition })
  const { error, isError, isLoading, isMissingParam, refetch, slug, travel } = details.data
  const { contentHorizontalPadding, sideMenuPlatformStyles } = details.layout
  const { activeSection, anchors, forceOpenKey, scrollRef, scrollTo, setActiveSection } =
    details.navigation
  const {
    deferAllowed,
    lcpLoaded,
    postLcpRuntimeReady,
    setLcpLoaded,
    sliderReady,
    heroEnhancersReady = postLcpRuntimeReady,
  } = details.performance
  const { animatedX, closeMenu, menuWidthNum } = details.menu
  const { contentHeight, handleContentSizeChange, handleLayout, scrollY, viewportHeight } =
    details.scroll

  useOfflineTravelCache(travel, isLoading, isError)

  const isFirstScreenReady = isTravelDetailsFirstScreenReady(travel, lcpLoaded)
  const skeletonPhase = useSkeletonPhase({
    isDataReady: Boolean(travel),
    isVisualReady: isFirstScreenReady,
  })

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
    seo,
    syncNavigationTitle,
    wrapperStyle,
  } = useTravelDetailsContainerViewModel({
    closeMenu,
    forceOpenKey,
    isMobile,
    isWebAutomation: isWebAutomation(),
    lcpLoaded,
    navigationSetOptions: navigation.setOptions,
    postLcpRuntimeReady,
    scrollTo,
    scrollY,
    setActiveSection,
    setLcpLoaded,
    slug,
    styles,
    themedBackground: colors.background,
    themedBackgroundSecondary: colors.backgroundSecondary,
    travel,
  })

  const { canonicalUrl, jsonLd, readyDesc, readyImage, readyTitle } = seo

  useTravelDetailsHeadSync({
    canonicalUrl,
    isFocused,
    readyDesc,
    readyImage,
    readyTitle,
    syncNavigationTitle,
  })

  const seoBlock = useMemo(
    () => (
      <TravelDetailsSeoBlock
        backgroundColor={colors.background}
        canonicalUrl={canonicalUrl}
        headKey={headKey}
        jsonLd={jsonLd}
        readyDesc={readyDesc}
        readyImage={readyImage}
        readyTitle={readyTitle}
      />
    ),
    [canonicalUrl, colors.background, headKey, jsonLd, readyDesc, readyImage, readyTitle],
  )

  const deferredRuntimeContent = useDeferredRuntimeContent({
    activeSection,
    anchors,
    contentHeight,
    criticalChromeReady,
    deferredChromeReady,
    forceOpenKey,
    isMobile,
    onNavigate: scrollToWithMenuClose,
    screenWidth,
    scrollToComments,
    scrollToMapSection,
    scrollViewRef: scrollRef as React.RefObject<any>,
    scrollY,
    sectionLinks,
    travel,
    viewportHeight,
  })

  const loadingFallback = useMemo(() => <TravelDetailsLoadingFallback />, [])
  const mainAriaLabel = useMemo(
    () => `Детали путешествия: ${travel?.name || 'путешествие'}`,
    [travel?.name],
  )

  if (isMissingParam) {
    return (
      <MissingParamError
        styles={styles}
        seoBlock={seoBlock}
        onGoHome={() => router.replace('/')}
      />
    )
  }

  if (isError) {
    return (
      <LoadError
        styles={styles}
        seoBlock={seoBlock}
        errorMessage={error?.message}
        onRetry={() => refetch()}
      />
    )
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
        skeletonFallback={loadingFallback}
        scrollRef={scrollRef as React.RefObject<any>}
        scrollViewStyle={scrollViewStyle}
        scrollEventHandler={scrollEventHandler}
        handleContentSizeChange={handleContentSizeChange}
        handleLayout={handleLayout}
        contentHorizontalPadding={contentHorizontalPadding}
        anchors={anchors}
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
        mainAriaLabel={mainAriaLabel}
        deferredContent={deferredRuntimeContent}
      />
    </>
  )
}
