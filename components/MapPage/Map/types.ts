// components/MapPage/map/types.ts
import type { MapUiApi } from '@/src/types/mapUi';
export type Point = {
  id?: number;
  coord: string;
  address: string;
  travelImageThumbUrl: string;
  categoryName: string;
  articleUrl?: string;
  urlTravel?: string;
};

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export type TransportMode = 'car' | 'bike' | 'foot';
export type MapMode = 'radius' | 'route';

export interface MapProps {
  travel?: { data?: Point[] };
  coordinates: Coordinates;
  routePoints: [number, number][];
  setRoutePoints?: (points: [number, number][]) => void;
  onMapClick: (lng: number, lat: number) => void;
  mode: MapMode;
  transportMode: TransportMode;
  setRouteDistance: (distance: number) => void;
  setFullRouteCoords: (coords: [number, number][]) => void;
  radius?: string;
  onMapUiApiReady?: (api: MapUiApi | null) => void;
}

export interface ClusterData {
  key: string;
  count: number;
  center: [number, number];
  bounds: [[number, number], [number, number]];
  items: Point[];
}
