// E11: Refactored — state/logic extracted to useTravelHeroState hook
import React, {
  Suspense,
} from 'react'
import {
  Platform,
  Text,
  View,
} from 'react-native'

import type { Travel } from '@/types/types'
import type { TravelSectionLink } from '@/components/travel/sectionLinks'
import type { AnchorsMap } from './TravelDetailsTypes'
import { useTravelDetailsHeroStyles } from './TravelDetailsHeroStyles'
import { useTravelHeroState } from '@/hooks/useTravelHeroState'
import { useTravelDetailsHeroCompositionModel } from './hooks/useTravelDetailsHeroCompositionModel'
import {
  OptimizedLCPHero,
  OVERLAY_TRANSITION_MS,
} from './TravelDetailsOptimizedLCPHero'

const QUICK_FACTS_PLACEHOLDER_STYLE = { minHeight: 72 } as const
const TravelHeroFavoriteToggleLazy = React.lazy(() =>
  import('./TravelHeroFavoriteToggle').then((m) => ({
    default: m.TravelHeroFavoriteToggle ?? m.default,
  })),
)
const TravelHeroExtrasLazy = React.lazy(() =>
  import('./TravelHeroExtras').then((m) => ({
    default: m.TravelHeroExtras ?? m.default,
  })),
)
const TravelHeroInteractiveSliderLazy = React.lazy(() =>
  import('./TravelHeroInteractiveSlider'),
)

