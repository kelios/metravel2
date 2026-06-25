import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

type CacheableRequestOptions = {
  method?: string;
  headers?: HeadersInit | null;
};

export type PublicStalePayloadMeta = {
  savedAt: string;
  sourceEndpoint: string;
};

type PublicStaleCacheEntry<T> = PublicStalePayloadMeta & {
  payload: T;
};

const CACHE_VERSION = 1;
const CACHE_PREFIX = `public_stale_v${CACHE_VERSION}:`;
const STALE_META = Symbol.for('metravel.publicStalePayloadMeta');

const hasAuthorizationHeader = (headers?: HeadersInit | null): boolean => {
  if (!headers) return false;

  if (headers instanceof Headers) {
    return headers.has('Authorization') || headers.has('authorization');
  }

  if (Array.isArray(headers)) {
    return headers.some(([key]) => String(key).toLowerCase() === 'authorization');
  }

  return Object.keys(headers).some((key) => key.toLowerCase() === 'authorization');
};

const normalizeValue = (value: string): string => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

export const normalizePublicStaleEndpoint = (endpoint: string): string => {
  const raw = String(endpoint || '').trim();
  if (!raw) return '';

  try {
    const url = new URL(raw, 'https://metravel.local');
    const params = Array.from(url.searchParams.entries())
      .map(([key, value]) => [normalizeValue(key), normalizeValue(value)] as const)
      .sort(([leftKey, leftValue], [rightKey, rightValue]) => {
        if (leftKey === rightKey) return leftValue.localeCompare(rightValue);
        return leftKey.localeCompare(rightKey);
      });
    const query = params
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join('&');
    return `${url.pathname}${query ? `?${query}` : ''}`;
  } catch {
    return raw;
  }
};

const getCacheKey = (endpoint: string): string => {
  return `${CACHE_PREFIX}${normalizePublicStaleEndpoint(endpoint)}`;
};

export const isPublicStaleCacheAvailable = (): boolean => Platform?.OS !== 'web';

export const isCacheablePublicGet = (
  endpoint: string,
  options: CacheableRequestOptions = {},
): boolean => {
  const method = String(options.method || 'GET').toUpperCase();
  return Boolean(endpoint) && method === 'GET' && !hasAuthorizationHeader(options.headers);
};

export const isRecoverablePublicStaleError = (error: unknown): boolean => {
  const errorName = error instanceof Error ? error.name : '';
  const errorMessage = error instanceof Error ? error.message : String(error ?? '');
  if (
    errorName === 'AbortError' ||
    /\b(aborted|cancell?ed)\b/i.test(errorMessage)
  ) {
    return false;
  }

  const rawStatus =
    (error as { status?: unknown } | null)?.status ??
    (error as { response?: { status?: unknown } } | null)?.response?.status;
  const status = Number(rawStatus);
  if (Number.isFinite(status)) return status === 0 || status >= 500;

  return /failed to fetch|network request failed|network failed|timeout/i.test(errorMessage);
};

export const markPublicStalePayload = <T>(payload: T, meta: PublicStalePayloadMeta): T => {
  if (!payload || (typeof payload !== 'object' && typeof payload !== 'function')) return payload;

  try {
    Object.defineProperty(payload as object, STALE_META, {
      configurable: true,
      enumerable: false,
      value: meta,
    });
  } catch {
    // Non-extensible payloads still remain usable; the UI just won't show a banner.
  }

  return payload;
};

export const getPublicStalePayloadMeta = (payload: unknown): PublicStalePayloadMeta | null => {
  if (!payload || (typeof payload !== 'object' && typeof payload !== 'function')) return null;
  return ((payload as Record<symbol, PublicStalePayloadMeta | undefined>)[STALE_META]) ?? null;
};

export async function savePublicStalePayload<T>(
  endpoint: string,
  payload: T,
  options: CacheableRequestOptions = {},
): Promise<void> {
  if (!isPublicStaleCacheAvailable() || !isCacheablePublicGet(endpoint, options) || !payload) return;

  try {
    const entry: PublicStaleCacheEntry<T> = {
      payload,
      savedAt: new Date().toISOString(),
      sourceEndpoint: normalizePublicStaleEndpoint(endpoint),
    };
    await AsyncStorage.setItem(getCacheKey(endpoint), JSON.stringify(entry));
  } catch {
    // Cache writes are best effort and must never block fresh public data.
  }
}

export async function readPublicStalePayload<T>(
  endpoint: string,
): Promise<(T & object) | null> {
  if (!isPublicStaleCacheAvailable() || !endpoint) return null;

  try {
    const raw = await AsyncStorage.getItem(getCacheKey(endpoint));
    if (!raw) return null;

    const entry = JSON.parse(raw) as Partial<PublicStaleCacheEntry<T>>;
    if (!entry || !entry.payload || !entry.savedAt || !entry.sourceEndpoint) return null;

    return markPublicStalePayload(entry.payload, {
      savedAt: entry.savedAt,
      sourceEndpoint: entry.sourceEndpoint,
    }) as T & object;
  } catch {
    return null;
  }
}
