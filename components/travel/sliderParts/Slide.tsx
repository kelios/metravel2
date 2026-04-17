import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Platform, TouchableOpacity, View } from 'react-native';
import ImageCardMedia from '@/components/ui/ImageCardMedia';
import type { SliderImage } from './types';
import { injectSliderGlobalStyles } from './globalStyles';

// ✅ OPTIMIZATION: Inject global styles once
if (Platform.OS === 'web') {
  injectSliderGlobalStyles();
}

import {
  loadedSlideUriCache,
  isBaseUriLoaded,
  markBaseUriLoaded,
  markUriLoaded,
} from './imageLoadCache';

// Re-export for use by LCP Hero
export { markBaseUriLoaded, loadedSlideUriCache } from './imageLoadCache';

const MEDIA_PATH_WITH_API_PREFIX = /^\/api\/(gallery|travel-image|travel-description-image|address-image)(\/|$)/i;

const isPrivateOrLocalHost = (host: string): boolean => {
  const normalized = String(host || '').trim().toLowerCase();
  if (!normalized) return false;
  if (normalized === 'localhost' || normalized === '127.0.0.1') return true;
  if (/^10\./.test(normalized)) return true;
  if (/^192\.168\./.test(normalized)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(normalized)) return true;
  return false;
};

const buildFallbackMediaUrl = (value: string): string | null => {
  const raw = String(value || '').trim();
  if (!raw) return null;

  // Fix malformed backend shape: https://hosthttps://real-url
  const duplicatedProtocol = raw.match(/^https?:\/\/[^/]+(https?:\/\/.+)$/i);
  if (duplicatedProtocol?.[1]) {
    return duplicatedProtocol[1];
  }

  try {
    const parsed = new URL(raw, 'https://metravel.by');
    let changed = false;

    if (MEDIA_PATH_WITH_API_PREFIX.test(parsed.pathname)) {
      parsed.pathname = parsed.pathname.replace(/^\/api/i, '');
      changed = true;
    }

    if (/^\/gallery\/\d+\/gallery\//i.test(parsed.pathname) && !/^\/media\//i.test(parsed.pathname)) {
      parsed.pathname = `/media${parsed.pathname}`;
      changed = true;
    }

    if (parsed.protocol === 'http:' && !isPrivateOrLocalHost(parsed.hostname)) {
      parsed.protocol = 'https:';
      changed = true;
    }

    return changed ? parsed.toString() : null;
  } catch {
    return null;
  }
};

interface SlideProps {
  item: SliderImage;
  index: number;
  uri: string;
  containerW: number;
  slideHeight: number | string;
  slideHeightPx?: number;
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
  contentAspectRatio?: number;
  onSlideLoad?: (index: number) => void;
  prepareBlur?: boolean;
  /** When true, skip rendering the image (LCP Hero overlay covers it). */
  skipImage?: boolean;
}

