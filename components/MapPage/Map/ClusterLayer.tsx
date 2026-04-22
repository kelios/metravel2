// components/MapPage/map/ClusterLayer.tsx
import React, { useMemo, useCallback } from 'react'
import { View, Text } from 'react-native'
import { useThemedColors } from '@/hooks/useTheme'
import { strToLatLng } from './utils'
import type { Point, ClusterData } from './types'
import { DESIGN_TOKENS } from '@/constants/designSystem'

import { buildClusterIconHtml } from './mapMarkerStyles'

interface ClusterLayerProps {
  L?: any
  clusters: ClusterData[]
  Marker: React.ComponentType<any>
  Popup: React.ComponentType<any>
  Tooltip?: React.ComponentType<any>
  PopupContent: React.ComponentType<{ point: Point; closePopup?: () => void }>
  popupProps?: Record<string, unknown>
  onMarkerClick?: (point: Point, coords: { lat: number; lng: number }) => void
  onMarkerInstance?: (coord: string, marker: any | null) => void
  onClusterZoom: (payload: {
    center: [number, number]
    bounds: [[number, number], [number, number]]
    key: string
    items: Point[]
  }) => void
  expandedClusterKey?: string | null
  expandedClusterItems?: Point[] | null
  markerIcon?: any
  markerOpacity?: number
  renderer?: any
  hintCenter?: { lat: number; lng: number } | null
  useMap?: () => any
}

const TOOLTIP_MAX_LEN = 30

const ClusterPopupContentWithClose: React.FC<{
  point: Point
  PopupContent: React.ComponentType<{ point: Point; closePopup?: () => void }>
  useMap?: () => any
}> = ({ point, PopupContent, useMap: useMapHook }) => {
  const map = useMapHook?.()
  const closePopup = useCallback(() => {
    map?.closePopup()
  }, [map])
  return <PopupContent point={point} closePopup={closePopup} />
}

