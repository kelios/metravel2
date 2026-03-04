import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Platform, TouchableOpacity, View } from 'react-native';
import ImageCardMedia from '@/components/ui/ImageCardMedia';
import type { SliderImage } from './types';

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
  onImagePress?: (index: number) => void;
  /** When true, first slide is treated as loaded (cached hero handoff). */
  firstImagePreloaded?: boolean;
  /** When true, this slide should preload eagerly on web (near current index). */
  preloadPriority?: boolean;
  /** Image fit mode. Defaults to 'contain'. */
  fit?: 'cover' | 'contain';
}

const Slide = memo(function Slide({
  item: _item,
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
  onImagePress,
  firstImagePreloaded,
  preloadPriority,
  fit = 'contain',
}: SlideProps) {
  const [hasError, setHasError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const firstLoadReportedRef = useRef(false);

  const isFirstSlide = index === 0;
  const shouldEagerLoad =
    Platform.OS === 'web'
      ? isFirstSlide || isActive
      : isFirstSlide || !!preloadPriority;
  const mainPriority =
    Platform.OS === 'web'
      ? shouldEagerLoad
        ? 'high'
        : 'normal'
      : shouldEagerLoad
        ? 'high'
        : 'low';

  const mainFit: 'cover' | 'contain' = fit;
  const shouldBlur = blurBackground && isActive;

  useEffect(() => {
    firstLoadReportedRef.current = false;
    setHasError(false);
    setIsLoaded(isFirstSlide && !!firstImagePreloaded);
  }, [uri, index, isFirstSlide, firstImagePreloaded]);

  const handleLoad = useCallback(() => {
    setHasError(false);
    setIsLoaded(true);
    if (isFirstSlide && !firstLoadReportedRef.current) {
      firstLoadReportedRef.current = true;
      onFirstImageLoad?.();
    }
  }, [isFirstSlide, onFirstImageLoad]);

  useEffect(() => {
    // If first slide is already preloaded/cached, report readiness once on mount.
    if (!isFirstSlide) return;
    if (!firstImagePreloaded) return;
    if (firstLoadReportedRef.current) return;
    setIsLoaded(true);
    firstLoadReportedRef.current = true;
    onFirstImageLoad?.();
  }, [isFirstSlide, firstImagePreloaded, onFirstImageLoad]);

  const handleError = useCallback(() => {
    setHasError(true);
  }, []);

  const handlePress = useCallback(() => {
    onImagePress?.(index);
  }, [onImagePress, index]);

  const slideContent = (
    <View style={[styles.slide, { width: containerW, height: slideHeight }]}>
      {/* Main image with integrated blur background */}
      {hasError ? (
        <View
          style={styles.neutralPlaceholder}
          testID={`slider-neutral-placeholder-${index}`}
        />
      ) : (
        <>
          {!isLoaded && (
            <View
              style={[
                styles.neutralPlaceholder,
                { position: 'absolute', inset: 0, zIndex: 2, pointerEvents: 'none' } as any,
              ]}
            />
          )}
          <ImageCardMedia
            src={uri}
            fit={mainFit}
            blurBackground={shouldBlur}
            blurRadius={12}
            priority={mainPriority as any}
            prefetch={false}
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
            }}
            onLoad={handleLoad}
            onError={handleError}
            showImmediately={isFirstSlide && !!firstImagePreloaded}
          />
        </>
      )}
    </View>
  );

  if (onImagePress) {
    return (
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={handlePress}
        style={{ width: '100%', height: '100%' }}
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
