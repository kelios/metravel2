import { useMemo } from 'react';
import { CoordinateConverter } from '@/utils/coordinateConverter';
import { strToLatLng } from './utils';

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
  key: string;
  center: [number, number];
  count: number;
  items: Point[];
  bounds: [[number, number], [number, number]];
}

const CLUSTER_THRESHOLD = 12;
const CLUSTER_EXPAND_ZOOM = 14;

const getClusterRadiusMetersForZoom = (zoom: number) => {
  if (!Number.isFinite(zoom)) return 9000;
  if (zoom >= 16) return 250;
  if (zoom >= 15) return 450;
  if (zoom >= 14) return 750;
  if (zoom >= 13) return 1200;
  if (zoom >= 12) return 2200;
  if (zoom >= 11) return 4200;
  if (zoom >= 10) return 7000;
  if (zoom >= 9) return 11000;
  return 16000;
};

const buildClusterKey = (center: [number, number], count: number) =>
  `${center[0].toFixed(5)}|${center[1].toFixed(5)}|${count}`;

const metersToLatDegrees = (meters: number) => meters / 111_320;
const metersToLngDegrees = (meters: number, atLat: number) => {
  const latRad = (atLat * Math.PI) / 180;
  const cos = Math.max(0.2, Math.cos(latRad));
  return meters / (111_320 * cos);
};

export function useClustering(
  points: Point[],
  mapZoom: number,
  hintCenter?: { lat: number; lng: number } | null
) {
  const shouldCluster = points.length > CLUSTER_THRESHOLD;
  const clusterRadiusMeters = useMemo(() => getClusterRadiusMetersForZoom(mapZoom), [mapZoom]);
  const expandClusters = mapZoom >= CLUSTER_EXPAND_ZOOM;
  const shouldRenderClusters = shouldCluster && !expandClusters;

  const clusters = useMemo<ClusterItem[]>(() => {
    if (!shouldRenderClusters) return [];

    const hintLat =
      hintCenter && CoordinateConverter.isValid(hintCenter) ? Number(hintCenter.lat) : 53.9;
    // Use a slightly larger cell size than the target radius so clustering is stable and fast.
    const cellMeters = Math.max(250, clusterRadiusMeters * 1.25);
    const latStep = metersToLatDegrees(cellMeters);
    const lngStep = metersToLngDegrees(cellMeters, hintLat);

    type InternalCluster = {
      items: Point[];
      sumLat: number;
      sumLng: number;
      minLat: number;
      maxLat: number;
      minLng: number;
      maxLng: number;
    };

    const buckets = new Map<string, InternalCluster>();

    for (const point of points) {
      const ll = strToLatLng(point.coord, hintCenter);
      if (!ll) continue;
      const lng = ll[0];
      const lat = ll[1];
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      if (!CoordinateConverter.isValid({ lat, lng })) continue;

      const x = Math.floor(lng / lngStep);
      const y = Math.floor(lat / latStep);
      const bucketKey = `${x}:${y}`;

      const existing = buckets.get(bucketKey);
      if (!existing) {
        buckets.set(bucketKey, {
          items: [point],
          sumLat: lat,
          sumLng: lng,
          minLat: lat,
          maxLat: lat,
          minLng: lng,
          maxLng: lng,
        });
        continue;
      }

      existing.items.push(point);
      existing.sumLat += lat;
      existing.sumLng += lng;
      existing.minLat = Math.min(existing.minLat, lat);
      existing.maxLat = Math.max(existing.maxLat, lat);
      existing.minLng = Math.min(existing.minLng, lng);
      existing.maxLng = Math.max(existing.maxLng, lng);
    }

    const out: ClusterItem[] = [];
    for (const c of buckets.values()) {
      const count = c.items.length;
      const centerLat = c.sumLat / count;
      const centerLng = c.sumLng / count;
      out.push({
        key: buildClusterKey([centerLat, centerLng], count),
        center: [centerLat, centerLng],
        count,
        items: c.items,
        bounds: [
          [c.minLat, c.minLng],
          [c.maxLat, c.maxLng],
        ],
      });
    }

    return out;
  }, [points, shouldRenderClusters, clusterRadiusMeters, hintCenter]);

  return useMemo(() => ({
    shouldCluster,
    shouldRenderClusters,
    expandClusters,
    clusters,
    clusterRadiusMeters,
    CLUSTER_THRESHOLD,
  }), [
    shouldCluster,
    shouldRenderClusters,
    expandClusters,
    clusters,
    clusterRadiusMeters,
  ]);
}
