/**
 * Unified Travel Map Component
 * Reusable map component for both MapScreen and TravelDetailsPage
 * Uses all optimizations from Map.web.tsx refactoring (Phases 1-5)
 * @module components/MapPage/TravelMap
 */

import React, { useMemo, useEffect, useRef, useState } from 'react';
import { Platform, View, ActivityIndicator } from 'react-native';
import { useLeafletLoader } from '@/hooks/useLeafletLoader';
import { useMapMarkers } from '@/hooks/useMapMarkers';
import { attachOsmPoiOverlay } from '@/utils/mapWebOverlays/osmPoiOverlay';
import { attachOsmCampingOverlay } from '@/utils/mapWebOverlays/osmCampingOverlay';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';
import MapMarkers from './Map/MapMarkers';
import ClusterLayer from './Map/ClusterLayer';
import { createMapPopupComponent } from './Map/createMapPopupComponent';
import { useLeafletIcons } from './Map/useLeafletIcons';
import { DESIGN_TOKENS } from '@/constants/designSystem';

interface TravelMapProps {
  /**
   * Travel data with coordinates
   */
  travelData: any[];

  /**
   * Highlight specific point (for navigation from PointList)
   */
  highlightedPoint?: { coord: string; key: string };

  /**
   * Compact mode (smaller height, no controls)
   */
  compact?: boolean;

  /**
   * Initial zoom level
   */
  initialZoom?: number;

  /**
   * Map height (default: 400 for compact, 600 for full)
   */
  height?: number;

  /**
   * Enable clustering (recommended for >25 points)
   */
  enableClustering?: boolean;

  resizeTrigger?: number;

  /**
   * Enable overlay layers (POI, camping sites)
   * Note: Only works on full-size maps, not compact mode
   */
  enableOverlays?: boolean;

  /**
   * Draw a line connecting points (NOT routing; just straight segments).
   * Defaults to false on travel pages (points-only).
   */
  showRouteLine?: boolean;
}

/**
 * Unified map component for travel pages
 *
 * Features:
 * - Uses all optimizations from Map.web.tsx refactoring
 * - Lazy Leaflet loading (useLeafletLoader)
 * - Optimized markers (useMapMarkers)
 * - Dynamic clustering (if enabled)
 * - Modular structure (MapLayers, MapMarkers)
 * - Responsive and lightweight
 *
 * @example
 * ```typescript
 * // On travel details page:
 * <TravelMap
 *   travelData={travel.travelAddress}
 *   highlightedPoint={highlightedPoint}
 *   compact
 * />
 *
 * // On map page with clustering:
 * <TravelMap
 *   travelData={allTravels}
 *   enableClustering
 *   height={600}
 * />
 * ```
 */

/**
 * Internal component to render route line with proper Leaflet API
 * Uses custom pane and SVG renderer for correct z-index stacking
 */
interface RouteLineLayerProps {
  routeLineCoords: [number, number][];
  colors: ThemedColors;
  useMap: () => any;
  L: any;
}

