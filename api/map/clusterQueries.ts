import type { ApiOptions, MapClusterBBox, MapClustersFilters, MapClustersResult } from './contracts';
import { normalizeNumericArray } from '@/utils/filterQuery';
import { devWarn } from '@/utils/logger';
import { safeJsonParse } from '@/utils/safeJsonParse';
import { EMPTY_CLUSTERS_RESULT, normalizeMapClustersPayload } from './clusterAdapters';
import { fetchWithTransientRetry, GET_MAP_CLUSTERS, LONG_TIMEOUT } from './transport';

// --- Серверная кластеризация карты (BE #719) ---------------------------------
// GET /api/map/clusters/?bbox=<south,west,north,east>&zoom=<n>[&q=&category=]
// Возвращает { clusters, markers, total_count, ... }. Бэкенд сам выбирает режим:
// на низком зуме/плотности отдаёт clusters (markers пуст), на высоком — markers.

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
