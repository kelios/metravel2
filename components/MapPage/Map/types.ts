// components/MapPage/map/types.ts
import type { MapUiApi } from '@/types/mapUi';
import type { MapClusterBBox, MapClustersFilters } from '@/api/map';

// Re-export shared types from map-core for backward compatibility
export type { Point, Coordinates, TransportMode, MapMode } from '@/components/map-core';
import type { Point, TransportMode, MapMode, Coordinates } from '@/components/map-core';

export interface MapProps {
  travel?: { data?: Point[] };
  coordinates: Coordinates;
  /**
   * True when `coordinates` is the non-user DEFAULT center (no real geolocation,
   * no cache, no explicit anchor). When true the web map skips deriving a real
   * "you are here" position from `coordinates`. Explicit origin flag — replaces
   * Minsk coordinate-matching so a user near Minsk is still treated as real.
   */
  coordinatesAreFallback?: boolean;
  userLocation?: Coordinates | null;
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
  /** Keep radius-based filtering without drawing the search circle. */
  showRadiusCircle?: boolean;
  mapClusterFilters?: MapClustersFilters;
  /**
   * True when a category filter is active but its names did not resolve to
   * numeric backend IDs, so the server-cluster endpoint can't filter by category
   * and returns everything. When true the map renders the client-side
   * name-filtered dataset instead of the (unfiltered) server clusters, so
   * deselecting a category actually removes its markers.
   */
  categoryFilterUnresolved?: boolean;
  onMapUiApiReady?: (api: MapUiApi | null) => void;
  onUserLocationChange?: (loc: Coordinates | null) => void;
  /**
   * F-49 — fired (debounced) on map pan/zoom end with the new map center, so the
   * caller can offer a Google-Maps-style "Search this area" action.
   */
  onMapMove?: (center: MapMovePayload) => void;
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
  /**
   * When true, the map renders ONLY the points passed via `travel.data` and never
   * queries the server-side travel/places cluster endpoint (`/api/map/clusters/`).
   * Used by the quests map (`/quests`), which passes its own quest markers and must
   * not show travel/places points. Defaults to false so /map, /travels and
   * /travel/[id] keep their server-clustered travel layer.
   */
  pointsOnly?: boolean;
  /**
   * Показывать контрол офлайн-загрузки текущей области карты. Реализован только
   * на native (Map.ios) — web игнорирует проп (тайлы кэширует браузер/сеть).
   */
  enableOfflineDownload?: boolean;
}

export type MapMovePayload = Coordinates & {
  bbox?: MapClusterBBox;
  zoom?: number;
};

export interface ClusterData {
  key: string;
  count: number;
  center: [number, number];
  bounds: [[number, number], [number, number]];
  items: Point[];
}
