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

    const parsedPoints: Array<{ point: Point; lat: number; lng: number }> = [];
    for (const point of points) {
      const ll = strToLatLng(point.coord, hintCenter);
      if (!ll) continue;
      const lng = ll[0];
      const lat = ll[1];
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      if (!CoordinateConverter.isValid({ lat, lng })) continue;
      parsedPoints.push({ point, lat, lng });
    }

    type InternalCluster = {
      items: Point[];
      sumLat: number;
      sumLng: number;
      minLat: number;
      maxLat: number;
      minLng: number;
      maxLng: number;
    };

    const out: InternalCluster[] = [];

    for (const p of parsedPoints) {
      let bestIdx = -1;
      let bestDist = Infinity;

      for (let i = 0; i < out.length; i++) {
        const c = out[i];
        const centerLat = c.sumLat / c.items.length;
        const centerLng = c.sumLng / c.items.length;
        const dist = CoordinateConverter.distance(
          { lat: p.lat, lng: p.lng },
          { lat: centerLat, lng: centerLng }
        );
        if (dist <= clusterRadiusMeters && dist < bestDist) {
          bestDist = dist;
          bestIdx = i;
        }
      }

      if (bestIdx === -1) {
        out.push({
          items: [p.point],
          sumLat: p.lat,
          sumLng: p.lng,
          minLat: p.lat,
          maxLat: p.lat,
          minLng: p.lng,
          maxLng: p.lng,
        });
        continue;
      }

      const target = out[bestIdx];
      target.items.push(p.point);
      target.sumLat += p.lat;
      target.sumLng += p.lng;
      target.minLat = Math.min(target.minLat, p.lat);
      target.maxLat = Math.max(target.maxLat, p.lat);
      target.minLng = Math.min(target.minLng, p.lng);
      target.maxLng = Math.max(target.maxLng, p.lng);
    }

    return out.map((c) => {
      const count = c.items.length;
      const centerLat = c.sumLat / count;
      const centerLng = c.sumLng / count;
      const key = buildClusterKey([centerLat, centerLng], count);
      return {
        key,
        center: [centerLat, centerLng],
        count,
        items: c.items,
        bounds: [
          [c.minLat, c.minLng],
          [c.maxLat, c.maxLng],
        ],
      };
    });
  }, [points, shouldRenderClusters, clusterRadiusMeters, hintCenter]);

  return {
    shouldCluster,
    shouldRenderClusters,
    expandClusters,
    clusters,
    clusterRadiusMeters,
    CLUSTER_THRESHOLD,
  };
}

