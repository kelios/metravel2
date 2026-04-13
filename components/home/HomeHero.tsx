import { useMemo, memo, useCallback, useState, useEffect, useRef } from 'react'
import {
  View,
  Platform,
  Dimensions,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useResponsive } from '@/hooks/useResponsive'
import { useThemedColors } from '@/hooks/useTheme'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { ResponsiveContainer } from '@/components/layout'
import { queueAnalyticsEvent } from '@/utils/analytics'
import { openExternalUrl, openExternalUrlInNewTab } from '@/utils/externalLinks'
import { createHomeHeroStyles } from './homeHeroStyles'
import HomeHeroBookLayout from './HomeHeroBookLayout'
import HomeHeroMoodRail from './HomeHeroMoodRail'
import HomeHeroPopularSection from './HomeHeroPopularSection'
import {
  BOOK_IMAGES,
  buildFilterPath,
  HERO_HIGHLIGHTS,
  HOME_HERO_BOOK_LAYOUT_MIN_WIDTH,
  MOOD_CARDS,
} from './homeHeroContent'
import {
  shouldDisableHomeHeroSliderBlur,
  useHomeHeroSlider,
} from './useHomeHeroSlider'
import type { QuickFilterParams } from './homeHeroShared'

interface HomeHeroProps {
  travelsCount?: number
  /** HERO-06: legacy prop, retained for compatibility */
  travelsCountLoading?: boolean
}

export { BOOK_IMAGES as BOOK_IMAGES_FOR_TEST, MOOD_CARDS as MOOD_CARDS_FOR_TEST } from './homeHeroContent'
export {
  buildHomeHeroSlidePreloadUrl,
  shouldDisableHomeHeroSliderBlur,
} from './useHomeHeroSlider'

