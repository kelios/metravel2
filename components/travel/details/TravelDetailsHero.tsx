import React, { Suspense, useMemo } from 'react'
import { Platform, View } from 'react-native'

import type { Travel } from '@/types/types'
import type { TravelSectionLink } from '@/components/travel/sectionLinks'
import { findGalleryMediaImage } from '@/utils/travelMediaVariants'
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
import { TravelHeroFavoriteToggle } from './TravelHeroFavoriteToggle'
import TravelHeroExtras from './TravelHeroExtras'
import TravelHeroInteractiveSlider from './TravelHeroInteractiveSlider'

const FavoriteToggleLazy = React.lazy(() =>
  Promise.resolve(import('./TravelHeroFavoriteToggle')).then((m) => ({
    default: m.TravelHeroFavoriteToggle ?? m.default,
  })),
)
const ExtrasLazy = React.lazy(() =>
  Promise.resolve(import('./TravelHeroExtras')).then((m) => ({
    default: m.TravelHeroExtras ?? m.default,
  })),
)
const InteractiveSliderLazy = React.lazy(() =>
  import('./TravelHeroInteractiveSlider'),
)
const FavoriteToggleComponent = Platform.OS === 'web' ? FavoriteToggleLazy : TravelHeroFavoriteToggle
const ExtrasComponent = Platform.OS === 'web' ? ExtrasLazy : TravelHeroExtras
const InteractiveSliderComponent = Platform.OS === 'web' ? InteractiveSliderLazy : TravelHeroInteractiveSlider

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
  activeKey?: string
  suppressQuickJumps?: boolean
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
  activeKey,
  suppressQuickJumps = false,
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
  const willRenderQuickJumps = !suppressQuickJumps && showQuickJumps && quickJumpLinks.length > 0
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
        // pointerEvents всегда 'auto': под-оверлейный слайдер должен принимать
        // touch/свайп даже до снятия оверлея (оверлей сверху сам pointerEvents:'none').
        // Без этого pointer-events:none на дереве слайдера убивает свайп пальцем.
        pointerEvents: 'auto' as const,
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
      activeKey={activeKey}
      suppressQuickJumps={suppressQuickJumps}
    />
  }

  return (
    <>
      <View
        testID="travel-details-hero"
        ref={anchors.gallery}
        accessibilityRole="none"
        accessibilityLabel="Геройский блок с изображением и кнопкой «Хочу поехать»"
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
                    <InteractiveSliderComponent
                      visible
                      galleryImages={heroSliderImages}
                      isMobile={isMobile}
                      aspectRatio={aspectRatio as number}
                      preloadCount={sliderPreloadCount}
                      controlsVisible
                      onFirstImageLoad={handleSliderImageLoad}
                      firstImagePreloaded={webHeroLoaded}
                      onImagePress={handleImagePress}
                      fullscreenVisible={fullscreenVisible}
                      fullscreenIndex={fullscreenIndex}
                      onCloseFullscreen={handleCloseFullscreen}
                    />
                  </Suspense>
                </View>
              )}
              {!overlayUnmounted && (
                <View style={lcpOverlayStyle} collapsable={false} {...(lcpOverlayWebProps || {})}>
                  <OptimizedLCPHero
                    img={firstImg}
                    alt={heroAlt}
                    caption={typeof firstImg.caption === 'string' ? firstImg.caption : undefined}
                    height={heroHeight}
                    isMobile={isMobile}
                    containerWidth={heroContainerWidth}
                    media={findGalleryMediaImage(travel.media, firstImg.id)}
                    onLoad={handleWebHeroLoad}
                  />
                </View>
              )}
            </>
          ) : (
            <Suspense fallback={null}>
              <InteractiveSliderComponent
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

          {showFavoriteToggle && (
            <Suspense fallback={null}>
              <FavoriteToggleComponent travel={travel} isMobile={isMobile} />
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
        activeKey={activeKey}
        suppressQuickJumps={suppressQuickJumps}
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
  activeKey?: string
  suppressQuickJumps?: boolean
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
  activeKey,
  suppressQuickJumps,
}: ExtrasSlotProps) {
  const skeleton = (
    <>
      <View
        testID="travel-details-quick-facts"
        role="group"
        aria-label="Краткие факты"
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
      <ExtrasComponent
        travel={travel}
        isMobile={isMobile}
        sectionLinks={sectionLinks}
        onQuickJump={onQuickJump}
        activeKey={activeKey}
        suppressQuickJumps={suppressQuickJumps}
      />
    </Suspense>
  )
}

export const TravelHeroSection = React.memo(TravelHeroSectionInner)
export { OptimizedLCPHero }
export const __testables = { OptimizedLCPHero, TravelHeroSection }
