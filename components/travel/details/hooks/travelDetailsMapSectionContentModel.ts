type RoutePreviewItem = {
  preview?: {
    linePoints?: Array<unknown>
  }
}

export function getTravelDetailsMapSectionContentFlags(params: {
  canRenderHeavy: boolean
  mapOpened: boolean
  shouldForceRenderMap: boolean
}) {
  const shouldRender = params.canRenderHeavy

  return {
    isLoading: false,
    shouldRender,
    shouldRenderMapContent: shouldRender || params.shouldForceRenderMap || params.mapOpened,
  }
}

export function hasTravelDetailsMapData(params: {
  hasEmbeddedCoords: boolean
  hasTravelAddressPoints: boolean
  routePreviewItems: RoutePreviewItem[]
}) {
  return (
    params.hasEmbeddedCoords ||
    params.hasTravelAddressPoints ||
    params.routePreviewItems.some((item) => (item.preview?.linePoints?.length ?? 0) > 0)
  )
}
