import { useEffect, useMemo, type MutableRefObject } from 'react';

import type { MapClustersFilters } from '@/api/map';
import { DEFAULT_RADIUS_KM } from '@/constants/mapConfig';
import { useMapClusters } from '@/hooks/map/useMapClusters';
import { useMapViewportSnapshot } from '@/hooks/map/useMapViewportSnapshot';
import { CoordinateConverter } from '@/utils/coordinateConverter';
import type { Coordinates, MapMode, Point } from './types';
import { strToLatLng } from './utils';
import { useMapUserLocation } from './useMapUserLocation';
import {
  buildServerClusterRenderData,
  filterServerClusterRenderDataByRadius,
  getRadiusFilterLimit,
} from './serverClusterRenderData';

type SafeCoordinates = Coordinates & { zoom: number };

type UseMapRenderDataArgs = {
  travelData: Point[];
  safeCoordinates: SafeCoordinates;
  coordinates: Coordinates;
  providedUserLocation?: Coordinates | null;
  coordinatesAreFallback?: boolean;
  mapRef: MutableRefObject<any>;
  markerByCoordRef: MutableRefObject<Map<string, any>>;
  onUserLocationChange?: (coordinates: Coordinates | null) => void;
  onRequestUserLocation?: () => void | Promise<void>;
  mode: MapMode;
  radius?: string;
  pointsOnly: boolean;
  mapInstance: any;
  leafletReady: boolean;
  leafletRuntimeReady: boolean;
  mapClusterFilters?: MapClustersFilters;
  categoryFilterUnresolved: boolean;
  /**
   * Freeze the server-cluster refetch (keeps the last data, no new query) while a
   * marker popup is open. A marker tap flies/zooms the map → viewport bbox/zoom
   * change → cluster refetch → marker REMOUNT → the just-opened popup is destroyed
   * ("opens then instantly closes"). Freezing keeps the tapped marker mounted; the
   * clusters catch up to the settled viewport once the popup closes.
   */
  freezeServerClusters?: boolean;
};

export function useMapRenderData({
  travelData,
  safeCoordinates,
  coordinates,
  providedUserLocation,
  coordinatesAreFallback,
  mapRef,
  markerByCoordRef,
  onUserLocationChange,
  onRequestUserLocation,
  mode,
  radius,
  pointsOnly,
  mapInstance,
  leafletReady,
  leafletRuntimeReady,
  mapClusterFilters,
  categoryFilterUnresolved,
  freezeServerClusters = false,
}: UseMapRenderDataArgs) {
  const coordinatesLatLng = useMemo(
    () => ({ lat: safeCoordinates.latitude, lng: safeCoordinates.longitude }),
    [safeCoordinates.latitude, safeCoordinates.longitude],
  );

  const radiusInMeters = useMemo(() => {
    if (mode !== 'radius') return null;
    const radiusKm = parseInt(radius || String(DEFAULT_RADIUS_KM), 10);
    if (Number.isNaN(radiusKm) || radiusKm <= 0) return DEFAULT_RADIUS_KM * 1000;
    return radiusKm * 1000;
  }, [mode, radius]);

  const { centerOnUserLocation, userLocationLatLng } = useMapUserLocation({
    coordinates,
    providedUserLocation,
    coordinatesAreFallback,
    mapRef,
    onUserLocationChange,
    onRequestUserLocation,
  });

  const filterCenter = useMemo(() => {
    // `coordinates` is the active radius-search anchor. It initially matches
    // the user's position, but after "Search this area" it is the map center the
    // user explicitly chose. Keep the real user location separate: it owns only
    // the blue marker and the explicit locate action, and must not pull radius
    // filtering back to GPS.
    const center = coordinatesLatLng;
    if (!center || !Number.isFinite(center.lat) || !Number.isFinite(center.lng)) return null;
    return {
      lat: Math.round(center.lat * 1000) / 1000,
      lng: Math.round(center.lng * 1000) / 1000,
    };
  }, [coordinatesLatLng]);

  const filteredTravelData = useMemo(() => {
    if (mode !== 'radius' || pointsOnly || travelData.length === 0) return travelData;

    const center = filterCenter ?? coordinatesLatLng;
    const hasValidCenter = CoordinateConverter.isValid(center);
    const hasValidRadius = Number.isFinite(radiusInMeters) && radiusInMeters != null && radiusInMeters > 0;
    const guardRadius = hasValidCenter && hasValidRadius
      ? getRadiusFilterLimit(radiusInMeters)
      : null;

    return travelData.filter((point) => {
      try {
        const latLng = strToLatLng(String(point?.coord ?? ''), hasValidCenter ? center : null);
        if (!latLng) return false;
        const pointCoordinates = { lat: latLng[1], lng: latLng[0] };
        if (!CoordinateConverter.isValid(pointCoordinates)) return false;
        if (guardRadius == null) return true;
        const distance = CoordinateConverter.distance(center, pointCoordinates);
        return Number.isFinite(distance) && distance <= guardRadius;
      } catch {
        return false;
      }
    });
  }, [coordinatesLatLng, filterCenter, mode, pointsOnly, radiusInMeters, travelData]);

  useEffect(() => {
    const markerIndex = markerByCoordRef.current;
    return () => markerIndex.clear();
  }, [filteredTravelData, markerByCoordRef]);

  const canRenderMap = leafletReady && leafletRuntimeReady;
  const viewportSnapshot = useMapViewportSnapshot(
    mapInstance,
    safeCoordinates.zoom,
    mode === 'radius' && !pointsOnly && canRenderMap,
  );
  const serverClusterQuery = useMapClusters({
    bbox: viewportSnapshot.bbox,
    zoom: viewportSnapshot.zoom,
    filters: mapClusterFilters,
    // While a popup is open we freeze the query (enabled=false). react-query keeps
    // the last data (placeholderData), so `serverClusters` stays referentially
    // stable → ClusterLayer does not remount markers → the open popup survives the
    // marker-tap fly/zoom. On popupclose the query re-enables and catches up to the
    // settled viewport.
    enabled: mode === 'radius' && !pointsOnly && canRenderMap && !freezeServerClusters,
  });
  const serverClusterRenderData = useMemo(
    () => buildServerClusterRenderData(serverClusterQuery.data),
    [serverClusterQuery.data],
  );
  const radiusFilteredServerClusterRenderData = useMemo(() => {
    const center = filterCenter ?? coordinatesLatLng;
    return mode === 'radius'
      ? filterServerClusterRenderDataByRadius(serverClusterRenderData, center, radiusInMeters)
      : serverClusterRenderData;
  }, [coordinatesLatLng, filterCenter, mode, radiusInMeters, serverClusterRenderData]);

  const shouldUseServerClusterData =
    mode === 'radius' &&
    !serverClusterQuery.isError &&
    radiusFilteredServerClusterRenderData.hasServerData &&
    !categoryFilterUnresolved;

  return {
    canRenderMap,
    centerOnUserLocation,
    coordinatesLatLng,
    filterCenter,
    filteredTravelData,
    radiusInMeters,
    renderedMarkers:
      shouldUseServerClusterData && radiusFilteredServerClusterRenderData.markers.length > 0
        ? radiusFilteredServerClusterRenderData.markers
        : filteredTravelData,
    renderedServerClusters:
      shouldUseServerClusterData && radiusFilteredServerClusterRenderData.clusters.length > 0
        ? radiusFilteredServerClusterRenderData.clusters
        : [],
    userLocationLatLng,
  };
}
