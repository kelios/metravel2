import { useEffect, useState, type ReactNode } from 'react'
import { Animated, Pressable, Text, View } from 'react-native'
import type { LayoutChangeEvent } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import Button from '@/components/ui/Button'
import ImageCardMedia from '@/components/ui/ImageCardMedia'
import type { ThemedColors } from '@/hooks/useTheme'
import HomeHeroSearchBar from './HomeHeroSearchBar'
import type { QuickFilterParams } from './homeHeroShared'
import { translate as i18nT } from '@/i18n'
import { webDataSetProps } from '@/utils/webProps'


type MoodCard = {
  title: string
  icon: string
  filters: QuickFilterParams
  route: string
  meta?: string
}

type HeroHighlight = {
  icon: string
  title: string
  subtitle: string
}

type BookImage = {
  source: any
  alt: string
  title: string
  subtitle: string
  href?: string
  /** Заливка полей letterbox под `contain`-кадром (#1208). */
  dominantColor?: string
}

type Styles = any

type HomeHeroBookLayoutProps = {
  responsiveWeb?: boolean
  responsiveMoodRail?: ReactNode
  colors: ThemedColors
  styles: Styles
  isWeb: boolean
  isNarrowLayout: boolean
  isTabletLayout: boolean
  bookHeight: number
  showSideSlider: boolean
  width: number
  sliderHeight: number
  sliderMediaWidth: number
  sliderIconColor: string
  disableHeroSliderBlur: boolean
  heroSubtitle: string
  moodCards: readonly MoodCard[]
  heroHighlights: readonly HeroHighlight[]
  bookImages: readonly BookImage[]
  currentSlide: BookImage
  renderedSlideIndices: number[]
  visibleSlide: number
  loadedSlides: Set<number>
  useStackedCtas: boolean
  topWaveAnimatedStyle: any
  bottomWaveAnimatedStyle: any
  onBookWrapperLayout?: (e: { nativeEvent: { layout: { width: number } } }) => void
  onQuickFilterPress: (label: string, filters?: QuickFilterParams, route?: string) => void
  onOpenArticle: (href?: string | null) => void
  onOpenSearch: () => void
  onSearchSubmit: (query: string) => void
  isMobile: boolean
  pendingAction: string | null
  onPrevSlide: () => void
  onNextSlide: () => void
  onMarkSlideLoaded: (slideIndex: number) => void
  /** The quick ideas must stay reachable: HomeHero shows its rail whenever the book drops its notes (#2773). */
  onPageNotesVisibilityChange?: (visible: boolean) => void
}

const HOME_BOOK_PAGE_NOTES_MIN_HEIGHT = 780

// Page notes are optional decoration: a fixed height threshold cannot know how
// many lines the title and subtitle wrap into (viewport, locale), so the notes
// stay only while the measured page content fits its frame. Once dropped for a
// layout they stay dropped until the book size or the text changes.
function usePageNotesFit(enabled: boolean, bookHeight: number, layoutKey: string) {
  // Vertical page insets follow bookHeight (getHomeBookPageMetrics). A content
  // resize can arrive first, so never compare it with another book's frame.
  const [frame, setFrame] = useState({ bookHeight: 0, height: 0 })
  const frameHeight = frame.bookHeight === bookHeight ? frame.height : 0
  // A content height measured for another layout is stale: the notes are back
  // in the page and only a fresh measurement tells whether they fit now.
  const [content, setContent] = useState({ key: '', height: 0 })
  const [droppedKey, setDroppedKey] = useState<string | null>(null)
  const fits = droppedKey !== layoutKey
  const contentHeight = content.key === layoutKey ? content.height : 0

  useEffect(() => {
    if (!enabled || !fits || frameHeight <= 0 || contentHeight <= frameHeight + 1) return
    setDroppedKey(layoutKey)
  }, [contentHeight, enabled, fits, frameHeight, layoutKey])

  // Keep handlers attached even while disabled: RN Web observes only at mount.
  return {
    fits,
    onFrameLayout: (e: LayoutChangeEvent) =>
      setFrame({ bookHeight, height: e.nativeEvent.layout.height }),
    onContentLayout: (e: LayoutChangeEvent) =>
      setContent({ key: layoutKey, height: e.nativeEvent.layout.height }),
  }
}

