import { Filters, TravelsForMap, TravelsMap } from '@/src/types/types';
import { normalizeNumericArray } from '@/src/utils/filterQuery';
import { devError, devWarn } from '@/src/utils/logger';
import { safeJsonParse } from '@/src/utils/safeJsonParse';
import { fetchWithTimeout } from '@/src/utils/fetchWithTimeout';

const rawApiUrl: string =
  process.env.EXPO_PUBLIC_API_URL || (process.env.NODE_ENV === 'test' ? 'https://example.test/api' : '');
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
const SEARCH_TRAVELS_NEAR_ROUTE = `${URLAPI}/travels/near-route/`;

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

export const fetchTravelsPopular = async (): Promise<TravelsMap> => {
  try {
    const urlTravel = `${GET_TRAVELS}popular/`;
    const res = await fetchWithTimeout(urlTravel, {}, DEFAULT_TIMEOUT);
    return await safeJsonParse<TravelsMap>(res, {} as TravelsMap);
  } catch (e) {
    devWarn('Error fetching fetchTravelsPopular:', e);
    return {} as TravelsMap;
  }
};

export const fetchTravelsOfMonth = async (): Promise<TravelsMap> => {
  try {
    const urlTravel = GET_TRAVELS_OF_MONTH;
    const res = await fetchWithTimeout(urlTravel, {}, DEFAULT_TIMEOUT);
    return await safeJsonParse<TravelsMap>(res, {} as TravelsMap);
  } catch (e) {
    devWarn('Error fetching fetchTravelsOfMonth:', e);
    return {} as TravelsMap;
  }
};

export const fetchTravelsForMap = async (
  page: number,
  itemsPerPage: number,
  filter: Record<string, any>,
): Promise<TravelsForMap> => {
  try {
    const radius = parseInt(filter?.radius ?? '60', 10);
    const lat = filter?.lat ?? '53.9006';
    const lng = filter?.lng ?? '27.5590';

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

    const urlTravel = `${SEARCH_TRAVELS_FOR_MAP}?${params}`;
    const res = await fetchWithTimeout(urlTravel, {}, LONG_TIMEOUT);
    return await safeJsonParse<TravelsForMap>(res, [] as unknown as TravelsForMap);
  } catch (e) {
    devWarn('Error fetching fetchTravelsForMap:', e);
    return [] as unknown as TravelsForMap;
  }
};

export const fetchTravelsNearRoute = async (
  routeCoords: [number, number][],
  toleranceKm: number = 2,
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
    }, LONG_TIMEOUT);

    if (!res.ok) {
      const errorText = __DEV__ ? await res.text().catch(() => 'Unknown error') : '';
      if (__DEV__) {
        devWarn('Ошибка при загрузке маршрута:', errorText);
      }
      return [] as unknown as TravelsForMap;
    }

    return await safeJsonParse<TravelsForMap>(res, [] as unknown as TravelsForMap);
  } catch (e) {
    devWarn('Error fetching fetchTravelsNearRoute:', e);
    return [] as unknown as TravelsForMap;
  }
};

export const fetchFiltersMap = async (): Promise<Filters> => {
  try {
    const res = await fetchWithTimeout(GET_FILTER_FOR_MAP, {}, DEFAULT_TIMEOUT);
    return await safeJsonParse<Filters>(res, [] as unknown as Filters);
  } catch (e) {
    devWarn('Error fetching filters:', e);
    return [] as unknown as Filters;
  }
};
