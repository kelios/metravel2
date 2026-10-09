/** B1 v1 pins route points, not mutable GPX/KML downloads. Canonical map uses the pinned point SVG. */
export async function listTravelRouteFiles(): Promise<never> {
  throw new Error('SNAPSHOT_ROUTE_FILES_UNAVAILABLE')
}

export async function downloadTravelRouteFileBlob(): Promise<never> {
  throw new Error('SNAPSHOT_ROUTE_FILES_UNAVAILABLE')
}

export async function parseRouteFilePreview(): Promise<never> {
  throw new Error('SNAPSHOT_ROUTE_FILES_UNAVAILABLE')
}
