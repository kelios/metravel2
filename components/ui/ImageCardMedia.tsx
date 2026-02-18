import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import type { ImageContentFit } from 'expo-image';
import type { ImageProps as ExpoImageProps } from 'expo-image';

import OptimizedImage from '@/components/ui/OptimizedImage';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';
import { optimizeImageUrl, generateSrcSet } from '@/utils/imageOptimization';

type Priority = 'low' | 'normal' | 'high';


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
  onLoad?: () => void;
  onError?: () => void;
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
}: WebMainImageProps) {
  const imgRef = useRef<HTMLImageElement>(null);
  const handleLoad = useCallback(() => {
    onLoad?.();
  }, [onLoad]);

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
        opacity: hasBlurBehind ? (loaded ? 1 : 0) : 1,
        transition: hasBlurBehind ? 'opacity 0.2s ease' : 'none',
        willChange: hasBlurBehind ? 'opacity' : 'auto',
        contain: 'layout',
      }}
      loading={loading}
      decoding="async"
      // @ts-ignore
      fetchPriority={priority === 'high' ? 'high' : 'auto'}
      onLoad={handleLoad}
      onError={onError}
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
}: Props) {
  const isJest =
    typeof process !== 'undefined' && !!(process as any)?.env?.JEST_WORKER_ID;
  const disableRemoteImages =
    __DEV__ && process.env.EXPO_PUBLIC_DISABLE_REMOTE_IMAGES === 'true';
  const colors = useThemedColors();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const contentFit: ImageContentFit = fit === 'cover' ? 'cover' : 'contain';
  const [webLoaded, setWebLoaded] = useState(false);

  const resolvedBorderRadius = useMemo(() => {
    const flattened = StyleSheet.flatten(style) as any;
    const override = flattened?.borderRadius;
    return typeof override === 'number' ? override : borderRadius;
  }, [borderRadius, style]);
  const resolvedSource = useMemo(() => {
    if (source) return source;
    if (src) return { uri: src };
    return null;
  }, [source, src]);
  const shouldDisableNetwork = useMemo(() => {
    if (!disableRemoteImages) return false;
    if (!resolvedSource || typeof resolvedSource === 'number') return false;
    const uri = typeof (resolvedSource as any)?.uri === 'string' ? String((resolvedSource as any).uri).trim() : '';
    if (!uri) return false;
    return !/^(data:|blob:)/i.test(uri);
  }, [disableRemoteImages, resolvedSource]);
  const webOptimizedSource = useMemo(() => {
    if (Platform.OS !== 'web') return null;
    if (!resolvedSource || typeof resolvedSource === 'number') return null;
    const uri = typeof (resolvedSource as any)?.uri === 'string' ? String((resolvedSource as any).uri).trim() : '';
    if (!uri) return null;
    const numericWidth = typeof width === 'number' ? width : undefined;
    const numericHeight = typeof height === 'number' ? height : undefined;
    if (!numericWidth && !numericHeight) return null;
    return (
      optimizeImageUrl(uri, {
        width: numericWidth,
        height: numericHeight,
        quality,
        fit: contentFit === 'contain' ? 'contain' : 'cover',
        format: 'auto',
        dpr: 1,
      }) ?? uri
    );
  }, [resolvedSource, width, height, contentFit, quality]);
  const webMainSrc = useMemo(() => {
    if (Platform.OS !== 'web') return null;
    if (!resolvedSource || typeof resolvedSource === 'number') return null;
    if (shouldDisableNetwork) return null;
    if (webOptimizedSource) return webOptimizedSource;
    const uri = typeof (resolvedSource as any)?.uri === 'string' ? String((resolvedSource as any).uri).trim() : '';
    return uri || null;
  }, [resolvedSource, shouldDisableNetwork, webOptimizedSource]);

  const webSrcSet = useMemo(() => {
    if (Platform.OS !== 'web') return undefined;
    if (!resolvedSource || typeof resolvedSource === 'number') return undefined;
    const uri = typeof (resolvedSource as any)?.uri === 'string' ? String((resolvedSource as any).uri).trim() : '';
    if (!uri) return undefined;
    return generateSrcSet(uri, [160, 320, 480, 640], { quality, fit: contentFit === 'contain' ? 'contain' : 'cover', dpr: 1 }) || undefined;
  }, [resolvedSource, contentFit, quality]);

  const webSizes = useMemo(() => {
    if (Platform.OS !== 'web') return undefined;
    const numW = typeof width === 'number' ? width : 320;
    return `(min-width: 1024px) ${numW}px, (min-width: 768px) 33vw, 50vw`;
  }, [width]);

  // Reuse the same image source for both foreground and blur background on web.
  // This avoids requesting a separate "blur" asset URL.
  const webBlurSrc = useMemo(() => {
    if (Platform.OS !== 'web' || !blurBackground) return null;
    return webMainSrc;
  }, [blurBackground, webMainSrc]);

  const webImageProps = useMemo(() => {
    if (Platform.OS !== 'web') return undefined;
    return {};
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    setWebLoaded(false);
  }, [webMainSrc]);

  const handleWebLoad = useCallback(() => {
    setWebLoaded(true);
    onLoad?.();
  }, [onLoad]);

  const prefetchHref = useMemo(() => {
    if (Platform.OS !== 'web') return null;
    if (webOptimizedSource) return webOptimizedSource;
    if (resolvedSource && typeof resolvedSource !== 'number') {
      const uri = typeof (resolvedSource as any)?.uri === 'string' ? String((resolvedSource as any).uri).trim() : '';
      return uri || null;
    }
    return src ?? null;
  }, [webOptimizedSource, resolvedSource, src]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (shouldDisableNetwork) return;
    if (!prefetch) return;
    if (priority !== 'high') return;
    if (!prefetchHref) return;
    if (typeof document === 'undefined') return;

    const shouldPreload = loading === 'eager' && document.readyState !== 'complete';
    const rel = shouldPreload ? 'preload' : 'prefetch';
    const id = `${rel}-img-${encodeURIComponent(prefetchHref)}`;
    if (document.getElementById(id)) return;

    const link = document.createElement('link');
    link.id = id;
    link.rel = rel;
    link.as = 'image';
    link.href = prefetchHref;
    link.crossOrigin = 'anonymous';
    if (shouldPreload) {
      link.fetchPriority = 'high';
      link.setAttribute('fetchPriority', 'high');
    }
    document.head.appendChild(link);

    return () => {
      if (link.parentNode) {
        link.parentNode.removeChild(link);
      }
    };
  }, [prefetch, priority, prefetchHref, loading, shouldDisableNetwork]);

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
          {Platform.OS === 'web' &&
            blurBackground &&
            webMainSrc && (
              <div
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  inset: '-5%',
                  width: '110%',
                  height: '110%',
                  backgroundImage:
                    webLoaded && (webBlurSrc || webMainSrc)
                      ? `url("${webBlurSrc || webMainSrc}")`
                      : 'none',
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  filter: 'blur(16px)',
                  zIndex: 0,
                  borderRadius: resolvedBorderRadius,
                  opacity: webLoaded ? 1 : 0,
                  contain: 'strict',
                  willChange: 'opacity',
                  backfaceVisibility: 'hidden',
                }}
              />
            )}
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
              loading={loading}
              priority={priority}
              hasBlurBehind={blurBackground}
              loaded={webLoaded}
              onLoad={handleWebLoad}
              onError={onError}
            />
          ) : (!blurOnly || Platform.OS !== 'web') && (
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
              placeholder={placeholderBlurhash}
              priority={priority}
              loading={loading}
              alt={alt}
              transition={transition}
              cachePolicy={cachePolicy}
              imageProps={{ ...(imageProps || {}), ...(webImageProps || {}) }}
              style={
                Platform.OS === 'web' && blurBackground
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
  },
});

export default memo(ImageCardMedia);

export { prefetchImage } from '@/components/ui/OptimizedImage';
