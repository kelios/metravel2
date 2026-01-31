// Centralized exports for map-related hooks
export { useMapCoordinates, DEFAULT_COORDINATES } from './useMapCoordinates';
export type { Coordinates } from './useMapCoordinates';

export { useMapFilters } from './useMapFilters';
export type { FiltersData } from './useMapFilters';

export { useMapTravels } from './useMapTravels';

export { useMapPanelState, useMapResponsive } from './useMapPanelState';

// New specialized controllers
export { useMapDataController } from './useMapDataController';
export { useMapUIController } from './useMapUIController';
export { useRouteController } from './useRouteController';
