import { memo, useEffect, useMemo } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import type { ImageContentFit } from 'expo-image';
import type { ImageProps as ExpoImageProps } from 'expo-image';

import OptimizedImage from '@/components/ui/OptimizedImage';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';
import { optimizeImageUrl } from '@/utils/imageOptimization';

type Priority = 'low' | 'normal' | 'high';

const buildApiPrefixedUrl = (value: string): string | null => {
  try {
    const baseRaw =
      process.env.EXPO_PUBLIC_API_URL || (typeof window !== 'undefined' ? window.location.origin : '');
    if (!/\/api\/?$/i.test(baseRaw)) return null;

    const apiOrigin = baseRaw.replace(/\/api\/?$/, '');
    const parsed = new URL(value, apiOrigin);
    if (parsed.pathname.startsWith('/api/')) return null;

    return `${apiOrigin}/api${parsed.pathname}${parsed.search}`;
  } catch {
    return null;
  }
};

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
        quality: 80,
        fit: contentFit === 'contain' ? 'contain' : 'cover',
        format: 'auto',
      }) ?? uri
    );
  }, [resolvedSource, width, height, contentFit]);
  const webBlurUri = useMemo(() => {
    if (Platform.OS !== 'web') return null;
    if (!resolvedSource || typeof resolvedSource === 'number') return null;
    const uri = typeof (resolvedSource as any)?.uri === 'string' ? String((resolvedSource as any).uri).trim() : '';
    if (!uri) return null;
    if (/^(data:|blob:)/i.test(uri)) return uri;
    const blurSize = 64;
    const optimized = optimizeImageUrl(uri, {
      width: blurSize,
      height: blurSize,
      quality: 30,
      blur: 30,
      fit: 'cover',
      format: 'auto',
    }) ?? uri;
    
    return optimized;
  }, [resolvedSource]);
  const webBlurFallbackUri = useMemo(() => {
    if (Platform.OS !== 'web') return null;
    if (!resolvedSource || typeof resolvedSource === 'number') return null;
    const uri = typeof (resolvedSource as any)?.uri === 'string' ? String((resolvedSource as any).uri).trim() : '';
    if (!uri) return null;
    const fallback = buildApiPrefixedUrl(uri);
    if (!fallback || fallback === uri) return null;
    const blurSize = 64;
    return (
      optimizeImageUrl(fallback, {
        width: blurSize,
        height: blurSize,
        quality: 30,
        blur: 30,
        fit: 'cover',
        format: 'auto',
      }) ?? fallback
    );
  }, [resolvedSource]);

  const webMainSrc = useMemo(() => {
    if (Platform.OS !== 'web') return null;
    if (!resolvedSource || typeof resolvedSource === 'number') return null;
    if (shouldDisableNetwork) return null;
    if (webOptimizedSource) return webOptimizedSource;
    const uri = typeof (resolvedSource as any)?.uri === 'string' ? String((resolvedSource as any).uri).trim() : '';
    return uri || null;
  }, [resolvedSource, shouldDisableNetwork, webOptimizedSource]);

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
            (webBlurUri || webBlurFallbackUri) && (
              <img
                aria-hidden
                src={webBlurUri || webBlurFallbackUri || undefined}
                alt=""
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: '50%',
                  width: '110%',
                  height: '110%',
                  maxWidth: 'none',
                  maxHeight: 'none',
                  objectFit: 'cover',
                  objectPosition: 'center',
                  filter: 'blur(20px)',
                  transform: 'translate(-50%, -50%)',
                  zIndex: 0,
                  borderRadius: resolvedBorderRadius,
                  display: 'block',
                }}
                loading="eager"
                decoding="auto"
                // @ts-ignore
                fetchPriority="low"
                onError={(e) => {
                  if (
                    webBlurFallbackUri &&
                    (e.target as HTMLImageElement).src !== webBlurFallbackUri
                  ) {
                    (e.target as HTMLImageElement).src = webBlurFallbackUri;
                  }
                }}
              />
            )}
          {Platform.OS === 'web' && !isJest && !blurOnly && webMainSrc ? (
            <img
              src={webMainSrc}
              alt={alt || ''}
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
                borderRadius: resolvedBorderRadius,
                display: 'block',
              }}
              loading={loading}
              decoding="auto"
              // @ts-ignore
              fetchPriority={priority === 'high' ? 'high' : 'auto'}
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
    ...Platform.select({
      web: {
        backgroundImage:
          `linear-gradient(135deg, ${colors.backgroundSecondary} 0%, ${colors.backgroundTertiary} 50%, ${colors.backgroundSecondary} 100%)`,
      },
    }),
  },
});

export default memo(ImageCardMedia);

export { prefetchImage } from '@/components/ui/OptimizedImage';
