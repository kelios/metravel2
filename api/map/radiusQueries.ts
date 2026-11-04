import type { TravelsForMap } from '@/types/types';
import type { ApiOptions } from './contracts';
import { buildMapRadiusQuery } from '@/utils/mapRadiusQuery';
import { consumeMapRadiusPreload } from '@/utils/mapRadiusPreload';
import { devWarn } from '@/utils/logger';
import { safeJsonParse } from '@/utils/safeJsonParse';
import { fetchPublicWithSession } from '@/api/publicFetchWithSession';
import { normalizeTravelsForMapPayload } from './pointAdapters';
import { fetchWithTransientRetry, LONG_TIMEOUT, SEARCH_TRAVELS_FOR_MAP, SEARCH_TRAVELS_NEAR_ROUTE } from './transport';

export const fetchTravelsForMap = async (
  page: number,
  itemsPerPage: number,
  filter: Record<string, unknown>,
  options?: ApiOptions,
): Promise<TravelsForMap> => {
  try {
    const urlTravel = `${SEARCH_TRAVELS_FOR_MAP}?${buildMapRadiusQuery(page, itemsPerPage, filter)}`;
    const preloaded = await consumeMapRadiusPreload(urlTravel, options?.signal, (res) => safeJsonParse<unknown>(res));
    if (preloaded !== undefined) return normalizeTravelsForMapPayload(preloaded);

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
    const payload = await safeJsonParse<unknown>(res, []);
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