const SLIDE_WRAPPER_POINTER_NONE = { pointerEvents: 'none' as const }

function ResponsiveBookPart({ enabled, name, children }: { enabled: boolean; name: string; children: ReactNode }) {
  return enabled ? <View {...webDataSetProps({ [name]: true })}>{children}</View> : <>{children}</>
}

const SLIDER_NAV_INDICATOR_FALLBACK = {
  fontSize: 11,
  fontWeight: '600' as const,
  opacity: 0.7,
  minWidth: 28,
  textAlign: 'center' as const,
}

function HeroWeekEyebrow({
  styles,
  iconColor,
  responsiveWeb = false,
}: {
  styles: Styles
  iconColor: string
  responsiveWeb?: boolean
}) {
  return (
    <View style={styles.slideEyebrow}>
      <Feather
        name="map-pin"
        size={11}
        color={iconColor}
        {...({ 'aria-hidden': true, focusable: false } as any)}
      />
      <Text style={styles.slideEyebrowText} {...(responsiveWeb ? webDataSetProps({ homePrimaryEyebrow: true }) : {})}>{i18nT('home:components.home.HomeHeroBookLayout.marshrut_nedeli_2ae93682')}</Text>
    </View>
  )
}

function HeroPageNotes({
  responsiveWeb = false,
  activeKey,
  colors,
  compact = false,
  moodCards,
  onQuickFilterPress,
  styles,
}: {
  responsiveWeb?: boolean
  activeKey: string | null
  colors: ThemedColors
  compact?: boolean
  moodCards: readonly MoodCard[]
  onQuickFilterPress: (label: string, filters?: QuickFilterParams, route?: string) => void
  styles: Styles
}) {
  return (
    <View
      testID={compact ? 'home-hero-page-notes-compact' : 'home-hero-page-notes'}
      style={[styles.pageNotesGrid, compact && styles.pageNotesGridCompact]}
    >
      {moodCards.map((card) => (
        <HeroPageNote
          key={`page-note-${card.title}`}
          active={activeKey === `filter:${card.title}`}
          card={card}
          colors={colors}
          compact={compact}
          responsiveWeb={responsiveWeb}
          onQuickFilterPress={onQuickFilterPress}
          styles={styles}
        />
      ))}
    </View>
  )
}

