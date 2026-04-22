/**
 * MarkerClusterGroup — imperative Leaflet markerClusterGroup wrapper for react-leaflet.
 *
 * Uses `leaflet.markercluster` under the hood. Adds/removes markers imperatively
 * via the map instance (react-leaflet v4+ does not ship a built-in cluster wrapper).
 */
import React, { useEffect, useRef, useMemo } from 'react'
import type { Point } from './types'
import { strToLatLng } from './utils'
import { CoordinateConverter } from '@/utils/coordinateConverter'
import {
  CLUSTER_DISABLE_ZOOM,
  getClusterZoomFitBoundsOptions,
} from './clusterFitBounds'
import { DESIGN_TOKENS } from '@/constants/designSystem'

import { buildClusterIconHtml } from './mapMarkerStyles'

interface PopupContentProps {
  point: Point
  closePopup?: () => void
}

interface MarkerClusterGroupProps {
  /** Leaflet namespace (dynamic import) */
  L: any
  /** react-leaflet useMap hook */
  useMap: () => any
  /** Points to render as clustered markers */
  points: Point[]
  /** Leaflet divIcon for individual markers */
  markerIcon: any
  /** Opacity for markers (reduced in route mode) */
  markerOpacity?: number
  /** Popup React component */
  PopupContent: React.ComponentType<PopupContentProps>
  /** react-leaflet Popup component */
  Popup: React.ComponentType<any>
  /** react-leaflet Tooltip component */
  Tooltip?: React.ComponentType<any>
  /** Popup auto-pan settings */
  popupProps?: Record<string, unknown>
  /** Callback on marker click */
  onMarkerClick?: (point: Point, coords: { lat: number; lng: number }) => void
  /** Register marker ref by coord string */
  onMarkerInstance?: (coord: string, marker: any | null) => void
  /** Hint for coordinate parsing (lng/lat swap) */
  hintCenter?: { lat: number; lng: number } | null
}

const TOOLTIP_MAX_LEN = 30

const scheduleRootUnmount = (
  root: { unmount: () => void } | null | undefined,
) => {
  if (!root) return
  if (typeof queueMicrotask === 'function') {
    queueMicrotask(() => {
      try {
        root.unmount()
      } catch {
        // noop
      }
    })
    return
  }

  setTimeout(() => {
    try {
      root.unmount()
    } catch {
      // noop
    }
  }, 0)
}

