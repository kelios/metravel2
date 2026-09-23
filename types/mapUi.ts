/** Отступы подгонки кадра: верх-лево, низ-право и потолок доли стороны контейнера. */
export type MapFitPadding = {
  topLeft: readonly [number, number];
  bottomRight: readonly [number, number];
  maxShare: number;
};

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
  /**
   * #2058: кадр под набор точек (день маршрута планировщика), не ближе `maxZoom`.
   * #2059: `padding` — несимметричные отступы под каплю маркера и кнопки карты
   * (`ROUTE_MAP_FIT_PADDING`); без него остаются прежние 50 px со всех сторон.
   */
  fitToCoords?: (
    coords: ReadonlyArray<{ lat: number; lng: number }>,
    options: { maxZoom: number; padding?: MapFitPadding },
  ) => void;
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
