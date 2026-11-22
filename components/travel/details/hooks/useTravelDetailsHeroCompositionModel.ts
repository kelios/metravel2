import { useCallback, useState } from 'react'
import { Platform } from 'react-native'

type UseTravelDetailsHeroCompositionModelArgs = {
  firstImg: { url?: string } | null
  heroSliderImages: Array<unknown>
  isMobile: boolean
  renderSlider: boolean
  sliderUpgradeAllowed: boolean
  webHeroLoaded: boolean
}

export function useTravelDetailsHeroCompositionModel({
  firstImg,
  heroSliderImages,
  isMobile,
  renderSlider,
  sliderUpgradeAllowed,
  webHeroLoaded,
}: UseTravelDetailsHeroCompositionModelArgs) {
  const [fullscreenVisible, setFullscreenVisible] = useState(false)
  const [fullscreenIndex, setFullscreenIndex] = useState(0)

  const shouldShowOptimizedHero = Platform.OS === 'web' && !!firstImg
  const shouldRenderWebOptimizedHero = Platform.OS === 'web' && shouldShowOptimizedHero
  const hasInteractiveWebGallery = Platform.OS === 'web' && heroSliderImages.length > 1
  // Не монтируем слайдер под LCP-оверлеем, пока LCP-картинка не задекодилась
  // (`webHeroLoaded`). Иначе на первом экране два дерева одной картинки: <img data-lcp>
  // и первый слайд слайдера декодят/рисуют один кадр дважды. После декода LCP слайдер
  // монтируется с тем же (уже кэшированным) первым кадром → его onLoad снимает оверлей
  // без вспышки.
  const shouldRenderWebSlider =
    shouldRenderWebOptimizedHero &&
    hasInteractiveWebGallery &&
    renderSlider &&
    sliderUpgradeAllowed &&
    webHeroLoaded
  const sliderPreloadCount = Platform.OS === 'web' ? (isMobile ? 2 : 3) : isMobile ? 1 : 2

  const handleImagePress = useCallback(
    (index: number) => {
      // Паритет с устройством: на mobile web тап по фото открывает fullscreen,
      // как на Android/iOS. Desktop web остаётся без fullscreen (стрелки/клавиатура).
      if (Platform.OS === 'web' && !isMobile) return
      setFullscreenIndex(index)
      setFullscreenVisible(true)
    },
    [isMobile]
  )

  const handleCloseFullscreen = useCallback(() => {
    setFullscreenVisible(false)
  }, [])

  return {
    fullscreenIndex,
    fullscreenVisible,
    handleCloseFullscreen,
    handleImagePress,
    hasInteractiveWebGallery,
    shouldRenderWebOptimizedHero,
    shouldRenderWebSlider,
    sliderPreloadCount,
  }
}
