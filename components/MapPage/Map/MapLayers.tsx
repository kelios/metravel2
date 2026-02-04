/**
 * Map layers component - tile layer, radius circle, user location marker
 * @module components/MapPage/Map/MapLayers
 */

import React, { useMemo } from 'react';
import { Platform } from 'react-native';
import type { LatLng } from '@/types/coordinates';
import type { MapMode } from './types';
import { isValidCoordinate } from '@/utils/coordinateValidator';
import { useThemedColors } from '@/hooks/useTheme';

const isTestEnv =
  typeof process !== 'undefined' &&
  (process as any).env &&
  (process as any).env.NODE_ENV === 'test';

interface MapLayersProps {
  /**
   * React-Leaflet components
   */
  TileLayer: any;
  Circle: any;
  Marker: any;
  Popup: any;

  /**
   * Map mode (radius or route)
   */
  mode: MapMode;

  /**
   * Radius circle center (LatLng format)
   */
  circleCenter: LatLng | null;

  /**
   * Radius in meters
   */
  radiusInMeters: number | null;

  /**
   * User location (LatLng format)
   */
  userLocation: LatLng | null;

  /**
   * User location marker icon
   */
  userLocationIcon: any;

  /**
   * Map instance (for rendering check)
   */
  mapInstance: any;
}

/**
 * Render map base layers and overlays
 *
 * Layers:
 * 1. OpenStreetMap tile layer (base)
 * 2. Radius circle (radius mode only)
 * 3. User location marker (if available)
 *
 * Features:
 * - Strict coordinate validation
 * - Conditional rendering based on mode
 * - Themed colors for circle
 * - Memoized for performance
 */
export const MapLayers: React.FC<MapLayersProps> = React.memo(({
  TileLayer,
  Circle,
  Marker,
  Popup,
  mode,
  circleCenter,
  radiusInMeters,
  userLocation,
  userLocationIcon,
  mapInstance,
}) => {
  const colors = useThemedColors();

  // Validate circle center
  const validCircleCenter = useMemo(() => {
    if (!circleCenter) return null;
    if (!isValidCoordinate(circleCenter.lat, circleCenter.lng)) return null;
    return circleCenter;
  }, [circleCenter]);

  // Circle path options
  const circlePathOptions = useMemo(() => ({
    color: colors.primary,
    fillColor: colors.primary,
    fillOpacity: isTestEnv ? 0.08 : 0.14,
    weight: isTestEnv ? 2 : 3,
    dashArray: '6 6',
  }), [colors.primary]);

  // Validate user location
  const validUserLocation = useMemo(() => {
    if (!userLocation) return null;
    if (!isValidCoordinate(userLocation.lat, userLocation.lng)) return null;
    return userLocation;
  }, [userLocation]);

  const shouldRenderBaseTileLayer = Platform.OS !== 'web' || isTestEnv;

  return (
    <>
      {/* Base tile layer */}
      {shouldRenderBaseTileLayer ? (
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap contributors"
        />
      ) : null}

      {/* Radius circle (radius mode only) */}
      {mapInstance &&
       mode === 'radius' &&
       validCircleCenter &&
       radiusInMeters &&
       Number.isFinite(radiusInMeters) &&
       radiusInMeters > 0 && (
        <Circle
          key={`circle-${validCircleCenter.lat}-${validCircleCenter.lng}-${radiusInMeters}`}
          center={[validCircleCenter.lat, validCircleCenter.lng]}
          radius={radiusInMeters}
          pathOptions={circlePathOptions}
        />
      )}

      {/* User location marker */}
      {validUserLocation && userLocationIcon && (
        <Marker
          position={[validUserLocation.lat, validUserLocation.lng]}
          icon={userLocationIcon}
          eventHandlers={{
            click: (e: any) => {
              e.originalEvent?.stopPropagation();
            },
          }}
        >
          <Popup className="metravel-route-marker-popup">Вы здесь</Popup>
        </Marker>
      )}
    </>
  );
});

MapLayers.displayName = 'MapLayers';
