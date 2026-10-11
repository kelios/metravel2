import type { ApiOptions, MapFiltersResponse } from './contracts';
import { devWarn } from '@/utils/logger';
import { safeJsonParse } from '@/utils/safeJsonParse';
import { fetchWithTimeout } from '@/utils/fetchWithTimeout';
import { DEFAULT_TIMEOUT, GET_FILTER_FOR_MAP } from './transport';

export const fetchFiltersMap = async (options?: ApiOptions): Promise<MapFiltersResponse> => {
  try {
    const res = await fetchWithTimeout(GET_FILTER_FOR_MAP, { signal: options?.signal }, DEFAULT_TIMEOUT);
    // Возвращаем пустой объект фильтров вместо неправильного типа assertion
    const emptyFilters: MapFiltersResponse = { categories: [] };
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
    const emptyFilters: MapFiltersResponse = { categories: [] };
    if (options?.throwOnError) throw e;
    return emptyFilters;
  }
};
