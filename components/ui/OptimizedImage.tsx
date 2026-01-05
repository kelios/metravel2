import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, ActivityIndicator, Platform, Text } from 'react-native';
import { Image as ExpoImage, ImageContentFit } from 'expo-image';
import type { ImageProps as ExpoImageProps } from 'expo-image';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';
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
  const colors = useThemedColors();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const validSource = hasValidUriSource(source);
  const [isLoading, setIsLoading] = useState(() => validSource);
  const [hasError, setHasError] = useState(false);
  const [retryAttempt, setRetryAttempt] = useState(0);
  const [lastUriKey, setLastUriKey] = useState('');
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const uriKey = useMemo(() => {
    if (typeof source === 'number') return '__asset__';
    const uri = typeof (source as any)?.uri === 'string' ? String((source as any).uri).trim() : '';
    return uri;
  }, [source]);

  useEffect(() => {
    if (uriKey === lastUriKey) return;
    setLastUriKey(uriKey);
    setHasError(false);
    setRetryAttempt(0);
    setIsLoading(Boolean(validSource));

    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
  }, [uriKey, lastUriKey, validSource]);

  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
    };
  }, []);

  const resolvedSource = useMemo(() => {
    if (typeof source === 'number') return source;
    const uri = typeof (source as any)?.uri === 'string' ? String((source as any).uri).trim() : '';
    if (!uri) return source;
    if (/^(blob:|data:)/i.test(uri)) return source;
    if (!/^https?:\/\//i.test(uri)) return source;

    if (retryAttempt <= 0) return source;

    const glue = uri.includes('?') ? '&' : '?';
    return { ...(source as any), uri: `${uri}${glue}__retry=${retryAttempt}` };
  }, [source, retryAttempt]);

  const webBlobOrDataUri = useMemo(() => {
    if (Platform.OS !== 'web') return null;
    if (!validSource) return null;
    if (typeof source === 'number') return null;
    const uri = typeof (source as any)?.uri === 'string' ? String((source as any).uri).trim() : '';
    if (!uri) return null;
    if (/^(blob:|data:)/i.test(uri)) return uri;
    return null;
  }, [source, validSource]);

  const shouldRenderBlurBackground = blurBackground && validSource && !webBlobOrDataUri;

  const handleLoad = () => {
    setIsLoading(false);
    setHasError(false);
    onLoad?.();
  };

  const handleError = () => {
    const uri = typeof (source as any)?.uri === 'string' ? String((source as any).uri).trim() : '';
    const canRetry =
      Platform.OS === 'web' &&
      typeof source !== 'number' &&
      uri.length > 0 &&
      /^https?:\/\//i.test(uri) &&
      !/^(blob:|data:)/i.test(uri);

    // Retry a few times with cache-busting query param.
    if (canRetry && retryAttempt < 6) {
      setIsLoading(true);
      setHasError(false);

      if (!retryTimeoutRef.current) {
        const delays = [300, 600, 1200, 2000, 2500, 3000];
        const delayMs = delays[Math.min(retryAttempt, delays.length - 1)];
        retryTimeoutRef.current = setTimeout(() => {
          retryTimeoutRef.current = null;
          setRetryAttempt((prev) => prev + 1);
        }, delayMs);
      }

      onError?.();
      return;
    }

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
      {!blurOnly && !!webBlobOrDataUri && !hasError && (
        <img
          src={webBlobOrDataUri}
          alt={alt || ''}
          onLoad={handleLoad}
          onError={handleError}
          style={{
            width: '100%',
            height: '100%',
            objectFit: contentFit === 'cover' ? 'cover' : 'contain',
            borderRadius,
            display: 'block',
          }}
          loading={loading}
          decoding="async"
        />
      )}

      {shouldRenderBlurBackground && (
        <>
          <ExpoImage
            source={resolvedSource}
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

      {!blurOnly && validSource && !webBlobOrDataUri && (
        <ExpoImage
          {...(imageProps as any)}
          source={resolvedSource}
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
            color={colors.primary}
          />
        </View>
      )}

      {/* Заглушка при ошибке / отсутствии uri */}
      {showFallback && (
        <View style={[styles.errorContainer, { borderRadius }]} testID="optimized-image-error">
          <View style={styles.placeholderContent}>
            <MaterialIcons name="image" size={26} color={colors.textMuted} style={{ opacity: 0.55 }} />
            <Text style={styles.placeholderText}>Нет фото</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const getStyles = (colors: ThemedColors) => StyleSheet.create({
  container: {
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: colors.backgroundSecondary,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.backgroundSecondary,
  },
  errorContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.mutedBackground,
  },
  placeholderContent: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  placeholderText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
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
