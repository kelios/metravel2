import React, { memo, useState } from 'react';
import { View, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { Image as ExpoImage, ImageContentFit } from 'expo-image';
import { DESIGN_TOKENS } from '@/constants/designSystem';

interface OptimizedImageProps {
  source: { uri: string } | number;
  contentFit?: ImageContentFit;
  aspectRatio?: number;
  width?: number | string;
  height?: number | string;
  borderRadius?: number;
  placeholder?: string; // blurhash
  priority?: 'low' | 'normal' | 'high';
  loading?: 'lazy' | 'eager';
  alt?: string;
  onLoad?: () => void;
  onError?: () => void;
  style?: any;
}

/**
 * Оптимизированный компонент изображения
 * 
 * Особенности:
 * - Автоматическая оптимизация для WebP/AVIF
 * - Lazy loading по умолчанию
 * - Placeholder с blurhash
 * - Индикатор загрузки
 * - Обработка ошибок
 * - Responsive sizing
 * 
 * @example
 * <OptimizedImage
 *   source={{ uri: imageUrl }}
 *   contentFit="cover"
 *   aspectRatio={16/9}
 *   placeholder={blurhash}
 *   loading="lazy"
 * />
 */
function OptimizedImage({
  source,
  contentFit = 'cover',
  aspectRatio,
  width = '100%',
  height,
  borderRadius = 0,
  placeholder,
  priority = 'normal',
  loading = 'lazy',
  alt,
  onLoad,
  onError,
  style,
}: OptimizedImageProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const handleLoad = () => {
    setIsLoading(false);
    onLoad?.();
  };

  const handleError = () => {
    setIsLoading(false);
    setHasError(true);
    onError?.();
  };

  // Определяем приоритет загрузки
  const fetchPriority = priority === 'high' ? 'high' : priority === 'low' ? 'low' : 'auto';

  return (
    <View
      style={[
        styles.container,
        {
          width,
          height: height || (aspectRatio ? undefined : '100%'),
          aspectRatio,
          borderRadius,
        },
        style,
      ]}
    >
      <ExpoImage
        source={source}
        contentFit={contentFit}
        placeholder={placeholder}
        transition={200}
        onLoad={handleLoad}
        onError={handleError}
        style={[
          styles.image,
          {
            borderRadius,
          },
        ]}
        // Web-specific optimizations
        {...(Platform.OS === 'web' && {
          // @ts-ignore - web-specific props
          loading,
          fetchpriority: fetchPriority,
          alt: alt || '',
          decoding: 'async',
        })}
        // Кэширование
        cachePolicy="memory-disk"
        // Приоритет
        priority={priority}
      />

      {/* Индикатор загрузки */}
      {isLoading && !hasError && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator
            size="small"
            color={DESIGN_TOKENS.colors.primary}
          />
        </View>
      )}

      {/* Заглушка при ошибке */}
      {hasError && (
        <View style={[styles.errorContainer, { borderRadius }]}>
          <View style={styles.errorIcon}>
            <View style={styles.errorIconInner} />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: DESIGN_TOKENS.colors.backgroundSecondary,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: DESIGN_TOKENS.colors.backgroundSecondary,
  },
  errorContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: DESIGN_TOKENS.colors.mutedBackground,
  },
  errorIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: DESIGN_TOKENS.colors.disabled,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorIconInner: {
    width: 24,
    height: 2,
    backgroundColor: DESIGN_TOKENS.colors.disabledText,
    transform: [{ rotate: '45deg' }],
  },
});

export default memo(OptimizedImage);

/**
 * Утилита для генерации srcset для responsive images
 * @param baseUrl - Базовый URL изображения
 * @param sizes - Массив размеров [320, 640, 1024, 1920]
 * @returns srcset строка
 */
export function generateSrcSet(baseUrl: string, sizes: number[] = [320, 640, 1024, 1920]): string {
  return sizes
    .map(size => {
      // Предполагаем, что на сервере есть endpoint для ресайза
      const resizedUrl = `${baseUrl}?w=${size}&q=80&fm=webp`;
      return `${resizedUrl} ${size}w`;
    })
    .join(', ');
}

/**
 * Утилита для генерации sizes attribute
 * @param breakpoints - Объект с breakpoints и размерами
 * @returns sizes строка
 */
export function generateSizes(breakpoints: Record<string, string> = {}): string {
  const defaultSizes = {
    mobile: '100vw',
    tablet: '50vw',
    desktop: '33vw',
  };

  const sizes = { ...defaultSizes, ...breakpoints };

  return [
    `(max-width: ${DESIGN_TOKENS.breakpoints.mobile}px) ${sizes.mobile}`,
    `(max-width: ${DESIGN_TOKENS.breakpoints.tablet}px) ${sizes.tablet}`,
    sizes.desktop,
  ].join(', ');
}
