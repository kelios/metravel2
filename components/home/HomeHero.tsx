import { useMemo, memo, useCallback, useState, useEffect, useRef } from 'react'
import {
  Animated,
  View,
  Text,
  Pressable,
  Platform,
  ScrollView,
  Dimensions,
  Image as RNImage,
  Easing,
} from 'react-native'
import { useRouter } from 'expo-router'
import Feather from '@expo/vector-icons/Feather'
import { useResponsive } from '@/hooks/useResponsive'
import { useThemedColors } from '@/hooks/useTheme'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { ResponsiveContainer } from '@/components/layout'
import Button from '@/components/ui/Button'
import ImageCardMedia from '@/components/ui/ImageCardMedia'
import { queueAnalyticsEvent } from '@/utils/analytics'
import { openExternalUrl, openExternalUrlInNewTab } from '@/utils/externalLinks'
import { createHomeHeroStyles } from './homeHeroStyles'

interface HomeHeroProps {
  travelsCount?: number
  /** HERO-06: legacy prop, retained for compatibility */
  travelsCountLoading?: boolean
}

type QuickFilterValue = string | number | Array<string | number>
type QuickFilterParams = Record<string, QuickFilterValue | undefined>

const normalizeQuickFilterValue = (
  value: QuickFilterValue | undefined,
): string | null => {
  if (value === undefined || value === null) return null
  if (Array.isArray(value)) {
    const cleaned = value
      .map((item) => String(item ?? '').trim())
      .filter((item) => item.length > 0)
    if (!cleaned.length) return null
    return cleaned.join(',')
  }
  const scalar = String(value).trim()
  return scalar.length > 0 ? scalar : null
}

const buildFilterPath = (base: string, params?: QuickFilterParams) => {
  if (!params) return base
  const query = Object.entries(params)
    .map(([key, value]) => {
      const normalized = normalizeQuickFilterValue(value)
      if (!normalized) return null
      return `${key}=${normalized}`
    })
    .filter(
      (item): item is string => typeof item === 'string' && item.length > 0,
    )
    .join('&')
  return query.length > 0 ? `${base}?${query}` : base
}

const BOOK_IMAGES = [
  {
    source: {
      uri: 'https://metravel.by/travel-image/544/conversions/26d572d144174803a61fe96f2d7aa142.webp',
    },
    alt: 'Тропа ведьм — Германия',
    title: 'Тропа ведьм',
    subtitle: 'Хайкинг • Горный маршрут • Германия',
    href: 'https://metravel.by/travels/tropa-vedm-harzer-hexenstieg-kak-proiti-marshrut-i-kak-eto-vygliadit-na-samom-dele',
  },
  {
    source: {
      uri: 'https://metravel.by/gallery/540/gallery/79641dcc63dc476bb89dd66a9faa8527.JPG',
    },
    alt: 'Озеро Сорапис — Доломиты',
    title: 'Озеро Сорапис',
    subtitle: 'Поход по Доломитам • Озеро • Италия',
    href: 'https://metravel.by/travels/ozero-sorapis-pokhod-po-marshrutam-215-i-217-v-dolomitakh',
  },
  {
    source: {
      uri: 'https://metravel.by/travel-image/536/conversions/b254498810ab43fcb7749c3a51ecf3ee.JPG',
    },
    alt: 'Tre Cime di Lavaredo — Доломиты',
    title: 'Tre Cime di Lavaredo',
    subtitle: 'Круговой маршрут 10 км • Горы • Италия',
    href: 'https://metravel.by/travels/tre-cime-di-lavaredo-krugovoi-marshrut-10-km-opisanie-i-vidy',
  },
  {
    source: {
      uri: 'https://metravel.by/gallery/532/gallery/ce0f0221a2ac42e08bc274c0f059dfc9.JPG',
    },
    alt: 'Озеро Блед — Словения',
    title: 'Озеро Блед',
    subtitle: 'Что посмотреть за 1 день • Озеро • Словения',
    href: 'https://metravel.by/travels/vintgarskoe-ushchele-i-ozero-bled-chto-posmotret-v-slovenii-za-1-den',
  },
  {
    source: {
      uri: 'https://metravel.by/travel-image/362/conversions/28160874221349509d697c8016c48464.webp',
    },
    alt: 'Морское око в мае — Польша',
    title: 'Морское око в мае',
    subtitle: 'Поход • Озеро • Польша',
    href: 'https://metravel.by/travels/morskoe-oko-v-mae',
  },
]

