import { DEFAULT_RADIUS_KM } from '@/constants/mapDefaults';
import { normalizeNumericArray } from '@/utils/filterQuery';

export const MAP_RADIUS_QUERY_PATH = '/travels/search_travels_for_map/';

export const roundMapRadiusAnchorCoordinate = (value: number | undefined): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? Math.round(value * 1e4) / 1e4 : value;

export function buildMapRadiusQuery(page: number, itemsPerPage: number, filter: Record<string, unknown>): string {
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
  return new URLSearchParams(paramsObj).toString();
}