const Slide = memo(function Slide({
  item,
  index,
  uri,
  containerW,
  slideHeight,
  slideHeightPx,
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
  onSlideLoad,
  prepareBlur = false,
  skipImage = false,
}: SlideProps) {
  const [resolvedUri, setResolvedUri] = useState(uri);
  const [hasError, setHasError] = useState(false);
  const isFirstSlide = index === 0;
  // If firstImagePreloaded is true for the first slide, treat it as already loaded
  // and add URI to cache so ImageCardMedia also gets showImmediately=true
  // Also check base URI cache to detect same image with different optimization params
  const [isLoaded, setIsLoaded] = useState(() => {
    if (loadedSlideUriCache.has(uri) || isBaseUriLoaded(uri)) {
      loadedSlideUriCache.add(uri);
      return true;
    }
    if (isFirstSlide && firstImagePreloaded && Platform.OS === 'web') {
      loadedSlideUriCache.add(uri);
      markBaseUriLoaded(uri);
      return true;
    }
    return false;
  });
  const firstLoadReportedRef = useRef(false);
  const slideLoadReportedRef = useRef(false);
  const fallbackTriedRef = useRef(false);
  const loadedStateRef = useRef(isLoaded);
  const shouldEagerLoad =
    Platform.OS === 'web'
      ? isFirstSlide || isActive || !!preloadPriority
      : isFirstSlide || isActive || !!preloadPriority;
  const mainPriority =
    Platform.OS === 'web'
      ? shouldEagerLoad
        ? 'high'
        : 'normal'
      : shouldEagerLoad
        ? 'high'
        : 'low';

  const mainFit: 'cover' | 'contain' = fit;
  const shouldBlur = blurBackground && (isActive || prepareBlur);
  const effectiveBlurBackground = shouldBlur;
  const shouldRenderLoadingPlaceholder =
    !isLoaded && (isFirstSlide || isActive || !!preloadPriority);

  useEffect(() => {
    setResolvedUri(uri);
    fallbackTriedRef.current = false;
  }, [uri]);

  useEffect(() => {
    loadedStateRef.current = isLoaded;
  }, [isLoaded]);

  // When skipImage is true and firstImagePreloaded is true, immediately report load
  // This ensures the slider upgrade happens even though we skip rendering the image
  useEffect(() => {
    if (skipImage && isFirstSlide && firstImagePreloaded && !firstLoadReportedRef.current) {
      firstLoadReportedRef.current = true;
      onFirstImageLoad?.();
    }
  }, [skipImage, isFirstSlide, firstImagePreloaded, onFirstImageLoad]);

  // Track base URI (without query params) to avoid resetting loaded state
  // when only optimization params change but the source image is the same
  const baseUriRef = useRef<string | null>(null);
  useEffect(() => {
    // Extract base URI without query params for comparison
    let currentBaseUri: string | null = null;
    try {
      const url = new URL(resolvedUri, 'https://metravel.by');
      currentBaseUri = url.origin + url.pathname;
    } catch {
      currentBaseUri = resolvedUri.split('?')[0];
    }
    
    // Only reset state if the actual image source changed
    if (currentBaseUri !== baseUriRef.current) {
      baseUriRef.current = currentBaseUri;
      firstLoadReportedRef.current = false;
      slideLoadReportedRef.current = false;
      setHasError(false);
      // Check exact URI cache first, then base URI cache, then firstImagePreloaded
      if (loadedSlideUriCache.has(resolvedUri) || isBaseUriLoaded(resolvedUri)) {
        loadedSlideUriCache.add(resolvedUri);
        setIsLoaded(true);
      } else if (isFirstSlide && firstImagePreloaded && Platform.OS === 'web') {
        loadedSlideUriCache.add(resolvedUri);
        markBaseUriLoaded(resolvedUri);
        setIsLoaded(true);
      } else {
        setIsLoaded(false);
      }
    }
  }, [resolvedUri, isFirstSlide, firstImagePreloaded]);

  const reportSlideLoad = useCallback(() => {
    if (slideLoadReportedRef.current) return;
    slideLoadReportedRef.current = true;
    onSlideLoad?.(index);
  }, [index, onSlideLoad]);

  const handleLoad = useCallback(() => {
    markUriLoaded(resolvedUri);
    if (hasError) setHasError(false);
    if (!loadedStateRef.current) {
      loadedStateRef.current = true;
      setIsLoaded(true);
    }
    reportSlideLoad();
    if (isFirstSlide && !firstLoadReportedRef.current) {
      firstLoadReportedRef.current = true;
      onFirstImageLoad?.();
    }
  }, [hasError, isFirstSlide, onFirstImageLoad, reportSlideLoad, resolvedUri]);

  useEffect(() => {
    if (!isLoaded) return;
    reportSlideLoad();
  }, [isLoaded, reportSlideLoad]);

  const handleError = useCallback(() => {
    if (!fallbackTriedRef.current) {
      const fallback = buildFallbackMediaUrl(resolvedUri);
      if (fallback && fallback !== resolvedUri) {
        fallbackTriedRef.current = true;
        setResolvedUri(fallback);
        setHasError(false);
        setIsLoaded(loadedSlideUriCache.has(fallback) || isBaseUriLoaded(fallback));
        return;
      }
      fallbackTriedRef.current = true;
    }
    setHasError(true);
  }, [resolvedUri]);

  const handlePress = useCallback(() => {
    onImagePress?.(index);
  }, [onImagePress, index]);

  const slideContent = (
    <View
      style={[
        styles.slide,
        { width: containerW, height: slideHeight },
        Platform.OS === 'web' ? ({ pointerEvents: 'none' } as any) : null,
      ]}
    >
      {/* Main image with integrated blur background */}
      {skipImage ? (
        // Empty placeholder when LCP Hero overlay covers this slide
        <View style={{ width: '100%', height: '100%' }} />
      ) : hasError ? (
        <View
          style={styles.neutralPlaceholder}
          testID={`slider-neutral-placeholder-${index}`}
        />
      ) : (
        <>
          {/* ✅ OPTIMIZATION: Show subtle skeleton with pulse animation */}
          {shouldRenderLoadingPlaceholder && (
            <View
              style={[
                {
                  position: 'absolute',
                  inset: 0,
                  zIndex: 2,
                  pointerEvents: 'none',
                  backgroundColor: 'rgba(240, 240, 240, 0.6)',
                  ...(Platform.OS === 'web' ? {
                    animation: 'sliderPulse 1.5s ease-in-out infinite',
                  } : {})
                } as any,
              ]}
            />
          )}
          <ImageCardMedia
            src={resolvedUri}
            recyclingKey={`slider-slide-${index}-${resolvedUri}`}
            width={containerW}
            height={slideHeightPx}
            fit={mainFit}
            blurBackground={effectiveBlurBackground}
            blurRadius={12}
            priority={mainPriority as any}
            prefetch={Platform.OS === 'web' ? (isFirstSlide || isActive || !!preloadPriority) : false}
            loading={
              Platform.OS === 'web'
                ? shouldEagerLoad
                  ? 'eager'
                  : 'lazy'
                : 'lazy'
            }
            transition={isFirstSlide ? 0 : 200}
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
            showImmediately={loadedSlideUriCache.has(resolvedUri)}
            allowCriticalWebBlur={effectiveBlurBackground}
            contentAspectRatio={
              typeof item?.width === 'number' &&
              typeof item?.height === 'number' &&
              item.width > 0 &&
              item.height > 0
                ? item.width / item.height
                : undefined
            }
          />
        </>
      )}
    </View>
  );

  if (onImagePress && Platform.OS !== 'web') {
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
}, (prev, next) => {
  return (
    prev.item === next.item &&
    prev.index === next.index &&
    prev.uri === next.uri &&
    prev.containerW === next.containerW &&
    prev.slideHeight === next.slideHeight &&
    prev.slideHeightPx === next.slideHeightPx &&
    prev.imagesLength === next.imagesLength &&
    prev.styles === next.styles &&
    prev.blurBackground === next.blurBackground &&
    prev.isActive === next.isActive &&
    prev.imageProps === next.imageProps &&
    prev.onFirstImageLoad === next.onFirstImageLoad &&
    prev.onImagePress === next.onImagePress &&
    prev.firstImagePreloaded === next.firstImagePreloaded &&
    prev.preloadPriority === next.preloadPriority &&
    prev.fit === next.fit &&
    prev.contentAspectRatio === next.contentAspectRatio &&
    prev.onSlideLoad === next.onSlideLoad &&
    prev.prepareBlur === next.prepareBlur &&
    prev.skipImage === next.skipImage
  );
});

export default Slide;
