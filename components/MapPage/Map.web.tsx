import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';

import { CoordinateConverter } from '@/utils/coordinateConverter';
import { useTheme, useThemedColors, type ThemedColors } from '@/hooks/useTheme';
import { isValidCoordinate } from '@/utils/coordinateValidator';
import { DEFAULT_RADIUS_KM } from '@/constants/mapConfig';
import { createMapPopupComponent } from './Map/createMapPopupComponent';
import { useBottomSheetStore } from '@/stores/bottomSheetStore';
import { resolveRoutingApiKey } from '@/utils/routingApiKey';
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

const ORS_API_KEY = resolveRoutingApiKey();

type Props = MapProps;

/** Wrapper that subscribes to bottom sheet store so controls reposition reactively. */
const MapControlsReactive: React.FC<Omit<React.ComponentProps<typeof MapControls>, 'bottomOffset'>> = (props) => {
  const bottomOffset = useBottomSheetStore((s) => s.getControlsBottomOffset());
  return <MapControls {...props} bottomOffset={bottomOffset} />;
};

export const getMarkerFocusPlan = ({
  currentZoom,
  maxZoom,
  bottomSheetState,
}: {
  currentZoom: number;
  maxZoom: number;
  bottomSheetState: 'collapsed' | 'quarter' | 'half' | 'full';
}) => {
  const safeCurrentZoom = Number.isFinite(currentZoom) ? currentZoom : 11;
  const safeMaxZoom = Number.isFinite(maxZoom) ? maxZoom : 18;
  const shouldCollapseSheet = bottomSheetState !== 'collapsed';
  const targetZoom = Math.min(Math.max(safeCurrentZoom + 2, 14), safeMaxZoom || 18);

  return {
    shouldCollapseSheet,
    targetZoom,
    shouldSkipZoom: safeCurrentZoom >= 14,
  };
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
  const [mapZoom, setMapZoom] = useState<number>(11);
  const [mapInstance, setMapInstance] = useState<any>(null);

  const markerByCoordRef = useRef<Map<string, any>>(new Map());
  const wrapperRef = useRef<View | null>(null);

  const colors = useThemedColors();
  const themeContextValue = useTheme();
  const queryClient = useQueryClient();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const popupBottomOffset = useBottomSheetStore((s) => s.getControlsBottomOffset());
  const bottomSheetState = useBottomSheetStore((s) => s.state);
  const requestBottomSheetCollapse = useBottomSheetStore((s) => s.requestCollapse);

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
    markers,
    markerOpacity: travelMarkerOpacity,
  } = useMapMarkers({
    travelData: filteredTravelData,
    mapZoom,
    mode,
    hintCenter: hintCenterForMarkers,
  });

  // OSM tile preconnect is handled in app/+html.tsx (injected as <link> before JS loads).
  // No runtime preconnect needed here.

  const handleMarkerZoom = useCallback((point: Point, coords: { lat: number; lng: number }) => {
    if (!mapRef.current) return;
    if (!isValidCoordinate(coords.lat, coords.lng)) return;
    const map = mapRef.current;
    const currentZoom = typeof map.getZoom === 'function' ? map.getZoom() : mapZoom;
    const maxZoom = typeof map.getMaxZoom === 'function' ? map.getMaxZoom() : 18;
    const focusPlan = getMarkerFocusPlan({
      currentZoom,
      maxZoom,
      bottomSheetState,
    });
    if (focusPlan.shouldCollapseSheet) {
      requestBottomSheetCollapse();
    }
    if (focusPlan.shouldSkipZoom) return;

    const markerKey = String(point?.coord ?? '').trim();
    const marker =
      markerByCoordRef.current.get(markerKey) ??
      markerByCoordRef.current.get(CoordinateConverter.toString(coords));

    let reopened = false;
    let reopenTimer: ReturnType<typeof setTimeout> | null = null;
    const reopenPopup = () => {
      if (reopened) return;
      reopened = true;
      if (reopenTimer) {
        clearTimeout(reopenTimer);
        reopenTimer = null;
      }
      try {
        marker?.openPopup?.();
      } catch {
        // noop
      }
    };

    if (marker && typeof map.once === 'function') {
      try {
        map.once('moveend', reopenPopup);
      } catch {
        // noop
      }
      reopenTimer = setTimeout(reopenPopup, 500);
    }

    try {
      if (typeof map.flyTo === 'function') {
        map.flyTo([coords.lat, coords.lng], focusPlan.targetZoom, { animate: true, duration: 0.35 } as any);
      } else if (typeof map.setView === 'function') {
        map.setView([coords.lat, coords.lng], focusPlan.targetZoom, { animate: true } as any);
      }
    } catch {
      // noop
    }
  }, [bottomSheetState, mapZoom, requestBottomSheetCollapse]);

  const handleZoomIn = useCallback(() => {
    const map = mapRef.current
    if (!map) return
    try {
      map.zoomIn?.()
    } catch {
      // noop
    }
  }, [])

  const handleZoomOut = useCallback(() => {
    const map = mapRef.current
    if (!map) return
    try {
      map.zoomOut?.()
    } catch {
      // noop
    }
  }, [])

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
  const useCompactPopupLayout = useMemo(() => {
    if (mapPaneWidth > 0) return mapPaneWidth <= 560;
    if (typeof window !== 'undefined') return window.innerWidth <= 560;
    return false;
  }, [mapPaneWidth]);
  const { popupAutoPanPadding } = useMapPopupAutoPan({
    mapRef,
    mapPaneWidth,
    popupBottomOffset,
  });

  // Popup component
  const PopupComponent = useMemo(() => {
    if (!rl) return null;
    return createMapPopupComponent({
      colors,
      themeContextValue,
      compactLayout: useCompactPopupLayout,
      fullscreenOnMobile: useCompactPopupLayout,
      userLocation: userLocationLatLng,
      invalidateUserPoints: () => {
        void queryClient.invalidateQueries({ queryKey: ['userPointsAll'] });
      },
    });
  }, [colors, queryClient, rl, themeContextValue, useCompactPopupLayout, userLocationLatLng]);

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
        markers={markers}
        PopupComponent={PopupComponent}
        popupAutoPanPadding={popupAutoPanPadding}
        handleMarkerZoom={handleMarkerZoom}
        markerByCoordRef={markerByCoordRef}
        travelMarkerOpacity={travelMarkerOpacity}
      />

      {/* Map controls */}
      <MapControlsReactive
        userLocation={userLocationLatLng}
        onCenterUserLocation={centerOnUserLocation}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
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

