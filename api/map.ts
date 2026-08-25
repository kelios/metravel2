import type { Travel, TravelMediaImage, TravelsForMap, TravelsMap } from '@/types/types';
import {
  normalizeMapPlaceSource,
  readMapPlaceMarkerFields,
  type MapPlaceSource,
  type MapPlaceSourcesPage,
} from '@/api/mapPlaces';
import { ApiError } from '@/api/clientErrors';
import { parseNearTravelsEnvelope } from '@/api/travelNearResponse';
import { indexMediaImage } from '@/utils/mediaPlaceholderIndex';
import { normalizeNumericArray } from '@/utils/filterQuery';
import { devError, devWarn } from '@/utils/logger';
import { safeJsonParse } from '@/utils/safeJsonParse';
import { fetchWithTimeout } from '@/utils/fetchWithTimeout';
import { Platform } from 'react-native';
import { DEFAULT_RADIUS_KM } from '@/constants/mapConfig';
import { resolveApiBaseUrl } from '@/utils/resolveApiBaseUrl';
import { isBareMediaEndpointUrl, isPrivateOrLocalHost } from '@/utils/mediaUrl';
import { translate as i18nT } from '@/i18n';

const normalizeCoordString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
};

const normalizeString = (value: unknown, fallback = ''): string => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? trimmed : fallback;
  }
  if (value == null) return fallback;
  return String(value);
};

