/** The canonical map renderer falls back to its route SVG. No mutable tile network in a frozen job. */
export async function generateLeafletRouteSnapshot(): Promise<string> {
  throw new Error('SNAPSHOT_MAP_RASTER_UNAVAILABLE')
}

export async function generateCanvasMapSnapshot(): Promise<string> {
  throw new Error('SNAPSHOT_MAP_RASTER_UNAVAILABLE')
}
