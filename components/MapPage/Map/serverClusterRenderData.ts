import type { MapCluster, MapClusterPoint, MapClustersResult } from '@/api/map';
import type { ClusterData, Point } from './types';

const hasFiniteCoord = (lat: number, lng: number) => Number.isFinite(lat) && Number.isFinite(lng);

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