const normalizeImageUrl = (value: unknown): string => {
  const url = normalizeString(value, '');
  if (!url) return '';

  // Backend occasionally returns only media endpoint roots (e.g. /address-image/)
  // instead of real files. Treat such values as missing image to avoid 404 noise.
  if (isBareMediaEndpointUrl(url)) return '';

  // Upgrade absolute http URLs to https for non-local hosts (production CSP requires https images).
  if (/^http:\/\//i.test(url)) {
    try {
      const parsed = new URL(url);
      const host = String(parsed.hostname || '').trim().toLowerCase();
      if (!isPrivateOrLocalHost(host)) {
        return url.replace(/^http:\/\//i, 'https://');
      }
    } catch {
      return url.replace(/^http:\/\//i, 'https://');
    }
  }

  // Если URL уже абсолютный, возвращаем как есть
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  
  // Если URL относительный, добавляем домен
  if (url.startsWith('/')) {
    const baseUrl = Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : 'https://metravel.by';
    return `${baseUrl}${url}`;
  }
  
  return url;
};

/**
 * Запись манифеста для точки карты: `media.address_images` ключуется id кадра,
 * который для точки совпадает с её `point_id`/`id`. Карточка показывает один
 * снимок, поэтому при неизвестном ключе берём первую запись.
 */
const readMapPointMediaEntry = (
  item: Record<string, unknown>,
): TravelMediaImage | undefined => {
  const media = (item as { media?: { address_images?: Record<string, TravelMediaImage> } }).media;
  const images = media?.address_images;
  if (!images || typeof images !== 'object') return undefined;
  for (const id of [item.point_id, item.id]) {
    if (id === undefined || id === null) continue;
    const entry = images[String(id)];
    if (entry) return entry;
  }
  return Object.values(images)[0];
};

const normalizeLatLngString = (value: unknown): string => {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? trimmed : '';
  }
  return '';
};

const normalizeTravelCoordsItem = (raw: unknown) => {
  const t = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {} as Record<string, unknown>;

  let lat = normalizeLatLngString(t.lat ?? t.latitude);
  let lng = normalizeLatLngString(t.lng ?? t.longitude);

  // If we have explicit lat/lng fields, use them to build coord in "lat,lng" format
  let coord: string | undefined;
  if (lat && lng) {
    coord = `${lat},${lng}`;
  } else {
    // Otherwise, try to parse from coord field
    const rawCoord = normalizeCoordString(t.coord);
    if (rawCoord) {
      // Try to extract lat/lng from coord string
      const parts = rawCoord.split(',').map(s => s.trim());
      if (parts.length === 2) {
        const a = parseFloat(parts[0]);
        const b = parseFloat(parts[1]);
        if (Number.isFinite(a) && Number.isFinite(b)) {
          // Determine if it's lat,lng or lng,lat based on valid ranges
          // Latitude: -90 to 90, Longitude: -180 to 180
          const isFirstLat = Math.abs(a) <= 90;
          const isSecondLat = Math.abs(b) <= 90;
          
          if (isFirstLat && !isSecondLat) {
            // First is lat, second is lng
            lat = String(a);
            lng = String(b);
            coord = `${lat},${lng}`;
          } else if (!isFirstLat && isSecondLat) {
            // First is lng, second is lat (old format)
            lat = String(b);
            lng = String(a);
            coord = `${lat},${lng}`;
          } else {
            // Both could be lat or both could be lng, use as-is but prefer lat,lng
            lat = String(a);
            lng = String(b);
            coord = `${lat},${lng}`;
          }
        } else {
          coord = rawCoord;
        }
      } else {
        coord = rawCoord;
      }
    }
  }

  const address =
    normalizeString(t.address ?? t.adress ?? t.full_address ?? t.name, '').trim() || undefined;

  const categoryName = normalizeString(
    t.categoryName ?? t.category_name ?? t.category ?? t.categoryTravelAddress,
    ''
  );

  const travelImageUrl = normalizeImageUrl(
    t.travelImageUrl ?? t.travel_image_url ?? t.imageUrl ?? t.image_url ?? t.image
  );

  const travelImageThumbUrl = normalizeImageUrl(
    t.travelImageThumbUrl ??
      t.travel_image_thumb_url ??
      t.travelImageThumbSmallUrl ??
      t.travel_image_thumb_small_url ??
      t.thumb ??
      travelImageUrl
  );
  const travelImageLandscapeUrl = normalizeImageUrl(
    t.travelImageLandscapeUrl ??
      t.travel_image_landscape_url ??
      t.imageLandscapeUrl ??
      t.image_landscape_url
  );

  const urlTravel = normalizeString(t.urlTravel ?? t.url_travel ?? t.url, '');
  const articleUrl = normalizeString(t.articleUrl ?? t.article_url, '') || undefined;

  // Заливка полей letterbox (#1208): карточка списка, попап маркера и нижняя
  // карточка рисуют `travelImageThumbUrl`/`travelImageUrl` — это legacy-конверсии,
  // которых в манифесте нет, поэтому цвет индексируется ещё и под ними.
  indexMediaImage(readMapPointMediaEntry(t), [
    travelImageThumbUrl,
    travelImageUrl,
    travelImageLandscapeUrl,
  ]);

  return {
    ...t,
    address,
    categoryName,
    coord,
    lat,
    lng,
    travelImageThumbUrl,
    travelImageLandscapeUrl,
    imageUrl: travelImageUrl || travelImageThumbUrl,
    urlTravel,
    articleUrl,
    // Спред `...t` пронёс бы только сырые snake_case place-поля — нормализуем их
    // в типизированные placeId/sourceCount/primarySource (#1567).
    ...readMapPlaceMarkerFields(t, normalizeImageUrl),
  };
};

const tryReadTotal = (payload: unknown): number | undefined => {
  if (!payload || typeof payload !== 'object') return undefined;
  const rec = payload as Record<string, unknown>;
  const maybe = rec.count ?? rec.total;
  const n = typeof maybe === 'string' ? Number(maybe) : maybe;
  return typeof n === 'number' && Number.isFinite(n) ? n : undefined;
};

const normalizeTravelsForMapPayload = (payload: unknown): TravelsForMap => {
  if (!payload) return {} as TravelsForMap;
  if (Array.isArray(payload)) {
    // Some backend endpoints historically returned arrays. Preserve that shape
    // to avoid breaking callers/tests that expect arrays.
    return payload.map((item) => normalizeTravelCoordsItem(item)) as unknown as TravelsForMap;
  }
  if (typeof payload === 'object') {
    const obj = payload as Record<string, unknown>;
    const list = Array.isArray(obj?.results)
      ? obj.results
      : Array.isArray(obj?.data)
        ? obj.data
        : null;

    if (list) {
      const out: Record<string, unknown> = {};
      list.forEach((item: unknown, index: number) => {
        out[index] = normalizeTravelCoordsItem(item);
      });

      const total = tryReadTotal(obj);
      if (typeof total === 'number') {
        Object.defineProperty(out, '__total', {
          value: total,
          enumerable: false,
          configurable: false,
          writable: false,
        });
      }

      return out as TravelsForMap;
    }

    const out: Record<string, unknown> = {};
    Object.entries(payload as Record<string, unknown>).forEach(([key, value]) => {
      out[key] = normalizeTravelCoordsItem(value);
    });
    return out as TravelsForMap;
  }
  return {} as TravelsForMap;
};

const isLocalApi = String(process.env.EXPO_PUBLIC_IS_LOCAL_API || '').toLowerCase() === 'true';
const isE2E = String(process.env.EXPO_PUBLIC_E2E || '').toLowerCase() === 'true';
const rawApiUrl = resolveApiBaseUrl({
  platformOS: Platform.OS,
  envApiUrl: process.env.EXPO_PUBLIC_API_URL,
  prodApiUrl: process.env.PROD_API_URL,
  nodeEnv: process.env.NODE_ENV,
  isE2E,
  isLocalApi,
  windowOrigin: Platform.OS === 'web' && typeof window !== 'undefined' ? window.location?.origin : null,
  windowHostname: Platform.OS === 'web' && typeof window !== 'undefined' ? window.location?.hostname : null,
});
if (!rawApiUrl) {
  throw new Error('EXPO_PUBLIC_API_URL is not defined. Please set this environment variable.');
}
const URLAPI = rawApiUrl;

const DEFAULT_TIMEOUT = 10000; // 10 секунд
const LONG_TIMEOUT = 30000; // 30 секунд для тяжелых запросов
const TRANSIENT_HTTP_STATUSES = new Set([502, 503, 504]);
const MAP_FETCH_RETRY_DELAY_MS = process.env.NODE_ENV === 'test' ? 0 : 350;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const fetchWithTransientRetry = async (
  url: string,
  init: RequestInit,
  timeoutMs: number,
  retries: number = 1
) => {
  let attempt = 0;
  while (true) {
    const response = await fetchWithTimeout(url, init, timeoutMs);
    const shouldRetry =
      attempt < retries && !response.ok && TRANSIENT_HTTP_STATUSES.has(response.status);
    if (!shouldRetry) return response;

    attempt += 1;
    if (MAP_FETCH_RETRY_DELAY_MS > 0) {
      await wait(MAP_FETCH_RETRY_DELAY_MS);
    }
  }
};

// Для запросов с query (?...) оставляем базу без завершающего слеша, для остальных — со слешем.
const SEARCH_TRAVELS_FOR_MAP = `${URLAPI}/travels/search_travels_for_map/`; // далее добавляется ?...
const SEARCH_TRAVELS_FOR_MAP_LITE = `${URLAPI}/travels/search_travels_for_map_lite/`;
const GET_MAP_CLUSTERS = `${URLAPI}/map/clusters/`; // серверная кластеризация, BE #719: ?bbox=south,west,north,east&zoom=
// Ленивая коллекция материалов места (#1567): короткие summary с cursor-пагинацией.
const getMapPlaceSourcesUrl = (placeId: string | number) =>
  `${URLAPI}/map/places/${encodeURIComponent(String(placeId))}/sources/`;
const GET_FILTER_FOR_MAP = `${URLAPI}/filterformap/`;
const GET_TRAVELS = `${URLAPI}/travels/`;
const GET_TRAVELS_OF_MONTH = `${URLAPI}/travels/of-month/`;
const GET_TRAVELS_RANDOM = `${URLAPI}/travels/random/`;
const SEARCH_TRAVELS_NEAR_ROUTE = `${URLAPI}/travels/near-route/`;

type ApiOptions = { signal?: AbortSignal; throwOnError?: boolean; limit?: number };

const withOptionalLimit = (url: string, limit?: number): string => {
  if (!Number.isFinite(limit) || !limit || limit <= 0) return url;
  const separator = url.includes('?') ? '&' : '?';
  const perPage = Math.max(1, Math.floor(limit));
  return `${url}${separator}page=1&perPage=${perPage}`;
};

export const fetchTravelsNear = async (
  travel_id: number,
  signal?: AbortSignal,
  limit?: number,
): Promise<Travel[]> => {
  try {
    const urlTravel = withOptionalLimit(`${GET_TRAVELS}${travel_id}/near/`, limit);
    const res = await fetchWithTimeout(urlTravel, { signal }, DEFAULT_TIMEOUT);
    if (!res.ok) {
      devError('Error fetching travels near: HTTP', res.status, res.statusText, urlTravel);
      throw new ApiError(
        res.status,
        i18nT('errorsStatic:api.common.requestFailed', {
          details: res.statusText || `HTTP ${res.status}`,
        }),
      );
    }
    const payload = await safeJsonParse<unknown>(res);
    return parseNearTravelsEnvelope(payload, limit);
  } catch (e: unknown) {
    if (e instanceof Error && e.name === 'AbortError') {
      throw e;
    }
    devWarn('Error fetching travels near:', e);
    throw e;
  }
};

export type NearbyTravelMapPoint = {
  id: string;
  coord: string;
  address: string;
  travelImageThumbUrl: string;
  categoryName: string;
  urlTravel?: string;
};

type NearbyTravelMapCard = Pick<Travel, 'id'> & Partial<Pick<Travel, 'slug'>>;

const readMapCatalogItems = (payload: unknown): unknown[] | null => {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return null;
  const record = payload as Record<string, unknown>;
  if (Array.isArray(record.results)) return record.results;
  if (Array.isArray(record.data)) return record.data;
  return null;
};

const readMapPointTravelId = (item: Record<string, unknown>): number | null => {
  const travel = item.travel;
  const rawId = travel && typeof travel === 'object'
    ? (travel as Record<string, unknown>).id
    : travel;
  const id = Number(rawId);
  return Number.isFinite(id) && id > 0 ? id : null;
};

/**
 * The compact `/travels/:id/near/` card response intentionally omits route
 * coordinates. Load the light map catalog only after the user opens map mode,
 * querying by the six visible travel slugs and keeping points from the exact
 * matching travel ids.
 */
export const fetchNearbyTravelMapPoints = async (
  origin: { lat: number; lng: number },
  travels: NearbyTravelMapCard[],
  signal?: AbortSignal,
): Promise<NearbyTravelMapPoint[]> => {
  const lat = Number(origin.lat);
  const lng = Number(origin.lng);
  if (!Number.isFinite(lat) || Math.abs(lat) > 90 || !Number.isFinite(lng) || Math.abs(lng) > 180) {
    return [];
  }

  const candidates = travels
    .map((travel) => ({
      id: Number(travel.id),
      slug: typeof travel.slug === 'string' ? travel.slug.trim() : '',
    }))
    .filter((travel) => Number.isFinite(travel.id) && travel.id > 0 && travel.slug);
  if (!candidates.length) return [];

  const batches = await Promise.all(candidates.map(async (travel) => {
    const params = new URLSearchParams({
      where: JSON.stringify({
        lat,
        lng,
        radius: 60,
        publish: true,
        moderation: true,
        query: travel.slug,
      }),
    });

    try {
      const response = await fetchWithTimeout(
        `${SEARCH_TRAVELS_FOR_MAP_LITE}?${params.toString()}`,
        { signal },
        DEFAULT_TIMEOUT,
      );
      if (!response.ok) {
        throw new ApiError(
          response.status,
          i18nT('errorsStatic:api.common.requestFailed', {
            details: response.statusText || `HTTP ${response.status}`,
          }),
        );
      }

      const payload = await safeJsonParse<unknown>(response);
      const items = readMapCatalogItems(payload);
      if (!items) {
        throw new ApiError(
          502,
          i18nT('errorsStatic:utils.network.requestFailed'),
          { code: 'INVALID_NEARBY_MAP_RESPONSE' },
        );
      }
      const points = items
        .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
        .filter((item) => readMapPointTravelId(item) === travel.id)
        .map((item, index): NearbyTravelMapPoint | null => {
          const normalized = normalizeTravelCoordsItem(item) as Record<string, unknown>;
          const coord = normalizeString(normalized.coord, '');
          if (!coord) return null;
          return {
            id: normalizeString(normalized.id, '') || `${travel.id}-${index}`,
            coord,
            address: normalizeString(normalized.address ?? normalized.title, ''),
            travelImageThumbUrl: normalizeString(normalized.travelImageThumbUrl, ''),
            categoryName:
              normalizeString(normalized.categoryName, '') ||
              normalizeString(normalized.countryName ?? normalized.country_name, ''),
            urlTravel: normalizeString(normalized.urlTravel, '') || undefined,
          };
        })
        .filter((point): point is NearbyTravelMapPoint => point !== null);
      return { points, error: null };
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') throw error;
      devWarn('Error fetching nearby travel map points:', error);
      return { points: [] as NearbyTravelMapPoint[], error };
    }
  }));

  const seen = new Set<string>();
  const points: NearbyTravelMapPoint[] = [];
  for (const batch of batches) {
    for (const point of batch.points) {
      const key = `${point.id}:${point.coord}`;
      if (seen.has(key)) continue;
      seen.add(key);
      points.push(point);
      if (points.length >= 50) break;
    }
    if (points.length >= 50) break;
  }
  if (batches.length > 0 && batches.every((batch) => batch.error != null)) {
    throw batches[0].error;
  }
  return points;
};

export const fetchTravelsPopular = async (options?: ApiOptions): Promise<TravelsMap> => {
  try {
    const urlTravel = withOptionalLimit(`${GET_TRAVELS}popular/`, options?.limit);
    const res = await fetchWithTimeout(urlTravel, { signal: options?.signal }, DEFAULT_TIMEOUT);
    if (!res.ok) {
      // Keep behavior: return empty payload, but surface actionable info in dev.
      if (res.status === 404) {
        devWarn('Travels popular not found (404):', urlTravel);
        return {} as TravelsMap;
      }

      const err = new Error(`HTTP ${res.status}: ${res.statusText}`);
      devError('Error fetching travels popular: HTTP', res.status, res.statusText, urlTravel);
      if (options?.throwOnError) throw err;
      return {} as TravelsMap;
    }
    return await safeJsonParse<TravelsMap>(res, {} as TravelsMap);
  } catch (e: unknown) {
    if (e instanceof Error && e.name === 'AbortError') {
      throw e;
    }
    devWarn('Error fetching travels popular:', { url: `${GET_TRAVELS}popular/`, error: e });
    if (options?.throwOnError) throw e;
    return {} as TravelsMap;
  }
};

export const fetchTravelsOfMonth = async (options?: ApiOptions): Promise<TravelsMap> => {
  try {
    const urlTravel = withOptionalLimit(GET_TRAVELS_OF_MONTH, options?.limit);
    const res = await fetchWithTimeout(urlTravel, { signal: options?.signal }, DEFAULT_TIMEOUT);
    if (!res.ok) {
      const err = new Error(`HTTP ${res.status}: ${res.statusText}`);
      if (options?.throwOnError) throw err;
      return {} as TravelsMap;
    }
    return await safeJsonParse<TravelsMap>(res, {} as TravelsMap);
  } catch (e: unknown) {
    if (e instanceof Error && e.name === 'AbortError') {
      throw e;
    }
    devWarn('Error fetching fetchTravelsOfMonth:', e);
    if (options?.throwOnError) throw e;
    return {} as TravelsMap;
  }
};

export const fetchTravelsRandom = async (options?: ApiOptions): Promise<unknown[]> => {
  try {
    const urlTravel = withOptionalLimit(GET_TRAVELS_RANDOM, options?.limit);
    const res = await fetchWithTimeout(urlTravel, { signal: options?.signal }, DEFAULT_TIMEOUT);
    if (!res.ok) {
      const err = new Error(`HTTP ${res.status}: ${res.statusText}`);
      if (options?.throwOnError) throw err;
      return [];
    }
    return await safeJsonParse<unknown[]>(res, []);
  } catch (e: unknown) {
    if (e instanceof Error && e.name === 'AbortError') {
      throw e;
    }
    devWarn('Error fetching fetchTravelsRandom:', e);
    if (options?.throwOnError) throw e;
    return [];
  }
};

export const fetchTravelsForMap = async (
  page: number,
  itemsPerPage: number,
  filter: Record<string, unknown>,
  options?: ApiOptions,
): Promise<TravelsForMap> => {
  try {
    const radius = parseInt(String(filter?.radius ?? DEFAULT_RADIUS_KM), 10);
    const latRaw = filter?.lat ?? '53.9006';
    const lngRaw = filter?.lng ?? '27.5590';
    const lat = typeof latRaw === 'string' ? latRaw : String(latRaw);
    const lng = typeof lngRaw === 'string' ? lngRaw : String(lngRaw);

    const whereObject: Record<string, unknown> = {
      lat,
      lng,
      radius,
    };

    if (filter?.moderation === undefined && filter?.publish === undefined) {
      whereObject.publish = 1;
      whereObject.moderation = 1;
    }
    if (filter?.publish !== undefined) {
      whereObject.publish = filter.publish;
    }
    if (filter?.moderation !== undefined) {
      whereObject.moderation = filter.moderation;
    }

    if (filter?.categories && Array.isArray(filter.categories) && filter.categories.length > 0) {
      const normalizedCategories = normalizeNumericArray(filter.categories);
      if (normalizedCategories.length > 0) {
        whereObject.categories = normalizedCategories;
      }
    }

    if (
      filter?.categoryTravelAddress &&
      Array.isArray(filter.categoryTravelAddress) &&
      filter.categoryTravelAddress.length > 0
    ) {
      const normalizedCategoryTravelAddress = normalizeNumericArray(filter.categoryTravelAddress);
      if (normalizedCategoryTravelAddress.length > 0) {
        whereObject.categoryTravelAddress = normalizedCategoryTravelAddress;
      }
    }

    // Серверный полнотекстовый поиск (BE #695): where.query фильтрует выдачу и
    // учитывается в total. Раньше текст фильтровался на клиенте по загруженной
    // странице — теперь это делает бэкенд, чтобы счётчик и пагинация были верны.
    const queryRaw = typeof filter?.query === 'string' ? filter.query.trim() : '';
    if (queryRaw) {
      whereObject.query = queryRaw;
    }

    const paramsObj = {
      page: (page + 1).toString(),
      perPage: itemsPerPage.toString(),
      where: JSON.stringify(whereObject),
    };
    const params = new URLSearchParams(paramsObj).toString();

    const urlTravel = `${SEARCH_TRAVELS_FOR_MAP}?${params}`;
    const res = await fetchWithTransientRetry(
      urlTravel,
      { signal: options?.signal },
      LONG_TIMEOUT,
      1
    );
    if (!res.ok) {
      const err = new Error(`HTTP ${res.status}: ${res.statusText}`);
      if (options?.throwOnError) throw err;
      return [] as unknown as TravelsForMap;
    }
    const payload = await safeJsonParse<unknown>(res, [] as unknown as TravelsForMap);
    return normalizeTravelsForMapPayload(payload);
  } catch (e: unknown) {
    if (e instanceof Error && e.name === 'AbortError') {
      throw e;
    }
    devWarn('Error fetching fetchTravelsForMap:', e);
    if (options?.throwOnError) throw e;
    return [] as unknown as TravelsForMap;
  }
};

// --- Серверная кластеризация карты (BE #719) ---------------------------------
// GET /api/map/clusters/?bbox=<south,west,north,east>&zoom=<n>[&q=&category=]
// Возвращает { clusters, markers, total_count, ... }. Бэкенд сам выбирает режим:
// на низком зуме/плотности отдаёт clusters (markers пуст), на высоком — markers.

export interface MapClusterBBox {
  south: number;
  west: number;
  north: number;
  east: number;
}

export interface MapClusterPoint {
  id?: string | number;
  coord: string;
  lat: string;
  lng: string;
  address: string;
  categoryName: string;
  travelImageThumbUrl: string;
  imageUrl: string;
  urlTravel: string;
  articleUrl?: string;
  countryName?: string;
  countryCode?: string;
  /** Grouped place DTO (#1567): canonical place identity, additive поверх legacy полей. */
  placeId?: string | number;
  sourceCount?: number;
  primarySource?: MapPlaceSource | null;
}

export interface MapCluster {
  id: string;
  center: { lat: number; lng: number };
  count: number;
  bounds: MapClusterBBox;
  previewItems: MapClusterPoint[];
}

export interface MapClustersResult {
  clusters: MapCluster[];
  markers: MapClusterPoint[];
  totalCount: number;
  source: string;
  generatedAt: string;
}

export interface MapClustersFilters {
  /** Search text (server FTS), maps to ?q= */
  query?: string;
  /** Category ids, maps to ?category=<csv> */
  category?: Array<number | string>;
  /** Radius-mode anchor latitude, maps to ?lat= */
  lat?: number | string;
  /** Radius-mode anchor longitude, maps to ?lng= */
  lng?: number | string;
  /** Radius in kilometers, maps to ?radius= */
  radius?: number | string;
}

const EMPTY_CLUSTERS_RESULT: MapClustersResult = {
  clusters: [],
  markers: [],
  totalCount: 0,
  source: '',
  generatedAt: '',
};

const normalizeClusterPoint = (raw: unknown): MapClusterPoint => {
  const t = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};

  const lat = normalizeLatLngString(t.lat ?? t.latitude);
  const lng = normalizeLatLngString(t.lng ?? t.longitude);
  const coord = lat && lng ? `${lat},${lng}` : normalizeCoordString(t.coord) ?? '';

  const travelImageUrl = normalizeImageUrl(
    t.travelImageUrl ?? t.travel_image_url ?? t.imageUrl ?? t.image_url ?? t.image,
  );
  const travelImageThumbUrl = normalizeImageUrl(
    t.travelImageThumbUrl ?? t.travel_image_thumb_url ?? t.thumb ?? travelImageUrl,
  );

  const idRaw = t.point_id ?? t.id;
  const id = typeof idRaw === 'number' || typeof idRaw === 'string' ? idRaw : undefined;

  // Серверная кластеризация — второй источник тех же карточек/попапов, поэтому
  // индекс заливки прогревается и здесь (см. `normalizeTravelCoordsItem`).
  indexMediaImage(readMapPointMediaEntry(t), [travelImageThumbUrl, travelImageUrl]);

  return {
    id,
    coord,
    lat,
    lng,
    address: normalizeString(t.address ?? t.title ?? t.name, ''),
    categoryName: normalizeString(t.categoryName ?? t.category_name ?? t.category, ''),
    travelImageThumbUrl,
    imageUrl: travelImageUrl || travelImageThumbUrl,
    urlTravel: normalizeString(t.urlTravel ?? t.url_travel ?? t.url, ''),
    articleUrl: normalizeString(t.articleUrl ?? t.article_url, '') || undefined,
    countryName: normalizeString(t.countryName ?? t.country_name, '') || undefined,
    countryCode: normalizeString(t.countryCode ?? t.country_code, '') || undefined,
    // Явная пересборка объекта иначе потеряла бы grouped place DTO (#1567).
    ...readMapPlaceMarkerFields(t, normalizeImageUrl),
  };
};

