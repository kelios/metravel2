import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';
import * as Location from 'expo-location';

import RoutingMachine from './RoutingMachine';
import MapRoute from './Map/MapRoute';
import { CoordinateConverter } from '@/utils/coordinateConverter';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';
import { isValidCoordinate } from '@/utils/coordinateValidator';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { DEFAULT_RADIUS_KM } from '@/constants/mapConfig';
import { createMapPopupComponent } from './Map/createMapPopupComponent';
import type { Coordinates, MapMode, MapProps, Point } from './Map/types';
import { strToLatLng } from './Map/utils';

// Import modular components and hooks
import { useMapCleanup } from '@/components/MapPage/Map/useMapCleanup';
import { useLeafletIcons } from './Map/useLeafletIcons';
import { useMapInstance } from './Map/useMapInstance';
import { useMapApi } from './Map/useMapApi';
import { MapLogicComponent } from './Map/MapLogicComponent';
import MapMarkers from './Map/MapMarkers';
import ClusterLayer from './Map/ClusterLayer';
import MapControls from './Map/MapControls';
import { MapLayers } from './Map/MapLayers';
import { RouteMarkersLayer } from './Map/RouteMarkersLayer';

// New optimized hooks
import { useLeafletLoader } from '@/hooks/useLeafletLoader';
import { useMapMarkers } from '@/hooks/useMapMarkers';

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
    fullRouteCoords,
    onMapClick,
    mode,
    transportMode,
    setRouteDistance,
    setRouteDuration,
    setFullRouteCoords,
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
  const [userLocation, setUserLocation] = useState<Coordinates | null>(null);
  const [showInitialLoader, setShowInitialLoader] = useState(Platform.OS !== 'web');
  const [_hasWebTilesLoaded, setHasWebTilesLoaded] = useState(false);
  const [_routingLoading, setRoutingLoading] = useState(false);
  const [errors, setErrors] = useState<any>({ routing: false });
  const [disableFitBounds, _setDisableFitBounds] = useState(false);
  const [expandedCluster, setExpandedCluster] = useState<{ key: string; items: Point[] } | null>(null);
  const [mapZoom, setMapZoom] = useState<number>(11);
  const [mapInstance, setMapInstance] = useState<any>(null);

  const markerByCoordRef = useRef<Map<string, any>>(new Map());

  const colors = useThemedColors();
  const styles = useMemo(() => getStyles(colors), [colors]);

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

  // Track first rendered tiles on web: loader overlay must disappear once tiles are visible.
  // Use DOM polling with a safety timeout (tile load events are not consistently emitted on the map instance).
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (typeof document === 'undefined') return;
    if (!leafletReady) return;

    // Reset on module (re)load
    setHasWebTilesLoaded(false);

    let cancelled = false;
    let intervalId: any = null;
    let timeoutId: any = null;

    const checkLoaded = () => {
      if (cancelled) return;
      try {
        const hasTile = !!document.querySelector?.('.leaflet-tile-loaded');
        if (hasTile) {
          setHasWebTilesLoaded(true);
          cancelled = true;
        }
      } catch {
        // noop
      }

      if (cancelled) {
        try {
          if (intervalId) clearInterval(intervalId);
        } catch {
          // noop
        }
        try {
          if (timeoutId) clearTimeout(timeoutId);
        } catch {
          // noop
        }
      }
    };

    // Poll until first tile is loaded
    intervalId = setInterval(checkLoaded, 250);
    // Run immediately
    checkLoaded();

    // Safety: never block map interactions indefinitely
    timeoutId = setTimeout(() => {
      if (cancelled) return;
      cancelled = true;
      setHasWebTilesLoaded(true);
      try {
        if (intervalId) clearInterval(intervalId);
      } catch {
        // noop
      }
    }, 15_000);

    return () => {
      cancelled = true;
      try {
        if (intervalId) clearInterval(intervalId);
      } catch {
        // noop
      }
      try {
        if (timeoutId) clearTimeout(timeoutId);
      } catch {
        // noop
      }
    };
  }, [leafletReady]);

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

  const userLocationLatLng = useMemo(() => {
    if (!userLocation) return null;
    if (!isValidCoordinate(userLocation.latitude, userLocation.longitude)) return null;
    return { lat: userLocation.latitude, lng: userLocation.longitude };
  }, [userLocation]);

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
  }, [safeCoordinates.latitude, safeCoordinates.longitude, safeCoordinates.zoom, leafletReady]);

  const canRenderTravelPoints = useMemo(() => {
    if (isTestEnv) return true;
    if (mode !== 'radius') return true;
    return !!userLocationLatLng;
  }, [mode, userLocationLatLng]);

  useEffect(() => {
    try {
      onUserLocationChange?.(userLocation);
    } catch {
      // noop
    }
  }, [onUserLocationChange, userLocation]);

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
    try {
      console.error('[Map] Routing error:', errors.routing);
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
            console.warn('[Map] Location permission not granted');
            return;
          }

          const location = await Location.getCurrentPositionAsync({});
          if (cancelled) return;

          const lat = location.coords.latitude;
          const lng = location.coords.longitude;
          if (isValidCoordinate(lat, lng)) {
            setUserLocation({ latitude: lat, longitude: lng });
          } else {
            console.warn('[Map] Invalid location coordinates:', { lat, lng });
          }
        } catch (err) {
          console.error('[Map] Location error:', err);
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
        14,
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
    // Prefer actual current location (web Leaflet) as circle center in radius mode.
    if (mode === 'radius' && userLocationLatLng) {
      const lat = Number(userLocationLatLng.lat);
      const lng = Number(userLocationLatLng.lng);
      if (isValidCoordinate(lat, lng)) return [lat, lng];
    }

    const lat = Number(safeCenter?.[0]);
    const lng = Number(safeCenter?.[1]);
    if (!isValidCoordinate(lat, lng)) return null;
    return [lat, lng];
  }, [mode, safeCenter, userLocationLatLng]);

  const circleCenterLatLng = useMemo(
    () => (circleCenter ? { lat: circleCenter[0], lng: circleCenter[1] } : null),
    [circleCenter]
  );

  const hintCenterLatLng = useMemo(() => {
    if (mode === 'radius' && circleCenterLatLng) return circleCenterLatLng;
    return coordinatesLatLng;
  }, [mode, circleCenterLatLng, coordinatesLatLng]);

  const normalizeLngLatWithHint = useCallback(
    (tuple: [number, number]): [number, number] => {
      const a = tuple?.[0];
      const b = tuple?.[1];
      if (!Number.isFinite(a) || !Number.isFinite(b)) return tuple;

      const option1 = { lng: a, lat: b };
      const option2 = { lng: b, lat: a };
      const option1Valid = isValidCoordinate(option1.lat, option1.lng);
      const option2Valid = isValidCoordinate(option2.lat, option2.lng);

      if (option1Valid && !option2Valid) return [option1.lng, option1.lat];
      if (!option1Valid && option2Valid) return [option2.lng, option2.lat];

      // Ambiguous: both values fall within latitude range (-90..90) so both orders look "valid".
      // Choose the interpretation closer to current hint center (user location / current map center).
      if (
        option1Valid &&
        option2Valid &&
        hintCenterLatLng &&
        isValidCoordinate(hintCenterLatLng.lat, hintCenterLatLng.lng)
      ) {
        try {
          const d1 = CoordinateConverter.distance(hintCenterLatLng, option1 as any);
          const d2 = CoordinateConverter.distance(hintCenterLatLng, option2 as any);
          return d2 < d1 ? [option2.lng, option2.lat] : [option1.lng, option1.lat];
        } catch {
          // noop
        }
      }

      // Default: assume incoming tuple is already [lng, lat] (legacy Metravel format).
      return tuple;
    },
    [hintCenterLatLng]
  );

  const routePointsForRouting = useMemo(() => {
    if (!Array.isArray(routePoints) || routePoints.length === 0) return [] as [number, number][];

    const normalized = routePoints.map((p) => normalizeLngLatWithHint(p));
    console.info('[Map.web.tsx] Route points normalization:', {
      original: routePoints,
      normalized,
    });
    return normalized;
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

  const popupAutoPanPadding = useMemo(() => ({
    autoPan: true,
    keepInView: true,
    autoPanPaddingTopLeft: [24, 140],
    autoPanPaddingBottomRight: [360, 220],
  }), []);

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

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (!canRenderMap) return;
    // Once Leaflet modules are ready and MapContainer can render, never keep a blocking loader overlay.
    setShowInitialLoader(false);
  }, [canRenderMap]);

  const shouldShowLoadingOverlay = Platform.OS === 'web'
    ? !!leafletError || !canRenderMap
    : showInitialLoader || leafletLoading || !!leafletError || !canRenderMap;

  const loaderMessage = leafletError
    ? 'Не удалось загрузить модули карты'
    : 'Загрузка карты...';

  const rlSafe = (rl ?? {}) as ReactLeafletNS;
  const { MapContainer, Marker, Popup, Tooltip, Circle, TileLayer, useMap, useMapEvents } = rlSafe;
  const Polyline = (rlSafe as any)?.Polyline as any;
  const Pane = (rlSafe as any)?.Pane as any;

  const hasValidReactLeafletHooks = !!(
    useMap && 
    typeof useMap === 'function' && 
    useMapEvents && 
    typeof useMapEvents === 'function'
  );

  const routeLineLatLngObjects = useMemo(() => {
    if (mode !== 'route') return [] as Array<{ lat: number; lng: number }>;

    const candidate =
      Array.isArray(fullRouteCoords) && fullRouteCoords.length >= 2
        ? fullRouteCoords
        : routePointsForRouting;

    const normalized = (candidate || []).map((p) => normalizeLngLatWithHint(p));
    const valid = normalized
      .filter(([lng, lat]) => isValidCoordinate(lat, lng))
      .map(([lng, lat]) => ({ lat, lng }));

    return valid.length >= 2 ? valid : ([] as Array<{ lat: number; lng: number }>);
  }, [fullRouteCoords, mode, normalizeLngLatWithHint, routePointsForRouting]);

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
        <View
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 10,
            ...(Platform.OS === 'web' ? ({ pointerEvents: 'none' } as any) : null),
          } as any}
        >
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

          /* Enforce correct stacking order: route overlay must be above tiles */
          .leaflet-tile-pane { z-index: 200 !important; }
          .leaflet-overlay-pane { z-index: 400 !important; }
          .leaflet-metravelRoutePane-pane { 
            /* keep above other overlay panes (often 560) but below markers (600) */
            z-index: 590 !important; 
            pointer-events: none !important;
          }
          .leaflet-shadow-pane { z-index: 500 !important; }
          .leaflet-marker-pane { z-index: 600 !important; }
          .leaflet-tooltip-pane { z-index: 650 !important; }
          .leaflet-popup-pane { z-index: 700 !important; }

          /* SVG renderer container - ensure proper sizing and visibility */
          .leaflet-overlay-pane svg {
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            overflow: visible !important;
          }

          .leaflet-metravelRoutePane-pane svg {
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            overflow: visible !important;
          }

          .leaflet-overlay-pane svg path {
            pointer-events: none !important;
          }

          .leaflet-metravelRoutePane-pane svg path {
            pointer-events: none !important;
          }

          /* Route line styling */
          .metravel-route-line {
            stroke: ${(colors as any).primary || '#7a9d8f'} !important;
            stroke-opacity: 0.9 !important;
            stroke-width: 6px !important;
            stroke-linecap: round !important;
            stroke-linejoin: round !important;
            fill: none !important;
          }

          /* Fallback for paths without class */
          .leaflet-overlay-pane svg path[stroke],
          .leaflet-metravelRoutePane-pane svg path[stroke] {
            stroke-opacity: 0.9 !important;
            stroke-width: 5px !important;
            stroke-linecap: round !important;
            stroke-linejoin: round !important;
            fill: none !important;
          }

          .leaflet-marker-icon,
          .leaflet-marker-shadow {
            position: absolute !important;
            left: 0;
            top: 0;
            display: block !important;
          }

          .leaflet-div-icon {
            background: transparent;
            border: none;
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
          preferCanvas={false}
        >
          {/* Ensure custom pane exists before any route Polyline tries to target it */}
          {typeof Pane === 'function' ? (
            <Pane name="metravelRoutePane" style={{ zIndex: 590, pointerEvents: 'none' } as any} />
          ) : null}

          {/* Map layers (tiles, circle, user location) */}
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
            travelData={filteredTravelData}
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

          {/* Route line renderer */}
          {mode === 'route' &&
            Array.isArray(routeLineLatLngObjects) &&
            routeLineLatLngObjects.length >= 2 && (
              // Prefer declarative react-leaflet Polyline when available (more reliable than imperative add/remove)
              typeof Polyline === 'function' ? (
                <>
                  {/* Outline for contrast on any basemap */}
                  <Polyline
                    positions={routeLineLatLngObjects as any}
                    pane="metravelRoutePane"
                    pathOptions={{
                      color: (colors as any).text || '#000',
                      weight: 10,
                      opacity: 0.95,
                      lineJoin: 'round',
                      lineCap: 'round',
                      interactive: false,
                      className: 'metravel-route-line metravel-route-line-outline',
                    }}
                  />
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
                </>
              ) : (
                // Fallback: imperative Leaflet polyline (legacy)
                mapInstance &&
                L && (
                  <MapRoute
                    map={mapInstance}
                    leaflet={L}
                    routeCoordinates={routeLineLatLngObjects}
                    isOptimal={true}
                    disableFitBounds
                  />
                )
              )
            )}

          {/* Route markers */}
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


          {/* Routing */}
          {(() => {
            const shouldRenderRouting = mode === 'route' &&
              routePointsForRouting.length >= 2 &&
              routePointsForRouting.every((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]) && isValidCoordinate(p[1], p[0]));
            
            console.info('[Map.web.tsx] Routing check:', {
              mode,
              routePointsLength: routePointsForRouting.length,
              routePoints: routePointsForRouting,
              hasRL: !!rl,
              allValid: routePointsForRouting.every((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]) && isValidCoordinate(p[1], p[0])),
              shouldRender: shouldRenderRouting
            });
            
            if (!shouldRenderRouting) return null;
            
            return (
              <RoutingMachine
                routePoints={routePointsForRouting}
                transportMode={transportMode}
                setRoutingLoading={setRoutingLoading}
                setErrors={setErrors}
                setRouteDistance={setRouteDistance}
                setRouteDuration={setRouteDuration}
                setFullRouteCoords={setFullRouteCoords}
                ORS_API_KEY={ORS_API_KEY}
              />
            );
          })()}

          {/* Travel markers (not clustered) */}
          {canRenderTravelPoints &&
           customIcons?.meTravel &&
           markers.length > 0 &&
           !shouldRenderClusters &&
           PopupComponent && (
            <MapMarkers
              points={markers}
              icon={customIcons.meTravel}
              Marker={Marker}
              Popup={Popup}
              PopupContent={PopupComponent}
              popupProps={popupAutoPanPadding}
              onMarkerClick={handleMarkerZoom}
              hintCenter={hintCenterLatLng}
              onMarkerInstance={(coord, marker) => {
                markerByCoordRef.current.set(coord, marker);
              }}
            />
          )}

          {/* Travel markers (clustered) */}
          {canRenderTravelPoints &&
           customIcons?.meTravel &&
           markers.length > 0 &&
           shouldRenderClusters &&
           PopupComponent && (
            <ClusterLayer
              L={L}
              clusters={clusters as any}
              Marker={Marker}
              Popup={Popup}
              PopupContent={PopupComponent}
              popupProps={popupAutoPanPadding}
              markerIcon={customIcons.meTravel}
              markerOpacity={travelMarkerOpacity}
              expandedClusterKey={expandedCluster?.key}
              expandedClusterItems={expandedCluster?.items}
              hintCenter={hintCenterLatLng}
              onClusterZoom={({ center: _center, bounds, key, items }) => {
                setExpandedCluster({ key, items });
                try {
                  mapRef.current?.fitBounds?.(bounds as any, { animate: true, padding: [30, 30] } as any);
                } catch {
                  // noop
                }
              }}
              onMarkerClick={handleMarkerZoom}
              onMarkerInstance={(coord, marker) => {
                markerByCoordRef.current.set(coord, marker);
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
