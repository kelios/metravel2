// utils/imageProxy.ts
// J4: Image URL proxy/optimization (extracted from imageOptimization.ts)

import { Platform } from 'react-native';

export interface ImageOptimizationOptions {
  width?: number;
  height?: number;
  quality?: number;
  format?: 'avif' | 'webp' | 'jpg' | 'png' | 'auto';
  dpr?: number;
  fit?: 'cover' | 'contain' | 'fill';
  blur?: number;
}

const optimizedUrlCache = new Map<string, string>();
const MAX_CACHE_SIZE = 400;

const isPrivateOrLocalHost = (host: string): boolean => {
  const h = String(host || '').trim().toLowerCase();
  if (!h) return false;
  if (h === 'localhost' || h === '127.0.0.1') return true;
  if (/^10\./.test(h)) return true;
  if (/^192\.168\./.test(h)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(h)) return true;
  return false;
};

const getPublicApiOrigin = (): string | null => {
  try {
    const raw = String(process.env.EXPO_PUBLIC_API_URL || '').trim();
    if (!raw) return null;
    const base = raw.replace(/\/api\/?$/i, '');
    const parsed = new URL(base);
    if (!parsed.origin) return null;
    return parsed.origin;
  } catch {
    return null;
  }
};

const isTestEnv = () =>
  typeof process !== 'undefined' &&
  (process.env as Record<string, unknown>)?.NODE_ENV === 'test';

export function clearImageOptimizationCache(): void {
  optimizedUrlCache.clear();
}

export function getImageCacheStats(): { size: number; entries: number } {
  return { size: optimizedUrlCache.size, entries: optimizedUrlCache.size };
}

export function optimizeImageUrl(
  originalUrl: string | null | undefined,
  options: ImageOptimizationOptions = {}
): string | undefined {
  if (originalUrl == null || originalUrl === '') return undefined;

  const trimmedUrl = originalUrl.trim();
  if (!trimmedUrl) return undefined;

  if (/^data:/i.test(trimmedUrl) || /^blob:/i.test(trimmedUrl)) return originalUrl;

  const cacheKey = `${trimmedUrl}|${options.width ?? ''}|${options.height ?? ''}|${options.quality ?? ''}|${options.format ?? ''}|${options.dpr ?? ''}|${options.fit ?? ''}`;
  const cached = optimizedUrlCache.get(cacheKey);
  if (cached) return cached;

  try {
    const publicOrigin = getPublicApiOrigin();
    const parsedUrl = new URL(trimmedUrl, publicOrigin || 'https://placeholder.invalid');

    if (isPrivateOrLocalHost(parsedUrl.hostname)) return originalUrl;

    const isOwnDomain = publicOrigin
      ? parsedUrl.origin === new URL(publicOrigin).origin
      : false;

    if (!isOwnDomain) {
      if (optimizedUrlCache.size >= MAX_CACHE_SIZE) {
        const keysToDelete = Array.from(optimizedUrlCache.keys()).slice(0, 50);
        keysToDelete.forEach((key) => optimizedUrlCache.delete(key));
      }
      optimizedUrlCache.set(cacheKey, trimmedUrl);
      return trimmedUrl;
    }

    const format = options.format || 'auto';
    const rawQuality = options.quality != null ? options.quality : (Platform.OS === 'web' ? 80 : 75);
    const quality = Math.min(100, Math.max(1, rawQuality));
    const fit = options.fit || 'cover';

    const proxyParams = new URLSearchParams();
    if (options.width) proxyParams.set('w', String(Math.round(options.width)));
    if (options.height) proxyParams.set('h', String(Math.round(options.height)));
    proxyParams.set('q', String(quality));
    if (format !== 'auto') proxyParams.set('f', format);
    proxyParams.set('fit', fit);
    if (options.blur && options.blur > 0) proxyParams.set('blur', String(Math.round(options.blur)));

    const imagePath = parsedUrl.pathname + parsedUrl.search;
    const optimizedUrl = `${publicOrigin}/img${imagePath}${imagePath.includes('?') ? '&' : '?'}${proxyParams.toString()}`;

    if (optimizedUrlCache.size >= MAX_CACHE_SIZE) {
      const keysToDelete = Array.from(optimizedUrlCache.keys()).slice(0, 50);
      keysToDelete.forEach((key) => optimizedUrlCache.delete(key));
    }
    optimizedUrlCache.set(cacheKey, optimizedUrl);

    return optimizedUrl;
  } catch (error) {
    if (!isTestEnv()) {
      console.warn('Error optimizing image URL:', error);
    }
    return originalUrl;
  }
}

export function buildVersionedImageUrl(
  rawUrl: string,
  updatedAt?: string | null,
  id?: string | number | null
): string {
  if (!rawUrl) return rawUrl;
  try {
    const url = new URL(rawUrl, getPublicApiOrigin() || 'https://placeholder.invalid');
    if (updatedAt) {
      const ts = new Date(updatedAt).getTime();
      if (Number.isFinite(ts)) url.searchParams.set('v', String(ts));
    } else if (id != null) {
      url.searchParams.set('v', String(id));
    }
    return url.toString();
  } catch {
    return rawUrl;
  }
}

export function getPreferredImageFormat(): 'avif' | 'webp' | 'jpg' {
  if (Platform.OS !== 'web') return 'webp';

  if (typeof document === 'undefined') return 'webp';

  try {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;

    if (canvas.toDataURL('image/avif').startsWith('data:image/avif')) {
      return 'avif';
    }
    if (canvas.toDataURL('image/webp').startsWith('data:image/webp')) {
      return 'webp';
    }
  } catch {
    // noop
  }
  return 'jpg';
}

export function getOptimalImageSize(
  containerWidth: number,
  containerHeight?: number,
  aspectRatio?: number
): { width: number; height: number } {
  const rawDpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  const dpr = Platform.OS === 'web' ? Math.min(rawDpr, 2) : rawDpr;
  const baseWidth = containerWidth * dpr;

  if (containerHeight && !aspectRatio) {
    return { width: Math.round(baseWidth), height: Math.round(containerHeight * dpr) };
  }

  if (aspectRatio) {
    return { width: Math.round(baseWidth), height: Math.round(baseWidth / aspectRatio) };
  }

  return { width: Math.round(baseWidth), height: Math.round(baseWidth * (16 / 9)) };
}

