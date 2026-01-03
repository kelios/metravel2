import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';
import * as Location from 'expo-location';
import { ensureLeafletAndReactLeaflet } from '@/src/utils/leafletWebLoader';
import RoutingMachine from './RoutingMachine';
import PopupContentComponent from '@/components/MapPage/PopupContentComponent';
import { CoordinateConverter } from '@/utils/coordinateConverter';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';
import type { MapUiApi } from '@/src/types/mapUi';

// Import modular components and hooks
import { useMapCleanup } from './Map/useMapCleanup';
import { useLeafletIcons } from './Map/useLeafletIcons';
import { useMapInstance } from './Map/useMapInstance';
import { useMapApi } from './Map/useMapApi';
import { useClustering } from './Map/useClustering';
import { MapLogicComponent } from './Map/MapLogicComponent';
import MapMarkers from './Map/MapMarkers';
import ClusterLayer from './Map/ClusterLayer';
import MapControls from './Map/MapControls';

type ReactLeafletNS = typeof import('react-leaflet');

const LEAFLET_MAP_CONTAINER_ID_PREFIX = 'metravel-leaflet-map';

const ORS_API_KEY = process.env.EXPO_PUBLIC_ORS_API_KEY || undefined;

type Point = {
  id?: number;
  coord: string;
  address: string;
  travelImageThumbUrl: string;
  categoryName: string;
  articleUrl?: string;
  urlTravel?: string;
};

interface Coordinates {
  latitude: number;
  longitude: number;
}

type TransportMode = 'car' | 'bike' | 'foot';
type MapMode = 'radius' | 'route';

