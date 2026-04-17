export const CLUSTER_DISABLE_ZOOM = 16

export const getClusterZoomFitBoundsOptions = (viewport: { width?: number; height?: number }) => {
  const width = Number.isFinite(viewport.width) ? Number(viewport.width) : 1024
  const height = Number.isFinite(viewport.height) ? Number(viewport.height) : 768
  const isNarrow = width <= 640
  const isVeryShort = height <= 720

  if (!isNarrow) {
    return {
      animate: true,
      paddingTopLeft: [30, 34] as [number, number],
      paddingBottomRight: [30, 34] as [number, number],
      maxZoom: CLUSTER_DISABLE_ZOOM,
    }
  }

  return {
    animate: true,
    paddingTopLeft: [16, 104] as [number, number],
    paddingBottomRight: [16, isVeryShort ? 188 : 224] as [number, number],
    // Keep mobile cluster expansion aligned with the clustering cutoff.
    maxZoom: CLUSTER_DISABLE_ZOOM,
  }
}
