/**
 * Place layers of the /map web canvas — a leaf INSIDE the MapContainer (#2451).
 *
 * It owns the viewport snapshot and the backend-cluster query
 * (`useServerPlaceLayerData`), so their state updates re-render only this leaf
 * and the two layers, never the Map.web tree above. Both layers stay mounted:
 * backend clusters → ServerClusterLayer, every individual place →
 * MarkerClusterGroup (popup/bottom-card semantics, client de-cluttering).
 */
import React from 'react'

import type { MapClustersFilters } from '@/api/map'

import MarkerClusterGroup from './MarkerClusterGroup'
import ServerClusterLayer, { type ServerClusterZoomPayload } from './ServerClusterLayer'
import type { MapMode, Point } from './types'
import { useServerPlaceLayerData } from './useMapRenderData'

export type MapWebPlacesLayerProps = {
  L: any
  useMap: () => any
  Popup: React.ComponentType<any>
  Tooltip?: React.ComponentType<any>
  mapInstance: any
  fallbackZoom: number
  mode: MapMode
  pointsOnly: boolean
  canRenderMap: boolean
  travelData: Point[]
  radiusCenter: { lat: number; lng: number } | null
  radiusInMeters: number | null
  mapClusterFilters?: MapClustersFilters
  categoryFilterUnresolved: boolean
  freezeServerClusters: boolean
  markerIcon: any
  markerOpacity: number
  PopupContent: any
  popupProps?: Record<string, unknown>
  suppressLeafletPopupOnSelect: boolean
  hintCenter: { lat: number; lng: number } | null
  onMarkerClick: (point: Point, coords: { lat: number; lng: number }, marker?: any) => void
  onMarkerInstance: (coord: string, marker: any | null) => void
  onClusterTap?: () => void
  onServerClusterZoom?: (payload: ServerClusterZoomPayload) => void
}

const MapWebPlacesLayer: React.FC<MapWebPlacesLayerProps> = ({
  L,
  useMap,
  Popup,
  Tooltip,
  mapInstance,
  fallbackZoom,
  mode,
  pointsOnly,
  canRenderMap,
  travelData,
  radiusCenter,
  radiusInMeters,
  mapClusterFilters,
  categoryFilterUnresolved,
  freezeServerClusters,
  markerIcon,
  markerOpacity,
  PopupContent,
  popupProps,
  suppressLeafletPopupOnSelect,
  hintCenter,
  onMarkerClick,
  onMarkerInstance,
  onClusterTap,
  onServerClusterZoom,
}) => {
  const { markers, clusters } = useServerPlaceLayerData({
    mapInstance,
    fallbackZoom,
    mode,
    pointsOnly,
    canRenderMap,
    travelData,
    radiusCenter,
    radiusInMeters,
    mapClusterFilters,
    categoryFilterUnresolved,
    freezeServerClusters,
  })

  return (
    <>
      <ServerClusterLayer
        L={L}
        useMap={useMap}
        clusters={clusters}
        onClusterZoom={onServerClusterZoom}
        onClusterTap={onClusterTap}
      />
      <MarkerClusterGroup
        L={L}
        useMap={useMap}
        points={markers}
        markerIcon={markerIcon}
        markerOpacity={markerOpacity}
        PopupContent={PopupContent}
        Popup={Popup}
        Tooltip={Tooltip}
        popupProps={popupProps}
        suppressLeafletPopupOnSelect={suppressLeafletPopupOnSelect}
        onMarkerClick={onMarkerClick}
        onMarkerInstance={onMarkerInstance}
        onClusterTap={onClusterTap}
        hintCenter={hintCenter}
      />
    </>
  )
}

export default React.memo(MapWebPlacesLayer)