function HeroPageNote({
  responsiveWeb = false,
  active,
  card,
  colors,
  compact,
  onQuickFilterPress,
  styles,
}: {
  responsiveWeb?: boolean
  active: boolean
  card: MoodCard
  colors: ThemedColors
  compact: boolean
  onQuickFilterPress: (label: string, filters?: QuickFilterParams, route?: string) => void
  styles: Styles
}) {
  return (
    <Pressable
      onPress={() => onQuickFilterPress(card.title, card.filters, card.route)}
      style={({ pressed, hovered, focused }: any) => [
        styles.pageNote,
        (pressed || hovered) && styles.pageNoteHover,
        active && styles.pageNoteActive,
        focused && {
          outlineWidth: 2,
          outlineStyle: 'solid',
          outlineColor: colors.primary,
          outlineOffset: 2,
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={i18nT('home:components.home.HomeHeroBookLayout.value1_podobrat_ideyu_poezdki_228a0972', { value1: card.title })}
      accessibilityState={{ busy: active }}
    >
      <View style={[styles.pageNoteIcon, active && styles.pageNoteIconActive]}>
        <Feather
          name={active ? 'loader' : (card.icon as any)}
          size={14}
          color={active ? colors.textOnPrimary : colors.brand}
          {...({ 'aria-hidden': true, focusable: false } as any)}
        />
      </View>
      <View style={styles.pageNoteTextWrap}>
        <Text style={[styles.pageNoteText, compact && styles.pageNoteTextCompact, active && styles.pageNoteTextActive]}
          {...(responsiveWeb ? webDataSetProps({ homeBookNoteText: true }) : {})}>
          {card.title}
        </Text>
        {(active || (card.meta && !compact)) && (
          <Text style={[styles.pageNoteMeta, active && styles.pageNoteMetaActive]}
            {...(responsiveWeb ? webDataSetProps({ homeBookNoteMeta: true }) : {})}>
            {active ? i18nT('home:components.home.HomeHeroBookLayout.otkryvaem_0d829dc9') : card.meta}
          </Text>
        )}
      </View>
    </Pressable>
  )
}

function TabletFeatureGrid({
  colors,
  heroHighlights,
  styles,
}: {
  colors: ThemedColors
  heroHighlights: readonly HeroHighlight[]
  styles: Styles
}) {
  return (
    <View style={styles.tabletFeatureGrid}>
      {heroHighlights.map((item) => (
        <View key={item.title} style={styles.tabletFeatureCard} accessibilityRole="text">
          <View style={styles.tabletFeatureIconWrap}>
            <Feather name={item.icon as any} size={16} color={colors.textOnPrimary} />
          </View>
          <View style={styles.tabletFeatureTextWrap}>
            <Text style={styles.tabletFeatureTitle}>{item.title}</Text>
            <Text style={styles.tabletFeatureSubtitle}>{item.subtitle}</Text>
          </View>
        </View>
      ))}
    </View>
  )
}

function TabletFeaturedRoute({
  bookImage,
  iconColor,
  onOpenArticle,
  styles,
  width,
}: {
  bookImage: BookImage
  iconColor: string
  onOpenArticle: (href?: string | null) => void
  styles: Styles
  width: number
}) {
  // #1541: планшетный кадр показывает тот же набор, что и слайдер, поэтому
  // держит ту же пропорцию — фиксированные 340px давали слот 1.36 и полосы.
  const tabletMediaWidth = width * 0.45
  return (
    <Pressable
      onPress={() => onOpenArticle(bookImage.href)}
      style={({ focused }: any) => [
        styles.tabletHeroRight,
        focused && {
          outlineWidth: 2,
          outlineStyle: 'solid',
          outlineColor: iconColor,
          outlineOffset: 2,
        },
      ]}
      accessibilityRole="link"
      accessibilityLabel={i18nT('home:components.home.HomeHeroBookLayout.otkryt_marshrut_value1_value2_9356f203', { value1: bookImage.title, value2: bookImage.subtitle })}
    >
      <ImageCardMedia
        source={bookImage.source}
        placeholderColor={bookImage.dominantColor}
        width={tabletMediaWidth}
        borderRadius={0}
        fit="contain"
        blurBackground
        allowCriticalWebBlur
        quality={68}
        alt={bookImage.alt}
        loading="eager"
        priority="high"
        style={styles.tabletFeaturedImage}
      />
      <View style={styles.tabletFeaturedOverlay}>
        <HeroWeekEyebrow styles={styles} iconColor={iconColor} />
        <Text style={styles.tabletFeaturedTitle}>{bookImage.title}</Text>
        <Text style={styles.tabletFeaturedSubtitle}>{bookImage.subtitle}</Text>
      </View>
    </Pressable>
  )
}

type HeroSliderProps = {
  responsiveWeb?: boolean
  bookImages: readonly BookImage[]
  currentSlide: BookImage
  disableHeroSliderBlur: boolean
  isWeb: boolean
  loadedSlides: Set<number>
  onMarkSlideLoaded: (slideIndex: number) => void
  onNextSlide: () => void
  onOpenArticle: (href?: string | null) => void
  onPrevSlide: () => void
  renderedSlideIndices: number[]
  showSideSlider: boolean
  sliderHeight: number
  sliderIconColor: string
  sliderMediaWidth: number
  styles: Styles
  topWaveAnimatedStyle: any
  bottomWaveAnimatedStyle: any
  visibleSlide: number
}

function HeroSlider({
  responsiveWeb = false,
  bookImages,
  currentSlide,
  disableHeroSliderBlur,
  isWeb,
  loadedSlides,
  onMarkSlideLoaded,
  onNextSlide,
  onOpenArticle,
  onPrevSlide,
  renderedSlideIndices,
  showSideSlider,
  sliderHeight,
  sliderIconColor,
  sliderMediaWidth,
  styles,
  topWaveAnimatedStyle,
  bottomWaveAnimatedStyle,
  visibleSlide,
}: HeroSliderProps) {
  const decoration = responsiveWeb ? webDataSetProps({ homeBookDecoration: true }) : {}
  return (
    <View style={styles.sliderSection} {...(responsiveWeb ? webDataSetProps({ homeBookRight: true }) : {})}>
      {isWeb && <View style={styles.sliderPageGoldLine} {...decoration} />}
      {isWeb && <View style={styles.heroPageCurlRight} {...decoration} />}
      <Text style={styles.sliderPageNumber} {...decoration}
        {...(responsiveWeb ? webDataSetProps({ homeBookPageNumber: 'right', homeBookDecoration: true }) : {})}>2</Text>

      <View testID="home-hero-slider-frame" style={styles.sliderFrame} {...(responsiveWeb ? webDataSetProps({ homeBookMedia: true }) : {})}>
        <Pressable
          onPress={() => onOpenArticle(currentSlide.href)}
          testID="home-hero-slider-container"
          style={({ focused }: any) => [
            styles.sliderContainer,
            isWeb && focused && {
              outlineWidth: 2,
              outlineStyle: 'solid',
              outlineColor: sliderIconColor,
              outlineOffset: 2,
            },
          ]}
          {...((isWeb ? { dataSet: { bookSlider: 'true' } } : {}) as any)}
          accessibilityRole="link"
          accessibilityLabel={i18nT('home:components.home.HomeHeroBookLayout.marshrut_nedeli_value1_value2_2e2fe69f', { value1: currentSlide.title, value2: currentSlide.subtitle })}
          accessibilityHint={i18nT('home:components.home.HomeHeroBookLayout.otkryt_marshrut_6490dda0')}
        >
          {renderedSlideIndices.map((slideIndex) => {
            const slide = bookImages[slideIndex]
            const isCurrent = slideIndex === visibleSlide
            const isLoaded = loadedSlides.has(slideIndex)
            const isFirst = slideIndex === 0

            return (
              <View
                key={`hero-slide-${slideIndex}`}
                {...(responsiveWeb ? webDataSetProps({ homePrimarySlide: true }) : {})}
                style={[
                  styles.slideWrapper,
                  SLIDE_WRAPPER_POINTER_NONE,
                  isWeb && ({ opacity: isCurrent ? 1 : 0, zIndex: isCurrent ? 2 : 1 } as any),
                ]}
              >
                <ImageCardMedia
                  source={slide.source}
                  placeholderColor={slide.dominantColor}
                  recyclingKey={`home-hero-slide-${slideIndex}`}
                  width={responsiveWeb ? '100%' : sliderMediaWidth}
                  height={responsiveWeb ? undefined : sliderHeight}
                  borderRadius={0}
                  fit="contain"
                  blurBackground={!disableHeroSliderBlur}
                  allowCriticalWebBlur={!disableHeroSliderBlur}
                  quality={70}
                  alt={slide.alt}
                  loading={isFirst || isLoaded ? 'eager' : 'lazy'}
                  priority={isFirst ? 'high' : 'normal'}
                  showImmediately={isLoaded}
                  style={styles.slideImage}
                  onLoad={() => onMarkSlideLoaded(slideIndex)}
                />
                <View style={styles.slideOverlay} {...(responsiveWeb ? webDataSetProps({ homePrimaryOverlay: true }) : {})}>
                  <HeroWeekEyebrow styles={styles} iconColor={sliderIconColor} responsiveWeb={responsiveWeb} />
                  <View style={styles.slideCaption} {...(responsiveWeb ? webDataSetProps({ homePrimaryCaption: true }) : {})}>
                    <Text style={styles.slideTitle} {...(responsiveWeb ? webDataSetProps({ homePrimaryTitle: true }) : {})}>{slide.title}</Text>
                    <Text style={styles.slideSubtitle} {...(responsiveWeb ? webDataSetProps({ homePrimarySubtitle: true }) : {})}>{slide.subtitle}</Text>
                    <View style={styles.slideActionPill} {...(responsiveWeb ? webDataSetProps({ homePrimaryAction: true }) : {})}>
                      <Text style={styles.slideActionText}>{i18nT('home:components.home.HomeHeroBookLayout.otkryt_marshrut_6490dda0')}</Text>
                      <Feather name="arrow-up-right" size={12} color={sliderIconColor} />
                    </View>
                  </View>
                </View>
              </View>
            )
          })}

          {isWeb && (
            <>
              <View style={styles.sliderPaperInset} {...decoration} />
              <View style={styles.sliderPaperFrame} {...decoration} />
              <View style={styles.sliderTopBlur} {...decoration} />
              <View style={[styles.sliderEdgeBlur, styles.sliderEdgeBlurLeft]} {...decoration} />
              <View style={[styles.sliderEdgeBlur, styles.sliderEdgeBlurRight]} {...decoration} />
              {showSideSlider && (
                <>
                  <Animated.View
                    testID="home-hero-slider-wave-top"
                    {...decoration}
                    style={[styles.sliderPageWave, styles.sliderPageWaveTop, topWaveAnimatedStyle]}
                  />
                  <Animated.View
                    testID="home-hero-slider-wave-bottom"
                    {...decoration}
                    style={[styles.sliderPageWave, styles.sliderPageWaveBottom, bottomWaveAnimatedStyle]}
                  />
                </>
              )}
            </>
          )}

          <View
            style={styles.sliderNav}
            {...(responsiveWeb ? webDataSetProps({ homeBookSliderNav: true }) : {})}
            role="group"
            {...({ 'aria-label': i18nT('home:components.home.HomeHeroBookLayout.navigatsiya_po_slaydam_9bc3e838') } as any)}
          >
            <Pressable
              onPress={onPrevSlide}
              style={({ focused }: any) => [
                styles.sliderNavBtnHitArea,
                isWeb && focused && {
                  outlineWidth: 2,
                  outlineStyle: 'solid',
                  outlineColor: sliderIconColor,
                  outlineOffset: 2,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel={i18nT('home:components.home.HomeHeroBookLayout.predyduschiy_slayd_9dd70d5f')}
            >
              {({ hovered }: any) => (
                <View style={[styles.sliderNavBtn, hovered && styles.sliderNavBtnHover]}>
                  <Feather
                    name="chevron-left"
                    size={14}
                    color={sliderIconColor}
                    {...({ 'aria-hidden': true, focusable: false } as any)}
                  />
                </View>
              )}
            </Pressable>
            <Text
              style={[
                styles.sliderNavIndicator ?? { ...SLIDER_NAV_INDICATOR_FALLBACK, color: sliderIconColor },
              ]}
              accessibilityLabel={i18nT('home:components.home.HomeHeroBookLayout.slayd_value1_iz_value2_91fd59a1', { value1: visibleSlide + 1, value2: bookImages.length })}
              {...({ 'aria-live': 'polite', 'aria-atomic': true } as any)}
            >
              {visibleSlide + 1}/{bookImages.length}
            </Text>
            <Pressable
              onPress={onNextSlide}
              style={({ focused }: any) => [
                styles.sliderNavBtnHitArea,
                isWeb && focused && {
                  outlineWidth: 2,
                  outlineStyle: 'solid',
                  outlineColor: sliderIconColor,
                  outlineOffset: 2,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel={i18nT('home:components.home.HomeHeroBookLayout.sleduyuschiy_slayd_83547ab9')}
            >
              {({ hovered }: any) => (
                <View style={[styles.sliderNavBtn, hovered && styles.sliderNavBtnHover]}>
                  <Feather
                    name="chevron-right"
                    size={14}
                    color={sliderIconColor}
                    {...({ 'aria-hidden': true, focusable: false } as any)}
                  />
                </View>
              )}
            </Pressable>
          </View>
        </Pressable>
      </View>
    </View>
  )
}

export default function HomeHeroBookLayout({
  responsiveWeb = false,
  responsiveMoodRail,
  colors,
  styles,
  isWeb,
  isNarrowLayout,
  isTabletLayout,
  bookHeight,
  showSideSlider,
  width,
  sliderHeight,
  sliderMediaWidth,
  sliderIconColor,
  disableHeroSliderBlur,
  heroSubtitle,
  moodCards,
  heroHighlights,
  bookImages,
  currentSlide,
  renderedSlideIndices,
  visibleSlide,
  loadedSlides,
  useStackedCtas,
  topWaveAnimatedStyle,
  bottomWaveAnimatedStyle,
  onBookWrapperLayout,
  onQuickFilterPress,
  onOpenArticle,
  onOpenSearch,
  onSearchSubmit,
  isMobile,
  pendingAction,
  onPrevSlide,
  onNextSlide,
  onMarkSlideLoaded,
  onPageNotesVisibilityChange,
}: HomeHeroBookLayoutProps) {
  const withBookFrame = isWeb && (responsiveWeb || showSideSlider)
  const showChapterHeader = responsiveWeb || (showSideSlider && !isNarrowLayout)
  const pageNotesEnabled = !responsiveWeb && showSideSlider && !isNarrowLayout && bookHeight >= HOME_BOOK_PAGE_NOTES_MIN_HEIGHT
  const pageNotesFit = usePageNotesFit(pageNotesEnabled, bookHeight, `${bookHeight}:${width}:${heroSubtitle}`)
  const showPageNotes = pageNotesEnabled && pageNotesFit.fits
  // A book too low for the full notes still has room under its CTA on common
  // laptops: one compact row keeps the quick ideas on the first screen (#2773).
  const compactNotesEnabled = showSideSlider && !isNarrowLayout && !showPageNotes
  const compactNotesFit = usePageNotesFit(compactNotesEnabled, bookHeight, `${bookHeight}:${width}:${heroSubtitle}:compact`)
  const showCompactNotes = responsiveWeb || (compactNotesEnabled && compactNotesFit.fits)
  const handleFrameLayout = (e: LayoutChangeEvent) => {
    pageNotesFit.onFrameLayout(e)
    compactNotesFit.onFrameLayout(e)
  }
  const handleContentLayout = (e: LayoutChangeEvent) => {
    pageNotesFit.onContentLayout(e)
    // Content measured with the full notes in the page says nothing about the
    // compact row; it gets its own measurement once the full notes are gone.
    if (compactNotesEnabled) compactNotesFit.onContentLayout(e)
  }

  useEffect(() => {
    onPageNotesVisibilityChange?.(showPageNotes || showCompactNotes)
  }, [onPageNotesVisibilityChange, showCompactNotes, showPageNotes])
  const decoration = responsiveWeb ? webDataSetProps({ homeBookDecoration: true }) : {}

  return (
    <View style={styles.heroShell}>
      <View
        style={styles.bookWrapper}
        {...(responsiveWeb ? webDataSetProps({ homeBookWrapper: true }) : {})}
        onLayout={!responsiveWeb && showSideSlider ? onBookWrapperLayout : undefined}
      >
        {withBookFrame && <View style={styles.bookCoverOuter} {...decoration} />}

        <View style={styles.heroRow} {...(responsiveWeb ? webDataSetProps({ homeBookRow: true }) : {})}>
          {withBookFrame && <View style={styles.heroBookSpine} {...decoration} />}

          <View testID="home-hero-left-page" style={styles.heroSection} {...(responsiveWeb ? webDataSetProps({ homeBookLeft: true }) : {})}>
            {withBookFrame && <View style={styles.heroPageCurlLeft} {...decoration} />}

            <View
              testID="home-hero-left-frame"
              style={styles.leftPageFrame}
              onLayout={responsiveWeb ? undefined : handleFrameLayout}
              {...(responsiveWeb ? webDataSetProps({ homeBookFrame: true }) : {})}
            >
              <View
                style={styles.leftPageContent}
                onLayout={responsiveWeb ? undefined : handleContentLayout}
                {...(responsiveWeb ? webDataSetProps({ homeBookContent: true }) : {})}
              >
                <View>
                  {showChapterHeader && (
                    <View style={styles.chapterHeader} {...(responsiveWeb ? webDataSetProps({ homeBookChapter: true }) : {})}>
                      <Text style={styles.chapterLabel}>{i18nT('home:components.home.HomeHeroBookLayout.idei_puteshestviy_21ae7112')}</Text>
                      <View style={styles.chapterDivider} />
                    </View>
                  )}
                  <View
                    accessibilityRole="header"
                    {...(responsiveWeb ? webDataSetProps({ homeBookHeading: true }) : {})}
                    {...({ 'aria-level': 1 } as any)}
                    accessibilityLabel={i18nT('home:components.home.HomeHeroBookLayout.kuda_poehat_v_eti_vyhodnye_018894bf')}
                  >
                    <Text style={styles.title} {...(responsiveWeb ? webDataSetProps({ homeBookTitle: true }) : {})}>
                      {i18nT('home:components.home.HomeHeroBookLayout.kuda_poehat_07cb7b59')}{responsiveWeb || !isNarrowLayout ? '\n' : ' '}
                    </Text>
                    <Text style={styles.titleAccent} {...(responsiveWeb ? webDataSetProps({ homeBookTitle: true, homeBookAccent: true }) : {})}>{i18nT('home:components.home.HomeHeroBookLayout.v_eti_vyhodnye_c69482dd')}</Text>
                  </View>

                  <Text testID="home-hero-subtitle" style={styles.subtitle} {...(responsiveWeb ? webDataSetProps({ homeBookSubtitle: true }) : {})}>{heroSubtitle}</Text>

                  {showPageNotes && (
                    <HeroPageNotes
                      activeKey={pendingAction}
                      colors={colors}
                      moodCards={moodCards}
                      onQuickFilterPress={onQuickFilterPress}
                      styles={styles}
                    />
                  )}
                </View>

                {(responsiveWeb || isTabletLayout) && (
                  <ResponsiveBookPart enabled={responsiveWeb} name="homeBookTablet"><TabletFeatureGrid
                    colors={colors}
                    heroHighlights={heroHighlights}
                    styles={styles}
                  /></ResponsiveBookPart>
                )}

                <View style={styles.heroControls} {...(responsiveWeb ? webDataSetProps({ homeBookControls: true }) : {})}>
                  <HomeHeroSearchBar
                    responsiveWeb={responsiveWeb}
                    colors={colors}
                    isMobile={isMobile}
                    onSubmit={onSearchSubmit}
                    useBookPaperColors={withBookFrame}
                  />

                  <View testID="home-hero-cta-row" style={styles.buttonsContainer} {...(responsiveWeb ? webDataSetProps({ homeBookCta: true }) : {})}>
                    <Button
                      onPress={onOpenSearch}
                      label={i18nT('home:components.home.HomeHeroBookLayout.smotret_marshruty_4a0b9a63')}
                      loading={pendingAction === 'search'}
                      variant="primary"
                      size="md"
                      fullWidth={useStackedCtas}
                      icon={
                        <Feather
                          name="compass"
                          size={16}
                          color={colors.textOnPrimary}
                        />
                      }
                      style={[styles.primaryButton, styles.singleCtaButton]}
                      labelStyle={styles.primaryButtonText}
                      hoverStyle={styles.primaryButtonHover}
                      pressedStyle={styles.primaryButtonHover}
                      accessibilityLabel={i18nT('home:components.home.HomeHeroBookLayout.smotret_marshruty_4a0b9a63')}
                    />
                  </View>
                </View>

                {showCompactNotes && (
                  <ResponsiveBookPart enabled={responsiveWeb} name="homeBookNotes"><HeroPageNotes
                    activeKey={pendingAction}
                    colors={colors}
                    compact={!responsiveWeb}
                    responsiveWeb={responsiveWeb}
                    moodCards={moodCards}
                    onQuickFilterPress={onQuickFilterPress}
                    styles={styles}
                  /></ResponsiveBookPart>
                )}
              </View>
            </View>

            {(responsiveWeb || showSideSlider) && (
              <Text style={[styles.bookPageNumber, styles.bookPageNumberLeft]}
                {...(responsiveWeb ? webDataSetProps({ homeBookPageNumber: 'left', homeBookDecoration: true }) : {})}>1</Text>
            )}
          </View>

          {responsiveWeb && responsiveMoodRail}

          {!responsiveWeb && isTabletLayout && (
            <TabletFeaturedRoute
              bookImage={bookImages[0]}
              iconColor={colors.textOnDark}
              onOpenArticle={onOpenArticle}
              styles={styles}
              width={width}
            />
          )}

          {(responsiveWeb || showSideSlider) && (
            <HeroSlider
              responsiveWeb={responsiveWeb}
              bookImages={bookImages}
              currentSlide={currentSlide}
              disableHeroSliderBlur={disableHeroSliderBlur}
              isWeb={isWeb}
              loadedSlides={loadedSlides}
              onMarkSlideLoaded={onMarkSlideLoaded}
              onNextSlide={onNextSlide}
              onOpenArticle={onOpenArticle}
              onPrevSlide={onPrevSlide}
              renderedSlideIndices={renderedSlideIndices}
              showSideSlider={responsiveWeb || showSideSlider}
              sliderHeight={sliderHeight}
              sliderIconColor={sliderIconColor}
              sliderMediaWidth={sliderMediaWidth}
              styles={styles}
              topWaveAnimatedStyle={topWaveAnimatedStyle}
              bottomWaveAnimatedStyle={bottomWaveAnimatedStyle}
              visibleSlide={visibleSlide}
            />
          )}
        </View>
      </View>
    </View>
  )
}
