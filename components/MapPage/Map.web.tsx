import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';
import * as Location from 'expo-location';

// Leaflet/react-leaflet через Metro (без CDN)
import Leaflet from 'leaflet';
import * as ReactLeaflet from 'react-leaflet';
import '@/src/utils/leafletFix';

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
  const [showInitialLoader, setShowInitialLoader] = useState(true);
  const [_routingLoading, setRoutingLoading] = useState(false);
  const [disableFitBounds, _setDisableFitBounds] = useState(false);
  const [expandedCluster, setExpandedCluster] = useState<{ key: string; items: Point[] } | null>(null);
  const [mapZoom, setMapZoom] = useState<number>(11);
  const [mapInstance, setMapInstance] = useState<any>(null);
  const [shouldLoadLeaflet, setShouldLoadLeaflet] = useState<boolean>(isTestEnv);

  const markerByCoordRef = useRef<Map<string, any>>(new Map());

  const colors = useThemedColors();
  const styles = useMemo(() => getStyles(colors), [colors]);

  useEffect(() => {
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

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (isTestEnv) return;
    if (shouldLoadLeaflet) return;

    let cancelled = false;
    let idleHandle: any = null;
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

    const enable = () => {
      if (cancelled) return;
      setShouldLoadLeaflet(true);
    };

    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      idleHandle = (window as any).requestIdleCallback(enable, { timeout: 1200 });
    } else {
      timeoutHandle = setTimeout(enable, 600);
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
      if (timeoutHandle) clearTimeout(timeoutHandle);
    };
  }, [shouldLoadLeaflet]);

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

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (!shouldLoadLeaflet) return;
    if (typeof document === 'undefined') return;

    const ENABLE_OSM_TILE_PRELOAD = false;

    try {
      const zoomCandidate = Number.isFinite(safeCoordinates.zoom)
        ? Number(safeCoordinates.zoom)
        : Number(initialZoomRef.current);
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
  }, [safeCoordinates.latitude, safeCoordinates.longitude, safeCoordinates.zoom, shouldLoadLeaflet]);

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
    if (!shouldLoadLeaflet) return;

    // Через Metro модули доступны синхронно.
    setLoading(true);
    try {
      setL(Leaflet);
      setRl(ReactLeaflet);
    } catch (err) {
      console.error('[Map] Failed to init Leaflet:', err);
      setErrors((prev) => ({ ...prev, loadingModules: true }));
    } finally {
      setLoading(false);
    }
  }, [shouldLoadLeaflet]);

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

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (!mapRef.current) return;

    const map = mapRef.current;
    const raf = requestAnimationFrame(() => {
      try {
        map.invalidateSize?.();
      } catch {
        // noop
      }

      try {
        const baseLayer = leafletBaseLayerRef.current;
        if (baseLayer && !map.hasLayer?.(baseLayer)) {
          baseLayer.addTo?.(map);
        }
      } catch {
        // noop
      }
    });

    return () => {
      cancelAnimationFrame(raf);
    };
  }, [mode, leafletBaseLayerRef]);

  // Invalidate size when the map container changes size (e.g. animated right panel).
  // window.resize is not enough on web because layout can change without a viewport resize.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    if (!mapRef.current) return;

    const map = mapRef.current;
    const containerId = mapContainerIdRef.current;

    const safeInvalidate = () => {
      try {
        map.invalidateSize?.({ animate: false } as any);
      } catch {
        // noop
      }
    };

    let rafId: number | null = null;
    const scheduleInvalidate = () => {
      if (rafId != null) {
        cancelAnimationFrame(rafId);
      }
      rafId = requestAnimationFrame(() => safeInvalidate());
    };

    // Kick a few times after mount to catch late layout (fonts, panel animations, etc.)
    const t1 = setTimeout(scheduleInvalidate, 50);
    const t2 = setTimeout(scheduleInvalidate, 250);
    const t3 = setTimeout(scheduleInvalidate, 1000);

    const el = document.getElementById(containerId);
    let ro: ResizeObserver | null = null;

    if (el && typeof (window as any).ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => scheduleInvalidate());
      try {
        ro.observe(el);
        if (el.parentElement) ro.observe(el.parentElement);
      } catch {
        // noop
      }
    }

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      try {
        ro?.disconnect();
      } catch {
        // noop
      }
      if (rafId != null) {
        cancelAnimationFrame(rafId);
      }
    };
  }, [mapContainerIdRef, mapInstance]);

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
      <View style={[styles.loader, { position: 'relative', overflow: 'hidden' }] as any}>
        {Platform.OS === 'web' && (
          <img
            alt=""
            aria-hidden="true"
            src={
              'data:image/svg+xml;utf8,' +
              encodeURIComponent(
                '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900" viewBox="0 0 1200 900">' +
                  '<defs>' +
                    '<linearGradient id="g" x1="0" y1="0" x2="1" y2="0">' +
                      '<stop offset="0" stop-color="rgba(0,0,0,0.12)" />' +
                      '<stop offset="0.5" stop-color="rgba(0,0,0,0.18)" />' +
                      '<stop offset="1" stop-color="rgba(0,0,0,0.12)" />' +
                    '</linearGradient>' +
                  '</defs>' +
                  '<rect width="1200" height="900" rx="24" fill="url(%23g)" />' +
                  '<text x="60" y="120" font-family="system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,Roboto" font-size="28" font-weight="700" fill="rgba(0,0,0,0.55)">' +
                    String(message || 'Загружаем карту…').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') +
                  '</text>' +
                '</svg>'
              )
            }
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
        )}
        <View style={{ position: 'relative', zIndex: 1, alignItems: 'center' }}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={{ color: colors.textMuted, marginTop: 12 }}>{message}</Text>
        </View>
      </View>
    ),
    [colors.primary, colors.textMuted, styles.loader]
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

  const circleCenterLatLng = useMemo(
    () => (circleCenter ? { lat: circleCenter[0], lng: circleCenter[1] } : null),
    [circleCenter]
  );

  const hintCenterLatLng = useMemo(() => {
    if (mode === 'radius' && circleCenterLatLng) return circleCenterLatLng;
    return coordinatesLatLng;
  }, [mode, circleCenterLatLng, coordinatesLatLng]);

  // Clustering (needs hint center and validated circle center)
  const { shouldRenderClusters: shouldRenderClustersBase, clusters } = useClustering(
    travelData,
    mapZoom,
    hintCenterLatLng
  );
  const shouldRenderClusters = shouldRenderClustersBase;

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

  const popupAutoPanPadding = useMemo(() => ({
    autoPan: true,
    keepInView: true,
    autoPanPaddingTopLeft: [24, 140],
    autoPanPaddingBottomRight: [360, 220],
  }), []);

  const fitBoundsPadding = useMemo(
    () => ({
      paddingTopLeft: [24, 140] as [number, number],
      paddingBottomRight: [360, 220] as [number, number],
    }),
    []
  );

  const noPointsAlongRoute = useMemo(() => {
    if (mode !== 'route') return false;
    if (!Array.isArray(routePoints) || routePoints.length < 2) return false;
    return travelData.length === 0;
  }, [mode, routePoints, travelData.length]);

  const canRenderMap = !!(L && rl);
  const shouldShowLoadingOverlay = Platform.OS === 'web'
    ? showInitialLoader || !shouldLoadLeaflet || loading || !canRenderMap
    : showInitialLoader || loading || !canRenderMap;

  const loaderMessage = errors.loadingModules
    ? 'Не удалось загрузить модули карты'
    : 'Загрузка карты...';

  const rlSafe = (rl ?? {}) as ReactLeafletNS;
  const { MapContainer, Marker, Popup, Circle, useMap, useMapEvents } = rlSafe;

  const hasValidReactLeafletHooks = !!(
    useMap && 
    typeof useMap === 'function' && 
    useMapEvents && 
    typeof useMapEvents === 'function'
  );

  return (
    <View style={styles.wrapper} testID="map-leaflet-wrapper">
      {Platform.OS === 'web' && (
        <img
          alt=""
          aria-hidden="true"
          src={
            'data:image/svg+xml;utf8,' +
            encodeURIComponent(
              '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900" viewBox="0 0 1200 900">' +
                '<defs>' +
                  '<linearGradient id="g" x1="0" y1="0" x2="1" y2="0">' +
                    '<stop offset="0" stop-color="rgba(0,0,0,0.12)" />' +
                    '<stop offset="0.5" stop-color="rgba(0,0,0,0.18)" />' +
                    '<stop offset="1" stop-color="rgba(0,0,0,0.12)" />' +
                  '</linearGradient>' +
                '</defs>' +
                '<rect width="1200" height="900" rx="24" fill="url(%23g)" />' +
                '<text x="60" y="120" font-family="system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,Roboto" font-size="28" font-weight="700" fill="rgba(0,0,0,0.55)">Загружаем карту…</text>' +
              '</svg>'
            )
          }
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            opacity: 0.18,
            pointerEvents: 'none',
            zIndex: 0,
          }}
        />
      )}

      {shouldShowLoadingOverlay && (
        <View style={{ position: 'absolute', inset: 0, zIndex: 10 } as any}>
          {renderLoader(loaderMessage)}
        </View>
      )}
      {Platform.OS === 'web' && (
        <style>
          {`
          /* Leaflet core layout: ensure panes/tiles are positioned correctly.
             Without these rules, tiles can render as "islands" even if they load successfully. */
          .leaflet-container {
            position: relative;
            overflow: hidden !important;
            outline: 0;
          }

          .leaflet-container img.leaflet-tile {
            max-width: none !important;
          }

          .leaflet-pane,
          .leaflet-map-pane,
          .leaflet-tile-pane,
          .leaflet-overlay-pane,
          .leaflet-shadow-pane,
          .leaflet-marker-pane,
          .leaflet-tooltip-pane,
          .leaflet-popup-pane {
            position: absolute !important;
            top: 0;
            left: 0;
          }

          .leaflet-tile {
            position: absolute !important;
            width: 256px;
            height: 256px;
            opacity: 0;
          }

          .leaflet-tile.leaflet-tile-loaded {
            opacity: 1;
          }

          /* Mobile: ensure Leaflet receives touch drag gestures instead of page scroll */
          .leaflet-container {
            touch-action: none;
            -ms-touch-action: none;
            overscroll-behavior: none;
          }

          .leaflet-popup-content-wrapper {
            background: ${(colors as any).surface} !important;
            border: 1px solid ${(colors as any).border} !important;
            border-radius: ${DESIGN_TOKENS.radii.lg}px !important;
            box-shadow: 0 12px 30px rgba(0, 0, 0, 0.12), 0 4px 10px rgba(0, 0, 0, 0.08) !important;
            padding: 0 !important;
            max-height: calc(100vh - 200px);
            overflow: hidden;
            -webkit-overflow-scrolling: touch;
          }

          .leaflet-popup-tip {
            background: ${(colors as any).surface} !important;
            border: 1px solid ${(colors as any).border} !important;
            box-shadow: 0 6px 16px rgba(0, 0, 0, 0.12) !important;
          }

          .leaflet-popup-content {
            box-sizing: border-box;
            margin: 0 !important;
            padding: ${DESIGN_TOKENS.spacing.md}px !important;
            width: min(380px, calc(100vw - 48px)) !important;
            max-height: calc(100vh - 220px);
            overflow-y: auto;
            -webkit-overflow-scrolling: touch;
          }

          .leaflet-popup-close-button {
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
            width: 28px !important;
            height: 28px !important;
            line-height: 26px !important;
            position: absolute !important;
            top: 8px !important;
            right: 8px !important;
            margin: 0 !important;
            border-radius: 999px !important;
            border: 1px solid ${(colors as any).border} !important;
            background: ${(colors as any).surface} !important;
            color: ${(colors as any).textMuted} !important;
            font-size: 18px !important;
            z-index: 2 !important;
          }

          .leaflet-popup-close-button:hover {
            color: ${(colors as any).text} !important;
            background: ${(colors as any).backgroundSecondary} !important;
          }

          @media (max-width: 640px) {
            .leaflet-popup-content-wrapper {
              max-height: calc(100vh - 150px);
            }
            .leaflet-popup-content {
              max-height: calc(100vh - 170px);
            }
          }

          html[data-theme='dark'] .leaflet-popup-content-wrapper,
          html[data-theme='dark'] .leaflet-popup-tip {
            background: ${(colors as any).surface} !important;
            opacity: 1 !important;
          }

          html[data-theme='dark'] .leaflet-popup-content-wrapper {
            color: ${(colors as any).text} !important;
            border-radius: ${DESIGN_TOKENS.radii.lg}px !important;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.25), 0 2px 8px rgba(0, 0, 0, 0.15) !important;
            border: 1px solid ${(colors as any).border} !important;
          }

          html[data-theme='dark'] .leaflet-popup-content {
            margin: ${DESIGN_TOKENS.spacing.md}px !important;
            color: ${(colors as any).text} !important;
          }

          html[data-theme='dark'] .leaflet-popup-close-button {
            display: block !important;
            width: 28px !important;
            height: 28px !important;
            line-height: 26px !important;
            text-align: center !important;
            border-radius: 999px !important;
            border: 1px solid ${(colors as any).border} !important;
            background: ${(colors as any).surface} !important;
            color: ${(colors as any).textMuted} !important;
            font-size: 18px !important;
            transition: all 0.2s !important;
          }

          html[data-theme='dark'] .leaflet-popup-close-button:hover {
            color: ${(colors as any).text} !important;
            background: ${(colors as any).backgroundSecondary} !important;
            transform: scale(1.05) !important;
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

      {canRenderMap && hasValidReactLeafletHooks && (
        <MapContainer
          style={mapContainerStyle}
          data-testid="map-leaflet-container"
          id={mapContainerIdRef.current}
          center={safeCenter}
          zoom={initialZoomRef.current}
          key={mapInstanceKeyRef.current}
          zoomControl={false}
        >
          {/* Base tile layer */}
          {(() => {
            const TileLayer = (rl as any)?.TileLayer
            if (!TileLayer) return null
            return (
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution="&copy; OpenStreetMap contributors"
              />
            )
          })()}
          
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

          {/* Waypoint markers (intermediate points) */}
          {routePoints.length > 2 &&
           routePoints.slice(1, -1).map((point, index) => {
             if (!Number.isFinite(point[0]) || !Number.isFinite(point[1]) || !isValidCoordinate(point[1], point[0])) {
               return null;
             }
             return (
               <Marker
                 key={`waypoint-${index}`}
                 position={[point[1], point[0]]}
                 eventHandlers={{
                   click: (e: any) => {
                     e?.originalEvent?.stopPropagation?.();
                   },
                 }}
               >
                 <Popup>Точка {index + 2}</Popup>
               </Marker>
             );
           })}

          {/* End marker - show for any route with 2+ points */}
          {routePoints.length >= 2 &&
           customIcons?.end &&
           (() => {
             const lastPoint = routePoints[routePoints.length - 1];
             return Number.isFinite(lastPoint[0]) &&
                    Number.isFinite(lastPoint[1]) &&
                    isValidCoordinate(lastPoint[1], lastPoint[0]);
           })() && (
            <Marker
              position={[routePoints[routePoints.length - 1][1], routePoints[routePoints.length - 1][0]]}
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
          {(() => {
            const shouldRenderRouting = mode === 'route' &&
              routePoints.length >= 2 &&
              rl &&
              RoutingMachineWithMapInner &&
              routePoints.every((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]) && isValidCoordinate(p[1], p[0]));
            
            console.info('[Map.web.tsx] Routing check:', {
              mode,
              routePointsLength: routePoints.length,
              routePoints,
              hasRL: !!rl,
              hasRoutingMachine: !!RoutingMachineWithMapInner,
              allValid: routePoints.every((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]) && isValidCoordinate(p[1], p[0])),
              shouldRender: shouldRenderRouting
            });
            
            if (!shouldRenderRouting) return null;
            
            return (
              <RoutingMachineWithMapInner
                routePoints={routePoints}
                transportMode={transportMode}
                setRoutingLoading={setRoutingLoading}
                setErrors={setErrors}
                setRouteDistance={setRouteDistance}
                setFullRouteCoords={setFullRouteCoords}
                ORS_API_KEY={ORS_API_KEY}
              />
            );
          })()}

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
              popupProps={popupAutoPanPadding}
              onMarkerClick={handleMarkerZoom}
              hintCenter={hintCenterLatLng}
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
              clusters={clusters as any}
              Marker={Marker}
              Popup={Popup}
              PopupContent={PopupComponent}
              popupProps={popupAutoPanPadding}
              markerIcon={customIcons.meTravel}
              markerOpacity={travelMarkerOpacity}
              expandedClusterKey={expandedCluster?.key}
              expandedClusterItems={expandedCluster?.items}
              renderer={canvasRenderer}
              hintCenter={hintCenterLatLng}
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
      )}

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
