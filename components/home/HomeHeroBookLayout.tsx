import React from 'react'
import { Animated, Pressable, Text, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import Button from '@/components/ui/Button'
import ImageCardMedia from '@/components/ui/ImageCardMedia'
import type { ThemedColors } from '@/hooks/useTheme'
import HomeHeroSearchBar from './HomeHeroSearchBar'
import type { QuickFilterParams } from './homeHeroShared'

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
      <Text style={styles.slideEyebrowText}>Маршрут недели</Text>
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
      accessibilityLabel={`${card.title}. Подобрать идею поездки`}
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
            {active ? 'Открываем...' : card.meta}
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
      accessibilityLabel={`Открыть маршрут: ${bookImage.title}. ${bookImage.subtitle}`}
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
          accessibilityLabel={`Маршрут недели: ${currentSlide.title}. ${currentSlide.subtitle}`}
          accessibilityHint="Открыть маршрут"
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
                      <Text style={styles.slideActionText}>Открыть маршрут</Text>
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
            accessibilityRole="group"
            {...({ 'aria-label': 'Навигация по слайдам' } as any)}
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
              accessibilityLabel="Предыдущий слайд"
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
              accessibilityLabel={`Слайд ${visibleSlide + 1} из ${bookImages.length}`}
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
              accessibilityLabel="Следующий слайд"
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
                    <Text style={styles.chapterLabel}>Идеи путешествий</Text>
                    <View style={styles.chapterDivider} />
                  </View>
                )}
                <View
                  accessibilityRole="header"
                  {...({ 'aria-level': 1 } as any)}
                  accessibilityLabel="Куда поехать в эти выходные?"
                >
                  <Text style={styles.title}>
                    Куда поехать{isNarrowLayout ? ' ' : '\n'}
                  </Text>
                  <Text style={styles.titleAccent}>в эти выходные?</Text>
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
                />

                <View testID="home-hero-cta-row" style={styles.buttonsContainer}>
                  <Button
                    onPress={onOpenSearch}
                    label="Смотреть маршруты"
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
                    accessibilityLabel="Смотреть маршруты"
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
