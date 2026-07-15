import type React from 'react'
import type { OsmPoiCategory } from '@/utils/overpass'

export interface LeafletLayerLike {
  addTo: (map: unknown) => unknown
  getContainer?: () => unknown
  getTileUrl?: (...args: never[]) => unknown
  _url?: string
}

export interface LeafletOverlayController {
  layer?: unknown
  start?: () => void
  stop?: () => void
  setCategories?: (categories: OsmPoiCategory[]) => void
}

export interface LeafletMarkerLike {
  _map?: {
    once?: (event: string, callback: () => void) => void
  } | null
  openPopup?: () => void
  setZIndexOffset?: (offset: number) => void
}

/**
 * Leaflet controllers are intentionally attached to the React ref object itself
 * (not `current`) so Map.web, useMapInstance and useMapApi share one stable bridge.
 */
export type LeafletControlRef = React.MutableRefObject<unknown> & {
  markerByCoord?: Map<string, LeafletMarkerLike>
  overlayControllers?: Map<string, LeafletOverlayController>
  overpassController?: LeafletOverlayController
  poiController?: LeafletOverlayController
  routesController?: LeafletOverlayController
  wfsController?: LeafletOverlayController
}