const RouteLineLayer: React.FC<RouteLineLayerProps> = ({ routeLineCoords, colors, useMap, L }) => {
  const map = useMap();
  const polylineRef = useRef<any>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!map || !L || routeLineCoords.length < 2) {
      // Remove old polyline if exists
      if (polylineRef.current && map) {
        try {
          map.removeLayer(polylineRef.current);
        } catch {
          // noop
        }
        polylineRef.current = null;
      }
      return;
    }

    // Remove old polyline
    if (polylineRef.current) {
      try {
        map.removeLayer(polylineRef.current);
      } catch {
        // noop
      }
      polylineRef.current = null;
    }

    // Ensure custom pane exists with proper z-index
    const paneName = 'metravelRoutePane';
    let pane: HTMLElement | null = null;
    try {
      pane = typeof map.getPane === 'function' ? map.getPane(paneName) : null;
      if (!pane && typeof map.createPane === 'function') {
        pane = map.createPane(paneName);
        if (__DEV__) console.info('[TravelMap] RouteLineLayer: created custom pane', paneName);
      }
      if (pane && pane.style) {
        pane.style.zIndex = '450';
        pane.style.pointerEvents = 'none';
      }
    } catch (e) {
      if (__DEV__) console.warn('[TravelMap] RouteLineLayer: failed to create pane', e);
    }

    // Convert coords to Leaflet LatLng
    const latlngs = routeLineCoords
      .filter(([lat, lng]) =>
        Number.isFinite(lat) && Number.isFinite(lng) &&
        lat >= -90 && lat <= 90 &&
        lng >= -180 && lng <= 180
      )
      .map(([lat, lng]) => L.latLng(lat, lng));

    if (latlngs.length < 2) {
      if (__DEV__) console.warn('[TravelMap] RouteLineLayer: not enough valid coordinates', latlngs.length);
      return;
    }

    if (__DEV__) console.info('[TravelMap] RouteLineLayer: drawing route, points:', latlngs.length);

    // Add polyline with slight delay to ensure pane is ready
    const addPolyline = () => {
      if (!mountedRef.current) return;

      // Create SVG renderer for custom pane
      const hasRoutePane = !!pane;
      const renderer = typeof L.svg === 'function'
        ? L.svg(hasRoutePane ? { pane: paneName } : undefined)
        : undefined;

      // Create polyline with proper styling
      const line = L.polyline(latlngs, {
        color: colors.primary || DESIGN_TOKENS.colors.primary,
        weight: 6,
        opacity: 0.9,
        lineJoin: 'round',
        lineCap: 'round',
        interactive: false,
        renderer,
        pane: hasRoutePane ? paneName : 'overlayPane',
        className: 'metravel-route-line',
      });

      try {
        line.addTo(map);
        
        // Force polyline to front
        if (typeof line.bringToFront === 'function') {
          line.bringToFront();
        }
        
        polylineRef.current = line;

        if (__DEV__) console.info('[TravelMap] RouteLineLayer: polyline added, coords:', latlngs.length);
      } catch (error) {
        console.error('[TravelMap] RouteLineLayer: failed to add polyline', error);
        try {
          line.remove?.();
        } catch {
          // noop
        }
      }
    };

    // Small delay to ensure pane is in DOM
    const timer = setTimeout(addPolyline, 10);

    return () => {
      clearTimeout(timer);
      if (polylineRef.current && map) {
        try {
          map.removeLayer(polylineRef.current);
        } catch {
          // noop
        }
        polylineRef.current = null;
      }
    };
  }, [map, L, routeLineCoords, colors.primary]);

  return null;
};
export const TravelMap: React.FC<TravelMapProps> = ({
  travelData = [],
  highlightedPoint,
  compact = false,
  initialZoom = 11,
  height,
  enableClustering = false,
  resizeTrigger,
  enableOverlays = false,
  showRouteLine = false,
}) => {
  const colors = useThemedColors();
  const mapRef = useRef<any>(null);
  const containerRef = useRef<any>(null);
  const markerByCoordRef = useRef<Map<string, any>>(new Map());
  const mountedRef = useRef(true);
  const [mapReady, setMapReady] = useState(false);
  const overlayControllersRef = useRef<Map<string, any>>(new Map());

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      // Do NOT call map.remove() — react-leaflet's MapContainer handles its own
      // cleanup via its unmount effect, and our leafletFix.ts patch makes that safe.
      mapRef.current = null;
    };
  }, []);

  // Lazy load Leaflet
  const { L, RL: rl, loading: leafletLoading, ready: leafletReady } = useLeafletLoader({
    enabled: Platform.OS === 'web',
    useIdleCallback: true,
  });

  // Custom icons
  const customIcons = useLeafletIcons(L);

  // Calculate center from travel data
  const center = useMemo(() => {
    if (!travelData || travelData.length === 0) {
      return [53.9006, 27.559]; // Default: Minsk
    }

    // Take first point as center
    const firstPoint = travelData[0];
    const coordStr = String(firstPoint?.coord || '').trim();

    if (!coordStr) return [53.9006, 27.559];

    try {
      const cleaned = coordStr.replace(/;/g, ',').replace(/\s+/g, '');
      const parts = cleaned.split(',');

      if (parts.length === 2) {
        const lat = parseFloat(parts[0]);
        const lng = parseFloat(parts[1]);

        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          return [lat, lng];
        }
      }
    } catch {
      // Fallback
    }

    return [53.9006, 27.559];
  }, [travelData]);

  // Use optimized markers hook
  const {
    shouldRenderClusters,
    clusters,
    markers,
    markerOpacity,
  } = useMapMarkers({
    travelData,
    mapZoom: initialZoom,
    expandedClusterKey: null,
    mode: 'radius',
    hintCenter: { lat: center[0], lng: center[1] },
  });

  // Popup component
  const PopupComponent = useMemo(() => {
    if (!rl) return null;
    return createMapPopupComponent({ useMap: rl.useMap, userLocation: null });
  }, [rl]);

  const popupProps = useMemo(() => ({
    autoPan: true,
    keepInView: true,
    autoPanPaddingTopLeft: [24, 60],
    autoPanPaddingBottomRight: [24, 60],
  }), []);

  // Convert travel data to route line coordinates
  const routeLineCoords = useMemo(() => {
    if (!showRouteLine) return [];
    if (!travelData || travelData.length < 2) return [];

    const coords: [number, number][] = [];
    for (const point of travelData) {
      const coordStr = String(point?.coord || '').trim();
      if (!coordStr) continue;

      try {
        const cleaned = coordStr.replace(/;/g, ',').replace(/\s+/g, '');
        const parts = cleaned.split(',');

        if (parts.length === 2) {
          const lat = parseFloat(parts[0]);
          const lng = parseFloat(parts[1]);

          if (Number.isFinite(lat) && Number.isFinite(lng)) {
            coords.push([lat, lng]);
          }
        }
      } catch {
        // Skip invalid coordinates
      }
    }

    return coords;
  }, [showRouteLine, travelData]);

  // Highlight point when requested
  useEffect(() => {
    if (!highlightedPoint || !mapRef.current) return;

    try {
      const { coord } = highlightedPoint;
      const marker = markerByCoordRef.current.get(coord);

      if (marker && typeof marker.openPopup === 'function') {
        // Center on marker
        const map = mapRef.current;
        if (typeof map.setView === 'function') {
          const latlng = marker.getLatLng();
          map.setView(latlng, 14, { animate: true });
        }

        // Open popup
        setTimeout(() => {
          marker.openPopup();
        }, 300);
      }
    } catch (err) {
      console.warn('[TravelMap] Failed to highlight point:', err);
    }
  }, [highlightedPoint]);

  // Invalidate size when map opens or resizes
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (!mapRef.current) return;
    if (resizeTrigger === undefined) return;

    const map = mapRef.current;
    const invalidate = () => {
      try {
        if (map && typeof map.invalidateSize === 'function') {
          map.invalidateSize({ animate: true, pan: false });
        }
      } catch {
        // noop
      }
    };

    // Two-pass invalidation: immediate (rAF) + delayed for CSS transitions
    const rafId = typeof requestAnimationFrame !== 'undefined'
      ? requestAnimationFrame(invalidate)
      : undefined;
    const timer = setTimeout(invalidate, 300);

    return () => {
      if (rafId !== undefined) cancelAnimationFrame(rafId);
      clearTimeout(timer);
    };
  }, [resizeTrigger]);

  // Also invalidate when map becomes ready
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;

    const map = mapRef.current;
    const invalidate = () => {
      try {
        if (map && typeof map.invalidateSize === 'function') {
          map.invalidateSize({ animate: false, pan: false });
        }
      } catch {
        // noop
      }
    };

    // Two-pass: immediate + delayed for layout settle
    invalidate();
    const timer = setTimeout(invalidate, 200);

    return () => {
      clearTimeout(timer);
    };
  }, [mapReady]);

  // Initialize overlay layers when map is ready and overlays are enabled
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (!mapReady || !mapRef.current || !L) return;
    if (!enableOverlays || compact) return; // Don't add overlays in compact mode

    const map = mapRef.current;
    if (__DEV__) console.info('[TravelMap] Initializing overlay layers');

    const controllersSnapshot = overlayControllersRef.current;

    // Cleanup existing overlays
    controllersSnapshot.forEach((controller, id) => {
      try {
        if (controller.stop) controller.stop();
        if (controller.layer && map) {
          map.removeLayer(controller.layer);
        }
      } catch (e) {
        if (__DEV__) console.warn('[TravelMap] Failed to cleanup overlay:', id, e);
      }
    });
    controllersSnapshot.clear();

    try {
      // Initialize POI overlay (достопримечательности)
      const poiController = attachOsmPoiOverlay(L, map, {
        maxAreaKm2: 2500,
        debounceMs: 700,
        categories: ['Достопримечательности', 'Видовые места', 'Культура'],
      });

      if (poiController && poiController.layer) {
        poiController.layer.addTo(map);
        controllersSnapshot.set('osm-poi', poiController);
        poiController.start();
        if (__DEV__) console.info('[TravelMap] POI overlay initialized');
      }
    } catch (e) {
      if (__DEV__) console.warn('[TravelMap] Failed to initialize POI overlay:', e);
    }

    try {
      // Initialize camping overlay (кемпинги/заночуй в лесе)
      const campingController = attachOsmCampingOverlay(L, map, {
        maxAreaKm2: 2500,
        debounceMs: 700,
      });

      if (campingController && campingController.layer) {
        campingController.layer.addTo(map);
        controllersSnapshot.set('osm-camping', campingController);
        campingController.start();
        if (__DEV__) console.info('[TravelMap] Camping overlay initialized');
      }
    } catch (e) {
      if (__DEV__) console.warn('[TravelMap] Failed to initialize camping overlay:', e);
    }

    return () => {
      // Cleanup overlays when unmounting or dependencies change
      controllersSnapshot.forEach((controller, id) => {
        try {
          if (controller.stop) controller.stop();
          if (controller.layer && map) {
            map.removeLayer(controller.layer);
          }
          if (__DEV__) console.info('[TravelMap] Cleaned up overlay:', id);
        } catch (e) {
          if (__DEV__) console.warn('[TravelMap] Failed to cleanup overlay:', id, e);
        }
      });
      controllersSnapshot.clear();
    };
  }, [mapReady, L, enableOverlays, compact]);

  // Map styles
  const mapHeight = height || (compact ? 400 : 600);
  const mapBorderRadius = compact ? 12 : 16;
  const mapContainerStyle = useMemo(
    () => ({ height: mapHeight, borderRadius: mapBorderRadius }),
    [mapBorderRadius, mapHeight]
  );

  // Loading state
  if (!leafletReady || leafletLoading) {
    return (
      <View style={[styles.mapContainer, mapContainerStyle, styles.loadingContainer]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // No data state
  if (!travelData || travelData.length === 0) {
    return (
      <View style={[styles.mapContainer, mapContainerStyle, styles.emptyContainer]}>
        <ActivityIndicator size="small" color={colors.textMuted} />
      </View>
    );
  }

  // Render map
  if (!L || !rl) return null;

  const { MapContainer, TileLayer } = rl;

  if (!MapContainer || !TileLayer) return null;

  const shouldCluster = enableClustering && shouldRenderClusters;

  return (
    <View
      ref={containerRef}
      style={[styles.mapContainer, mapContainerStyle]}
      testID="travel-map"
      {...(Platform.OS === 'web' ? { 'data-testid': 'travel-map' } : {})}
    >
      <MapContainer
        center={center as [number, number]}
        zoom={initialZoom}
        style={{ width: '100%', height: '100%', minHeight: mapHeight }}
        zoomControl={!compact}
        scrollWheelZoom={!compact}
        dragging={!compact}
        ref={(map: any) => {
          if (!mountedRef.current) return;
          if (map && !mapRef.current) {
            mapRef.current = map;
            if (__DEV__) console.info('[TravelMap] Map ref set');
          }
        }}
        whenReady={() => {
          if (!mountedRef.current) return;
          if (__DEV__) console.info('[TravelMap] Map ready event fired');
          setMapReady(true);
        }}
      >
        {/* Base tile layer */}
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap contributors"
        />

        {/* Route line connecting travel points - using custom layer for proper z-index */}
        {showRouteLine && rl.useMap && routeLineCoords.length >= 2 && (
          <RouteLineLayer
            routeLineCoords={routeLineCoords}
            colors={colors}
            useMap={rl.useMap}
            L={L}
          />
        )}

        {/* Travel markers (not clustered) */}
        {customIcons?.meTravel && markers.length > 0 && !shouldCluster && PopupComponent && (
          <MapMarkers
            points={markers}
            icon={customIcons.meTravel}
            Marker={rl.Marker}
            Popup={rl.Popup}
            PopupContent={PopupComponent}
            popupProps={popupProps}
            onMarkerClick={() => {}}
            hintCenter={{ lat: center[0], lng: center[1] }}
            onMarkerInstance={(coord, marker) => {
              try {
                const key = String(coord ?? '').trim();
                if (!key) return;
                markerByCoordRef.current.set(key, marker);
              } catch {
                // noop
              }
            }}
          />
        )}

        {/* Travel markers (clustered) */}
        {customIcons?.meTravel && markers.length > 0 && shouldCluster && PopupComponent && (
          <ClusterLayer
            L={L}
            clusters={clusters as any}
            Marker={rl.Marker}
            Popup={rl.Popup}
            PopupContent={PopupComponent}
            popupProps={popupProps}
            markerIcon={customIcons.meTravel}
            markerOpacity={markerOpacity}
            expandedClusterKey={null}
            expandedClusterItems={null as any}
            hintCenter={{ lat: center[0], lng: center[1] }}
            onClusterZoom={() => {}}
            onMarkerClick={() => {}}
            onMarkerInstance={(coord, marker) => {
              try {
                const key = String(coord ?? '').trim();
                if (!key) return;
                markerByCoordRef.current.set(key, marker);
              } catch {
                // noop
              }
            }}
          />
        )}
      </MapContainer>
    </View>
  );
};

// Заметка: в текущей TS-конфигурации проекта тип StyleSheet может не экспонировать create,
// поэтому используем plain object для стилей (RNW это поддерживает).
const styles: any = {
  mapContainer: {
    width: '100%',
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: DESIGN_TOKENS.colors.backgroundSecondary,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
};
