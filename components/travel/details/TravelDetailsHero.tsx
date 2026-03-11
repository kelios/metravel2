// E11: Refactored — state/logic extracted to useTravelHeroState hook
import React, {
  Suspense,
  useCallback,
  useState,
} from 'react'
import {
  LayoutChangeEvent,
  Platform,
  Text,
  View,
} from 'react-native'

import type { Travel } from '@/types/types'
import type { TravelSectionLink } from '@/components/travel/sectionLinks'
import type { AnchorsMap } from './TravelDetailsTypes'
import { useTravelDetailsHeroStyles } from './TravelDetailsHeroStyles'
import { withLazy } from './TravelDetailsLazy'
import { useTravelHeroState } from '@/hooks/useTravelHeroState'
const TravelHeroInteractiveSlider = withLazy(() =>
  import('./TravelHeroInteractiveSlider')
)
import { TravelHeroFavoriteToggle } from './TravelHeroFavoriteToggle'
import { TravelHeroExtras } from './TravelHeroExtras'
const QUICK_FACTS_PLACEHOLDER_STYLE = { minHeight: 72 } as const
import {
  NeutralHeroPlaceholder,
  OptimizedLCPHero,
  OVERLAY_TRANSITION_MS,
} from './TravelDetailsOptimizedLCPHero'

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
    galleryImages,
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
  } = useTravelHeroState(travel, isMobile, onFirstImageLoad, deferExtras, renderSlider)

  const shouldShowOptimizedHero = Platform.OS === 'web' && !!firstImg

  // AND-28: Fullscreen gallery state (native only)
  const [fullscreenVisible, setFullscreenVisible] = useState(false)
  const [fullscreenIndex, setFullscreenIndex] = useState(0)
  const handleImagePress = useCallback((index: number) => {
    if (Platform.OS === 'web') return
    setFullscreenIndex(index)
    setFullscreenVisible(true)
  }, [])
  const handleCloseFullscreen = useCallback(
    () => setFullscreenVisible(false),
    [],
  )

  const shouldRenderWebOptimizedHero =
    Platform.OS === 'web' && shouldShowOptimizedHero
  const sliderPreloadCount = Platform.OS === 'web' ? 0 : isMobile ? 1 : 2

  return (
    <>
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
          onLayout={
            Platform.OS === 'web'
              ? undefined
              : (e: LayoutChangeEvent) => {
                  const w = e.nativeEvent.layout.width
                  if (w && Math.abs((heroContainerWidth ?? 0) - w) > 2)
                    setHeroContainerWidth(w)
                }
          }
        >
          {!firstImg ? (
            <NeutralHeroPlaceholder height={heroHeight} />
          ) : shouldRenderWebOptimizedHero ? (
            <>
              {webHeroLoaded && sliderUpgradeAllowed ? (
                <Suspense fallback={null}>
                  <TravelHeroInteractiveSlider
                    visible
                    galleryImages={galleryImages}
                    isMobile={isMobile}
                    aspectRatio={aspectRatio as number}
                    preloadCount={0}
                    onFirstImageLoad={handleSliderImageLoad}
                    firstImagePreloaded={webHeroLoaded}
                    onImagePress={handleImagePress}
                  />
                </Suspense>
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
                    onLoad={handleWebHeroLoad}
                  />
                </View>
              )}
            </>
          ) : (
            <Suspense fallback={null}>
              <TravelHeroInteractiveSlider
                visible
                galleryImages={galleryImages}
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
              <View style={{ pointerEvents: 'auto' } as any}>
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
            <TravelHeroFavoriteToggle
              travel={travel}
              isMobile={isMobile}
            />
          )}
        </View>
      </View>

      {extrasReady ? (
        <TravelHeroExtras
          travel={travel}
          isMobile={isMobile}
          sectionLinks={sectionLinks}
          onQuickJump={onQuickJump}
        />
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
          {sectionLinks.length > 0 && (
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
