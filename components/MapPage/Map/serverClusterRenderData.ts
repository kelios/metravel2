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
  } as Point;
};

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

  return {
    key: cluster.id || `${lat.toFixed(5)}|${lng.toFixed(5)}|${cluster.count}`,
    count: Number.isFinite(cluster.count) && cluster.count > 0 ? cluster.count : items.length,
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

export const buildServerClusterRenderData = (
  data: MapClustersResult | null | undefined,
): ServerClusterRenderData => {
  const clusters = Array.isArray(data?.clusters)
    ? data.clusters
        .map(mapServerClusterToClusterData)
        .filter((cluster): cluster is ClusterData => cluster !== null)
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