// Custom memo comparator — avoids re-renders for micro-changes in coordinates
const COORD_EPSILON = 0.0001;

export const arePropsEqual = (prevProps: Props, nextProps: Props): boolean => {
  if (
    Math.abs(prevProps.coordinates.latitude - nextProps.coordinates.latitude) > COORD_EPSILON ||
    Math.abs(prevProps.coordinates.longitude - nextProps.coordinates.longitude) > COORD_EPSILON
  ) return false;

  if (prevProps.mode !== nextProps.mode || prevProps.transportMode !== nextProps.transportMode) return false;

  const prevRP = prevProps.routePoints ?? [];
  const nextRP = nextProps.routePoints ?? [];
  if (prevRP.length !== nextRP.length) return false;
  if (!prevRP.every((p, i) => {
    const n = nextRP[i];
    return n && Math.abs(p[0] - n[0]) < COORD_EPSILON && Math.abs(p[1] - n[1]) < COORD_EPSILON;
  })) return false;

  const prevFull = prevProps.fullRouteCoords ?? [];
  const nextFull = nextProps.fullRouteCoords ?? [];
  if (prevFull.length !== nextFull.length) return false;
  if (prevFull.length > 0 && !prevFull.every((p, i) => {
    const n = nextFull[i];
    return n && Math.abs(p[0] - n[0]) < COORD_EPSILON && Math.abs(p[1] - n[1]) < COORD_EPSILON;
  })) return false;

  if (prevProps.radius !== nextProps.radius) return false;

  const prevData = prevProps.travel?.data ?? [];
  const nextData = nextProps.travel?.data ?? [];
  if (prevData.length !== nextData.length) return false;
  if (!prevData.every((p, i) => {
    const n = nextData[i];
    return n && p.id === n.id && p.coord === n.coord && p.address === n.address;
  })) return false;

  return true;
};

export default React.memo(MapPageComponent, arePropsEqual);
