import { useEffect, useMemo, useRef, useState } from 'react';
import type { MapClusterBBox } from '@/api/map';
import { programmaticMapMoveRemainingMs } from '@/components/MapPage/Map/programmaticMoveSignal';

export interface MapViewportSnapshot {
  bbox: MapClusterBBox | null;
  zoom: number;
}

type LeafletBoundsLike = {
  getSouth?: () => unknown;
  getWest?: () => unknown;
  getNorth?: () => unknown;
  getEast?: () => unknown;
  getSouthWest?: () => { lat?: unknown; lng?: unknown } | null | undefined;
  getNorthEast?: () => { lat?: unknown; lng?: unknown } | null | undefined;
};

type LeafletMapLike = {
  getZoom?: () => unknown;
  getBounds?: () => LeafletBoundsLike | null | undefined;
  on?: (event: string, handler: () => void) => void;
  off?: (event: string, handler: () => void) => void;
};

const EPSILON = 0.0001;

const toFiniteNumber = (value: unknown): number | null => {
  const next = Number(value);
  return Number.isFinite(next) ? next : null;
};

export const readMapViewportSnapshot = (
  map: LeafletMapLike | null | undefined,
  fallbackZoom: number,
): MapViewportSnapshot => {
  const zoom = toFiniteNumber(map?.getZoom?.()) ?? fallbackZoom;
  const bounds = map?.getBounds?.();
  if (!bounds) return { bbox: null, zoom };

  const south =
    toFiniteNumber(bounds.getSouth?.()) ?? toFiniteNumber(bounds.getSouthWest?.()?.lat);
  const west =
    toFiniteNumber(bounds.getWest?.()) ?? toFiniteNumber(bounds.getSouthWest?.()?.lng);
  const north =
    toFiniteNumber(bounds.getNorth?.()) ?? toFiniteNumber(bounds.getNorthEast?.()?.lat);
  const east =
    toFiniteNumber(bounds.getEast?.()) ?? toFiniteNumber(bounds.getNorthEast?.()?.lng);

  if (south == null || west == null || north == null || east == null) {
    return { bbox: null, zoom };
  }

  return { bbox: { south, west, north, east }, zoom };
};

const sameBBox = (left: MapClusterBBox | null, right: MapClusterBBox | null): boolean => {
  if (left === right) return true;
  if (!left || !right) return false;
  return (
    Math.abs(left.south - right.south) < EPSILON &&
    Math.abs(left.west - right.west) < EPSILON &&
    Math.abs(left.north - right.north) < EPSILON &&
    Math.abs(left.east - right.east) < EPSILON
  );
};

const sameSnapshot = (left: MapViewportSnapshot, right: MapViewportSnapshot): boolean =>
  Math.abs(left.zoom - right.zoom) < EPSILON && sameBBox(left.bbox, right.bbox);

/**
 * #1347 — the published bbox is deliberately wider than the visible viewport, and a
 * new snapshot is published only when the viewport LEAVES the area already fetched
 * (or the rounded zoom changes, which changes server-side clustering anyway).
 *
 * Before this, every `moveend`/`zoomend` published a fresh bbox: React re-rendered
 * the whole map subtree and `useMapClusters` issued another 70–320 KB request even
 * for a nudge of a few hundred metres. The margin below is the slack a user gets for
 * free; 0.2 keeps the over-fetch modest (~1.4× per axis) while absorbing small pans.
 */
const VIEWPORT_MARGIN_RATIO = 0.2;

const padBBox = (bbox: MapClusterBBox): MapClusterBBox => {
  const latMargin = Math.abs(bbox.north - bbox.south) * VIEWPORT_MARGIN_RATIO;
  const lngMargin = Math.abs(bbox.east - bbox.west) * VIEWPORT_MARGIN_RATIO;
  return {
    south: Math.max(-90, bbox.south - latMargin),
    north: Math.min(90, bbox.north + latMargin),
    west: Math.max(-180, bbox.west - lngMargin),
    east: Math.min(180, bbox.east + lngMargin),
  };
};

const bboxContains = (outer: MapClusterBBox | null, inner: MapClusterBBox | null): boolean => {
  if (!outer || !inner) return false;
  return (
    inner.south >= outer.south - EPSILON &&
    inner.north <= outer.north + EPSILON &&
    inner.west >= outer.west - EPSILON &&
    inner.east <= outer.east + EPSILON
  );
};

export function useMapViewportSnapshot(
  map: LeafletMapLike | null | undefined,
  fallbackZoom: number,
  enabled = true,
): MapViewportSnapshot {
  const initialSnapshot = useMemo<MapViewportSnapshot>(
    () => ({ bbox: null, zoom: Number.isFinite(fallbackZoom) ? fallbackZoom : 11 }),
    [fallbackZoom],
  );
  const [snapshot, setSnapshot] = useState<MapViewportSnapshot>(initialSnapshot);
  // What the last published (padded) snapshot actually covers. Kept out of state so
  // the containment check itself never triggers a render.
  const publishedRef = useRef<MapViewportSnapshot | null>(null);

  useEffect(() => {
    if (!enabled || !map || typeof map.on !== 'function') {
      publishedRef.current = null;
      setSnapshot((prev) => (sameSnapshot(prev, initialSnapshot) ? prev : initialSnapshot));
      return;
    }

    let frameId: number | null = null;
    let settleTimer: ReturnType<typeof setTimeout> | null = null;

    const scheduleRead = () => {
      if (frameId != null) return;
      if (typeof requestAnimationFrame === 'function') {
        frameId = requestAnimationFrame(readAndStore);
      } else {
        readAndStore();
      }
    };

    const readAndStore = () => {
      frameId = null;
      // Ignore viewport churn caused by our own programmatic map motion (auto-fit /
      // flyTo / setView). Reading here would refetch clusters for the in-flight
      // animated viewport and could feed a fit⇄data flicker loop on mobile. Instead
      // schedule a single trailing read once the self-induced move settles, so the
      // cluster query still matches the final viewport.
      const remaining = programmaticMapMoveRemainingMs();
      if (remaining > 0) {
        if (settleTimer == null && typeof setTimeout === 'function') {
          settleTimer = setTimeout(() => {
            settleTimer = null;
            scheduleRead();
          }, remaining + 48);
        }
        return;
      }
      const next = readMapViewportSnapshot(map, initialSnapshot.zoom);
      const published = publishedRef.current;
      if (
        published &&
        next.bbox &&
        Math.round(published.zoom) === Math.round(next.zoom) &&
        bboxContains(published.bbox, next.bbox)
      ) {
        // Still inside the area we already fetched at this zoom — nothing to do.
        return;
      }
      const padded: MapViewportSnapshot = next.bbox
        ? { bbox: padBBox(next.bbox), zoom: next.zoom }
        : next;
      publishedRef.current = padded;
      setSnapshot((prev) => (sameSnapshot(prev, padded) ? prev : padded));
    };

    scheduleRead();
    map.on('moveend', scheduleRead);
    map.on('zoomend', scheduleRead);

    return () => {
      if (frameId != null && typeof cancelAnimationFrame === 'function') {
        cancelAnimationFrame(frameId);
      }
      if (settleTimer != null) {
        clearTimeout(settleTimer);
        settleTimer = null;
      }
      try {
        map.off?.('moveend', scheduleRead);
        map.off?.('zoomend', scheduleRead);
      } catch {
        // noop
      }
    };
  }, [enabled, initialSnapshot, map]);

  return snapshot;
}
