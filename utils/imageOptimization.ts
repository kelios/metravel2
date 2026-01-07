/**
 * Утилиты для оптимизации изображений
 * Поддержка responsive images, WebP, и адаптивных размеров
 */

import { Platform } from 'react-native';

export interface ImageOptimizationOptions {
  width?: number;
  height?: number;
  quality?: number; // 1-100
  format?: 'avif' | 'webp' | 'jpg' | 'png' | 'auto';
  dpr?: number; // Device Pixel Ratio
  fit?: 'cover' | 'contain' | 'fill';
  blur?: number; // 1-100 (if supported by CDN)
}

const optimizedUrlCache = new Map<string, string>();
const MAX_CACHE_SIZE = 400;

/**
 * Оптимизирует URL изображения с учетом размеров и формата
 * @param originalUrl - Оригинальный URL изображения
 * @param options - Параметры оптимизации
 * @returns Оптимизированный URL
 */
export function optimizeImageUrl(
  originalUrl: string | undefined | null,
  options: ImageOptimizationOptions = {}
): string | undefined {
  if (!originalUrl) return undefined;

  const {
    width,
    height,
    quality = 85,
    format = 'auto',
    dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1,
    fit = 'cover',
    blur,
  } = options;

  try {
    const cacheKey = `${originalUrl}:${JSON.stringify({ ...options, dpr })}`;
    if (optimizedUrlCache.has(cacheKey)) {
      return optimizedUrlCache.get(cacheKey);
    }

    const isPrivateOrLocalHost = (host: string): boolean => {
      const h = String(host || '').trim().toLowerCase();
      if (!h) return false;
      if (h === 'localhost' || h === '127.0.0.1') return true;
      // Private IPv4 ranges
      if (/^10\./.test(h)) return true;
      if (/^192\.168\./.test(h)) return true;
      if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(h)) return true;
      return false;
    };

    // Force HTTPS for security and performance (but keep HTTP for local/private dev hosts)
    let secureUrl = originalUrl;
    if (/^http:\/\//i.test(originalUrl)) {
      try {
        const parsed = new URL(originalUrl);
        if (!isPrivateOrLocalHost(parsed.hostname)) {
          secureUrl = originalUrl.replace(/^http:\/\//i, 'https://');
        }
      } catch {
        secureUrl = originalUrl.replace(/^http:\/\//i, 'https://');
      }
    }
    
    // Handle both absolute and relative URLs
    let url: URL;
    if (secureUrl.startsWith('https://')) {
      url = new URL(secureUrl);
    } else if (secureUrl.startsWith('/')) {
      // Relative URL starting with /
      const base = Platform.OS === 'web' && typeof window !== 'undefined' 
        ? window.location.origin 
        : 'https://metravel.by';
      url = new URL(secureUrl, base);
    } else {
      // Invalid URL format
      console.warn('Invalid image URL format:', originalUrl);
      return secureUrl;
    }

    const shouldApplyTransformParams = (() => {
      const host = String(url.hostname || '').trim().toLowerCase();
      if (!host) return false;
      if (isPrivateOrLocalHost(host)) return false;
      if (host === 'metravel.by') return true;
      if (host === 'cdn.metravel.by') return true;
      if (host === 'api.metravel.by') return true;
      if (host === 'images.weserv.nl') return true;
      return false;
    })();

    if (!shouldApplyTransformParams) {
      const passthrough = url.toString();
      if (optimizedUrlCache.size >= MAX_CACHE_SIZE) {
        const keysToDelete = Array.from(optimizedUrlCache.keys()).slice(0, 100);
        keysToDelete.forEach((key) => optimizedUrlCache.delete(key));
      }
      optimizedUrlCache.set(cacheKey, passthrough);
      return passthrough;
    }

    // Если URL уже содержит параметры оптимизации, обновляем их
    // Иначе добавляем новые

    if (width) {
      url.searchParams.set('w', String(Math.round(width * dpr)));
    }
    if (height) {
      url.searchParams.set('h', String(Math.round(height * dpr)));
    }
    if (quality && quality !== 100) {
      url.searchParams.set('q', String(quality));
    }
    const resolvedFormat = resolveImageFormat(format);
    if (resolvedFormat) {
      url.searchParams.set('f', resolvedFormat);
    }
    if (fit) {
      url.searchParams.set('fit', fit);
    }
    if (typeof blur === 'number' && blur > 0) {
      url.searchParams.set('blur', String(Math.min(100, Math.round(blur))));
    }

    // Добавляем параметр для поддержки WebP (если поддерживается браузером)
    if (Platform.OS === 'web' && format === 'auto') {
      // Проверяем поддержку AVIF/WebP через canvas (если доступен)
      const preferred = getPreferredImageFormat();
      if (preferred && !url.searchParams.has('f')) {
        url.searchParams.set('f', preferred);
      }
    }

    const optimizedUrl = url.toString();
    if (optimizedUrlCache.size >= MAX_CACHE_SIZE) {
      const keysToDelete = Array.from(optimizedUrlCache.keys()).slice(0, 100);
      keysToDelete.forEach((key) => optimizedUrlCache.delete(key));
    }
    optimizedUrlCache.set(cacheKey, optimizedUrl);

    return optimizedUrl;
  } catch (error) {
    // Если URL некорректен, возвращаем оригинал
    console.warn('Error optimizing image URL:', error);
    return originalUrl;
  }
}

export function getPreferredImageFormat(): 'avif' | 'webp' | 'jpg' {
  if (Platform.OS !== 'web') return 'webp';
  if (checkAvifSupport()) return 'avif';
  if (checkWebPSupport()) return 'webp';
  return 'jpg';
}

function resolveImageFormat(
  format: ImageOptimizationOptions['format']
): 'avif' | 'webp' | 'jpg' | 'png' | undefined {
  if (!format) return undefined;
  if (format === 'auto') {
    return Platform.OS === 'web' ? getPreferredImageFormat() : undefined;
  }

  if (Platform.OS === 'web') {
    if (format === 'avif' && !checkAvifSupport()) {
      return getPreferredImageFormat();
    }
    if (format === 'webp' && !checkWebPSupport()) {
      return 'jpg';
    }
  }

  return format;
}

/**
 * Проверяет поддержку WebP в браузере
 */
function checkWebPSupport(): boolean {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return false;
  }

  // Кэшируем результат проверки
  if ((window as any).__webpSupportChecked !== undefined) {
    return (window as any).__webpSupport;
  }

  try {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const supportsWebP =
      canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
    (window as any).__webpSupportChecked = true;
    (window as any).__webpSupport = supportsWebP;
    return supportsWebP;
  } catch {
    (window as any).__webpSupportChecked = true;
    (window as any).__webpSupport = false;
    return false;
  }
}

