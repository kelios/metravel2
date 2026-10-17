import { useEffect, useMemo, useRef, type MutableRefObject } from 'react';

import type { MapClustersFilters } from '@/api/map';
import { DEFAULT_RADIUS_KM } from '@/constants/mapConfig';
import { useMapClusters } from '@/hooks/map/useMapClusters';
import { useMapViewportSnapshot } from '@/hooks/map/useMapViewportSnapshot';
import { CoordinateConverter } from '@/utils/coordinateConverter';
import type { ClusterData, Coordinates, MapMode, Point } from './types';
import { getMapPointContentKey, strToLatLng } from './utils';
import { useMapUserLocation } from './useMapUserLocation';
import {
  buildServerClusterRenderData,
  filterServerClusterRenderDataByRadius,
  getRadiusFilterLimit,
  splitSingletonClusters,
} from './serverClusterRenderData';

type SafeCoordinates = Coordinates & { zoom: number };

/**
 * #1347 — the server-cluster query re-keys on every viewport change, so react-query
 * hands back a NEW data object even when the visible points are identical. That new
 * identity propagated into `renderedMarkers` / `renderedServerClusters` and made the
 * Leaflet layers rebuild every marker on every pan. Keep the previous array whenever
 * the rendered content is the same, so identity means "the points actually changed".
 */
function useStableByContent<T>(value: T[], signature: string): T[] {
  const ref = useRef<{ signature: string; value: T[] }>({ signature, value });
  if (ref.current.signature !== signature) {
    ref.current = { signature, value };
  }
  return ref.current.value;
}

/**
 * The signature must cover everything the layers actually render, not just identity:
 * a refetch that returns the same place with a new address/thumb/link would otherwise
 * be frozen out and the map would keep showing stale content until a reload.
 */
const markersSignature = (points: Point[]): string =>
  points.map(getMapPointContentKey).join('|');

const clustersSignature = (clusters: ClusterData[]): string =>
  clusters
    .map((cluster) => {
      const [[south, west], [north, east]] = cluster.bounds;
      // Bounds belong in the signature: a cluster tap fits the map to them, so a
      // stale frame would zoom to the wrong area.
      return `${cluster.key}:${cluster.count}@${cluster.center[0]},${cluster.center[1]}~${south},${west},${north},${east}#${cluster.items.length}`;
    })
    .join('|');

const EMPTY_CLUSTERS: ClusterData[] = [];

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
  leafletReady: boolean;
  leafletRuntimeReady: boolean;
};

/**
 * Page-level render data of the web map. Viewport- and cluster-driven state is
 * deliberately NOT here (#2451): it lives in `useServerPlaceLayerData`, called
 * by a leaf component inside the MapContainer, so a viewport snapshot or a
 * cluster response re-renders only the place layers, not the whole Map.web tree
 * (controls, popup factory, routing, MapLogicComponent).
 */
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
  leafletReady,
  leafletRuntimeReady,
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

  // The marker index is owned by the layer that fills it (MarkerClusterGroup diffs
  // it). It used to be wiped wholesale whenever `filteredTravelData` changed, which
  // was only safe while the cluster layer rebuilt every marker right after and
  // re-registered them all. With the keyed diff (#1347) surviving markers are never
  // re-created, so that blanket clear left the index permanently empty and
  // `MapUiApi.openPopupForCoord` (tap a place card → open its popup) found nothing.
  useEffect(() => {
    const markerIndex = markerByCoordRef.current;
    return () => markerIndex.clear();
  }, [markerByCoordRef]);

  return {
    canRenderMap: leafletReady && leafletRuntimeReady,
    centerOnUserLocation,
    coordinatesLatLng,
    filterCenter,
    filteredTravelData,
    radiusInMeters,
    userLocationLatLng,
  };
}

