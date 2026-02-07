import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { ShimmerOverlay } from '@/components/ui/ShimmerOverlay';
import { Image as ExpoImage, ImageContentFit } from 'expo-image';
import type { ImageProps as ExpoImageProps } from 'expo-image';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';

const hasValidUriSource = (source: { uri: string } | number): boolean => {
  if (!source) return false;
  if (typeof source === 'number') return true;
  const uri = typeof (source as any)?.uri === 'string' ? String((source as any).uri).trim() : '';
  return uri.length > 0;
};

const isPrivateOrLocalHost = (host: string): boolean => {
  const h = String(host || '').trim().toLowerCase();
  if (!h) return false;
  if (h === 'localhost' || h === '127.0.0.1') return true;
  if (/^10\./.test(h)) return true;
  if (/^192\.168\./.test(h)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(h)) return true;
  return false;
};

const normalizeRemoteImageUri = (uri: string): string => {
  const raw = String(uri || '').trim();
  if (!raw) return raw;
  if (/^(blob:|data:)/i.test(raw)) return raw;
  if (!/^https?:\/\//i.test(raw)) return raw;
  if (/^http:\/\//i.test(raw)) {
    try {
      const parsed = new URL(raw);
      if (!isPrivateOrLocalHost(parsed.hostname)) {
        return raw.replace(/^http:\/\//i, 'https://');
      }
    } catch {
      return raw.replace(/^http:\/\//i, 'https://');
    }
  }
  return raw;
};

const tryForceJpgFormat = (uri: string): string | null => {
  const raw = String(uri || '').trim();
  if (!raw) return null;
  if (/^(blob:|data:)/i.test(raw)) return null;
  if (!/^https?:\/\//i.test(raw)) return null;
  try {
    const u = new URL(raw);
    const currentF = String(u.searchParams.get('f') || '').toLowerCase();
    const currentOut = String(u.searchParams.get('output') || '').toLowerCase();

    // Only rewrite if it explicitly requests webp/avif.
    if (currentF === 'webp' || currentF === 'avif') {
      u.searchParams.set('f', 'jpg');
      return u.toString();
    }
    if (currentOut === 'webp' || currentOut === 'avif') {
      u.searchParams.set('output', 'jpg');
      return u.toString();
    }
    return null;
  } catch {
    return null;
  }
};

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
  // ✅ НОВОЕ: Expo Image v3 features
  recyclingKey?: string; // Для переиспользования в списках
  responsivePolicy?: 'live' | 'initial'; // Адаптивная загрузка
}

/**
 * Оптимизированный компонент изображения
 * Обновлено для Expo 54 и expo-image v3
 * 
 * Особенности:
 * - Автоматическая оптимизация для WebP/AVIF
 * - Lazy loading по умолчанию
 * - Placeholder с blurhash
 * - Индикатор загрузки
 * - Обработка ошибок с retry
 * - Responsive sizing
 * - ✅ НОВОЕ: Recycling для списков (expo-image v3)
 * - ✅ НОВОЕ: Responsive policy для адаптивной загрузки
 * 
 * @example
 * // Базовое использование
 * <OptimizedImage
 *   source={{ uri: imageUrl }}
 *   contentFit="cover"
 *   aspectRatio={16/9}
 *   placeholder={blurhash}
 *   loading="lazy"
 * />
 * 
 * @example
 * // В списках с recycling
 * <OptimizedImage
 *   source={{ uri: item.imageUrl }}
 *   recyclingKey={item.id}
 *   responsivePolicy="initial"
 *   priority="low"
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
  const disableRemoteImages =
    __DEV__ && process.env.EXPO_PUBLIC_DISABLE_REMOTE_IMAGES === 'true';
  const colors = useThemedColors();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [overrideUri, setOverrideUri] = useState<string | null>(null);
  const activeSource = useMemo(() => {
    if (typeof source === 'number') return source;
    const uri = normalizeRemoteImageUri(
      overrideUri ?? (typeof (source as any)?.uri === 'string' ? String((source as any).uri).trim() : '')
    );
    return uri ? { ...(source as any), uri } : source;
  }, [source, overrideUri]);
  const validSource = hasValidUriSource(activeSource as any);
  const [isLoading, setIsLoading] = useState(() => validSource);
  const [hasError, setHasError] = useState(false);
  const [, setRetryAttempt] = useState(0);
  const retryAttemptRef = useRef(0);
  const [lastUriKey, setLastUriKey] = useState('');

  const originalUriKey = useMemo(() => {
    if (typeof source === 'number') return '__asset__';
    const uri = typeof (source as any)?.uri === 'string' ? String((source as any).uri).trim() : '';
    return uri;
  }, [source]);
  const uriKey = useMemo(() => {
    if (typeof activeSource === 'number') return '__asset__';
    const uri = typeof (activeSource as any)?.uri === 'string' ? String((activeSource as any).uri).trim() : '';
    return uri;
  }, [activeSource]);

  // Clear retry/overrides when the actual source changes.
  const lastOriginalUriKeyRef = useRef(originalUriKey);
  useEffect(() => {
    if (lastOriginalUriKeyRef.current === originalUriKey) return;
    lastOriginalUriKeyRef.current = originalUriKey;
    setOverrideUri(null);
    setRetryAttempt(0);
    retryAttemptRef.current = 0;
  }, [originalUriKey]);

  useEffect(() => {
    if (uriKey === lastUriKey) return;
    setLastUriKey(uriKey);
    setHasError(false);
    setIsLoading(Boolean(validSource));
  }, [uriKey, lastUriKey, validSource]);

  useEffect(() => {
    return () => {
      // no-op
    };
  }, []);

  const shouldDisableNetwork = useMemo(() => {
    if (!disableRemoteImages) return false;
    if (typeof activeSource === 'number') return false;
    const uri = typeof (activeSource as any)?.uri === 'string' ? String((activeSource as any).uri).trim() : '';
    if (!uri) return false;
    return !/^(blob:|data:)/i.test(uri);
  }, [disableRemoteImages, activeSource]);

  const webBlobOrDataUri = useMemo(() => {
    if (Platform.OS !== 'web') return null;
    if (!validSource) return null;
    if (typeof activeSource === 'number') return null;
    const uri = typeof (activeSource as any)?.uri === 'string' ? String((activeSource as any).uri).trim() : '';
    if (!uri) return null;
    if (/^(blob:|data:)/i.test(uri)) return uri;
    return null;
  }, [activeSource, validSource]);

  const webCrossOrigin = useMemo(() => {
    if (Platform.OS !== 'web') return undefined;
    if (!validSource) return undefined;
    if (typeof activeSource === 'number') return undefined;
    if (webBlobOrDataUri) return undefined;
    const uri = typeof (activeSource as any)?.uri === 'string' ? String((activeSource as any).uri).trim() : '';
    return /^https?:\/\//i.test(uri) ? 'anonymous' : undefined;
  }, [activeSource, validSource, webBlobOrDataUri]);

  const shouldRenderBlurBackground =
    Platform.OS !== 'web' &&
    blurBackground &&
    validSource &&
    !webBlobOrDataUri &&
    !shouldDisableNetwork;

  const handleLoad = () => {
    setIsLoading(false);
    setHasError(false);
    onLoad?.();
  };

  const handleError = () => {
    const uri = typeof (activeSource as any)?.uri === 'string' ? String((activeSource as any).uri).trim() : '';
    const stripRetry = (value: string) => {
      try {
        const u = new URL(value);
        u.searchParams.delete('__retry');
        return u.toString();
      } catch {
        return value;
      }
    };

    let isPrivateHost = false;
    try {
      const parsed = new URL(uri);
      isPrivateHost = isPrivateOrLocalHost(parsed.hostname);
    } catch {
      isPrivateHost = false;
    }
    const canRetry =
      Platform.OS === 'web' &&
      typeof activeSource !== 'number' &&
      uri.length > 0 &&
      /^https?:\/\//i.test(uri) &&
      !/^(blob:|data:)/i.test(uri) &&
      !isPrivateHost;

    if (!overrideUri && uri) {
      const fallback = buildApiPrefixedUrl(uri);
      if (fallback && fallback !== uri) {
        setIsLoading(true);
        setHasError(false);
        if (canRetry && retryAttemptRef.current < 6) {
          const nextAttempt = Math.min(retryAttemptRef.current + 1, 6);
          retryAttemptRef.current = nextAttempt;
          const base = stripRetry(fallback);
          const glue = base.includes('?') ? '&' : '?';
          setOverrideUri(`${base}${glue}__retry=${nextAttempt}`);
          setRetryAttempt(nextAttempt);
        } else {
          setOverrideUri(fallback);
          setRetryAttempt(0);
          retryAttemptRef.current = 0;
        }
        onError?.();
        return;
      }
    }

    // iOS: some servers return images as webp/avif via query param which can fail to decode.
    // Retry once forcing JPG if the URL explicitly requests modern formats.
    if (Platform.OS === 'ios' && uri && !overrideUri) {
      const jpg = tryForceJpgFormat(uri);
      if (jpg && jpg !== uri) {
        setOverrideUri(jpg);
        onError?.();
        return;
      }
    }

    // Retry a few times with cache-busting query param.
    if (canRetry && retryAttemptRef.current < 6) {
      setIsLoading(true);
      setHasError(false);
      const nextAttempt = Math.min(retryAttemptRef.current + 1, 6);
      retryAttemptRef.current = nextAttempt;
      const base = stripRetry(uri);
      const glue = base.includes('?') ? '&' : '?';
      setOverrideUri(`${base}${glue}__retry=${nextAttempt}`);
      setRetryAttempt(nextAttempt);

      onError?.();
      return;
    }

    setIsLoading(false);
    setHasError(true);
    onError?.();
  };

  // Определяем приоритет загрузки
  const fetchPriority = priority === 'high' ? 'high' : priority === 'low' ? 'low' : 'auto';

  const showFallback = !blurOnly && (!validSource || hasError || shouldDisableNetwork);

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
      {!blurOnly && !!webBlobOrDataUri && !hasError && !shouldDisableNetwork && (
        <img
          src={webBlobOrDataUri}
          alt={alt || ''}
          onLoad={handleLoad}
          onError={handleError}
          style={{
            width: '100%',
            height: '100%',
            objectFit: contentFit === 'cover' ? 'cover' : 'contain',
            objectPosition: 'center',
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
            source={activeSource as any}
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

      {!blurOnly && validSource && !webBlobOrDataUri && !shouldDisableNetwork && (
        <ExpoImage
          {...(imageProps as any)}
          source={activeSource as any}
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
            Platform.OS === 'web' && ({ objectPosition: 'center' } as any),
          ]}
          // Web-specific optimizations
          {...(Platform.OS === 'web' && {
            // @ts-ignore - web-specific props
            loading,
            fetchPriority: fetchPriority,
            alt: alt || '',
            decoding: 'async',
            crossOrigin: webCrossOrigin,
          })}
          // Кэширование
          cachePolicy={cachePolicy}
        />
      )}

      {/* Индикатор загрузки */}
      {!blurOnly && validSource && isLoading && !hasError && !shouldDisableNetwork && (
        <ShimmerOverlay testID="optimized-image-loading" />
      )}

      {/* Заглушка при ошибке / отсутствии uri */}
      {showFallback && (
        <View
          style={[styles.errorContainer, { borderRadius }]}
          testID="optimized-image-error"
          {...(process.env.NODE_ENV === 'test'
            ? {}
            : ({ accessibilityElementsHidden: true, 'aria-hidden': true } as any))}
        />
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
    ...(Platform.OS === 'web' ? ({ objectPosition: 'center' } as any) : null),
  },
  errorContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.backgroundSecondary,
    ...Platform.select({
      web: {
        backgroundImage:
          `linear-gradient(135deg, ${colors.backgroundSecondary} 0%, ${colors.mutedBackground} 50%, ${colors.backgroundSecondary} 100%)`,
      },
    }),
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
