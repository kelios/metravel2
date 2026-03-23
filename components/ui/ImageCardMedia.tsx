import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import type { ImageContentFit } from 'expo-image';
import type { ImageProps as ExpoImageProps } from 'expo-image';

import OptimizedImage from '@/components/ui/OptimizedImage';
import { ShimmerOverlay } from '@/components/ui/ShimmerOverlay';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';
import { optimizeImageUrl, generateSrcSet } from '@/utils/imageOptimization';
import { DESIGN_TOKENS } from '@/constants/designSystem';

type Priority = 'low' | 'normal' | 'high';

const isRootRelativeUrl = (value: string): boolean => /^\/(?!\/)/.test(value);
const loadedWebImageBaseCache = new Set<string>();

const resolveBaseImageKey = (value: string | null | undefined): string | null => {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return null;
  if (/^(data:|blob:)/i.test(raw)) return raw;

  try {
    const url = new URL(raw, 'https://metravel.by');
    return `${url.origin}${url.pathname}`;
  } catch {
    return raw.split('?')[0] || raw;
  }
};

export const isIOSSafariUserAgent = (userAgent: string, maxTouchPoints = 0): boolean => {
  const normalizedUserAgent = String(userAgent || '');
  const isIOSDevice = /iPad|iPhone|iPod/i.test(normalizedUserAgent) || (
    /Macintosh/i.test(normalizedUserAgent) && maxTouchPoints > 1
  );
  const isSafari = /Safari/i.test(normalizedUserAgent) && !/(Chrome|CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo|GSA|Chromium|Firefox)/i.test(normalizedUserAgent);

  return isIOSDevice && isSafari;
};

const isIOSSafariWeb = (): boolean => {
  if (Platform.OS !== 'web' || typeof navigator === 'undefined') return false;

  const userAgent = String(navigator.userAgent || '');
  const maxTouchPoints = typeof navigator.maxTouchPoints === 'number' ? navigator.maxTouchPoints : 0;
  return isIOSSafariUserAgent(userAgent, maxTouchPoints);
};


type WebMainImageProps = {
  src: string;
  alt: string;
  width: number;
  height: number;
  fit: 'contain' | 'cover';
  borderRadius: number;
  loading: 'lazy' | 'eager';
  priority: Priority;
  hasBlurBehind: boolean;
  loaded: boolean;
  srcSet?: string;
  sizes?: string;
  onLoad?: (resolvedSrc: string) => void;
  onError?: () => void;
  showImmediately?: boolean;
};

const WebMainImage = memo(function WebMainImage({
  src,
  alt,
  width,
  height,
  fit,
  borderRadius,
  loading,
  priority,
  hasBlurBehind,
  loaded,
  srcSet,
  sizes,
  onLoad,
  onError,
  showImmediately = false,
}: WebMainImageProps) {
  const imgRef = useRef<HTMLImageElement>(null);
  const handleLoad = useCallback(() => {
    const resolvedSrc = imgRef.current?.currentSrc || src;
    onLoad?.(resolvedSrc);
  }, [onLoad, src]);

  // Handle race condition: image may already be cached/complete before
  // React attaches the onLoad handler, so onLoad never fires.
  useEffect(() => {
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth > 0 && !loaded) {
      handleLoad();
    }
  }, [src, loaded, handleLoad]);

  return (
    <img
      ref={imgRef}
      src={src}
      srcSet={srcSet}
      sizes={sizes}
      alt={alt}
      width={width}
      height={height}
      style={{
        position: 'absolute',
        objectFit: fit === 'cover' ? 'cover' : 'contain',
        objectPosition: 'center',
        inset: 0,
        width: '100%',
        height: '100%',
        maxWidth: 'none',
        maxHeight: 'none',
        zIndex: 1,
        borderRadius,
        display: 'block',
        // Show image only when loaded to avoid showing progressive/partial image that looks blurry.
        // showImmediately bypasses this for cached images or deliberate immediate reveal.
        opacity: showImmediately || loaded ? 1 : 0,
        transition: hasBlurBehind && !showImmediately ? 'opacity 0.2s ease' : 'none',
        willChange: hasBlurBehind && !showImmediately ? 'opacity' : 'auto',
        contain: 'layout',
      }}
      loading={loading}
      decoding={priority === 'high' ? 'sync' : 'async'}
      // @ts-ignore -- fetchPriority is a valid HTML attribute not yet in React types
      fetchPriority={priority === 'high' ? 'high' : 'auto'}
      onLoad={handleLoad}
      onError={onError}
    />
  );
});

