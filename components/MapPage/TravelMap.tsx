/**
 * Unified Travel Map Component
 * Reusable map component for both MapScreen and TravelDetailsPage
 * Uses all optimizations from Map.web.tsx refactoring (Phases 1-5)
 * @module components/MapPage/TravelMap
 */

import React, { useMemo, useEffect, useRef, useState } from 'react';
import { Platform, View, ActivityIndicator, StyleSheet } from 'react-native';
import { useLeafletLoader } from '@/hooks/useLeafletLoader';
import { useMapMarkers } from '@/hooks/useMapMarkers';
import { useThemedColors } from '@/hooks/useTheme';
import MapMarkers from './Map/MapMarkers';
import ClusterLayer from './Map/ClusterLayer';
import { createMapPopupComponent } from './Map/createMapPopupComponent';
import { useLeafletIcons } from './Map/useLeafletIcons';

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
export const TravelMap: React.FC<TravelMapProps> = ({
  travelData = [],
  highlightedPoint,
  compact = false,
  initialZoom = 11,
  height,
  enableClustering = false,
  resizeTrigger,
}) => {
  const colors = useThemedColors();
  const mapRef = useRef<any>(null);
  const containerRef = useRef<any>(null);
  const markerByCoordRef = useRef<Map<string, any>>(new Map());
  const mountedRef = useRef(true);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      // защитимся от утечек/устаревших ссылок при размонтировании (особенно в React StrictMode)
      if (mapRef.current) {
        try {
          mapRef.current.remove();
        } catch (e) {
          console.warn('[TravelMap] Error removing map:', e);
        }
      }
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
  }, [travelData]);

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
          console.info('[TravelMap] invalidateSize called, trigger:', resizeTrigger);
        }
      } catch (e) {
        console.warn('[TravelMap] Error invalidating size:', e);
      }
    };

    // Multiple attempts to ensure map resizes properly
    if (typeof requestAnimationFrame !== 'undefined') {
      requestAnimationFrame(() => invalidate());
      requestAnimationFrame(() => {
        setTimeout(invalidate, 50);
      });
    } else {
      invalidate();
    }

    const timeouts = [
      setTimeout(invalidate, 100),
      setTimeout(invalidate, 300),
      setTimeout(invalidate, 500),
    ];

    return () => {
      timeouts.forEach(t => clearTimeout(t));
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
          console.info('[TravelMap] invalidateSize on ready');
        }
      } catch (e) {
        console.warn('[TravelMap] Error invalidating size on ready:', e);
      }
    };

    // Aggressively call invalidateSize when map is ready
    const timeouts = [
      setTimeout(invalidate, 0),
      setTimeout(invalidate, 100),
      setTimeout(invalidate, 300),
      setTimeout(invalidate, 600),
    ];

    return () => {
      timeouts.forEach(t => clearTimeout(t));
    };
  }, [mapReady]);

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

  const { MapContainer, TileLayer, Polyline } = rl;

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
            console.info('[TravelMap] Map ref set');

            // Invalidate size immediately after map is set
            setTimeout(() => {
              if (map && typeof map.invalidateSize === 'function') {
                map.invalidateSize({ animate: false, pan: false });
                console.info('[TravelMap] Initial invalidateSize after ref');
              }
            }, 100);
          }
        }}
        whenReady={() => {
          if (!mountedRef.current) return;
          console.info('[TravelMap] Map ready event fired');
          setMapReady(true);

          // Additional invalidateSize when ready event fires
          if (mapRef.current && typeof mapRef.current.invalidateSize === 'function') {
            mapRef.current.invalidateSize({ animate: false, pan: false });
            console.info('[TravelMap] invalidateSize in whenReady');
          }
        }}
      >
        {/* Base tile layer */}
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap contributors"
        />

        {/* Route line connecting travel points */}
        {Polyline && routeLineCoords.length >= 2 && (
          <Polyline
            positions={routeLineCoords}
            color={colors.primary}
            weight={4}
            opacity={0.7}
            lineJoin="round"
            lineCap="round"
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
                if (marker) markerByCoordRef.current.set(key, marker);
                else markerByCoordRef.current.delete(key);
              } catch {
                // noop
              }
            }}
          />
        )}

        {/* Travel markers (clustered) */}
        {customIcons?.meTravel && markers.length > 0 && shouldCluster && PopupComponent && (
          <ClusterLayer
            clusters={clusters}
            Marker={rl.Marker}
            Popup={rl.Popup}
            PopupContent={PopupComponent}
            popupProps={popupProps}
            markerOpacity={markerOpacity}
            onClusterZoom={() => {
              // In travel details compact map we don't support expanding clusters yet
            }}
            hintCenter={{ lat: center[0], lng: center[1] }}
          />
        )}
      </MapContainer>
    </View>
  );
};

const styles = StyleSheet.create({
  mapContainer: {
    width: '100%',
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#f0f0f0',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

