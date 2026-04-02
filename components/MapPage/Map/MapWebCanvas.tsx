import React, { useMemo } from 'react'
import { ActivityIndicator, Platform, Text, View, useWindowDimensions } from 'react-native'

import { DESIGN_TOKENS } from '@/constants/designSystem'

import MapRoute from './MapRoute'
import RoutingMachine from '../RoutingMachine'
import type { Point } from './types'
import { MapLayers } from './MapLayers'
import { MapLogicComponent } from './MapLogicComponent'
import MapMarkers from './MapMarkers'
import ClusterLayer from './ClusterLayer'
import { RouteMarkersLayer } from './RouteMarkersLayer'

type ReactLeafletNS = typeof import('react-leaflet')

const createMapSkeletonDataUrl = (opacity: number) =>
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900" viewBox="0 0 1200 900">' +
      '<defs>' +
        '<linearGradient id="g" x1="0" y1="0" x2="1" y2="0">' +
          `<stop offset="0" stop-color="rgba(0,0,0,${opacity})" />` +
          `<stop offset="0.5" stop-color="rgba(0,0,0,${opacity + 0.06})" />` +
          `<stop offset="1" stop-color="rgba(0,0,0,${opacity})" />` +
        '</linearGradient>' +
      '</defs>' +
      '<rect width="1200" height="900" rx="24" fill="url(%23g)" />' +
    '</svg>'
  )

const MapRouteViaUseMap: React.FC<{
  useMapHook: () => any
  leaflet: any
  routeCoordinates: Array<{ lat: number; lng: number }>
}> = ({ useMapHook, leaflet, routeCoordinates }) => {
  const map = useMapHook?.()
  if (!map || !leaflet) return null
  return (
    <MapRoute
      map={map}
      leaflet={leaflet}
      routeCoordinates={routeCoordinates as any}
      isOptimal
      disableFitBounds
    />
  )
}

export const MapWebBackground: React.FC<{ opacity: number }> = ({ opacity }) => {
  if (Platform.OS !== 'web') return null
  return (
    <img
      alt=""
      aria-hidden="true"
      width={1200}
      height={900}
      loading="eager"
      decoding="async"
      src={createMapSkeletonDataUrl(opacity)}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        opacity: 1,
        pointerEvents: 'none',
        zIndex: 0,
      }}
    />
  )
}

export const MapLoadingOverlay: React.FC<{
  colors: any
  styles: any
}> = ({ colors, styles }) => (
  <View
    testID="map-loading-overlay"
    style={{
      position: 'absolute',
      inset: 0,
      zIndex: 10,
      ...(Platform.OS === 'web' ? ({ pointerEvents: 'none' } as any) : null),
    } as any}
  >
    <View style={[styles.loader, { position: 'relative', overflow: 'hidden' }] as any}>
      <MapWebBackground opacity={0.12} />
      <View style={{ position: 'relative', zIndex: 1, alignItems: 'center' }}>
        <ActivityIndicator size="large" color={colors.primary} accessibilityLabel="Загрузка карты" />
      </View>
    </View>
  </View>
)

export const NoPointsMessage: React.FC = () => (
  <View
    testID="no-points-message"
    style={{ width: 0, height: 0, overflow: 'hidden' }}
    accessible
    accessibilityRole="text"
  >
    <Text>Маршрут построен. Вдоль маршрута нет доступных точек в радиусе 2 км.</Text>
  </View>
)

export const getClusterZoomFitBoundsOptions = (viewport: { width?: number; height?: number }) => {
  const width = Number.isFinite(viewport.width) ? Number(viewport.width) : 1024
  const height = Number.isFinite(viewport.height) ? Number(viewport.height) : 768
  const isNarrow = width <= 640
  const isVeryShort = height <= 720

  if (!isNarrow) {
    return {
      animate: true,
      paddingTopLeft: [30, 34] as [number, number],
      paddingBottomRight: [30, 34] as [number, number],
      maxZoom: 16,
    }
  }

  return {
    animate: true,
    paddingTopLeft: [16, 104] as [number, number],
    paddingBottomRight: [16, isVeryShort ? 188 : 224] as [number, number],
    maxZoom: 15,
  }
}

