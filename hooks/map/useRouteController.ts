/**
 * Route controller - manages route building, points, and actions
 * @module hooks/map/useRouteController
 */

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { CoordinateConverter } from '@/utils/coordinateConverter';
import { CLUSTER_DISABLE_ZOOM } from '@/components/MapPage/Map/clusterFitBounds';
import { useRouteStoreAdapter } from '@/hooks/useRouteStoreAdapter';
import { useRouteStore } from '@/stores/routeStore';
import { useBottomSheetStore } from '@/stores/bottomSheetStore';
import { useMapPanelStore } from '@/stores/mapPanelStore';
import { logMessage } from '@/utils/logger';
import { showRoutePointAddedToast } from '@/utils/mapToasts';
import type { MapUiApi } from '@/types/mapUi';
import type { LatLng } from '@/types/coordinates';
import type { RoutePoint } from '@/types/route';
import type { TravelCoords } from '@/types/types';
import { translate as i18nT } from '@/i18n'


interface UseRouteControllerOptions {
  /**
   * Map UI API for controlling map view and popups
   */
  mapUiApi: MapUiApi | null;
  /**
   * Current user/search origin used when building a route from a nearby card.
   */
  originCoordinates?: { latitude: number; longitude: number } | null;
}

interface UseRouteControllerResult {
  /**
   * Current map mode
   */
  mode: 'radius' | 'route';

  /**
   * Set map mode
   */
  setMode: (mode: 'radius' | 'route') => void;

  /**
   * Transport mode
   */
  transportMode: 'car' | 'bike' | 'foot';

  /**
   * Set transport mode
   */
  setTransportMode: (mode: 'car' | 'bike' | 'foot') => void;

  /**
   * Route points (tuples [lng, lat])
   */
  routePoints: [number, number][];

  /**
   * Route store points (with metadata)
   */
  routeStorePoints: RoutePoint[];

  /**
   * Start address
   */
  startAddress: string;

  /**
   * End address
   */
  endAddress: string;

  /**
   * Route distance in meters
   */
  routeDistance: number | null;

  /**
   * Route duration in seconds
   */
  routeDuration: number | null;

  /**
   * Route elevation gain in meters (bike/foot)
   */
  routeElevationGain: number | null;

  /**
   * Route elevation loss in meters (bike/foot)
   */
  routeElevationLoss: number | null;

  /**
   * Full route coordinates
   */
  fullRouteCoords: [number, number][];

  /**
   * Set route points
   */
  setRoutePoints: (points: [number, number][], options?: { force?: boolean }) => void;

  /**
   * Set route distance
   */
  setRouteDistance: (distance: number) => void;

  /**
   * Set route duration (seconds)
   */
  setRouteDuration: (durationSeconds: number) => void;

  /**
   * Set full route coordinates
   */
  setFullRouteCoords: (coords: [number, number][]) => void;

  /**
   * Set elevation gain/loss (meters)
   */
  setRouteElevationStats: (gainMeters: number | null, lossMeters: number | null) => void;

  /**
   * Clear route
   */
  handleClearRoute: () => void;

  /**
   * Handle address select
   */
  handleAddressSelect: (address: string, coords: LatLng, isStart: boolean) => void;

  /**
   * Handle address clear
   */
  handleAddressClear: (isStart: boolean) => void;

  /**
   * Remove route point
   */
  onRemoveRoutePoint: (id: string) => void;

  /**
   * Swap start and end
   */
  swapStartEnd: () => void;

  /**
   * Is building route
   */
  routingLoading: boolean;

  /**
   * Routing error
   */
  routingError: string | boolean | null;

  /**
   * Set routing loading state
   */
  setRoutingLoading: (loading: boolean) => void;

  /**
   * Set routing error (null to clear)
   */
  setRoutingError: (error: string | null) => void;

  /**
   * Handle map click (for route building)
   */
  handleMapClick: (lng: number, lat: number) => void;

