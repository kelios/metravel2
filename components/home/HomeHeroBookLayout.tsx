import { Animated, Pressable, Text, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import Button from '@/components/ui/Button'
import ImageCardMedia from '@/components/ui/ImageCardMedia'
import type { ThemedColors } from '@/hooks/useTheme'
import HomeLanguageQuickPicker from './HomeLanguageQuickPicker'
import HomeHeroSearchBar from './HomeHeroSearchBar'
import type { QuickFilterParams } from './homeHeroShared'
import { translate as i18nT } from '@/i18n'


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
}

type Styles = any

type HomeHeroBookLayoutProps = {
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
}

const SLIDE_WRAPPER_POINTER_NONE = { pointerEvents: 'none' as const }

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
}: {
  styles: Styles
  iconColor: string
}) {
  return (
    <View style={styles.slideEyebrow}>
      <Feather
        name="map-pin"
        size={11}
        color={iconColor}
        {...({ 'aria-hidden': true, focusable: false } as any)}
      />
      <Text style={styles.slideEyebrowText}>{i18nT('home:components.home.HomeHeroBookLayout.marshrut_nedeli_2ae93682')}</Text>
    </View>
  )
}

function HeroPageNotes({
  activeKey,
  colors,
  moodCards,
  onQuickFilterPress,
  styles,
}: {
  activeKey: string | null
  colors: ThemedColors
  moodCards: readonly MoodCard[]
  onQuickFilterPress: (label: string, filters?: QuickFilterParams, route?: string) => void
  styles: Styles
}) {
  return (
    <View style={styles.pageNotesGrid}>
      {moodCards.map((card) => (
        <HeroPageNote
          key={`page-note-${card.title}`}
          active={activeKey === `filter:${card.title}`}
          card={card}
          colors={colors}
          onQuickFilterPress={onQuickFilterPress}
          styles={styles}
        />
      ))}
    </View>
  )
}

