import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Dimensions, Platform, View } from 'react-native'
import { useRouter } from 'expo-router'

import { useThemedColors } from '@/hooks/useTheme'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { ResponsiveContainer } from '@/components/layout'
import { queueAnalyticsEvent } from '@/utils/analytics'
import { openExternalUrl, openExternalUrlInNewTab } from '@/utils/externalLinks'
import { createHomeHeroStyles } from './homeHeroStyles'
import { useHomeViewport } from './useHomeViewport'
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

const IS_WEB = Platform.OS === 'web'
const DESKTOP_BOOK_VIEWPORT_RESERVE = 180
const WIDTH_STABILIZE_THRESHOLD = 50
const BOOK_WIDTH_STABILIZE_THRESHOLD = 20
const TABLET_LAYOUT_MIN_WIDTH = 770
const INLINE_BOOKMARK_MIN_WIDTH = 1280
const STACKED_CTA_MAX_WIDTH = 1180
const HOME_HERO_DESKTOP_CONTAINER_HORIZONTAL_PADDING = 80
const COMPACT_BOOK_MAX_HEIGHT = 760
const SLIDER_HEIGHT_NARROW = 360
const SLIDER_HEIGHT_WIDE = 420
const SLIDER_MEDIA_WIDTH_NARROW = 480
const SLIDER_MEDIA_WIDTH_WIDE = 500
const SLIDER_DESKTOP_BREAKPOINT = 1480
const NAV_FEEDBACK_MS = 700

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

function getWebViewportHeight() {
  if (Platform.OS === 'web' && typeof window !== 'undefined') return window.innerHeight
  return Dimensions.get('window').height
}

function detectDisableHeroSliderBlur() {
  if (!IS_WEB || typeof navigator === 'undefined') return false
  const touch = typeof navigator.maxTouchPoints === 'number' ? navigator.maxTouchPoints : 0
  return shouldDisableHomeHeroSliderBlur(String(navigator.userAgent || ''), touch)
}

function getEstimatedBookWrapperWidth(viewportWidth: number) {
  if (viewportWidth <= 0) return 0

  const maxBookWidth =
    viewportWidth >= 2560 ? 1520 : viewportWidth >= 1920 ? 1360 : 1200

  return Math.max(
    0,
    Math.min(viewportWidth - HOME_HERO_DESKTOP_CONTAINER_HORIZONTAL_PADDING, maxBookWidth),
  )
}

const getBookSlideSource = (slide: (typeof BOOK_IMAGES)[number]) => slide.source

