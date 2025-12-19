import React, { useEffect, useRef, useState } from 'react';
import { Image, View, StyleSheet } from 'react-native';
import { createOptimizedImageSrc, addImageDimensions } from '@/utils/pagespeedOptimizations';

interface OptimizedImageProps {
  src: string;
  alt: string;
  containerWidth?: number;
  containerHeight?: number;
  className?: string;
  style?: any;
  onLoad?: () => void;
  onError?: () => void;
}

export function OptimizedImage({
  src,
  alt,
  containerWidth = 400,
  containerHeight = 300,
  className,
  style,
  onLoad,
  onError,
}: OptimizedImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState(false);
  const imageRef = useRef<any>(null);

  // Generate optimized image URL
  const optimizedSrc = createOptimizedImageSrc(src, containerWidth, containerHeight);

  useEffect(() => {
    // Add image dimensions to prevent layout shift
    if (typeof document !== 'undefined' && imageRef.current) {
      const img = imageRef.current._nativeNode || imageRef.current;
      if (img && img.tagName === 'IMG') {
        img.setAttribute('width', containerWidth.toString());
        img.setAttribute('height', containerHeight.toString());
        img.setAttribute('alt', alt);
      }
    }
  }, [containerWidth, containerHeight, alt]);

  const handleLoad = () => {
    setIsLoaded(true);
    onLoad?.();
  };

  const handleError = () => {
    setError(true);
    onError?.();
  };

  if (error) {
    return (
      <View style={[styles.container, { width: containerWidth, height: containerHeight }, style]}>
        <View style={styles.errorPlaceholder}>
          <View style={styles.placeholderContent}>
            <Image 
              source={require('@/assets/images/placeholder.webp')}
              style={styles.placeholderImage}
              resizeMode="cover"
            />
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { width: containerWidth, height: containerHeight }, style]} className={className}>
      {!isLoaded && <View style={styles.skeleton} />}
      <Image
        ref={imageRef}
        source={{ uri: optimizedSrc }}
        style={[
          styles.image,
          { width: containerWidth, height: containerHeight },
          !isLoaded && { opacity: 0 }
        ]}
        resizeMode="cover"
        onLoad={handleLoad}
        onError={handleError}
        // Performance optimizations
        fadeDuration={priority === 'high' ? 0 : 200}
        // LCP optimizations for high priority images
        priority={priority === 'high' ? 'high' : 'low'}
        // Add explicit dimensions for layout stability
        width={containerWidth}
        height={containerHeight}
        accessibilityLabel={alt}
        accessibilityRole="image"
      />
    </View>
  );
}

// Specialized component for gallery images
export function OptimizedGalleryImage({ src, alt, size = 'medium' }: {
  src: string;
  alt: string;
  size?: 'small' | 'medium' | 'large';
}) {
  const sizeConfig = {
    small: { width: 140, height: 140 },
    medium: { width: 473, height: 229 },
    large: { width: 1024, height: 512 },
  };

  const config = sizeConfig[size];

  return (
    <OptimizedImage
      src={src}
      alt={alt}
      containerWidth={config.width}
      containerHeight={config.height}
      priority={size === 'large' ? 'high' : 'low'}
    />
  );
}

// Specialized component for description images
export function OptimizedDescriptionImage({ src, alt }: {
  src: string;
  alt: string;
}) {
  return (
    <OptimizedImage
      src={src}
      alt={alt}
      containerWidth={473}
      containerHeight={229}
      priority="low"
    />
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    overflow: 'hidden',
  },
  image: {
    borderRadius: 8,
  },
  skeleton: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
  },
  errorContainer: {
    backgroundColor: '#fafafa',
  },
  errorPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderImage: {
    width: '100%',
    height: '100%',
    opacity: 0.5,
  },
});