type WebBlurBackdropProps = {
  src: string;
  alt?: string;
  width: number;
  height: number;
  borderRadius: number;
  fit: 'contain' | 'cover';
  useCssBackdrop?: boolean;
};

const WebBlurBackdrop = memo(function WebBlurBackdrop({
  src,
  alt = '',
  width,
  height,
  borderRadius,
  fit,
  useCssBackdrop = false,
}: WebBlurBackdropProps) {
  const hasPreBlurredSource = /(?:\?|&)blur=\d+(?:&|$)/i.test(src);
  const backdropFit = 'cover';
  const backdropScale = fit === 'contain' ? 1.08 : 1.12;
  const backdropFilter = hasPreBlurredSource
    ? 'saturate(1.08)'
    : fit === 'contain'
      ? 'blur(20px) saturate(1.04)'
      : 'blur(24px) saturate(1.15)';

  if (useCssBackdrop) {
    return (
      <div
        aria-hidden="true"
        data-blur-backdrop="true"
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: '100%',
          height: '100%',
          minWidth: '100%',
          minHeight: '100%',
          maxWidth: 'none',
          maxHeight: 'none',
          display: 'block',
          zIndex: 0,
          borderRadius,
          transform: `translate(-50%, -50%) scale(${backdropScale})`,
          backgroundImage: `url("${src.replace(/"/g, '\\"')}")`,
          backgroundSize: backdropFit,
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          filter: backdropFilter,
          opacity: 0.95,
          contain: 'paint',
          willChange: 'transform',
          backfaceVisibility: 'hidden',
          pointerEvents: 'none',
        }}
      />
    );
  }

  const loading = fit === 'contain' ? 'lazy' : 'eager';
  const fetchPriority = fit === 'contain' ? 'low' : 'auto';

  return (
    <img
      aria-hidden="true"
      data-blur-backdrop="true"
      src={src}
      alt={alt}
      width={width}
      height={height}
      style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        width: '100%',
        height: '100%',
        minWidth: '100%',
        minHeight: '100%',
        maxWidth: 'none',
        maxHeight: 'none',
        display: 'block',
        objectFit: backdropFit,
        objectPosition: 'center',
        zIndex: 0,
        borderRadius,
        transform: `translate(-50%, -50%) scale(${backdropScale})`,
        filter: backdropFilter,
        opacity: 0,
        contain: 'paint',
        willChange: 'transform, opacity',
        backfaceVisibility: 'hidden',
        pointerEvents: 'none',
        transition: 'opacity 0.15s ease-in',
      }}
      loading={loading}
      decoding="async"
      // @ts-ignore -- fetchPriority is a valid HTML attribute not yet in React types
      fetchPriority={fetchPriority}
      onLoad={(e) => {
        const img = e.currentTarget;
        img.style.opacity = '1';
      }}
    />
  );
});

type Props = {
  src?: string | null;
  source?: { uri: string } | number | null;
  alt?: string;
  height?: number;
  width?: number | string;
  borderRadius?: number;
  fit?: 'contain' | 'cover';
  blurBackground?: boolean;
  blurRadius?: number;
  blurOnly?: boolean;
  quality?: number;
  overlayColor?: string;
  placeholderBlurhash?: string;
  priority?: Priority;
  loading?: 'lazy' | 'eager';
  prefetch?: boolean;
  transition?: number;
  cachePolicy?: ExpoImageProps['cachePolicy'];
  imageProps?: Partial<ExpoImageProps>;
  testID?: string;
  style?: any;
  onLoad?: () => void;
  onError?: () => void;
  /** Show image immediately without waiting for load (for cached images). */
  showImmediately?: boolean;
  /** Allow blurred web backdrop even for eager/high-priority images. */
  allowCriticalWebBlur?: boolean;
  /** On web, keep main image hidden until onLoad even for eager/high-priority media. */
  revealOnLoadOnly?: boolean;
};

