import type { MapClusterBBox, MapClusterPoint, MapCluster, MapClustersResult } from './contracts';
import { readMapPlaceMarkerFields } from '@/api/mapPlaces';
import { indexMediaImage } from '@/utils/mediaPlaceholderIndex';
import { normalizeCoordString, normalizeLatLngString, normalizeString, normalizeImageUrl, readMapPointMediaEntry } from './pointAdapters';

export const EMPTY_CLUSTERS_RESULT: MapClustersResult = {
  clusters: [],
  markers: [],
  totalCount: 0,
  source: '',
  generatedAt: '',
};

const normalizeClusterPoint = (raw: unknown): MapClusterPoint => {
  const t = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};

  const lat = normalizeLatLngString(t.lat ?? t.latitude);
  const lng = normalizeLatLngString(t.lng ?? t.longitude);
  const coord = lat && lng ? `${lat},${lng}` : normalizeCoordString(t.coord) ?? '';

  const travelImageUrl = normalizeImageUrl(
    t.travelImageUrl ?? t.travel_image_url ?? t.imageUrl ?? t.image_url ?? t.image,
  );
  const travelImageThumbUrl = normalizeImageUrl(
    t.travelImageThumbUrl ?? t.travel_image_thumb_url ?? t.thumb ?? travelImageUrl,
  );

  const idRaw = t.point_id ?? t.id;
  const id = typeof idRaw === 'number' || typeof idRaw === 'string' ? idRaw : undefined;

  // Серверная кластеризация — второй источник тех же карточек/попапов, поэтому
  // индекс заливки прогревается и здесь (см. `normalizeTravelCoordsItem`).
  indexMediaImage(readMapPointMediaEntry(t), [travelImageThumbUrl, travelImageUrl]);

  return {
    id,
    coord,
    lat,
    lng,
    address: normalizeString(t.address ?? t.title ?? t.name, ''),
    categoryName: normalizeString(t.categoryName ?? t.category_name ?? t.category, ''),
    travelImageThumbUrl,
    imageUrl: travelImageUrl || travelImageThumbUrl,
    urlTravel: normalizeString(t.urlTravel ?? t.url_travel ?? t.url, ''),
    articleUrl: normalizeString(t.articleUrl ?? t.article_url, '') || undefined,
    countryName: normalizeString(t.countryName ?? t.country_name, '') || undefined,
    countryCode: normalizeString(t.countryCode ?? t.country_code, '') || undefined,
    // Явная пересборка объекта иначе потеряла бы grouped place DTO (#1567).
    ...readMapPlaceMarkerFields(t, normalizeImageUrl),
  };
};

const normalizeCluster = (raw: unknown): MapCluster | null => {
  if (!raw || typeof raw !== 'object') return null;
  const c = raw as Record<string, unknown>;

  const centerRaw =
    c.center && typeof c.center === 'object' ? (c.center as Record<string, unknown>) : {};
  const lat = Number(centerRaw.lat);
  const lng = Number(centerRaw.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const boundsRaw =
    c.bounds && typeof c.bounds === 'object' ? (c.bounds as Record<string, unknown>) : {};
  const bounds: MapClusterBBox = {
    south: Number(boundsRaw.south),
    west: Number(boundsRaw.west),
    north: Number(boundsRaw.north),
    east: Number(boundsRaw.east),
  };

  const countRaw = Number(c.count);
  const previewRaw = c.preview_items ?? c.previewItems;
  const previewItems = Array.isArray(previewRaw) ? previewRaw.map(normalizeClusterPoint) : [];

  return {
    id: normalizeString(c.id, '') || `${lat.toFixed(5)}|${lng.toFixed(5)}`,
    center: { lat, lng },
    count: Number.isFinite(countRaw) && countRaw > 0 ? countRaw : previewItems.length,
    bounds,
    previewItems,
  };
};

export const normalizeMapClustersPayload = (payload: unknown): MapClustersResult => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return EMPTY_CLUSTERS_RESULT;
  }
  const obj = payload as Record<string, unknown>;

  const clusters = Array.isArray(obj.clusters)
    ? obj.clusters.map(normalizeCluster).filter((c): c is MapCluster => c !== null)
    : [];
  const markers = Array.isArray(obj.markers) ? obj.markers.map(normalizeClusterPoint) : [];

  const totalRaw = Number(obj.total_count ?? obj.totalCount);

  return {
    clusters,
    markers,
    totalCount: Number.isFinite(totalRaw)
      ? totalRaw
      : clusters.reduce((a, c) => a + c.count, 0) + markers.length,
    source: normalizeString(obj.source, ''),
    generatedAt: normalizeString(obj.generated_at ?? obj.generatedAt, ''),
  };
};
