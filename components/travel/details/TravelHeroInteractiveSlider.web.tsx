import React from 'react';
import { View } from 'react-native';

import Slider from '@/components/travel/Slider.web';

type GalleryImage = Record<string, any>;

const ABSOLUTE_FILL_STYLE = { position: 'absolute', inset: 0 } as any;

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
}) {
  if (!visible) return null;

  return (
    <View style={ABSOLUTE_FILL_STYLE} collapsable={false}>
      <Slider
        images={galleryImages}
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
