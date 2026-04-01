import React from 'react'
import {
  Animated,
  Pressable,
  Text,
  View,
} from 'react-native'
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
  useInlineBookmarkRail: boolean
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

export default function HomeHeroBookLayout({
  colors,
  styles,
  isWeb,
  isNarrowLayout,
  isTabletLayout,
  showSideSlider,
  useInlineBookmarkRail,
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
            <View
              testID="home-hero-left-frame"
              style={styles.leftPageFrame}
            >
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
              </View>

              {useInlineBookmarkRail && (
                <View
                  testID="home-hero-bookmark-rail"
                  style={styles.bookmarkRail}
                >
                  {moodCards.map((card) => (
                    <Pressable
                      key={`inline-${card.title}`}
                      onPress={() =>
                        onQuickFilterPress(card.title, card.filters, card.route)
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

              {isTabletLayout && (
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
                        <Text style={styles.tabletFeatureTitle}>
                          {item.title}
                        </Text>
                        <Text style={styles.tabletFeatureSubtitle}>
                          {item.subtitle}
                        </Text>
                      </View>
                    </Pressable>
                  ))}
                </View>
              )}

              <View
                testID="home-hero-cta-row"
                style={styles.buttonsContainer}
              >
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

          {isTabletLayout && (
            <Pressable
              onPress={() => onOpenArticle(bookImages[0].href)}
              style={styles.tabletHeroRight}
              accessibilityRole="link"
              accessibilityLabel={`Открыть маршрут: ${bookImages[0].title}`}
            >
              <ImageCardMedia
                source={bookImages[0].source}
                width={width * 0.45}
                height={340}
                borderRadius={0}
                fit="contain"
                blurBackground
                allowCriticalWebBlur
                quality={75}
                alt={bookImages[0].alt}
                loading="eager"
                priority="high"
                style={styles.tabletFeaturedImage}
              />
              <View style={styles.tabletFeaturedOverlay}>
                <View style={styles.slideEyebrow}>
                  <Feather
                    name="map-pin"
                    size={11}
                    color={colors.textOnDark}
                  />
                  <Text style={styles.slideEyebrowText}>Маршрут недели</Text>
                </View>
                <Text style={styles.tabletFeaturedTitle}>
                  {bookImages[0].title}
                </Text>
                <Text style={styles.tabletFeaturedSubtitle}>
                  {bookImages[0].subtitle}
                </Text>
              </View>
            </Pressable>
          )}

          {showSideSlider && (
            <View style={styles.sliderSection}>
              {isWeb && <View style={styles.sliderPageGoldLine} />}
              {isWeb && <View style={styles.heroPageCurlRight} />}
              <Text style={styles.sliderPageNumber}>2</Text>
              <View
                testID="home-hero-slider-frame"
                style={styles.sliderFrame}
              >
                <Pressable
                  onPress={() => onOpenArticle(currentSlide.href)}
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
                    const slide = bookImages[slideIndex]
                    const isCurrentVisibleSlide = slideIndex === visibleSlide
                    const isSlideLoaded = loadedSlides.has(slideIndex)

                    return (
                      <View
                        key={`hero-slide-${slideIndex}`}
                        style={[
                          styles.slideWrapper,
                          isWeb
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
                            <Text style={styles.slideTitle}>{slide.title}</Text>
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
                      <Feather
                        name="chevron-left"
                        size={14}
                        color={sliderIconColor}
                      />
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
    </View>
  )
}
