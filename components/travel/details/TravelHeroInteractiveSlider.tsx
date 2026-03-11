import React, { Suspense } from 'react';
import { Platform, View } from 'react-native';

import { withLazy } from './TravelDetailsLazy';

type GalleryImage = Record<string, any>;

const FullscreenGallery =
  Platform.OS !== 'web'
    ? React.lazy(() => import('@/components/travel/FullscreenGallery'))
    : () => null;

const Slider: React.FC<any> = withLazy(
  () =>
    Platform.OS === 'web'
      ? import('@/components/travel/Slider.web')
      : import('@/components/travel/Slider'),
);

const ABSOLUTE_FILL_STYLE = { position: 'absolute', inset: 0 } as any;

const shouldShowHeroSliderArrows = (isMobile: boolean) =>
  Platform.OS === 'web' || !isMobile;
const shouldHideHeroSliderArrowsOnMobile = Platform.OS !== 'web';

export default function TravelHeroInteractiveSlider({
  galleryImages,
  isMobile,
  aspectRatio,
  preloadCount,
  firstImagePreloaded,
  onFirstImageLoad,
  onImagePress,
  visible = true,
  fullscreenVisible = false,
  fullscreenIndex = 0,
  onCloseFullscreen,
}: {
  galleryImages: GalleryImage[];
  isMobile: boolean;
  aspectRatio: number;
  preloadCount: number;
  firstImagePreloaded: boolean;
  onFirstImageLoad: () => void;
  onImagePress: (index: number) => void;
  visible?: boolean;
  fullscreenVisible?: boolean;
  fullscreenIndex?: number;
  onCloseFullscreen?: () => void;
}) {
  return (
    <>
      {visible ? (
        <View style={ABSOLUTE_FILL_STYLE} collapsable={false}>
          <Slider
            images={galleryImages}
            showArrows={shouldShowHeroSliderArrows(isMobile)}
            hideArrowsOnMobile={shouldHideHeroSliderArrowsOnMobile}
            showDots={isMobile}
            autoPlay={false}
            preloadCount={preloadCount}
            blurBackground
            aspectRatio={aspectRatio}
            fillContainer
            fit="contain"
            onFirstImageLoad={onFirstImageLoad}
            firstImagePreloaded={firstImagePreloaded}
            onImagePress={onImagePress}
          />
        </View>
      ) : null}

      {Platform.OS !== 'web' && galleryImages.length > 0 ? (
        <Suspense fallback={null}>
          <FullscreenGallery
            visible={fullscreenVisible}
            images={galleryImages
              .filter((img) => !!img.url)
              .map((img) => ({ url: img.url! }))}
            initialIndex={fullscreenIndex}
            onClose={onCloseFullscreen}
          />
        </Suspense>
      ) : null}
    </>
  );
}
