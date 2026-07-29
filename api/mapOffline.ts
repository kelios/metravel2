import { Platform } from 'react-native';
import { resolveApiBaseUrl } from '@/utils/resolveApiBaseUrl';
import { fetchWithTimeout } from '@/utils/fetchWithTimeout';
import { safeJsonParse } from '@/utils/safeJsonParse';
import type { OfflineBBox } from '@/utils/mapTileCache';

export interface OfflineMapPoint {
  id: number | string;
  title: string;
  lat: number;
  lng: number;
  address: string;
  categoryName: string;
  thumb: string;
  urlTravel: string;
  slug: string;
}

export interface OfflineMapPointsResponse {
  points: OfflineMapPoint[];
  etag: string | null;
  notModified: boolean;
}

const rawApiUrl = resolveApiBaseUrl({
  platformOS: Platform.OS,
  envApiUrl: process.env.EXPO_PUBLIC_API_URL,
  prodApiUrl: process.env.PROD_API_URL,
  nodeEnv: process.env.NODE_ENV,
  isE2E: String(process.env.EXPO_PUBLIC_E2E || '').toLowerCase() === 'true',
  isLocalApi: String(process.env.EXPO_PUBLIC_IS_LOCAL_API || '').toLowerCase() === 'true',
  windowOrigin: Platform.OS === 'web' && typeof window !== 'undefined' ? window.location?.origin : null,
  windowHostname: Platform.OS === 'web' && typeof window !== 'undefined' ? window.location?.hostname : null,
});

const normalizeString = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : value == null ? '' : String(value).trim();

const normalizePoint = (value: unknown): OfflineMapPoint | null => {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  const lat = Number(raw.lat ?? raw.latitude);
  const lng = Number(raw.lng ?? raw.longitude);
  const id = raw.id;
  const title = normalizeString(raw.title ?? raw.name ?? raw.address);
  if ((typeof id !== 'number' && typeof id !== 'string') || !title) return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return null;
  }

  return {
    id,
    title,
    lat,
    lng,
    address: normalizeString(raw.address),
    categoryName: normalizeString(raw.categoryName ?? raw.category_name),
    thumb: normalizeString(raw.thumb ?? raw.travelImageThumbUrl),
    urlTravel: normalizeString(raw.urlTravel ?? raw.url_travel ?? raw.url),
    slug: normalizeString(raw.slug),
  };
};

/** Backend contract: bbox is west,south,east,north. */
export const serializeOfflineMapBBox = (bbox: OfflineBBox): string =>
  [bbox.west, bbox.south, bbox.east, bbox.north].join(',');

export async function fetchOfflineMapPoints(
  bbox: OfflineBBox,
  options: {
    signal?: AbortSignal;
    etag?: string | null;
    cachedPoints?: OfflineMapPoint[];
  } = {},
): Promise<OfflineMapPointsResponse> {
  if (!rawApiUrl) throw new Error('EXPO_PUBLIC_API_URL is not defined.');
  const url = `${rawApiUrl}/map/points_bulk/?bbox=${encodeURIComponent(serializeOfflineMapBBox(bbox))}`;
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (options.etag) headers['If-None-Match'] = options.etag;
  const response = await fetchWithTimeout(url, {
    method: 'GET',
    headers,
    credentials: 'omit',
    signal: options.signal,
  }, 30_000);
  if (response.status === 304) {
    if (!options.cachedPoints) throw new Error('OFFLINE_MAP_POINTS_304_WITHOUT_CACHE');
    return {
      points: options.cachedPoints,
      etag: options.etag ?? response.headers.get('etag'),
      notModified: true,
    };
  }
  if (!response.ok) throw new Error(`OFFLINE_MAP_POINTS_HTTP_${response.status}`);

  const payload = await safeJsonParse<unknown>(response, []);
  const values = Array.isArray(payload)
    ? payload
    : payload && typeof payload === 'object' && Array.isArray((payload as { results?: unknown[] }).results)
      ? (payload as { results: unknown[] }).results
      : [];
  return {
    points: values.map(normalizePoint).filter((point): point is OfflineMapPoint => point != null),
    etag: response.headers.get('etag'),
    notModified: false,
  };
}
