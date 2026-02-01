/**
 * Unified Travel Map Component
 * Reusable map component for both MapScreen and TravelDetailsPage
 * Uses all optimizations from Map.web.tsx refactoring (Phases 1-5)
 * @module components/MapPage/TravelMap
 */

import React, { useMemo, useEffect, useRef } from 'react';
import { Platform, StyleSheet, View, ActivityIndicator } from 'react-native';
import { useLeafletLoader } from '@/hooks/useLeafletLoader';
import { useMapMarkers } from '@/hooks/useMapMarkers';
import { useThemedColors } from '@/hooks/useTheme';
import { MapLayers } from './Map/MapLayers';
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
}) => {
  const colors = useThemedColors();
  const mapRef = useRef<any>(null);
  const markerByCoordRef = useRef<Map<string, any>>(new Map());

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

  // Map styles
  const mapHeight = height || (compact ? 400 : 600);
  const mapStyle = useMemo(() => ({
    width: '100%',
    height: mapHeight,
    borderRadius: compact ? 12 : 16,
    overflow: 'hidden' as const,
  }), [compact, mapHeight]);

  // Loading state
  if (!leafletReady || leafletLoading) {
    return (
      <View style={[mapStyle, styles.loadingContainer]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // No data state
  if (!travelData || travelData.length === 0) {
    return (
      <View style={[mapStyle, styles.emptyContainer]}>
        <ActivityIndicator size="small" color={colors.textMuted} />
      </View>
    );
  }

  // Render map
  if (!L || !rl) return null;

  const { MapContainer, TileLayer, useMap } = rl;

  if (!MapContainer || !TileLayer) return null;

  const shouldCluster = enableClustering && shouldRenderClusters;

  return (
    <View style={mapStyle}>
      <MapContainer
        center={center as [number, number]}
        zoom={initialZoom}
        style={{ width: '100%', height: '100%' }}
        zoomControl={!compact}
        scrollWheelZoom={!compact}
        dragging={!compact}
        ref={mapRef}
      >
        {/* Base tile layer */}
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap contributors"
        />

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
            clusters={clusters as any}
            Marker={rl.Marker}
            Popup={rl.Popup}
            PopupContent={PopupComponent}
            popupProps={popupProps}
            markerIcon={customIcons.meTravel}
            markerOpacity={markerOpacity}
            expandedClusterKey={null}
            expandedClusterItems={null}
            renderer={null}
            hintCenter={{ lat: center[0], lng: center[1] }}
            onMarkerClick={() => {}}
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
            onClusterZoom={() => {}}
          />
        )}
      </MapContainer>
    </View>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  emptyContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fafafa',
  },
});

export default React.memo(TravelMap);
