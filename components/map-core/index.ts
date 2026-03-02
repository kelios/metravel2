// components/map-core/index.ts
// Barrel re-export for unified map contract

export type {
  MapMarker,
  LegacyMapPoint,
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
} from './types';

