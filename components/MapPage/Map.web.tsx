import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Platform, StyleSheet, View } from 'react-native'
import { useQueryClient } from '@tanstack/react-query'

import { CoordinateConverter } from '@/utils/coordinateConverter'
import { useTheme, useThemedColors, type ThemedColors } from '@/hooks/useTheme'
import { isValidCoordinate } from '@/utils/coordinateValidator'
import { DEFAULT_RADIUS_KM, DEFAULT_MAP_CENTER } from '@/constants/mapConfig'
import { LAYOUT } from '@/constants/layout'
import { createMapPopupComponent } from './Map/createMapPopupComponent'
import { useUserLocationSignal } from './Map/userLocationSignal'
import { useMapClusters } from '@/hooks/map/useMapClusters'
import { useMapViewportSnapshot } from '@/hooks/map/useMapViewportSnapshot'
import { useBottomSheetStore } from '@/stores/bottomSheetStore'
import { useMapPanelStore } from '@/stores/mapPanelStore'
import { resolveRoutingApiKey } from '@/utils/routingApiKey'
import type { MapMode, MapMovePayload, MapProps, Point } from './Map/types'
import { strToLatLng } from './Map/utils'

import { useMapCleanup } from '@/components/MapPage/Map/useMapCleanup'
import { useLeafletIcons } from './Map/useLeafletIcons'
import { useMapInstance } from './Map/useMapInstance'
import { useMapApi } from './Map/useMapApi'
import MapControls from './Map/MapControls'
import {
  MapLoadingOverlay,
  MapWebBackground,
  MapWebLeafletCanvas,
  NoPointsMessage,
} from './Map/MapWebCanvas'

import { useLeafletLoader } from '@/hooks/useLeafletLoader'
import { useMapPopupAutoPan } from './Map/useMapPopupAutoPan'
import { useMapUserLocation } from './Map/useMapUserLocation'
import { useMapWebLayoutEffects } from './Map/useMapWebLayoutEffects'
import {
  buildRouteLineLatLngObjects,
  getCircleCenter,
  getHintCenterLatLng,
  getSafeCenter,
  normalizeLngLatWithHint as normalizeLngLatWithHintHelper,
} from './Map/mapWebGeometry'
import { queryKeys } from '@/api/queryKeys'
import { isFallbackMinskCenter } from './Map/fallbackCenter'
import { beginProgrammaticMapMove } from './Map/programmaticMoveSignal'
import {
  buildServerClusterRenderData,
  filterServerClusterRenderDataByRadius,
  getRadiusFilterLimit,
} from './Map/serverClusterRenderData'

type ReactLeafletNS = typeof import('react-leaflet')

const ORS_API_KEY = resolveRoutingApiKey()
const IS_WEB = Platform.OS === 'web'
const COMPACT_POPUP_MAX_WIDTH = 560
const DEFAULT_ZOOM = 11
const DEFAULT_MAX_ZOOM = 18
const MARKER_ZOOM_TARGET = 14
const MARKER_REOPEN_TIMEOUT_MS = 500
// Touch tap → synthesized map `click` arrives a few ms after the marker/cluster
// tap. Suppress background-tap dismissal within this window.
const MARKER_TAP_GUARD_MS = 350
// Vertical shift so a selected point is not hidden behind MapPlaceBottomCard when
// no zoom is applied. Approximates the mobile card height + breathing room.
const MOBILE_CARD_OFFSET_PX = 200
const FALLBACK_COORDINATES = DEFAULT_MAP_CENTER

type Props = MapProps

/**
 * Базовая подложка карты всегда светлая (обычный цвет), независимо от темы
 * приложения — по требованию пользователя. Хелпер сохранён для совместимости и
 * всегда возвращает false; тёмными остаются только панели/контролы/маркеры.
 */
export const shouldUseDarkMapTiles = (_theme?: string | null) => false

function safeInvoke(fn: (() => void) | undefined) {
  if (!fn) return
  try {
    fn()
  } catch {
    ignoreOptionalMapRuntimeError()
  }
}

function ignoreOptionalMapRuntimeError() {
  return
}

function getViewportWidth(): number | null {
  if (typeof window === 'undefined' || !Number.isFinite(window.innerWidth)) return null
  return window.innerWidth
}

const MapControlsReactive: React.FC<
  Omit<React.ComponentProps<typeof MapControls>, 'bottomOffset'>
> = (props) => {
  const bottomOffset = useBottomSheetStore((state) => state.getControlsBottomOffset())
  return <MapControls {...props} bottomOffset={bottomOffset} />
}

export const getMarkerFocusPlan = ({
  currentZoom,
  maxZoom,
  bottomSheetState,
}: {
  currentZoom: number
  maxZoom: number
  bottomSheetState: 'collapsed' | 'quarter' | 'half' | 'seventy' | 'full'
}) => {
  const safeCurrentZoom = Number.isFinite(currentZoom) ? currentZoom : DEFAULT_ZOOM
  const safeMaxZoom = Number.isFinite(maxZoom) ? maxZoom : DEFAULT_MAX_ZOOM
  return {
    shouldCollapseSheet: bottomSheetState !== 'collapsed',
    targetZoom: Math.min(Math.max(safeCurrentZoom + 2, MARKER_ZOOM_TARGET), safeMaxZoom || DEFAULT_MAX_ZOOM),
    shouldSkipZoom: safeCurrentZoom >= MARKER_ZOOM_TARGET,
  }
}