  /**
   * Build route to specific travel item
   */
  buildRouteTo: (item: TravelCoords) => void;

  /**
   * Add a travel item as the next route point without opening place popups.
   */
  addRoutePointFromTravel: (item: TravelCoords) => void;

  /**
   * Focus the map on a travel item (center + open popup) without switching mode
   */
  focusPlace: (item: TravelCoords) => void;
}

type FocusTarget = {
  coordStr: string;
  popupCoordCandidates: string[];
  targetCoords: { lat: number; lng: number } | null;
};

function resolveFocusTarget(item: TravelCoords): FocusTarget | null {
  if (!item?.coord) return null;
  const rawCoordStr = String(item.coord);
  const cleanedCoordStr = rawCoordStr.replace(/;/g, ',').replace(/\s+/g, '');
  const parsed = CoordinateConverter.fromLooseString(cleanedCoordStr);
  // Keep the focus string normalized for stable zooming.
  const coordStr = parsed ? CoordinateConverter.toString(parsed) : cleanedCoordStr;
  const targetCoords = parsed ? { lat: parsed.lat, lng: parsed.lng } : null;

  // Popup matching can be sensitive to exact string keys (e.g. full precision).
  // Try a small set of candidates in a stable order.
  const popupCoordCandidates = Array.from(
    new Set([cleanedCoordStr, rawCoordStr, coordStr].filter(Boolean))
  );

  return { coordStr, popupCoordCandidates, targetCoords };
}

/**
 * Manages route building, points, and related actions
 *
 * Features:
 * - Route point management (add, remove, swap)
 * - Map click handling for route building
 * - Build route to specific travel
 * - Auto-build route when points change
 * - Transport mode selection
 *
 * @example
 * ```typescript
 * const {
 *   mode,
 *   setMode,
 *   routePoints,
 *   handleMapClick,
 *   buildRouteTo,
 * } = useRouteController({ mapUiApi });
 * ```
 */
