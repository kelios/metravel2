/**
 * MarkerClusterGroup — imperative Leaflet markerClusterGroup wrapper for react-leaflet.
 *
 * Uses `leaflet.markercluster` under the hood. Adds/removes markers imperatively
 * via the map instance (react-leaflet v4+ does not ship a built-in cluster wrapper).
 */
import React, { useEffect, useRef, useMemo, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
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
  /**
   * #207 — mobile-web: surface the point as a bottom card instead of the anchored
   * Leaflet popup. When true, single markers are not bound to a popup (no flicker
   * over the bottom card) and no popup portal is rendered.
   */
  suppressLeafletPopupOnSelect?: boolean
  /** Callback on marker click */
  onMarkerClick?: (
    point: Point,
    coords: { lat: number; lng: number },
    marker?: any,
  ) => void
  /** Register marker ref by coord string */
  onMarkerInstance?: (coord: string, marker: any | null) => void
  /** Hint for coordinate parsing (lng/lat swap) */
  hintCenter?: { lat: number; lng: number } | null
}

type PopupEventHandlers = Record<string, (event: any) => void>

const splitPopupProps = (popupProps?: Record<string, unknown>) => {
  if (!popupProps) {
    return {
      popupOptions: {} as Record<string, unknown>,
      popupEventHandlers: {} as PopupEventHandlers,
    }
  }

  const {
    eventHandlers,
    ...popupOptions
  } = popupProps as Record<string, unknown> & {
    eventHandlers?: PopupEventHandlers
  }

  return {
    popupOptions,
    popupEventHandlers:
      eventHandlers && typeof eventHandlers === 'object'
        ? (eventHandlers as PopupEventHandlers)
        : ({} as PopupEventHandlers),
  }
}

const TOOLTIP_MAX_LEN = 30

// Leaflet's getBoundsZoom subtracts padding from the container size. If a padding
// component is >= the container dimension the usable size becomes <=0 and Leaflet
// falls back to min zoom (zooming the whole map OUT). Clamp each padding axis to a
// fraction of the container so a positive usable viewport always remains.
const MAX_PADDING_FRACTION = 0.4

const clampPaddingPair = (
  pair: [number, number] | undefined,
  width?: number,
  height?: number,
): [number, number] | undefined => {
  if (!Array.isArray(pair)) return pair
  const maxX = Number.isFinite(width) ? Math.max(0, Number(width) * MAX_PADDING_FRACTION) : pair[0]
  const maxY = Number.isFinite(height) ? Math.max(0, Number(height) * MAX_PADDING_FRACTION) : pair[1]
  return [Math.min(pair[0], maxX), Math.min(pair[1], maxY)]
}

const clampFitBoundsPadding = (
  options: Record<string, unknown>,
  width?: number,
  height?: number,
): void => {
  if (Array.isArray(options.paddingTopLeft)) {
    options.paddingTopLeft = clampPaddingPair(
      options.paddingTopLeft as [number, number],
      width,
      height,
    )
  }
  if (Array.isArray(options.paddingBottomRight)) {
    options.paddingBottomRight = clampPaddingPair(
      options.paddingBottomRight as [number, number],
      width,
      height,
    )
  }
}

/**
 * Handle a cluster click (zoom-to-bounds is disabled on the group, so we drive it).
 * Exported for unit testing because headless previews can't reliably exercise the
 * animated fitBounds path.
 *
 * Invariant: a cluster click must always zoom IN (or spiderfy) — it must never zoom
 * the map out, which would push all markers off-screen and look like "markers vanished".
 */
