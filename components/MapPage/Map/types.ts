// components/MapPage/map/types.ts
import type { MapUiApi } from '@/types/mapUi';

// Re-export shared types from map-core for backward compatibility
export type { Point, Coordinates, TransportMode, MapMode } from '@/components/map-core';
import type { Point, TransportMode, MapMode, Coordinates } from '@/components/map-core';

export interface MapProps {
  travel?: { data?: Point[] };
  coordinates: Coordinates;
  routePoints: [number, number][];
  fullRouteCoords?: [number, number][];
  setRoutePoints?: (points: [number, number][]) => void;
  onMapClick: (lng: number, lat: number) => void;
  mode: MapMode;
  transportMode: TransportMode;
  setRouteDistance: (distance: number) => void;
  setRouteDuration?: (durationSeconds: number) => void;
  setFullRouteCoords: (coords: [number, number][]) => void;
  setRouteElevationStats?: (gainMeters: number | null, lossMeters: number | null) => void;
  setRoutingLoading?: (loading: boolean) => void;
  setRoutingError?: (error: string | null) => void;
  radius?: string;
  onMapUiApiReady?: (api: MapUiApi | null) => void;
  onUserLocationChange?: (loc: Coordinates | null) => void;
  hideFloatingControls?: boolean;
  /**
   * #207 — mobile-web: fired when a single (non-cluster) marker is tapped, so the
   * caller can show a bottom card instead of the anchored Leaflet popup.
   */
  onMarkerSelect?: (point: Point) => void;
  /** #207 — fired on an empty-map tap so the caller can dismiss the bottom card. */
  onMapBackgroundTap?: () => void;
  /**
   * When true, a single-marker tap pans/zooms to the point but does NOT open the
   * Leaflet popup (the caller renders a bottom card via onMarkerSelect instead).
   */
  suppressLeafletPopupOnSelect?: boolean;
}

export interface ClusterData {
  key: string;
  count: number;
  center: [number, number];
  bounds: [[number, number], [number, number]];
  items: Point[];
}
