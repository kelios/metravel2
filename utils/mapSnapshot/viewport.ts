export function lngToTileX(lng: number, zoom: number): number {
  return ((lng + 180) / 360) * Math.pow(2, zoom);
}

export function latToTileY(lat: number, zoom: number): number {
  const radians = lat * Math.PI / 180;
  return ((1 - Math.log(Math.tan(radians) + 1 / Math.cos(radians)) / Math.PI) / 2) * Math.pow(2, zoom);
}

export function calculateFitZoom(minLat: number, maxLat: number, minLng: number, maxLng: number, width: number, height: number, paddingFactor = 1.3, maxCandidateZoom = 16): number {
  for (let zoom = maxCandidateZoom; zoom >= 2; zoom--) {
    const x1 = lngToTileX(minLng, zoom) * 256;
    const x2 = lngToTileX(maxLng, zoom) * 256;
    const y1 = latToTileY(maxLat, zoom) * 256;
    const y2 = latToTileY(minLat, zoom) * 256;
    if ((x2 - x1) * paddingFactor <= width && (y2 - y1) * paddingFactor <= height) return zoom;
  }
  return 2;
}

export type CanvasMapViewport = {width: number; height: number; zoom: number; centerXPx: number; centerYPx: number; startTX: number; endTX: number; startTY: number; endTY: number};

/** One numerical viewport for the canonical raster author and vector overlays. */
export function buildCanvasMapViewport(points: readonly {lat: number; lng: number}[], routeLine: ReadonlyArray<readonly [number, number]>, width: number, height: number, maxZoom: number, fitPaddingFactor: number): CanvasMapViewport {
  const coordinates = [...points.map(point => [point.lat, point.lng] as const), ...routeLine];
  if (!coordinates.length) throw new Error('Map viewport requires coordinates');
  const lats = coordinates.map(point => point[0]), lngs = coordinates.map(point => point[1]);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats), minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const zoom = Math.min(maxZoom, calculateFitZoom(minLat, maxLat, minLng, maxLng, width, height, fitPaddingFactor, maxZoom));
  const centerXPx = lngToTileX((minLng + maxLng) / 2, zoom) * 256;
  const centerYPx = latToTileY((minLat + maxLat) / 2, zoom) * 256;
  const maxTile = Math.pow(2, zoom) - 1;
  return {width, height, zoom, centerXPx, centerYPx,
    startTX: Math.max(0, Math.floor((centerXPx - width / 2) / 256)), endTX: Math.min(maxTile, Math.floor((centerXPx + width / 2) / 256)),
    startTY: Math.max(0, Math.floor((centerYPx - height / 2) / 256)), endTY: Math.min(maxTile, Math.floor((centerYPx + height / 2) / 256))};
}

export function projectCanvasMapPoint(viewport: CanvasMapViewport, lat: number, lng: number) {
  return {x: lngToTileX(lng, viewport.zoom) * 256 - (viewport.centerXPx - viewport.width / 2),
    y: latToTileY(lat, viewport.zoom) * 256 - (viewport.centerYPx - viewport.height / 2)};
}
