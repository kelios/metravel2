/**
 * Shared image load cache for slider components.
 * Uses window global to ensure cache is shared across all Metro chunks.
 */
import { Platform } from 'react-native';

const CACHE_KEY = '__metravel_slider_image_cache';

interface ImageCache {
  uris: Set<string>;
  baseUris: Set<string>;
}

const getCache = (): ImageCache => {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    // For non-web or SSR, use module-level cache (won't be shared but that's ok)
    return moduleCache;
  }
  
  if (!(window as any)[CACHE_KEY]) {
    (window as any)[CACHE_KEY] = {
      uris: new Set<string>(),
      baseUris: new Set<string>(),
    };
  }
  return (window as any)[CACHE_KEY];
};

// Fallback for non-web platforms
const moduleCache: ImageCache = {
  uris: new Set<string>(),
  baseUris: new Set<string>(),
};

// Legacy export for compatibility
export const loadedSlideUriCache = {
  has: (uri: string) => getCache().uris.has(uri),
  add: (uri: string) => getCache().uris.add(uri),
};

export const extractBaseUri = (uri: string): string => {
  try {
    const url = new URL(uri, 'https://metravel.by');
    return url.origin + url.pathname;
  } catch {
    return uri.split('?')[0];
  }
};

export const isBaseUriLoaded = (uri: string): boolean => {
  return getCache().baseUris.has(extractBaseUri(uri));
};

export const markBaseUriLoaded = (uri: string): void => {
  getCache().baseUris.add(extractBaseUri(uri));
};

export const markUriLoaded = (uri: string): void => {
  const cache = getCache();
  cache.uris.add(uri);
  cache.baseUris.add(extractBaseUri(uri));
};

export const isUriLoaded = (uri: string): boolean => {
  const cache = getCache();
  return cache.uris.has(uri) || cache.baseUris.has(extractBaseUri(uri));
};
