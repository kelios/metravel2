import React from 'react'

import type { ImportedPoint } from '@/types/userPoints'

import { UserPointsClusterLayer, type UserPointMarkerHandle } from './UserPointsClusterLayer.web'
import { UserPointPopupContent } from './UserPointPopupContent.web'
import { translate as i18nT } from '@/i18n'


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
    backgroundTertiary: string
  }
  centerOverride?: { lat: number; lng: number }
  searchMarker?: { lat: number; lng: number; label?: string } | null
  activePointId?: number | null
  pendingMarker?: { lat: number; lng: number } | null
  pendingMarkerColor?: string
  routeLines?: Array<{ id: number; line: Array<[number, number]> }>
  mapInstance: any
  isCompactPopup: boolean
  driveInfoById: Record<number, DriveInfo | undefined>
  polylinePathOptions: any
  getMarkerIconCached: (color: any, opts?: { active?: boolean; emphasize?: boolean }) => any
  onPointPress?: (point: ImportedPoint) => void
  onEditPoint?: (point: ImportedPoint) => void
  onDeletePoint?: (point: ImportedPoint) => void
  requestDriveInfo: (args: { pointId: number; pointLat: number; pointLng: number }) => void
  registerPointMarker: (args: {
    pointId: number
    marker: UserPointMarkerHandle | null
    coordKey?: string
    coordKeyFixed?: string
  }) => void
}

/** Зум, к которому карта приближается при клике по точке (как у общей карты). */
const POINT_FOCUS_ZOOM = 14

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
          width: min(88vw, 360px) !important;
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
    driveInfoById,
    polylinePathOptions,
    getMarkerIconCached,
    onPointPress,
    onEditPoint,
    onDeletePoint,
    requestDriveInfo,
    registerPointMarker,
  } = props

  // Клик по маркеру: приблизить к точке, при известной геолокации запросить
  // время в пути, сообщить экрану о выборе. Попап Leaflet открывает сам (bindPopup).
  const handleMarkerClick = React.useCallback(
    (point: ImportedPoint, _handle: UserPointMarkerHandle) => {
      const lat = Number(point.latitude)
      const lng = Number(point.longitude)
      const pointId = Number(point.id)
      try {
        const map = mapInstance
        if (map && typeof map.getZoom === 'function' && typeof map.setView === 'function') {
          const currentZoom = map.getZoom()
          const nextZoom = Math.max(POINT_FOCUS_ZOOM, Number.isFinite(currentZoom) ? currentZoom : POINT_FOCUS_ZOOM)
          map.setView([lat, lng], nextZoom, { animate: true } as any)
        }
      } catch {
        // noop
      }

      try {
        const userLat = Number(centerOverride?.lat)
        const userLng = Number(centerOverride?.lng)
        const driveInfo = Number.isFinite(pointId) ? driveInfoById[pointId] : undefined
        if (
          Number.isFinite(pointId) &&
          Number.isFinite(userLat) &&
          Number.isFinite(userLng) &&
          driveInfo?.status !== 'ok' &&
          driveInfo?.status !== 'loading'
        ) {
          requestDriveInfo({ pointId, pointLat: lat, pointLng: lng })
        }
      } catch {
        // noop
      }

      onPointPress?.(point)
    },
    [centerOverride?.lat, centerOverride?.lng, driveInfoById, mapInstance, onPointPress, requestDriveInfo],
  )

  const renderPopup = React.useCallback(
    (point: ImportedPoint, closePopup: () => void) => {
      const pointId = Number(point.id)
      return (
        <UserPointPopupContent
          point={point}
          colors={colors as any}
          isCompactPopup={isCompactPopup}
          driveInfo={Number.isFinite(pointId) ? driveInfoById[pointId] : undefined}
          onClose={closePopup}
          onEditPoint={onEditPoint}
          onDeletePoint={onDeletePoint}
        />
      )
    },
    [colors, driveInfoById, isCompactPopup, onDeletePoint, onEditPoint],
  )

  return (
    <>
      {centerOverride && Number.isFinite(centerOverride.lat) && Number.isFinite(centerOverride.lng) ? (
        <mods.Marker
          key="__user__"
          position={[centerOverride.lat, centerOverride.lng]}
          icon={getMarkerIconCached(colors.primary, { active: true })}
          title={i18nT('map:components.UserPoints.UserPointsMapWebLayers.moe_mestopolozhenie_7ab4d787')}
          alt={i18nT('map:components.UserPoints.UserPointsMapWebLayers.moe_mestopolozhenie_7ab4d787')}
        >
          <mods.Popup>
            <div style={{ fontSize: 12, color: colors.text }}>
              <strong>{i18nT('map:components.UserPoints.UserPointsMapWebLayers.moe_mestopolozhenie_7ab4d787')}</strong>
            </div>
          </mods.Popup>
        </mods.Marker>
      ) : null}

      {searchMarker && Number.isFinite(searchMarker.lat) && Number.isFinite(searchMarker.lng) ? (
        <mods.Marker
          key="__search__"
          position={[searchMarker.lat, searchMarker.lng]}
          icon={getMarkerIconCached(colors.primarySoft, { active: true })}
          title={String(searchMarker.label || i18nT('map:components.UserPoints.UserPointsMapPointMarker.tochka_99c57a1a'))}
          alt={String(searchMarker.label || i18nT('map:components.UserPoints.UserPointsMapPointMarker.tochka_99c57a1a'))}
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
          title={i18nT('map:components.UserPoints.UserPointsMapPointMarker.tochka_99c57a1a')}
          alt={i18nT('map:components.UserPoints.UserPointsMapPointMarker.tochka_99c57a1a')}
        />
      ) : null}

      {mapInstance ? (
        <UserPointsClusterLayer
          L={mods?.L}
          map={mapInstance}
          points={points}
          activePointId={activePointId}
          isCompactPopup={isCompactPopup}
          colors={colors}
          getMarkerIconCached={getMarkerIconCached}
          onMarkerClick={handleMarkerClick}
          registerPointMarker={registerPointMarker}
          renderPopup={renderPopup}
        />
      ) : null}
    </>
  )
})
