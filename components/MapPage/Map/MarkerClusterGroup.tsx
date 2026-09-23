/**
 * MarkerClusterGroup — imperative Leaflet markerClusterGroup wrapper for react-leaflet.
 *
 * Uses `leaflet.markercluster` under the hood. Adds/removes markers imperatively
 * via the map instance (react-leaflet v4+ does not ship a built-in cluster wrapper).
 */
import React, { useEffect, useRef, useMemo, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import type { Point } from './types'
import { getMapPointContentKey, strToLatLng } from './utils'
import { groupMapPlaces, materializeMapPlaceRecord } from '@/api/mapPlaces'
import { CoordinateConverter } from '@/utils/coordinateConverter'
import { createMapClusterGroup, runClusterClick } from './mapClusterGroup'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useTheme } from '@/hooks/useTheme'
import { translate as i18nT } from '@/i18n'

import { buildClusterIconHtml } from './mapMarkerStyles'
import { useApplyClusterAccessibleName } from './clusterAccessibleName'

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
  /** Notify parent that a cluster was tapped (tap-guard for background dismiss) */
  onClusterTap?: () => void
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

// Клик по кластеру и настройки группы — общий механизм кластеров web-карт (#2059).
export { runClusterClick }

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
  onClusterTap,
  hintCenter,
}) => {
  const map = useMap()
  const { isDark } = useTheme()
  const clusterGroupRef = useRef<any>(null)
  const markerMapRef = useRef<Map<string, { coord: string; marker: any; contentKey: string }>>(
    new Map(),
  )
  const [openPopups, setOpenPopups] = useState<Map<string, OpenPopupEntry>>(
    () => new Map(),
  )
  // Бамп при (пере)создании cluster-группы — чтобы sync-эффект перезаполнил новую
  // (пустую) группу. Иначе при пересоздании группы маркеры молча исчезают.
  const [groupVersion, setGroupVersion] = useState(0)
  const [clusterPluginNonce, setClusterPluginNonce] = useState(0)

  // «Latest»-рефы на нестабильные пропсы. Родитель передаёт инлайн onMarkerInstance
  // (и потенциально onMarkerClick/popupProps); без рефов sync-эффект делал бы полный
  // destroy+rebuild маркеров и закрывал открытый попап на КАЖДЫЙ рендер родителя.
  const onMarkerClickRef = useRef(onMarkerClick)
  const onMarkerInstanceRef = useRef(onMarkerInstance)
  const onClusterTapRef = useRef(onClusterTap)
  const popupPropsRef = useRef(popupProps)
  useEffect(() => {
    onMarkerClickRef.current = onMarkerClick
    onMarkerInstanceRef.current = onMarkerInstance
    onClusterTapRef.current = onClusterTap
    popupPropsRef.current = popupProps
  })

  const closeOpenPopup = useCallback(() => {
    try {
      map?.closePopup?.()
    } catch {
      // noop
    }
  }, [map])

  // Parsed + validated places — ОДИН маркер и один hit target на физическое место
  // (#1573): несколько статей об одном объекте приходят отдельными записями и
  // раньше давали стопку перекрывающихся маркеров. Группировка идёт через общую
  // модель `groupMapPlaces` (#1571) строго по backend `place_id`; запись без него
  // сохраняет прежний record-ключ и остаётся самостоятельным маркером.
  //
  // The key must be stable across data refreshes, because the sync effect below
  // diffs by it. The old key fell back to the ARRAY INDEX for points without an
  // id, so a reordered response looked like "every marker replaced". Collisions
  // (two points at the same coord within one payload) get a deterministic suffix
  // by first-seen order instead — `groupMapPlaces` keeps that same rule.
  //
  // The key includes the coordinate, and `contentKey` carries everything the marker
  // renders — a surviving marker is never re-created, so a point that moved or whose
  // address/thumb changed has to be detected here or it would keep showing stale data
  // at a stale position.
  const validPoints = useMemo(() => {
    // Координаты разбираются ДО группировки: невалидная запись не должна ни
    // занимать место в `#n`-нумерации legacy-ключей, ни становиться носителем
    // канонических полей места.
    const coordsByPoint = new Map<Point, { lat: number; lng: number }>()
    const renderablePoints: Point[] = []
    for (const point of points) {
      const ll = strToLatLng(String(point.coord), hintCenter)
      if (!ll) continue
      const coords = { lat: ll[1], lng: ll[0] }
      if (!CoordinateConverter.isValid(coords)) continue
      if (!coordsByPoint.has(point)) renderablePoints.push(point)
      coordsByPoint.set(point, coords)
    }

    const places: Array<{
      point: Point
      coords: { lat: number; lng: number }
      key: string
      contentKey: string
    }> = []
    for (const place of groupMapPlaces(renderablePoints)) {
      // Lookup обязан использовать исходный object identity. Только после него
      // добавляем вычисленные place summary в record, который увидит popup.
      const coords = coordsByPoint.get(place.record)
      if (!coords) continue
      const point = materializeMapPlaceRecord(place)
      places.push({
        point,
        coords,
        key: place.placeKey,
        // Coordinates are resolved with `hintCenter`, which can flip an ambiguous
        // "lat,lng" pair — fold the resolved position in so that flip re-creates
        // the marker instead of leaving it at the old spot.
        contentKey: `${getMapPointContentKey(point)}|${coords.lat},${coords.lng}`,
      })
    }
    return places
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
        isDark,
      })

      return L.divIcon({
        className: 'metravel-cluster-icon',
        html,
        iconSize: [metrics.size, metrics.size],
        iconAnchor: [metrics.size / 2, metrics.size / 2],
      })
    }
  }, [L, isDark])

  // «Latest»-ref на текущую icon-factory. Держим её вне зависимостей create-эффекта,
  // чтобы смена темы (isDark) не уничтожала и не пересоздавала весь markerClusterGroup
  // (и не переприлагала все маркеры) — вместо этого тема обновляет только иконки
  // кластеров через group.refreshClusters() в отдельном эффекте ниже.
  const clusterIconFactoryRef = useRef(clusterIconFactory)
  useEffect(() => {
    clusterIconFactoryRef.current = clusterIconFactory
  }, [clusterIconFactory])

  // Create cluster group once
  useEffect(() => {
    if (!L || !map) return
    // Ensure leaflet.markercluster has augmented L
    if (typeof L.markerClusterGroup !== 'function') {
      // #765: sync require('leaflet.markercluster') хойстил leaflet-вендор в eager
      // __common. Штатный путь — markercluster уже применён в loadLeafletRuntime;
      // это async-фолбэк для нештатного L.
      let cancelled = false
      Promise.resolve(import('@/utils/leafletVendor'))
        .then(() => {
          if (!cancelled && typeof L.markerClusterGroup === 'function') {
            setClusterPluginNonce((v) => v + 1)
          }
        })
        .catch(() => {})
      return () => {
        cancelled = true
      }
    }

    // Stable wrapper → the factory identity changing on theme switch never forces
    // a group rebuild; refreshClusters() below re-runs this against the fresh ref.
    const iconCreateFunction = clusterIconFactoryRef.current
      ? (cluster: any) => {
          const factory = clusterIconFactoryRef.current
          return factory ? factory(cluster) : undefined
        }
      : undefined

    const { group, dispose } = createMapClusterGroup(L, map, {
      iconCreateFunction,
      onClusterTap: () => onClusterTapRef.current?.(),
    })

    clusterGroupRef.current = group
    map.addLayer(group)
    // Сообщаем sync-эффекту, что появилась новая (пустая) группа — он перезаполнит её.
    setGroupVersion((v) => v + 1)

    const currentMarkerMap = markerMapRef.current

    return () => {
      try {
        dispose()
        map.removeLayer(group)
        group.clearLayers()
      } catch {
        // noop
      }
      clusterGroupRef.current = null
      currentMarkerMap.clear()
      setOpenPopups((prev) => (prev.size ? new Map() : prev))
    }
    // Theme (isDark) intentionally NOT a dep: icons recolor via the refreshClusters
    // effect below, not by tearing down/rebuilding the group + re-adding markers.
  }, [L, map, clusterPluginNonce])

  // Theme switch: recolor existing cluster icons in place. The create-effect uses a
  // stable iconCreateFunction wrapper reading clusterIconFactoryRef, so once the ref
  // points at the new-theme factory, refreshClusters() re-runs it for all clusters —
  // no group teardown, no marker re-add (which would flash markers / close popups).
  useEffect(() => {
    const group = clusterGroupRef.current
    if (!group || typeof group.refreshClusters !== 'function') return
    try {
      group.refreshClusters()
    } catch {
      // noop
    }
  }, [isDark, groupVersion])

  // Accessible name for leaflet.markercluster's own cluster bubbles — logic
  // and rationale live in `clusterAccessibleName.ts` (#1624; split out to keep
  // this file under the push-gate's 800-LOC threshold).
  const applyClusterAccessibleName = useApplyClusterAccessibleName(L)

  // `map.fire('layeradd', ...)` runs synchronously right after
  // `onAdd()`/`_initIcon()` for every layer the group adds
  // (`leaflet/src/layer/Layer.js` `_layerAdd`), so `_icon` is guaranteed to
  // exist here. This alone still misses the very first cluster batch: the
  // initial `group.addLayers(...)` call below (in the marker-sync effect)
  // builds the WHOLE clustering tree — including every zoom level, not only
  // the one currently shown — and calls `_recursivelyAddChildrenToMap`
  // synchronously inside that same call, so it can add the starting view's
  // clusters to the map before this effect (declared after "create group",
  // before "sync markers") finishes attaching on a slower first commit.
  // Zoom/pan-driven re-clustering afterwards is unaffected and always goes
  // through `layeradd`. The sync effect's own sweep below is what actually
  // covers the initial batch; this listener's job is every batch after it.
  useEffect(() => {
    if (!L || !map || typeof map.on !== 'function' || typeof map.off !== 'function') {
      return
    }
    const handleLayerAdd = (event: any) => applyClusterAccessibleName(event?.layer)
    map.on('layeradd', handleLayerAdd)
    return () => {
      map.off('layeradd', handleLayerAdd)
    }
  }, [L, map, applyClusterAccessibleName])

  // Sync markers with cluster group.
  //
  // #1347 — this used to unbind every handler/popup, `clearLayers()` and rebuild
  // ALL markers whenever `validPoints` changed identity. Because the server-cluster
  // query re-keys on every viewport change, that meant a complete Leaflet teardown
  // + rebuild on EVERY pan and zoom (measured: 20 DOM ops for 10 markers, 111 ms
  // long task on a throttled phone). Now we diff by key: only markers that actually
  // appeared or disappeared are touched, and markers that survive keep their popup,
  // tooltip and open state.
  useEffect(() => {
    const group = clusterGroupRef.current
    if (!group || !L) return

    const existing = markerMapRef.current
    // A key that survived but whose rendered content changed counts as gone: the
    // marker is re-created below with fresh position, tooltip and handlers.
    const nextByKey = new Map(validPoints.map((item) => [item.key, item]))

    // 1. Remove markers that are gone (or stale).
    const removedMarkers: any[] = []
    const removedKeys: string[] = []
    const removedCoords: string[] = []
    for (const [key, entry] of existing) {
      const next = nextByKey.get(key)
      if (next && next.contentKey === entry.contentKey) continue
      removedKeys.push(key)
      removedCoords.push(entry.coord)
      removedMarkers.push(entry.marker)
      try {
        entry.marker.off()
        entry.marker.unbindPopup?.()
      } catch {
        // noop
      }
    }
    if (removedMarkers.length) {
      try {
        group.removeLayers(removedMarkers)
      } catch {
        for (const m of removedMarkers) {
          try {
            group.removeLayer(m)
          } catch {
            // noop
          }
        }
      }
      for (const key of removedKeys) existing.delete(key)
      setOpenPopups((prev) => {
        if (!removedKeys.some((key) => prev.has(key))) return prev
        const next = new Map(prev)
        for (const key of removedKeys) next.delete(key)
        return next
      })
    }

    // 2. Create markers that are new.
    const newMarkers: any[] = []

    for (const { point, coords, key, contentKey } of validPoints) {
      if (existing.has(key)) continue
      const marker = L.marker([coords.lat, coords.lng], {
        icon: markerIcon,
        opacity: markerOpacity,
        alt: point.address || i18nT('map:components.MapPage.Map.MarkerClusterGroup.tochka_na_karte_13493b1e'),
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
          // The popup content (PlacePopupCard) draws its OWN themed close ✕
          // (top-right, z-index 12). Leaflet's built-in `.leaflet-popup-close-button`
          // (z-index 30) would stack a second raw ✕ over it — the "double cross"
          // artifact. Default OFF so only the card's close shows; callers can still
          // opt back in via popupProps.closeButton.
          closeButton: rawPopupOptions.closeButton ?? false,
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
          // Stop at the Leaflet layer level too so the synthesized touch `tap`
          // does not bubble a map `click` that dismisses the place card.
          L?.DomEvent?.stopPropagation?.(e)
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
      existing.set(key, { coord: coordStr, marker, contentKey })

      newMarkers.push(marker)
    }

    if (newMarkers.length) {
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
    }

    // `layeradd` (the effect above) misses the very first cluster batch: this
    // very call — `group.addLayers(newMarkers)` a few lines up — builds the
    // whole clustering tree AND adds the starting view's clusters to the map
    // synchronously inside itself, which can finish before that effect
    // attaches on a slower first commit (#1624). Sweep every currently-shown
    // cluster right after touching the group so the initial batch, and any
    // batch whose count shifted from a removal alone, always ends up labelled.
    if (map && typeof map.eachLayer === 'function') {
      try {
        map.eachLayer(applyClusterAccessibleName)
      } catch {
        // noop
      }
    }

    if (!removedMarkers.length && !newMarkers.length) return

    // Re-publish the index to the parent. `onMarkerInstance` is keyed by COORD while
    // markers are keyed by identity, so clearing a removed marker's coord can orphan a
    // surviving marker that shares the same address. Drop only coords nobody owns any
    // more, then re-announce every live marker: the parent index feeds
    // MapUiApi.openPopupForCoord (tap a place in the list → open its popup).
    const liveCoords = new Set<string>()
    for (const { coord } of existing.values()) liveCoords.add(coord)
    for (const coord of removedCoords) {
      if (!liveCoords.has(coord)) onMarkerInstanceRef.current?.(coord, null)
    }
    for (const { coord, marker } of existing.values()) {
      onMarkerInstanceRef.current?.(coord, marker)
    }
  }, [
    L,
    map,
    validPoints,
    markerIcon,
    markerOpacity,
    suppressLeafletPopupOnSelect,
    groupVersion,
    applyClusterAccessibleName,
  ])

  // Marker options that are baked in at creation time (icon, opacity, whether a
  // popup is bound at all) change far more rarely than the point set. When they do,
  // drop the index once so the diff effect above re-creates every marker with the
  // new options — the effect itself must never rebuild on a plain data change.
  const markerBuildKey = `${markerOpacity}|${suppressLeafletPopupOnSelect ? 1 : 0}`
  const lastMarkerBuildRef = useRef<{ icon: any; buildKey: string } | null>(null)
  useEffect(() => {
    const previous = lastMarkerBuildRef.current
    lastMarkerBuildRef.current = { icon: markerIcon, buildKey: markerBuildKey }
    if (!previous) return
    if (previous.icon === markerIcon && previous.buildKey === markerBuildKey) return

    const group = clusterGroupRef.current
    if (!group) return
    for (const { marker } of markerMapRef.current.values()) {
      try {
        marker.off()
        marker.unbindPopup?.()
      } catch {
        // noop
      }
    }
    try {
      group.clearLayers()
    } catch {
      // noop
    }
    markerMapRef.current.clear()
    setOpenPopups((prev) => (prev.size ? new Map() : prev))
    // Re-uses the same path as a freshly created group: bump the version so the
    // diff effect sees an empty index and repopulates it.
    setGroupVersion((v) => v + 1)
  }, [markerIcon, markerBuildKey])

  // Unmount only: tell the parent its marker index is stale. Doing this in the diff
  // effect's cleanup would wipe the index on every data change.
  useEffect(() => {
    const index = markerMapRef.current
    return () => {
      for (const { coord } of index.values()) {
        onMarkerInstanceRef.current?.(coord, null)
      }
    }
  }, [])

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