const MarkerClusterGroup: React.FC<MarkerClusterGroupProps> = ({
  L,
  useMap,
  points,
  markerIcon,
  markerOpacity = 1,
  PopupContent,
  Popup: _Popup,
  Tooltip: _Tooltip,
  popupProps,
  onMarkerClick,
  onMarkerInstance,
  hintCenter,
}) => {
  const map = useMap()
  const clusterGroupRef = useRef<any>(null)
  const markerMapRef = useRef<Map<string, any>>(new Map())
  const renderRootMapRef = useRef<Map<string, any>>(new Map())

  // Parsed + validated points
  const validPoints = useMemo(() => {
    return points
      .map((point, index) => {
        const ll = strToLatLng(String(point.coord), hintCenter)
        if (!ll) return null
        const coords = { lat: ll[1], lng: ll[0] }
        if (!CoordinateConverter.isValid(coords)) return null
        return {
          point,
          coords,
          key: point.id
            ? `travel-${point.id}`
            : `travel-${String(point.coord).replace(/,/g, '-')}-${index}`,
        }
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
  }, [points, hintCenter])

  const clusterIconFactory = useMemo(() => {
    if (!L?.divIcon || typeof document === 'undefined') return null

    return (cluster: any) => {
      const { metrics, html } = buildClusterIconHtml({
        count: Number(cluster?.getChildCount?.() ?? 0),
        accentColor: String(DESIGN_TOKENS.colors.primary),
        textColor: String(DESIGN_TOKENS.colors.primaryDark),
      })

      return L.divIcon({
        className: 'metravel-cluster-icon',
        html,
        iconSize: [metrics.size, metrics.size],
        iconAnchor: [metrics.size / 2, metrics.size / 2],
      })
    }
  }, [L])

  // Create cluster group once
  useEffect(() => {
    if (!L || !map) return
    // Ensure leaflet.markercluster has augmented L
    if (typeof L.markerClusterGroup !== 'function') {
      // Try to import it side-effect style
      try {
        require('leaflet.markercluster')
      } catch {
        // noop
      }
    }
    if (typeof L.markerClusterGroup !== 'function') return

    const group = L.markerClusterGroup({
      chunkedLoading: true,
      maxClusterRadius: 60,
      iconCreateFunction: clusterIconFactory ?? undefined,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      // Handle cluster click explicitly so viewport math stays stable on web.
      zoomToBoundsOnClick: false,
      disableClusteringAtZoom: CLUSTER_DISABLE_ZOOM,
      animate: true,
      animateAddingMarkers: false,
      // Spiderfy config for touch devices
      spiderfyDistanceMultiplier: 1.5,
    })

    const handleClusterClick = (event: any) => {
      try {
        event?.originalEvent?.preventDefault?.()
        event?.originalEvent?.stopPropagation?.()
      } catch {
        // noop
      }

      const clusterLayer = event?.layer
      if (!clusterLayer || typeof clusterLayer.getBounds !== 'function') return

      try {
        const bounds = clusterLayer.getBounds()
        if (!bounds?.isValid?.()) return

        const container =
          typeof map.getContainer === 'function' ? map.getContainer() : null
        const fitBoundsOptions = getClusterZoomFitBoundsOptions({
          width:
            container?.clientWidth ??
            (typeof window !== 'undefined' ? window.innerWidth : undefined),
          height:
            container?.clientHeight ??
            (typeof window !== 'undefined' ? window.innerHeight : undefined),
        })

        map.fitBounds(bounds, fitBoundsOptions as any)
      } catch {
        // noop
      }
    }

    clusterGroupRef.current = group
    map.addLayer(group)
    group.on('clusterclick', handleClusterClick)

    const currentRenderRootMap = renderRootMapRef.current
    const currentMarkerMap = markerMapRef.current

    return () => {
      try {
        group.off('clusterclick', handleClusterClick)
        map.removeLayer(group)
        group.clearLayers()
      } catch {
        // noop
      }
      clusterGroupRef.current = null
      // Cleanup render roots
      for (const [, root] of currentRenderRootMap) {
        scheduleRootUnmount(root)
      }
      currentRenderRootMap.clear()
      currentMarkerMap.clear()
    }
  }, [L, map, clusterIconFactory])

  // Sync markers with cluster group
  useEffect(() => {
    const group = clusterGroupRef.current
    if (!group || !L) return

    // Clear existing
    try {
      group.clearLayers()
    } catch {
      // noop
    }
    markerMapRef.current.clear()

    // Cleanup old render roots
    for (const [, root] of renderRootMapRef.current) {
      scheduleRootUnmount(root)
    }
    renderRootMapRef.current.clear()

    if (!validPoints.length) return

    const newMarkers: any[] = []

    for (const { point, coords, key } of validPoints) {
      const marker = L.marker([coords.lat, coords.lng], {
        icon: markerIcon,
        opacity: markerOpacity,
        alt: point.address || 'Точка на карте',
        title: point.address || '',
      })

      // Popup with point info
      const popupContainer = document.createElement('div')
      popupContainer.className = 'metravel-cluster-popup-root'
      popupContainer.setAttribute('data-point-id', String(point.id ?? ''))

      // Use React 19 createRoot for popup rendering
      let rootCreated = false
      const popupOptions: any = {
        maxWidth: popupProps?.maxWidth ?? 320,
        minWidth: popupProps?.minWidth ?? 200,
        autoPan: true,
        closeButton: true,
      }
      if (popupProps?.autoPanPadding) {
        popupOptions.autoPanPadding = popupProps.autoPanPadding
      }
      if (popupProps?.autoPanPaddingTopLeft) {
        popupOptions.autoPanPaddingTopLeft = popupProps.autoPanPaddingTopLeft
      }
      if (popupProps?.autoPanPaddingBottomRight) {
        popupOptions.autoPanPaddingBottomRight =
          popupProps.autoPanPaddingBottomRight
      }

      marker.bindPopup(popupContainer, popupOptions)

      marker.on('popupopen', () => {
        if (!rootCreated) {
          rootCreated = true
          try {
            const { createRoot } = require('react-dom/client')
            const root = createRoot(popupContainer)
            renderRootMapRef.current.set(key, root)
            const React = require('react')
            root.render(
              React.createElement(PopupContent, {
                point,
                closePopup: () => {
                  try {
                    map?.closePopup?.()
                  } catch {
                    // noop
                  }
                },
              }),
            )
          } catch {
            // Fallback: simple HTML
            popupContainer.innerHTML = `<div style="padding:8px"><strong>${point.address || 'Место'}</strong></div>`
          }
        }
      })

      marker.on('popupclose', () => {
        if (rootCreated) {
          rootCreated = false
          const root = renderRootMapRef.current.get(key)
          if (root) {
            renderRootMapRef.current.delete(key)
            scheduleRootUnmount(root)
          }
        }
      })

      // Tooltip
      if (point.address) {
        const tooltipText =
          point.address.length > TOOLTIP_MAX_LEN
            ? point.address.slice(0, TOOLTIP_MAX_LEN) + '…'
            : point.address
        marker.bindTooltip(tooltipText, {
          direction: 'top',
          offset: [0, -10],
          opacity: 0.95,
          className: 'metravel-marker-tooltip',
        })
      }

      // Click handler
      marker.on('click', (e: any) => {
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
      })

      // Register marker instance
      const coordStr = String(point.coord ?? '')
      markerMapRef.current.set(coordStr, marker)
      onMarkerInstance?.(coordStr, marker)

      newMarkers.push(marker)
    }

    // Bulk add for performance
    try {
      group.addLayers(newMarkers)
    } catch {
      // Fallback: add one by one
      for (const m of newMarkers) {
        try {
          group.addLayer(m)
        } catch {
          // noop
        }
      }
    }

    const currentMarkerMap = markerMapRef.current

    return () => {
      // Notify about removed markers
      for (const [coord] of currentMarkerMap) {
        onMarkerInstance?.(coord, null)
      }
    }
  }, [
    L,
    map,
    validPoints,
    markerIcon,
    markerOpacity,
    PopupContent,
    popupProps,
    onMarkerClick,
    onMarkerInstance,
  ])

  return null
}

export default React.memo(MarkerClusterGroup)
