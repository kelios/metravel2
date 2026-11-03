import type { NearbyTravelMapPoint } from './contracts';
import { ApiError } from '@/api/clientErrors';
import { safeJsonParse } from '@/utils/safeJsonParse';
import { fetchPublicWithSession } from '@/api/publicFetchWithSession';
import { translate as i18nT } from '@/i18n';
import { normalizeTravelCoordsItem, normalizeString } from './pointAdapters';
import { DEFAULT_TIMEOUT, GET_TRAVELS } from './transport';

export const NEAR_TRAVELS_LIMIT = 6;

export const fetchNearbyTravelMapPoints = async (
  origin: { lat: number; lng: number },
  travelIds: readonly number[],
  signal?: AbortSignal,
): Promise<NearbyTravelMapPoint[]> => {
  const { lat, lng } = origin;
  if (!Number.isFinite(lat) || Math.abs(lat) > 90 || !Number.isFinite(lng) || Math.abs(lng) > 180) {
    return [];
  }

  const ids = [...new Set(travelIds.filter((id) => Number.isSafeInteger(id) && id > 0))]
    .slice(0, NEAR_TRAVELS_LIMIT);
  if (!ids.length) return [];

  const params = new URLSearchParams({
    travel_ids: ids.join(','),
    lat: String(lat),
    lng: String(lng),
  });
  const response = await fetchPublicWithSession(
    `${GET_TRAVELS}nearby-map-points/?${params.toString()}`,
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

  const payload = await safeJsonParse<{ results?: unknown }>(response);
  if (!Array.isArray(payload?.results)) {
    throw new ApiError(
      502,
      i18nT('errorsStatic:utils.network.requestFailed'),
      { code: 'INVALID_NEARBY_MAP_RESPONSE' },
    );
  }

  return payload.results.flatMap((item: unknown, index): NearbyTravelMapPoint[] => {
    if (!item || typeof item !== 'object' || !('travel_id' in item)) return [];
    const travelId = item.travel_id;
    if (typeof travelId !== 'number' || !ids.includes(travelId)) return [];
    const normalized = normalizeTravelCoordsItem(item) as Record<string, unknown>;
    const coord = normalizeString(normalized.coord, '');
    if (!coord) return [];
    return [{
      id: normalizeString(normalized.id, '') || `${travelId}-${index}`,
      coord,
      address: normalizeString(normalized.address ?? normalized.title, ''),
      travelImageThumbUrl: normalizeString(normalized.travelImageThumbUrl, ''),
      categoryName: normalizeString(normalized.countryName, ''),
      urlTravel: normalizeString(normalized.urlTravel, '') || undefined,
      travelId,
    }];
  });
};
