import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { optimizeLCPImage, ultraCriticalCSS } from '@/utils/advancedPerformanceOptimization';

interface OptimizedLCPImageProps {
  src: string;
  alt: string;
  priority?: 'high' | 'low';
  className?: string;
  style?: any;
  onLoad?: () => void;
  onError?: () => void;
}

export function OptimizedLCPImage({
  src,
  alt,
  priority = 'high',
  className,
  style,
  onLoad,
  onError,
}: OptimizedLCPImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState(false);
  const imageRef = useRef<any>(null);

  useEffect(() => {
    // Inject ultra-critical CSS
    if (typeof document !== 'undefined') {
      const criticalStyle = document.createElement('style');
      criticalStyle.textContent = ultraCriticalCSS;
      criticalStyle.setAttribute('data-lcp-critical', 'true');
      if (!document.querySelector('[data-lcp-critical]')) {
        document.head.insertBefore(criticalStyle, document.head.firstChild);
      }
    }

    // Preload image for LCP
    if (priority === 'high' && typeof document !== 'undefined') {
      const optimizedSrc = optimizeLCPImage(src);
      const preloadLink = document.createElement('link');
      preloadLink.rel = 'preload';
      preloadLink.as = 'image';
      preloadLink.href = optimizedSrc;
      preloadLink.fetchPriority = 'high';
      document.head.appendChild(preloadLink);
    }
  }, [src, priority]);

  const optimizedSrc = optimizeLCPImage(src);

  const handleLoad = () => {
    setIsLoaded(true);
    onLoad?.();
    
    // Report LCP to performance monitoring
    if (typeof window !== 'undefined' && 'PerformanceObserver' in window) {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        console.info(`[LCP] Optimized image loaded in: ${lastEntry.startTime.toFixed(2)}ms`);
      });
      observer.observe({ entryTypes: ['largest-contentful-paint'] });
    }
  };

  const handleError = () => {
    setError(true);
    onError?.();
  };

  if (error) {
    return (
      <View style={[styles.container, styles.errorContainer, style]}>
        <View style={styles.errorPlaceholder}>
          <View style={styles.placeholderContent}>
            <Text style={styles.placeholderText}>Изображение недоступно</Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, style]} className={className}>
      {!isLoaded && <View style={styles.skeleton} />}
      <ExpoImage
        source={{ uri: optimizedSrc }}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        priority={priority === 'high' ? 'high' : 'low'}
        cachePolicy="disk"
        accessibilityLabel=""
        accessibilityRole="image"
        fadeDuration={0}
        placeholder="blur"
        blurRadius={18}
      />
      <View style={styles.blurOverlay} />
      <ExpoImage
        ref={imageRef}
        source={{ uri: optimizedSrc }}
        style={[styles.image, !isLoaded && { opacity: 0 }]}
        contentFit="contain"
        priority={priority === 'high' ? 'high' : 'low'}
        cachePolicy="disk"
        onLoad={handleLoad}
        onError={handleError}
        accessibilityLabel={alt}
        accessibilityRole="image"
        // LCP optimizations
        fadeDuration={priority === 'high' ? 0 : 200}
        // Performance optimizations
        placeholder="blur"
        blurRadius={priority === 'high' ? 0 : 20}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#f0f0f0',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  blurOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  skeleton: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#f0f0f0',
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
  },
  placeholderText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
});