type MapWebLeafletCanvasProps = {
  rl: ReactLeafletNS
  L: any
  colors: any
  mode: any
  canRenderMap: boolean
  hasValidReactLeafletHooks: boolean
  mapContainerStyle: any
  mapContainerId: string
  safeCenter: [number, number]
  safeZoom: number
  mapInstanceKey: string
  circleCenterLatLng: { lat: number; lng: number } | null
  radiusInMeters: number | null
  userLocationLatLng: { lat: number; lng: number } | null
  customIcons: any
  mapInstance: any
  handleMapClick: (e: any) => void
  coordinatesLatLng: { lat: number; lng: number }
  disableFitBounds: boolean
  travelData: Point[]
  fitBoundsPadding: { paddingTopLeft: [number, number]; paddingBottomRight: [number, number] }
  setMapZoom: (zoom: number) => void
  mapRef: any
  setMapInstance: (map: any) => void
  savedMapViewRef: any
  hasInitializedRef: any
  lastModeRef: any
  lastAutoFitKeyRef: any
  leafletBaseLayerRef: any
  leafletOverlayLayersRef: any
  leafletControlRef: any
  hintCenterLatLng: { lat: number; lng: number }
  routeLineLatLngObjects: Array<{ lat: number; lng: number }>
  routePoints: any
  routePointsForRouting: [number, number][]
  transportMode: any
  setRoutingLoading?: (loading: boolean) => void
  setErrors: (next: any) => void
  setRoutingError?: (value: string | null) => void
  setRouteDistance: (distance: number) => void
  setRouteDuration?: (durationSeconds: number) => void
  setFullRouteCoords: (coords: [number, number][]) => void
  setRouteElevationStats?: (gainMeters: number | null, lossMeters: number | null) => void
  orsApiKey: string | undefined
  markers: Point[]
  shouldRenderClusters: boolean
  PopupComponent: any
  popupAutoPanPadding: any
  handleMarkerZoom: (_point: Point, coords: { lat: number; lng: number }) => void
  markerByCoordRef: React.MutableRefObject<Map<string, any>>
  clusters: any
  expandedCluster: { key: string; items: Point[] } | null
  setExpandedCluster: (value: { key: string; items: Point[] } | null) => void
  travelMarkerOpacity: number
}

