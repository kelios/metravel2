export type MapUiApi = {
  zoomIn: () => void;
  zoomOut: () => void;
  /**
   * Center on the user. The owner of the trusted position (useMapCoordinates via
   * useMapController) may pass it explicitly: the map component is memoized against
   * location-only prop changes, so its own copy can be several renders stale, and
   * without an explicit target the call used to escalate to a second geolocation
   * request just to learn the point the caller already had.
   */
  centerOnUser: (target?: { lat: number; lng: number } | null) => void;
  fitToResults: () => void;
  focusOnCoord?: (coord: string, options?: { zoom?: number }) => void;
  openPopupForCoord?: (coord: string) => void;
  exportGpx: () => void;
  exportKml: () => void;
  setBaseLayer: (id: string) => void;
  setOverlayEnabled: (id: string, enabled: boolean) => void;
  setOsmPoiCategories?: (categories: string[]) => void;
  capabilities?: {
    canCenterOnUser: boolean;
    canFitToResults: boolean;
    canExportRoute: boolean;
  };
};
