import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';
import * as Location from 'expo-location';
import { ensureLeafletAndReactLeaflet } from '@/src/utils/leafletWebLoader';
import RoutingMachine from './RoutingMachine';
import { CoordinateConverter } from '@/utils/coordinateConverter';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';
import { isValidCoordinate } from '@/utils/coordinateValidator';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { createMapPopupComponent } from './Map/createMapPopupComponent';
import type { Coordinates, MapMode, MapProps, Point } from './Map/types';

// Import modular components and hooks
import { useMapCleanup } from '@/components/MapPage/Map/useMapCleanup';
import { useLeafletIcons } from './Map/useLeafletIcons';
import { useMapInstance } from './Map/useMapInstance';
import { useMapApi } from './Map/useMapApi';
import { useClustering } from './Map/useClustering';
import { MapLogicComponent } from './Map/MapLogicComponent';
import MapMarkers from './Map/MapMarkers';
import ClusterLayer from './Map/ClusterLayer';
import MapControls from './Map/MapControls';

type ReactLeafletNS = typeof import('react-leaflet');

const isTestEnv =
  typeof process !== 'undefined' &&
  (process as any).env &&
  (process as any).env.NODE_ENV === 'test';

const ORS_API_KEY = process.env.EXPO_PUBLIC_ORS_API_KEY || undefined;

type Props = MapProps;

