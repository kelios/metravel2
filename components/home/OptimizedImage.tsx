import { memo, useState, useMemo } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { useThemedColors } from '@/hooks/useTheme';

interface OptimizedImageProps {
  source: any;
  width: number;
  height: number;
  borderRadius?: number;
  alt?: string;
  loadingStrategy?: 'lazy' | 'eager';
  style?: any;
}

function OptimizedImage({
  source,
  width,
  height,
  borderRadius = 0,
  alt,
  loadingStrategy = 'lazy',
  style,
}: OptimizedImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const colors = useThemedColors();

  const resolvedSource = useMemo(() => {
    if (!source) {
      console.warn('[OptimizedImage] No source provided');
      return null;
    }
    
    // ExpoImage handles require() sources directly on web
    // No need to manually resolve with Asset.fromModule
    if (__DEV__) {
      console.log('[OptimizedImage] Source type:', typeof source, 'Value:', source);
    }
    return source;
  }, [source]);

  const styles = useMemo(() => StyleSheet.create({
    container: {
      overflow: 'hidden',
      backgroundColor: colors.backgroundSecondary,
    },
    image: {
      ...(Platform.OS === 'web'
        ? ({
            transitionProperty: 'opacity',
            transitionDuration: '300ms',
            transitionTimingFunction: 'ease-in-out',
          } as any)
        : {}),
    },
    placeholder: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: colors.backgroundSecondary,
      ...(Platform.OS === 'web'
        ? ({
            animationKeyframes: [
              {
                '0%': { opacity: 1 },
                '50%': { opacity: 0.6 },
                '100%': { opacity: 1 },
              },
            ],
            animationDuration: '1500ms',
            animationTimingFunction: 'ease-in-out',
            animationIterationCount: 'infinite',
          } as any)
        : {}),
    },
    errorPlaceholder: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: colors.surfaceMuted,
      justifyContent: 'center',
      alignItems: 'center',
    },
  }), [colors]);

  return (
    <View style={[styles.container, { width, height, borderRadius }]}>
      {!isLoaded && !hasError && (
        <View style={[styles.placeholder, { borderRadius }]} />
      )}

      {!hasError && resolvedSource && (
        <ExpoImage
          source={resolvedSource}
          style={[
            styles.image,
            { width, height, borderRadius, opacity: isLoaded ? 1 : 0 },
            style,
          ]}
          onLoad={() => {
            if (__DEV__) {
              console.log('[OptimizedImage] Image loaded successfully');
            }
            setIsLoaded(true);
          }}
          onError={(error) => {
            console.error('[OptimizedImage] Image failed to load:', error);
            setHasError(true);
          }}
          contentFit="cover"
          transition={300}
          {...(Platform.OS === 'web' ? {
            loading: loadingStrategy as any,
            fetchpriority: (loadingStrategy === 'eager' ? 'high' : 'auto') as any,
            alt: alt || '',
            decoding: 'async' as any,
          } : {})}
        />
      )}

      {hasError && (
        <View style={[styles.errorPlaceholder, { borderRadius }]} />
      )}
    </View>
  );
}

export default memo(OptimizedImage);