const HomeHero = memo(function HomeHero({
  travelsCount: _travelsCount = 0,
  travelsCountLoading: _travelsCountLoading = false,
}: HomeHeroProps) {
  const router = useRouter()
  const colors = useThemedColors()
  const {
    isSmallPhone,
    isPhone,
    isLargePhone,
    isTablet,
    isDesktop,
    width: rawWidth,
    isPortrait,
  } = useResponsive()

  // Stabilize width to prevent re-renders on minor viewport changes (e.g., mobile address bar)
  const stableWidthRef = useRef(rawWidth)
  const width = useMemo(() => {
    // Only update if change is significant (>50px) to avoid scroll-triggered re-renders
    if (Math.abs(rawWidth - stableWidthRef.current) > 50) {
      stableWidthRef.current = rawWidth
    }
    return stableWidthRef.current
  }, [rawWidth])

  const isMobile = isSmallPhone || isPhone || isLargePhone
  const isLandscape = !isPortrait && isMobile // RESP-05
  const isWeb = Platform.OS === 'web'
  const disableHeroSliderBlur = useMemo(() => {
    if (Platform.OS !== 'web' || typeof navigator === 'undefined') return false
    const maxTouchPoints =
      typeof navigator.maxTouchPoints === 'number'
        ? navigator.maxTouchPoints
        : 0
    return shouldDisableHomeHeroSliderBlur(
      String(navigator.userAgent || ''),
      maxTouchPoints,
    )
  }, [])
  const isNarrowLayout =
    isMobile || (isWeb && width < HOME_HERO_BOOK_LAYOUT_MIN_WIDTH)
  const showSideSlider =
    isWeb && width >= HOME_HERO_BOOK_LAYOUT_MIN_WIDTH && isDesktop
  // Tablet layout: 770-1279px — side-by-side hero with featured image
  const isTabletLayout = isWeb && width >= 770 && width < HOME_HERO_BOOK_LAYOUT_MIN_WIDTH && !isMobile
  const sliderIconColor = colors.textOnDark ?? DESIGN_TOKENS.colors.textOnDark
  const sliderHeight = isDesktop ? (width < 1480 ? 360 : 420) : 360
  const sliderMediaWidth = isDesktop ? (width < 1480 ? 480 : 500) : 380
  const featuredCardWidth = useMemo(() => {
    if (!isWeb) return undefined
    const horizontalPadding = isMobile ? 32 : 48
    return Math.max(280, Math.min(width - horizontalPadding, 800))
  }, [isMobile, isWeb, width])
  const useMobileGridForPopular = isMobile && width <= 430
  const popularCardWidth = useMemo(() => {
    if (!isMobile) return 215
    if (useMobileGridForPopular) {
      const available = Math.max(width - 48, 300)
      return Math.max(148, Math.floor((available - 12) / 2))
    }
    return 195
  }, [isMobile, useMobileGridForPopular, width])
  const popularCardHeight = useMemo(() => {
    if (useMobileGridForPopular) {
      return Math.max(112, Math.round(popularCardWidth * 0.68))
    }
    return isMobile ? 130 : 148
  }, [isMobile, popularCardWidth, useMobileGridForPopular])
  const featuredCardHeight = useMemo(() => {
    if (isMobile) return 220
    if (isTablet) return 280
    return 300
  }, [isMobile, isTablet])

  // Book wrapper measured height for adaptive aspect-ratio
  // Use ref to track and stabilize to prevent layout thrashing
  const bookWrapperWidthRef = useRef(0)
  const [bookWrapperWidth, setBookWrapperWidth] = useState(0)
  const handleBookWrapperLayout = useCallback(
    (e: { nativeEvent: { layout: { width: number } } }) => {
      const newWidth = e.nativeEvent.layout.width
      // Only update if change is significant (>20px)
      if (Math.abs(newWidth - bookWrapperWidthRef.current) > 20) {
        bookWrapperWidthRef.current = newWidth
        setBookWrapperWidth(newWidth)
      }
    },
    [],
  )
  const bookHeight = useMemo(() => {
    if (bookWrapperWidth <= 0) return 0
    const aspectH = Math.round((bookWrapperWidth * 765) / 1040)
    const vh =
      Platform.OS === 'web'
        ? typeof window !== 'undefined'
          ? window.innerHeight
          : Dimensions.get('window').height
        : Dimensions.get('window').height
    return Math.min(aspectH, vh - 130)
  }, [bookWrapperWidth])
  const isCompactBookLayout =
    showSideSlider && bookHeight > 0 && bookHeight <= 760
  const useInlineBookmarkRail =
    showSideSlider && !isNarrowLayout && !isCompactBookLayout && width >= 1280
  const useStackedCtas =
    isMobile || isCompactBookLayout || (showSideSlider && width < 1180)
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return

    const mediaQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    const syncReducedMotion = () =>
      setPrefersReducedMotion(Boolean(mediaQuery?.matches))

    syncReducedMotion()
    mediaQuery?.addEventListener?.('change', syncReducedMotion)

    return () => {
      mediaQuery?.removeEventListener?.('change', syncReducedMotion)
    }
  }, [])

  const {
    currentSlide,
    handleNextSlide,
    handlePrevSlide,
    loadedSlides,
    markSlideAsLoaded,
    renderedSlideIndices,
    topWaveAnimatedStyle,
    bottomWaveAnimatedStyle,
    visibleSlide,
  } = useHomeHeroSlider({
    slides: BOOK_IMAGES,
    showSideSlider,
    sliderMediaWidth,
    sliderHeight,
    prefersReducedMotion,
    getSlideSource: (slide) => slide.source,
  })

  const handleOpenSearch = useCallback(() => {
    queueAnalyticsEvent('HomeClick_OpenSearch')
    router.push('/search' as any)
  }, [router])

  const handleQuickFilterPress = useCallback(
    (label: string, filters?: QuickFilterParams, route: string = '/search') => {
      queueAnalyticsEvent('HomeClick_QuickFilter', {
        label,
        source: 'home-hero',
      })
      const path = buildFilterPath(route, filters)
      router.push(path as any)
    },
    [router],
  )

  const handleOpenArticles = useCallback(
    (href?: string | null) => {
      if (href) {
        queueAnalyticsEvent('HomeClick_BookCover', { href })
        if (Platform.OS === 'web') {
          openExternalUrlInNewTab(href)
        } else {
          openExternalUrl(href)
        }
      } else {
        queueAnalyticsEvent('HomeClick_OpenSearch')
        router.push('/search' as any)
      }
    },
    [router],
  )

  const styles = useMemo(
    () =>
      createHomeHeroStyles({
        colors,
        isMobile,
        isSmallPhone,
        isNarrowLayout,
        isTablet,
        isDesktop,
        viewportWidth: width,
        showSideSlider,
        sliderHeight,
        isLandscape,
        bookHeight,
        stackHeroButtons: useStackedCtas,
        isTabletLayout,
      }),
    [
      colors,
      isMobile,
      isSmallPhone,
      isNarrowLayout,
      isTablet,
      isDesktop,
      width,
      showSideSlider,
      sliderHeight,
      isLandscape,
      bookHeight,
      useStackedCtas,
      isTabletLayout,
    ],
  )

  const heroSubtitle = isMobile
    ? 'Готовые маршруты с фото и GPS-треками.'
    : showSideSlider && bookHeight > 0 && bookHeight < 760
      ? 'Готовые маршруты, заметки и GPS-треки.'
      : 'Готовые маршруты, заметки и личная книга путешествий.'

  return (
    <View testID="home-hero" style={styles.container}>
      <ResponsiveContainer maxWidth={1920} padding>
        <View style={styles.heroShell}>
          <HomeHeroBookLayout
            colors={colors}
            styles={styles}
            isWeb={isWeb}
            isNarrowLayout={isNarrowLayout}
            isTabletLayout={isTabletLayout}
            showSideSlider={showSideSlider}
            useInlineBookmarkRail={useInlineBookmarkRail}
            width={width}
            sliderHeight={sliderHeight}
            sliderMediaWidth={sliderMediaWidth}
            sliderIconColor={sliderIconColor}
            disableHeroSliderBlur={disableHeroSliderBlur}
            heroSubtitle={heroSubtitle}
            moodCards={MOOD_CARDS}
            heroHighlights={HERO_HIGHLIGHTS}
            bookImages={BOOK_IMAGES}
            currentSlide={currentSlide}
            renderedSlideIndices={renderedSlideIndices}
            visibleSlide={visibleSlide}
            loadedSlides={loadedSlides}
            useStackedCtas={useStackedCtas}
            topWaveAnimatedStyle={topWaveAnimatedStyle}
            bottomWaveAnimatedStyle={bottomWaveAnimatedStyle}
            onBookWrapperLayout={handleBookWrapperLayout}
            onQuickFilterPress={handleQuickFilterPress}
            onOpenArticle={handleOpenArticles}
            onOpenSearch={handleOpenSearch}
            onPrevSlide={handlePrevSlide}
            onNextSlide={handleNextSlide}
            onMarkSlideLoaded={markSlideAsLoaded}
          />
          {!useInlineBookmarkRail ? (
            <HomeHeroMoodRail
              colors={colors}
              styles={styles}
              isMobile={isMobile}
              isWeb={isWeb}
              moodCards={MOOD_CARDS}
              onQuickFilterPress={handleQuickFilterPress}
            />
          ) : null}
        </View>

        {/* Popular Routes Section - only on mobile (not tablet) */}
        {!showSideSlider && !isTabletLayout && (
          <HomeHeroPopularSection
            colors={colors}
            styles={styles}
            isWeb={isWeb}
            useMobileGrid={useMobileGridForPopular}
            featuredCardWidth={featuredCardWidth}
            featuredCardHeight={featuredCardHeight}
            popularCardWidth={popularCardWidth}
            popularCardHeight={popularCardHeight}
            bookImages={BOOK_IMAGES}
            onOpenArticle={handleOpenArticles}
          />
        )}
      </ResponsiveContainer>
    </View>
  )
})

export default HomeHero
