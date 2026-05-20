import React, { Suspense, useMemo } from 'react'
import { Platform, View } from 'react-native'

import type { Travel } from '@/types/types'
import type { TravelSectionLink } from '@/components/travel/sectionLinks'
import {
  QuickFactsSkeleton,
  QuickJumpSkeleton,
} from '@/components/travel/TravelDetailSkeletons'
import type { AnchorsMap } from './TravelDetailsTypes'
import { useTravelDetailsHeroStyles } from './TravelDetailsHeroStyles'
import { useTravelHeroState } from '@/hooks/useTravelHeroState'
import { useTravelDetailsHeroCompositionModel } from './hooks/useTravelDetailsHeroCompositionModel'
import { useTravelHeroExtrasModel } from './hooks/useTravelHeroExtrasModel'
import {
  OptimizedLCPHero,
  OVERLAY_TRANSITION_MS,
} from './TravelDetailsOptimizedLCPHero'

const FavoriteToggleLazy = React.lazy(() =>
  import('./TravelHeroFavoriteToggle').then((m) => ({
    default: m.TravelHeroFavoriteToggle ?? m.default,
  })),
)
const ExtrasLazy = React.lazy(() =>
  import('./TravelHeroExtras').then((m) => ({
    default: m.TravelHeroExtras ?? m.default,
  })),
)
const InteractiveSliderLazy = React.lazy(() =>
  import('./TravelHeroInteractiveSlider'),
)

const ABSOLUTE_FILL = {
  position: 'absolute',
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
} as const

type Props = {
  travel: Travel
  anchors: AnchorsMap
  isMobile: boolean
  renderSlider?: boolean
  onFirstImageLoad: () => void
  sectionLinks: TravelSectionLink[]
  onQuickJump: (key: string) => void
  deferExtras?: boolean
}