const normalizeCluster = (raw: unknown): MapCluster | null => {
  if (!raw || typeof raw !== 'object') return null;
  const c = raw as Record<string, unknown>;

  const centerRaw =
    c.center && typeof c.center === 'object' ? (c.center as Record<string, unknown>) : {};
  const lat = Number(centerRaw.lat);
  const lng = Number(centerRaw.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const boundsRaw =
    c.bounds && typeof c.bounds === 'object' ? (c.bounds as Record<string, unknown>) : {};
  const bounds: MapClusterBBox = {
    south: Number(boundsRaw.south),
    west: Number(boundsRaw.west),
    north: Number(boundsRaw.north),
    east: Number(boundsRaw.east),
  };

  const countRaw = Number(c.count);
  const previewRaw = c.preview_items ?? c.previewItems;
  const previewItems = Array.isArray(previewRaw) ? previewRaw.map(normalizeClusterPoint) : [];

  return {
    id: normalizeString(c.id, '') || `${lat.toFixed(5)}|${lng.toFixed(5)}`,
    center: { lat, lng },
    count: Number.isFinite(countRaw) && countRaw > 0 ? countRaw : previewItems.length,
    bounds,
    previewItems,
  };
};

const normalizeMapClustersPayload = (payload: unknown): MapClustersResult => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return EMPTY_CLUSTERS_RESULT;
  }
  const obj = payload as Record<string, unknown>;

  const clusters = Array.isArray(obj.clusters)
    ? obj.clusters.map(normalizeCluster).filter((c): c is MapCluster => c !== null)
    : [];
  const markers = Array.isArray(obj.markers) ? obj.markers.map(normalizeClusterPoint) : [];

  const totalRaw = Number(obj.total_count ?? obj.totalCount);

  return {
    clusters,
    markers,
    totalCount: Number.isFinite(totalRaw)
      ? totalRaw
      : clusters.reduce((a, c) => a + c.count, 0) + markers.length,
    source: normalizeString(obj.source, ''),
    generatedAt: normalizeString(obj.generated_at ?? obj.generatedAt, ''),
  };
};

