import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Platform, TouchableOpacity, View } from 'react-native';
import ImageCardMedia from '@/components/ui/ImageCardMedia';
import { ShimmerOverlay } from '@/components/ui/ShimmerOverlay';
import type { SliderImage, LoadStatus } from './types';

const SHIMMER_DELAY_MS_WEB = 140;

interface SlideProps {
  item: SliderImage;
  index: number;
  uri: string;
  containerW: number;
  slideHeight: number | string;
  imagesLength: number;
  styles: Record<string, any>;
  blurBackground: boolean;
  /** When true, this slide is the currently visible one (controls blur rendering). */
  isActive?: boolean;
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
  isActive = false,
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
  const [showShimmer, setShowShimmer] = useState(false);
  const firstLoadReportedRef = useRef(false);

  const isFirstSlide = index === 0;
  const shouldEagerLoad = isFirstSlide || !!preloadPriority;
  const mainPriority = shouldEagerLoad ? 'high' : 'low';

  const mainFit: 'cover' | 'contain' = fit;
  const shouldBlur = blurBackground && isActive;

  useEffect(() => {
    firstLoadReportedRef.current = false;
    setStatus(index === 0 && firstImagePreloaded ? 'loaded' : 'loading');
    setShowShimmer(false);
  }, [uri, index, firstImagePreloaded]);

  useEffect(() => {
    if (status !== 'loading') {
      setShowShimmer(false);
      return;
    }

    if (Platform.OS !== 'web') {
      setShowShimmer(true);
      return;
    }

    const t = setTimeout(() => setShowShimmer(true), SHIMMER_DELAY_MS_WEB);
    return () => clearTimeout(t);
  }, [status]);

  const handleLoadStart = useCallback(() => {
    setStatus((prev) => (prev === 'loaded' ? prev : 'loading'));
  }, []);

  const handleLoad = useCallback(() => {
    setStatus('loaded');
    setShowShimmer(false);
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
    setShowShimmer(false);
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
          blurBackground={shouldBlur}
          blurRadius={12}
          priority={mainPriority as any}
          prefetch={Platform.OS === 'web' && shouldEagerLoad}
          loading={
            Platform.OS === 'web'
              ? shouldEagerLoad
                ? 'eager'
                : 'lazy'
              : 'lazy'
          }
          transition={0}
          style={styles.img}
          alt={`Фотография путешествия ${index + 1} из ${imagesLength}`}
          imageProps={{
            ...(imageProps || {}),
            contentPosition: 'center',
            testID: `slider-image-${index}`,
            accessibilityIgnoresInvertColors: true,
            accessibilityRole: 'image',
            accessibilityLabel: `Фотография путешествия ${index + 1} из ${imagesLength}`,
            onLoadStart: handleLoadStart,
          }}
          onLoad={handleLoad}
          onError={handleError}
        />
      )}

      {/* Loading shimmer */}
      {status === 'loading' && showShimmer && (
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