interface Props {
  travel?: { data?: Point[] };
  coordinates: Coordinates;
  routePoints: [number, number][];
  setRoutePoints?: (points: [number, number][]) => void;
  onMapClick: (lng: number, lat: number) => void;
  mode: MapMode;
  transportMode: TransportMode;
  setRouteDistance: (distance: number) => void;
  setFullRouteCoords: (coords: [number, number][]) => void;
  radius?: string;
  onMapUiApiReady?: (api: MapUiApi | null) => void;
}

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

  const colors = useThemedColors();
  const styles = useMemo(() => getStyles(colors), [colors]);

  // Refs
  const mapRef = useRef<any>(null);
  const initialZoomRef = useRef<number>(
    Number.isFinite((coordinates as any).zoom) ? (coordinates as any).zoom : 11
  );
  const hasInitializedRef = useRef(false);
  const lastModeRef = useRef<MapMode | null>(null);
  const savedMapViewRef = useRef<{ center: [number, number]; zoom: number } | null>(null);
  const resizeRafRef = useRef<number | null>(null);
  const lastAutoFitKeyRef = useRef<string | null>(null);
  const mapInstanceKeyRef = useRef<string>(`leaflet-map-${Math.random().toString(36).slice(2)}`);
  const mapContainerIdRef = useRef<string>(`${LEAFLET_MAP_CONTAINER_ID_PREFIX}-${Math.random().toString(36).slice(2)}`);

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
    lat: Number.isFinite(coordinates.latitude) ? coordinates.latitude : 53.8828449,
    lng: Number.isFinite(coordinates.longitude) ? coordinates.longitude : 27.7273595,
  }), [coordinates.latitude, coordinates.longitude]);

  const userLocationLatLng = useMemo(() =>
    userLocation ? { lat: userLocation.latitude, lng: userLocation.longitude } : null,
    [userLocation]
  );

  // Custom hooks
  useMapCleanup();
  const customIcons = useLeafletIcons(L);
  const { leafletBaseLayerRef, leafletOverlayLayersRef, leafletControlRef } = useMapInstance({
    map: mapInstance,
    L,
  });

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

    return () => {
      cancelled = true;
    };
  }, []);

  // Get user location
  useEffect(() => {
    if (Platform.OS !== 'web') return;

    let cancelled = false;

    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted' || cancelled) {
          setErrors((prev) => ({ ...prev, location: true }));
          return;
        }

        const location = await Location.getCurrentPositionAsync({});
        if (cancelled) return;

        setUserLocation({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
      } catch (err) {
        console.error('[Map] Location error:', err);
        if (!cancelled) {
          setErrors((prev) => ({ ...prev, location: true }));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

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

  // Popup component
  const PopupWithClose = useMemo(() => {
    if (!rl) return null;
    const { useMap } = rl;
    const Comp: React.FC<{ point: Point }> = ({ point }) => {
      const map = useMap();
      const handleClose = useCallback(() => {
        if (map) {
          map.closePopup();
        }
      }, [map]);
      // Early return if map is not yet available
      if (!map) {
        return <PopupContentComponent travel={point} onClose={() => {}} />;
      }
      return <PopupContentComponent travel={point} onClose={handleClose} />;
    };
    return Comp;
  }, [rl]);

  const noPointsAlongRoute = useMemo(() => {
    if (mode !== 'route') return false;
    if (!Array.isArray(routePoints) || routePoints.length < 2) return false;
    return travelData.length === 0;
  }, [mode, routePoints, travelData.length]);

  // Early returns
  if (loading) return renderLoader('Loading map...');
  if (!L || !rl) {
    return renderLoader(errors.loadingModules ? 'Loading map modules failed' : 'Loading map...');
  }

  const rlSafe = (rl ?? {}) as ReactLeafletNS;
  const { MapContainer, Marker, Popup, Circle, useMap, useMapEvents } = rlSafe;

  return (
    <View style={styles.wrapper}>
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

          const canRenderCircle =
            mode === 'radius' &&
            radiusInMeters != null &&
            Number.isFinite(radiusInMeters) &&
            radiusInMeters > 0 &&
            safeCenter != null &&
            Array.isArray(safeCenter) &&
            safeCenter.length === 2 &&
            Number.isFinite(safeCenter[0]) &&
            Number.isFinite(safeCenter[1]) &&
            safeCenter[0] !== 0 &&
            safeCenter[1] !== 0;

          if (!canRenderCircle) return null;

          return (
            <Circle
              key={`circle-${safeCenter[0]}-${safeCenter[1]}-${radiusInMeters}`}
              center={safeCenter}
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
         Number.isFinite(routePoints[0][1]) && (
          <Marker
            position={[routePoints[0][1], routePoints[0][0]]}
            icon={customIcons.start}
            eventHandlers={{
              click: (e: any) => {
                e?.originalEvent?.stopPropagation?.();
              },
            }}
          >
            <Popup>Start</Popup>
          </Marker>
        )}

        {routePoints.length === 2 &&
         customIcons?.end &&
         Number.isFinite(routePoints[1][0]) &&
         Number.isFinite(routePoints[1][1]) && (
          <Marker
            position={[routePoints[1][1], routePoints[1][0]]}
            icon={customIcons.end}
            eventHandlers={{
              click: (e: any) => {
                e?.originalEvent?.stopPropagation?.();
              },
            }}
          >
            <Popup>End</Popup>
          </Marker>
        )}

        {/* Routing */}
        {mode === 'route' &&
         routePoints.length >= 2 &&
         rl &&
         RoutingMachineWithMapInner &&
         routePoints.every(p => Number.isFinite(p[0]) && Number.isFinite(p[1])) && (
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
        {userLocation && customIcons?.userLocation && (
          <Marker position={[userLocation.latitude, userLocation.longitude]} icon={customIcons.userLocation}>
            <Popup>Your location</Popup>
          </Marker>
        )}

        {/* Travel markers (not clustered) */}
        {customIcons?.meTravel && travelData.length > 0 && !shouldRenderClusters && PopupWithClose && (
          <MapMarkers
            points={travelData}
            icon={customIcons.meTravel}
            Marker={Marker}
            Popup={Popup}
            PopupContent={PopupWithClose}
          />
        )}

        {/* Travel markers (clustered) */}
        {customIcons?.meTravel && travelData.length > 0 && shouldRenderClusters && PopupWithClose && (
          <ClusterLayer
            points={travelData}
            Marker={Marker}
            Popup={Popup}
            PopupContent={PopupWithClose}
            markerIcon={customIcons.meTravel}
            markerOpacity={travelMarkerOpacity}
            grid={0.045}
            expandedClusterKey={expandedCluster?.key}
            expandedClusterItems={expandedCluster?.items}
            renderer={canvasRenderer}
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

