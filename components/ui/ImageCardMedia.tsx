import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import type { ImageContentFit } from 'expo-image';
import type { ImageProps as ExpoImageProps } from 'expo-image';

import OptimizedImage from '@/components/ui/OptimizedImage';
import { ShimmerOverlay } from '@/components/ui/ShimmerOverlay';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';
import { optimizeImageUrl, generateSrcSet } from '@/utils/imageOptimization';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import {
  getContainedMediaBox,
} from '@/components/ui/webBlurBackdropLayout';
import {
  WebBlurBackdrop,
  WebMainImage,
  hasOptimizationParams,
  isIOSSafariWeb,
  isIOSSafariUserAgent,
  loadedWebImageBaseCache,
  resolveImageIdentityKey,
  type Priority,
} from '@/components/ui/ImageCardMediaWebHelpers';

const isRootRelativeUrl = (value: string): boolean => /^\/(?!\/)/.test(value);

type Props = {
  src?: string | null;
  source?: { uri: string } | number | null;
  alt?: string;
  height?: number;
  width?: number | string;
  borderRadius?: number;
  fit?: 'contain' | 'cover';
  blurBackground?: boolean;
  /** Native-only: downscaled source for the blurred backdrop layer (cheaper decode). */
  blurSrc?: string | null;
  blurRadius?: number;
  blurOnly?: boolean;
  quality?: number;
  overlayColor?: string;
  placeholderBlurhash?: string;
  /**
   * Low-quality preview URL (e.g. a small thumbnail) shown immediately, blurred,
   * while the main image is still loading. Gives catalog cards a colored preview
   * instead of an empty grey block during lazy fetch. Does NOT change when the
   * sharp main image is revealed — reveal still waits for the main decode.
   */
  placeholderSrc?: string | null;
  priority?: Priority;
  loading?: 'lazy' | 'eager';
  prefetch?: boolean;
  transition?: number;
  cachePolicy?: ExpoImageProps['cachePolicy'];
  imageProps?: Partial<ExpoImageProps>;
  showLoadingIndicator?: boolean;
  testID?: string;
  style?: any;
  onLoad?: () => void;
  onError?: () => void;
  recyclingKey?: string;
  /** Show image immediately without waiting for load (for cached images). */
  showImmediately?: boolean;
  /** Allow blurred web backdrop even for eager/high-priority images. */
  allowCriticalWebBlur?: boolean;
  /** On web, keep main image hidden until onLoad even for eager/high-priority media. */
  revealOnLoadOnly?: boolean;
  /** Source image aspect ratio, used to keep critical blur confined to letterbox gutters. */
  contentAspectRatio?: number;
  /** Preserve the exact pre-optimized URL for critical web media that must match preload. */
  preserveOptimizedWebSrc?: boolean;
  /** Skip web URL resizing when the upstream optimizer returns padded contain canvases. */
  optimizeWeb?: boolean;
  /**
   * Web-only responsive source prepared by a caller that already owns the image
   * variant contract, for example backend media manifest entries.
   */
  webResponsiveSource?: {
    src?: string | null;
    srcSet?: string | null;
    sizes?: string | null;
  } | null;
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
  blurSrc,
  blurRadius = 16,
  blurOnly = false,
  quality = 60,
  overlayColor,
  placeholderBlurhash,
  placeholderSrc,
  priority = 'normal',
  loading = 'lazy',
  prefetch = false,
  transition,
  cachePolicy,
  imageProps,
  showLoadingIndicator = true,
  testID,
  style,
  onLoad,
  onError,
  recyclingKey,
  showImmediately = false,
  allowCriticalWebBlur = false,
  revealOnLoadOnly = false,
  contentAspectRatio,
  preserveOptimizedWebSrc = false,
  optimizeWeb = true,
  webResponsiveSource,
}: Props) {
  const isJest =
    typeof process !== 'undefined' && !!(process as any)?.env?.JEST_WORKER_ID;
  const disableRemoteImages =
    __DEV__ && process.env.EXPO_PUBLIC_DISABLE_REMOTE_IMAGES === 'true';
  const colors = useThemedColors();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const isSafariWeb = useMemo(() => isIOSSafariWeb(), []);
  const contentFit: ImageContentFit = fit === 'cover' ? 'cover' : 'contain';
  const resolvedSource = useMemo(() => {
    if (source) return source;
    if (src) return { uri: src };
    return null;
  }, [source, src]);
  // Identity key keeps signature/`?v=` query (distinguishes different images) while
  // ignoring optimization params (stable across scroll/resize). Used for load-state
  // reset, the loaded-cache and the web media React key so query-only-differing
  // images don't reuse a stale node / stale "loaded" flag.
  const currentImageIdentityKey = useMemo(() => {
    if (!resolvedSource || typeof resolvedSource === 'number') return null;
    if (typeof resolvedSource === 'string') {
      return resolveImageIdentityKey(resolvedSource);
    }
    const uri = typeof (resolvedSource as any)?.uri === 'string' ? String((resolvedSource as any).uri).trim() : '';
    return resolveImageIdentityKey(uri);
  }, [resolvedSource]);
  const [webLoaded, setWebLoaded] = useState(() => {
    return !!(currentImageIdentityKey && loadedWebImageBaseCache.has(currentImageIdentityKey));
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
    return isSafariWeb ? 'eager' : loading;
  }, [isSafariWeb, loading]);

  // Stabilize width/height for image optimization to prevent URL changes on scroll
  // Only update when change is significant (>50px) to avoid re-fetching images
  const stableWidthRef = useRef<number | undefined>(typeof width === 'number' ? width : undefined);
  const stableHeightRef = useRef<number | undefined>(typeof height === 'number' ? height : undefined);
  // Separate identity trackers per dimension so each memo resets its own baseline
  // when the image identity changes (recycle) without cross-memo coordination.
  const stableWidthIdentityRef = useRef<string | null>(null);
  const stableHeightIdentityRef = useRef<string | null>(null);

  const stableWidth = useMemo(() => {
    const numericWidth = typeof width === 'number' ? width : undefined;
    // On recycle (new image in a reused cell) reset the baseline to current props
    // so the new src isn't optimized for the previous item's dimensions.
    if (currentImageIdentityKey !== stableWidthIdentityRef.current) {
      stableWidthIdentityRef.current = currentImageIdentityKey;
      stableWidthRef.current = numericWidth;
      return stableWidthRef.current;
    }
    if (numericWidth !== undefined && stableWidthRef.current !== undefined) {
      if (Math.abs(numericWidth - stableWidthRef.current) > 50) {
        stableWidthRef.current = numericWidth;
      }
    } else if (numericWidth !== undefined) {
      stableWidthRef.current = numericWidth;
    }
    return stableWidthRef.current;
  }, [width, currentImageIdentityKey]);

  const stableHeight = useMemo(() => {
    const numericHeight = typeof height === 'number' ? height : undefined;
    if (currentImageIdentityKey !== stableHeightIdentityRef.current) {
      stableHeightIdentityRef.current = currentImageIdentityKey;
      stableHeightRef.current = numericHeight;
      return stableHeightRef.current;
    }
    if (numericHeight !== undefined && stableHeightRef.current !== undefined) {
      if (Math.abs(numericHeight - stableHeightRef.current) > 50) {
        stableHeightRef.current = numericHeight;
      }
    } else if (numericHeight !== undefined) {
      stableHeightRef.current = numericHeight;
    }
    return stableHeightRef.current;
  }, [height, currentImageIdentityKey]);

  const shouldPreserveProvidedOptimizedUrl = useCallback((uri: string): boolean => {
    if (!hasOptimizationParams(uri)) return false;
    // An explicitly preserved URL (e.g. slider's buildUriWeb output) is already the
    // FINAL variant — honor it for EVERY slide state, not only the active/critical-blur
    // one. Otherwise preloaded/neighbour slides re-optimize the src and emit a srcSet,
    // so the browser downloads a second differently-sized variant of the same photo
    // (the gallery double-fetch).
    if (preserveOptimizedWebSrc) return true;
    if (!allowCriticalWebBlur) return false;
    // Keep all non-Safari browsers on the previous behavior.
    // iPhone Safari is the only browser where we need responsive srcSet restored.
    return !isSafariWeb;
  }, [allowCriticalWebBlur, isSafariWeb, preserveOptimizedWebSrc]);

  const providedWebResponsiveSource = useMemo(() => {
    if (Platform.OS !== 'web') return null;
    const nextSrc = typeof webResponsiveSource?.src === 'string' ? webResponsiveSource.src.trim() : '';
    if (!nextSrc) return null;
    return {
      src: nextSrc,
      srcSet:
        typeof webResponsiveSource?.srcSet === 'string' && webResponsiveSource.srcSet.trim()
          ? webResponsiveSource.srcSet.trim()
          : undefined,
      sizes:
        typeof webResponsiveSource?.sizes === 'string' && webResponsiveSource.sizes.trim()
          ? webResponsiveSource.sizes.trim()
          : undefined,
    };
  }, [webResponsiveSource]);

  const webOptimizedSource = useMemo(() => {
    if (Platform.OS !== 'web') return null;
    if (providedWebResponsiveSource?.src) return providedWebResponsiveSource.src;
    if (!resolvedSource || typeof resolvedSource === 'number') return null;
    // Handle local asset string from require() on web
    if (typeof resolvedSource === 'string') return resolvedSource;
    const uri = typeof (resolvedSource as any)?.uri === 'string' ? String((resolvedSource as any).uri).trim() : '';
    if (!uri) return null;
    if (isRootRelativeUrl(uri)) return uri;
    if (!optimizeWeb) return uri;
    if (shouldPreserveProvidedOptimizedUrl(uri)) return uri;
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
  }, [providedWebResponsiveSource, resolvedSource, optimizeWeb, shouldPreserveProvidedOptimizedUrl, stableWidth, stableHeight, contentFit, quality]);
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
    if (providedWebResponsiveSource) return providedWebResponsiveSource.srcSet;
    if (!resolvedSource || typeof resolvedSource === 'number') return undefined;
    // Skip srcset for local assets
    if (typeof resolvedSource === 'string') return undefined;
    const uri = typeof (resolvedSource as any)?.uri === 'string' ? String((resolvedSource as any).uri).trim() : '';
    if (!uri) return undefined;
    if (isRootRelativeUrl(uri)) return undefined;
    if (!optimizeWeb) return undefined;
    if (shouldPreserveProvidedOptimizedUrl(uri)) return undefined;
    // Use stable width to prevent srcset changes on scroll
    const baseWidth = stableWidth ?? (isSafariWeb ? 400 : 320);
    const maxResponsiveMultiplier = isSafariWeb ? 3 : 2;
    const srcSetWidths = [
      Math.max(160, Math.round(baseWidth * 0.5)),
      Math.max(320, Math.round(baseWidth)),
      Math.max(480, Math.round(baseWidth * 1.5)),
      Math.max(640, Math.round(baseWidth * 2)),
      ...(maxResponsiveMultiplier > 2
        ? [Math.max(720, Math.round(baseWidth * maxResponsiveMultiplier))]
        : []),
    ];
    const uniqueSortedWidths = Array.from(new Set(srcSetWidths)).sort((a, b) => a - b);
    return (
      generateSrcSet(uri, uniqueSortedWidths, {
        quality,
        fit: contentFit === 'contain' ? 'contain' : 'cover',
      }) || undefined
    );
  }, [providedWebResponsiveSource, resolvedSource, optimizeWeb, shouldPreserveProvidedOptimizedUrl, contentFit, quality, stableWidth, isSafariWeb]);

  const webSizes = useMemo(() => {
    if (Platform.OS !== 'web') return undefined;
    if (providedWebResponsiveSource?.sizes) return providedWebResponsiveSource.sizes;
    if (typeof width === 'number' && Number.isFinite(width) && width > 0) {
      return `${Math.round(width)}px`;
    }
    if (isSafariWeb) {
      return '(min-width: 768px) 50vw, 100vw';
    }
    return '(min-width: 1024px) 320px, (min-width: 768px) 33vw, 50vw';
  }, [providedWebResponsiveSource, width, isSafariWeb]);

  const shouldRenderWebBlurBackground = useMemo(() => {
    if (Platform.OS !== 'web') return false;
    if (!blurBackground || !webMainSrc) return false;
    if (allowCriticalWebBlur) return true;
    if (isSafariWeb) return true;
    // Avoid promoting the oversized blur backdrop to LCP on eager/critical images
    // unless the caller explicitly opts in for layout fidelity.
    return !(loading === 'eager' || priority === 'high');
  }, [allowCriticalWebBlur, blurBackground, isSafariWeb, loading, priority, webMainSrc]);
  const webBackdropContentBox = useMemo(() => {
    if (Platform.OS !== 'web') return null;
    if (fit !== 'contain') return null;
    if (typeof width !== 'number' || typeof height !== 'number') return null;

    return getContainedMediaBox({
      containerWidth: width,
      containerHeight: height,
      contentAspectRatio: contentAspectRatio ?? null,
    });
  }, [contentAspectRatio, fit, height, width]);

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
    if (isSafariWeb && allowCriticalWebBlur && !preserveOptimizedWebSrc) {
      // iPhone Safari tends to paint a visibly blurry progressive frame when
      // contain-mode shared-blur cards reveal the main image before onLoad.
      // This hits the large high-priority "Маршрут недели" card hardest, so the
      // wait MUST apply regardless of priority — `priority="high"` was the only
      // prop that set this card apart from the popular cards and it was the thing
      // defeating the protection. fetchPriority="high" still requests the image
      // eagerly; we only defer the *reveal* until the sharp decode finishes.
      return showImmediately;
    }
    return showImmediately || resolvedLoading === 'eager' || priority === 'high';
  }, [
    allowCriticalWebBlur,
    isSafariWeb,
    preserveOptimizedWebSrc,
    priority,
    revealOnLoadOnly,
    resolvedLoading,
    showImmediately,
  ]);

  const shouldRevealWebMedia = useMemo(() => {
    if (Platform.OS !== 'web') return true;
    return shouldShowWebImageImmediately || webLoaded;
  }, [shouldShowWebImageImmediately, webLoaded]);

  const shouldShowWebBlurBackdrop = useMemo(() => {
    if (Platform.OS !== 'web') return true;
    if (!blurSharesMainUrl) return true;
    return shouldRevealWebMedia;
  }, [blurSharesMainUrl, shouldRevealWebMedia]);

  const shouldRenderWebSkeleton = useMemo(() => {
    if (Platform.OS !== 'web') return false;
    if (blurOnly) return false;
    if (!webMainSrc) return false;
    return !shouldRevealWebMedia;
  }, [blurOnly, shouldRevealWebMedia, webMainSrc]);

  // Low-quality preview shown immediately (blurred) while the main image loads,
  // so a catalog card reads as "loading" with the photo's colors instead of an
  // empty grey block. Independent of the sharp reveal gate.
  const webPlaceholderSrc = useMemo(() => {
    if (Platform.OS !== 'web') return null;
    const raw = typeof placeholderSrc === 'string' ? placeholderSrc.trim() : '';
    if (!raw) return null;
    if (raw === webMainSrc) return null;
    if (isRootRelativeUrl(raw)) return raw;
    return (
      optimizeImageUrl(raw, {
        width: 64,
        height: 64,
        quality: 28,
        format: 'jpg',
        fit: 'cover',
      }) ?? raw
    );
  }, [placeholderSrc, webMainSrc]);

  const shouldRenderWebPlaceholder = useMemo(() => {
    if (Platform.OS !== 'web') return false;
    if (blurOnly) return false;
    if (!webPlaceholderSrc) return false;
    return !shouldRevealWebMedia;
  }, [blurOnly, shouldRevealWebMedia, webPlaceholderSrc]);
  const webImageProps = useMemo(() => {
    if (Platform.OS !== 'web') return undefined;
    return {};
  }, []);

  // Track the base URI (without optimization params) to avoid resetting loaded state
  // when only width/quality changes but the source image is the same
  const baseUriRef = useRef<string | null>(currentImageIdentityKey);
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    // Reset loaded state when the underlying image identity changes (different
    // signature/version), but stay stable across optimization-param changes.
    if (currentImageIdentityKey !== baseUriRef.current) {
      baseUriRef.current = currentImageIdentityKey;
      setWebLoaded(Boolean(currentImageIdentityKey && loadedWebImageBaseCache.has(currentImageIdentityKey)));
    }
  }, [currentImageIdentityKey]);

  const handleWebLoad = useCallback((_resolvedSrc: string) => {
    if (currentImageIdentityKey) {
      loadedWebImageBaseCache.add(currentImageIdentityKey);
    }
    setWebLoaded(true);
    onLoad?.();
  }, [currentImageIdentityKey, onLoad]);

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

    // Удаляем узел при unmount / смене prefetchHref — иначе в ленивых списках
    // <head> копит по одному осиротевшему <link> на каждый уникальный URL.
    return () => {
      link.remove();
    };
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
      {...(Platform.OS === 'web' && testID ? ({ 'data-testid': testID } as any) : {})}
      testID={Platform.OS === 'web' ? undefined : testID}
    >
      {resolvedSource && !shouldDisableNetwork ? (
        <>
          {Platform.OS === 'web' && shouldRenderWebBlurBackground && webBlurSrc ? (
            <WebBlurBackdrop
              // Stable positional key (no image identity): on list recycling React
              // reuses this node and swaps the background src instead of remounting,
              // so the previous decoded backdrop holds until the new one is ready
              // (prevents the empty-frame flash while scrolling the catalog).
              key="blur-web-media"
              src={webBlurSrc}
              alt={alt || ''}
              width={typeof width === 'number' ? width : 400}
              height={typeof height === 'number' ? height : 300}
              borderRadius={resolvedBorderRadius}
              fit={fit}
              useCssBackdrop={allowCriticalWebBlur && !revealOnLoadOnly}
              visible={shouldShowWebBlurBackdrop}
              contentBox={webBackdropContentBox}
            />
          ) : null}
          {shouldRenderWebPlaceholder && webPlaceholderSrc ? (
            <img
              key="placeholder-web-media"
              aria-hidden="true"
              src={webPlaceholderSrc}
              alt=""
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                objectPosition: 'center',
                borderRadius: resolvedBorderRadius,
                filter: 'blur(12px) saturate(1.05)',
                transform: 'scale(1.08)',
                zIndex: 0,
                display: 'block',
                pointerEvents: 'none',
              }}
              decoding="async"
              // @ts-ignore -- fetchPriority is a valid img attribute not in React DOM typings yet
              fetchPriority="low"
            />
          ) : null}
          {Platform.OS === 'web' && !isJest && !blurOnly && webMainSrc ? (
            <WebMainImage
              // Stable positional key (no image identity): reused across catalog
              // recycling so only `src`/`srcSet` change on the same <img>. The
              // browser keeps the previously decoded frame visible until the new
              // source decodes, eliminating the empty-frame flash on scroll. Load
              // state stays correct via the identity effects (webLoaded reset +
              // WebMainImage's own [src] reset), which do not depend on remounting.
              key="main-web-media"
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
            recyclingKey={recyclingKey}
            height={typeof height === 'number' ? height : undefined}
            contentFit={contentFit}
            blurBackground={Platform.OS === 'web' ? false : blurBackground}
            blurSource={
              Platform.OS !== 'web' && blurSrc ? { uri: blurSrc } : undefined
            }
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
              showLoadingIndicator={showLoadingIndicator}
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
export { isIOSSafariUserAgent };
