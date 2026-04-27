import React from 'react'
import { Animated, Pressable, Text, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import Button from '@/components/ui/Button'
import ImageCardMedia from '@/components/ui/ImageCardMedia'
import type { ThemedColors } from '@/hooks/useTheme'
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

type HomeHeroBookLayoutProps = {
  colors: ThemedColors
  styles: any
  isWeb: boolean
  isNarrowLayout: boolean
  isTabletLayout: boolean
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
  onBookWrapperLayout?: (e: {
    nativeEvent: { layout: { width: number } }
  }) => void
  onQuickFilterPress: (
    label: string,
    filters?: QuickFilterParams,
    route?: string,
  ) => void
  onOpenArticle: (href?: string | null) => void
  onOpenSearch: () => void
  onPrevSlide: () => void
  onNextSlide: () => void
  onMarkSlideLoaded: (slideIndex: number) => void
}

function HeroWeekEyebrow({
  colors,
  styles,
  iconColor,
}: {
  colors: ThemedColors
  styles: any
  iconColor?: string
}) {
  return (
    <View style={styles.slideEyebrow}>
      <Feather
        name="map-pin"
        size={11}
        color={iconColor ?? colors.textOnDark}
      />
      <Text style={styles.slideEyebrowText}>Маршрут недели</Text>
    </View>
  )
}

function HeroPageNotes({
  colors,
  moodCards,
  onQuickFilterPress,
  styles,
}: {
  colors: ThemedColors
  moodCards: readonly MoodCard[]
  onQuickFilterPress: (
    label: string,
    filters?: QuickFilterParams,
    route?: string,
  ) => void
  styles: any
}) {
  return (
    <View style={styles.pageNotesGrid}>
      {moodCards.map((card) => (
        <Pressable
          key={`page-note-${card.title}`}
          onPress={() =>
            onQuickFilterPress(card.title, card.filters, card.route)
          }
          style={({ pressed, hovered }) => [
            styles.pageNote,
            (pressed || hovered) && styles.pageNoteHover,
          ]}
          accessibilityRole="button"
          accessibilityLabel={`${card.title}. Подобрать идею поездки`}
        >
          <View style={styles.pageNoteIcon}>
            <Feather name={card.icon as any} size={14} color={colors.brand} />
          </View>
          <View style={styles.pageNoteTextWrap}>
            <Text style={styles.pageNoteText}>{card.title}</Text>
            {card.meta ? (
              <Text style={styles.pageNoteMeta}>{card.meta}</Text>
            ) : null}
          </View>
        </Pressable>
      ))}
    </View>
  )
}

function TabletFeatureGrid({
  colors,
  heroHighlights,
  styles,
}: {
  colors: ThemedColors
  heroHighlights: readonly HeroHighlight[]
  styles: any
}) {
  return (
    <View style={styles.tabletFeatureGrid}>
      {heroHighlights.map((item) => (
        <Pressable
          key={item.title}
          style={({ hovered }) => [
            styles.tabletFeatureCard,
            hovered && styles.tabletFeatureCardHover,
          ]}
        >
          <View style={styles.tabletFeatureIconWrap}>
            <Feather
              name={item.icon as any}
              size={16}
              color={colors.textOnPrimary}
            />
          </View>
          <View style={styles.tabletFeatureTextWrap}>
            <Text style={styles.tabletFeatureTitle}>{item.title}</Text>
            <Text style={styles.tabletFeatureSubtitle}>{item.subtitle}</Text>
          </View>
        </Pressable>
      ))}
    </View>
  )
}

function TabletFeaturedRoute({
  bookImage,
  colors,
  onOpenArticle,
  styles,
  width,
}: {
  bookImage: BookImage
  colors: ThemedColors
  onOpenArticle: (href?: string | null) => void
  styles: any
  width: number
}) {
  return (
    <Pressable
      onPress={() => onOpenArticle(bookImage.href)}
      style={styles.tabletHeroRight}
      accessibilityRole="link"
      accessibilityLabel={`Открыть маршрут: ${bookImage.title}`}
    >
      <ImageCardMedia
        source={bookImage.source}
        width={width * 0.45}
        height={340}
        borderRadius={0}
        fit="contain"
        blurBackground
        allowCriticalWebBlur
        quality={75}
        alt={bookImage.alt}
        loading="eager"
        priority="high"
        style={styles.tabletFeaturedImage}
      />
      <View style={styles.tabletFeaturedOverlay}>
        <HeroWeekEyebrow colors={colors} styles={styles} />
        <Text style={styles.tabletFeaturedTitle}>{bookImage.title}</Text>
        <Text style={styles.tabletFeaturedSubtitle}>{bookImage.subtitle}</Text>
      </View>
    </Pressable>
  )
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
}: {
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
  styles: any
  topWaveAnimatedStyle: any
  bottomWaveAnimatedStyle: any
  visibleSlide: number
}) {
  return (
    <View style={styles.sliderSection}>
      {isWeb && <View style={styles.sliderPageGoldLine} />}
      {isWeb && <View style={styles.heroPageCurlRight} />}
      <Text style={styles.sliderPageNumber}>2</Text>
      <View testID="home-hero-slider-frame" style={styles.sliderFrame}>
        <Pressable
          onPress={() => onOpenArticle(currentSlide.href)}
          testID="home-hero-slider-container"
          style={styles.sliderContainer}
          {...((isWeb ? { dataSet: { bookSlider: 'true' } } : {}) as any)}
          accessibilityRole="link"
          accessibilityLabel={`Маршрут недели: ${currentSlide.title}. ${currentSlide.subtitle}`}
          accessibilityHint="Открыть маршрут"
        >
          {renderedSlideIndices.map((slideIndex) => {
            const slide = bookImages[slideIndex]
            const isCurrentVisibleSlide = slideIndex === visibleSlide
            const isSlideLoaded = loadedSlides.has(slideIndex)

            return (
              <View
                key={`hero-slide-${slideIndex}`}
                style={[
                  styles.slideWrapper,
                  { pointerEvents: 'none' },
                  isWeb
                    ? ({
                        opacity: isCurrentVisibleSlide ? 1 : 0,
                        zIndex: isCurrentVisibleSlide ? 2 : 1,
                      } as any)
                    : null,
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
                  quality={75}
                  alt={slide.alt}
                  loading={
                    slideIndex === 0
                      ? 'eager'
                      : isSlideLoaded
                        ? 'eager'
                        : 'lazy'
                  }
                  priority={slideIndex === 0 ? 'high' : 'normal'}
                  showImmediately={isSlideLoaded}
                  style={styles.slideImage}
                  onLoad={() => onMarkSlideLoaded(slideIndex)}
                />
                <View style={styles.slideOverlay}>
                  <HeroWeekEyebrow
                    colors={{
                      ...({} as ThemedColors),
                      textOnDark: sliderIconColor,
                    }}
                    styles={styles}
                    iconColor={sliderIconColor}
                  />
                  <View style={styles.slideCaption}>
                    <Text style={styles.slideTitle}>{slide.title}</Text>
                    <Text style={styles.slideSubtitle}>{slide.subtitle}</Text>
                    <View style={styles.slideActionPill}>
                      <Text style={styles.slideActionText}>Открыть маршрут</Text>
                      <Feather
                        name="arrow-up-right"
                        size={12}
                        color={sliderIconColor}
                      />
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
            </>
          )}
          {isWeb && (
            <>
              <View style={styles.sliderTopBlur} />
              <View
                style={[styles.sliderEdgeBlur, styles.sliderEdgeBlurLeft]}
              />
              <View
                style={[styles.sliderEdgeBlur, styles.sliderEdgeBlurRight]}
              />
              {showSideSlider ? (
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
              ) : null}
            </>
          )}
          <View style={styles.sliderNav}>
            <Pressable
              onPress={onPrevSlide}
              style={({ hovered }) => [
                styles.sliderNavBtn,
                hovered && styles.sliderNavBtnHover,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Предыдущий слайд"
            >
              <Feather name="chevron-left" size={14} color={sliderIconColor} />
            </Pressable>
            <Pressable
              onPress={onNextSlide}
              style={({ hovered }) => [
                styles.sliderNavBtn,
                hovered && styles.sliderNavBtnHover,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Следующий слайд"
            >
              <Feather name="chevron-right" size={14} color={sliderIconColor} />
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
  onPrevSlide,
  onNextSlide,
  onMarkSlideLoaded,
}: HomeHeroBookLayoutProps) {
  return (
    <View style={styles.heroShell}>
      <View
        style={styles.bookWrapper}
        onLayout={showSideSlider ? onBookWrapperLayout : undefined}
      >
        {isWeb && showSideSlider && <View style={styles.bookCoverOuter} />}

        <View style={styles.heroRow}>
          {isWeb && showSideSlider && <View style={styles.heroBookSpine} />}

          <View testID="home-hero-left-page" style={styles.heroSection}>
            {isWeb && showSideSlider && (
              <View style={styles.heroPageGoldLine} />
            )}
            {isWeb && showSideSlider && (
              <View style={styles.heroPageCurlLeft} />
            )}
            <View testID="home-hero-left-frame" style={styles.leftPageFrame}>
              <View>
                {showSideSlider && !isNarrowLayout && (
                  <View style={styles.chapterHeader}>
                    <Text style={styles.chapterLabel}>Глава 01</Text>
                    <View style={styles.chapterDivider} />
                  </View>
                )}
                <View>
                  <Text style={styles.title}>
                    Куда поехать{isNarrowLayout ? ' ' : '\n'}
                  </Text>
                  <Text style={styles.titleAccent}>в эти выходные?</Text>
                </View>

                <Text style={styles.subtitle}>{heroSubtitle}</Text>

                {showSideSlider && !isNarrowLayout ? (
                  <HeroPageNotes
                    colors={colors}
                    moodCards={moodCards}
                    onQuickFilterPress={onQuickFilterPress}
                    styles={styles}
                  />
                ) : null}
              </View>

              {isTabletLayout ? (
                <TabletFeatureGrid
                  colors={colors}
                  heroHighlights={heroHighlights}
                  styles={styles}
                />
              ) : null}

              <View testID="home-hero-cta-row" style={styles.buttonsContainer}>
                <Button
                  onPress={onOpenSearch}
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

            {showSideSlider && (
              <Text style={[styles.bookPageNumber, styles.bookPageNumberLeft]}>
                1
              </Text>
            )}
          </View>

          {isTabletLayout ? (
            <TabletFeaturedRoute
              bookImage={bookImages[0]}
              colors={colors}
              onOpenArticle={onOpenArticle}
              styles={styles}
              width={width}
            />
          ) : null}

          {showSideSlider ? (
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
          ) : null}
        </View>
      </View>
    </View>
  )
}
