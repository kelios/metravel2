import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Platform, StyleSheet, View } from 'react-native'
import { useQueryClient } from '@tanstack/react-query'

import { CoordinateConverter } from '@/utils/coordinateConverter'
import { useTheme, useThemedColors, type ThemedColors } from '@/hooks/useTheme'
import { isValidCoordinate } from '@/utils/coordinateValidator'
import { DEFAULT_RADIUS_KM } from '@/constants/mapConfig'
import { createMapPopupComponent } from './Map/createMapPopupComponent'
import { useBottomSheetStore } from '@/stores/bottomSheetStore'
import { resolveRoutingApiKey } from '@/utils/routingApiKey'
import type { MapMode, MapProps, Point } from './Map/types'
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
import { useMapMarkers } from '@/hooks/useMapMarkers'
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

type ReactLeafletNS = typeof import('react-leaflet')

const ORS_API_KEY = resolveRoutingApiKey()
const IS_WEB = Platform.OS === 'web'
const COMPACT_POPUP_MAX_WIDTH = 560
const FLOATING_CONTROLS_MAX_WIDTH = 767
const DEFAULT_ZOOM = 11
const DEFAULT_MAX_ZOOM = 18
const MARKER_ZOOM_TARGET = 14
const MARKER_REOPEN_TIMEOUT_MS = 500
const FALLBACK_COORDINATES = { latitude: 53.8828449, longitude: 27.7273595 }
const MINSK_FALLBACK_POINTS: Array<[number, number]> = [
  [53.9006, 27.559],
  [53.8828449, 27.7273595],
]
const MINSK_TOLERANCE = 0.02

type Props = MapProps

function isFallbackMinskCenter(lat: number, lng: number) {
  return MINSK_FALLBACK_POINTS.some(
    ([fLat, fLng]) => Math.abs(lat - fLat) < MINSK_TOLERANCE && Math.abs(lng - fLng) < MINSK_TOLERANCE,
  )
}

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

