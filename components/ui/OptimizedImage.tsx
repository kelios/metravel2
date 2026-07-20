import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { ShimmerOverlay } from '@/components/ui/ShimmerOverlay';
import { Image as ExpoImage, ImageContentFit } from 'expo-image';
import type { ImageProps as ExpoImageProps, ImageSource } from 'expo-image';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';

// Shared cap on network round-trips for a single broken image. The API-prefix
// fallback and the generic cache-busting retry both draw from this budget via
// retryAttemptRef, so a failing image cannot exceed this many extra requests.
const MAX_RETRY_ATTEMPTS = 6;

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

const getSameOriginWebCrossOrigin = (uri: string): 'anonymous' | undefined => {
  if (Platform.OS !== 'web') return undefined;
  if (!/^https?:\/\//i.test(uri)) return undefined;
  if (typeof window === 'undefined' || !window.location?.origin) return undefined;

  try {
    const parsed = new URL(uri);
    return parsed.origin === window.location.origin ? 'anonymous' : undefined;
  } catch {
    return undefined;
  }
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

const resolveBlurhashPlaceholder = (placeholder?: string): ImageSource | undefined => {
  const value = typeof placeholder === 'string' ? placeholder.trim() : '';
  return value ? { blurhash: value } : undefined;
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
  /**
   * Native-only: smaller image variant used for the blurred backdrop layer so
   * Glide decodes a downscaled bitmap (and applies the blur transform on far
   * fewer pixels) instead of re-decoding the full-resolution photo a second
   * time. Falls back to the main source when omitted.
   */
  blurSource?: { uri: string };
  /** Keep the native sharp layer hidden until the blur backdrop has decoded. */
  synchronizeBlurReveal?: boolean;
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
  showLoadingIndicator?: boolean;
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
  blurSource,
  synchronizeBlurReveal = false,
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
  showLoadingIndicator = true,
  onLoad,
  onError,
  style,
  recyclingKey,
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
  const lastResetKeyRef = useRef<string | null>(null);
  const mountedRef = useRef(true);

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

  // Derived-state-on-render: reset loading/error synchronously during render
  // (before paint) whenever the rendered image identity changes. We key on
  // both uriKey and recyclingKey so that during list recycling — where the
  // component instance is reused with a different recyclingKey — the very
  // first frame does not flash the previous item's hasError/isLoading state.
  const resetKey = `${recyclingKey ?? ''}|${uriKey}`;
  if (lastResetKeyRef.current !== resetKey) {
    lastResetKeyRef.current = resetKey;
    setHasError(false);
    setIsLoading(Boolean(validSource));
  }

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
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
    return getSameOriginWebCrossOrigin(uri);
  }, [activeSource, validSource, webBlobOrDataUri]);

  const shouldRenderBlurBackground =
    Platform.OS !== 'web' &&
    blurBackground &&
    validSource &&
    !webBlobOrDataUri &&
    !shouldDisableNetwork;

  const blurUriKey = useMemo(() => {
    if (!blurSource?.uri) return uriKey;
    return String(blurSource.uri).trim();
  }, [blurSource, uriKey]);
  const blurLoadKey = `${resetKey}|${blurUriKey}`;
  const [loadedBlurKey, setLoadedBlurKey] = useState<string | null>(null);
  const shouldSynchronizeBlurReveal =
    synchronizeBlurReveal && shouldRenderBlurBackground;
  const isBlurRevealReady =
    !shouldSynchronizeBlurReveal || loadedBlurKey === blurLoadKey;

  const handleLoad = () => {
    if (!mountedRef.current) return;
    setIsLoading(false);
    setHasError(false);
    onLoad?.();
  };

  const handleError = () => {
    if (!mountedRef.current) return;
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
    // Cache-bust retry runs on every platform: on native (Android especially)
    // a transient decode/network failure otherwise sticks the card on the blur
    // placeholder forever, since there is no other retry path (iOS at least has
    // the force-jpg branch below). Bounded by MAX_RETRY_ATTEMPTS.
    const canRetry =
      typeof activeSource !== 'number' &&
      uri.length > 0 &&
      /^https?:\/\//i.test(uri) &&
      !/^(blob:|data:)/i.test(uri) &&
      !isPrivateHost;

    if (!overrideUri && uri) {
      const fallback = buildApiPrefixedUrl(uri);
      if (fallback && fallback !== uri) {
        // The API-prefix fallback already changes the origin/path, so it
        // does not need a cache-busting __retry param. It still consumes
        // one slot from the shared retry budget so a broken image cannot
        // exceed MAX_RETRY_ATTEMPTS network round-trips across both paths.
        if (retryAttemptRef.current < MAX_RETRY_ATTEMPTS) {
          retryAttemptRef.current += 1;
          setRetryAttempt(retryAttemptRef.current);
          setIsLoading(true);
          setHasError(false);
          setOverrideUri(fallback);
          onError?.();
          return;
        }
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
    // Shares MAX_RETRY_ATTEMPTS budget with the API-prefix fallback above.
    if (canRetry && retryAttemptRef.current < MAX_RETRY_ATTEMPTS) {
      retryAttemptRef.current += 1;
      const nextAttempt = retryAttemptRef.current;
      setRetryAttempt(nextAttempt);
      setIsLoading(true);
      setHasError(false);
      const base = stripRetry(uri);
      const glue = base.includes('?') ? '&' : '?';
      setOverrideUri(`${base}${glue}__retry=${nextAttempt}`);

      onError?.();
      return;
    }

    setIsLoading(false);
    setHasError(true);
    onError?.();
  };

  // Определяем приоритет загрузки
  const fetchPriority = priority === 'high' ? 'high' : priority === 'low' ? 'low' : 'auto';
  const resolvedPlaceholder = useMemo(() => resolveBlurhashPlaceholder(placeholder), [placeholder]);

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
            source={(blurSource ?? activeSource) as any}
            contentFit="cover"
            transition={0}
            style={StyleSheet.absoluteFill}
            cachePolicy={cachePolicy}
            // A caller-provided blurSource is already a small, server-blurred
            // variant. Avoid Android's expensive live blur while scrolling.
            blurRadius={blurSource ? 0 : blurBackgroundRadius}
            placeholder={resolvedPlaceholder}
            priority={priority}
            onLoad={() => setLoadedBlurKey(blurLoadKey)}
            onError={() => setLoadedBlurKey(blurLoadKey)}
            testID={imageProps?.testID ? `${imageProps.testID}-blur-background` : undefined}
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
          recyclingKey={recyclingKey}
          source={activeSource as any}
          contentFit={contentFit}
          placeholder={resolvedPlaceholder}
          priority={priority}
          transition={transition}
          onLoad={handleLoad}
          onError={handleError}
          style={[
            styles.image,
            {
              borderRadius,
              opacity: isBlurRevealReady ? 1 : 0,
            },
            // Native Fabric: a percentage-only height lets ExpoImage's contentFit
            // impose the bitmap's intrinsic aspect ratio, inflating fixed-height
            // cards. A definite numeric height pins the media to the layout box.
            Platform.OS !== 'web' && typeof height === 'number' ? { height } : null,
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
      {!blurOnly && showLoadingIndicator && validSource && isLoading && !hasError && !shouldDisableNetwork && (
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
  },
});

export default memo(OptimizedImage);

const prefetchedImageUris = new Set<string>();
const PREFETCH_TIMEOUT_MS = 15000;

export async function prefetchImage(uri: string): Promise<void> {
  if (!uri) return;
  if (prefetchedImageUris.has(uri)) return;
  prefetchedImageUris.add(uri);

  if (Platform.OS === 'web' && typeof Image !== 'undefined') {
    await new Promise<void>((resolve, reject) => {
      const img = new Image();
      let timeoutId: ReturnType<typeof setTimeout> | null = null;
      const cleanup = () => {
        if (timeoutId !== null) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        img.onload = null;
        img.onerror = null;
      };

      img.decoding = 'async';
      const crossOrigin = getSameOriginWebCrossOrigin(uri);
      if (crossOrigin) {
        img.crossOrigin = crossOrigin;
      }

      img.onload = () => {
        cleanup();
        resolve();
      };
      img.onerror = () => {
        cleanup();
        prefetchedImageUris.delete(uri);
        reject(new Error(`Failed to preload image: ${uri}`));
      };

      // Guard against requests that never settle: drop the uri from the cache
      // so a later prefetch can retry, and detach handlers to avoid late calls.
      timeoutId = setTimeout(() => {
        cleanup();
        prefetchedImageUris.delete(uri);
        reject(new Error(`Timed out preloading image: ${uri}`));
      }, PREFETCH_TIMEOUT_MS);

      img.src = uri;

      if (img.complete) {
        cleanup();
        resolve();
      }
    });
    return;
  }

  const fn = (ExpoImage as any)?.prefetch;
  if (typeof fn === 'function') {
    try {
      // Slider neighbour warming should make the network read cheap without
      // retaining several decoded, full-screen bitmaps. Keeping those in the
      // shared memory cache evicts the current hero/body textures and Android
      // re-uploads a bitmap on every vertical-scroll frame.
      await fn(uri, Platform.OS === 'web' ? undefined : 'disk');
    } catch (error) {
      prefetchedImageUris.delete(uri);
      throw error;
    }
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
