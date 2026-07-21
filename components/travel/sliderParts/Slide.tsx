import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Text, View } from 'react-native';
import ImageCardMedia, {
  isIOSSafariUserAgent,
  prefetchImage,
} from '@/components/ui/ImageCardMedia';
import { optimizeImageUrl } from '@/utils/imageOptimization';
import { getMediaLqipUrl } from '@/utils/travelMediaVariants';
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
import { translate as i18nT } from '@/i18n'


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
  containerW: number | string;
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
  /** When true, this slide is the immediate ±1 neighbour of the active one (swipe target). */
  isAdjacent?: boolean;
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
  isAdjacent = false,
  fit = 'contain',
  onSlideLoad,
  prepareBlur = false,
  skipImage = false,
}: SlideProps) {
  const isSliderSafari =
    Platform.OS === 'web' &&
    typeof navigator !== 'undefined' &&
    isIOSSafariUserAgent(
      String(navigator.userAgent || ''),
      typeof navigator.maxTouchPoints === 'number'
        ? navigator.maxTouchPoints
        : 0,
    );
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
  const nativePressStartRef = useRef<{ x: number; y: number } | null>(null);
  const shouldPreloadAhead = !!preloadPriority && !isActive && !isFirstSlide;
  const shouldEagerLoad =
    isFirstSlide || isActive || isAdjacent || shouldPreloadAhead;
  // The immediate ±1 neighbour is the swipe target: raise it to 'high' so it wins
  // the same-origin metravel.by fetch queue against the flood of body-article
  // images. Distance-2 preloads stay 'normal'/'low' (they are not the next frame).
  const mainPriority =
    isFirstSlide || isActive || isAdjacent
      ? 'high'
      : Platform.OS === 'web'
        ? 'normal'
        : shouldPreloadAhead
          ? 'normal'
          : 'low';

  const mainFit: 'cover' | 'contain' = fit;
  const shouldBlur = blurBackground && (isActive || prepareBlur);
  // Native-only: feed the blurred backdrop a small (~360px) variant so Glide
  // decodes a downscaled bitmap and runs the blur transform on far fewer pixels
  // than the full-resolution photo, instead of decoding the large 70%-height
  // image a second time. The result is blurred anyway, so detail is irrelevant.
  const nativeBlurSrc = useMemo(() => {
    if (Platform.OS === 'web') return null;
    if (!shouldBlur || !resolvedUri) return null;
    return optimizeImageUrl(resolvedUri, {
      width: 360,
      quality: 35,
      fit: 'cover',
      // No `blur` param here: the image proxy silently ignores it (verified —
      // identical bytes for blur absent / 8 / 40), so asking for a server blur
      // only produced an unblurred upscaled copy. The backdrop is blurred on
      // device in OptimizedImage; keeping the variant small (~360px) is what
      // keeps that cheap. If the proxy ever learns `blur`, re-add it here AND
      // drop the device-side radius, otherwise the backdrop is blurred twice.
    }) ?? resolvedUri;
  }, [shouldBlur, resolvedUri]);
  const mediaLqipUrl = useMemo(() => getMediaLqipUrl(item.media), [item.media]);
  const effectiveBlurBackground = shouldBlur;
  const effectiveAllowCriticalWebBlur = shouldBlur && Platform.OS === 'web';
  const shouldRevealOnLoadOnly = isSliderSafari && effectiveAllowCriticalWebBlur;
  const shouldRenderLoadingPlaceholder =
    !isLoaded && (isFirstSlide || isActive || !!preloadPriority);

  useEffect(() => {
    setResolvedUri(uri);
    fallbackTriedRef.current = false;
  }, [uri]);

  useEffect(() => {
    loadedStateRef.current = isLoaded;
  }, [isLoaded]);

  useEffect(() => {
    if (Platform.OS === 'web' || !nativeBlurSrc || !shouldEagerLoad) return;
    void prefetchImage(nativeBlurSrc).catch(() => undefined);
  }, [nativeBlurSrc, shouldEagerLoad]);

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
    // Even on terminal image failure, release the first-screen LCP gate so the rest
    // of the travel page (description, sections) renders instead of staying blank
    // behind the skeleton overlay forever. Mirrors the success path in handleLoad.
    if (isFirstSlide && !firstLoadReportedRef.current) {
      firstLoadReportedRef.current = true;
      onFirstImageLoad?.();
    }
  }, [resolvedUri, isFirstSlide, onFirstImageLoad]);

  const handlePress = useCallback(() => {
    onImagePress?.(index);
  }, [onImagePress, index]);
  const handleNativePressTouchStart = useCallback((event: any) => {
    const nativeEvent = event?.nativeEvent ?? {};
    const pageX = nativeEvent.pageX ?? nativeEvent.changedTouches?.[0]?.pageX;
    const pageY = nativeEvent.pageY ?? nativeEvent.changedTouches?.[0]?.pageY;
    nativePressStartRef.current = Number.isFinite(pageX) && Number.isFinite(pageY)
      ? { x: pageX, y: pageY }
      : null;
  }, []);
  const handleNativePressTouchEnd = useCallback((event: any) => {
    const start = nativePressStartRef.current;
    nativePressStartRef.current = null;
    const nativeEvent = event?.nativeEvent ?? {};
    const pageX = nativeEvent.pageX ?? nativeEvent.changedTouches?.[0]?.pageX;
    const pageY = nativeEvent.pageY ?? nativeEvent.changedTouches?.[0]?.pageY;
    if (
      start &&
      Number.isFinite(pageX) &&
      Number.isFinite(pageY) &&
      Math.hypot(pageX - start.x, pageY - start.y) <= 10
    ) {
      handlePress();
    }
  }, [handlePress]);
  const hasRenderableUri = resolvedUri.length > 0;
  const caption = typeof item.caption === 'string' ? item.caption.trim() : '';
  const accessibilityLabel = caption
    ? i18nT('travel:components.travel.sliderParts.Slide.value1_fotografiya_puteshestviya_value2_iz_v_8abf175c', { value1: caption, value2: index + 1, value3: imagesLength })
    : i18nT('travel:components.travel.sliderParts.Slide.fotografiya_puteshestviya_value1_iz_value2_821e6a83', { value1: index + 1, value2: imagesLength });

  const slideContent = (
    <View
      testID={`slider-slide-surface-${index}`}
      renderToHardwareTextureAndroid={Platform.OS === 'android' && isActive}
      style={[
        styles.slide,
        { width: containerW, height: slideHeight },
        Platform.OS === 'web' ? ({ pointerEvents: 'none' } as any) : null,
      ]}
    >
      {/* Main image with integrated blur background */}
      {skipImage || !hasRenderableUri ? (
        // Empty placeholder while another layer owns the visible image or layout is not measured yet.
        <View style={{ width: '100%', height: '100%' }} />
      ) : hasError ? (
        <View
          style={styles.neutralPlaceholder}
          testID={`slider-neutral-placeholder-${index}`}
        />
      ) : (
        <>
          {/* Web-only loading skeleton (pulse). On native the opaque near-white block masked
              expo-image's own blurhash placeholder, leaving a white rectangle for several seconds
              before decode (#337). Native now lets the neutral blurhash placeholder show through —
              the sharp reveal still waits for expo-image's own load. */}
          {shouldRenderLoadingPlaceholder && Platform.OS === 'web' && (
            <View
              style={[
                {
                  position: 'absolute',
                  inset: 0,
                  zIndex: 2,
                  pointerEvents: 'none',
                  backgroundColor: 'rgba(240, 240, 240, 0.6)',
                  animation: 'sliderPulse 1.5s ease-in-out infinite',
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
            blurSrc={nativeBlurSrc}
            blurRadius={12}
            synchronizeNativeBlurReveal={shouldBlur && Platform.OS !== 'web'}
            placeholderSrc={mediaLqipUrl}
            priority={mainPriority as any}
            prefetch={Platform.OS === 'web' ? shouldPreloadAhead : false}
            loading={
              Platform.OS === 'web'
                ? shouldEagerLoad
                  ? 'eager'
                  : 'lazy'
                : 'lazy'
            }
            transition={isFirstSlide ? 0 : 200}
            style={styles.img}
            alt={accessibilityLabel}
            imageProps={{
              ...(imageProps || {}),
              contentPosition: 'center',
              testID: `slider-image-${index}`,
              accessibilityIgnoresInvertColors: true,
              accessibilityRole: 'image',
              accessibilityLabel,
            }}
            onLoad={handleLoad}
            onError={handleError}
            showImmediately={
              shouldRevealOnLoadOnly
                ? false
                : (isActive || isFirstSlide || loadedSlideUriCache.has(resolvedUri))
            }
            allowCriticalWebBlur={effectiveAllowCriticalWebBlur}
            revealOnLoadOnly={shouldRevealOnLoadOnly}
            preserveOptimizedWebSrc={Platform.OS === 'web'}
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
      {caption ? (
        <View style={styles.captionContainer} pointerEvents="none" testID={`slider-caption-${index}`}>
          <Text style={styles.captionText} numberOfLines={3}>{caption}</Text>
        </View>
      ) : null}
    </View>
  );

  if (onImagePress && Platform.OS !== 'web') {
    return (
      <View
        testID={`slider-native-press-surface-${index}`}
        onTouchStart={handleNativePressTouchStart}
        onTouchEnd={handleNativePressTouchEnd}
        onTouchCancel={() => {
          nativePressStartRef.current = null;
        }}
        onAccessibilityTap={handlePress}
        accessible
        style={{ width: '100%', height: '100%' }}
        accessibilityRole="button"
        accessibilityLabel={caption
          ? i18nT('travel:components.travel.sliderParts.Slide.otkryt_foto_value1_na_ves_ekran_387da948', { value1: caption })
          : i18nT('travel:components.travel.sliderParts.Slide.otkryt_foto_value1_na_ves_ekran_13b3899b', { value1: index + 1 })}
      >
        {slideContent}
      </View>
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
    prev.isAdjacent === next.isAdjacent &&
    prev.fit === next.fit &&
    prev.contentAspectRatio === next.contentAspectRatio &&
    prev.onSlideLoad === next.onSlideLoad &&
    prev.prepareBlur === next.prepareBlur &&
    prev.skipImage === next.skipImage
  );
});

export default Slide;
