import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Platform, TouchableOpacity, View } from 'react-native';
import ImageCardMedia from '@/components/ui/ImageCardMedia';
import { ShimmerOverlay } from '@/components/ui/ShimmerOverlay';
import type { SliderImage, LoadStatus } from './types';

interface SlideProps {
  item: SliderImage;
  index: number;
  uri: string;
  containerW: number;
  slideHeight: number | string;
  imagesLength: number;
  styles: Record<string, any>;
  blurBackground: boolean;
  imageProps?: any;
  onFirstImageLoad?: () => void;
  onSlideLoad?: (index: number) => void;
  onImagePress?: (index: number) => void;
  /** When true, skip the loading shimmer (image already in browser cache). */
  firstImagePreloaded?: boolean;
  /** When true, this slide should preload eagerly on web (near current index). */
  preloadPriority?: boolean;
  /** Image fit mode. Defaults to 'contain'. */
  fit?: 'cover' | 'contain';
}

const Slide = memo(function Slide({
  item,
  index,
  uri,
  containerW,
  slideHeight,
  imagesLength,
  styles,
  blurBackground,
  imageProps,
  onFirstImageLoad,
  onSlideLoad,
  onImagePress,
  firstImagePreloaded,
  preloadPriority,
  fit = 'contain',
}: SlideProps) {
  const [status, setStatus] = useState<LoadStatus>(
    index === 0 && firstImagePreloaded ? 'loaded' : 'loading',
  );
  const firstLoadReportedRef = useRef(false);

  const isFirstSlide = index === 0;
  const shouldEagerLoad = isFirstSlide || !!preloadPriority;
  const mainPriority = shouldEagerLoad ? 'high' : 'low';

  const mainFit: 'cover' | 'contain' = fit;

  useEffect(() => {
    firstLoadReportedRef.current = false;
    setStatus(index === 0 && firstImagePreloaded ? 'loaded' : 'loading');
  }, [uri, index, firstImagePreloaded]);

  const handleLoadStart = useCallback(() => {
    setStatus((prev) => (prev === 'loaded' ? prev : 'loading'));
  }, []);

  const handleLoad = useCallback(() => {
    setStatus('loaded');
    onSlideLoad?.(index);
    if (isFirstSlide && !firstLoadReportedRef.current) {
      firstLoadReportedRef.current = true;
      onFirstImageLoad?.();
    }
  }, [index, isFirstSlide, onFirstImageLoad, onSlideLoad]);

  useEffect(() => {
    // If first slide is already preloaded/cached, report readiness once on mount.
    if (!isFirstSlide) return;
    if (!firstImagePreloaded) return;
    if (firstLoadReportedRef.current) return;
    onSlideLoad?.(index);
    firstLoadReportedRef.current = true;
    onFirstImageLoad?.();
  }, [index, isFirstSlide, firstImagePreloaded, onFirstImageLoad, onSlideLoad]);

  const handleError = useCallback(() => {
    setStatus('error');
  }, []);

  const handlePress = useCallback(() => {
    onImagePress?.(index);
  }, [onImagePress, index]);

  const slideContent = (
    <View style={[styles.slide, { width: containerW, height: slideHeight }]}>
      {/* Flat background while loading */}
      {status !== 'loaded' && status !== 'error' && (
        <View style={styles.flatBackground} testID={`slider-flat-bg-${index}`} />
      )}

      {/* Main image with integrated blur background */}
      {status === 'error' ? (
        <View
          style={styles.neutralPlaceholder}
          testID={`slider-neutral-placeholder-${index}`}
        />
      ) : (
        <ImageCardMedia
          src={uri}
          fit={mainFit}
          blurBackground={blurBackground}
          blurRadius={12}
          priority={mainPriority as any}
          loading={
            Platform.OS === 'web'
              ? shouldEagerLoad
                ? 'eager'
                : 'lazy'
              : 'lazy'
          }
          transition={0}
          style={styles.img}
          alt={
            item.width && item.height
              ? `Изображение ${index + 1} из ${imagesLength}`
              : `Фотография путешествия ${index + 1} из ${imagesLength}`
          }
          imageProps={{
            ...(imageProps || {}),
            contentPosition: 'center',
            testID: `slider-image-${index}`,
            accessibilityIgnoresInvertColors: true,
            accessibilityRole: 'image',
            accessibilityLabel:
              item.width && item.height
                ? `Изображение ${index + 1} из ${imagesLength}`
                : `Фотография путешествия ${index + 1} из ${imagesLength}`,
            onLoadStart: handleLoadStart,
          }}
          onLoad={handleLoad}
          onError={handleError}
        />
      )}

      {/* Loading shimmer */}
      {status === 'loading' && (
        <ShimmerOverlay testID={`slider-loading-overlay-${index}`} />
      )}
    </View>
  );

  if (onImagePress) {
    return (
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={handlePress}
        accessibilityRole="button"
        accessibilityLabel={`Открыть фото ${index + 1} на весь экран`}
      >
        {slideContent}
      </TouchableOpacity>
    );
  }

  return slideContent;
});

export default Slide;
