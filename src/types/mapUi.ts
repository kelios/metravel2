export type MapUiApi = {
  zoomIn: () => void;
  zoomOut: () => void;
  centerOnUser: () => void;
  fitToResults: () => void;
  exportGpx: () => void;
  exportKml: () => void;
  setBaseLayer: (id: string) => void;
  setOverlayEnabled: (id: string, enabled: boolean) => void;
};