function ImageCardMedia({
  src,
  source,
  alt,
  height,
  width = '100%',
  borderRadius = 12,
  fit = 'contain',
  blurBackground = true,
  blurRadius = 16,
  blurOnly = false,
  quality = 60,
  overlayColor,
  placeholderBlurhash,
  priority = 'normal',
  loading = 'lazy',
  prefetch = false,
  transition,
  cachePolicy,
  imageProps,
  testID,
  style,
  onLoad,
  onError,
  showImmediately = false,
  allowCriticalWebBlur = false,
  revealOnLoadOnly = false,
}: Props) {
  const isJest =
    typeof process !== 'undefined' && !!(process as any)?.env?.JEST_WORKER_ID;
  const disableRemoteImages =
    __DEV__ && process.env.EXPO_PUBLIC_DISABLE_REMOTE_IMAGES === 'true';
  const colors = useThemedColors();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const contentFit: ImageContentFit = fit === 'cover' ? 'cover' : 'contain';
  const resolvedSource = useMemo(() => {
    if (source) return source;
    if (src) return { uri: src };
    return null;
  }, [source, src]);
  const currentBaseImageKey = useMemo(() => {
    if (!resolvedSource || typeof resolvedSource === 'number') return null;
    if (typeof resolvedSource === 'string') {
      return resolveBaseImageKey(resolvedSource);
    }
    const uri = typeof (resolvedSource as any)?.uri === 'string' ? String((resolvedSource as any).uri).trim() : '';
    return resolveBaseImageKey(uri);
  }, [resolvedSource]);
  const [webLoaded, setWebLoaded] = useState(() => {
    return !!(currentBaseImageKey && loadedWebImageBaseCache.has(currentBaseImageKey));
  });

  const resolvedBorderRadius = useMemo(() => {
    const flattened = StyleSheet.flatten(style) as any;
    const override = flattened?.borderRadius;
    return typeof override === 'number' ? override : borderRadius;
  }, [borderRadius, style]);

  // For require() sources (numbers), we use OptimizedImage with ExpoImage
  // which handles them natively. No need to resolve URI manually.
  const shouldDisableNetwork = useMemo(() => {
    if (!disableRemoteImages) return false;
    if (!resolvedSource || typeof resolvedSource === 'number') return false;
    const uri = typeof (resolvedSource as any)?.uri === 'string' ? String((resolvedSource as any).uri).trim() : '';
    if (!uri) return false;
    return !/^(data:|blob:)/i.test(uri);
  }, [disableRemoteImages, resolvedSource]);

  const resolvedLoading = useMemo(() => {
    if (Platform.OS !== 'web') return loading;
    if (loading !== 'lazy') return loading;
    return isIOSSafariWeb() ? 'eager' : loading;
  }, [loading]);

  // Stabilize width/height for image optimization to prevent URL changes on scroll
  // Only update when change is significant (>50px) to avoid re-fetching images
  const stableWidthRef = useRef<number | undefined>(typeof width === 'number' ? width : undefined);
  const stableHeightRef = useRef<number | undefined>(typeof height === 'number' ? height : undefined);
  
  const stableWidth = useMemo(() => {
    const numericWidth = typeof width === 'number' ? width : undefined;
    if (numericWidth !== undefined && stableWidthRef.current !== undefined) {
      if (Math.abs(numericWidth - stableWidthRef.current) > 50) {
        stableWidthRef.current = numericWidth;
      }
    } else if (numericWidth !== undefined) {
      stableWidthRef.current = numericWidth;
    }
    return stableWidthRef.current;
  }, [width]);
  
  const stableHeight = useMemo(() => {
    const numericHeight = typeof height === 'number' ? height : undefined;
    if (numericHeight !== undefined && stableHeightRef.current !== undefined) {
      if (Math.abs(numericHeight - stableHeightRef.current) > 50) {
        stableHeightRef.current = numericHeight;
      }
    } else if (numericHeight !== undefined) {
      stableHeightRef.current = numericHeight;
    }
    return stableHeightRef.current;
  }, [height]);

  const webOptimizedSource = useMemo(() => {
    if (Platform.OS !== 'web') return null;
    if (!resolvedSource || typeof resolvedSource === 'number') return null;
    // Handle local asset string from require() on web
    if (typeof resolvedSource === 'string') return resolvedSource;
    const uri = typeof (resolvedSource as any)?.uri === 'string' ? String((resolvedSource as any).uri).trim() : '';
    if (!uri) return null;
    if (isRootRelativeUrl(uri)) return uri;
    if (!stableWidth && !stableHeight) return null;
    return (
      optimizeImageUrl(uri, {
        width: stableWidth,
        height: stableHeight,
        quality,
        fit: contentFit === 'contain' ? 'contain' : 'cover',
        format: 'auto',
      }) ?? uri
    );
  }, [resolvedSource, stableWidth, stableHeight, contentFit, quality]);
  const webMainSrc = useMemo(() => {
    if (Platform.OS !== 'web') return null;
    // For require() sources (numbers), return null to use OptimizedImage/ExpoImage
    if (typeof resolvedSource === 'number') return null;
    if (!resolvedSource) return null;
    // Handle local asset string from require() on web
    if (typeof resolvedSource === 'string') return resolvedSource;
    if (shouldDisableNetwork) return null;
    if (webOptimizedSource) return webOptimizedSource;
    const uri = typeof (resolvedSource as any)?.uri === 'string' ? String((resolvedSource as any).uri).trim() : '';
    return uri || null;
  }, [resolvedSource, shouldDisableNetwork, webOptimizedSource]);

  const webBlurSrc = useMemo(() => {
    if (Platform.OS !== 'web') return null;
    if (!resolvedSource || typeof resolvedSource === 'number') return null;
    // For critical web media (hero/slider), reuse the already selected main image URL
    // so the blurred surround appears from the same fetched resource instead of a
    // second optimized background request that can arrive later.
    if (allowCriticalWebBlur && webMainSrc) return webMainSrc;
    if (typeof resolvedSource === 'string') return resolvedSource;
    const uri = typeof (resolvedSource as any)?.uri === 'string' ? String((resolvedSource as any).uri).trim() : '';
    if (!uri) return null;
    if (isRootRelativeUrl(uri)) return uri;

    // Use stable dimensions to prevent URL changes on scroll
    const numericWidth = stableWidth ?? 160;
    const numericHeight = stableHeight ?? 160;
    const blurWidth = Math.max(96, Math.min(320, Math.round(numericWidth * 0.42)));
    const blurHeight = Math.max(96, Math.min(320, Math.round(numericHeight * 0.42)));

    return optimizeImageUrl(uri, {
      width: blurWidth,
      height: blurHeight,
      quality: 32,
      format: 'jpg',
      fit: 'cover',
      blur: Math.max(3, Math.round(blurRadius / 2.6)),
    }) ?? uri;
  }, [allowCriticalWebBlur, resolvedSource, stableWidth, stableHeight, blurRadius, webMainSrc]);

  const webSrcSet = useMemo(() => {
    if (Platform.OS !== 'web') return undefined;
    if (!resolvedSource || typeof resolvedSource === 'number') return undefined;
    // Skip srcset for local assets
    if (typeof resolvedSource === 'string') return undefined;
    const uri = typeof (resolvedSource as any)?.uri === 'string' ? String((resolvedSource as any).uri).trim() : '';
    if (!uri) return undefined;
    if (isRootRelativeUrl(uri)) return undefined;
    // Use stable width to prevent srcset changes on scroll
    const baseWidth = stableWidth ?? 320;
    const srcSetWidths = [
      Math.max(160, Math.round(baseWidth * 0.5)),
      Math.max(320, Math.round(baseWidth)),
      Math.max(480, Math.round(baseWidth * 1.5)),
      Math.max(640, Math.round(baseWidth * 2)),
    ];
    const uniqueSortedWidths = Array.from(new Set(srcSetWidths)).sort((a, b) => a - b);
    return (
      generateSrcSet(uri, uniqueSortedWidths, {
        quality,
        fit: contentFit === 'contain' ? 'contain' : 'cover',
      }) || undefined
    );
  }, [resolvedSource, contentFit, quality, stableWidth]);

  const webSizes = useMemo(() => {
    if (Platform.OS !== 'web') return undefined;
    if (typeof width === 'number' && Number.isFinite(width) && width > 0) {
      return `${Math.round(width)}px`;
    }
    return '(min-width: 1024px) 320px, (min-width: 768px) 33vw, 50vw';
  }, [width]);

  const shouldRenderWebBlurBackground = useMemo(() => {
    if (Platform.OS !== 'web') return false;
    if (!blurBackground || !webMainSrc) return false;
    if (allowCriticalWebBlur) return true;
    // Avoid promoting the oversized blur backdrop to LCP on eager/critical images
    // unless the caller explicitly opts in for layout fidelity.
    return !(loading === 'eager' || priority === 'high');
  }, [allowCriticalWebBlur, blurBackground, loading, priority, webMainSrc]);

  // When blur backdrop reuses the main image URL, both the CSS background-image
  // and the <img> share one browser cache entry. The sharp image appears as soon
  // as data arrives — no need for an opacity fade that creates a "blur first,
  // image second" flash during scroll.
  const blurSharesMainUrl = useMemo(() => {
    if (Platform.OS !== 'web') return false;
    // allowCriticalWebBlur forces webBlurSrc = webMainSrc (line above), so both
    // elements share one browser cache entry and render simultaneously.
    return allowCriticalWebBlur && shouldRenderWebBlurBackground && webMainSrc != null;
  }, [allowCriticalWebBlur, shouldRenderWebBlurBackground, webMainSrc]);

  const shouldShowWebImageImmediately = useMemo(() => {
    if (Platform.OS !== 'web') return showImmediately;
    if (revealOnLoadOnly) return showImmediately;
    if (blurSharesMainUrl) return true;
    return showImmediately || resolvedLoading === 'eager' || priority === 'high';
  }, [showImmediately, resolvedLoading, priority, revealOnLoadOnly, blurSharesMainUrl]);

  const shouldRevealWebMedia = useMemo(() => {
    if (Platform.OS !== 'web') return true;
    return shouldShowWebImageImmediately || webLoaded;
  }, [shouldShowWebImageImmediately, webLoaded]);

  const shouldRenderWebSkeleton = useMemo(() => {
    if (Platform.OS !== 'web') return false;
    if (blurOnly) return false;
    if (!webMainSrc) return false;
    return !shouldRevealWebMedia;
  }, [blurOnly, shouldRevealWebMedia, webMainSrc]);

  const webImageProps = useMemo(() => {
    if (Platform.OS !== 'web') return undefined;
    return {};
  }, []);

  // Track the base URI (without optimization params) to avoid resetting loaded state
  // when only width/quality changes but the source image is the same
  const baseUriRef = useRef<string | null>(currentBaseImageKey);
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    // Only reset loaded state if the actual image source changed
    if (currentBaseImageKey !== baseUriRef.current) {
      baseUriRef.current = currentBaseImageKey;
      setWebLoaded(Boolean(currentBaseImageKey && loadedWebImageBaseCache.has(currentBaseImageKey)));
    }
  }, [currentBaseImageKey]);

  const handleWebLoad = useCallback((_resolvedSrc: string) => {
    if (currentBaseImageKey) {
      loadedWebImageBaseCache.add(currentBaseImageKey);
    }
    setWebLoaded(true);
    onLoad?.();
  }, [currentBaseImageKey, onLoad]);

  const prefetchHref = useMemo(() => {
    if (Platform.OS !== 'web') return null;
    if (webOptimizedSource) return webOptimizedSource;
    if (resolvedSource && typeof resolvedSource !== 'number') {
      const uri = typeof (resolvedSource as any)?.uri === 'string' ? String((resolvedSource as any).uri).trim() : '';
      return uri || null;
    }
    return src ?? null;
  }, [webOptimizedSource, resolvedSource, src]);

  const canUseResourceHint = useMemo(() => {
    if (Platform.OS !== 'web') return false;
    if (!prefetchHref) return false;
    if (typeof window === 'undefined') return false;
    try {
      const resolved = new URL(prefetchHref, window.location.origin);
      return resolved.origin === window.location.origin;
    } catch {
      return false;
    }
  }, [prefetchHref]);

  const shouldAddWebPrefetchHint = useMemo(() => {
    if (Platform.OS !== 'web') return false;
    if (!prefetch) return false;
    if (resolvedLoading !== 'lazy') return false;
    if (priority !== 'low') return false;
    return true;
  }, [prefetch, resolvedLoading, priority]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (shouldDisableNetwork) return;
    if (!shouldAddWebPrefetchHint) return;
    if (!prefetchHref) return;
    if (!canUseResourceHint) return;
    if (typeof document === 'undefined') return;

    // Keep this as a low-priority prefetch hint only for genuinely non-critical,
    // lazily rendered same-origin images. Critical images are already requested
    // by the actual <img> element via loading/fetchPriority and should not add
    // extra head hints that can survive route changes and trigger browser warnings.
    const rel = 'prefetch';
    const id = `img-hint-${encodeURIComponent(prefetchHref)}`;
    if (document.getElementById(id)) return;

    const link = document.createElement('link');
    link.id = id;
    link.rel = rel;
    link.as = 'image';
    link.href = prefetchHref;
    document.head.appendChild(link);
  }, [shouldAddWebPrefetchHint, prefetchHref, shouldDisableNetwork, canUseResourceHint]);

  return (
    <View
      style={[
        styles.container,
        {
          width,
          height,
          borderRadius: resolvedBorderRadius,
        },
        style,
      ]}
      testID={testID}
    >
      {resolvedSource && !shouldDisableNetwork ? (
        <>
          {Platform.OS === 'web' && shouldRenderWebBlurBackground && webBlurSrc ? (
            <WebBlurBackdrop
              src={webBlurSrc}
              alt={alt || ''}
              width={typeof width === 'number' ? width : 400}
              height={typeof height === 'number' ? height : 300}
              borderRadius={resolvedBorderRadius}
              fit={fit}
              useCssBackdrop={allowCriticalWebBlur && !revealOnLoadOnly}
            />
          ) : null}
          {Platform.OS === 'web' && !isJest && !blurOnly && webMainSrc ? (
            <WebMainImage
              src={webMainSrc}
              srcSet={webSrcSet}
              sizes={webSizes}
              alt={alt || ''}
              width={typeof width === 'number' ? width : 400}
              height={typeof height === 'number' ? height : 300}
              fit={fit}
              borderRadius={resolvedBorderRadius}
              loading={resolvedLoading}
              priority={priority}
              hasBlurBehind={shouldRenderWebBlurBackground}
              loaded={webLoaded}
              onLoad={handleWebLoad}
              onError={onError}
              showImmediately={shouldShowWebImageImmediately}
            />
          ) : !blurOnly && (
            <OptimizedImage
              source={
                Platform.OS === 'web' && webOptimizedSource
                  ? { uri: webOptimizedSource }
                  : resolvedSource
              }
              contentFit={contentFit}
              blurBackground={Platform.OS === 'web' ? false : blurBackground}
              blurBackgroundRadius={blurRadius}
              blurOnly={blurOnly}
              borderRadius={borderRadius}
              placeholder={placeholderBlurhash || DESIGN_TOKENS.defaultBlurhash}
              priority={priority}
              loading={resolvedLoading}
              alt={alt}
              transition={transition}
              cachePolicy={cachePolicy}
              imageProps={{ ...(imageProps || {}), ...(webImageProps || {}) }}
              style={
                Platform.OS === 'web' && shouldRenderWebBlurBackground
                  ? ({ backgroundColor: 'transparent', position: 'relative', zIndex: 1 } as any)
                  : undefined
              }
              onLoad={onLoad}
              onError={onError}
            />
          )}
          {!!overlayColor && (
            <View
              style={[
                StyleSheet.absoluteFillObject,
                { backgroundColor: overlayColor, borderRadius, pointerEvents: 'none' },
              ]}
            />
          )}
          {shouldRenderWebSkeleton ? (
            <ShimmerOverlay style={StyleSheet.absoluteFill} />
          ) : null}
        </>
      ) : (
        <View
          style={[styles.placeholder, { borderRadius }]}
          accessibilityElementsHidden={true}
          aria-hidden={true}
        />
      )}
    </View>
  );
}

const getStyles = (colors: ThemedColors) => StyleSheet.create({
  container: {
    position: 'relative',
    overflow: 'hidden',
  },
  placeholder: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
});

export default memo(ImageCardMedia);

export { prefetchImage } from '@/components/ui/OptimizedImage';