export const BOOK_IMAGES_FOR_TEST = BOOK_IMAGES

const getSlideRemoteUri = (
  source: { uri?: string } | number | null | undefined,
): string | null => {
  if (!source) return null
  if (typeof source === 'number') {
    // @ts-ignore -- RNImage.resolveAssetSource is available at runtime on web/native.
    const resolvedUri = RNImage.resolveAssetSource?.(source)?.uri
    return typeof resolvedUri === 'string' && resolvedUri.trim().length > 0
      ? resolvedUri.trim()
      : null
  }
  if (
    typeof source === 'object' &&
    'uri' in source &&
    typeof source.uri === 'string'
  ) {
    const trimmedUri = source.uri.trim()
    return trimmedUri.length > 0 ? trimmedUri : null
  }
  return null
}

const preloadWebImage = async (uri: string): Promise<boolean> => {
  if (!uri || Platform.OS !== 'web') return false
  if (typeof window === 'undefined' || typeof window.Image === 'undefined')
    return false
  return new Promise((resolve) => {
    const image = new window.Image()
    let settled = false
    const settle = (result: boolean) => {
      if (settled) return
      settled = true
      image.onload = null
      image.onerror = null
      resolve(result)
    }

    image.onload = () => settle(true)
    image.onerror = () => settle(false)
    image.decoding = 'async'
    image.src = uri

    if (image.complete && image.naturalWidth > 0) {
      settle(true)
      return
    }

    setTimeout(() => settle(false), 10000)
  })
}

const MOOD_CARDS = [
  {
    title: 'У воды',
    icon: 'wind',
    filters: { categoryTravelAddress: [84, 110, 113, 193] },
    route: '/search',
  },
  {
    title: 'Замки',
    icon: 'bookmark',
    filters: { categoryTravelAddress: [33, 43] },
    route: '/search',
  },
  {
    title: 'Руины',
    icon: 'file-text',
    filters: { categoryTravelAddress: [114, 115, 116, 117, 118, 119, 120] },
    route: '/search',
  },
  {
    title: 'Хайкинг',
    icon: 'feather',
    filters: { categories: [21, 22, 2] },
    route: '/search',
  },
  {
    title: 'Карта до 60 км',
    meta: 'Рядом с вами',
    icon: 'map-pin',
    filters: { radius: 60 },
    route: '/map',
  },
] as const

const HERO_HIGHLIGHTS = [
  { icon: 'pen-tool', title: 'За 2 минуты', subtitle: 'подборка под ваш ритм' },
  { icon: 'book-open', title: 'Личная книга', subtitle: 'фото, заметки и PDF' },
  {
    icon: 'compass',
    title: 'Маршруты рядом',
    subtitle: 'фильтры по дистанции и формату',
  },
  {
    icon: 'download',
    title: 'GPS-треки',
    subtitle: 'скачай и следуй маршруту',
  },
] as const

