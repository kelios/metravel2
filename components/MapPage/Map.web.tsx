import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { CoordinateConverter } from '@/utils/coordinateConverter';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';
import { isValidCoordinate } from '@/utils/coordinateValidator';
import { DEFAULT_RADIUS_KM } from '@/constants/mapConfig';
import { createMapPopupComponent } from './Map/createMapPopupComponent';
import { useBottomSheetStore } from '@/stores/bottomSheetStore';
import { getRoutingConfigDiagnostics, resolveRoutingApiKey } from '@/utils/routingApiKey';
import { devWarn } from '@/utils/logger';
import type { MapMode, MapProps, Point } from './Map/types';
import { strToLatLng } from './Map/utils';

// Import modular components and hooks
import { useMapCleanup } from '@/components/MapPage/Map/useMapCleanup';
import { useLeafletIcons } from './Map/useLeafletIcons';
import { useMapInstance } from './Map/useMapInstance';
import { useMapApi } from './Map/useMapApi';
import MapControls from './Map/MapControls';
import { MapLoadingOverlay, MapWebBackground, MapWebLeafletCanvas, NoPointsMessage } from './Map/MapWebCanvas';

// New optimized hooks
import { useLeafletLoader } from '@/hooks/useLeafletLoader';
import { useMapMarkers } from '@/hooks/useMapMarkers';
import { useMapPopupAutoPan } from './Map/useMapPopupAutoPan';
import { useMapUserLocation } from './Map/useMapUserLocation';
import { useMapWebLayoutEffects } from './Map/useMapWebLayoutEffects';
import {
  buildRouteLineLatLngObjects,
  getCircleCenter,
  getHintCenterLatLng,
  getSafeCenter,
  normalizeLngLatWithHint as normalizeLngLatWithHintHelper,
} from './Map/mapWebGeometry';

type ReactLeafletNS = typeof import('react-leaflet');

const isTestEnv =
  typeof process !== 'undefined' &&
  (process as any).env &&
  (process as any).env.NODE_ENV === 'test';

const ORS_API_KEY = resolveRoutingApiKey();

type Props = MapProps;

