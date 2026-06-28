// utils/imageProxy.ts
// J4: Image URL proxy/optimization (extracted from imageOptimization.ts)

import { Platform } from 'react-native';
import { normalizeAbsoluteMediaUrl, isPrivateOrLocalHost } from '@/utils/mediaUrl';

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
const OPTIMIZATION_QUERY_PARAMS = ['w', 'h', 'q', 'f', 'fit', 'auto', 'output', 'dpr', 'blur'];
const MEDIA_FILE_PATH = /^\/(gallery|travel-image|travel-description-image|address-image)\/(?:[^?#]*\/conversions\/|\d+\/(gallery|travel-image|travel-description-image|address-image)\/|[^/?#]+$)/i;

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

// Квантование запрашиваемого варианта в фиксированный набор, чтобы бэкенд-прокси
// отдавал небольшое кэш-дружелюбное число конверсий, а не уникальный файл на
// каждую попиксельную ширину / дробный DPR. Каждая уникальная комбинация
// (w,h,q,dpr,f,fit) = отдельная СИНХРОННАЯ конвертация на проде (1 vCPU / 1.8 ГБ):
// схлопывание почти одинаковых вариантов поднимает попадание кэша и режет
// CPU/память/диск на конвертациях (см. тикет #628 — своп-штормы от переподписки).
const DIMENSION_LADDER = [16, 24, 32, 48, 96, 160, 240, 320, 480, 640, 800, 1024, 1280, 1600, 2048];

const snapDimensionUp = (value: number): number => {
  const v = Math.round(value);
  if (!Number.isFinite(v) || v <= 0) return v;
  for (const rung of DIMENSION_LADDER) {
    if (v <= rung) return rung;
  }
  return DIMENSION_LADDER[DIMENSION_LADDER.length - 1];
};

// Дробный DPR (2.75, 2.8125, 1.25) из window.devicePixelRatio множит варианты —
// привязываем к целому 1/2/3.
const snapDpr = (value: number): number => Math.min(3, Math.max(1, Math.round(value)));

// Quality к шагу 10 (72/78/82 → 70/80/80) — меньше вариантов при незаметной разнице.
const snapQuality = (value: number): number => {
  const q = Math.min(100, Math.max(1, Math.round(value)));
  return Math.min(100, Math.max(10, Math.round(q / 10) * 10));
};

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

  const trimmedUrl = normalizeAbsoluteMediaUrl(originalUrl.trim());
  if (!trimmedUrl) return undefined;

  if (/^data:/i.test(trimmedUrl) || /^blob:/i.test(trimmedUrl)) return originalUrl;

  // Metro dev-server assets (`/assets?unstable_path=...`) обслуживаются только локальным
  // бандлером — префикс публичного origin ломает их в dev/preview.
  if (trimmedUrl.includes('unstable_path=')) return originalUrl;

  const cacheKey = `${trimmedUrl}|${options.width ?? ''}|${options.height ?? ''}|${options.quality ?? ''}|${options.format ?? ''}|${options.dpr ?? ''}|${options.fit ?? ''}|${options.blur ?? ''}`;
  const cached = optimizedUrlCache.get(cacheKey);
  if (cached) return cached;

  try {
    const publicOrigin = getPublicApiOrigin();
    const parsedUrl = new URL(trimmedUrl, publicOrigin || 'https://placeholder.invalid');

    if (isPrivateOrLocalHost(parsedUrl.hostname)) return originalUrl;

    if (MEDIA_FILE_PATH.test(parsedUrl.pathname)) {
      // Media file paths are served by the backend image proxy which understands
      // the same w/h/q/f/fit/blur query params.  Strip stale optimization params
      // and append fresh ones so that the browser fetches a properly-sized variant
      // instead of always downloading the full-resolution original.
      OPTIMIZATION_QUERY_PARAMS.forEach((key) => {
        try { parsedUrl.searchParams.delete(key); } catch { /* noop */ }
      });

      const proxyParams = new URLSearchParams();
      if (options.width) proxyParams.set('w', String(snapDimensionUp(options.width)));
      if (options.height) proxyParams.set('h', String(snapDimensionUp(options.height)));
      if (options.quality != null) proxyParams.set('q', String(snapQuality(options.quality)));
      if (options.format && options.format !== 'auto') proxyParams.set('f', options.format);
      if (options.fit) proxyParams.set('fit', options.fit);
      if (options.dpr != null) proxyParams.set('dpr', String(snapDpr(options.dpr)));
      if (options.blur && options.blur > 0) proxyParams.set('blur', String(Math.round(options.blur)));

      const paramStr = proxyParams.toString();
      const base = parsedUrl.toString();
      const result = paramStr ? `${base}${base.includes('?') ? '&' : '?'}${paramStr}` : base;

      if (optimizedUrlCache.size >= MAX_CACHE_SIZE) {
        const keysToDelete = Array.from(optimizedUrlCache.keys()).slice(0, 50);
        keysToDelete.forEach((key) => optimizedUrlCache.delete(key));
      }
      optimizedUrlCache.set(cacheKey, result);
      return result;
    }

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

    OPTIMIZATION_QUERY_PARAMS.forEach((key) => {
      try {
        parsedUrl.searchParams.delete(key);
      } catch {
        // noop
      }
    });

    const format = options.format || 'auto';
    const rawQuality = options.quality != null ? options.quality : (Platform.OS === 'web' ? 80 : 75);
    const quality = snapQuality(rawQuality);
    const fit = options.fit || 'cover';

    const proxyParams = new URLSearchParams();
    if (options.width) proxyParams.set('w', String(snapDimensionUp(options.width)));
    if (options.height) proxyParams.set('h', String(snapDimensionUp(options.height)));
    proxyParams.set('q', String(quality));
    if (format !== 'auto') proxyParams.set('f', format);
    proxyParams.set('fit', fit);
    if (options.dpr != null) proxyParams.set('dpr', String(snapDpr(options.dpr)));
    if (options.blur && options.blur > 0) proxyParams.set('blur', String(Math.round(options.blur)));

    const imagePath = parsedUrl.pathname + parsedUrl.search;
    const optimizedUrl = `${publicOrigin}${imagePath}${imagePath.includes('?') ? '&' : '?'}${proxyParams.toString()}`;

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
  const trimmed = normalizeAbsoluteMediaUrl(String(rawUrl).trim());
  if (!trimmed) return rawUrl;
  if (/^(data:|blob:)/i.test(trimmed)) {
    return trimmed;
  }
  try {
    const url = new URL(trimmed, getPublicApiOrigin() || 'https://placeholder.invalid');
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