export const runClusterClick = (map: any, clusterLayer: any): void => {
  if (!map || !clusterLayer || typeof clusterLayer.getBounds !== 'function') return

  try {
    const bounds = clusterLayer.getBounds()
    const container = typeof map.getContainer === 'function' ? map.getContainer() : null
    const containerWidth =
      container?.clientWidth ??
      (typeof window !== 'undefined' ? window.innerWidth : undefined)
    const containerHeight =
      container?.clientHeight ??
      (typeof window !== 'undefined' ? window.innerHeight : undefined)
    const fitBoundsOptions = getClusterZoomFitBoundsOptions({
      width: containerWidth,
      height: containerHeight,
    })

    // Padding that meets/exceeds the container size makes Leaflet's getBoundsZoom
    // collapse the usable viewport to <=0, which it answers by zooming all the way
    // OUT (min zoom / whole world). On a small mobile viewport the bottom-sheet
    // padding alone can do this — the cluster's markers then sit off-screen and the
    // map looks empty. Clamp every padding component so usable size stays positive.
    clampFitBoundsPadding(fitBoundsOptions, containerWidth, containerHeight)

    const ne = bounds?.getNorthEast?.()
    const sw = bounds?.getSouthWest?.()
    const isDegenerate = !bounds?.isValid?.() || (ne && sw && ne.equals?.(sw))

    // Если все точки кластера в одной координате — fitBounds не разведёт их,
    // нужен явный spiderfy (плагин не зовёт его сам, т.к. zoomToBoundsOnClick=false).
    if (isDegenerate) {
      if (typeof clusterLayer.spiderfy === 'function') clusterLayer.spiderfy()
      return
    }

    const maxZoom =
      typeof fitBoundsOptions.maxZoom === 'number'
        ? fitBoundsOptions.maxZoom
        : (map.getMaxZoom?.() ?? CLUSTER_DISABLE_ZOOM)
    const rawTargetZoom =
      typeof map.getBoundsZoom === 'function' ? map.getBoundsZoom(bounds, false) : null
    const targetZoom =
      rawTargetZoom != null && Number.isFinite(rawTargetZoom) ? rawTargetZoom : null
    const currentZoom = map.getZoom?.() ?? 0

    // Если зумить уже некуда (упёрлись в maxZoom, а точки всё ещё в одном
    // кластере) — делаем spiderfy, иначе маркеры визуально не появятся.
    if (
      targetZoom != null &&
      targetZoom >= maxZoom &&
      currentZoom >= maxZoom &&
      typeof clusterLayer.spiderfy === 'function'
    ) {
      clusterLayer.spiderfy()
      return
    }

    // Кластер-клик ВСЕГДА должен приближать (или спайдерфаить). Если getBoundsZoom
    // вернул не-finite или зум <= текущего (вырожденная рамка + большой padding),
    // fitBounds увёл бы карту наружу и «спрятал» все маркеры. В этом случае —
    // принудительно центрируем кластер на текущий+1 зум, не отдаляя.
    if (targetZoom == null || targetZoom <= currentZoom) {
      const safeZoom = Math.min(maxZoom, currentZoom + 1)
      if (safeZoom > currentZoom && typeof map.setView === 'function') {
        const center = typeof bounds.getCenter === 'function' ? bounds.getCenter() : null
        if (center) {
          map.setView(center, safeZoom, { animate: true } as any)
          return
        }
      }
      if (typeof clusterLayer.spiderfy === 'function') clusterLayer.spiderfy()
      return
    }

    map.fitBounds(bounds, fitBoundsOptions as any)
  } catch {
    // noop
  }
}