function TravelHeroSectionInner({
  travel,
  anchors,
  isMobile,
  renderSlider = true,
  onFirstImageLoad,
  sectionLinks,
  onQuickJump,
  deferExtras = false,
}: Props) {
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
    shouldRenderWebOptimizedHero: useLcpOverlayFlow,
    shouldRenderWebSlider: mountSliderUnderOverlay,
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

  const { quickJumpLinks, showQuickJumps } = useTravelHeroExtrasModel(sectionLinks)
  const willRenderQuickJumps = showQuickJumps && quickJumpLinks.length > 0
  const showFavoriteToggle = !deferExtras && (!(Platform.OS === 'web') || extrasReady)

  const heroContainerStyle = useMemo(
    () => [
      styles.sliderContainer,
      { height: heroHeight },
      Platform.OS === 'web' ? ({ overflow: 'hidden' } as const) : null,
    ],
    [styles.sliderContainer, heroHeight],
  )

  const isWeb = Platform.OS === 'web'

  const sliderUnderOverlayStyle = useMemo(
    () => [
      ABSOLUTE_FILL,
      {
        opacity: overlayUnmounted ? 1 : 0,
        pointerEvents: (overlayUnmounted ? 'auto' : 'none') as 'auto' | 'none',
        ...(isWeb ? null : { transition: `opacity ${OVERLAY_TRANSITION_MS}ms ease` }),
      },
    ],
    [overlayUnmounted, isWeb],
  )

  const lcpOverlayStyle = useMemo(
    () => [
      ABSOLUTE_FILL,
      {
        zIndex: 5,
        opacity: isOverlayFading ? 0 : 1,
        pointerEvents: 'none' as const,
        ...(isWeb ? null : { transition: `opacity ${OVERLAY_TRANSITION_MS}ms ease` }),
      },
    ],
    [isOverlayFading, isWeb],
  )

  const sliderUnderOverlayWebProps = useMemo(
    () => (isWeb ? ({ dataSet: { travelHeroSliderUnder: 'true' } } as any) : null),
    [isWeb],
  )
  const lcpOverlayWebProps = useMemo(
    () => (isWeb ? ({ dataSet: { travelHeroOverlay: 'true' } } as any) : null),
    [isWeb],
  )

  const sectionAndStable = useMemo(
    () => [styles.sectionContainer, styles.contentStable, { marginBottom: 0 }],
    [styles.sectionContainer, styles.contentStable],
  )

  if (!firstImg) {
    return <ExtrasSlot
      styles={styles}
      extrasReady={extrasReady}
      willRenderQuickJumps={willRenderQuickJumps}
      quickJumpChipCount={quickJumpLinks.length}
      travel={travel}
      isMobile={isMobile}
      sectionLinks={sectionLinks}
      onQuickJump={onQuickJump}
    />
  }

  return (
    <>
      <View
        testID="travel-details-hero"
        ref={anchors.gallery}
        accessibilityRole="none"
        accessibilityLabel="Геройский блок с изображением и кнопкой избранного"
        {...(Platform.OS === 'web' ? { 'data-section-key': 'gallery' } : null)}
        style={sectionAndStable}
      >
        <View
          testID="travel-details-hero-slider-container"
          style={heroContainerStyle}
          collapsable={false}
          onLayout={handleHeroContainerLayout}
        >
          {useLcpOverlayFlow ? (
            <>
              {mountSliderUnderOverlay && (
                <View style={sliderUnderOverlayStyle} collapsable={false} {...(sliderUnderOverlayWebProps || {})}>
                  <Suspense fallback={null}>
                    <InteractiveSliderLazy
                      visible
                      galleryImages={heroSliderImages}
                      isMobile={isMobile}
                      aspectRatio={aspectRatio as number}
                      preloadCount={sliderPreloadCount}
                      controlsVisible
                      onFirstImageLoad={handleSliderImageLoad}
                      firstImagePreloaded={webHeroLoaded}
                      onImagePress={handleImagePress}
                    />
                  </Suspense>
                </View>
              )}
              {!overlayUnmounted && (
                <View style={lcpOverlayStyle} collapsable={false} {...(lcpOverlayWebProps || {})}>
                  <OptimizedLCPHero
                    img={firstImg}
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
              <InteractiveSliderLazy
                visible
                galleryImages={heroSliderImages}
                isMobile={isMobile}
                aspectRatio={aspectRatio as number}
                preloadCount={sliderPreloadCount}
                onFirstImageLoad={onFirstImageLoad}
                firstImagePreloaded={renderSlider && (Platform.OS === 'web')}
                onImagePress={handleImagePress}
                fullscreenVisible={fullscreenVisible}
                fullscreenIndex={fullscreenIndex}
                onCloseFullscreen={handleCloseFullscreen}
              />
            </Suspense>
          )}

          {Platform.OS === 'web' && (
            <>
              <View style={styles.heroSketchOverlay} />
              <View style={styles.heroPhotoTapeLeft} />
              <View style={styles.heroPhotoTapeRight} />
            </>
          )}

          {showFavoriteToggle && (
            <Suspense fallback={null}>
              <FavoriteToggleLazy travel={travel} isMobile={isMobile} />
            </Suspense>
          )}
        </View>
      </View>

      <ExtrasSlot
        styles={styles}
        extrasReady={extrasReady}
        willRenderQuickJumps={willRenderQuickJumps}
        quickJumpChipCount={quickJumpLinks.length}
        travel={travel}
        isMobile={isMobile}
        sectionLinks={sectionLinks}
        onQuickJump={onQuickJump}
      />
    </>
  )
}

type ExtrasSlotProps = {
  styles: ReturnType<typeof useTravelDetailsHeroStyles>
  extrasReady: boolean
  willRenderQuickJumps: boolean
  quickJumpChipCount: number
  travel: Travel
  isMobile: boolean
  sectionLinks: TravelSectionLink[]
  onQuickJump: (key: string) => void
}

function ExtrasSlot({
  styles,
  extrasReady,
  willRenderQuickJumps,
  quickJumpChipCount,
  travel,
  isMobile,
  sectionLinks,
  onQuickJump,
}: ExtrasSlotProps) {
  const skeleton = (
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
        <QuickFactsSkeleton />
      </View>
      {willRenderQuickJumps && (
        <View
          style={[
            styles.sectionContainer,
            styles.contentStable,
            styles.quickJumpWrapper,
          ]}
        >
          <QuickJumpSkeleton chipCount={quickJumpChipCount} />
        </View>
      )}
    </>
  )

  if (!extrasReady) return skeleton

  return (
    <Suspense fallback={skeleton}>
      <ExtrasLazy
        travel={travel}
        isMobile={isMobile}
        sectionLinks={sectionLinks}
        onQuickJump={onQuickJump}
      />
    </Suspense>
  )
}

export const TravelHeroSection = React.memo(TravelHeroSectionInner)
export { OptimizedLCPHero }
export const __testables = { OptimizedLCPHero, TravelHeroSection }