function HeroPageNote({
  active,
  card,
  colors,
  onQuickFilterPress,
  styles,
}: {
  active: boolean
  card: MoodCard
  colors: ThemedColors
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
        <Text style={[styles.pageNoteText, active && styles.pageNoteTextActive]}>
          {card.title}
        </Text>
        {(active || card.meta) && (
          <Text style={[styles.pageNoteMeta, active && styles.pageNoteMetaActive]}>
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
        width={width * 0.45}
        height={340}
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
  return (
    <View style={styles.sliderSection}>
      {isWeb && <View style={styles.sliderPageGoldLine} />}
      {isWeb && <View style={styles.heroPageCurlRight} />}
      <Text style={styles.sliderPageNumber}>2</Text>

      <View testID="home-hero-slider-frame" style={styles.sliderFrame}>
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
                style={[
                  styles.slideWrapper,
                  SLIDE_WRAPPER_POINTER_NONE,
                  isWeb && ({ opacity: isCurrent ? 1 : 0, zIndex: isCurrent ? 2 : 1 } as any),
                ]}
              >
                <ImageCardMedia
                  source={slide.source}
                  recyclingKey={`home-hero-slide-${slideIndex}`}
                  width={sliderMediaWidth}
                  height={sliderHeight}
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
                <View style={styles.slideOverlay}>
                  <HeroWeekEyebrow styles={styles} iconColor={sliderIconColor} />
                  <View style={styles.slideCaption}>
                    <Text style={styles.slideTitle}>{slide.title}</Text>
                    <Text style={styles.slideSubtitle}>{slide.subtitle}</Text>
                    <View style={styles.slideActionPill}>
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
              <View style={styles.sliderPaperInset} />
              <View style={styles.sliderPaperFrame} />
              <View style={styles.sliderTopBlur} />
              <View style={[styles.sliderEdgeBlur, styles.sliderEdgeBlurLeft]} />
              <View style={[styles.sliderEdgeBlur, styles.sliderEdgeBlurRight]} />
              {showSideSlider && (
                <>
                  <Animated.View
                    testID="home-hero-slider-wave-top"
                    style={[styles.sliderPageWave, styles.sliderPageWaveTop, topWaveAnimatedStyle]}
                  />
                  <Animated.View
                    testID="home-hero-slider-wave-bottom"
                    style={[styles.sliderPageWave, styles.sliderPageWaveBottom, bottomWaveAnimatedStyle]}
                  />
                </>
              )}
            </>
          )}

          <View
            style={styles.sliderNav}
            role="group"
            {...({ 'aria-label': i18nT('home:components.home.HomeHeroBookLayout.navigatsiya_po_slaydam_9bc3e838') } as any)}
          >
            <Pressable
              onPress={onPrevSlide}
              hitSlop={isWeb ? undefined : { top: 10, bottom: 10, left: 10, right: 10 }}
              style={({ hovered, focused }: any) =>
                isWeb
                  ? [
                      styles.sliderNavBtnHitArea,
                      focused && {
                        outlineWidth: 2,
                        outlineStyle: 'solid',
                        outlineColor: sliderIconColor,
                        outlineOffset: 2,
                      },
                    ]
                  : [styles.sliderNavBtn, hovered && styles.sliderNavBtnHover]
              }
              accessibilityRole="button"
              accessibilityLabel={i18nT('home:components.home.HomeHeroBookLayout.predyduschiy_slayd_9dd70d5f')}
            >
              {isWeb
                ? (({ hovered }: any) => (
                    <View style={[styles.sliderNavBtn, hovered && styles.sliderNavBtnHover]}>
                      <Feather
                        name="chevron-left"
                        size={14}
                        color={sliderIconColor}
                        {...({ 'aria-hidden': true, focusable: false } as any)}
                      />
                    </View>
                  ))
                : (
                    <Feather
                      name="chevron-left"
                      size={14}
                      color={sliderIconColor}
                      {...({ 'aria-hidden': true, focusable: false } as any)}
                    />
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
              hitSlop={isWeb ? undefined : { top: 10, bottom: 10, left: 10, right: 10 }}
              style={({ hovered, focused }: any) =>
                isWeb
                  ? [
                      styles.sliderNavBtnHitArea,
                      focused && {
                        outlineWidth: 2,
                        outlineStyle: 'solid',
                        outlineColor: sliderIconColor,
                        outlineOffset: 2,
                      },
                    ]
                  : [styles.sliderNavBtn, hovered && styles.sliderNavBtnHover]
              }
              accessibilityRole="button"
              accessibilityLabel={i18nT('home:components.home.HomeHeroBookLayout.sleduyuschiy_slayd_83547ab9')}
            >
              {isWeb
                ? (({ hovered }: any) => (
                    <View style={[styles.sliderNavBtn, hovered && styles.sliderNavBtnHover]}>
                      <Feather
                        name="chevron-right"
                        size={14}
                        color={sliderIconColor}
                        {...({ 'aria-hidden': true, focusable: false } as any)}
                      />
                    </View>
                  ))
                : (
                    <Feather
                      name="chevron-right"
                      size={14}
                      color={sliderIconColor}
                      {...({ 'aria-hidden': true, focusable: false } as any)}
                    />
                  )}
            </Pressable>
          </View>
        </Pressable>
      </View>
    </View>
  )
}

export default function HomeHeroBookLayout({
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
}: HomeHeroBookLayoutProps) {
  const withBookFrame = isWeb && showSideSlider
  const showChapterHeader = showSideSlider && !isNarrowLayout
  const showPageNotes = showSideSlider && !isNarrowLayout && bookHeight >= 780

  return (
    <View style={styles.heroShell}>
      <View
        style={styles.bookWrapper}
        onLayout={showSideSlider ? onBookWrapperLayout : undefined}
      >
        {withBookFrame && <View style={styles.bookCoverOuter} />}

        <View style={styles.heroRow}>
          {withBookFrame && <View style={styles.heroBookSpine} />}

          <View testID="home-hero-left-page" style={styles.heroSection}>
            {withBookFrame && <View style={styles.heroPageGoldLine} />}
            {withBookFrame && <View style={styles.heroPageCurlLeft} />}

            <View testID="home-hero-left-frame" style={styles.leftPageFrame}>
              <View>
                {showChapterHeader && (
                  <View style={styles.chapterHeader}>
                    <Text style={styles.chapterLabel}>{i18nT('home:components.home.HomeHeroBookLayout.idei_puteshestviy_21ae7112')}</Text>
                    <View style={styles.chapterDivider} />
                  </View>
                )}
                <View
                  accessibilityRole="header"
                  {...({ 'aria-level': 1 } as any)}
                  accessibilityLabel={i18nT('home:components.home.HomeHeroBookLayout.kuda_poehat_v_eti_vyhodnye_018894bf')}
                >
                  <Text style={styles.title}>
                    {i18nT('home:components.home.HomeHeroBookLayout.kuda_poehat_07cb7b59')}{isNarrowLayout ? ' ' : '\n'}
                  </Text>
                  <Text style={styles.titleAccent}>{i18nT('home:components.home.HomeHeroBookLayout.v_eti_vyhodnye_c69482dd')}</Text>
                </View>

                <Text style={styles.subtitle}>{heroSubtitle}</Text>

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

              {isTabletLayout && (
                <TabletFeatureGrid
                  colors={colors}
                  heroHighlights={heroHighlights}
                  styles={styles}
                />
              )}

              <View style={styles.heroControls}>
                <HomeHeroSearchBar
                  colors={colors}
                  isMobile={isMobile}
                  onSubmit={onSearchSubmit}
                  useBookPaperColors={withBookFrame}
                />

                <HomeLanguageQuickPicker />

                <View testID="home-hero-cta-row" style={styles.buttonsContainer}>
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
            </View>

            {showSideSlider && (
              <Text style={[styles.bookPageNumber, styles.bookPageNumberLeft]}>1</Text>
            )}
          </View>

          {isTabletLayout && (
            <TabletFeaturedRoute
              bookImage={bookImages[0]}
              iconColor={colors.textOnDark}
              onOpenArticle={onOpenArticle}
              styles={styles}
              width={width}
            />
          )}

          {showSideSlider && (
            <HeroSlider
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
              showSideSlider={showSideSlider}
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
