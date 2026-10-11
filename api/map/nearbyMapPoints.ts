import type { Travel } from '@/types/types';
import type { NearbyTravelMapPoint } from './contracts';
import { ApiError } from '@/api/clientErrors';
import { devWarn } from '@/utils/logger';
import { safeJsonParse } from '@/utils/safeJsonParse';
import { fetchPublicWithSession } from '@/api/publicFetchWithSession';
import { translate as i18nT } from '@/i18n';
import { normalizeTravelCoordsItem, normalizeString } from './pointAdapters';
import { DEFAULT_TIMEOUT, SEARCH_TRAVELS_FOR_MAP_LITE } from './transport';

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
      const response = await fetchPublicWithSession(
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
            // Фильтр выше оставил только строки этой статьи — `travel.id`
            // и есть id статьи, на которую ведёт `urlTravel`.
            travelId: travel.id,
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
