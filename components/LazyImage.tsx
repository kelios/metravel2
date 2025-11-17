// Компонент для ленивой загрузки изображений с Intersection Observer
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, Image, StyleSheet, Platform } from 'react-native';
import { Image as ExpoImage } from 'expo-image';

interface LazyImageProps {
  source: { uri: string } | number;
  style?: any;
  placeholder?: string;
  alt?: string;
  onLoad?: () => void;
  onError?: () => void;
  priority?: boolean;
  threshold?: number;
}

export default function LazyImage({
  source,
  style,
  placeholder,
  alt,
  onLoad,
  onError,
  priority = false,
  threshold = 0.1,
}: LazyImageProps) {
  const [isVisible, setIsVisible] = useState(priority);
  const [hasError, setHasError] = useState(false);
  const imageRef = useRef<View>(null);

  useEffect(() => {
    // Если приоритетное изображение или не веб - загружаем сразу
    if (priority || Platform.OS !== 'web') {
      setIsVisible(true);
      return;
    }

    // Используем Intersection Observer для веб
    if (Platform.OS === 'web' && typeof window !== 'undefined' && 'IntersectionObserver' in window) {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              setIsVisible(true);
              observer.disconnect();
            }
          });
        },
        {
          threshold,
          rootMargin: '50px', // Начинаем загрузку за 50px до появления в viewport
        }
      );

      const currentRef = imageRef.current;
      if (currentRef) {
        // @ts-ignore - для веб-версии
        const domNode = currentRef._nativeNode || currentRef;
        if (domNode) {
          observer.observe(domNode);
        }
      }

      return () => {
        observer.disconnect();
      };
    } else {
      // Fallback: загружаем сразу, если Intersection Observer не поддерживается
      setIsVisible(true);
    }
  }, [priority, threshold]);

  const handleLoad = useCallback(() => {
    onLoad?.();
  }, [onLoad]);

  const handleError = useCallback(() => {
    setHasError(true);
    onError?.();
  }, [onError]);

  if (hasError && placeholder) {
    return (
      <View style={[styles.container, style]}>
        <Image source={{ uri: placeholder }} style={[styles.image, style]} />
      </View>
    );
  }

  if (!isVisible) {
    // Показываем placeholder пока изображение не видно
    return (
      <View ref={imageRef} style={[styles.container, style, styles.placeholder]}>
        {placeholder ? (
          <Image source={{ uri: placeholder }} style={[styles.image, style]} />
        ) : (
          <View style={[styles.image, style, styles.placeholderBg]} />
        )}
      </View>
    );
  }

  // Используем ExpoImage для нативной версии, обычный Image для веб
  if (Platform.OS === 'web') {
    return (
      <img
        ref={imageRef as any}
        src={typeof source === 'object' ? source.uri : undefined}
        alt={alt || ''}
        style={style}
        onLoad={handleLoad}
        onError={handleError}
        loading={priority ? 'eager' : 'lazy'}
      />
    );
  }

  return (
    <ExpoImage
      ref={imageRef}
      source={source}
      style={style}
      contentFit="cover"
      transition={200}
      cachePolicy="memory-disk"
      onLoad={handleLoad}
      onError={handleError}
      placeholder={placeholder ? { blurhash: placeholder } : undefined}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    backgroundColor: '#e0e0e0',
  },
  placeholderBg: {
    backgroundColor: '#f0f0f0',
  },
});