const ClusterLayer: React.FC<ClusterLayerProps> = ({
  L,
  clusters,
  Marker,
  Popup,
  Tooltip,
  PopupContent,
  popupProps,
  onMarkerClick,
  onMarkerInstance,
  onClusterZoom,
  expandedClusterKey,
  expandedClusterItems,
  markerIcon,
  markerOpacity = 1,
  renderer,
  hintCenter,
  useMap: useMapHook,
}) => {
  const colors = useThemedColors()

  const safeClusters = useMemo(() => {
    return Array.isArray(clusters) ? clusters : []
  }, [clusters])

  const clusterIconsCache = useMemo(() => {
    const leaflet = L ?? (window as any)?.L
    if (!leaflet?.divIcon) return new Map()

    const cache = new Map()
    ;[2, 5, 10, 20, 50, 100, 200].forEach((count) => {
      const { metrics, html } = buildClusterIconHtml({
        count,
        accentColor: String(DESIGN_TOKENS.colors.primary),
        textColor: String(DESIGN_TOKENS.colors.textOnPrimary),
      })
      cache.set(
        count,
        leaflet.divIcon({
          className: 'metravel-cluster-icon',
          html,
          iconSize: [metrics.size, metrics.size],
          iconAnchor: [metrics.size / 2, metrics.size / 2],
        }),
      )
    })

    return cache
  }, [L])

  const clusterIcon = useCallback(
    (count: number, thumbUrl?: string) => {
      const leaflet = L ?? (window as any)?.L
      if (!leaflet?.divIcon) return undefined

      if (!Number.isFinite(count) || count < 0 || count > 10000) {
        console.warn('[Map] Invalid cluster count:', count)
        return undefined
      }

      if (!thumbUrl && clusterIconsCache.has(count)) {
        return clusterIconsCache.get(count)
      }
      const { metrics, html } = buildClusterIconHtml({
        count,
        thumbUrl,
        accentColor: String(DESIGN_TOKENS.colors.primary),
        textColor: String(DESIGN_TOKENS.colors.textOnPrimary),
      })

      return leaflet.divIcon({
        className: 'metravel-cluster-icon',
        html,
        iconSize: [metrics.size, metrics.size],
        iconAnchor: [metrics.size / 2, metrics.size / 2],
      })
    },
    [L, clusterIconsCache],
  )

  const handleMarkerClick = useCallback(
    (e: any, point: Point, coords: { lat: number; lng: number }) => {
      // Stop propagation to prevent map click handler (route mode).
      // IMPORTANT: Do NOT call preventDefault on originalEvent — it breaks touch-to-click on mobile.
      try {
        e?.originalEvent?.stopPropagation?.()
      } catch {
        // noop
      }

      if (e?.target?.openPopup) {
        try {
          e.target.openPopup()
        } catch {
          // noop
        }
      }
      onMarkerClick?.(point, coords)
    },
    [onMarkerClick],
  )

  return (
    <>
      {safeClusters.map((cluster, idx) => {
        if (
          !Number.isFinite(cluster.center[0]) ||
          !Number.isFinite(cluster.center[1])
        )
          return null

        // Expanded cluster: render individual markers
        if (expandedClusterKey && cluster.key === expandedClusterKey) {
          const items = expandedClusterItems ?? cluster.items
          return (
            <React.Fragment key={`expanded-${cluster.key}-${idx}`}>
              {items.map((item, itemIdx) => {
                const ll = strToLatLng(item.coord, hintCenter)
                if (!ll) return null
                if (!Number.isFinite(ll[0]) || !Number.isFinite(ll[1]))
                  return null
                const markerKey = item.id
                  ? `cluster-expanded-${cluster.key}-${item.id}`
                  : `cluster-expanded-${cluster.key}-${item.coord.replace(/,/g, '-')}-${itemIdx}`

                const accessibleName =
                  item.address || item.categoryName || 'Точка на карте'
                const markerProps: any = {
                  position: [ll[1], ll[0]],
                  icon: markerIcon,
                  opacity: markerOpacity,
                  alt: accessibleName,
                  title: accessibleName,
                  ref: (marker: any) => {
                    try {
                      onMarkerInstance?.(
                        String(item.coord ?? ''),
                        marker ?? null,
                      )
                      // Add aria-label for a11y (Lighthouse aria-command-name audit)
                      const el = marker?._icon || marker?.getElement?.()
                      if (el && !el.getAttribute('aria-label')) {
                        el.setAttribute('aria-label', accessibleName)
                      }
                    } catch {
                      // noop
                    }
                  },
                  eventHandlers: {
                    click: (e: any) =>
                      handleMarkerClick(e, item, { lat: ll[1], lng: ll[0] }),
                  },
                }
                if (renderer) markerProps.renderer = renderer

                return (
                  <Marker key={markerKey} {...markerProps}>
                    {Tooltip && item.address && (
                      <Tooltip
                        direction="top"
                        offset={[0, -10]}
                        opacity={0.95}
                        className="metravel-marker-tooltip"
                      >
                        {item.address.length > TOOLTIP_MAX_LEN
                          ? item.address.slice(0, TOOLTIP_MAX_LEN) + '…'
                          : item.address}
                      </Tooltip>
                    )}
                    <Popup>
                      <ClusterPopupContentWithClose
                        point={item}
                        PopupContent={PopupContent}
                        useMap={useMapHook}
                      />
                    </Popup>
                  </Marker>
                )
              })}
            </React.Fragment>
          )
        }

        const thumbItem = cluster.items.find((p) => p.travelImageThumbUrl)
        const icon = clusterIcon(cluster.count, thumbItem?.travelImageThumbUrl)
        if (cluster.count === 1 && cluster.items[0]) {
          const item = cluster.items[0]
          const ll = strToLatLng(item.coord, hintCenter)
          if (!ll) return null
          if (!Number.isFinite(ll[0]) || !Number.isFinite(ll[1])) return null

          const accessibleName =
            item.address || item.categoryName || 'Точка на карте'
          const singleMarkerProps: any = {
            position: [ll[1], ll[0]],
            icon: markerIcon,
            opacity: markerOpacity,
            alt: accessibleName,
            title: accessibleName,
            ref: (marker: any) => {
              try {
                onMarkerInstance?.(String(item.coord ?? ''), marker ?? null)
                // Add aria-label for a11y (Lighthouse aria-command-name audit)
                const el = marker?._icon || marker?.getElement?.()
                if (el && !el.getAttribute('aria-label')) {
                  el.setAttribute('aria-label', accessibleName)
                }
              } catch {
                // noop
              }
            },
            eventHandlers: {
              click: (e: any) =>
                handleMarkerClick(e, item, { lat: ll[1], lng: ll[0] }),
            },
          }
          if (renderer) singleMarkerProps.renderer = renderer

          return (
            <Marker key={`cluster-single-${idx}`} {...singleMarkerProps}>
              {Tooltip && item.address && (
                <Tooltip
                  direction="top"
                  offset={[0, -10]}
                  opacity={0.95}
                  className="metravel-marker-tooltip"
                >
                  {item.address.length > TOOLTIP_MAX_LEN
                    ? item.address.slice(0, TOOLTIP_MAX_LEN) + '…'
                    : item.address}
                </Tooltip>
              )}
              <Popup {...(popupProps || {})}>
                <ClusterPopupContentWithClose
                  point={item}
                  PopupContent={PopupContent}
                  useMap={useMapHook}
                />
              </Popup>
            </Marker>
          )
        }

        const clusterAccessibleName = `Кластер: ${cluster.count} мест`
        return (
          <Marker
            key={`cluster-${idx}`}
            position={[cluster.center[0], cluster.center[1]]}
            icon={icon as any}
            alt={clusterAccessibleName}
            title={clusterAccessibleName}
            ref={(marker: any) => {
              try {
                // Add aria-label for a11y (Lighthouse aria-command-name audit)
                const el = marker?._icon || marker?.getElement?.()
                if (el && !el.getAttribute('aria-label')) {
                  el.setAttribute('aria-label', clusterAccessibleName)
                }
              } catch {
                // noop
              }
            }}
            eventHandlers={{
              click: (e: any) => {
                try {
                  e?.originalEvent?.stopPropagation?.()
                } catch {
                  // noop
                }
                if (
                  !Number.isFinite(cluster.bounds?.[0]?.[0]) ||
                  !Number.isFinite(cluster.bounds?.[0]?.[1]) ||
                  !Number.isFinite(cluster.bounds?.[1]?.[0]) ||
                  !Number.isFinite(cluster.bounds?.[1]?.[1])
                ) {
                  return
                }
                onClusterZoom({
                  center: [cluster.center[0], cluster.center[1]],
                  bounds: [
                    [cluster.bounds[0][0], cluster.bounds[0][1]],
                    [cluster.bounds[1][0], cluster.bounds[1][1]],
                  ],
                  key: cluster.key,
                  items: cluster.items,
                })
              },
            }}
          >
            <Popup>
              <View style={{ gap: 6, maxWidth: 260 }}>
                <Text style={{ fontWeight: '800' }}>
                  {cluster.count} мест поблизости
                </Text>
                <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                  Нажмите, чтобы приблизить и раскрыть маркеры
                </Text>
                {cluster.items.slice(0, 6).map((p, i) => (
                  <Text
                    key={`${cluster.key}-item-${i}`}
                    numberOfLines={1}
                    style={{ fontSize: 12 }}
                  >
                    {p.categoryName ? `${p.categoryName}: ` : ''}
                    {p.address || 'Без названия'}
                  </Text>
                ))}
                {cluster.items.length > 6 && (
                  <Text style={{ fontSize: 12, color: colors.textMuted }}>
                    …и ещё {cluster.items.length - 6}
                  </Text>
                )}
              </View>
            </Popup>
          </Marker>
        )
      })}
    </>
  )
}

export default ClusterLayer
