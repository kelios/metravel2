import { memo, useCallback, useEffect, useMemo, useRef } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import type { ImageContentFit } from 'expo-image';
import type { ImageProps as ExpoImageProps } from 'expo-image';

import OptimizedImage from '@/components/ui/OptimizedImage';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';
import { optimizeImageUrl } from '@/utils/imageOptimization';

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
  blurRef,
  onLoad,
  onError,
}: WebMainImageProps & { blurRef?: React.RefObject<HTMLElement | null> }) {
  const imgRef = useRef<HTMLImageElement | null>(null);

  const handleLoad = useCallback(() => {
    const el = imgRef.current;
    if (el) {
      el.style.opacity = '1';
    }
    const blurEl = blurRef?.current;
    if (blurEl) {
      blurEl.style.opacity = '1';
    }
    onLoad?.();
  }, [onLoad, blurRef]);

  return (
    <img
      ref={imgRef}
      src={src}
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
        opacity: hasBlurBehind ? 0 : 1,
        transition: hasBlurBehind ? 'opacity 0.3s ease' : 'none',
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
  const blurImgRef = useRef<HTMLElement | null>(null);

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
        quality: 60,
        fit: contentFit === 'contain' ? 'contain' : 'cover',
        format: 'auto',
        dpr: 1,
      }) ?? uri
    );
  }, [resolvedSource, width, height, contentFit]);
  const webMainSrc = useMemo(() => {
    if (Platform.OS !== 'web') return null;
    if (!resolvedSource || typeof resolvedSource === 'number') return null;
    if (shouldDisableNetwork) return null;
    if (webOptimizedSource) return webOptimizedSource;
    const uri = typeof (resolvedSource as any)?.uri === 'string' ? String((resolvedSource as any).uri).trim() : '';
    return uri || null;
  }, [resolvedSource, shouldDisableNetwork, webOptimizedSource]);

  const webBlurSrc = useMemo(() => {
    if (Platform.OS !== 'web' || !blurBackground) return null;
    if (!resolvedSource || typeof resolvedSource === 'number') return null;
    const uri = typeof (resolvedSource as any)?.uri === 'string' ? String((resolvedSource as any).uri).trim() : '';
    if (!uri) return null;
    return (
      optimizeImageUrl(uri, {
        width: 100,
        quality: 20,
        fit: 'cover',
        format: 'auto',
        dpr: 1,
      }) ?? uri
    );
  }, [resolvedSource, blurBackground]);

  const webImageProps = useMemo(() => {
    if (Platform.OS !== 'web') return undefined;
    return {};
  }, []);

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
                ref={blurImgRef as any}
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  inset: '-5%',
                  width: '110%',
                  height: '110%',
                  backgroundImage: `url("${webBlurSrc || webMainSrc}")`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  filter: 'blur(20px)',
                  zIndex: 0,
                  borderRadius: resolvedBorderRadius,
                  opacity: 0,
                  transition: 'opacity 0.3s ease',
                }}
              />
            )}
          {Platform.OS === 'web' && !isJest && !blurOnly && webMainSrc ? (
            <WebMainImage
              src={webMainSrc}
              alt={alt || ''}
              width={typeof width === 'number' ? width : 400}
              height={typeof height === 'number' ? height : 300}
              fit={fit}
              borderRadius={resolvedBorderRadius}
              loading={loading}
              priority={priority}
              hasBlurBehind={blurBackground}
              blurRef={blurImgRef as any}
              onLoad={onLoad}
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