const MapPageComponent: React.FC<Props> = (props) => {
  const {
    travel = { data: [] },
    coordinates,
    // Intentionally NOT defaulted to false: `undefined` means "origin unknown",
    // letting useMapUserLocation fall back to legacy Minsk coordinate-matching.
    // Only an explicit true/false from the controller overrides that.
    coordinatesAreFallback,
    userLocation: providedUserLocation,
    routePoints,
    fullRouteCoords,
    onMapClick,
    mode,
    transportMode,
    setRouteDistance,
    setRouteDuration,
    setFullRouteCoords,
    setRouteElevationStats,
    setRoutingLoading,
    setRoutingError,
    radius,
    showRadiusCircle = true,
    mapClusterFilters,
    categoryFilterUnresolved = false,
    onUserLocationChange,
    onMapMove,
    hideFloatingControls = false,
    onMarkerSelect,
    onMapBackgroundTap,
    suppressLeafletPopupOnSelect = false,
    pointsOnly = false,
  } = props

  const { L, RL: rl, loading: leafletLoading, error: leafletError, ready: leafletReady } =
    useLeafletLoader({
      enabled: IS_WEB,
      // Defer the ~70KB Leaflet runtime off the critical interactivity path:
      // schedule it via requestIdleCallback (with a 1.2s safety timeout) and fall
      // back to a short 300ms delay on browsers without rIC. The map frame +
      // skeleton (MapWebBackground / MapLoadingOverlay) render immediately, and
      // MapScreen already idle-prefetches loadLeafletRuntime, so the dynamic
      // import is typically warm by the time loading is enabled — tiles/points
      // still appear quickly without blocking first paint.
      useIdleCallback: true,
      idleTimeout: 1200,
      fallbackDelay: 300,
    })

  const [showInitialLoader, setShowInitialLoader] = useState(!IS_WEB)
  const [errors, setErrors] = useState<any>({ routing: false })
  const [disableFitBounds] = useState(false)
  const [mapInstance, setMapInstance] = useState<any>(null)

  // Current Leaflet zoom kept in a ref (not state): it is only read as a fallback
  // inside imperative marker/cluster tap handlers when `map.getZoom()` is
  // unavailable. Storing it in state re-rendered the whole map tree on every
  // zoomend (freeze on zoom). The ref is updated by MapLogicComponent's
  // syncZoomFromMap via the `setMapZoom` prop below.
  const mapZoomRef = useRef<number>(DEFAULT_ZOOM)
  const setMapZoom = useCallback((zoom: number) => {
    if (Number.isFinite(zoom)) mapZoomRef.current = zoom
  }, [])

  const markerByCoordRef = useRef<Map<string, any>>(new Map())
  const markerReopenTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Timestamp of the last marker/cluster tap. A touch tap synthesizes a map
  // `click` (Leaflet's deprecated `tap` handler) that would otherwise fire
  // `onMapBackgroundTap` and dismiss the freshly-selected place card. We ignore
  // background taps within this window after a marker/cluster tap.
  const lastMarkerTapAtRef = useRef(0)
  const wrapperRef = useRef<View | null>(null)

  const colors = useThemedColors()
  const themeContextValue = useTheme()
  const queryClient = useQueryClient()
  const styles = useMemo(() => getStyles(colors), [colors])
  const popupBottomOffset = useBottomSheetStore((s) => s.getControlsBottomOffset())
  const bottomSheetState = useBottomSheetStore((s) => s.state)
  const requestBottomSheetCollapse = useMapPanelStore((s) => s.requestCollapse)

  useEffect(() => {
    if (IS_WEB) return
    const timeout = setTimeout(() => setShowInitialLoader(false), 0)
    return () => clearTimeout(timeout)
  }, [])

  const mapContainerStyle = useMemo(() => {
    const base = StyleSheet.flatten(styles.map as any) as any
    if (!IS_WEB) return base
    return { ...(base || {}), position: 'relative', zIndex: 1 }
  }, [styles.map])

  const safeCoordinates = useMemo(() => {
    const source = coordinates && typeof coordinates === 'object' ? coordinates : FALLBACK_COORDINATES
    const zoomValue = (source as any)?.zoom
    const latCandidate = Number((source as any)?.latitude)
    const lngCandidate = Number((source as any)?.longitude)
    const hasValidLatLng = isValidCoordinate(latCandidate, lngCandidate)
    return {
      latitude: hasValidLatLng ? latCandidate : FALLBACK_COORDINATES.latitude,
      longitude: hasValidLatLng ? lngCandidate : FALLBACK_COORDINATES.longitude,
      zoom: Number.isFinite(zoomValue) ? zoomValue : DEFAULT_ZOOM,
    }
  }, [coordinates])

  const mapRef = useRef<any>(null)
  const hasInitializedRef = useRef(false)
  const lastModeRef = useRef<MapMode | null>(null)
  const savedMapViewRef = useRef<{ center: [number, number]; zoom: number } | null>(null)
  const lastAutoFitKeyRef = useRef<string | null>(null)

  const { mapInstanceKeyRef, mapContainerIdRef } = useMapCleanup()

  useEffect(() => {
    return () => {
      mapRef.current = null
      if (markerReopenTimerRef.current) {
        clearTimeout(markerReopenTimerRef.current)
        markerReopenTimerRef.current = null
      }
    }
  }, [])

  const travelData = useMemo(
    () => (Array.isArray(travel?.data) ? travel.data : []),
    [travel?.data],
  )

  const coordinatesLatLng = useMemo(
    () => ({ lat: safeCoordinates.latitude, lng: safeCoordinates.longitude }),
    [safeCoordinates.latitude, safeCoordinates.longitude],
  )

  const radiusInMeters = useMemo(() => {
    if (mode !== 'radius') return null
    const radiusKm = parseInt(radius || String(DEFAULT_RADIUS_KM), 10)
    if (isNaN(radiusKm) || radiusKm <= 0) return DEFAULT_RADIUS_KM * 1000
    return radiusKm * 1000
  }, [mode, radius])

  const { centerOnUserLocation, userLocationLatLng } = useMapUserLocation({
    coordinates,
    providedUserLocation,
    coordinatesAreFallback,
    mapRef,
    onUserLocationChange,
    isFallbackMinskCenter,
  })

  // The radius guard below uses radius*2 as the cutoff, so sub-100m GPS jitter
  // is irrelevant. Coarsen the center to ~3 decimals (~100m) so a stream of
  // GPS updates doesn't re-run this O(n) filter on every tick.
  const filterCenter = useMemo(() => {
    const c = userLocationLatLng ?? coordinatesLatLng
    if (!c || !Number.isFinite(c.lat) || !Number.isFinite(c.lng)) return null
    return { lat: Math.round(c.lat * 1000) / 1000, lng: Math.round(c.lng * 1000) / 1000 }
  }, [userLocationLatLng, coordinatesLatLng])

  const filteredTravelData = useMemo(() => {
    if (mode !== 'radius') return travelData
    if (!Array.isArray(travelData) || travelData.length === 0) return travelData

    const center = filterCenter ?? coordinatesLatLng
    const hasValidCenter = CoordinateConverter.isValid(center)
    const hasValidRadius =
      Number.isFinite(radiusInMeters as any) && !!radiusInMeters && (radiusInMeters as number) > 0
    const guardRadius = hasValidCenter && hasValidRadius
      ? getRadiusFilterLimit(radiusInMeters as number)
      : null

    return travelData.filter((p) => {
      try {
        const ll = strToLatLng(String((p as any)?.coord ?? ''), hasValidCenter ? center : null)
        if (!ll) return false
        const coords = { lat: ll[1], lng: ll[0] }
        if (!CoordinateConverter.isValid(coords)) return false
        if (guardRadius == null) return true
        const d = CoordinateConverter.distance(center, coords)
        return Number.isFinite(d) && d <= guardRadius
      } catch {
        return false
      }
    })
    // filterCenter.lat/lng used instead of filterCenter object to avoid recompute on identity churn
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, radiusInMeters, travelData, filterCenter?.lat, filterCenter?.lng, coordinatesLatLng])

  // When the marker dataset changes identity, the cluster layer rebuilds its
  // markers. The cleanup runs before children re-register on the next commit,
  // so clearing here drops detached Leaflet markers from the previous dataset
  // (which openPopup lookups would otherwise resolve and hold) without wiping
  // freshly-registered markers.
  const markerByCoordRefStable = markerByCoordRef
  useEffect(() => {
    const index = markerByCoordRefStable.current
    return () => {
      index.clear()
    }
  }, [filteredTravelData, markerByCoordRefStable])

  // Markers are rendered by the imperative MarkerClusterGroup (Leaflet
  // markercluster), which does its own zoom-based clustering. Building markers
  // directly from filteredTravelData avoids the dead useMapMarkers/useClustering
  // path (an O(n) JS clustering pass) re-running on every zoom — that result was
  // never consumed here (only TravelMap.web.tsx uses it).
  const markers = filteredTravelData
  const travelMarkerOpacity = mode === 'route' ? 0.7 : 1
  const canRenderMap = leafletReady && !!(L && rl)
  const viewportSnapshot = useMapViewportSnapshot(
    mapInstance,
    Number.isFinite(safeCoordinates.zoom) ? Number(safeCoordinates.zoom) : DEFAULT_ZOOM,
    IS_WEB && mode === 'radius' && !pointsOnly && canRenderMap,
  )
  const serverClusterQuery = useMapClusters({
    bbox: viewportSnapshot.bbox,
    zoom: viewportSnapshot.zoom,
    filters: mapClusterFilters,
    enabled: IS_WEB && mode === 'radius' && !pointsOnly && canRenderMap,
  })
  const serverClusterRenderData = useMemo(
    () => buildServerClusterRenderData(serverClusterQuery.data),
    [serverClusterQuery.data],
  )
  const radiusFilteredServerClusterRenderData = useMemo(() => {
    const center = filterCenter ?? coordinatesLatLng
    return mode === 'radius'
      ? filterServerClusterRenderDataByRadius(serverClusterRenderData, center, radiusInMeters)
      : serverClusterRenderData
    // filterCenter.lat/lng used instead of filterCenter object to avoid recompute on identity churn
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    coordinatesLatLng,
    filterCenter?.lat,
    filterCenter?.lng,
    mode,
    radiusInMeters,
    serverClusterRenderData,
  ])
  // Когда категория выбрана, но не смапилась в числовой backend-ID, серверные
  // кластеры не отфильтрованы по категории (эндпоинт получил пустой category и
  // вернул всё) — используем клиентски отфильтрованный по имени `markers`, иначе
  // снятие категории не убирало бы маркеры.
  const shouldUseServerClusterData =
    mode === 'radius' &&
    !serverClusterQuery.isError &&
    radiusFilteredServerClusterRenderData.hasServerData &&
    !categoryFilterUnresolved
  const renderedMarkers = shouldUseServerClusterData && radiusFilteredServerClusterRenderData.markers.length > 0
    ? radiusFilteredServerClusterRenderData.markers
    : markers
  const renderedServerClusters =
    shouldUseServerClusterData && radiusFilteredServerClusterRenderData.clusters.length > 0
      ? radiusFilteredServerClusterRenderData.clusters
      : []

  const handleMarkerZoom = useCallback(
    (point: Point, coords: { lat: number; lng: number }, clickedMarker?: any) => {
      const map = mapRef.current
      if (!map) return
      if (!isValidCoordinate(coords.lat, coords.lng)) return

      // Record the marker tap so the synthesized map `click` (touch `tap` handler)
      // does not dismiss the card we are about to open.
      lastMarkerTapAtRef.current = Date.now()
      // Self-induced motion: the cluster viewport snapshot must ignore the
      // moveend/zoomend this pan/zoom fires (avoids mid-animation cluster churn).
      beginProgrammaticMapMove()

      const currentZoom = typeof map.getZoom === 'function' ? map.getZoom() : mapZoomRef.current
      const maxZoom = typeof map.getMaxZoom === 'function' ? map.getMaxZoom() : DEFAULT_MAX_ZOOM
      const focusPlan = getMarkerFocusPlan({ currentZoom, maxZoom, bottomSheetState })

      if (focusPlan.shouldCollapseSheet) requestBottomSheetCollapse()

      // #207 — mobile-web: surface the point as a bottom card instead of the
      // anchored Leaflet popup. We still pan/zoom toward the point (below) so the
      // marker is not hidden behind the card, but never call openPopup().
      if (suppressLeafletPopupOnSelect) {
        onMarkerSelect?.(point)
        // Close any popup that another path might have opened.
        safeInvoke(() => map?.closePopup?.())
        // Cancel any in-flight cluster-zoom animation so our move wins cleanly.
        safeInvoke(() => map?.stop?.())
        try {
          if (focusPlan.shouldSkipZoom) {
            // Already zoomed in enough (e.g. right after a cluster expand): don't
            // re-zoom, but still center the point with an upward offset so the
            // marker is not hidden behind MapPlaceBottomCard.
            const target = [coords.lat, coords.lng] as [number, number]
            if (typeof map.project === 'function' && typeof map.unproject === 'function') {
              const projected = map.project(target, currentZoom)
              projected.y += MOBILE_CARD_OFFSET_PX / 2
              const shifted = map.unproject(projected, currentZoom)
              map.panTo(shifted, { animate: true, duration: 0.3 } as any)
            } else if (typeof map.panTo === 'function') {
              map.panTo(target, { animate: true, duration: 0.3 } as any)
            }
            return
          }
          if (typeof map.flyTo === 'function') {
            map.flyTo([coords.lat, coords.lng], focusPlan.targetZoom, {
              animate: true,
              duration: 0.35,
            } as any)
          } else if (typeof map.setView === 'function') {
            map.setView([coords.lat, coords.lng], focusPlan.targetZoom, { animate: true } as any)
          }
        } catch {
          ignoreOptionalMapRuntimeError()
        }
        return
      }

      if (clickedMarker) {
        safeInvoke(() => clickedMarker.openPopup?.())
        return
      }

      const markerKey = String(point?.coord ?? '').trim()
      const resolveMarker = () =>
        markerByCoordRef.current.get(markerKey) ??
        markerByCoordRef.current.get(CoordinateConverter.toString(coords)) ??
        clickedMarker

      if (focusPlan.shouldSkipZoom) {
        safeInvoke(() => resolveMarker()?.openPopup?.())
        return
      }

      let reopened = false
      const reopenTimerRef = markerReopenTimerRef
      if (reopenTimerRef.current) {
        clearTimeout(reopenTimerRef.current)
        reopenTimerRef.current = null
      }

      const reopenPopup = () => {
        if (reopenTimerRef.current) {
          clearTimeout(reopenTimerRef.current)
          reopenTimerRef.current = null
        }
        if (reopened) return
        reopened = true
        safeInvoke(() => map?.off?.('moveend', reopenPopup))
        // Bail out if the map was torn down / replaced since scheduling.
        if (mapRef.current !== map) return
        safeInvoke(() => resolveMarker()?.openPopup?.())
      }

      if (typeof map.once === 'function') {
        safeInvoke(() => map.once('moveend', reopenPopup))
        reopenTimerRef.current = setTimeout(reopenPopup, MARKER_REOPEN_TIMEOUT_MS)
      }

      try {
        if (typeof map.flyTo === 'function') {
          map.flyTo([coords.lat, coords.lng], focusPlan.targetZoom, {
            animate: true,
            duration: 0.35,
          } as any)
        } else if (typeof map.setView === 'function') {
          map.setView([coords.lat, coords.lng], focusPlan.targetZoom, { animate: true } as any)
        }
      } catch {
        ignoreOptionalMapRuntimeError()
      }
    },
    [
      bottomSheetState,
      onMarkerSelect,
      requestBottomSheetCollapse,
      suppressLeafletPopupOnSelect,
    ],
  )

  const handleZoomIn = useCallback(() => safeInvoke(() => mapRef.current?.zoomIn?.()), [])
  const handleZoomOut = useCallback(() => safeInvoke(() => mapRef.current?.zoomOut?.()), [])

  // Stable identity so React.memo(MarkerClusterGroup) can actually skip re-renders
  // on zoom/pan — an inline closure here would change every render and force the
  // cluster layer to re-evaluate (and previously rebuild) its markers.
  const handleMarkerInstance = useCallback((coord: string, marker: any | null) => {
    if (marker) {
      markerByCoordRef.current.set(coord, marker)
    } else {
      markerByCoordRef.current.delete(coord)
    }
  }, [])

  // Stamped by MarkerClusterGroup on a cluster tap so the synthesized map `click`
  // (touch `tap` handler) does not immediately dismiss the mobile place card.
  const handleClusterTap = useCallback(() => {
    lastMarkerTapAtRef.current = Date.now()
  }, [])

  useEffect(() => {
    if (!errors?.routing) return
    const msg = typeof errors.routing === 'string' ? errors.routing : String(errors.routing)
    const normalized = msg.trim()
    if (!normalized) return
    if (normalized.toLowerCase().includes('signal is aborted')) return

    const shouldWarn = normalized.includes('Слишком много запросов')
    try {
      if (shouldWarn) console.warn('[Map] Routing:', normalized)
      else console.error('[Map] Routing error:', normalized)
    } catch {
      // ignore console invocation failures in restricted runtimes
    }
  }, [errors?.routing])

  const customIcons = useLeafletIcons(L)
  // Базовая подложка карты всегда светлая (обычный цвет), даже в тёмной теме UI.
  const { leafletBaseLayerRef, leafletOverlayLayersRef, leafletControlRef } = useMapInstance({
    map: mapInstance,
    L,
  })

  // Expose marker index for MapUiApi.openPopupForCoord
  useEffect(() => {
    try {
      ;(leafletControlRef as any).markerByCoord = markerByCoordRef.current
    } catch {
      ignoreOptionalMapRuntimeError()
    }
  }, [leafletControlRef])

  useMapApi({
    map: mapInstance,
    L,
    onMapUiApiReady: props.onMapUiApiReady,
    travelData: filteredTravelData,
    userLocation: userLocationLatLng,
    routePoints,
    leafletBaseLayerRef,
    leafletOverlayLayersRef,
    leafletControlRef,
    onRequestUserLocationFocus: centerOnUserLocation,
  })

  // F-49 — report the map center (debounced) on pan/zoom end so the controller
  // can offer "Search this area". We skip near-identical centers to avoid churn.
  const onMapMoveRef = useRef(onMapMove)
  useEffect(() => {
    onMapMoveRef.current = onMapMove
  }, [onMapMove])

  useEffect(() => {
    if (!IS_WEB) return
    const map = mapInstance
    if (!map || typeof map.on !== 'function') return

    let timer: ReturnType<typeof setTimeout> | null = null
    let lastSent: { lat: number; lng: number } | null = null

    const emit = () => {
      try {
        const center = map.getCenter?.()
        const lat = Number(center?.lat)
        const lng = Number(center?.lng)
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return
        const bounds = map.getBounds?.()
        const southWest = bounds?.getSouthWest?.()
        const northEast = bounds?.getNorthEast?.()
        const zoom = Number(map.getZoom?.())
        if (
          lastSent &&
          Math.abs(lastSent.lat - lat) < COORD_EPSILON &&
          Math.abs(lastSent.lng - lng) < COORD_EPSILON
        ) {
          return
        }
        lastSent = { lat, lng }
        const payload: MapMovePayload = { latitude: lat, longitude: lng }
        if (
          southWest &&
          northEast &&
          Number.isFinite(southWest.lat) &&
          Number.isFinite(southWest.lng) &&
          Number.isFinite(northEast.lat) &&
          Number.isFinite(northEast.lng)
        ) {
          payload.bbox = {
            south: Math.min(southWest.lat, northEast.lat),
            west: Math.min(southWest.lng, northEast.lng),
            north: Math.max(southWest.lat, northEast.lat),
            east: Math.max(southWest.lng, northEast.lng),
          }
        }
        if (Number.isFinite(zoom)) {
          payload.zoom = zoom
        }
        onMapMoveRef.current?.(payload)
      } catch {
        ignoreOptionalMapRuntimeError()
      }
    }

    const onMoveEnd = () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(emit, 300)
    }

    map.on('moveend', onMoveEnd)
    return () => {
      if (timer) clearTimeout(timer)
      try {
        map.off?.('moveend', onMoveEnd)
      } catch {
        ignoreOptionalMapRuntimeError()
      }
    }
  }, [mapInstance])

  const handleMapClick = useCallback(
    (e: any) => {
      // #207 — tapping the empty map dismisses the mobile place card, BUT a touch
      // tap on a marker/cluster synthesizes a map `click` (Leaflet `tap` handler)
      // that must NOT dismiss the just-selected card. Guard on both the DOM target
      // (tap landed on a marker/cluster icon) and a short time window after the
      // last marker/cluster tap (ghost-click races the icon hit-test).
      const target = e?.originalEvent?.target as HTMLElement | undefined
      const hitMarker =
        typeof target?.closest === 'function' &&
        !!target.closest('.leaflet-marker-icon, .metravel-cluster-icon')
      const withinTapGuard = Date.now() - lastMarkerTapAtRef.current < MARKER_TAP_GUARD_MS
      if (!hitMarker && !withinTapGuard) {
        onMapBackgroundTap?.()
      }
      if (mode !== 'route') return
      try {
        const { lat, lng } = e.latlng
        onMapClick(lng, lat)
      } catch {
        ignoreOptionalMapRuntimeError()
      }
    },
    [mode, onMapClick, onMapBackgroundTap],
  )

  const safeCenter = useMemo<[number, number]>(() => getSafeCenter(coordinates), [coordinates])

  const circleCenter = useMemo<[number, number] | null>(
    () => getCircleCenter(mode, userLocationLatLng, safeCenter),
    [mode, safeCenter, userLocationLatLng],
  )

  const circleCenterLatLng = useMemo(
    () => (showRadiusCircle && circleCenter ? { lat: circleCenter[0], lng: circleCenter[1] } : null),
    [circleCenter, showRadiusCircle],
  )

  const hintCenterLatLng = useMemo(
    () => getHintCenterLatLng(mode, circleCenterLatLng, coordinatesLatLng),
    [mode, circleCenterLatLng, coordinatesLatLng],
  )

  const normalizeLngLatWithHint = useCallback(
    (tuple: [number, number]): [number, number] =>
      normalizeLngLatWithHintHelper(tuple, hintCenterLatLng),
    [hintCenterLatLng],
  )

  // Desktop «Показать всё»: подогнать карту под все загруженные точки (fit ко всем
  // маркерам). Тот же расчёт, что и MapUiApi.fitToResults, но локально для плавающих
  // контролов. На мобильном сброс+fit делает верхний overlay (onShowAllPlaces).
  const handleFitAllTravels = useCallback(() => {
    const map = mapRef.current
    if (!map || !L || typeof (L as any).latLngBounds !== 'function') return
    const data = Array.isArray(filteredTravelData) ? filteredTravelData : []
    if (data.length === 0) return
    try {
      const latLngs = data
        .map((p) => strToLatLng(String((p as any)?.coord ?? ''), hintCenterLatLng))
        .filter((c): c is [number, number] => Array.isArray(c))
        .map(([lng, lat]) => [lat, lng] as [number, number])
        .filter(([lat, lng]) => isValidCoordinate(lat, lng))
      if (latLngs.length === 0) return
      beginProgrammaticMapMove()
      const bounds = (L as any).latLngBounds(latLngs.map(([lat, lng]) => (L as any).latLng(lat, lng)))
      map.fitBounds(bounds.pad(0.2), { animate: true, duration: 0.35 } as any)
    } catch {
      ignoreOptionalMapRuntimeError()
    }
  }, [L, filteredTravelData, hintCenterLatLng])

  const routePointsForRouting = useMemo<[number, number][]>(() => {
    if (!Array.isArray(routePoints) || routePoints.length === 0) return []
    return routePoints.map((p) => normalizeLngLatWithHint(p))
  }, [normalizeLngLatWithHint, routePoints])

  const hasWarnedInvalidCircleRef = useRef(false)
  useEffect(() => {
    if (hasWarnedInvalidCircleRef.current) return
    if (mode !== 'radius' || circleCenter) return
    hasWarnedInvalidCircleRef.current = true
    console.warn('[Map] Skipping radius circle due to invalid center:', {
      rawCoordinates: coordinates,
      safeCenter,
      radius,
    })
  }, [circleCenter, coordinates, mode, radius, safeCenter])

  const noPointsAlongRoute =
    mode === 'route' && Array.isArray(routePoints) && routePoints.length >= 2 && travelData.length === 0

  const { mapPaneWidth } = useMapWebLayoutEffects({
    wrapperRef,
    mapRef,
    mapInstance,
    setMapInstance,
    mode,
    mapContainerId: mapContainerIdRef.current,
    leafletBaseLayerRef,
    canRenderMap,
    setShowInitialLoader,
  })

  // Radius default view = the whole circle around the user, with breathing room.
  // On desktop the left panel is a flex SIBLING of the map (it shrinks the map
  // host, never overlays it), so the circle bounds are already inside the visible
  // pane — we only add symmetric air. On mobile the map is full-bleed and the
  // bottom sheet overlays the lower part of the map, so we reserve its current
  // height (popupBottomOffset, ~120px collapsed) at the bottom so the circle is
  // never hidden behind the sheet. The user marker (circle center) always stays
  // in view because the bounds always contain it.
  const fitBoundsPadding = useMemo(() => {
    if (mode !== 'radius') {
      return {
        paddingTopLeft: [24, 140] as [number, number],
        paddingBottomRight: [360, 220] as [number, number],
      }
    }

    const isCompact =
      mapPaneWidth > 0
        ? mapPaneWidth <= COMPACT_POPUP_MAX_WIDTH
        : (getViewportWidth() ?? 0) <= COMPACT_POPUP_MAX_WIDTH

    // Horizontal/top air is symmetric; the circle sits inside the visible pane.
    const AIR = 24

    if (isCompact) {
      // Mobile: reserve the bottom-sheet height so the lower arc of the circle
      // clears the sheet, plus a little air. Top gets room for the floating
      // controls row.
      const bottomReserve = Math.max(popupBottomOffset, 96) + AIR
      return {
        paddingTopLeft: [AIR, 72] as [number, number],
        paddingBottomRight: [AIR, bottomReserve] as [number, number],
      }
    }

    // Desktop: panel already excluded from the pane — just symmetric air so the
    // circle never touches the map edges.
    return {
      paddingTopLeft: [AIR, AIR + 56] as [number, number],
      paddingBottomRight: [AIR, AIR + 24] as [number, number],
    }
  }, [mode, mapPaneWidth, popupBottomOffset])

  const handleServerClusterZoom = useCallback(
    (payload: {
      center: [number, number]
      bounds: [[number, number], [number, number]]
      key: string
      items: Point[]
    }) => {
      const map = mapRef.current
      if (!map) return
      lastMarkerTapAtRef.current = Date.now()
      beginProgrammaticMapMove()

      try {
        const [[south, west], [north, east]] = payload.bounds
        if (
          L?.latLngBounds &&
          Number.isFinite(south) &&
          Number.isFinite(west) &&
          Number.isFinite(north) &&
          Number.isFinite(east) &&
          typeof map.fitBounds === 'function'
        ) {
          map.fitBounds(L.latLngBounds([[south, west], [north, east]]), fitBoundsPadding as any)
          return
        }

        const [lat, lng] = payload.center
        const currentZoom = typeof map.getZoom === 'function' ? map.getZoom() : mapZoomRef.current
        const maxZoom = typeof map.getMaxZoom === 'function' ? map.getMaxZoom() : DEFAULT_MAX_ZOOM
        const targetZoom = Math.min(maxZoom, Math.max(currentZoom + 1, MARKER_ZOOM_TARGET))
        if (typeof map.setView === 'function') {
          map.setView([lat, lng], targetZoom, { animate: true } as any)
        }
      } catch {
        ignoreOptionalMapRuntimeError()
      }
    },
    [L, fitBoundsPadding],
  )

  const useCompactPopupLayout = useMemo(() => {
    if (mapPaneWidth > 0) return mapPaneWidth <= COMPACT_POPUP_MAX_WIDTH
    const viewport = getViewportWidth()
    return viewport !== null && viewport <= COMPACT_POPUP_MAX_WIDTH
  }, [mapPaneWidth])

  // Zoom/locate floating controls. Раньше скрывались на широком десктопе, т.к.
  // те же действия дублировались в плавающем баре MapQuickFilters. После выпила
  // дубль-системы фильтров (этап 2) бар удалён — контролы нужны на любой ширине,
  // кроме мобильного (там их рендерит MapMobileLayout, hideFloatingControls=true).
  const shouldShowFloatingMapControls = !hideFloatingControls

  const { popupAutoPanPadding } = useMapPopupAutoPan({
    mapRef,
    mapPaneWidth,
    popupBottomOffset,
  })

  // Keep PopupComponent identity stable across GPS updates: precise coords via the
  // signal's `.current` (no per-tick re-render → no unmount/remount that would wipe
  // internal popup state like the fullscreen viewer). The signal ALSO exposes a
  // coarse `hasLocation()` boolean the popup subscribes to, so «Маршрут» + distance
  // chip appear the moment the first fix arrives (null→present), not only after an
  // unrelated re-render.
  const userLocationSignal = useUserLocationSignal(userLocationLatLng)

  const PopupComponent = useMemo(() => {
    if (!rl) return null
    return createMapPopupComponent({
      colors,
      themeContextValue,
      compactLayout: useCompactPopupLayout,
      fullscreenOnMobile: useCompactPopupLayout,
      // Desktop (non-compact) popup: pin the photo as a fixed header and scroll only
      // the caption/actions/«Ещё» grid beneath it (the popup box stays CSS-capped, so
      // expanding «Ещё» never grows it off-screen / re-pans the map).
      popupSplit: !useCompactPopupLayout,
      fullscreenTopInset: LAYOUT.headerHeight,
      fullscreenBottomInset: LAYOUT.tabBarHeight,
      userLocationSignal,
      invalidateUserPoints: () => {
        void queryClient.invalidateQueries({ queryKey: queryKeys.userPointsAll() })
      },
    })
  }, [colors, queryClient, rl, themeContextValue, useCompactPopupLayout, userLocationSignal])

  const shouldShowLoadingOverlay = IS_WEB
    ? !!leafletError || !canRenderMap
    : showInitialLoader || leafletLoading || !!leafletError || !canRenderMap

  const rlSafe = (rl ?? {}) as ReactLeafletNS
  const { useMap, useMapEvents } = rlSafe
  const hasValidReactLeafletHooks =
    !!useMap && typeof useMap === 'function' && !!useMapEvents && typeof useMapEvents === 'function'

  const routeLineLatLngObjects = useMemo(
    () =>
      buildRouteLineLatLngObjects(mode, fullRouteCoords, routePointsForRouting, hintCenterLatLng),
    [fullRouteCoords, hintCenterLatLng, mode, routePointsForRouting],
  )

  return (
    <View ref={wrapperRef} style={styles.wrapper} testID="map-leaflet-wrapper">
      <MapWebBackground opacity={0.18} />

      {shouldShowLoadingOverlay && <MapLoadingOverlay colors={colors} styles={styles} />}
      {noPointsAlongRoute && <NoPointsMessage />}

      <MapWebLeafletCanvas
        rl={rlSafe}
        L={L}
        colors={colors}
        mode={mode}
        canRenderMap={canRenderMap}
        hasValidReactLeafletHooks={hasValidReactLeafletHooks}
        mapContainerStyle={mapContainerStyle}
        mapContainerId={mapContainerIdRef.current}
        safeCenter={safeCenter}
        safeZoom={Number.isFinite(safeCoordinates.zoom) ? Number(safeCoordinates.zoom) : DEFAULT_ZOOM}
        mapInstanceKey={mapInstanceKeyRef.current}
        circleCenterLatLng={circleCenterLatLng}
        radiusInMeters={radiusInMeters}
        userLocationLatLng={userLocationLatLng}
        customIcons={customIcons}
        mapInstance={mapInstance}
        handleMapClick={handleMapClick}
        coordinatesLatLng={coordinatesLatLng}
        disableFitBounds={disableFitBounds}
        travelData={filteredTravelData}
        fitBoundsPadding={fitBoundsPadding}
        setMapZoom={setMapZoom}
        mapRef={mapRef}
        setMapInstance={setMapInstance}
        savedMapViewRef={savedMapViewRef}
        hasInitializedRef={hasInitializedRef}
        lastModeRef={lastModeRef}
        lastAutoFitKeyRef={lastAutoFitKeyRef}
        leafletBaseLayerRef={leafletBaseLayerRef}
        leafletOverlayLayersRef={leafletOverlayLayersRef}
        leafletControlRef={leafletControlRef}
        hintCenterLatLng={hintCenterLatLng}
        routeLineLatLngObjects={routeLineLatLngObjects}
        routePoints={routePoints}
        routePointsForRouting={routePointsForRouting}
        transportMode={transportMode}
        setRoutingLoading={setRoutingLoading}
        setErrors={setErrors}
        setRoutingError={setRoutingError}
        setRouteDistance={setRouteDistance}
        setRouteDuration={setRouteDuration}
        setFullRouteCoords={setFullRouteCoords}
        setRouteElevationStats={setRouteElevationStats}
        orsApiKey={ORS_API_KEY}
        markers={renderedMarkers}
        serverClusters={renderedServerClusters}
        onServerClusterZoom={handleServerClusterZoom}
        PopupComponent={PopupComponent}
        popupAutoPanPadding={popupAutoPanPadding}
        handleMarkerZoom={handleMarkerZoom}
        suppressLeafletPopupOnSelect={suppressLeafletPopupOnSelect}
        onMarkerInstance={handleMarkerInstance}
        onClusterTap={handleClusterTap}
        travelMarkerOpacity={travelMarkerOpacity}
      />

      {shouldShowFloatingMapControls && (
        <MapControlsReactive
          userLocation={userLocationLatLng}
          onCenterUserLocation={centerOnUserLocation}
          onShowAll={mode === 'radius' ? handleFitAllTravels : undefined}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          alignLeft
        />
      )}
    </View>
  )
}