function getEffectiveWidth(mapPaneWidth: number): number | null {
  const viewport = getViewportWidth()
  if (mapPaneWidth > 0 && viewport !== null) return Math.min(mapPaneWidth, viewport)
  if (mapPaneWidth > 0) return mapPaneWidth
  return viewport
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
  bottomSheetState: 'collapsed' | 'quarter' | 'half' | 'full'
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
    onUserLocationChange,
    hideFloatingControls = false,
  } = props

  const { L, RL: rl, loading: leafletLoading, error: leafletError, ready: leafletReady } =
    useLeafletLoader({
      enabled: IS_WEB,
      useIdleCallback: false,
      fallbackDelay: 0,
    })

  const [showInitialLoader, setShowInitialLoader] = useState(!IS_WEB)
  const [errors, setErrors] = useState<any>({ routing: false })
  const [disableFitBounds] = useState(false)
  const [mapZoom, setMapZoom] = useState<number>(DEFAULT_ZOOM)
  const [mapInstance, setMapInstance] = useState<any>(null)

  const markerByCoordRef = useRef<Map<string, any>>(new Map())
  const markerReopenTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wrapperRef = useRef<View | null>(null)

  const colors = useThemedColors()
  const themeContextValue = useTheme()
  const queryClient = useQueryClient()
  const styles = useMemo(() => getStyles(colors), [colors])
  const popupBottomOffset = useBottomSheetStore((s) => s.getControlsBottomOffset())
  const bottomSheetState = useBottomSheetStore((s) => s.state)
  const requestBottomSheetCollapse = useBottomSheetStore((s) => s.requestCollapse)

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

  const { centerOnUserLocation, userLocation, userLocationLatLng } = useMapUserLocation({
    coordinates,
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
    const guardRadius = hasValidCenter && hasValidRadius ? (radiusInMeters as number) * 2 : null

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

  const hintCenterForMarkers = useMemo(() => {
    if (
      mode === 'radius' &&
      userLocation &&
      isValidCoordinate(userLocation.latitude, userLocation.longitude)
    ) {
      return { lat: userLocation.latitude, lng: userLocation.longitude }
    }
    return coordinatesLatLng
  }, [coordinatesLatLng, mode, userLocation])

  const { markers, markerOpacity: travelMarkerOpacity } = useMapMarkers({
    travelData: filteredTravelData,
    mapZoom,
    mode,
    hintCenter: hintCenterForMarkers,
  })

  const handleMarkerZoom = useCallback(
    (point: Point, coords: { lat: number; lng: number }, clickedMarker?: any) => {
      const map = mapRef.current
      if (!map) return
      if (!isValidCoordinate(coords.lat, coords.lng)) return

      const currentZoom = typeof map.getZoom === 'function' ? map.getZoom() : mapZoom
      const maxZoom = typeof map.getMaxZoom === 'function' ? map.getMaxZoom() : DEFAULT_MAX_ZOOM
      const focusPlan = getMarkerFocusPlan({ currentZoom, maxZoom, bottomSheetState })

      if (focusPlan.shouldCollapseSheet) requestBottomSheetCollapse()

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
    [bottomSheetState, mapZoom, requestBottomSheetCollapse],
  )

  const handleZoomIn = useCallback(() => safeInvoke(() => mapRef.current?.zoomIn?.()), [])
  const handleZoomOut = useCallback(() => safeInvoke(() => mapRef.current?.zoomOut?.()), [])

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

  const handleMapClick = useCallback(
    (e: any) => {
      if (mode !== 'route') return
      try {
        const { lat, lng } = e.latlng
        onMapClick(lng, lat)
      } catch {
        ignoreOptionalMapRuntimeError()
      }
    },
    [mode, onMapClick],
  )

  const safeCenter = useMemo<[number, number]>(() => getSafeCenter(coordinates), [coordinates])

  const circleCenter = useMemo<[number, number] | null>(
    () => getCircleCenter(mode, userLocationLatLng, safeCenter),
    [mode, safeCenter, userLocationLatLng],
  )

  const circleCenterLatLng = useMemo(
    () => (circleCenter ? { lat: circleCenter[0], lng: circleCenter[1] } : null),
    [circleCenter],
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

  const fitBoundsPadding = useMemo(
    () =>
      mode === 'radius'
        ? {
            paddingTopLeft: [16, 80] as [number, number],
            paddingBottomRight: [16, 80] as [number, number],
          }
        : {
            paddingTopLeft: [24, 140] as [number, number],
            paddingBottomRight: [360, 220] as [number, number],
          },
    [mode],
  )

  const noPointsAlongRoute =
    mode === 'route' && Array.isArray(routePoints) && routePoints.length >= 2 && travelData.length === 0

  const canRenderMap = leafletReady && !!(L && rl)
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

  const useCompactPopupLayout = useMemo(() => {
    if (mapPaneWidth > 0) return mapPaneWidth <= COMPACT_POPUP_MAX_WIDTH
    const viewport = getViewportWidth()
    return viewport !== null && viewport <= COMPACT_POPUP_MAX_WIDTH
  }, [mapPaneWidth])

  const shouldShowFloatingMapControls = useMemo(() => {
    if (hideFloatingControls) return false
    const effective = getEffectiveWidth(mapPaneWidth)
    return effective === null ? true : effective <= FLOATING_CONTROLS_MAX_WIDTH
  }, [hideFloatingControls, mapPaneWidth])

  const { popupAutoPanPadding } = useMapPopupAutoPan({
    mapRef,
    mapPaneWidth,
    popupBottomOffset,
  })

  // Keep PopupComponent identity stable across GPS updates: read userLocation via ref
  // to avoid unmount/remount that would wipe internal popup state (fullscreen viewer, etc).
  const userLocationLatLngRef = useRef(userLocationLatLng)
  useEffect(() => {
    userLocationLatLngRef.current = userLocationLatLng
  }, [userLocationLatLng])

  const PopupComponent = useMemo(() => {
    if (!rl) return null
    return createMapPopupComponent({
      colors,
      themeContextValue,
      compactLayout: useCompactPopupLayout,
      fullscreenOnMobile: useCompactPopupLayout,
      userLocationRef: userLocationLatLngRef,
      invalidateUserPoints: () => {
        void queryClient.invalidateQueries({ queryKey: queryKeys.userPointsAll() })
      },
    })
  }, [colors, queryClient, rl, themeContextValue, useCompactPopupLayout])

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
        markers={markers}
        PopupComponent={PopupComponent}
        popupAutoPanPadding={popupAutoPanPadding}
        handleMarkerZoom={handleMarkerZoom}
        markerByCoordRef={markerByCoordRef}
        travelMarkerOpacity={travelMarkerOpacity}
      />

      {shouldShowFloatingMapControls && (
        <MapControlsReactive
          userLocation={userLocationLatLng}
          onCenterUserLocation={centerOnUserLocation}
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