export function useRouteController(
  options: UseRouteControllerOptions
): UseRouteControllerResult {
  const { mapUiApi, originCoordinates } = options;

  // Route store
  const routeStore = useRouteStoreAdapter();
  const {
    mode,
    setMode,
    transportMode,
    setTransportMode,
    routePoints,
    startAddress,
    endAddress,
    routeDistance,
    routeDuration,
    routeElevationGain,
    routeElevationLoss,
    fullRouteCoords,
    setRoutePoints,
    setRouteDistance,
    setRouteDuration,
    setFullRouteCoords,
    setRouteElevationStats,
    handleClearRoute,
    handleAddressSelect,
    handleAddressClear,
    points: routeStorePoints,
    isBuilding: routingLoading,
    error: routingError,
    setBuilding,
    setError,
    addPoint,
    updatePoint,
  } = routeStore;

  // Handle map click for route building
  const lastRouteClickRef = useRef<{ lng: number; lat: number; ts: number } | null>(null);
  const popupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Снимаем отложенное открытие попапа при unmount — иначе колбэк дёргает
  // mapUiApi на возможно уже снятой карте после teardown.
  useEffect(() => {
    return () => {
      if (popupTimerRef.current) {
        clearTimeout(popupTimerRef.current);
        popupTimerRef.current = null;
      }
    };
  }, []);

  const addOrReplaceRoutePoint = useCallback(
    (coords: LatLng, address: string) => {
      setMode('route');

      // Read the latest store points (avoid stale closures).
      const currentPoints = useRouteStore.getState().points;

      // Native-like UX: keep only start + end points.
      // 1st click -> start, 2nd click -> end, 3rd click -> replace end.
      if (currentPoints.length === 0) {
        addPoint(coords, address);
        showRoutePointAddedToast(1, true);
        return;
      }

      if (currentPoints.length === 1) {
        addPoint(coords, address);
        showRoutePointAddedToast(2, false);
        return;
      }

      const endPoint = currentPoints[currentPoints.length - 1];
      const startPoint = currentPoints[0];

      // If we somehow have more than 2 points, reset to start + new end.
      if (currentPoints.length > 2) {
        const startCoords = startPoint?.coordinates;
        const startAddr = startPoint?.address;
        routeStore.clearRoute();
        if (startCoords && startAddr) {
          addPoint(startCoords, startAddr);
        }
        addPoint(coords, address);
        return;
      }

      if (endPoint) {
        updatePoint(endPoint.id, { coordinates: coords, address });
        return;
      }

      addPoint(coords, address);
    },
    [addPoint, routeStore, setMode, updatePoint]
  );

  const handleMapClick = useCallback(
    (lng: number, lat: number) => {
      if (
        !Number.isFinite(lng) ||
        !Number.isFinite(lat) ||
        lng < -180 ||
        lng > 180 ||
        lat < -90 ||
        lat > 90
      ) {
        logMessage('[map] Invalid coordinates received', 'warning', { scope: 'map', lng, lat });
        return;
      }

      if (mode === 'route') {
        // Guard against duplicate click events fired by the map layer.
        const now = Date.now();
        const prev = lastRouteClickRef.current;
        if (
          prev &&
          now - prev.ts < 250 &&
          Math.abs(prev.lng - lng) < 0.000001 &&
          Math.abs(prev.lat - lat) < 0.000001
        ) {
          return;
        }
        lastRouteClickRef.current = { lng, lat, ts: now };

        const coords = { lat, lng };
        const address = CoordinateConverter.formatCoordinates(coords);

        addOrReplaceRoutePoint(coords, address);
      }
    },
    [mode, addOrReplaceRoutePoint]
  );

  const addRoutePointFromTravel = useCallback(
    (item: TravelCoords) => {
      const target = resolveFocusTarget(item);
      if (!target?.targetCoords) return;
      const { coordStr, targetCoords } = target;
      const labels = item as TravelCoords & { name?: string; title?: string };
      const address = String(
        item.address ||
          labels.name ||
          labels.title ||
          CoordinateConverter.formatCoordinates(targetCoords),
      );

      addOrReplaceRoutePoint(targetCoords, address);

      try {
        mapUiApi?.focusOnCoord?.(coordStr, { zoom: CLUSTER_DISABLE_ZOOM });
      } catch {
        // noop
      }
    },
    [addOrReplaceRoutePoint, mapUiApi]
  );

  // Build route to travel item
  const buildRouteTo = useCallback(
    (item: TravelCoords) => {
      const target = resolveFocusTarget(item);
      if (!target) return;
      const { coordStr, popupCoordCandidates, targetCoords } = target;
      const bottomSheetStore = useBottomSheetStore.getState();
      const shouldCollapseBottomSheet = bottomSheetStore.state !== 'collapsed';
      const originCoords =
        originCoordinates &&
        Number.isFinite(originCoordinates.latitude) &&
        Number.isFinite(originCoordinates.longitude)
          ? { lat: originCoordinates.latitude, lng: originCoordinates.longitude }
          : null;

      const popupOpenDelayMs = shouldCollapseBottomSheet ? 520 : 420;

      if (shouldCollapseBottomSheet) {
        try {
          useMapPanelStore.getState().requestCollapse();
        } catch {
          // noop
        }
      }

      if (targetCoords) {
        // Списки мест могут отдавать name/title сверх базового TravelCoords.
        const labels = item as TravelCoords & { name?: string; title?: string };
        try {
          setMode('route');
          routeStore.clearRoute();
          if (originCoords) {
            addPoint(originCoords, i18nT('map:hooks.map.useRouteController.moe_mestopolozhenie_64cab0dd'));
          }
          addPoint(
            targetCoords,
            String(
              item.address ||
                labels.name ||
                labels.title ||
                CoordinateConverter.formatCoordinates(targetCoords),
            ),
          );
        } catch {
          // noop
        }
      }

      try {
        mapUiApi?.focusOnCoord?.(coordStr, { zoom: 14 });
      } catch {
        // noop
      }

      try {
        // Open popup after the map starts moving so user immediately sees the exact point.
        if (popupTimerRef.current) clearTimeout(popupTimerRef.current);
        popupTimerRef.current = setTimeout(() => {
          popupTimerRef.current = null;
          for (const candidate of popupCoordCandidates) {
            try {
              mapUiApi?.openPopupForCoord?.(candidate);
            } catch {
              // noop
            }
          }
        }, popupOpenDelayMs);
      } catch {
        // noop
      }
    },
    [addPoint, mapUiApi, originCoordinates, routeStore, setMode]
  );

  // Focus the map on a travel item WITHOUT switching mode or touching the route.
  // Used by list-card taps: in radius mode building a route would clear the
  // nearby results (enabledRoute=false) and the target marker would vanish, so
  // the popup could never open. Here we only center + open the popup.
  const focusPlace = useCallback(
    (item: TravelCoords) => {
      const target = resolveFocusTarget(item);
      if (!target) return;
      const { coordStr, popupCoordCandidates } = target;
      const bottomSheetStore = useBottomSheetStore.getState();
      const shouldCollapseBottomSheet = bottomSheetStore.state !== 'collapsed';
      const popupOpenDelayMs = shouldCollapseBottomSheet ? 520 : 420;

      if (shouldCollapseBottomSheet) {
        try {
          useMapPanelStore.getState().requestCollapse();
        } catch {
          // noop
        }
      }

      try {
        // Зум фокуса >= CLUSTER_DISABLE_ZOOM, чтобы маркер вышел из кластера и
        // попап реально открылся (кластеризация отключается только на zoom >= 16).
        mapUiApi?.focusOnCoord?.(coordStr, { zoom: CLUSTER_DISABLE_ZOOM });
      } catch {
        // noop
      }

      try {
        if (popupTimerRef.current) clearTimeout(popupTimerRef.current);
        popupTimerRef.current = setTimeout(() => {
          popupTimerRef.current = null;
          for (const candidate of popupCoordCandidates) {
            try {
              mapUiApi?.openPopupForCoord?.(candidate);
            } catch {
              // noop
            }
          }
        }, popupOpenDelayMs);
      } catch {
        // noop
      }
    },
    [mapUiApi]
  );

  return useMemo(() => ({
    mode,
    setMode,
    transportMode,
    setTransportMode,
    routePoints,
    routeStorePoints,
    startAddress,
    endAddress,
    routeDistance,
    routeDuration,
    routeElevationGain,
    routeElevationLoss,
    fullRouteCoords,
    setRoutePoints,
    setRouteDistance,
    setRouteDuration,
    setFullRouteCoords,
    setRouteElevationStats,
    handleClearRoute,
    handleAddressSelect,
    handleAddressClear,
    onRemoveRoutePoint: routeStore.removePoint,
    swapStartEnd: routeStore.swapStartEnd,
    routingLoading,
    routingError,
    setRoutingLoading: setBuilding,
    setRoutingError: setError,
    handleMapClick,
    buildRouteTo,
    addRoutePointFromTravel,
    focusPlace,
  }), [
    mode,
    setMode,
    transportMode,
    setTransportMode,
    routePoints,
    routeStorePoints,
    startAddress,
    endAddress,
    routeDistance,
    routeDuration,
    routeElevationGain,
    routeElevationLoss,
    fullRouteCoords,
    setRoutePoints,
    setRouteDistance,
    setRouteDuration,
    setFullRouteCoords,
    setRouteElevationStats,
    handleClearRoute,
    handleAddressSelect,
    handleAddressClear,
    routeStore.removePoint,
    routeStore.swapStartEnd,
    routingLoading,
    routingError,
    setBuilding,
    setError,
    handleMapClick,
    buildRouteTo,
    addRoutePointFromTravel,
    focusPlace,
  ]);
}
