import { useCallback, useState } from 'react'
import { Platform } from 'react-native'

import type { LayoutChangeEvent } from 'react-native'

type UseTravelDetailsHeroCompositionModelArgs = {
  firstImg: { url?: string } | null
  heroContainerWidth: number | null
  heroSliderImages: Array<unknown>
  isMobile: boolean
  renderSlider: boolean
  setHeroContainerWidth: (width: number) => void
  sliderUpgradeAllowed: boolean
  webHeroLoaded: boolean
}

export function useTravelDetailsHeroCompositionModel({
  firstImg,
  heroContainerWidth,
  heroSliderImages,
  isMobile,
  renderSlider,
  setHeroContainerWidth,
  sliderUpgradeAllowed,
  webHeroLoaded: _webHeroLoaded,
}: UseTravelDetailsHeroCompositionModelArgs) {
  const [fullscreenVisible, setFullscreenVisible] = useState(false)
  const [fullscreenIndex, setFullscreenIndex] = useState(0)

  const shouldShowOptimizedHero = Platform.OS === 'web' && !!firstImg
  const shouldRenderWebOptimizedHero = Platform.OS === 'web' && shouldShowOptimizedHero
  const hasInteractiveWebGallery = Platform.OS === 'web' && heroSliderImages.length > 1
  const shouldRenderWebSlider =
    shouldRenderWebOptimizedHero &&
    hasInteractiveWebGallery &&
    renderSlider &&
    sliderUpgradeAllowed
  const sliderPreloadCount = Platform.OS === 'web' ? 0 : isMobile ? 1 : 2

  const handleImagePress = useCallback((index: number) => {
    if (Platform.OS === 'web') return
    setFullscreenIndex(index)
    setFullscreenVisible(true)
  }, [])

  const handleCloseFullscreen = useCallback(() => {
    setFullscreenVisible(false)
  }, [])

  const handleHeroContainerLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const width = e.nativeEvent.layout.width
      if (width && Math.abs((heroContainerWidth ?? 0) - width) > 2) {
        setHeroContainerWidth(width)
      }
    },
    [heroContainerWidth, setHeroContainerWidth]
  )

  return {
    fullscreenIndex,
    fullscreenVisible,
    handleCloseFullscreen,
    handleHeroContainerLayout,
    handleImagePress,
    hasInteractiveWebGallery,
    shouldRenderWebOptimizedHero,
    shouldRenderWebSlider,
    sliderPreloadCount,
  }
}
