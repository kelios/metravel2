// useClustering.ts - Hook for managing marker clustering
import { useMemo } from 'react';
import { CoordinateConverter } from '@/utils/coordinateConverter';

interface Point {
  id?: number;
  coord: string;
  address: string;
  travelImageThumbUrl: string;
  categoryName: string;
  articleUrl?: string;
  urlTravel?: string;
}

interface ClusterItem {
  center: [number, number];
  count: number;
  items: Point[];
}

const CLUSTER_THRESHOLD = 25;
const CLUSTER_GRID = 0.045; // ~5 км ячейка на широте 55-60
const CLUSTER_EXPAND_ZOOM = 15;

const getClusterGridForZoom = (zoom: number) => {
  if (!Number.isFinite(zoom)) return CLUSTER_GRID;
  if (zoom >= 16) return 0.0015;
  if (zoom >= 15) return 0.0025;
  if (zoom >= 14) return 0.005;
  if (zoom >= 13) return 0.01;
  if (zoom >= 12) return 0.02;
  if (zoom >= 11) return 0.03;
  return CLUSTER_GRID;
};

const buildClusterKey = (center: [number, number], count: number) =>
  `${center[0].toFixed(5)}|${center[1].toFixed(5)}|${count}`;

const strToLatLng = (s: string): [number, number] | null => {
  const parsed = CoordinateConverter.fromLooseString(s);
  if (!parsed) return null;
  return [parsed.lng, parsed.lat];
};

export function useClustering(
  points: Point[],
  mapZoom: number,
  expandedClusterKey: string | null
) {
  const shouldCluster = points.length > CLUSTER_THRESHOLD;
  const clusterGrid = useMemo(() => getClusterGridForZoom(mapZoom), [mapZoom]);
  const expandClusters = mapZoom >= CLUSTER_EXPAND_ZOOM;
  const shouldRenderClusters = shouldCluster && !expandClusters;

  const clusters = useMemo<ClusterItem[]>(() => {
    if (!shouldRenderClusters) return [];

    const grid: Map<string, { center: [number, number]; items: Point[] }> = new Map();

    for (const point of points) {
      const coords = strToLatLng(point.coord);
      if (!coords) continue;

      const gridX = Math.floor(coords[0] / clusterGrid);
      const gridY = Math.floor(coords[1] / clusterGrid);
      const key = `${gridX}|${gridY}`;

      if (!grid.has(key)) {
        grid.set(key, { center: coords, items: [] });
      }
      grid.get(key)!.items.push(point);
    }

    return Array.from(grid.values()).map(({ center, items }) => ({
      center,
      count: items.length,
      items,
    }));
  }, [points, shouldRenderClusters, clusterGrid]);

  const expandedCluster = useMemo(() => {
    if (!expandedClusterKey) return null;
    return clusters.find((c) => buildClusterKey(c.center, c.count) === expandedClusterKey) || null;
  }, [clusters, expandedClusterKey]);

  const visiblePoints = useMemo(() => {
    if (!shouldRenderClusters) return points;
    if (expandedCluster) return expandedCluster.items;
    return [];
  }, [shouldRenderClusters, points, expandedCluster]);

  return {
    shouldCluster,
    shouldRenderClusters,
    expandClusters,
    clusters,
    expandedCluster,
    visiblePoints,
    clusterGrid,
    buildClusterKey,
    CLUSTER_THRESHOLD,
  };
}