/* ---- TravelHeroSectionInner ---- */
function TravelHeroSectionInner({
  travel,
  anchors,
  isMobile,
  renderSlider = true,
  onFirstImageLoad,
  sectionLinks,
  onQuickJump,
  deferExtras = false,
}: {
  travel: Travel
  anchors: AnchorsMap
  isMobile: boolean
  renderSlider?: boolean
  onFirstImageLoad: () => void
  sectionLinks: TravelSectionLink[]
  onQuickJump: (key: string) => void
  deferExtras?: boolean
}) {
  const styles = useTravelDetailsHeroStyles()

  const {
    firstImg,
    heroHeight,
    heroSliderImages,
    heroAlt,
    aspectRatio,
    setHeroContainerWidth,
    heroContainerWidth,
    webHeroLoaded,
    overlayUnmounted,
    isOverlayFading,
    handleWebHeroLoad,
    handleSliderImageLoad,
    extrasReady,
    sliderUpgradeAllowed,
  } = useTravelHeroState(travel, isMobile, onFirstImageLoad, deferExtras)

  const {
    fullscreenIndex,
    fullscreenVisible,
    handleCloseFullscreen,
    handleHeroContainerLayout,
    handleImagePress,
    shouldRenderWebOptimizedHero,
    shouldRenderWebSlider,
    sliderPreloadCount,
  } = useTravelDetailsHeroCompositionModel({
    firstImg,
    heroContainerWidth,
    heroSliderImages,
    isMobile,
    renderSlider,
    setHeroContainerWidth,
    sliderUpgradeAllowed,
    webHeroLoaded,
  })

  return (
    <>
      {firstImg ? (
        <View
          testID="travel-details-hero"
          ref={anchors.gallery}
          accessibilityRole="none"
          accessibilityLabel="Геройский блок с изображением, заголовком и кнопкой избранного"
          {...(Platform.OS === 'web' ? { 'data-section-key': 'gallery' } : {})}
          style={[
            styles.sectionContainer,
            styles.contentStable,
            { marginBottom: 0 },
          ]}
        >
          <View
            testID="travel-details-hero-slider-container"
            style={[
              styles.sliderContainer,
              { height: heroHeight },
              Platform.OS === 'web' && ({ overflow: 'hidden' } as any),
            ]}
            collapsable={false}
            onLayout={handleHeroContainerLayout}
          >
            {shouldRenderWebOptimizedHero ? (
            <>
              {shouldRenderWebSlider ? (
                <View
                  style={[
                    { position: 'absolute', inset: 0 } as any,
                    {
                      opacity: overlayUnmounted ? 1 : 0,
                      pointerEvents: overlayUnmounted ? 'auto' : 'none',
                      transition: `opacity ${OVERLAY_TRANSITION_MS}ms ease`,
                    },
                  ]}
                  collapsable={false}
                >
                  <Suspense fallback={null}>
                    <TravelHeroInteractiveSliderLazy
                      visible
                      galleryImages={heroSliderImages}
                      isMobile={isMobile}
                      aspectRatio={aspectRatio as number}
                      preloadCount={1}
                      controlsVisible
                      onFirstImageLoad={handleSliderImageLoad}
                      firstImagePreloaded={webHeroLoaded}
                      onImagePress={handleImagePress}
                      skipFirstSlideImage={!overlayUnmounted}
                    />
                  </Suspense>
                </View>
              ) : null}
              {!overlayUnmounted && (
                <View
                  style={[
                    { position: 'absolute', inset: 0 } as any,
                    {
                      zIndex: 5,
                      opacity: isOverlayFading ? 0 : 1,
                      transition: `opacity ${OVERLAY_TRANSITION_MS}ms ease`,
                      pointerEvents: 'none',
                    },
                  ]}
                  collapsable={false}
                >
                  <OptimizedLCPHero
                    img={{
                      url: firstImg.url,
                      width: firstImg.width,
                      height: firstImg.height,
                      updated_at: firstImg.updated_at,
                      id: firstImg.id,
                    }}
                    alt={heroAlt}
                    height={heroHeight}
                    isMobile={isMobile}
                    containerWidth={heroContainerWidth}
                    onLoad={handleWebHeroLoad}
                  />
                </View>
              )}
            </>
            ) : (
              <Suspense fallback={null}>
                <TravelHeroInteractiveSliderLazy
                  visible
                  galleryImages={heroSliderImages}
                  isMobile={isMobile}
                  aspectRatio={aspectRatio as number}
                  preloadCount={sliderPreloadCount}
                  onFirstImageLoad={onFirstImageLoad}
                  firstImagePreloaded={renderSlider && Platform.OS === 'web'}
                  onImagePress={handleImagePress}
                  fullscreenVisible={fullscreenVisible}
                  fullscreenIndex={fullscreenIndex}
                  onCloseFullscreen={handleCloseFullscreen}
                />
              </Suspense>
            )}

            {travel?.name ? (
              <View style={[styles.heroOverlay, { pointerEvents: 'none' }]}>
                <View style={[styles.heroTitleWrap, { pointerEvents: 'auto' } as any]}>
                  <Text
                    style={styles.heroTitle}
                    numberOfLines={2}
                    accessibilityRole="header"
                  >
                    {travel.name}
                  </Text>
                </View>
              </View>
            ) : null}

            {(Platform.OS !== 'web' || extrasReady) && (
              <Suspense fallback={null}>
                <TravelHeroFavoriteToggleLazy
                  travel={travel}
                  isMobile={isMobile}
                />
              </Suspense>
            )}
          </View>
        </View>
      ) : null}

      {extrasReady ? (
        <Suspense fallback={null}>
          <TravelHeroExtrasLazy
            travel={travel}
            isMobile={isMobile}
            sectionLinks={sectionLinks}
            onQuickJump={onQuickJump}
          />
        </Suspense>
      ) : (
        <>
          <View
            testID="travel-details-quick-facts"
            accessibilityRole="none"
            accessibilityLabel="Краткие факты"
            style={[
              styles.sectionContainer,
              styles.contentStable,
              styles.quickFactsContainer,
            ]}
          >
            <View style={QUICK_FACTS_PLACEHOLDER_STYLE} />
          </View>
          {Platform.OS !== 'web' && sectionLinks.length > 0 && (
            <View
              style={[
                styles.sectionContainer,
                styles.contentStable,
                styles.quickJumpWrapper,
                { minHeight: 48 },
              ]}
            />
          )}
        </>
      )}
    </>
  )
}

export const TravelHeroSection = React.memo(
  TravelHeroSectionInner as React.FC<any>,
)
export { OptimizedLCPHero }
export const __testables = { OptimizedLCPHero, TravelHeroSection }
