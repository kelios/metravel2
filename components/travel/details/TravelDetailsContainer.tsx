import React, { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import { Platform, useWindowDimensions } from 'react-native'
import { useIsFocused, useNavigation } from 'expo-router'
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
import { cacheTravelOffline } from '@/hooks/useOfflineTravelCache'

const SKELETON_FALLBACK = <TravelDetailsLoadingFallback />

function isWebAutomationRuntime() {
  return (
    Platform.OS === 'web' &&
    typeof navigator !== 'undefined' &&
    Boolean((navigator as { webdriver?: boolean }).webdriver)
  )
}

function useSkipToContentLinkVisibility() {
  const [isSkipLinkVisible, setSkipLinkVisible] = useState(Platform.OS !== 'web')

  useEffect(() => {
    if (Platform.OS !== 'web') return undefined

    const showOnForwardTab = (event: KeyboardEvent) => {
      if (event.key === 'Tab' && !event.shiftKey) setSkipLinkVisible(true)
    }

    window.addEventListener('keydown', showOnForwardTab, { passive: true, once: true })
    return () => window.removeEventListener('keydown', showOnForwardTab)
  }, [])

  return isSkipLinkVisible
}

function useNativeOfflineTravelCache(
  travel: Travel | undefined,
  isLoading: boolean,
  isError: boolean,
) {
  useEffect(() => {
    if (Platform.OS === 'web' || !travel?.id || isLoading || isError) return undefined

    let isCancelled = false

    if (!isCancelled) void cacheTravelOffline(travel.id, travel, true)

    return () => {
      isCancelled = true
    }
  }, [isError, isLoading, travel])
}

function useTravelSeoElement({
  backgroundColor,
  canonicalUrl,
  headKey,
  jsonLd,
  readyDesc,
  readyImage,
  readyTitle,
}: {
  backgroundColor: string
  canonicalUrl?: string
  headKey: string
  jsonLd?: Record<string, unknown> | null
  readyDesc: string
  readyImage: string
  readyTitle: string
}) {
  return useMemo(
    () => (
      <TravelDetailsSeoBlock
        backgroundColor={backgroundColor}
        canonicalUrl={canonicalUrl}
        headKey={headKey}
        jsonLd={jsonLd}
        readyDesc={readyDesc}
        readyImage={readyImage}
        readyTitle={readyTitle}
      />
    ),
    [backgroundColor, canonicalUrl, headKey, jsonLd, readyDesc, readyImage, readyTitle],
  )
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
  const showSkipToContentLink = useSkipToContentLinkVisibility()

  const details = useTravelDetails({ isMobile, screenWidth, startTransition })
  const { data, layout, menu, navigation: travelNavigation, performance, scroll } = details
  const { error, isError, isLoading, isMissingParam, refetch, slug, travel } = data
  const { contentHorizontalPadding, sideMenuPlatformStyles } = layout
  const { activeSection, anchors, forceOpenKey, scrollRef, scrollTo, setActiveSection } =
    travelNavigation
  const {
    deferAllowed,
    lcpLoaded,
    postLcpRuntimeReady,
    setLcpLoaded,
    sliderReady,
    heroEnhancersReady = postLcpRuntimeReady,
  } = performance
  const { animatedX, closeMenu, menuWidthNum } = menu
  const { contentHeight, handleContentSizeChange, handleLayout, scrollY, viewportHeight } =
    scroll

  useNativeOfflineTravelCache(travel, isLoading, isError)

  const isWebAutomation = isWebAutomationRuntime()
  const isFirstScreenReady = isTravelDetailsFirstScreenReady(travel, lcpLoaded)
  const skeletonPhase = useSkeletonPhase({
    isDataReady: Boolean(travel),
    isVisualReady: isFirstScreenReady || isWebAutomation,
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
    themedBackground: colors.background,
    themedBackgroundSecondary: colors.backgroundSecondary,
    themedBorderLight: colors.borderLight,
    themedBrandSoft: colors.brandSoft,
    themedPrimarySoft: colors.primarySoft,
    travel,
  })

  const { canonicalUrl, jsonLd, readyDesc, readyImage, readyTitle } = seo
  const seoElement = useTravelSeoElement({
    backgroundColor: colors.background,
    canonicalUrl,
    headKey,
    jsonLd,
    readyDesc,
    readyImage,
    readyTitle,
  })

  useTravelDetailsHeadSync({
    canonicalUrl,
    isFocused,
    readyDesc,
    readyImage,
    readyTitle,
    syncNavigationTitle,
  })

  const retryLoad = useCallback(() => {
    void refetch()
  }, [refetch])

  const goHome = useCallback(() => {
    router.replace('/')
  }, [router])

  const deferredRuntime = useMemo(() => {
    if (!travel) return null

    return (
      <TravelDetailsDeferredRuntimeSlot
        travel={travel}
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
        scrollViewRef={scrollRef as React.RefObject<any>}
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
    screenWidth,
    scrollRef,
    scrollToComments,
    scrollToMapSection,
    scrollToWithMenuClose,
    scrollY,
    sectionLinks,
    travel,
    viewportHeight,
  ])

  const mainAriaLabel = `Детали путешествия: ${travel?.name || 'путешествие'}`

  if (isMissingParam) {
    return <MissingParamError styles={styles} seoBlock={seoElement} onGoHome={goHome} />
  }

  if (isError) {
    return (
      <LoadError
        styles={styles}
        seoBlock={seoElement}
        errorMessage={error?.message}
        onRetry={retryLoad}
        onGoHome={goHome}
      />
    )
  }

  return (
    <>
      {seoElement}

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
        skeletonFallback={SKELETON_FALLBACK}
        scrollRef={scrollRef as React.RefObject<any>}
        scrollViewStyle={scrollViewStyle}
        scrollEventHandler={scrollEventHandler}
        handleContentSizeChange={handleContentSizeChange}
        handleLayout={handleLayout}
        contentHorizontalPadding={contentHorizontalPadding}
        anchors={anchors}
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
        deferredContent={deferredRuntime}
      />
    </>
  )
}
