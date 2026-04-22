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
}

export interface ClusterData {
  key: string;
  count: number;
  center: [number, number];
  bounds: [[number, number], [number, number]];
  items: Point[];
}
