import { Filters, TravelsForMap, TravelsMap } from '@/types/types';
import { normalizeNumericArray } from '@/utils/filterQuery';
import { devError, devWarn } from '@/utils/logger';
import { safeJsonParse } from '@/utils/safeJsonParse';
import { fetchWithTimeout } from '@/utils/fetchWithTimeout';
import { Platform } from 'react-native';
import { DEFAULT_RADIUS_KM } from '@/constants/mapConfig';

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

const normalizeLatLngString = (value: unknown): string => {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? trimmed : '';
  }
  return '';
};

const normalizeTravelCoordsItem = (raw: any) => {
  const t = raw && typeof raw === 'object' ? raw : {};

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

  // Debug: log first few items to see coordinate format
  if (__DEV__ && Math.random() < 0.05) {
    console.info('[normalizeTravelCoordsItem] Sample:', {
      rawLat: t.lat,
      rawLng: t.lng,
      rawCoord: t.coord,
      normalizedLat: lat,
      normalizedLng: lng,
      finalCoord: coord,
    });
  }

  const address =
    normalizeString(t.address ?? t.adress ?? t.full_address ?? t.name, '').trim() || undefined;

  const categoryName = normalizeString(
    t.categoryName ?? t.category_name ?? t.category ?? t.categoryTravelAddress,
    ''
  );

  const travelImageThumbUrl = normalizeImageUrl(
    t.travelImageThumbUrl ?? t.travel_image_thumb_url ?? t.image ?? t.thumb
  );

  const urlTravel = normalizeString(t.urlTravel ?? t.url_travel ?? t.url, '');
  const articleUrl = normalizeString(t.articleUrl ?? t.article_url, '') || undefined;

  return {
    ...t,
    address,
    categoryName,
    coord,
    lat,
    lng,
    travelImageThumbUrl,
    urlTravel,
    articleUrl,
  };
};

const normalizeTravelsForMapPayload = (payload: unknown): TravelsForMap => {
  if (!payload) return {} as TravelsForMap;
  if (Array.isArray(payload)) {
    // Some backend endpoints historically returned arrays. Preserve that shape
    // to avoid breaking callers/tests that expect arrays.
    return payload.map((item) => normalizeTravelCoordsItem(item)) as unknown as TravelsForMap;
  }
  if (typeof payload === 'object') {
    const out: any = {};
    Object.entries(payload as Record<string, any>).forEach(([key, value]) => {
      out[key] = normalizeTravelCoordsItem(value);
    });
    return out as TravelsForMap;
  }
  return {} as TravelsForMap;
};

const isLocalApi = String(process.env.EXPO_PUBLIC_IS_LOCAL_API || '').toLowerCase() === 'true';
const isE2E = String(process.env.EXPO_PUBLIC_E2E || '').toLowerCase() === 'true';

const envApiUrl = process.env.EXPO_PUBLIC_API_URL;
const webOriginApi =
  Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.origin
    ? `${window.location.origin}/api`
    : '';
const rawApiUrl: string =
  envApiUrl ||
  (Platform.OS === 'web' && (isE2E || isLocalApi) && webOriginApi ? webOriginApi : '') ||
  (process.env.NODE_ENV === 'test' ? 'https://example.test/api' : '');
if (!rawApiUrl) {
  throw new Error('EXPO_PUBLIC_API_URL is not defined. Please set this environment variable.');
}

// Нормализуем базу API: гарантируем суффикс /api и убираем лишние слэши
const URLAPI = (() => {
  const trimmed = rawApiUrl.replace(/\/+$/, '');
  return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
})();

const DEFAULT_TIMEOUT = 10000; // 10 секунд
const LONG_TIMEOUT = 30000; // 30 секунд для тяжелых запросов

// Для запросов с query (?...) оставляем базу без завершающего слеша, для остальных — со слешем.
const SEARCH_TRAVELS_FOR_MAP = `${URLAPI}/travels/search_travels_for_map/`; // далее добавляется ?...
const GET_FILTER_FOR_MAP = `${URLAPI}/filterformap/`;
const GET_TRAVELS = `${URLAPI}/travels/`;
const GET_TRAVELS_OF_MONTH = `${URLAPI}/travels/of-month/`;
const GET_TRAVELS_RANDOM = `${URLAPI}/travels/random/`;
const SEARCH_TRAVELS_NEAR_ROUTE = `${URLAPI}/travels/near-route/`;

type ApiOptions = { signal?: AbortSignal; throwOnError?: boolean };

export const fetchTravelsNear = async (travel_id: number, signal?: AbortSignal) => {
  try {
    const urlTravel = `${GET_TRAVELS}${travel_id}/near/`;
    const res = await fetchWithTimeout(urlTravel, { signal }, DEFAULT_TIMEOUT);
    if (!res.ok) {
      // 404 is a common/expected case for travels that don't have a near-list on backend.
      // We treat it as an empty result to avoid noisy error logs.
      if (res.status === 404) {
        devWarn('Travels near not found (404):', urlTravel);
        return [];
      }

      devError('Error fetching travels near: HTTP', res.status, res.statusText, urlTravel);
      return [];
    }
    return await safeJsonParse<any[]>(res, []);
  } catch (e: any) {
    if (e.name === 'AbortError') {
      throw e;
    }
    devWarn('Error fetching travels near:', e);
    return [];
  }
};

