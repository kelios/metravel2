import React, { memo, useEffect, useMemo, useState } from 'react';
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
    const blurSize = 64;
    return (
      optimizeImageUrl(uri, {
        width: blurSize,
        height: blurSize,
        quality: 30,
        blur: 30,
        fit: 'cover',
        format: 'auto',
      }) ?? uri
    );
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
  const [webBlurSrc, setWebBlurSrc] = useState<string | null>(null);
  useEffect(() => {
    setWebBlurSrc(webBlurUri);
  }, [webBlurUri]);

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
      link.setAttribute('fetchpriority', 'high');
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
          borderRadius,
        },
        style,
      ]}
      testID={testID}
    >
      {resolvedSource && !shouldDisableNetwork ? (
        <>
          {Platform.OS === 'web' && blurBackground && (webBlurSrc || webBlurUri) && (
            <img
              src={webBlurSrc || webBlurUri || undefined}
              alt=""
              aria-hidden
              crossOrigin="anonymous"
              onError={() => {
                if (!webBlurFallbackUri) return;
                if (webBlurSrc === webBlurFallbackUri) return;
                setWebBlurSrc(webBlurFallbackUri);
              }}
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                filter: 'blur(18px)',
                transform: 'scale(1.08)',
                zIndex: 0,
              }}
            />
          )}
          {(!blurOnly || Platform.OS !== 'web') && (
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
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.backgroundSecondary,
  },
});

export default memo(ImageCardMedia);

export { prefetchImage } from '@/components/ui/OptimizedImage';