const HomeHero = memo(function HomeHero({
  travelsCount = 0,
  travelsCountLoading = false,
}: HomeHeroProps) {
  // Props are retained for the parent's contract; not consumed in this layout.
  void travelsCount
  void travelsCountLoading

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
  } = useHomeViewport()

  // Stabilize width — ignore <50px jitters (e.g. mobile address bar collapse).
  const stableWidthRef = useRef(rawWidth)
  if (Math.abs(rawWidth - stableWidthRef.current) > WIDTH_STABILIZE_THRESHOLD) {
    stableWidthRef.current = rawWidth
  }
  const width = stableWidthRef.current

  const isMobile = isSmallPhone || isPhone || isLargePhone
  const isLandscape = !isPortrait && isMobile
  const disableHeroSliderBlur = useMemo(detectDisableHeroSliderBlur, [])

  const isNarrowLayout = isMobile || (IS_WEB && width < HOME_HERO_BOOK_LAYOUT_MIN_WIDTH)
  const showSideSlider = IS_WEB && width >= HOME_HERO_BOOK_LAYOUT_MIN_WIDTH && isDesktop
  const isTabletLayout =
    IS_WEB && width >= TABLET_LAYOUT_MIN_WIDTH && width < HOME_HERO_BOOK_LAYOUT_MIN_WIDTH && !isMobile

  const sliderIconColor = colors.textOnDark ?? DESIGN_TOKENS.colors.textOnDark
  const sliderHeight = isDesktop
    ? width < SLIDER_DESKTOP_BREAKPOINT
      ? SLIDER_HEIGHT_NARROW
      : SLIDER_HEIGHT_WIDE
    : SLIDER_HEIGHT_NARROW
  const sliderMediaWidth = isDesktop
    ? width < SLIDER_DESKTOP_BREAKPOINT
      ? SLIDER_MEDIA_WIDTH_NARROW
      : SLIDER_MEDIA_WIDTH_WIDE
    : 380

  const featuredCardWidth = useMemo(() => {
    if (!IS_WEB) return undefined
    const horizontalPadding = isMobile ? 32 : 48
    return Math.max(280, Math.min(width - horizontalPadding, 800))
  }, [isMobile, width])

  const popularCardWidth = useMemo(() => {
    if (!isMobile) return 215
    const available = Math.max(width - 32, 288)
    return Math.max(136, Math.floor((available - 14) / 2))
  }, [isMobile, width])

  const popularCardHeight = useMemo(() => {
    if (isMobile) return Math.max(112, Math.round(popularCardWidth * 0.68))
    return 148
  }, [isMobile, popularCardWidth])

  const featuredCardHeight = useMemo(() => {
    if (isMobile) return 220
    if (isTablet) return 280
    return 300
  }, [isMobile, isTablet])

  const bookWrapperWidthRef = useRef(0)
  const [bookWrapperWidth, setBookWrapperWidth] = useState(0)
  const handleBookWrapperLayout = useCallback(
    (e: { nativeEvent: { layout: { width: number } } }) => {
      const nextWidth = e.nativeEvent.layout.width
      if (Math.abs(nextWidth - bookWrapperWidthRef.current) > BOOK_WIDTH_STABILIZE_THRESHOLD) {
        bookWrapperWidthRef.current = nextWidth
        setBookWrapperWidth(nextWidth)
      }
    },
    [],
  )

  const resolvedBookWrapperWidth = useMemo(() => {
    if (!showSideSlider) return 0
    if (bookWrapperWidth > 0) return bookWrapperWidth
    return getEstimatedBookWrapperWidth(width)
  }, [bookWrapperWidth, showSideSlider, width])

  const bookHeight = useMemo(() => {
    if (resolvedBookWrapperWidth <= 0) return 0
    const aspectH = Math.round((resolvedBookWrapperWidth * 765) / 1040)
    return Math.min(aspectH, getWebViewportHeight() - DESKTOP_BOOK_VIEWPORT_RESERVE)
  }, [resolvedBookWrapperWidth])

  const isCompactBookLayout = showSideSlider && bookHeight > 0 && bookHeight <= COMPACT_BOOK_MAX_HEIGHT
  const useInlineBookmarkRail =
    showSideSlider && !isNarrowLayout && !isCompactBookLayout && width >= INLINE_BOOKMARK_MIN_WIDTH
  const useStackedCtas =
    isMobile || isCompactBookLayout || (showSideSlider && width < STACKED_CTA_MAX_WIDTH)

  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)
  const [pendingAction, setPendingAction] = useState<string | null>(null)
  const pendingActionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (!IS_WEB || typeof window === 'undefined') return
    const mediaQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    const sync = () => setPrefersReducedMotion(Boolean(mediaQuery?.matches))
    sync()
    mediaQuery?.addEventListener?.('change', sync)
    return () => mediaQuery?.removeEventListener?.('change', sync)
  }, [])

  useEffect(() => {
    return () => {
      if (pendingActionTimerRef.current) clearTimeout(pendingActionTimerRef.current)
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
    getSlideSource: getBookSlideSource,
  })

  const showNavigationFeedback = useCallback((key: string) => {
    setPendingAction(key)
    if (pendingActionTimerRef.current) clearTimeout(pendingActionTimerRef.current)
    pendingActionTimerRef.current = setTimeout(
      () => setPendingAction((current) => (current === key ? null : current)),
      NAV_FEEDBACK_MS,
    )
  }, [])

  const handleOpenSearch = useCallback(() => {
    showNavigationFeedback('search')
    queueAnalyticsEvent('HomeClick_OpenSearch')
    router.push('/search' as any)
  }, [router, showNavigationFeedback])

  const handleSearchSubmit = useCallback(
    (rawQuery: string) => {
      const query = rawQuery.trim()
      queueAnalyticsEvent('HomeClick_HeroSearch', { hasQuery: query.length > 0 })
      router.push((query ? `/search?search=${encodeURIComponent(query)}` : '/search') as any)
    },
    [router],
  )

  const handleQuickFilterPress = useCallback(
    (label: string, filters?: QuickFilterParams, route: string = '/search') => {
      showNavigationFeedback(`filter:${label}`)
      queueAnalyticsEvent('HomeClick_QuickFilter', { label, source: 'home-hero' })
      router.push(buildFilterPath(route, filters) as any)
    },
    [router, showNavigationFeedback],
  )

  const handleOpenArticle = useCallback(
    (href?: string | null) => {
      if (!href) {
        queueAnalyticsEvent('HomeClick_OpenSearch')
        router.push('/search' as any)
        return
      }
      queueAnalyticsEvent('HomeClick_BookCover', { href })
      if (IS_WEB) openExternalUrlInNewTab(href)
      else openExternalUrl(href)
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
    ? 'Реальные маршруты по Беларуси и Европе — с фото и GPS-треками.'
    : showSideSlider && bookHeight > 0 && bookHeight < COMPACT_BOOK_MAX_HEIGHT
      ? 'Реальные маршруты по Беларуси и Европе — с фото, заметками и GPS-треками.'
      : 'Реальные маршруты по Беларуси и Европе от тех, кто там был — с фото, заметками и GPS-треками.'

  return (
    <View testID="home-hero" style={styles.container}>
      <ResponsiveContainer maxWidth={1920} padding>
        <View style={styles.heroShell}>
          <HomeHeroBookLayout
            colors={colors}
            styles={styles}
            isWeb={IS_WEB}
            isNarrowLayout={isNarrowLayout}
            isTabletLayout={isTabletLayout}
            showSideSlider={showSideSlider}
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
            onOpenArticle={handleOpenArticle}
            onOpenSearch={handleOpenSearch}
            onSearchSubmit={handleSearchSubmit}
            isMobile={isMobile}
            pendingAction={pendingAction}
            onPrevSlide={handlePrevSlide}
            onNextSlide={handleNextSlide}
            onMarkSlideLoaded={markSlideAsLoaded}
          />
          {!showSideSlider && !useInlineBookmarkRail && (
            <HomeHeroMoodRail
              colors={colors}
              styles={styles}
              isMobile={isMobile}
              isWeb={IS_WEB}
              moodCards={MOOD_CARDS}
              onQuickFilterPress={handleQuickFilterPress}
            />
          )}
        </View>

        {!showSideSlider && !isTabletLayout && (
          <HomeHeroPopularSection
            colors={colors}
            styles={styles}
            isWeb={IS_WEB}
            useMobileGrid={isMobile}
            featuredCardWidth={featuredCardWidth}
            featuredCardHeight={featuredCardHeight}
            popularCardWidth={popularCardWidth}
            popularCardHeight={popularCardHeight}
            bookImages={BOOK_IMAGES}
            onOpenArticle={handleOpenArticle}
          />
        )}
      </ResponsiveContainer>
    </View>
  )
})

export default HomeHero