export const MOOD_CARDS_FOR_TEST = MOOD_CARDS
const HOME_HERO_BOOK_LAYOUT_MIN_WIDTH = 1280

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
  const isNarrowLayout =
    isMobile || (isWeb && width < HOME_HERO_BOOK_LAYOUT_MIN_WIDTH)
  const showSideSlider =
    isWeb && width >= HOME_HERO_BOOK_LAYOUT_MIN_WIDTH && isDesktop
  const sliderIconColor = colors.textOnDark ?? DESIGN_TOKENS.colors.textOnDark
  const sliderHeight = isDesktop ? (width < 1480 ? 360 : 420) : 360
  const sliderMediaWidth = isDesktop ? (width < 1480 ? 480 : 500) : 380
  const featuredCardWidth = useMemo(() => {
    if (!isWeb) return undefined
    const horizontalPadding = isMobile ? 32 : 48
    return Math.max(280, Math.min(width - horizontalPadding, 800))
  }, [isMobile, isWeb, width])
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
  const waveBreath = useRef(new Animated.Value(0)).current

  // Slider state
  const [activeSlide, setActiveSlide] = useState(0)
  const [visibleSlide, setVisibleSlide] = useState(0)
  const [fadingSlide, setFadingSlide] = useState<number | null>(null)
  const [loadedSlides, setLoadedSlides] = useState<Set<number>>(
    () => new Set([0]),
  )
  const totalSlides = BOOK_IMAGES.length
  const previousVisibleSlideRef = useRef(0)

  const markSlideAsLoaded = useCallback((slideIndex: number) => {
    setLoadedSlides((prev) => {
      if (prev.has(slideIndex)) return prev
      const next = new Set(prev)
      next.add(slideIndex)
      return next
    })
  }, [])

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

  useEffect(() => {
    if (Platform.OS !== 'web') {
      setVisibleSlide(activeSlide)
      markSlideAsLoaded(activeSlide)
      return
    }

    let cancelled = false
    const preloadSlide = async (slideIndex: number) => {
      if (loadedSlides.has(slideIndex)) return
      const remoteUri = getSlideRemoteUri(BOOK_IMAGES[slideIndex]?.source)
      if (!remoteUri) {
        if (!cancelled) markSlideAsLoaded(slideIndex)
        return
      }
      const preloadSucceeded = await preloadWebImage(remoteUri)
      if (!cancelled && preloadSucceeded) {
        markSlideAsLoaded(slideIndex)
      }
    }

    const nextSlide = (activeSlide + 1) % totalSlides
    void preloadSlide(activeSlide)
    void preloadSlide(nextSlide)

    return () => {
      cancelled = true
    }
  }, [activeSlide, loadedSlides, markSlideAsLoaded, totalSlides])

  useEffect(() => {
    if (loadedSlides.has(activeSlide)) {
      setVisibleSlide(activeSlide)
    }
  }, [activeSlide, loadedSlides])

  useEffect(() => {
    const previousVisibleSlide = previousVisibleSlideRef.current
    if (previousVisibleSlide === visibleSlide) return

    previousVisibleSlideRef.current = visibleSlide
    setFadingSlide(previousVisibleSlide)

    if (Platform.OS !== 'web') {
      setFadingSlide(null)
      return
    }

    const timeoutId = window.setTimeout(() => {
      setFadingSlide((current) =>
        current === previousVisibleSlide ? null : current,
      )
    }, 520)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [visibleSlide])

  // Auto-advance slider
  useEffect(() => {
    if (!showSideSlider) return
    if (prefersReducedMotion) return
    const interval = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % totalSlides)
    }, 8000)
    return () => clearInterval(interval)
  }, [prefersReducedMotion, showSideSlider, totalSlides])

  useEffect(() => {
    if (!showSideSlider || prefersReducedMotion) {
      waveBreath.stopAnimation()
      waveBreath.setValue(0)
      return
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(waveBreath, {
          toValue: 1,
          duration: 4200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(waveBreath, {
          toValue: 0,
          duration: 4200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    )

    loop.start()

    return () => {
      loop.stop()
      waveBreath.stopAnimation()
    }
  }, [prefersReducedMotion, showSideSlider, waveBreath])

  const handlePrevSlide = useCallback(() => {
    setActiveSlide((prev) => (prev - 1 + totalSlides) % totalSlides)
  }, [totalSlides])

  const handleNextSlide = useCallback(() => {
    setActiveSlide((prev) => (prev + 1) % totalSlides)
  }, [totalSlides])

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
    ],
  )

  const currentSlide = BOOK_IMAGES[visibleSlide]
  const renderedSlideIndices = useMemo(() => {
    if (
      fadingSlide === null ||
      fadingSlide === visibleSlide ||
      !loadedSlides.has(fadingSlide)
    ) {
      return [visibleSlide]
    }

    return [fadingSlide, visibleSlide]
  }, [fadingSlide, loadedSlides, visibleSlide])
  const topWaveAnimatedStyle = useMemo(
    () => ({
      opacity: waveBreath.interpolate({
        inputRange: [0, 0.5, 1],
        outputRange: [0.34, 0.46, 0.38],
      }),
      transform: [
        {
          translateY: waveBreath.interpolate({
            inputRange: [0, 1],
            outputRange: [0, -2],
          }),
        },
        {
          scaleX: waveBreath.interpolate({
            inputRange: [0, 1],
            outputRange: [1, 1.014],
          }),
        },
        {
          scaleY: waveBreath.interpolate({
            inputRange: [0, 1],
            outputRange: [1, 1.025],
          }),
        },
      ],
    }),
    [waveBreath],
  )
  const bottomWaveAnimatedStyle = useMemo(
    () => ({
      opacity: waveBreath.interpolate({
        inputRange: [0, 0.5, 1],
        outputRange: [0.4, 0.54, 0.44],
      }),
      transform: [
        {
          translateY: waveBreath.interpolate({
            inputRange: [0, 1],
            outputRange: [0, 2],
          }),
        },
        {
          scaleX: waveBreath.interpolate({
            inputRange: [0, 1],
            outputRange: [1.01, 1.024],
          }),
        },
        {
          scaleY: waveBreath.interpolate({
            inputRange: [0, 1],
            outputRange: [1, 1.036],
          }),
        },
      ],
    }),
    [waveBreath],
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
          {/* Book wrapper for 3D effect */}
          <View
            style={styles.bookWrapper}
            onLayout={showSideSlider ? handleBookWrapperLayout : undefined}
          >
            {/* Book cover shadow/glow */}
            {isWeb && showSideSlider && <View style={styles.bookCoverOuter} />}

            {/* Hero Row: Left page (text) + Right page (slider) */}
            <View style={styles.heroRow}>
              {/* Central book spine */}
              {isWeb && showSideSlider && <View style={styles.heroBookSpine} />}

              {/* Left Page - Text Content */}
              <View testID="home-hero-left-page" style={styles.heroSection}>
                {/* Golden decorative line at top */}
                {isWeb && showSideSlider && (
                  <View style={styles.heroPageGoldLine} />
                )}
                {/* Page curl effect */}
                {isWeb && showSideSlider && (
                  <View style={styles.heroPageCurlLeft} />
                )}
                <View
                  testID="home-hero-left-frame"
                  style={styles.leftPageFrame}
                >
                  {/* Grid row 1: top content (auto height) */}
                  <View>
                    {showSideSlider && !isNarrowLayout && (
                      <View style={styles.chapterHeader}>
                        <Text style={styles.chapterLabel}>Глава 01</Text>
                        <View style={styles.chapterDivider} />
                      </View>
                    )}
                    {/* Title */}
                    <View>
                      <Text style={styles.title}>
                        Куда поехать{isNarrowLayout ? ' ' : '\n'}
                      </Text>
                      <Text style={styles.titleAccent}>в эти выходные?</Text>
                    </View>

                    {/* Subtitle */}
                    <Text style={styles.subtitle}>{heroSubtitle}</Text>
                  </View>

                  {/* Grid row 2: chips (1fr — fills available space, clips gracefully) */}
                  {useInlineBookmarkRail && (
                    <View
                      testID="home-hero-bookmark-rail"
                      style={styles.bookmarkRail}
                    >
                      {MOOD_CARDS.map((card) => (
                        <Pressable
                          key={`inline-${card.title}`}
                          onPress={() =>
                            handleQuickFilterPress(
                              card.title,
                              card.filters as unknown as QuickFilterParams,
                              card.route,
                            )
                          }
                          style={({ pressed, hovered }) => [
                            styles.bookmarkChip,
                            (pressed || hovered) && styles.bookmarkChipHover,
                          ]}
                          accessibilityRole="button"
                          accessibilityLabel={`${card.title}. Идея поездки`}
                        >
                          <Feather
                            name={card.icon as any}
                            size={16}
                            color={colors.textMuted}
                          />
                          <Text style={styles.moodChipTitle}>{card.title}</Text>
                        </Pressable>
                      ))}
                    </View>
                  )}

                  {/* Inner mini-book feature highlights widget */}
                  {!showSideSlider && !useInlineBookmarkRail && !isMobile && (
                    <View style={styles.openBookContainer}>
                      <View style={styles.openBook}>
                        {isWeb && <View style={styles.bookCover} />}
                        {/* Left Page */}
                        <View style={[styles.bookPage, styles.bookPageLeft]}>
                          {isWeb && <View style={styles.bookPageGoldLine} />}
                          <View style={styles.bookSpineShadowLeft} />
                          {HERO_HIGHLIGHTS.slice(0, 2).map((item) => (
                            <Pressable
                              key={item.title}
                              style={({ hovered }) => [
                                styles.bookHighlightItem,
                                hovered && styles.bookHighlightItemHover,
                              ]}
                            >
                              <View style={styles.bookHighlightIconWrap}>
                                <Feather
                                  name={item.icon as any}
                                  size={isMobile ? 13 : 15}
                                  color={colors.textOnPrimary}
                                />
                              </View>
                              <View style={styles.bookHighlightTextWrap}>
                                <Text style={styles.bookHighlightTitle}>
                                  {item.title}
                                </Text>
                                <Text style={styles.bookHighlightSubtitle}>
                                  {item.subtitle}
                                </Text>
                              </View>
                            </Pressable>
                          ))}
                          <View
                            style={[
                              styles.bookPageCurl,
                              styles.bookPageCurlLeft,
                            ]}
                          />
                          <Text
                            style={[
                              styles.bookPageNumber,
                              styles.bookPageNumberLeft,
                            ]}
                          >
                            1
                          </Text>
                        </View>
                        {/* Center Spine */}
                        <View style={styles.bookSpine} />
                        {/* Right Page */}
                        <View style={[styles.bookPage, styles.bookPageRight]}>
                          {isWeb && <View style={styles.bookPageGoldLine} />}
                          <View style={styles.bookSpineShadowRight} />
                          {HERO_HIGHLIGHTS.slice(2).map((item) => (
                            <Pressable
                              key={item.title}
                              style={({ hovered }) => [
                                styles.bookHighlightItem,
                                hovered && styles.bookHighlightItemHover,
                              ]}
                            >
                              <View style={styles.bookHighlightIconWrap}>
                                <Feather
                                  name={item.icon as any}
                                  size={isMobile ? 13 : 15}
                                  color={colors.textOnPrimary}
                                />
                              </View>
                              <View style={styles.bookHighlightTextWrap}>
                                <Text style={styles.bookHighlightTitle}>
                                  {item.title}
                                </Text>
                                <Text style={styles.bookHighlightSubtitle}>
                                  {item.subtitle}
                                </Text>
                              </View>
                            </Pressable>
                          ))}
                          <View
                            style={[
                              styles.bookPageCurl,
                              styles.bookPageCurlRight,
                            ]}
                          />
                          <Text
                            style={[
                              styles.bookPageNumber,
                              styles.bookPageNumberRight,
                            ]}
                          >
                            2
                          </Text>
                        </View>
                      </View>
                    </View>
                  )}

                  {/* Grid row 3: CTA (auto height, pinned to bottom by grid) */}
                  <View
                    testID="home-hero-cta-row"
                    style={styles.buttonsContainer}
                  >
                    <Button
                      onPress={handleOpenSearch}
                      label="Смотреть маршруты"
                      variant="secondary"
                      size="md"
                      fullWidth={useStackedCtas}
                      icon={
                        <Feather name="compass" size={16} color={colors.text} />
                      }
                      style={[styles.secondaryButton, styles.singleCtaButton]}
                      labelStyle={styles.secondaryButtonText}
                      hoverStyle={styles.secondaryButtonHover}
                      pressedStyle={styles.secondaryButtonHover}
                      accessibilityLabel="Смотреть маршруты"
                    />
                  </View>
                </View>

                {/* Page number on left page */}
                {showSideSlider && (
                  <Text
                    style={[styles.bookPageNumber, styles.bookPageNumberLeft]}
                  >
                    1
                  </Text>
                )}
              </View>

              {/* Right Page - Slider Section */}
              {showSideSlider && (
                <View style={styles.sliderSection}>
                  {/* Golden decorative line at top */}
                  {isWeb && <View style={styles.sliderPageGoldLine} />}
                  {/* Page curl effect */}
                  {isWeb && <View style={styles.heroPageCurlRight} />}
                  {/* Page number */}
                  <Text style={styles.sliderPageNumber}>2</Text>
                  <View
                    testID="home-hero-slider-frame"
                    style={styles.sliderFrame}
                  >
                    <Pressable
                      onPress={() => handleOpenArticles(currentSlide.href)}
                      testID="home-hero-slider-container"
                      style={styles.sliderContainer}
                      {...((isWeb
                        ? { dataSet: { bookSlider: 'true' } }
                        : {}) as any)}
                      accessibilityRole="link"
                      accessibilityLabel={`Маршрут недели: ${currentSlide.title}. ${currentSlide.subtitle}`}
                      accessibilityHint="Открыть маршрут"
                    >
                      {renderedSlideIndices.map((slideIndex) => {
                        const slide = BOOK_IMAGES[slideIndex]
                        const isCurrentVisibleSlide = slideIndex === visibleSlide
                        const isSlideLoaded = loadedSlides.has(slideIndex)

                        return (
                          <View
                            key={`hero-slide-${slideIndex}`}
                            style={[
                              styles.slideWrapper,
                              Platform.OS === 'web'
                                ? ({
                                    opacity: isCurrentVisibleSlide ? 1 : 0,
                                    zIndex: isCurrentVisibleSlide ? 2 : 1,
                                  } as any)
                                : null,
                            ]}
                            pointerEvents="none"
                          >
                            <ImageCardMedia
                              source={slide.source}
                              width={sliderMediaWidth}
                              height={sliderHeight}
                              borderRadius={0}
                              fit="contain"
                              blurBackground
                              allowCriticalWebBlur
                              quality={90}
                              alt={slide.alt}
                              loading={isSlideLoaded ? 'eager' : 'lazy'}
                              showImmediately={isSlideLoaded}
                              style={styles.slideImage}
                              onLoad={() => markSlideAsLoaded(slideIndex)}
                            />
                            <View style={styles.slideOverlay}>
                              <View style={styles.slideEyebrow}>
                                <Feather
                                  name="map-pin"
                                  size={11}
                                  color={sliderIconColor}
                                />
                                <Text style={styles.slideEyebrowText}>
                                  Маршрут недели
                                </Text>
                              </View>
                              <View style={styles.slideCaption}>
                                <Text style={styles.slideTitle}>
                                  {slide.title}
                                </Text>
                                <Text style={styles.slideSubtitle}>
                                  {slide.subtitle}
                                </Text>
                              </View>
                            </View>
                          </View>
                        )
                      })}
                      {isWeb && (
                        <>
                          <View style={styles.sliderPaperInset} />
                          <View style={styles.sliderPaperFrame} />
                        </>
                      )}
                      {isWeb && (
                        <>
                          <View style={styles.sliderTopBlur} />
                          <View
                            style={[
                              styles.sliderEdgeBlur,
                              styles.sliderEdgeBlurLeft,
                            ]}
                          />
                          <View
                            style={[
                              styles.sliderEdgeBlur,
                              styles.sliderEdgeBlurRight,
                            ]}
                          />
                          {showSideSlider && (
                            <>
                              <Animated.View
                                testID="home-hero-slider-wave-top"
                                style={[
                                  styles.sliderPageWave,
                                  styles.sliderPageWaveTop,
                                  topWaveAnimatedStyle,
                                ]}
                              />
                              <Animated.View
                                testID="home-hero-slider-wave-bottom"
                                style={[
                                  styles.sliderPageWave,
                                  styles.sliderPageWaveBottom,
                                  bottomWaveAnimatedStyle,
                                ]}
                              />
                            </>
                          )}
                        </>
                      )}
                      {/* Navigation arrows — inside sliderContainer to stay within book page bounds */}
                      <View style={styles.sliderNav}>
                        <Pressable
                          onPress={handlePrevSlide}
                          style={({ hovered }) => [
                            styles.sliderNavBtn,
                            hovered && styles.sliderNavBtnHover,
                          ]}
                          accessibilityRole="button"
                          accessibilityLabel="Предыдущий слайд"
                        >
                          <Feather
                            name="chevron-left"
                            size={14}
                            color={sliderIconColor}
                          />
                        </Pressable>
                        <Pressable
                          onPress={handleNextSlide}
                          style={({ hovered }) => [
                            styles.sliderNavBtn,
                            hovered && styles.sliderNavBtnHover,
                          ]}
                          accessibilityRole="button"
                          accessibilityLabel="Следующий слайд"
                        >
                          <Feather
                            name="chevron-right"
                            size={14}
                            color={sliderIconColor}
                          />
                        </Pressable>
                      </View>
                    </Pressable>
                  </View>
                </View>
              )}
            </View>
          </View>
          {!useInlineBookmarkRail && (
            <View style={styles.moodChipsContainer}>
              <View
                style={
                  isWeb
                    ? ({
                        WebkitMaskImage:
                          'linear-gradient(to right, transparent 0px, black 16px, black calc(100% - 16px), transparent 100%)',
                        maskImage:
                          'linear-gradient(to right, transparent 0px, black 16px, black calc(100% - 16px), transparent 100%)',
                        overflow: 'hidden',
                      } as any)
                    : undefined
                }
              >
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={
                    isWeb
                      ? ({
                          touchAction: 'pan-x',
                          WebkitOverflowScrolling: 'touch',
                          overflowX: 'auto',
                          overflowY: 'hidden',
                        } as any)
                      : undefined
                  }
                  contentContainerStyle={styles.moodChipsScrollContent}
                >
                  {MOOD_CARDS.map((card) => (
                    <Pressable
                      key={card.title}
                      onPress={() =>
                        handleQuickFilterPress(
                          card.title,
                          card.filters as unknown as QuickFilterParams,
                          card.route,
                        )
                      }
                      style={({ pressed, hovered }) => [
                        styles.moodChip,
                        (pressed || hovered) && styles.moodChipHover,
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={`${card.title}. Идея поездки`}
                    >
                      <Feather
                        name={card.icon as any}
                        size={19}
                        color={colors.textMuted}
                      />
                      <Text style={styles.moodChipTitle}>{card.title}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            </View>
          )}
        </View>

        {/* Popular Routes Section - only on mobile */}
        {!showSideSlider && (
          <View style={styles.popularSection}>
            {/* Featured изображение маршрута — даёт визуальный контекст сразу без скролла */}
            <Pressable
              onPress={() => handleOpenArticles(BOOK_IMAGES[0].href)}
              style={({ pressed, hovered }) => [
                styles.featuredCard,
                (pressed || hovered) && styles.featuredCardHover,
              ]}
              accessibilityRole="link"
              accessibilityLabel={`Открыть маршрут: ${BOOK_IMAGES[0].title}`}
            >
              <ImageCardMedia
                source={BOOK_IMAGES[0].source}
                width={featuredCardWidth}
                height={featuredCardHeight}
                borderRadius={0}
                fit="contain"
                blurBackground
                allowCriticalWebBlur
                quality={72}
                alt={BOOK_IMAGES[0].alt}
                loading="eager"
                style={styles.featuredCardImage}
              />
              <View style={styles.featuredCardOverlay}>
                <View style={styles.slideEyebrow}>
                  <Feather name="map-pin" size={11} color="#FFFFFF" />
                  <Text style={styles.slideEyebrowText}>Маршрут недели</Text>
                </View>
                <Text style={styles.featuredCardTitle} numberOfLines={1}>
                  {BOOK_IMAGES[0].title}
                </Text>
                <Text style={styles.featuredCardSubtitle} numberOfLines={1}>
                  {BOOK_IMAGES[0].subtitle}
                </Text>
              </View>
            </Pressable>
            <Text style={styles.popularTitle}>Популярные маршруты</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={
                isWeb
                  ? ({
                      touchAction: 'pan-x',
                      WebkitOverflowScrolling: 'touch',
                      overflowX: 'auto',
                      overflowY: 'hidden',
                    } as any)
                  : undefined
              }
              contentContainerStyle={styles.popularScrollContent}
            >
              {BOOK_IMAGES.map((image) => (
                <Pressable
                  key={image.title}
                  onPress={() => handleOpenArticles(image.href)}
                  style={({ pressed, hovered }) => [
                    styles.imageCard,
                    (pressed || hovered) && styles.imageCardHover,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={image.title}
                >
                  <ImageCardMedia
                    source={image.source}
                    width={isMobile ? 195 : 215}
                    height={isMobile ? 130 : 148}
                    borderRadius={0}
                    fit="contain"
                    blurBackground
                    quality={85}
                    alt={image.alt}
                    loading="lazy"
                    style={styles.imageCardImage}
                  />
                  <View style={styles.imageCardContent}>
                    <Text style={styles.imageCardTitle} numberOfLines={1}>
                      {image.title}
                    </Text>
                    <Text style={styles.imageCardSubtitle} numberOfLines={1}>
                      {image.subtitle}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}
      </ResponsiveContainer>
    </View>
  )
})

export default HomeHero
