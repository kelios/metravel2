// components/map-core/index.ts
// Barrel re-export for unified map contract

export type {
  MapMarker,
  LegacyMapPoint,
  Point,
  MapViewState,
  MapBounds,
  Coordinates,
  TransportMode,
  MapMode,
  RouteSegment,
  RouteState,
  MapPopupProps,
  MapClusterData,
  MapEventHandlers,
  MapCoreProps,
} from './types';

export {
  parseCoordString,
  legacyPointToMarker,
  normalizePoint,
} from './types';

// C2.2: Shared popup
export { default as MapPopup } from './MapPopup';
export type { MapPopupConfig } from './MapPopup';
export { getPopupCss } from './mapPopupStyles';

// C2.3: Shared Leaflet lifecycle
export { useMapLifecycle, hasMapPane } from './useMapLifecycle';
export type { UseMapLifecycleOptions, UseMapLifecycleReturn } from './useMapLifecycle';

// C4.1: Elevation
export { useElevation, sampleIndices, computeElevationGainLoss } from './useElevation';
export type { UseElevationOptions, UseElevationResult } from './useElevation';

// C2.4: Marker layer
export { default as MapMarkerLayer, FitBoundsOnData } from './MapMarkerLayer';
export type { MarkerLayerProps, FitBoundsProps } from './MapMarkerLayer';