// bbox сериализуется как south,west,north,east (lat,lng,lat,lng) — контракт BE #719,
// подтверждён пробой прода. Порядок ИНОЙ, чем WGS lng-first в остальном коде карты.
export const serializeMapClusterBBox = (bbox: MapClusterBBox): string =>
  `${bbox.south},${bbox.west},${bbox.north},${bbox.east}`;

export const fetchMapClusters = async (
  bbox: MapClusterBBox,
  zoom: number,
  filters?: MapClustersFilters,
  options?: ApiOptions,
): Promise<MapClustersResult> => {
  try {
    const params = new URLSearchParams();
    params.set('bbox', serializeMapClusterBBox(bbox));
    params.set('zoom', String(Math.round(zoom)));

    const q = typeof filters?.query === 'string' ? filters.query.trim() : '';
    if (q) params.set('q', q);

    const categoryIds = normalizeNumericArray(filters?.category ?? []);
    if (categoryIds.length > 0) params.set('category', categoryIds.join(','));

    const lat = Number(filters?.lat);
    const lng = Number(filters?.lng);
    const radius = Number(filters?.radius);
    if (Number.isFinite(lat) && Math.abs(lat) <= 90) params.set('lat', String(lat));
    if (Number.isFinite(lng) && Math.abs(lng) <= 180) params.set('lng', String(lng));
    if (Number.isFinite(radius) && radius > 0) params.set('radius', String(radius));

    const url = `${GET_MAP_CLUSTERS}?${params.toString()}`;
    const res = await fetchWithTransientRetry(url, { signal: options?.signal }, LONG_TIMEOUT, 1);
    if (!res.ok) {
      const err = new Error(`HTTP ${res.status}: ${res.statusText}`);
      if (options?.throwOnError) throw err;
      return EMPTY_CLUSTERS_RESULT;
    }
    const payload = await safeJsonParse<unknown>(res, EMPTY_CLUSTERS_RESULT);
    return normalizeMapClustersPayload(payload);
  } catch (e: unknown) {
    if (e instanceof Error && e.name === 'AbortError') {
      throw e;
    }
    devWarn('Error fetching fetchMapClusters:', e);
    if (options?.throwOnError) throw e;
    return EMPTY_CLUSTERS_RESULT;
  }
};