const getStyles = (colors: ThemedColors) =>
  StyleSheet.create({
    wrapper: {
      flex: 1,
      width: '100%',
      height: '100%',
      borderRadius: 16,
      overflow: 'hidden',
      backgroundColor: colors.backgroundSecondary,
      position: 'relative',
    },
    map: { flex: 1, width: '100%', height: '100%', minHeight: 300 },
    loader: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  })

const COORD_EPSILON = 0.0001

function coordsApproxEqual(a: [number, number], b: [number, number] | undefined) {
  return !!b && Math.abs(a[0] - b[0]) < COORD_EPSILON && Math.abs(a[1] - b[1]) < COORD_EPSILON
}

export const arePropsEqual = (prevProps: Props, nextProps: Props): boolean => {
  if (
    Math.abs(prevProps.coordinates.latitude - nextProps.coordinates.latitude) > COORD_EPSILON ||
    Math.abs(prevProps.coordinates.longitude - nextProps.coordinates.longitude) > COORD_EPSILON
  ) {
    return false
  }
  if (prevProps.mode !== nextProps.mode || prevProps.transportMode !== nextProps.transportMode) {
    return false
  }

  const prevRP = prevProps.routePoints ?? []
  const nextRP = nextProps.routePoints ?? []
  if (prevRP.length !== nextRP.length) return false
  if (!prevRP.every((p, i) => coordsApproxEqual(p, nextRP[i]))) return false

  const prevFull = prevProps.fullRouteCoords ?? []
  const nextFull = nextProps.fullRouteCoords ?? []
  if (prevFull.length !== nextFull.length) return false
  if (prevFull.length > 0 && !prevFull.every((p, i) => coordsApproxEqual(p, nextFull[i]))) return false

  if (prevProps.radius !== nextProps.radius) return false
  if (prevProps.mapClusterFilters !== nextProps.mapClusterFilters) return false
  if (prevProps.categoryFilterUnresolved !== nextProps.categoryFilterUnresolved) return false

  // #207 host-stability (#217): the map is a stable host that never remounts, so a
  // desktop↔mobile resize flips isMobile at the caller, toggling these props (mobile
  // surfaces a bottom card / suppresses the Leaflet popup; desktop keeps the anchored
  // popup). All three are referentially stable per isMobile value at the caller
  // (useMapScreenController), so comparing identity here does not cause a render storm —
  // it just lets the tap semantics switch immediately instead of waiting for a data change.
  if (prevProps.suppressLeafletPopupOnSelect !== nextProps.suppressLeafletPopupOnSelect) return false
  if (prevProps.onMarkerSelect !== nextProps.onMarkerSelect) return false
  if (prevProps.onMapBackgroundTap !== nextProps.onMapBackgroundTap) return false

  const prevData = prevProps.travel?.data ?? []
  const nextData = nextProps.travel?.data ?? []
  if (prevData.length !== nextData.length) return false
  if (
    !prevData.every((p, i) => {
      const n = nextData[i]
      return n && p.id === n.id && p.coord === n.coord && p.address === n.address
    })
  ) {
    return false
  }
  return true
}

export default React.memo(MapPageComponent, arePropsEqual)