export const MapWebLeafletCanvas: React.FC<MapWebLeafletCanvasProps> = ({
  rl,
  L,
  colors,
  mode,
  canRenderMap,
  hasValidReactLeafletHooks,
  mapContainerStyle,
  mapContainerId,
  safeCenter,
  safeZoom,
  mapInstanceKey,
  circleCenterLatLng,
  radiusInMeters,
  userLocationLatLng,
  customIcons,
  mapInstance,
  handleMapClick,
  coordinatesLatLng,
  disableFitBounds,
  travelData,
  fitBoundsPadding,
  setMapZoom,
  mapRef,
  setMapInstance,
  savedMapViewRef,
  hasInitializedRef,
  lastModeRef,
  lastAutoFitKeyRef,
  leafletBaseLayerRef,
  leafletOverlayLayersRef,
  leafletControlRef,
  hintCenterLatLng,
  routeLineLatLngObjects,
  routePoints,
  routePointsForRouting,
  transportMode,
  setRoutingLoading,
  setErrors,
  setRoutingError,
  setRouteDistance,
  setRouteDuration,
  setFullRouteCoords,
  setRouteElevationStats,
  orsApiKey,
  markers,
  shouldRenderClusters,
  PopupComponent,
  popupAutoPanPadding,
  handleMarkerZoom,
  markerByCoordRef,
  clusters,
  expandedCluster,
  setExpandedCluster,
  travelMarkerOpacity,
}) => {
  const { width: viewportWidth, height: viewportHeight } = useWindowDimensions()
  const clusterZoomFitBoundsOptions = useMemo(
    () => getClusterZoomFitBoundsOptions({ width: viewportWidth, height: viewportHeight }),
    [viewportWidth, viewportHeight]
  )

  if (!canRenderMap || !hasValidReactLeafletHooks) return null

  const { MapContainer, Marker, Popup, Tooltip, Circle, TileLayer, useMap, useMapEvents } = rl
  const Polyline = (rl as any)?.Polyline as any
  const Pane = (rl as any)?.Pane as any

  return (
    <MapContainer
      style={mapContainerStyle}
      data-testid="map-leaflet-container"
      id={mapContainerId}
      center={safeCenter}
      zoom={safeZoom}
      key={mapInstanceKey}
      zoomControl={false}
      preferCanvas={false}
      tap
      tapTolerance={30}
    >
      {typeof Pane === 'function' ? (
        <Pane name="metravelRoutePane" style={{ zIndex: 590, pointerEvents: 'none' } as any} />
      ) : null}

      <MapLayers
        TileLayer={TileLayer}
        Circle={Circle}
        Marker={Marker}
        Popup={Popup}
        mode={mode}
        circleCenter={circleCenterLatLng}
        radiusInMeters={radiusInMeters}
        userLocation={userLocationLatLng}
        userLocationIcon={customIcons?.userLocation}
        mapInstance={mapInstance}
      />

      <MapLogicComponent
        mapClickHandler={handleMapClick}
        mode={mode}
        coordinates={coordinatesLatLng}
        userLocation={userLocationLatLng}
        disableFitBounds={disableFitBounds}
        L={L}
        travelData={travelData}
        circleCenter={circleCenterLatLng}
        radiusInMeters={radiusInMeters}
        fitBoundsPadding={fitBoundsPadding}
        setMapZoom={setMapZoom}
        mapRef={mapRef}
        onMapReady={setMapInstance}
        savedMapViewRef={savedMapViewRef}
        hasInitializedRef={hasInitializedRef}
        lastModeRef={lastModeRef}
        lastAutoFitKeyRef={lastAutoFitKeyRef}
        leafletBaseLayerRef={leafletBaseLayerRef}
        leafletOverlayLayersRef={leafletOverlayLayersRef}
        leafletControlRef={leafletControlRef}
        useMap={useMap}
        useMapEvents={useMapEvents}
        hintCenter={hintCenterLatLng}
      />

      {mode === 'route' &&
        Array.isArray(routeLineLatLngObjects) &&
        routeLineLatLngObjects.length >= 2 &&
        (typeof useMap === 'function' && L ? (
          <MapRouteViaUseMap
            useMapHook={useMap as any}
            leaflet={L}
            routeCoordinates={routeLineLatLngObjects}
          />
        ) : typeof Polyline === 'function' ? (
          <Polyline
            positions={routeLineLatLngObjects as any}
            pane="metravelRoutePane"
            pathOptions={{
              color: (colors as any).primary || DESIGN_TOKENS.colors.primary,
              weight: 6,
              opacity: 1,
              lineJoin: 'round',
              lineCap: 'round',
              interactive: false,
              className: 'metravel-route-line',
            }}
          />
        ) : null)}

      <RouteMarkersLayer
        Marker={Marker}
        Popup={Popup}
        Tooltip={Tooltip}
        routePoints={routePoints}
        icons={{
          start: customIcons?.start,
          end: customIcons?.end,
        }}
      />

      {mode === 'route' &&
      routePointsForRouting.length >= 2 &&
      routePointsForRouting.every((p) => Number.isFinite(p[0]) && Number.isFinite(p[1])) ? (
        <RoutingMachine
          routePoints={routePointsForRouting}
          transportMode={transportMode}
          setRoutingLoading={(loading) => {
            try {
              setRoutingLoading?.(loading)
            } catch {
              // noop
            }
          }}
          setErrors={(next) => {
            try {
              setErrors(next)
            } catch {
              // noop
            }
            const routingMsg = (next as any)?.routing
            if (typeof routingMsg === 'string' && routingMsg.trim()) {
              try {
                setRoutingError?.(routingMsg)
              } catch {
                // noop
              }
            } else {
              try {
                setRoutingError?.(null)
              } catch {
                // noop
              }
            }
          }}
          setRouteDistance={setRouteDistance}
          setRouteDuration={setRouteDuration}
          setFullRouteCoords={setFullRouteCoords}
          setRouteElevationStats={setRouteElevationStats}
          ORS_API_KEY={orsApiKey}
        />
      ) : null}

      {canRenderMap &&
      customIcons?.meTravel &&
      markers.length > 0 &&
      !shouldRenderClusters &&
      PopupComponent ? (
        <MapMarkers
          points={markers}
          icon={customIcons.meTravel}
          Marker={Marker}
          Popup={Popup}
          Tooltip={Tooltip}
          PopupContent={PopupComponent}
          popupProps={popupAutoPanPadding}
          onMarkerClick={handleMarkerZoom}
          hintCenter={hintCenterLatLng}
          onMarkerInstance={(coord, marker) => {
            markerByCoordRef.current.set(coord, marker)
          }}
        />
      ) : null}

      {canRenderMap &&
      customIcons?.meTravel &&
      markers.length > 0 &&
      shouldRenderClusters &&
      PopupComponent ? (
        <ClusterLayer
          L={L}
          clusters={clusters as any}
          Marker={Marker}
          Popup={Popup}
          Tooltip={Tooltip}
          PopupContent={PopupComponent}
          popupProps={popupAutoPanPadding}
          markerIcon={customIcons.meTravel}
          markerOpacity={travelMarkerOpacity}
          expandedClusterKey={expandedCluster?.key}
          expandedClusterItems={expandedCluster?.items}
          hintCenter={hintCenterLatLng}
          onClusterZoom={({ center: _center, bounds, key, items }) => {
            setExpandedCluster({ key, items })
            try {
              mapRef.current?.fitBounds?.(bounds as any, clusterZoomFitBoundsOptions as any)
            } catch {
              // noop
            }
          }}
          onMarkerClick={handleMarkerZoom}
          onMarkerInstance={(coord, marker) => {
            markerByCoordRef.current.set(coord, marker)
          }}
        />
      ) : null}
    </MapContainer>
  )
}