export const fetchTravelsNearRoute = async (
  routeCoords: [number, number][],
  toleranceKm: number = 2,
  options?: ApiOptions,
): Promise<TravelsForMap> => {
  try {
    const toleranceMeters = toleranceKm * 1000;
    const body = {
      route: {
        type: 'LineString',
        coordinates: routeCoords,
      },
      tolerance: toleranceMeters,
    };

    const res = await fetchWithTimeout(SEARCH_TRAVELS_NEAR_ROUTE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: options?.signal,
    }, LONG_TIMEOUT);

    if (!res.ok) {
      const errorText = __DEV__ ? await res.text().catch(() => 'Unknown error') : '';
      if (__DEV__) {
        devWarn('Ошибка при загрузке маршрута:', errorText);
      }
      if (options?.throwOnError) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      return [] as unknown as TravelsForMap;
    }

    const payload = await safeJsonParse<unknown>(res, [] as unknown as TravelsForMap);
    return normalizeTravelsForMapPayload(payload);
  } catch (e: unknown) {
    if (e instanceof Error && e.name === 'AbortError') {
      throw e;
    }
    devWarn('Error fetching fetchTravelsNearRoute:', e);
    if (options?.throwOnError) throw e;
    return [] as unknown as TravelsForMap;
  }
};