/**
 * Проверяет поддержку AVIF в браузере
 */
function checkAvifSupport(): boolean {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return false;
  }

  if ((window as any).__avifSupportChecked !== undefined) {
    return (window as any).__avifSupport;
  }

  try {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const supportsAvif =
      canvas.toDataURL('image/avif').indexOf('data:image/avif') === 0;
    (window as any).__avifSupportChecked = true;
    (window as any).__avifSupport = supportsAvif;
    return supportsAvif;
  } catch {
    (window as any).__avifSupportChecked = true;
    (window as any).__avifSupport = false;
    return false;
  }
}

/**
 * Получает оптимальные размеры изображения для контейнера
 * @param containerWidth - Ширина контейнера
 * @param containerHeight - Высота контейнера (опционально)
 * @param aspectRatio - Соотношение сторон изображения (опционально)
 * @returns Оптимальные размеры
 */
export function getOptimalImageSize(
  containerWidth: number,
  containerHeight?: number,
  aspectRatio?: number
): { width: number; height: number } {
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  const baseWidth = containerWidth * dpr;

  if (containerHeight && !aspectRatio) {
    return {
      width: Math.round(baseWidth),
      height: Math.round(containerHeight * dpr),
    };
  }

  if (aspectRatio) {
    return {
      width: Math.round(baseWidth),
      height: Math.round(baseWidth / aspectRatio),
    };
  }

  // По умолчанию используем ширину контейнера
  return {
    width: Math.round(baseWidth),
    height: Math.round(baseWidth * (16 / 9)), // Default 16:9
  };
}

/**
 * Генерирует srcset для responsive images (web)
 * @param baseUrl - Базовый URL изображения
 * @param sizes - Массив размеров для разных breakpoints
 * @returns Строка srcset
 */
export function generateSrcSet(
  baseUrl: string,
  sizes: number[],
  options: Omit<ImageOptimizationOptions, 'width' | 'height'> = {}
): string {
  if (Platform.OS !== 'web') return baseUrl;

  const resolvedFormat = options.format ?? getPreferredImageFormat();
  const srcset = sizes
    .map((size) => {
      const optimizedUrl = optimizeImageUrl(baseUrl, {
        width: size,
        format: resolvedFormat,
        quality: options.quality ?? 85,
        fit: options.fit,
        dpr: options.dpr,
      });
      return `${optimizedUrl} ${size}w`;
    })
    .join(', ');

  return srcset || baseUrl;
}

/**
 * Получает оптимальные размеры для разных breakpoints
 */
