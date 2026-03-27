import React from 'react'

import type { ImportedPoint } from '@/types/userPoints'

import { UserPointsMapPointMarkerWeb } from './UserPointsMapPointMarker.web'

type DriveInfo =
  | { status: 'loading' }
  | { status: 'ok'; distanceKm: number; durationMin: number }
  | { status: 'error' }

type UserPointsMapWebLayersProps = {
  mods: any
  points: ImportedPoint[]
  colors: {
    primary: string
    primarySoft: string
    surface: string
    text: string
  }
  centerOverride?: { lat: number; lng: number }
  searchMarker?: { lat: number; lng: number; label?: string } | null
  activePointId?: number | null
  pendingMarker?: { lat: number; lng: number } | null
  pendingMarkerColor?: string
  routeLines?: Array<{ id: number; line: Array<[number, number]> }>
  mapInstance: any
  isCompactPopup: boolean
  isNarrowPopup: boolean
  isTinyPopup: boolean
  driveInfoById: Record<number, DriveInfo | undefined>
  polylinePathOptions: any
  getMarkerIconCached: (color: any, opts?: { active?: boolean; emphasize?: boolean }) => any
  onPointPress?: (point: ImportedPoint) => void
  onEditPoint?: (point: ImportedPoint) => void
  onDeletePoint?: (point: ImportedPoint) => void
  requestDriveInfo: (args: { pointId: number; pointLat: number; pointLng: number }) => void
  registerPointMarker: (args: {
    pointId: number
    marker: any | null
    coordKey?: string
    coordKeyFixed?: string
  }) => void
}

export function UserPointsMapWebStyles({
  colors,
}: {
  colors: {
    surface: string
  }
}) {
  return (
    <style>
      {`
        /* Leaflet core layout: ensure panes/tiles are positioned correctly.
           /map injects these styles; /userpoints needs the same baseline to avoid "tile islands". */
        .leaflet-container {
          position: relative;
          overflow: hidden !important;
          outline: 0;
        }

        .leaflet-container img.leaflet-tile {
          max-width: none !important;
          max-height: none !important;
        }

        .leaflet-pane,
        .leaflet-map-pane,
        .leaflet-tile-pane,
        .leaflet-overlay-pane,
        .leaflet-shadow-pane,
        .leaflet-marker-pane,
        .leaflet-tooltip-pane,
        .leaflet-popup-pane {
          position: absolute !important;
          top: 0;
          left: 0;
        }

        .metravel-user-point-popup .leaflet-popup-content-wrapper {
          background: ${colors.surface};
          box-shadow: 0 10px 30px rgba(12, 18, 28, 0.28);
          border-radius: 16px;
          overflow: hidden;
          max-width: min(88vw, 360px);
        }

        .metravel-user-point-popup .leaflet-popup-content {
          margin: 0 !important;
          width: auto !important;
          min-width: 0 !important;
          max-width: min(88vw, 360px);
        }

        .metravel-user-point-popup .leaflet-popup-tip {
          background: ${colors.surface};
        }
      `}
    </style>
  )
}

export const UserPointsMapWebLayers = React.memo(function UserPointsMapWebLayers(props: UserPointsMapWebLayersProps) {
  const {
    mods,
    points,
    colors,
    centerOverride,
    searchMarker,
    activePointId,
    pendingMarker,
    pendingMarkerColor,
    routeLines,
    mapInstance,
    isCompactPopup,
    isNarrowPopup,
    isTinyPopup,
    driveInfoById,
    polylinePathOptions,
    getMarkerIconCached,
    onPointPress,
    onEditPoint,
    onDeletePoint,
    requestDriveInfo,
    registerPointMarker,
  } = props

  return (
    <>
      {centerOverride && Number.isFinite(centerOverride.lat) && Number.isFinite(centerOverride.lng) ? (
        <mods.Marker
          key="__user__"
          position={[centerOverride.lat, centerOverride.lng]}
          icon={getMarkerIconCached(colors.primary, { active: true })}
        >
          <mods.Popup>
            <div style={{ fontSize: 12, color: colors.text }}>
              <strong>Моё местоположение</strong>
            </div>
          </mods.Popup>
        </mods.Marker>
      ) : null}

      {searchMarker && Number.isFinite(searchMarker.lat) && Number.isFinite(searchMarker.lng) ? (
        <mods.Marker
          key="__search__"
          position={[searchMarker.lat, searchMarker.lng]}
          icon={getMarkerIconCached(colors.primarySoft, { active: true })}
        >
          {String(searchMarker.label || '').trim() ? (
            <mods.Popup>
              <div style={{ fontSize: 12, color: colors.text }}>
                <strong>{String(searchMarker.label)}</strong>
              </div>
            </mods.Popup>
          ) : null}
        </mods.Marker>
      ) : null}

      {(routeLines ?? []).map((route) => {
        if (!mods?.Polyline) return null
        if (!Array.isArray(route?.line) || route.line.length < 2) return null
        return <mods.Polyline key={`route-${route.id}`} positions={route.line} pathOptions={polylinePathOptions} />
      })}

      {pendingMarker ? (
        <mods.Marker
          key="__pending__"
          position={[pendingMarker.lat, pendingMarker.lng]}
          icon={getMarkerIconCached(pendingMarkerColor)}
        />
      ) : null}

      {points.map((point) => {
        const id = Number((point as any)?.id)
        const driveInfo = Number.isFinite(id) ? driveInfoById[id] : undefined
        const lat = Number((point as any)?.latitude)
        const lng = Number((point as any)?.longitude)
        const coordKey = Number.isFinite(lat) && Number.isFinite(lng) ? `${lat},${lng}` : ''
        const coordKeyFixed = Number.isFinite(lat) && Number.isFinite(lng) ? `${lat.toFixed(6)},${lng.toFixed(6)}` : ''

        return (
          <UserPointsMapPointMarkerWeb
            key={String((point as any)?.id)}
            mods={mods}
            point={point}
            isActive={Number(activePointId) === Number((point as any)?.id)}
            colors={colors as any}
            mapInstance={mapInstance}
            isCompactPopup={isCompactPopup}
            isNarrowPopup={isNarrowPopup}
            isTinyPopup={isTinyPopup}
            centerOverride={centerOverride}
            driveInfo={driveInfo}
            getMarkerIconCached={getMarkerIconCached}
            onPointPress={onPointPress}
            onEditPoint={onEditPoint}
            onDeletePoint={onDeletePoint}
            requestDriveInfo={requestDriveInfo}
            onMarkerReady={({ pointId, marker }) => {
              registerPointMarker({ pointId, marker, coordKey, coordKeyFixed })
            }}
          />
        )
      })}
    </>
  )
})
