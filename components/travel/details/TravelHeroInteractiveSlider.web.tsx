import { View } from 'react-native';

import FullscreenGallery from '@/components/travel/FullscreenGallery';
import Slider from '@/components/travel/Slider.web';

type GalleryImage = Record<string, any>;

const noop = () => {};

const ABSOLUTE_FILL_STYLE = {
  position: 'absolute',
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
} as any;

export default function TravelHeroInteractiveSlider({
  galleryImages,
  isMobile,
  aspectRatio,
  preloadCount,
  controlsVisible = true,
  firstImagePreloaded,
  onFirstImageLoad,
  onImagePress,
  visible = true,
  skipFirstSlideImage = false,
  fullscreenVisible = false,
  fullscreenIndex = 0,
  onCloseFullscreen,
}: {
  galleryImages: GalleryImage[];
  isMobile: boolean;
  aspectRatio: number;
  preloadCount: number;
  controlsVisible?: boolean;
  firstImagePreloaded: boolean;
  onFirstImageLoad: () => void;
  onImagePress: (index: number) => void;
  visible?: boolean;
  skipFirstSlideImage?: boolean;
  fullscreenVisible?: boolean;
  fullscreenIndex?: number;
  onCloseFullscreen?: () => void;
}) {
  if (!visible) return null;

  return (
    <>
    <View style={ABSOLUTE_FILL_STYLE} collapsable={false}>
      <Slider
        images={galleryImages as any}
        showArrows
        controlsVisible={controlsVisible}
        // Паритет с устройством: на mobile навигация — свайп + точки, стрелки только desktop.
        hideArrowsOnMobile
        showDots={isMobile}
        autoPlay={false}
        preloadCount={preloadCount}
        blurBackground
        aspectRatio={aspectRatio}
        contentAspectRatio={aspectRatio}
        fillContainer
        fit="contain"
        onFirstImageLoad={onFirstImageLoad}
        firstImagePreloaded={firstImagePreloaded}
        onImagePress={onImagePress}
        skipFirstSlideImage={skipFirstSlideImage}
      />
    </View>
    {/* Паритет с устройством: fullscreen-просмотр по тапу на фото (mobile web). */}
    <FullscreenGallery
      visible={fullscreenVisible}
      images={galleryImages
        .filter((img) => !!img.url)
        .map((img) => ({
          url: img.url!,
          caption: typeof img.caption === 'string' ? img.caption : '',
          alt: typeof img.caption === 'string' && img.caption.trim()
            ? img.caption.trim()
            : undefined,
        }))}
      initialIndex={fullscreenIndex}
      onClose={onCloseFullscreen ?? noop}
    />
    </>
  );
}