/** Wrapper that subscribes to bottom sheet store so controls reposition reactively. */
const MapControlsReactive: React.FC<Omit<React.ComponentProps<typeof MapControls>, 'bottomOffset'>> = (props) => {
  const bottomOffset = useBottomSheetStore((s) => s.getControlsBottomOffset());
  return <MapControls {...props} bottomOffset={bottomOffset} />;
};

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
  } = props;

  // Leaflet loader (replaces manual loading logic)
  const { L, RL: rl, loading: leafletLoading, error: leafletError, ready: leafletReady } = useLeafletLoader({
    enabled: Platform.OS === 'web',
    // Map page is a primary surface: load Leaflet immediately for snappier UX.
    useIdleCallback: false,
    fallbackDelay: 0,
  });

  // State
  const [showInitialLoader, setShowInitialLoader] = useState(Platform.OS !== 'web');
  const [errors, setErrors] = useState<any>({ routing: false });
  const [disableFitBounds, _setDisableFitBounds] = useState(false);
  const [expandedCluster, setExpandedCluster] = useState<{ key: string; items: Point[] } | null>(null);
  const [mapZoom, setMapZoom] = useState<number>(11);
  const [mapInstance, setMapInstance] = useState<any>(null);

  const markerByCoordRef = useRef<Map<string, any>>(new Map());
  const wrapperRef = useRef<View | null>(null);

  const colors = useThemedColors();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const popupBottomOffset = useBottomSheetStore((s) => s.getControlsBottomOffset());

  useEffect(() => {
    if (isTestEnv) return;
    const diagnostics = getRoutingConfigDiagnostics();
    for (const diagnostic of diagnostics) {
      devWarn(`[Map][Config:${diagnostic.code}] ${diagnostic.message}`);
    }
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const timeout = setTimeout(() => {
      setShowInitialLoader(false);
    }, 0);
    return () => {
      clearTimeout(timeout);
    };
  }, []);
  const mapContainerStyle = useMemo(() => {
    const base = StyleSheet.flatten(styles.map as any) as any;
    if (Platform.OS !== 'web') return base;
    return { ...(base || {}), position: 'relative', zIndex: 1 };
  }, [styles.map]);

  const safeCoordinates = useMemo(() => {
    const fallback = { latitude: 53.8828449, longitude: 27.7273595 };
    const source = coordinates && typeof coordinates === 'object' ? coordinates : fallback;
    const zoomValue = (source as any)?.zoom;
    const latCandidate = Number((source as any)?.latitude);
    const lngCandidate = Number((source as any)?.longitude);
    const hasValidLatLng = isValidCoordinate(latCandidate, lngCandidate);

    return {
      latitude: hasValidLatLng ? latCandidate : fallback.latitude,
      longitude: hasValidLatLng ? lngCandidate : fallback.longitude,
      zoom: Number.isFinite(zoomValue) ? zoomValue : 11,
    };
  }, [coordinates]);


  // Refs
  const mapRef = useRef<any>(null);
  const hasInitializedRef = useRef(false);
  const lastModeRef = useRef<MapMode | null>(null);
  const savedMapViewRef = useRef<{ center: [number, number]; zoom: number } | null>(null);
  const lastAutoFitKeyRef = useRef<string | null>(null);

  const { mapInstanceKeyRef, mapContainerIdRef } = useMapCleanup();

  // Defensive cleanup: if the component unmounts (route change / error boundary),
  // clear the ref. Do NOT call map.remove() — react-leaflet's MapContainer handles
  // its own cleanup via its unmount effect, and our leafletFix.ts patch makes that safe.
  useEffect(() => {
    return () => {
      mapRef.current = null;
    };
  }, []);

  // Travel data
  const travelData = useMemo(
    () => (Array.isArray(travel?.data) ? travel.data : []),
    [travel?.data]
  );

  // Convert coordinates to LatLng format for hooks (with safety checks)
  const coordinatesLatLng = useMemo(() => ({
    lat: safeCoordinates.latitude,
    lng: safeCoordinates.longitude,
  }), [safeCoordinates.latitude, safeCoordinates.longitude]);

  // Radius calculation
  const radiusInMeters = useMemo(() => {
    if (mode !== 'radius') return null;
    const radiusValue = radius || String(DEFAULT_RADIUS_KM);
    const radiusKm = parseInt(radiusValue, 10);
    if (isNaN(radiusKm) || radiusKm <= 0) return DEFAULT_RADIUS_KM * 1000;
    return radiusKm * 1000;
  }, [mode, radius]);

  const { centerOnUserLocation, userLocation, userLocationLatLng } = useMapUserLocation({
    L,
    rl,
    coordinates,
    mapContainerId: mapContainerIdRef.current,
    mapRef,
    onUserLocationChange,
    isFallbackMinskCenter: useCallback((lat: number, lng: number) => {
      const fallbackCandidates: Array<[number, number]> = [
        [53.9006, 27.559],
        [53.8828449, 27.7273595],
      ];
      return fallbackCandidates.some(([fLat, fLng]) => (
        Math.abs(lat - fLat) < 0.02 && Math.abs(lng - fLng) < 0.02
      ));
    }, []),
  });

  const filteredTravelData = useMemo(() => {
    if (mode !== 'radius') return travelData;

    const center = userLocationLatLng ?? coordinatesLatLng;
    if (!CoordinateConverter.isValid(center)) return travelData;
    if (!Number.isFinite(radiusInMeters as any) || !radiusInMeters || radiusInMeters <= 0) return travelData;

    const r = Number(radiusInMeters);

    return (travelData || []).filter((p) => {
      try {
        const ll = strToLatLng(String((p as any)?.coord ?? ''), center);
        if (!ll) return false;
        const coords = { lat: ll[1], lng: ll[0] };
        if (!CoordinateConverter.isValid(coords)) return false;
        const d = CoordinateConverter.distance(center, coords);
        // small tolerance for rounding / parsing differences
        return Number.isFinite(d) && d <= r * 1.03;
      } catch {
        return false;
      }
    });
  }, [coordinatesLatLng, mode, radiusInMeters, travelData, userLocationLatLng]);

  const hintCenterForMarkers = useMemo(() => {
    if (mode === 'radius' && userLocation && isValidCoordinate(userLocation.latitude, userLocation.longitude)) {
      return { lat: userLocation.latitude, lng: userLocation.longitude };
    }
    return coordinatesLatLng;
  }, [coordinatesLatLng, mode, userLocation]);

  // Use new markers hook
  const {
    shouldRenderClusters,
    clusters,
    markers,
    markerOpacity: travelMarkerOpacity,
  } = useMapMarkers({
    travelData: filteredTravelData,
    mapZoom,
    expandedClusterKey: expandedCluster?.key,
    mode,
    hintCenter: hintCenterForMarkers,
  });

  // OSM tile preconnect for better performance
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (!leafletReady) return;
    if (typeof document === 'undefined') return;

    const ENABLE_OSM_TILE_PRELOAD = false;

    try {
      const zoomCandidate = Number.isFinite(safeCoordinates.zoom)
        ? Number(safeCoordinates.zoom)
        : 11;
      const zoom = Math.min(19, Math.max(0, Math.round(zoomCandidate)));
      const lat = Number(safeCoordinates.latitude);
      const lng = Number(safeCoordinates.longitude);
      if (!Number.isFinite(zoom) || !Number.isFinite(lat) || !Number.isFinite(lng)) return;

      const ensurePreconnect = (origin: string) => {
        if (document.querySelector(`link[rel="preconnect"][href="${origin}"]`)) return;
        const link = document.createElement('link');
        link.rel = 'preconnect';
        link.href = origin;
        link.crossOrigin = 'anonymous';
        document.head.appendChild(link);
      };

      const ensurePreload = (href: string) => {
        if (!ENABLE_OSM_TILE_PRELOAD) return;
        if (document.querySelector(`link[rel="preload"][as="image"][href="${href}"]`)) return;
        const link = document.createElement('link');
        link.rel = 'preload';
        link.as = 'image';
        link.href = href;
        try {
          (link as any).fetchPriority = 'high';
          link.setAttribute('fetchPriority', 'high');
        } catch {
          // noop
        }
        document.head.appendChild(link);
      };

      ensurePreconnect('https://a.tile.openstreetmap.org');
      ensurePreconnect('https://b.tile.openstreetmap.org');
      ensurePreconnect('https://c.tile.openstreetmap.org');

      if (!ENABLE_OSM_TILE_PRELOAD) return;

      const n = Math.pow(2, zoom);
      const xRaw = Math.floor(((lng + 180) / 360) * n);
      const latRad = (lat * Math.PI) / 180;
      const yRaw = Math.floor(
        ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n
      );

      const x = Math.min(n - 1, Math.max(0, xRaw));
      const y = Math.min(n - 1, Math.max(0, yRaw));

      const origins = [
        'https://a.tile.openstreetmap.org',
        'https://b.tile.openstreetmap.org',
        'https://c.tile.openstreetmap.org',
      ];

      const tileCoords: Array<[number, number]> = [
        [x, y],
        [Math.min(n - 1, x + 1), y],
        [x, Math.min(n - 1, y + 1)],
        [Math.min(n - 1, x + 1), Math.min(n - 1, y + 1)],
      ];

      tileCoords.forEach(([tx, ty], index) => {
        const origin = origins[index % origins.length];
        ensurePreload(`${origin}/${zoom}/${tx}/${ty}.png`);
      });
    } catch {
      // noop
    }
  }, [safeCoordinates.latitude, safeCoordinates.longitude, safeCoordinates.zoom, leafletReady]);

  const canRenderTravelPoints = useMemo(() => {
    return true;
  }, []);

  const handleMarkerZoom = useCallback((_point: Point, coords: { lat: number; lng: number }) => {
    if (!mapRef.current) return;
    if (!isValidCoordinate(coords.lat, coords.lng)) return;
    const map = mapRef.current;
    const currentZoom = typeof map.getZoom === 'function' ? map.getZoom() : mapZoom;
    if (Number.isFinite(currentZoom) && currentZoom >= 14) return;
    const maxZoom = typeof map.getMaxZoom === 'function' ? map.getMaxZoom() : 18;
    const targetZoom = Math.min(Math.max(currentZoom + 2, 14), maxZoom || 18);
    try {
      if (typeof map.flyTo === 'function') {
        map.flyTo([coords.lat, coords.lng], targetZoom, { animate: true, duration: 0.35 } as any);
      } else if (typeof map.setView === 'function') {
        map.setView([coords.lat, coords.lng], targetZoom, { animate: true } as any);
      }
    } catch {
      // noop
    }
  }, [mapZoom]);

  useEffect(() => {
    if (!errors?.routing) return;
    // Avoid spamming the console for expected/temporary states (rate-limit, aborts).
    const msg = typeof errors.routing === 'string' ? errors.routing : String(errors.routing);
    const normalized = msg.trim();
    if (!normalized) return;
    if (normalized.toLowerCase().includes('signal is aborted')) return;

    const shouldWarn = normalized.includes('Слишком много запросов');
    try {
      if (shouldWarn) console.warn('[Map] Routing:', normalized);
      else console.error('[Map] Routing error:', normalized);
    } catch {
      // noop
    }
  }, [errors?.routing]);

  // Custom hooks
  const customIcons = useLeafletIcons(L);
  const { leafletBaseLayerRef, leafletOverlayLayersRef, leafletControlRef } = useMapInstance({
    map: mapInstance,
    L,
  });

  // Expose marker index for MapUiApi.openPopupForCoord
  try {
    (leafletControlRef as any).markerByCoord = markerByCoordRef.current;
  } catch {
    // noop
  }

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
  });

  // Handle map click
  const handleMapClick = useCallback(
    (e: any) => {
      if (mode !== 'route') return;
      try {
        const { lat, lng } = e.latlng;
        onMapClick(lng, lat);
      } catch {
        // noop
      }
    },
    [mode, onMapClick]
  );

  // Safe center calculation with strict validation
  const safeCenter = useMemo<[number, number]>(() => getSafeCenter(coordinates), [coordinates]);

  const circleCenter = useMemo<[number, number] | null>(
    () => getCircleCenter(mode, userLocationLatLng, safeCenter),
    [mode, safeCenter, userLocationLatLng]
  );

  const circleCenterLatLng = useMemo(
    () => (circleCenter ? { lat: circleCenter[0], lng: circleCenter[1] } : null),
    [circleCenter]
  );

  const hintCenterLatLng = useMemo(
    () => getHintCenterLatLng(mode, circleCenterLatLng, coordinatesLatLng),
    [mode, circleCenterLatLng, coordinatesLatLng]
  );

  const normalizeLngLatWithHint = useCallback(
    (tuple: [number, number]): [number, number] => {
      return normalizeLngLatWithHintHelper(tuple, hintCenterLatLng);
    },
    [hintCenterLatLng]
  );

  const routePointsForRouting = useMemo(() => {
    if (!Array.isArray(routePoints) || routePoints.length === 0) return [] as [number, number][];

    return routePoints.map((p) => normalizeLngLatWithHint(p));
  }, [normalizeLngLatWithHint, routePoints]);

  const hasWarnedInvalidCircleRef = useRef(false);
  useEffect(() => {
    if (hasWarnedInvalidCircleRef.current) return;
    if (mode !== 'radius') return;
    if (circleCenter) return;

    hasWarnedInvalidCircleRef.current = true;
    console.warn('[Map] Skipping radius circle due to invalid center:', {
      rawCoordinates: coordinates,
      safeCenter,
      radius,
    });
  }, [circleCenter, coordinates, mode, radius, safeCenter]);

  // Popup component
  const PopupComponent = useMemo(() => {
    if (!rl) return null;
    return createMapPopupComponent({ useMap: rl.useMap, userLocation: userLocationLatLng });
  }, [rl, userLocationLatLng]);

  const fitBoundsPadding = useMemo(() => {
    // Route mode: keep room for the right-side panel so fitBounds doesn't place markers behind it.
    // Radius mode: the panel is outside the map container, so large right padding over-zooms out.
    if (mode === 'radius') {
      return {
        paddingTopLeft: [16, 80] as [number, number],
        paddingBottomRight: [16, 80] as [number, number],
      };
    }
    return {
      paddingTopLeft: [24, 140] as [number, number],
      paddingBottomRight: [360, 220] as [number, number],
    };
  }, [mode]);

  const noPointsAlongRoute = useMemo(() => {
    if (mode !== 'route') return false;
    if (!Array.isArray(routePoints) || routePoints.length < 2) return false;
    return travelData.length === 0;
  }, [mode, routePoints, travelData.length]);

  const canRenderMap = leafletReady && !!(L && rl);
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
  });
  const { popupAutoPanPadding } = useMapPopupAutoPan({
    mapRef,
    mapPaneWidth,
    popupBottomOffset,
  });

  const shouldShowLoadingOverlay = Platform.OS === 'web'
    ? !!leafletError || !canRenderMap
    : showInitialLoader || leafletLoading || !!leafletError || !canRenderMap;

  const rlSafe = (rl ?? {}) as ReactLeafletNS;
  const { useMap, useMapEvents } = rlSafe;

  const hasValidReactLeafletHooks = !!(
    useMap && 
    typeof useMap === 'function' && 
    useMapEvents && 
    typeof useMapEvents === 'function'
  );

  const routeLineLatLngObjects = useMemo(
    () => buildRouteLineLatLngObjects(mode, fullRouteCoords, routePointsForRouting, hintCenterLatLng),
    [fullRouteCoords, hintCenterLatLng, mode, routePointsForRouting]
  );

  return (
    <View ref={wrapperRef} style={styles.wrapper} testID="map-leaflet-wrapper">
      <MapWebBackground opacity={0.18} />

      {shouldShowLoadingOverlay ? <MapLoadingOverlay colors={colors} styles={styles} /> : null}
      {noPointsAlongRoute ? <NoPointsMessage /> : null}

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
        safeZoom={Number.isFinite(safeCoordinates.zoom) ? Number(safeCoordinates.zoom) : 11}
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
        canRenderTravelPoints={canRenderTravelPoints}
        markers={markers}
        shouldRenderClusters={shouldRenderClusters}
        PopupComponent={PopupComponent}
        popupAutoPanPadding={popupAutoPanPadding}
        handleMarkerZoom={handleMarkerZoom}
        markerByCoordRef={markerByCoordRef}
        clusters={clusters}
        expandedCluster={expandedCluster}
        setExpandedCluster={setExpandedCluster}
        travelMarkerOpacity={travelMarkerOpacity}
      />

      {/* Map controls */}
      <MapControlsReactive
        userLocation={userLocationLatLng}
        onCenterUserLocation={centerOnUserLocation}
        alignLeft={true}
      />
    </View>
  );
};

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
  });

export default React.memo(MapPageComponent);
