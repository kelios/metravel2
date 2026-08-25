import type { MapCluster, MapClusterPoint, MapClustersResult } from '@/api/map';
import type { ClusterData, Point } from './types';
import { CoordinateConverter } from '@/utils/coordinateConverter';
import { strToLatLng } from './utils';

const hasFiniteCoord = (lat: number, lng: number) => Number.isFinite(lat) && Number.isFinite(lng);
const RADIUS_FILTER_TOLERANCE_METERS = 250;
const RADIUS_FILTER_TOLERANCE_RATIO = 0.01;

export const mapClusterPointToPoint = (point: MapClusterPoint): Point => {
  const lat = Number(point.lat);
  const lng = Number(point.lng);
  const coord =
    typeof point.coord === 'string' && point.coord.trim()
      ? point.coord
      : hasFiniteCoord(lat, lng)
        ? `${lat},${lng}`
        : '';

  return {
    id: point.id,
    coord,
    address: point.address,
    categoryName: point.categoryName,
    travelImageThumbUrl: point.travelImageThumbUrl || point.imageUrl,
    imageUrl: point.imageUrl || point.travelImageThumbUrl,
    urlTravel: point.urlTravel,
    articleUrl: point.articleUrl,
    // Явный список полей иначе терял бы grouped place DTO (#1571), и серверные
    // кластеры продолжали бы рисовать по маркеру на запись статьи (#1573).
    placeId: point.placeId,
    sourceCount: point.sourceCount,
    primarySource: point.primarySource,
  } as Point;
};

/**
 * Cluster identity for React keys and change detection.
 *
 * Deliberately geometric, NOT `cluster.id`: the backend hands out a fresh opaque
 * hash per request, so two overlapping viewports at the same zoom describe the very
 * same cluster under two different ids (measured on prod: 9 of 11 centers identical,
 * 0 ids shared). Keying on that id made React destroy and recreate every cluster
 * marker on every pan (#1347). Center+count survives a pan, which is exactly what a
 * key must do.
 */
const CLUSTER_KEY_PRECISION = 4;

const clusterGeometryKey = (lat: number, lng: number, count: number): string =>
  `${lat.toFixed(CLUSTER_KEY_PRECISION)}|${lng.toFixed(CLUSTER_KEY_PRECISION)}|${count}`;

export const mapServerClusterToClusterData = (cluster: MapCluster): ClusterData | null => {
  const lat = Number(cluster.center?.lat);
  const lng = Number(cluster.center?.lng);
  const south = Number(cluster.bounds?.south);
  const west = Number(cluster.bounds?.west);
  const north = Number(cluster.bounds?.north);
  const east = Number(cluster.bounds?.east);

  if (!hasFiniteCoord(lat, lng) || !hasFiniteCoord(south, west) || !hasFiniteCoord(north, east)) {
    return null;
  }

  const items = Array.isArray(cluster.previewItems)
    ? cluster.previewItems.map(mapClusterPointToPoint).filter((point) => point.coord)
    : [];
  const count = Number.isFinite(cluster.count) && cluster.count > 0 ? cluster.count : items.length;

  return {
    key: clusterGeometryKey(lat, lng, count),
    count,
    center: [lat, lng],
    bounds: [
      [south, west],
      [north, east],
    ],
    items,
  };
};

export interface ServerClusterRenderData {
  clusters: ClusterData[];
  markers: Point[];
  hasServerData: boolean;
}

/**
 * Geometric keys can collide when two clusters share a rounded centre and count.
 * Give the later ones a deterministic suffix so React never sees duplicate keys.
 */
const dedupeClusterKeys = (clusters: ClusterData[]): ClusterData[] => {
  const seen = new Map<string, number>();
  return clusters.map((cluster) => {
    const used = seen.get(cluster.key) ?? 0;
    seen.set(cluster.key, used + 1);
    return used === 0 ? cluster : { ...cluster, key: `${cluster.key}#${used}` };
  });
};

export const buildServerClusterRenderData = (
  data: MapClustersResult | null | undefined,
): ServerClusterRenderData => {
  const clusters = Array.isArray(data?.clusters)
    ? dedupeClusterKeys(
        data.clusters
          .map(mapServerClusterToClusterData)
          .filter((cluster): cluster is ClusterData => cluster !== null),
      )
    : [];
  const markers = Array.isArray(data?.markers)
    ? data.markers.map(mapClusterPointToPoint).filter((point) => point.coord)
    : [];

  return {
    clusters,
    markers,
    hasServerData: clusters.length > 0 || markers.length > 0,
  };
};

export const getRadiusFilterLimit = (radiusMeters: number): number =>
  radiusMeters + Math.max(RADIUS_FILTER_TOLERANCE_METERS, radiusMeters * RADIUS_FILTER_TOLERANCE_RATIO);

const isPointInsideRadius = (
  point: Point,
  center: { lat: number; lng: number },
  radiusLimitMeters: number,
): boolean => {
  try {
    const ll = strToLatLng(String(point?.coord ?? ''), center);
    if (!ll) return false;
    const coords = { lat: ll[1], lng: ll[0] };
    if (!CoordinateConverter.isValid(coords)) return false;
    const d = CoordinateConverter.distance(center, coords);
    return Number.isFinite(d) && d <= radiusLimitMeters;
  } catch {
    return false;
  }
};

const isClusterInsideRadius = (
  cluster: ClusterData,
  center: { lat: number; lng: number },
  radiusLimitMeters: number,
): boolean => {
  const [lat, lng] = cluster.center;
  const clusterCenter = { lat, lng };
  if (
    CoordinateConverter.isValid(clusterCenter) &&
    CoordinateConverter.distance(center, clusterCenter) <= radiusLimitMeters
  ) {
    return true;
  }

  return Array.isArray(cluster.items)
    ? cluster.items.some((point) => isPointInsideRadius(point, center, radiusLimitMeters))
    : false;
};

export const filterServerClusterRenderDataByRadius = (
  data: ServerClusterRenderData,
  center: { lat: number; lng: number } | null | undefined,
  radiusMeters: number | null | undefined,
): ServerClusterRenderData => {
  if (!center || !CoordinateConverter.isValid(center)) return data;
  const radius = Number(radiusMeters);
  if (!Number.isFinite(radius) || radius <= 0) return data;

  const radiusLimitMeters = getRadiusFilterLimit(radius);
  const clusters = data.clusters.filter((cluster) =>
    isClusterInsideRadius(cluster, center, radiusLimitMeters),
  );
  const markers = data.markers.filter((point) =>
    isPointInsideRadius(point, center, radiusLimitMeters),
  );

  return {
    clusters,
    markers,
    hasServerData: clusters.length > 0 || markers.length > 0,
  };
};
