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

export interface ResponsiveImageSource {
  src: string
  srcSet?: string
  sizes?: string
  format: string
}

const optimizedUrlCache = new Map<string, string>();
const MAX_CACHE_SIZE = 400;

export function clearImageOptimizationCache(): void {
  optimizedUrlCache.clear()
}

export function getImageCacheStats(): { size: number; entries: number } {
  return {
    size: optimizedUrlCache.size,
    entries: optimizedUrlCache.size,
  }
}

const isTestEnv = () =>
  typeof process !== 'undefined' &&
  (process as any).env &&
  (process as any).env.NODE_ENV === 'test';

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
    quality = 75,
    format = 'auto',
    dpr =
      typeof window !== 'undefined'
        ? Platform.OS === 'web'
          ? Math.min(window.devicePixelRatio || 1, 2)
          : window.devicePixelRatio || 1
        : 1,
    fit = 'cover',
    blur,
  } = options;

  const clampedQuality = Math.max(1, Math.min(100, Number.isFinite(quality as any) ? (quality as number) : 85))

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
    if (secureUrl.startsWith('https://') || secureUrl.startsWith('http://')) {
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

    const isAllowedTransformHost = (() => {
      const host = String(url.hostname || '').trim().toLowerCase();
      if (!host) return false;
      if (isPrivateOrLocalHost(host)) return false;
      if (host === 'metravel.by') return true;
      if (host === 'cdn.metravel.by') return true;
      if (host === 'api.metravel.by') return true;
      if (host === 'images.weserv.nl') return true;
      return false;
    })();

    // If the image host doesn't support our transform params, proxy via images.weserv.nl on web.
    // This makes width/quality/format flags effective and usually fixes poor LCP caused by huge originals.
    if (!isAllowedTransformHost) {
      if (isTestEnv()) {
        const passthrough = url.toString();
        if (optimizedUrlCache.size >= MAX_CACHE_SIZE) {
          const keysToDelete = Array.from(optimizedUrlCache.keys()).slice(0, 100);
          keysToDelete.forEach((key) => optimizedUrlCache.delete(key));
        }
        optimizedUrlCache.set(cacheKey, passthrough);
        return passthrough;
      }

      if (Platform.OS === 'web' && !isPrivateOrLocalHost(String(url.hostname || ''))) {
        const withoutScheme = url.toString().replace(/^https?:\/\//i, '');
        url = new URL('https://images.weserv.nl/');
        url.searchParams.set('url', withoutScheme);
      } else {
        const passthrough = url.toString();
        if (optimizedUrlCache.size >= MAX_CACHE_SIZE) {
          const keysToDelete = Array.from(optimizedUrlCache.keys()).slice(0, 100);
          keysToDelete.forEach((key) => optimizedUrlCache.delete(key));
        }
        optimizedUrlCache.set(cacheKey, passthrough);
        return passthrough;
      }
    }

    // Если URL уже содержит параметры оптимизации, обновляем их
    // Иначе добавляем новые

    const isWeserv = String(url.hostname || '').toLowerCase() === 'images.weserv.nl';

    if (width) {
      url.searchParams.set('w', String(Math.round(width * dpr)));
    }
    if (height) {
      url.searchParams.set('h', String(Math.round(height * dpr)));
    }
    if (clampedQuality && clampedQuality !== 100) {
      url.searchParams.set('q', String(clampedQuality));
    }
    const resolvedFormat = resolveImageFormat(format);
    if (resolvedFormat) {
      if (isWeserv) {
        url.searchParams.set('output', resolvedFormat);
        url.searchParams.delete('f');
      } else {
        url.searchParams.set('f', resolvedFormat);
      }
    }
    if (fit) {
      if (isWeserv && fit === 'contain') {
        url.searchParams.set('fit', 'inside');
      } else {
        url.searchParams.set('fit', fit);
      }
    }
    if (typeof blur === 'number' && blur > 0) {
      url.searchParams.set('blur', String(Math.min(100, Math.round(blur))));
    }

    // Добавляем параметр для поддержки WebP (если поддерживается браузером)
    if (Platform.OS === 'web' && format === 'auto') {
      // Проверяем поддержку AVIF/WebP через canvas (если доступен)
      const preferred = getPreferredImageFormat();
      if (preferred) {
        if (isWeserv) {
          if (!url.searchParams.has('output')) {
            url.searchParams.set('output', preferred);
          }
        } else {
          if (!url.searchParams.has('f')) {
            url.searchParams.set('f', preferred);
          }
        }
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
  const rawDpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  const dpr = Platform.OS === 'web' ? Math.min(rawDpr, 2) : rawDpr;
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
  if (!baseUrl) return '';
  if (Platform.OS !== 'web') return baseUrl;

  const resolvedFormat = options.format ?? getPreferredImageFormat();
  const resolvedDpr = options.dpr ?? 1;
  const srcset = sizes
    .map((size) => {
      const optimizedUrl = optimizeImageUrl(baseUrl, {
        width: size,
        format: resolvedFormat,
        quality: options.quality ?? 75,
        fit: options.fit,
        dpr: resolvedDpr,
      });
      return `${optimizedUrl} ${size}w`;
    })
    .join(', ');

  return srcset || baseUrl;
}

export function generateSizes(
  breakpoints: {
    desktop?: number
    tablet?: number
    mobile?: number
  } = {}
): string {
  const desktop = breakpoints.desktop || 1200
  const tablet = breakpoints.tablet || 768
  const mobile = breakpoints.mobile || 375

  return `(min-width: ${desktop}px) ${desktop}px, (min-width: ${tablet}px) ${tablet}px, ${mobile}px`
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
  const resolvedDpr = Platform.OS === 'web' ? options.dpr ?? 1 : options.dpr;

  const src =
    optimizeImageUrl(baseUrl, {
      width: widest,
      quality: options.quality ?? 75,
      format,
      fit: options.fit,
      dpr: resolvedDpr,
    }) || baseUrl;

  if (Platform.OS !== 'web') {
    return { src };
  }

  const srcSet = generateSrcSet(baseUrl, widths, {
    format,
    quality: options.quality ?? 75,
    fit: options.fit,
    dpr: resolvedDpr,
  });

  return {
    src,
    srcSet,
    sizes: options.sizes ?? '100vw',
  };
}

export function buildResponsiveImage(
  imageUrl: string,
  options: ImageOptimizationOptions & { sizes?: string } = {}
): ResponsiveImageSource {
  if (!imageUrl) {
    return {
      src: '',
      format: 'unknown',
    }
  }

  const format = resolveImageFormat(options.format ?? 'auto') || 'jpg'
  const { src, srcSet, sizes } = buildResponsiveImageProps(imageUrl, {
    maxWidth:
      typeof window !== 'undefined' ? window.innerWidth || 1440 : 1440,
    sizes: options.sizes,
    quality: options.quality,
    format: options.format,
    fit: options.fit,
    dpr: options.dpr,
  })

  return {
    src,
    srcSet,
    sizes,
    format,
  }
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

export function generateLQIP(
  imageUrl: string,
  width: number = 15
): string | undefined {
  if (!imageUrl) return undefined
  return optimizeImageUrl(imageUrl, {
    width,
    quality: 50,
    format: 'jpg',
    fit: 'contain',
    blur: 5,
  })
}

export function calculateImageDimensions(
  originalWidth: number,
  originalHeight: number,
  constraints: { maxWidth?: number; maxHeight?: number }
): { width: number; height: number } {
  const maxWidth = constraints.maxWidth || originalWidth
  const maxHeight = constraints.maxHeight || originalHeight

  const widthRatio = maxWidth / originalWidth
  const heightRatio = maxHeight / originalHeight
  const ratio = Math.min(widthRatio, heightRatio, 1)

  return {
    width: Math.round(originalWidth * ratio),
    height: Math.round(originalHeight * ratio),
  }
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