export const fetchTravelsPopular = async (options?: ApiOptions): Promise<TravelsMap> => {
  try {
    const urlTravel = `${GET_TRAVELS}popular/`;
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
  } catch (e: any) {
    if (e?.name === 'AbortError') {
      throw e;
    }
    devWarn('Error fetching travels popular:', { url: `${GET_TRAVELS}popular/`, error: e });
    if (options?.throwOnError) throw e;
    return {} as TravelsMap;
  }
};

export const fetchTravelsOfMonth = async (options?: ApiOptions): Promise<TravelsMap> => {
  try {
    const urlTravel = GET_TRAVELS_OF_MONTH;
    const res = await fetchWithTimeout(urlTravel, { signal: options?.signal }, DEFAULT_TIMEOUT);
    if (!res.ok) {
      const err = new Error(`HTTP ${res.status}: ${res.statusText}`);
      if (options?.throwOnError) throw err;
      return {} as TravelsMap;
    }
    return await safeJsonParse<TravelsMap>(res, {} as TravelsMap);
  } catch (e: any) {
    if (e?.name === 'AbortError') {
      throw e;
    }
    devWarn('Error fetching fetchTravelsOfMonth:', e);
    if (options?.throwOnError) throw e;
    return {} as TravelsMap;
  }
};

export const fetchTravelsRandom = async (options?: ApiOptions): Promise<any[]> => {
  try {
    const urlTravel = GET_TRAVELS_RANDOM;
    const res = await fetchWithTimeout(urlTravel, { signal: options?.signal }, DEFAULT_TIMEOUT);
    if (!res.ok) {
      const err = new Error(`HTTP ${res.status}: ${res.statusText}`);
      if (options?.throwOnError) throw err;
      return [];
    }
    return await safeJsonParse<any[]>(res, []);
  } catch (e: any) {
    if (e?.name === 'AbortError') {
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
  filter: Record<string, any>,
  options?: ApiOptions,
): Promise<TravelsForMap> => {
  try {
    const radius = parseInt(filter?.radius ?? String(DEFAULT_RADIUS_KM), 10);
    const latRaw = filter?.lat ?? '53.9006';
    const lngRaw = filter?.lng ?? '27.5590';
    const lat = typeof latRaw === 'string' ? latRaw : String(latRaw);
    const lng = typeof lngRaw === 'string' ? lngRaw : String(lngRaw);

    const whereObject: Record<string, any> = {
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

    const paramsObj = {
      page: (page + 1).toString(),
      perPage: itemsPerPage.toString(),
      where: JSON.stringify(whereObject),
    };
    const params = new URLSearchParams(paramsObj).toString();

    if (__DEV__) {
      console.info('[fetchTravelsForMap] Request params:', {
        whereObject,
        url: `${SEARCH_TRAVELS_FOR_MAP}?${params}`,
      });
    }

    const urlTravel = `${SEARCH_TRAVELS_FOR_MAP}?${params}`;
    const res = await fetchWithTimeout(urlTravel, { signal: options?.signal }, LONG_TIMEOUT);
    if (!res.ok) {
      const err = new Error(`HTTP ${res.status}: ${res.statusText}`);
      if (options?.throwOnError) throw err;
      return [] as unknown as TravelsForMap;
    }
    const payload = await safeJsonParse<unknown>(res, [] as unknown as TravelsForMap);
    
    // Debug: log sample of raw backend response
    if (__DEV__ && payload) {
      const sample = Array.isArray(payload) ? payload[0] : Object.values(payload)[0];
      if (sample) {
        console.info('[fetchTravelsForMap] Backend response sample:', {
          lat: sample.lat,
          lng: sample.lng,
          coord: sample.coord,
          latitude: sample.latitude,
          longitude: sample.longitude,
        });
      }
    }
    
    return normalizeTravelsForMapPayload(payload);
  } catch (e: any) {
    if (e?.name === 'AbortError') {
      throw e;
    }
    devWarn('Error fetching fetchTravelsForMap:', e);
    if (options?.throwOnError) throw e;
    return [] as unknown as TravelsForMap;
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
  } catch (e: any) {
    if (e?.name === 'AbortError') {
      throw e;
    }
    devWarn('Error fetching fetchTravelsNearRoute:', e);
    if (options?.throwOnError) throw e;
    return [] as unknown as TravelsForMap;
  }
};

export const fetchFiltersMap = async (options?: ApiOptions): Promise<Filters> => {
  try {
    const res = await fetchWithTimeout(GET_FILTER_FOR_MAP, { signal: options?.signal }, DEFAULT_TIMEOUT);
    // Возвращаем пустой объект фильтров вместо неправильного типа assertion
    const emptyFilters: Filters = {
      countries: [],
      categories: [],
      categoryTravelAddress: [],
      companions: [],
      complexity: [],
      month: [],
      over_nights_stay: [],
      transports: [],
      year: ''
    };
    if (!res.ok) {
      const err = new Error(`HTTP ${res.status}: ${res.statusText}`);
      if (options?.throwOnError) throw err;
      return emptyFilters;
    }
    return await safeJsonParse<Filters>(res, emptyFilters);
  } catch (e: any) {
    if (e?.name === 'AbortError') {
      throw e;
    }
    devWarn('Error fetching filters:', e);
    const emptyFilters: Filters = {
      countries: [],
      categories: [],
      categoryTravelAddress: [],
      companions: [],
      complexity: [],
      month: [],
      over_nights_stay: [],
      transports: [],
      year: ''
    };
    if (options?.throwOnError) throw e;
    return emptyFilters;
  }
};
