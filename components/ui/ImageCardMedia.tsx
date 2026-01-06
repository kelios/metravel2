import React, { memo, useEffect, useMemo } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import type { ImageContentFit } from 'expo-image';
import type { ImageProps as ExpoImageProps } from 'expo-image';

import OptimizedImage from '@/components/ui/OptimizedImage';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';

type Priority = 'low' | 'normal' | 'high';

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
  const colors = useThemedColors();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const resolvedSource = useMemo(() => {
    if (source) return source;
    if (src) return { uri: src };
    return null;
  }, [source, src]);

  const contentFit: ImageContentFit = fit === 'cover' ? 'cover' : 'contain';
  const webImageProps = useMemo(() => {
    if (Platform.OS !== 'web') return undefined;
    return {};
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (!prefetch) return;
    if (priority !== 'high') return;
    if (!src) return;
    if (typeof document === 'undefined') return;

    const id = `prefetch-img-${encodeURIComponent(src)}`;
    if (document.getElementById(id)) return;

    const link = document.createElement('link');
    link.id = id;
    link.rel = 'prefetch';
    link.as = 'image';
    link.href = src;
    document.head.appendChild(link);

    return () => {
      if (link.parentNode) {
        link.parentNode.removeChild(link);
      }
    };
  }, [prefetch, priority, src]);

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
      {resolvedSource ? (
        <>
          <OptimizedImage
            source={resolvedSource}
            contentFit={contentFit}
            blurBackground={blurBackground}
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
            onLoad={onLoad}
            onError={onError}
          />
          {!!overlayColor && (
            <View
              pointerEvents="none"
              style={[StyleSheet.absoluteFillObject, { backgroundColor: overlayColor, borderRadius }]}
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
