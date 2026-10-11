import type { Travel, TravelsMap } from '@/types/types';
import type { ApiOptions } from './contracts';
import { ApiError } from '@/api/clientErrors';
import { parseNearTravelsEnvelope } from '@/api/travelNearResponse';
import { devError, devWarn } from '@/utils/logger';
import { safeJsonParse } from '@/utils/safeJsonParse';
import { fetchPublicWithSession } from '@/api/publicFetchWithSession';
import { translate as i18nT } from '@/i18n';
import { DEFAULT_TIMEOUT, GET_TRAVELS, GET_TRAVELS_OF_MONTH, GET_TRAVELS_RANDOM, withOptionalLimit } from './transport';

export const fetchTravelsNear = async (
  travel_id: number,
  signal?: AbortSignal,
  limit?: number,
): Promise<Travel[]> => {
  try {
    const urlTravel = withOptionalLimit(`${GET_TRAVELS}${travel_id}/near/`, limit);
    const res = await fetchPublicWithSession(urlTravel, { signal }, DEFAULT_TIMEOUT);
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

export const fetchTravelsPopular = async (options?: ApiOptions): Promise<TravelsMap> => {
  try {
    const urlTravel = withOptionalLimit(`${GET_TRAVELS}popular/`, options?.limit);
    const res = await fetchPublicWithSession(urlTravel, { signal: options?.signal }, DEFAULT_TIMEOUT);
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
    const res = await fetchPublicWithSession(urlTravel, { signal: options?.signal }, DEFAULT_TIMEOUT);
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
    const res = await fetchPublicWithSession(urlTravel, { signal: options?.signal }, DEFAULT_TIMEOUT);
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
