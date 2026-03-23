import React, { Suspense } from 'react';
import { Platform, View } from 'react-native';

type GalleryImage = Record<string, any>;

const getFullscreenGallery = () =>
  Platform.OS !== 'web'
    ? React.lazy(() => import('@/components/travel/FullscreenGallery'))
    : (() => null);

const getSliderComponent = (): React.ComponentType<any> =>
  Platform.OS === 'web'
    ? (require('@/components/travel/Slider.web').default as React.ComponentType<any>)
    : require('@/components/travel/Slider').default;

const ABSOLUTE_FILL_STYLE = { position: 'absolute', inset: 0 } as any;

const shouldShowHeroSliderArrows = (isMobile: boolean) =>
  Platform.OS === 'web' || !isMobile;
const shouldHideHeroSliderArrowsOnMobile = Platform.OS !== 'web';
const noop = () => {};

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
  fullscreenVisible = false,
  fullscreenIndex = 0,
  onCloseFullscreen,
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
  fullscreenVisible?: boolean;
  fullscreenIndex?: number;
  onCloseFullscreen?: () => void;
  skipFirstSlideImage?: boolean;
}) {
  const Slider = getSliderComponent();
  const FullscreenGallery = getFullscreenGallery();

  return (
    <>
      {visible ? (
        <View style={ABSOLUTE_FILL_STYLE} collapsable={false}>
          <Slider
            images={galleryImages}
            showArrows={shouldShowHeroSliderArrows(isMobile)}
            controlsVisible={controlsVisible}
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
            skipFirstSlideImage={skipFirstSlideImage}
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
            onClose={onCloseFullscreen ?? noop}
          />
        </Suspense>
      ) : null}
    </>
  );
}
