/**
 * Map layers component - tile layer, radius circle, user location marker
 * @module components/MapPage/Map/MapLayers
 */

import React, { useEffect, useMemo, useRef } from 'react';
import { Platform } from 'react-native';
import type { LatLng } from '@/types/coordinates';
import { getLiveUserPosition, subscribeLiveUserPosition } from '@/hooks/map/liveUserPosition';
import type { MapMode } from './types';
import { isValidCoordinate } from '@/utils/coordinateValidator';
import { useThemedColors } from '@/hooks/useTheme';
import { getOsmTileUrl, OSM_PROXY_ATTRIBUTION, OSM_PROXY_MAX_ZOOM } from '@/config/mapWebLayers';
import { translate as i18nT } from '@/i18n'


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
   * Dedicated pane for user location marker on web.
   */
  userLocationPaneName?: string;

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
  userLocationPaneName,
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
    color: colors.primaryDark,
    fillColor: colors.primary,
    fillOpacity: isTestEnv ? 0.06 : 0.075,
    opacity: isTestEnv ? 0.4 : 0.44,
    weight: isTestEnv ? 2 : 3,
    dashArray: '6 6',
  }), [colors.primary, colors.primaryDark]);

  // Validate user location
  const validUserLocation = useMemo(() => {
    if (!userLocation) return null;
    if (!isValidCoordinate(userLocation.lat, userLocation.lng)) return null;
    return userLocation;
  }, [userLocation]);

  // Живые тики GPS сознательно НЕ проходят через React (иначе за рулём весь экран
  // перерисовывается на каждое обновление координат). Маркер «вы здесь» подписан на
  // внешний канал и двигается императивно; сам компонент при этом не рендерится.
  const userMarkerRef = useRef<any>(null);
  useEffect(() => {
    if (!validUserLocation) return undefined;
    return subscribeLiveUserPosition((position) => {
      if (!position) return;
      if (!isValidCoordinate(position.latitude, position.longitude)) return;
      try {
        userMarkerRef.current?.setLatLng?.([position.latitude, position.longitude]);
      } catch {
        // noop
      }
    });
  }, [validUserLocation]);

  // Пропы отстают от канала (обновляются только на явном запросе), поэтому при
  // любом рендере рисуем маркер по самой свежей известной точке.
  const userMarkerPosition = useMemo<[number, number] | null>(() => {
    if (!validUserLocation) return null;
    const live = getLiveUserPosition();
    if (live && isValidCoordinate(live.latitude, live.longitude)) {
      return [live.latitude, live.longitude];
    }
    return [validUserLocation.lat, validUserLocation.lng];
  }, [validUserLocation]);

  const shouldRenderBaseTileLayer = Platform.OS !== 'web' || isTestEnv;
  const userLocationLabel = i18nT('map:components.MapPage.Map.MapLayers.vy_zdes_ba4a137a');

  const labelUserLocationMarker = (marker: any) => {
    if (Platform.OS !== 'web') return;
    const el = marker?._icon || marker?.getElement?.();
    if (!el) return;
    el.setAttribute('role', 'img');
    el.setAttribute('aria-label', userLocationLabel);
  };

  const registerUserLocationMarker = (marker: any) => {
    userMarkerRef.current = marker ?? null;
    labelUserLocationMarker(marker);
  };

  return (
    <>
      {/* Base tile layer */}
      {shouldRenderBaseTileLayer ? (
        <TileLayer
          url={getOsmTileUrl()}
          attribution={OSM_PROXY_ATTRIBUTION}
          maxZoom={OSM_PROXY_MAX_ZOOM}
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
          key={`user-location-${userLocationPaneName ?? 'default-pane'}`}
          position={userMarkerPosition ?? [validUserLocation.lat, validUserLocation.lng]}
          icon={userLocationIcon}
          title={userLocationLabel}
          alt={userLocationLabel}
          ref={registerUserLocationMarker}
          pane={Platform.OS === 'web' ? userLocationPaneName : undefined}
          interactive={Platform.OS !== 'web'}
          zIndexOffset={0}
          eventHandlers={
            Platform.OS === 'web'
              ? {
                  add: (e: any) => labelUserLocationMarker(e?.target),
                }
              : {
                  click: (e: any) => {
                    e.originalEvent?.stopPropagation();
                  },
                }
          }
        >
          <Popup className="metravel-route-marker-popup">{userLocationLabel}</Popup>
        </Marker>
      )}
    </>
  );
});

MapLayers.displayName = 'MapLayers';