// --- Ленивые sources места (#1567/#1571) -------------------------------------
// Запрашивается только после первого открытия карточки места с sourceCount > 1
// и кэшируется по placeKey (см. hooks/map/useMapPlaceSources.ts); перелистывание
// popup не перезапрашивает map dataset и не пересобирает marker-слой.

const normalizeMapPlaceSourcesPayload = (payload: unknown): MapPlaceSourcesPage => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { results: [], next: null };
  }
  const obj = payload as Record<string, unknown>;
  const results = Array.isArray(obj.results)
    ? obj.results
        .map((item) => normalizeMapPlaceSource(item, normalizeImageUrl))
        .filter((item): item is MapPlaceSource => item !== null)
    : [];
  const nextRaw = obj.next;
  const next = typeof nextRaw === 'string' && nextRaw.trim() ? nextRaw.trim() : null;
  return { results, next };
};

/** Одна страница sources места. Ошибки бросаются: запрос ленивый и user-triggered. */
export const fetchMapPlaceSources = async (
  placeId: string | number,
  cursor?: string | null,
  options?: ApiOptions,
): Promise<MapPlaceSourcesPage> => {
  const params = new URLSearchParams();
  if (cursor) params.set('cursor', cursor);
  const query = params.toString();
  const url = `${getMapPlaceSourcesUrl(placeId)}${query ? `?${query}` : ''}`;

  const res = await fetchWithTransientRetry(url, { signal: options?.signal }, DEFAULT_TIMEOUT, 1);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  }
  const payload = await safeJsonParse<unknown>(res, { results: [], next: null });
  return normalizeMapPlaceSourcesPayload(payload);
};

