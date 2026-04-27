import React from 'react';
import { View } from 'react-native';

import Slider from '@/components/travel/Slider.web';

type GalleryImage = Record<string, any>;

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
    <View style={ABSOLUTE_FILL_STYLE} collapsable={false}>
      <Slider
        images={galleryImages as any}
        showArrows
        controlsVisible={controlsVisible}
        hideArrowsOnMobile={false}
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
  );
}
