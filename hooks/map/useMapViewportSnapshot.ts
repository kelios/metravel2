import { useEffect, useMemo, useState } from 'react';
import type { MapClusterBBox } from '@/api/map';

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

  useEffect(() => {
    if (!enabled || !map || typeof map.on !== 'function') {
      setSnapshot((prev) => (sameSnapshot(prev, initialSnapshot) ? prev : initialSnapshot));
      return;
    }

    let frameId: number | null = null;
    const readAndStore = () => {
      frameId = null;
      const next = readMapViewportSnapshot(map, initialSnapshot.zoom);
      setSnapshot((prev) => (sameSnapshot(prev, next) ? prev : next));
    };

    const scheduleRead = () => {
      if (frameId != null) return;
      if (typeof requestAnimationFrame === 'function') {
        frameId = requestAnimationFrame(readAndStore);
      } else {
        readAndStore();
      }
    };

    scheduleRead();
    map.on('moveend', scheduleRead);
    map.on('zoomend', scheduleRead);

    return () => {
      if (frameId != null && typeof cancelAnimationFrame === 'function') {
        cancelAnimationFrame(frameId);
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