type UseServerPlaceLayerDataArgs = {
  mapInstance: any;
  /** Zoom used until the map reports its own (cold start). */
  fallbackZoom: number;
  mode: MapMode;
  pointsOnly: boolean;
  canRenderMap: boolean;
  /** Client points (already radius-filtered) — the fallback when the backend has nothing. */
  travelData: Point[];
  /** Radius filter anchor (rounded `filterCenter`, or the raw center). */
  radiusCenter: { lat: number; lng: number } | null;
  radiusInMeters: number | null;
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

/**
 * Leaf-level data of the place layers: viewport snapshot → backend clusters →
 * `{ markers, clusters }`.
 *
 * Contract (#2451):
 * - `clusters` — backend clusters of 2+ points for the imperative
 *   ServerClusterLayer (geometric keys, see `serverClusterRenderData`);
 * - `markers` — every individual place for MarkerClusterGroup: backend markers
 *   plus single-point backend clusters, or the client points when the backend has
 *   no usable data (error, unresolved category, route mode, empty response).
 * Both layers stay mounted, so crossing the backend's cluster/marker zoom
 * threshold diffs items in place instead of swapping whole layers.
 */
export function useServerPlaceLayerData({
  mapInstance,
  fallbackZoom,
  mode,
  pointsOnly,
  canRenderMap,
  travelData,
  radiusCenter,
  radiusInMeters,
  mapClusterFilters,
  categoryFilterUnresolved,
  freezeServerClusters = false,
}: UseServerPlaceLayerDataArgs) {
  const serverEnabled = mode === 'radius' && !pointsOnly && canRenderMap;
  const viewportSnapshot = useMapViewportSnapshot(mapInstance, fallbackZoom, serverEnabled);
  const serverClusterQuery = useMapClusters({
    bbox: viewportSnapshot.bbox,
    zoom: viewportSnapshot.zoom,
    filters: mapClusterFilters,
    // While a popup is open we freeze the query (enabled=false). react-query keeps
    // the last data (placeholderData), so the rendered items stay referentially
    // stable and the open popup survives the marker-tap fly/zoom. On popupclose the
    // query re-enables and catches up to the settled viewport.
    enabled: serverEnabled && !freezeServerClusters,
  });
  const serverClusterRenderData = useMemo(
    () => buildServerClusterRenderData(serverClusterQuery.data),
    [serverClusterQuery.data],
  );
  const radiusFilteredServerClusterRenderData = useMemo(
    () =>
      mode === 'radius'
        ? filterServerClusterRenderDataByRadius(serverClusterRenderData, radiusCenter, radiusInMeters)
        : serverClusterRenderData,
    [mode, radiusCenter, radiusInMeters, serverClusterRenderData],
  );

  const shouldUseServerClusterData =
    mode === 'radius' &&
    !serverClusterQuery.isError &&
    radiusFilteredServerClusterRenderData.hasServerData &&
    !categoryFilterUnresolved;

  const { nextMarkers, nextClusters } = useMemo(() => {
    if (!shouldUseServerClusterData) {
      return { nextMarkers: travelData, nextClusters: EMPTY_CLUSTERS };
    }
    const { clusters, singletons } = splitSingletonClusters(
      radiusFilteredServerClusterRenderData.clusters,
    );
    const serverMarkers = radiusFilteredServerClusterRenderData.markers;
    return {
      nextMarkers: singletons.length ? [...serverMarkers, ...singletons] : serverMarkers,
      nextClusters: clusters.length ? clusters : EMPTY_CLUSTERS,
    };
  }, [radiusFilteredServerClusterRenderData, shouldUseServerClusterData, travelData]);

  // Signatures are O(n) string building — key them on array identity, the only
  // thing that can change what the signature says.
  const markersSig = useMemo(() => markersSignature(nextMarkers), [nextMarkers]);
  const clustersSig = useMemo(() => clustersSignature(nextClusters), [nextClusters]);
  const markers = useStableByContent(nextMarkers, markersSig);
  const clusters = useStableByContent(nextClusters, clustersSig);

  return { markers, clusters };
}