const MapPageComponent: React.FC<Props> = (props) => {
  const {
    travel = { data: [] },
    coordinates,
    routePoints,
    onMapClick,
    mode,
    transportMode,
    setRouteDistance,
    setFullRouteCoords,
    radius,
  } = props;

  // State
  const [L, setL] = useState<any>(null);
  const [rl, setRl] = useState<any>(null);
  const [userLocation, setUserLocation] = useState<Coordinates | null>(null);
  const [errors, setErrors] = useState({
    location: false,
    loadingModules: false,
    routing: false,
  });
  const [loading, setLoading] = useState(false);
  const [_routingLoading, setRoutingLoading] = useState(false);
  const [disableFitBounds, _setDisableFitBounds] = useState(false);
  const [expandedCluster, setExpandedCluster] = useState<{ key: string; items: Point[] } | null>(null);
  const [mapZoom, setMapZoom] = useState<number>(11);
  const [mapInstance, setMapInstance] = useState<any>(null);

  const markerByCoordRef = useRef<Map<string, any>>(new Map());

  const colors = useThemedColors();
  const styles = useMemo(() => getStyles(colors), [colors]);

  const safeCoordinates = useMemo(() => {
    const fallback = { latitude: 53.8828449, longitude: 27.7273595 };
    const source = coordinates && typeof coordinates === 'object' ? coordinates : fallback;
    const zoomValue = (source as any)?.zoom;

    return {
      latitude: Number.isFinite(source.latitude) ? source.latitude : fallback.latitude,
      longitude: Number.isFinite(source.longitude) ? source.longitude : fallback.longitude,
      zoom: Number.isFinite(zoomValue) ? zoomValue : 11,
    };
  }, [coordinates]);

  // Refs
  const mapRef = useRef<any>(null);
  const initialZoomRef = useRef<number>(
    safeCoordinates.zoom
  );
  const hasInitializedRef = useRef(false);
  const lastModeRef = useRef<MapMode | null>(null);
  const savedMapViewRef = useRef<{ center: [number, number]; zoom: number } | null>(null);
  const resizeRafRef = useRef<number | null>(null);
  const lastAutoFitKeyRef = useRef<string | null>(null);

  const { mapInstanceKeyRef, mapContainerIdRef } = useMapCleanup();

  useEffect(() => {
    if (!mapRef.current) return;
    if (mapInstance && mapInstance === mapRef.current) return;
    setMapInstance(mapRef.current);
  }, [mapInstance]);

  // Travel data
  const travelData = useMemo(
    () => (Array.isArray(travel?.data) ? travel.data : []),
    [travel?.data]
  );

  // Clustering
  const { shouldRenderClusters } = useClustering(travelData, mapZoom, expandedCluster?.key || null);

  const travelMarkerOpacity = mode === 'route' ? 0.45 : 1;

  // Radius calculation
  const radiusInMeters = useMemo(() => {
    if (mode !== 'radius') return null;
    const radiusValue = radius || '60';
    const radiusKm = parseInt(radiusValue, 10);
    if (isNaN(radiusKm) || radiusKm <= 0) return 60000;
    return radiusKm * 1000;
  }, [mode, radius]);

  // Convert coordinates to LatLng format for hooks (with safety checks)
  const coordinatesLatLng = useMemo(() => ({
    lat: safeCoordinates.latitude,
    lng: safeCoordinates.longitude,
  }), [safeCoordinates.latitude, safeCoordinates.longitude]);

  const userLocationLatLng = useMemo(() => {
    if (!userLocation) return null;
    if (!isValidCoordinate(userLocation.latitude, userLocation.longitude)) return null;
    return { lat: userLocation.latitude, lng: userLocation.longitude };
  }, [userLocation]);

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
    travelData,
    userLocation: userLocationLatLng,
    routePoints,
    leafletBaseLayerRef,
    leafletOverlayLayersRef,
    leafletControlRef,
  });

  // Load Leaflet
  useEffect(() => {
    if (Platform.OS !== 'web') return;

    let cancelled = false;
    setLoading(true);

    const load = () => {
      ensureLeafletAndReactLeaflet()
        .then(({ L: leaflet, rl: reactLeaflet }) => {
          if (cancelled) return;
          setL(leaflet);
          setRl(reactLeaflet);
          setLoading(false);
        })
        .catch((err) => {
          console.error('[Map] Failed to load Leaflet:', err);
          if (cancelled) return;
          setErrors((prev) => ({ ...prev, loadingModules: true }));
          setLoading(false);
        });
    };

    // Defer loading heavy map libraries until the browser is idle.
    // This reduces main-thread blocking and typically improves TBT/INP on mobile.
    let idleHandle: any = null;
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

    if (isTestEnv) {
      load();
    } else if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      idleHandle = (window as any).requestIdleCallback(load, { timeout: 2500 });
    } else {
      timeoutHandle = setTimeout(load, 1500);
    }

    return () => {
      cancelled = true;

      try {
        if (idleHandle && typeof window !== 'undefined' && 'cancelIdleCallback' in window) {
          (window as any).cancelIdleCallback(idleHandle);
        }
      } catch {
        // noop
      }

      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
    };
  }, []);

  // Get user location
  useEffect(() => {
    if (Platform.OS !== 'web') return;

    // Avoid requesting geolocation before the map is ready.
    // This reduces early main-thread work and prevents unnecessary permission prompts.
    if (!L || !rl) return;

    let cancelled = false;

    let idleHandle: any = null;
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

    const loadLocation = () => {
      ;(async () => {
        try {
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status !== 'granted' || cancelled) {
            setErrors((prev) => ({ ...prev, location: true }));
            return;
          }

          const location = await Location.getCurrentPositionAsync({});
          if (cancelled) return;

          const lat = location.coords.latitude;
          const lng = location.coords.longitude;
          if (isValidCoordinate(lat, lng)) {
            setUserLocation({ latitude: lat, longitude: lng });
          } else {
            setErrors((prev) => ({ ...prev, location: true }));
          }
        } catch (err) {
          console.error('[Map] Location error:', err);
          if (!cancelled) {
            setErrors((prev) => ({ ...prev, location: true }));
          }
        }
      })();
    };

    if (isTestEnv) {
      loadLocation();
    } else if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      idleHandle = (window as any).requestIdleCallback(loadLocation, { timeout: 3500 });
    } else {
      timeoutHandle = setTimeout(loadLocation, 2000);
    }

    return () => {
      cancelled = true;

      try {
        if (idleHandle && typeof window !== 'undefined' && 'cancelIdleCallback' in window) {
          (window as any).cancelIdleCallback(idleHandle);
        }
      } catch {
        // noop
      }

      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
    };
  }, [L, rl]);

  // Center user location handler
  const centerOnUserLocation = useCallback(() => {
    if (!mapRef.current || !userLocationLatLng) return;
    try {
      mapRef.current.setView(
        CoordinateConverter.toLeaflet(userLocationLatLng),
        13,
        { animate: true }
      );
    } catch {
      // noop
    }
  }, [userLocationLatLng]);

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

  // invalidateSize on resize
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const handler = () => {
      if (!mapRef.current) return;
      if (resizeRafRef.current) {
        cancelAnimationFrame(resizeRafRef.current);
      }
      resizeRafRef.current = requestAnimationFrame(() => {
        try {
          mapRef.current?.invalidateSize?.();
        } catch {
          // noop
        }
      });
    };
    window.addEventListener('resize', handler);
    return () => {
      window.removeEventListener('resize', handler);
      if (resizeRafRef.current) cancelAnimationFrame(resizeRafRef.current);
    };
  }, []);

  // Canvas renderer for performance
  const canvasRenderer = useMemo(() => {
    if (!L || typeof (L as any).canvas !== 'function') return null;
    try {
      return (L as any).canvas({ tolerance: 5 });
    } catch {
      return null;
    }
  }, [L]);

  // Routing machine component
  const RoutingMachineWithMapInner = useMemo(() => {
    if (!rl) return null;
    const { useMap } = rl;
    return function RouteInner(routeProps: any) {
      const map = useMap();
      // Don't render RoutingMachine until map is available
      if (!map) return null;
      return <RoutingMachine {...routeProps} map={map} />;
    };
  }, [rl]);

  const renderLoader = useCallback(
    (message: string) => (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text>{message}</Text>
      </View>
    ),
    [colors.primary, styles.loader]
  );

  // Safe center calculation with strict validation
  const safeCenter = useMemo<[number, number]>(() => {
    // Default coordinates (Minsk)
    const DEFAULT_LAT = 53.8828449;
    const DEFAULT_LNG = 27.7273595;

    if (!coordinates) {
      return [DEFAULT_LAT, DEFAULT_LNG];
    }

    const lat = coordinates.latitude;
    const lng = coordinates.longitude;

    // Strict validation - Number.isFinite returns false for NaN, Infinity, and non-numbers
    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      lat < -90 || lat > 90 ||
      lng < -180 || lng > 180
    ) {
      return [DEFAULT_LAT, DEFAULT_LNG];
    }

    return [lat, lng];
  }, [coordinates]);

  const circleCenter = useMemo<[number, number] | null>(() => {
    const lat = Number(safeCenter?.[0]);
    const lng = Number(safeCenter?.[1]);
    if (!isValidCoordinate(lat, lng)) return null;
    return [lat, lng];
  }, [safeCenter]);

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
    return createMapPopupComponent({ useMap: rl.useMap });
  }, [rl]);

  const noPointsAlongRoute = useMemo(() => {
    if (mode !== 'route') return false;
    if (!Array.isArray(routePoints) || routePoints.length < 2) return false;
    return travelData.length === 0;
  }, [mode, routePoints, travelData.length]);

  // Early returns
  if (loading) return renderLoader('Загрузка карты...');
  if (!L || !rl) {
    return renderLoader(errors.loadingModules ? 'Не удалось загрузить модули карты' : 'Загрузка карты...');
  }

  const rlSafe = (rl ?? {}) as ReactLeafletNS;
  const { MapContainer, Marker, Popup, Circle, useMap, useMapEvents } = rlSafe;

  return (
    <View style={styles.wrapper} testID="map-leaflet-wrapper">
      {Platform.OS === 'web' && (
        <style>
          {`
          /* Mobile: ensure Leaflet receives touch drag gestures instead of page scroll */
          .leaflet-container {
            touch-action: none;
            -ms-touch-action: none;
            overscroll-behavior: none;
          }

          html[data-theme='dark'] .leaflet-popup-content-wrapper,
          html[data-theme='dark'] .leaflet-popup-tip {
            background: ${(colors as any).surface} !important;
            opacity: 1 !important;
          }

          html[data-theme='dark'] .leaflet-popup-content-wrapper {
            color: ${(colors as any).text} !important;
            border-radius: ${DESIGN_TOKENS.radii.md}px !important;
            box-shadow: ${DESIGN_TOKENS.shadows.modal} !important;
            border: 1px solid ${(colors as any).border} !important;
          }

          html[data-theme='dark'] .leaflet-popup-content {
            margin: ${DESIGN_TOKENS.spacing.md}px !important;
            color: ${(colors as any).text} !important;
          }

          html[data-theme='dark'] .leaflet-popup-close-button {
            display: block !important;
            color: ${(colors as any).textMuted} !important;
          }

          html[data-theme='dark'] .leaflet-popup-close-button:hover {
            color: ${(colors as any).text} !important;
          }
          `}
        </style>
      )}
      {noPointsAlongRoute && (
        <View
          testID="no-points-message"
          style={{ width: 0, height: 0, overflow: 'hidden' }}
          accessible
          accessibilityRole="text"
        >
          <Text>Маршрут построен. Вдоль маршрута нет доступных точек в радиусе 2 км.</Text>
        </View>
      )}

      <MapContainer
        style={styles.map as any}
        data-testid="map-leaflet-container"
        id={mapContainerIdRef.current}
        center={safeCenter}
        zoom={initialZoomRef.current}
        key={mapInstanceKeyRef.current}
        zoomControl={false}
      >
        <MapLogicComponent
          mapClickHandler={handleMapClick}
          mode={mode}
          coordinates={coordinatesLatLng}
          userLocation={userLocationLatLng}
          disableFitBounds={disableFitBounds}
          L={L}
          travelData={travelData}
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
        />

        {/* Radius circle - with strict validation */}
        {(() => {
          // Don't render Circle until map is ready
          if (!mapInstance) return null;

          const centerLat = circleCenter?.[0];
          const centerLng = circleCenter?.[1];
          const hasValidCenter =
            centerLat != null &&
            centerLng != null &&
            Number.isFinite(centerLat) &&
            Number.isFinite(centerLng) &&
            centerLat >= -90 &&
            centerLat <= 90 &&
            centerLng >= -180 &&
            centerLng <= 180;

          const canRenderCircle =
            mode === 'radius' &&
            radiusInMeters != null &&
            Number.isFinite(radiusInMeters) &&
            radiusInMeters > 0 &&
            hasValidCenter;

          if (!canRenderCircle) return null;

          return (
            <Circle
              key={`circle-${centerLat}-${centerLng}-${radiusInMeters}`}
              center={[centerLat, centerLng]}
              radius={radiusInMeters}
              pathOptions={{
                color: colors.primary,
                fillColor: colors.primary,
                fillOpacity: 0.08,
                weight: 2,
                dashArray: '6 6',
              }}
            />
          );
        })()}

        {/* Route markers */}
        {routePoints.length >= 1 &&
         customIcons?.start &&
         Number.isFinite(routePoints[0][0]) &&
         Number.isFinite(routePoints[0][1]) &&
         isValidCoordinate(routePoints[0][1], routePoints[0][0]) && (
          <Marker
            position={[routePoints[0][1], routePoints[0][0]]}
            icon={customIcons.start}
            eventHandlers={{
              click: (e: any) => {
                e?.originalEvent?.stopPropagation?.();
              },
            }}
          >
            <Popup>Старт</Popup>
          </Marker>
        )}

        {routePoints.length === 2 &&
         customIcons?.end &&
         Number.isFinite(routePoints[1][0]) &&
         Number.isFinite(routePoints[1][1]) &&
         isValidCoordinate(routePoints[1][1], routePoints[1][0]) && (
          <Marker
            position={[routePoints[1][1], routePoints[1][0]]}
            icon={customIcons.end}
            eventHandlers={{
              click: (e: any) => {
                e?.originalEvent?.stopPropagation?.();
              },
            }}
          >
            <Popup>Финиш</Popup>
          </Marker>
        )}

        {/* Routing */}
        {mode === 'route' &&
         routePoints.length >= 2 &&
         rl &&
         RoutingMachineWithMapInner &&
         routePoints.every((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]) && isValidCoordinate(p[1], p[0])) && (
          <RoutingMachineWithMapInner
            routePoints={routePoints}
            transportMode={transportMode}
            setRoutingLoading={setRoutingLoading}
            setErrors={setErrors}
            setRouteDistance={setRouteDistance}
            setFullRouteCoords={setFullRouteCoords}
            ORS_API_KEY={ORS_API_KEY}
          />
        )}

        {/* User location marker */}
        {userLocationLatLng && customIcons?.userLocation && (
          <Marker position={[userLocationLatLng.lat, userLocationLatLng.lng]} icon={customIcons.userLocation}>
            <Popup>Ваше местоположение</Popup>
          </Marker>
        )}

        {/* Travel markers (not clustered) */}
        {customIcons?.meTravel && travelData.length > 0 && !shouldRenderClusters && PopupComponent && (
          <MapMarkers
            points={travelData}
            icon={customIcons.meTravel}
            Marker={Marker}
            Popup={Popup}
            PopupContent={PopupComponent}
            onMarkerClick={handleMarkerZoom}
            onMarkerInstance={(coord, marker) => {
              try {
                const raw = String(coord ?? '').trim();
                if (!raw) return;
                const parsed = CoordinateConverter.fromLooseString(raw);
                const key = parsed ? CoordinateConverter.toString(parsed) : raw;
                if (marker) markerByCoordRef.current.set(key, marker);
                else markerByCoordRef.current.delete(key);
              } catch {
                // noop
              }
            }}
          />
        )}

        {/* Travel markers (clustered) */}
        {customIcons?.meTravel && travelData.length > 0 && shouldRenderClusters && PopupComponent && (
          <ClusterLayer
            points={travelData}
            Marker={Marker}
            Popup={Popup}
            PopupContent={PopupComponent}
            markerIcon={customIcons.meTravel}
            markerOpacity={travelMarkerOpacity}
            grid={0.045}
            expandedClusterKey={expandedCluster?.key}
            expandedClusterItems={expandedCluster?.items}
            renderer={canvasRenderer}
            onMarkerClick={handleMarkerZoom}
            onClusterZoom={({ bounds, key, items }) => {
              if (!mapRef.current) return;
              try {
                const map = mapRef.current;
                map.closePopup();
                setExpandedCluster({ key, items });
                map.fitBounds(
                  [
                    [bounds[0][0], bounds[0][1]],
                    [bounds[1][0], bounds[1][1]],
                  ],
                  { padding: [40, 40], animate: true }
                );
              } catch {
                // noop
              }
            }}
          />
        )}
      </MapContainer>

      {/* Map controls */}
      <MapControls
        userLocation={userLocationLatLng}
        onCenterUserLocation={centerOnUserLocation}
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