export function getResponsiveSizes(maxWidth: number = 1920): number[] {
  const sizes: number[] = [];
  
  // Стандартные breakpoints
  const breakpoints = [320, 640, 768, 1024, 1280, 1536, 1920];
  
  for (const bp of breakpoints) {
    if (bp <= maxWidth) {
      sizes.push(bp);
    }
  }
  
  // Добавляем maxWidth, если его нет в списке
  if (maxWidth > 1920 && !sizes.includes(maxWidth)) {
    sizes.push(maxWidth);
  }
  
  return sizes.sort((a, b) => a - b);
}

/**
 * Builds src/srcset/sizes for responsive images (web-only srcset).
 */
export function buildResponsiveImageProps(
  baseUrl: string,
  options: {
    maxWidth?: number;
    widths?: number[];
    sizes?: string;
    quality?: number;
    format?: ImageOptimizationOptions['format'];
    fit?: ImageOptimizationOptions['fit'];
    dpr?: number;
  } = {}
): { src: string; srcSet?: string; sizes?: string } {
  if (!baseUrl) {
    return { src: '' };
  }

  const widths = options.widths ?? getResponsiveSizes(options.maxWidth ?? 1920);
  const widest = widths.length > 0 ? widths[widths.length - 1] : options.maxWidth ?? 1920;
  const format = options.format ?? 'auto';

  const src =
    optimizeImageUrl(baseUrl, {
      width: widest,
      quality: options.quality ?? 85,
      format,
      fit: options.fit,
      dpr: options.dpr,
    }) || baseUrl;

  if (Platform.OS !== 'web') {
    return { src };
  }

  const srcSet = generateSrcSet(baseUrl, widths, {
    format,
    quality: options.quality ?? 85,
    fit: options.fit,
    dpr: options.dpr,
  });

  return {
    src,
    srcSet,
    sizes: options.sizes ?? '100vw',
  };
}

/**
 * Creates a low-quality placeholder URL for fast preview.
 */
export function buildLqipUrl(
  baseUrl: string,
  options: { width?: number; quality?: number; blur?: number } = {}
): string {
  if (!baseUrl) return baseUrl;

  return (
    optimizeImageUrl(baseUrl, {
      width: options.width ?? 24,
      quality: options.quality ?? 35,
      format: 'jpg',
      fit: 'cover',
      blur: options.blur ?? 30,
    }) || baseUrl
  );
}

/**
 * Создает версионированный URL изображения (с cache busting)
 */
export function buildVersionedImageUrl(
  url: string,
  updatedAt?: string | null,
  id?: number | string | null
): string {
  if (!url) return url;

  try {
    const imageUrl = new URL(url, Platform.OS === 'web' ? window.location.origin : 'https://metravel.by');
    
    // Добавляем версионирование для кэша
    if (updatedAt) {
      const ts = Date.parse(updatedAt);
      if (ts && Number.isFinite(ts)) {
        imageUrl.searchParams.set('v', String(ts));
      }
    } else if (id) {
      imageUrl.searchParams.set('v', String(id));
    }

    return imageUrl.toString();
  } catch {
    // Если URL некорректен, возвращаем с параметрами
    const separator = url.includes('?') ? '&' : '?';
    if (updatedAt) {
      const ts = Date.parse(updatedAt);
      if (ts && Number.isFinite(ts)) {
        return `${url}${separator}v=${ts}`;
      }
    }
    if (id) {
      return `${url}${separator}v=${id}`;
    }
    return url;
  }
}

/**
 * Создает lazy-loading компонент для изображений
 */
export function createLazyImageProps(
  src: string,
  options: ImageOptimizationOptions = {}
): {
  src: string;
  loading: 'lazy' | 'eager';
  decoding: 'async' | 'sync' | 'auto';
  fetchpriority?: 'high' | 'low' | 'auto';
} {
  const requestedFormat = options.format ?? 'auto';
  const optimizedSrc = optimizeImageUrl(src, {
    format: requestedFormat,
    quality: 85,
    ...options,
  });

  return {
    src: optimizedSrc || src,
    loading: options.width && options.width > 400 ? 'lazy' : 'eager',
    decoding: 'async',
    fetchpriority: options.width && options.width > 800 ? 'low' : 'auto',
  };
}

/**
 * Определяет, следует ли загружать изображение немедленно (LCP)
 */
export function shouldLoadEager(
  index: number,
  containerWidth?: number
): boolean {
  // Первое изображение всегда загружаем немедленно (LCP)
  if (index === 0) return true;
  
  // Маленькие изображения (например, в галерее) загружаем лениво
  if (containerWidth && containerWidth < 300) return false;
  
  // Первые 3 изображения в large контейнере загружаем немедленно
  return index < 3;
}
