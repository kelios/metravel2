/**
 * Утилиты для оптимизации изображений
 * Поддержка responsive images, WebP, и адаптивных размеров
 */

import { Platform } from 'react-native';

export interface ImageOptimizationOptions {
  width?: number;
  height?: number;
  quality?: number; // 1-100
  format?: 'webp' | 'jpg' | 'png' | 'auto';
  dpr?: number; // Device Pixel Ratio
  fit?: 'cover' | 'contain' | 'fill';
}

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
  } = options;

  try {
    // Force HTTPS for security and performance
    const secureUrl = originalUrl.replace(/^http:\/\//i, 'https://');
    
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
    if (format && format !== 'auto') {
      url.searchParams.set('f', format);
    }
    if (fit) {
      url.searchParams.set('fit', fit);
    }

    // Добавляем параметр для поддержки WebP (если поддерживается браузером)
    if (Platform.OS === 'web' && format === 'auto') {
      // Проверяем поддержку WebP через canvas (если доступен)
      const supportsWebP = checkWebPSupport();
      if (supportsWebP && !url.searchParams.has('f')) {
        url.searchParams.set('f', 'webp');
      }
    }

    return url.toString();
  } catch (error) {
    // Если URL некорректен, возвращаем оригинал
    console.warn('Error optimizing image URL:', error);
    return originalUrl;
  }
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
  sizes: number[]
): string {
  if (Platform.OS !== 'web') return baseUrl;

  const srcset = sizes
    .map((size) => {
      const optimizedUrl = optimizeImageUrl(baseUrl, {
        width: size,
        format: 'webp',
        quality: 85,
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
  const optimizedSrc = optimizeImageUrl(src, {
    format: 'webp',
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
