/**
 * Hook for managing map markers (clustering, visibility, opacity)
 * @module hooks/useMapMarkers
 */

import { useMemo } from 'react';
import { useClustering } from '@/components/MapPage/Map/useClustering';
import type { Point, MapMode } from '@/components/MapPage/Map/types';
import type { LatLng } from '@/types/coordinates';

interface UseMapMarkersOptions {
  /**
   * Travel data points to display on map
   */
  travelData: Point[];

  /**
   * Current map zoom level
   */
  mapZoom: number;

  /**
   * Key of expanded cluster (if any)
   */
  expandedClusterKey?: string | null;

  /**
   * Current map mode (affects marker opacity)
   */
  mode?: MapMode;

  /**
   * Center hint for clustering algorithm
   */
  hintCenter?: LatLng | null;
}

interface UseMapMarkersResult {
  /**
   * Whether to render clusters instead of individual markers
   */
  shouldRenderClusters: boolean;

  /**
   * Clustered marker data
   */
  clusters: any[];

  /**
   * Individual markers (when clustering is disabled)
   */
  markers: Point[];

  /**
   * Marker opacity (reduced in route mode)
   */
  markerOpacity: number;

  /**
   * Total number of points
   */
  totalMarkers: number;
}

/**
 * Manage map markers with clustering support
 *
 * Features:
 * - Automatic clustering based on zoom level
 * - Cluster expansion handling
 * - Marker opacity adjustment for route mode
 * - Performance optimization (memoized calculations)
 *
 * @example
 * ```typescript
 * const {
 *   shouldRenderClusters,
 *   clusters,
 *   markers,
 *   markerOpacity,
 * } = useMapMarkers({
 *   travelData: points,
 *   mapZoom: 11,
 *   mode: 'radius',
 * });
 *
 * return shouldRenderClusters ? (
 *   <ClusterLayer clusters={clusters} opacity={markerOpacity} />
 * ) : (
 *   <MapMarkers markers={markers} opacity={markerOpacity} />
 * );
 * ```
 */
export function useMapMarkers(options: UseMapMarkersOptions): UseMapMarkersResult {
  const {
    travelData,
    mapZoom,
    expandedClusterKey: _expandedClusterKey = null,
    mode = 'radius',
    hintCenter,
  } = options;

  // Clustering logic
  const { shouldRenderClusters: shouldRenderClustersBase, clusters } = useClustering(
    travelData,
    mapZoom,
    hintCenter
  );

  // Only render clusters if we have valid cluster data
  const shouldRenderClusters = useMemo(() => {
    return shouldRenderClustersBase && Array.isArray(clusters) && clusters.length > 0;
  }, [shouldRenderClustersBase, clusters]);

  // Marker opacity (reduced in route mode to emphasize route)
  const markerOpacity = useMemo(() => {
    return mode === 'route' ? 0.45 : 1;
  }, [mode]);

  // Total markers count
  const totalMarkers = useMemo(() => {
    return Array.isArray(travelData) ? travelData.length : 0;
  }, [travelData]);

  const stableClusters = useMemo(() => clusters || [], [clusters]);
  const stableMarkers = useMemo(() => travelData || [], [travelData]);

  return useMemo(() => ({
    shouldRenderClusters,
    clusters: stableClusters,
    markers: stableMarkers,
    markerOpacity,
    totalMarkers,
  }), [shouldRenderClusters, stableClusters, stableMarkers, markerOpacity, totalMarkers]);
}