interface OpenPopupEntry {
  point: Point
  container: HTMLElement
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
  suppressLeafletPopupOnSelect = false,
  onMarkerClick,
  onMarkerInstance,
  hintCenter,
}) => {
  const map = useMap()
  const clusterGroupRef = useRef<any>(null)
  const markerMapRef = useRef<Map<string, { coord: string; marker: any }>>(new Map())
  const [openPopups, setOpenPopups] = useState<Map<string, OpenPopupEntry>>(
    () => new Map(),
  )
  // Бамп при (пере)создании cluster-группы — чтобы sync-эффект перезаполнил новую
  // (пустую) группу. Иначе при пересоздании группы маркеры молча исчезают.
  const [groupVersion, setGroupVersion] = useState(0)

  // «Latest»-рефы на нестабильные пропсы. Родитель передаёт инлайн onMarkerInstance
  // (и потенциально onMarkerClick/popupProps); без рефов sync-эффект делал бы полный
  // destroy+rebuild маркеров и закрывал открытый попап на КАЖДЫЙ рендер родителя.
  const onMarkerClickRef = useRef(onMarkerClick)
  const onMarkerInstanceRef = useRef(onMarkerInstance)
  const popupPropsRef = useRef(popupProps)
  useEffect(() => {
    onMarkerClickRef.current = onMarkerClick
    onMarkerInstanceRef.current = onMarkerInstance
    popupPropsRef.current = popupProps
  })

  const closeOpenPopup = useCallback(() => {
    try {
      map?.closePopup?.()
    } catch {
      // noop
    }
  }, [map])

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
        accentDarkColor: String(DESIGN_TOKENS.colors.primaryDark),
        softGlowColor: String(DESIGN_TOKENS.colors.primaryAlpha30),
        textColor: String(DESIGN_TOKENS.colors.textOnDark),
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
      runClusterClick(map, event?.layer)
    }

    clusterGroupRef.current = group
    map.addLayer(group)
    group.on('clusterclick', handleClusterClick)
    // Сообщаем sync-эффекту, что появилась новая (пустая) группа — он перезаполнит её.
    setGroupVersion((v) => v + 1)

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
      currentMarkerMap.clear()
      setOpenPopups((prev) => (prev.size ? new Map() : prev))
    }
  }, [L, map, clusterIconFactory])

  // Sync markers with cluster group
  useEffect(() => {
    const group = clusterGroupRef.current
    if (!group || !L) return

    // Clear existing — снимаем хендлеры/попапы предыдущих маркеров до clearLayers.
    try {
      for (const { marker } of markerMapRef.current.values()) {
        try {
          marker.off()
          marker.unbindPopup?.()
        } catch {
          // noop
        }
      }
      group.clearLayers()
    } catch {
      // noop
    }
    markerMapRef.current.clear()
    setOpenPopups((prev) => (prev.size ? new Map() : prev))

    if (!validPoints.length) return

    const newMarkers: any[] = []

    for (const { point, coords, key } of validPoints) {
      const marker = L.marker([coords.lat, coords.lng], {
        icon: markerIcon,
        opacity: markerOpacity,
        alt: point.address || 'Точка на карте',
        title: point.address || '',
      })

      // #207 — mobile-web: do not bind a Leaflet popup. Leaflet auto-opens a bound
      // popup on marker click, which briefly flickers over the bottom card before
      // handleMarkerZoom closes it. Skipping the bind removes the flicker entirely.
      if (!suppressLeafletPopupOnSelect) {
        // Popup with point info
        const popupContainer = document.createElement('div')
        popupContainer.className = 'metravel-cluster-popup-root'
        popupContainer.setAttribute('data-point-id', String(point.id ?? ''))

        const { popupOptions: rawPopupOptions } =
          splitPopupProps(popupPropsRef.current)
        const popupOptions: any = {
          maxWidth: rawPopupOptions.maxWidth ?? 320,
          minWidth: rawPopupOptions.minWidth ?? 200,
          autoPan: rawPopupOptions.autoPan ?? true,
          closeButton: rawPopupOptions.closeButton ?? true,
        }
        if (rawPopupOptions.keepInView !== undefined) {
          popupOptions.keepInView = rawPopupOptions.keepInView
        }
        if (typeof rawPopupOptions.className === 'string' && rawPopupOptions.className.trim()) {
          popupOptions.className = rawPopupOptions.className.trim()
        }
        if (rawPopupOptions.autoPanPadding) {
          popupOptions.autoPanPadding = rawPopupOptions.autoPanPadding
        }
        if (rawPopupOptions.autoPanPaddingTopLeft) {
          popupOptions.autoPanPaddingTopLeft = rawPopupOptions.autoPanPaddingTopLeft
        }
        if (rawPopupOptions.autoPanPaddingBottomRight) {
          popupOptions.autoPanPaddingBottomRight =
            rawPopupOptions.autoPanPaddingBottomRight
        }

        marker.bindPopup(popupContainer, popupOptions)

        marker.on('popupopen', (event: any) => {
          splitPopupProps(popupPropsRef.current).popupEventHandlers.popupopen?.(event)
          setOpenPopups((prev) => {
            if (prev.get(key)?.container === popupContainer) return prev
            const next = new Map(prev)
            next.set(key, { point, container: popupContainer })
            return next
          })
        })

        marker.on('popupclose', (event: any) => {
          splitPopupProps(popupPropsRef.current).popupEventHandlers.popupclose?.(event)
          setOpenPopups((prev) => {
            if (!prev.has(key)) return prev
            const next = new Map(prev)
            next.delete(key)
            return next
          })
        })
      }

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
        const handleClick = onMarkerClickRef.current
        if (typeof handleClick === 'function') {
          handleClick(point, coords, e?.target)
          return
        }
        if (e?.target?.openPopup) {
          try {
            e.target.openPopup()
          } catch {
            // noop
          }
        }
      })

      // Register marker instance — ключуем по уникальному key (а не coordStr),
      // иначе дубли координат перетирают друг друга и onMarkerInstance(coord,null)
      // на cleanup зовётся не для всех маркеров.
      const coordStr = String(point.coord ?? '')
      markerMapRef.current.set(key, { coord: coordStr, marker })
      onMarkerInstanceRef.current?.(coordStr, marker)

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
      // Notify about removed markers (per unique key → корректный coord для каждого).
      for (const { coord } of currentMarkerMap.values()) {
        onMarkerInstanceRef.current?.(coord, null)
      }
    }
  }, [
    L,
    map,
    validPoints,
    markerIcon,
    markerOpacity,
    suppressLeafletPopupOnSelect,
    groupVersion,
  ])

  return (
    <>
      {Array.from(openPopups.entries()).map(([key, { point, container }]) =>
        createPortal(
          <PopupContent point={point} closePopup={closeOpenPopup} />,
          container,
          key,
        ),
      )}
    </>
  )
}

export default React.memo(MarkerClusterGroup)
