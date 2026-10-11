import type { TravelsForMap } from '@/types/types';
import type { ApiOptions } from './contracts';
import { normalizeNumericArray } from '@/utils/filterQuery';
import { devWarn } from '@/utils/logger';
import { safeJsonParse } from '@/utils/safeJsonParse';
import { fetchPublicWithSession } from '@/api/publicFetchWithSession';
import { DEFAULT_RADIUS_KM } from '@/constants/mapConfig';
import { normalizeTravelsForMapPayload } from './pointAdapters';
import { fetchWithTransientRetry, LONG_TIMEOUT, SEARCH_TRAVELS_FOR_MAP, SEARCH_TRAVELS_NEAR_ROUTE } from './transport';

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

    // POST: на web помощник добавляет X-CSRFToken (сессионная cookie без него → 403).
    const res = await fetchPublicWithSession(SEARCH_TRAVELS_NEAR_ROUTE, {
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
