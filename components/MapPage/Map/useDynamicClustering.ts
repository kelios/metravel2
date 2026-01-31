/**
 * Dynamic Grid Clustering - adaptive grid size based on zoom level
 * More efficient than distance-based clustering for large datasets
 * @module components/MapPage/Map/useDynamicClustering
 */

import { useMemo } from 'react';
import { CoordinateConverter } from '@/utils/coordinateConverter';
import type { Point } from './types';

interface ClusterItem {
  key: string;
  center: [number, number];
  count: number;
  items: Point[];
  bounds: [[number, number], [number, number]];
}

interface DynamicClusteringOptions {
  /**
   * Minimum number of points to trigger clustering
   */
  threshold?: number;

  /**
   * Zoom level at which to disable clustering
   */
  expandZoom?: number;

  /**
   * Grid cell size in degrees (adaptive based on zoom)
   */
  gridSize?: number;
}

/**
 * Get adaptive grid size based on zoom level
 * Higher zoom = smaller grid cells
 */
function getGridSizeForZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) return 0.1;

  // Grid size in degrees
  if (zoom >= 16) return 0.001;  // ~100m
  if (zoom >= 15) return 0.002;  // ~200m
  if (zoom >= 14) return 0.004;  // ~400m
  if (zoom >= 13) return 0.008;  // ~800m
  if (zoom >= 12) return 0.015;  // ~1.5km
  if (zoom >= 11) return 0.03;   // ~3km
  if (zoom >= 10) return 0.06;   // ~6km
  if (zoom >= 9) return 0.1;     // ~10km
  return 0.2;                     // ~20km
}

/**
 * Grid-based clustering algorithm
 * Much faster than distance-based for large datasets
 *
 * Time complexity: O(n) vs O(n²) for distance-based
 */
function clusterByGrid(
  points: Array<{ point: Point; lat: number; lng: number }>,
  gridSize: number
): ClusterItem[] {
  // Group points into grid cells
  const grid = new Map<string, Array<{ point: Point; lat: number; lng: number }>>();

  for (const p of points) {
    // Snap to grid
    const gridLat = Math.floor(p.lat / gridSize) * gridSize;
    const gridLng = Math.floor(p.lng / gridSize) * gridSize;
    const cellKey = `${gridLat.toFixed(6)},${gridLng.toFixed(6)}`;

    if (!grid.has(cellKey)) {
      grid.set(cellKey, []);
    }
    grid.get(cellKey)!.push(p);
  }

  // Convert grid cells to clusters
  const clusters: ClusterItem[] = [];

  for (const [cellKey, cellPoints] of grid.entries()) {
    if (cellPoints.length === 0) continue;

    // Calculate cluster center (average of points)
    let sumLat = 0;
    let sumLng = 0;
    let minLat = Infinity;
    let maxLat = -Infinity;
    let minLng = Infinity;
    let maxLng = -Infinity;

    for (const p of cellPoints) {
      sumLat += p.lat;
      sumLng += p.lng;
      minLat = Math.min(minLat, p.lat);
      maxLat = Math.max(maxLat, p.lat);
      minLng = Math.min(minLng, p.lng);
      maxLng = Math.max(maxLng, p.lng);
    }

    const centerLat = sumLat / cellPoints.length;
    const centerLng = sumLng / cellPoints.length;

    clusters.push({
      key: `${cellKey}|${cellPoints.length}`,
      center: [centerLat, centerLng],
      count: cellPoints.length,
      items: cellPoints.map(p => p.point),
      bounds: [[minLat, minLng], [maxLat, maxLng]],
    });
  }

  return clusters;
}

/**
 * Dynamic grid-based clustering hook
 *
 * Performance improvements over distance-based clustering:
 * - O(n) time complexity vs O(n²)
 * - ~5-10x faster for >100 points
 * - Adaptive grid size based on zoom
 * - Less memory usage
 *
 * @example
 * ```typescript
 * const { shouldRenderClusters, clusters } = useDynamicClustering(
 *   points,
 *   mapZoom,
 *   { threshold: 25, expandZoom: 14 }
 * );
 * ```
 */
export function useDynamicClustering(
  points: Point[],
  mapZoom: number,
  options: DynamicClusteringOptions = {}
) {
  const {
    threshold = 25,
    expandZoom = 14,
  } = options;

  const shouldCluster = points.length > threshold;
  const expandClusters = mapZoom >= expandZoom;
  const shouldRenderClusters = shouldCluster && !expandClusters;

  const gridSize = useMemo(
    () => getGridSizeForZoom(mapZoom),
    [mapZoom]
  );

  const clusters = useMemo<ClusterItem[]>(() => {
    if (!shouldRenderClusters) return [];

    // Parse points
    const parsedPoints: Array<{ point: Point; lat: number; lng: number }> = [];

    for (const point of points) {
      // Try to parse coordinates
      let lat: number;
      let lng: number;

      try {
        const coordStr = String(point.coord || '').trim();
        if (!coordStr) continue;

        const cleaned = coordStr.replace(/;/g, ',').replace(/\s+/g, '');
        const parts = cleaned.split(',');

        if (parts.length !== 2) continue;

        lat = parseFloat(parts[0]);
        lng = parseFloat(parts[1]);

        if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
        if (!CoordinateConverter.isValid({ lat, lng })) continue;

        parsedPoints.push({ point, lat, lng });
      } catch {
        continue;
      }
    }

    // Cluster using grid algorithm
    return clusterByGrid(parsedPoints, gridSize);
  }, [points, shouldRenderClusters, gridSize]);

  return {
    shouldRenderClusters,
    clusters,
    gridSize,
  };
}

/**
 * Get statistics about clustering performance
 */
export function useClusteringStats(
  totalPoints: number,
  clusters: ClusterItem[]
) {
  return useMemo(() => {
    if (clusters.length === 0) {
      return {
        totalPoints,
        clusterCount: 0,
        singletonCount: 0,
        averageClusterSize: 0,
        maxClusterSize: 0,
        reductionRatio: 0,
      };
    }

    let singletonCount = 0;
    let maxClusterSize = 0;
    let totalClusteredPoints = 0;

    for (const cluster of clusters) {
      if (cluster.count === 1) {
        singletonCount++;
      }
      maxClusterSize = Math.max(maxClusterSize, cluster.count);
      totalClusteredPoints += cluster.count;
    }

    const averageClusterSize = totalClusteredPoints / clusters.length;
    const reductionRatio = (1 - clusters.length / totalPoints) * 100;

    return {
      totalPoints,
      clusterCount: clusters.length,
      singletonCount,
      averageClusterSize,
      maxClusterSize,
      reductionRatio,
    };
  }, [totalPoints, clusters]);
}
