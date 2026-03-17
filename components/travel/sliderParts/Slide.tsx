import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Platform, TouchableOpacity, View } from 'react-native';
import ImageCardMedia from '@/components/ui/ImageCardMedia';
import type { SliderImage } from './types';

const loadedSlideUriCache = new Set<string>();
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
  onSlideLoad?: (index: number) => void;
  prepareBlur?: boolean;
}

const Slide = memo(function Slide({
  item: _item,
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
}: SlideProps) {
  const [resolvedUri, setResolvedUri] = useState(uri);
  const [hasError, setHasError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(() => loadedSlideUriCache.has(uri));
  const firstLoadReportedRef = useRef(false);
  const slideLoadReportedRef = useRef(false);
  const fallbackTriedRef = useRef(false);

  const isFirstSlide = index === 0;
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
  const shouldDelayWebRevealUntilLoad =
    Platform.OS === 'web' &&
    isActive &&
    shouldBlur &&
    !isFirstSlide;

  useEffect(() => {
    setResolvedUri(uri);
    fallbackTriedRef.current = false;
  }, [uri]);

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
      setIsLoaded((isFirstSlide && !!firstImagePreloaded) || loadedSlideUriCache.has(resolvedUri));
    }
  }, [resolvedUri, index, isFirstSlide, firstImagePreloaded]);

  const reportSlideLoad = useCallback(() => {
    if (slideLoadReportedRef.current) return;
    slideLoadReportedRef.current = true;
    onSlideLoad?.(index);
  }, [index, onSlideLoad]);

  const handleLoad = useCallback(() => {
    loadedSlideUriCache.add(resolvedUri);
    setHasError(false);
    setIsLoaded(true);
    reportSlideLoad();
    if (isFirstSlide && !firstLoadReportedRef.current) {
      firstLoadReportedRef.current = true;
      onFirstImageLoad?.();
    }
  }, [isFirstSlide, onFirstImageLoad, reportSlideLoad, resolvedUri]);

  useEffect(() => {
    // If first slide is already preloaded/cached, report readiness once on mount.
    if (!isFirstSlide) return;
    if (!firstImagePreloaded) return;
    if (firstLoadReportedRef.current) return;
    setIsLoaded(true);
    reportSlideLoad();
    firstLoadReportedRef.current = true;
    onFirstImageLoad?.();
  }, [isFirstSlide, firstImagePreloaded, onFirstImageLoad, reportSlideLoad]);

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
        setIsLoaded((isFirstSlide && !!firstImagePreloaded) || loadedSlideUriCache.has(fallback));
        return;
      }
      fallbackTriedRef.current = true;
    }
    setHasError(true);
  }, [firstImagePreloaded, isFirstSlide, resolvedUri]);

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
      {hasError ? (
        <View
          style={styles.neutralPlaceholder}
          testID={`slider-neutral-placeholder-${index}`}
        />
      ) : (
        <>
          {!isLoaded && Platform.OS !== 'web' && (
            <View
              style={[
                styles.neutralPlaceholder,
                { position: 'absolute', inset: 0, zIndex: 2, pointerEvents: 'none' } as any,
              ]}
            />
          )}
          <ImageCardMedia
            src={resolvedUri}
            width={containerW}
            height={slideHeightPx}
            fit={mainFit}
            blurBackground={shouldBlur}
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
            showImmediately={(isFirstSlide && !!firstImagePreloaded) || loadedSlideUriCache.has(resolvedUri)}
            allowCriticalWebBlur={shouldBlur}
            revealOnLoadOnly={shouldDelayWebRevealUntilLoad}
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
});

export default Slide;
