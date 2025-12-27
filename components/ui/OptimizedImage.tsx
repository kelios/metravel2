import React, { memo, useState } from 'react';
import { View, StyleSheet, ActivityIndicator, Platform, Text } from 'react-native';
import { Image as ExpoImage, ImageContentFit } from 'expo-image';
import type { ImageProps as ExpoImageProps } from 'expo-image';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { MaterialIcons } from '@expo/vector-icons';

const hasValidUriSource = (source: { uri: string } | number): boolean => {
  if (!source) return false;
  if (typeof source === 'number') return true;
  const uri = typeof (source as any)?.uri === 'string' ? String((source as any).uri).trim() : '';
  return uri.length > 0;
};

interface OptimizedImageProps {
  source: { uri: string } | number;
  contentFit?: ImageContentFit;
  blurBackground?: boolean;
  blurBackgroundRadius?: number;
  blurOnly?: boolean;
  aspectRatio?: number;
  width?: number | string;
  height?: number | string;
  borderRadius?: number;
  placeholder?: string; // blurhash
  priority?: 'low' | 'normal' | 'high';
  loading?: 'lazy' | 'eager';
  alt?: string;
  transition?: number;
  cachePolicy?: ExpoImageProps['cachePolicy'];
  imageProps?: Partial<ExpoImageProps>;
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
  blurBackground = false,
  blurBackgroundRadius = 16,
  blurOnly = false,
  aspectRatio,
  width = '100%',
  height,
  borderRadius = 0,
  placeholder,
  priority = 'normal',
  loading = 'lazy',
  alt,
  transition = 200,
  cachePolicy = 'memory-disk',
  imageProps,
  onLoad,
  onError,
  style,
}: OptimizedImageProps) {
  const validSource = hasValidUriSource(source);
  const [isLoading, setIsLoading] = useState(() => validSource);
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

  const showFallback = !blurOnly && (!validSource || hasError);

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
      {blurBackground && validSource && (
        <>
          <ExpoImage
            source={source}
            contentFit="cover"
            transition={0}
            style={StyleSheet.absoluteFill}
            cachePolicy={cachePolicy}
            blurRadius={blurBackgroundRadius}
            {...(Platform.OS === 'web' && {
              // @ts-ignore - web-specific props
              alt: '',
              decoding: 'async',
            })}
          />
          <View
            style={[
              StyleSheet.absoluteFillObject,
              { backgroundColor: 'rgba(255,255,255,0.18)' },
            ]}
          />
        </>
      )}

      {!blurOnly && validSource && (
        <ExpoImage
          {...(imageProps as any)}
          source={source}
          contentFit={contentFit}
          placeholder={placeholder}
          transition={transition}
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
          cachePolicy={cachePolicy}
        />
      )}

      {/* Индикатор загрузки */}
      {!blurOnly && validSource && isLoading && !hasError && (
        <View style={styles.loadingContainer} testID="optimized-image-loading">
          <ActivityIndicator
            size="small"
            color={DESIGN_TOKENS.colors.primary}
          />
        </View>
      )}

      {/* Заглушка при ошибке / отсутствии uri */}
      {showFallback && (
        <View style={[styles.errorContainer, { borderRadius }]} testID="optimized-image-error">
          <View style={styles.placeholderContent}>
            <MaterialIcons name="image" size={26} color={DESIGN_TOKENS.colors.textMuted} style={{ opacity: 0.55 }} />
            <Text style={styles.placeholderText}>Нет фото</Text>
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
  placeholderContent: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  placeholderText: {
    fontSize: 12,
    fontWeight: '600',
    color: DESIGN_TOKENS.colors.textMuted,
    letterSpacing: -0.1,
    opacity: 0.8,
    textAlign: 'center',
  },
});

export default memo(OptimizedImage);

export async function prefetchImage(uri: string): Promise<void> {
  if (!uri) return;
  const fn = (ExpoImage as any)?.prefetch;
  if (typeof fn === 'function') {
    await fn(uri);
  }
}

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
