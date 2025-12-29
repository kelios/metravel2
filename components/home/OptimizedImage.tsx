import React, { memo, useState } from 'react';
import { Image, View, StyleSheet, Platform, ImageProps } from 'react-native';
import { DESIGN_TOKENS } from '@/constants/designSystem';

interface OptimizedImageProps extends Omit<ImageProps, 'source'> {
  source: any;
  width: number;
  height: number;
  borderRadius?: number;
  alt?: string;
}

function OptimizedImage({
  source,
  width,
  height,
  borderRadius = 0,
  alt,
  style,
  ...props
}: OptimizedImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  return (
    <View style={[styles.container, { width, height, borderRadius }]}>
      {!isLoaded && !hasError && (
        <View style={[styles.placeholder, { borderRadius }]} />
      )}

      {!hasError && (
        <Image
          source={source}
          style={[
            styles.image,
            { width, height, borderRadius, opacity: isLoaded ? 1 : 0 },
            style,
          ]}
          onLoad={() => setIsLoaded(true)}
          onError={() => setHasError(true)}
          resizeMode="cover"
          {...(Platform.OS === 'web' ? {
            loading: 'lazy' as any,
            alt: alt || '',
            decoding: 'async' as any,
          } : {})}
          {...props}
        />
      )}

      {hasError && (
        <View style={[styles.errorPlaceholder, { borderRadius }]} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    backgroundColor: DESIGN_TOKENS.colors.backgroundSecondary,
  },
  image: {
    ...Platform.select({
      web: {
        transition: 'opacity 0.3s ease-in-out',
      },
    }),
  },
  placeholder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: DESIGN_TOKENS.colors.backgroundSecondary,
    ...Platform.select({
      web: {
        animation: 'pulse 1.5s ease-in-out infinite',
      },
    }),
  },
  errorPlaceholder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: DESIGN_TOKENS.colors.mutedBackground,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default memo(OptimizedImage);