/**
 * Все sources места одним вызовом для React Query cache: идём по `next`-курсору
 * с жёстким потолком страниц — материалов у места единицы, потолок только
 * страхует от зацикленного курсора (ср. ловушку backfill next_cursor).
 */
export const fetchAllMapPlaceSources = async (
  placeId: string | number,
  options?: ApiOptions,
): Promise<MapPlaceSource[]> => {
  const MAX_PAGES = 5;
  const results: MapPlaceSource[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const chunk: MapPlaceSourcesPage = await fetchMapPlaceSources(placeId, cursor, options);
    results.push(...chunk.results);
    if (!chunk.next || chunk.next === cursor) break;
    cursor = chunk.next;
  }
  return results;
};

type MapFiltersResponse = {
  categories: unknown[];
  categoryTravelAddress: unknown[];
};

export const fetchFiltersMap = async (options?: ApiOptions): Promise<MapFiltersResponse> => {
  try {
    const res = await fetchWithTimeout(GET_FILTER_FOR_MAP, { signal: options?.signal }, DEFAULT_TIMEOUT);
    // Возвращаем пустой объект фильтров вместо неправильного типа assertion
    const emptyFilters: MapFiltersResponse = {
      categories: [],
      categoryTravelAddress: [],
    };
    if (!res.ok) {
      const err = new Error(`HTTP ${res.status}: ${res.statusText}`);
      if (options?.throwOnError) throw err;
      return emptyFilters;
    }
    return await safeJsonParse<MapFiltersResponse>(res, emptyFilters);
  } catch (e: unknown) {
    if (e instanceof Error && e.name === 'AbortError') {
      throw e;
    }
    devWarn('Error fetching filters:', e);
    const emptyFilters: MapFiltersResponse = {
      categories: [],
      categoryTravelAddress: [],
    };
    if (options?.throwOnError) throw e;
    return emptyFilters;
  }
};
