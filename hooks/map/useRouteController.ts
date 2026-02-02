/**
 * Route controller - manages route building, points, and actions
 * @module hooks/map/useRouteController
 */

import { useCallback, useEffect, useRef } from 'react';
import { CoordinateConverter } from '@/utils/coordinateConverter';
import { useRouteStoreAdapter } from '@/hooks/useRouteStoreAdapter';
import { useRouteStore } from '@/stores/routeStore';
import { logMessage } from '@/src/utils/logger';
import type { MapUiApi } from '@/src/types/mapUi';
import type { TravelCoords } from '@/src/types/types';

interface UseRouteControllerOptions {
  /**
   * Map UI API for controlling map view and popups
   */
  mapUiApi: MapUiApi | null;
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
  routeStorePoints: any[];

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
   * Full route coordinates
   */
  fullRouteCoords: [number, number][];

  /**
   * Set route points
   */
  setRoutePoints: (points: [number, number][], options?: any) => void;

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
   * Clear route
   */
  handleClearRoute: () => void;

  /**
   * Handle address select
   */
  handleAddressSelect: (address: string, coords: any, isStart: boolean) => void;

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
   * Handle map click (for route building)
   */
  handleMapClick: (lng: number, lat: number) => void;

  /**
   * Build route to specific travel item
   */
  buildRouteTo: (item: TravelCoords) => void;
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
  const { mapUiApi } = options;

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
    fullRouteCoords,
    setRoutePoints,
    setRouteDistance,
    setRouteDuration,
    setFullRouteCoords,
    handleClearRoute,
    handleAddressSelect,
    handleAddressClear,
    points: routeStorePoints,
    isBuilding: routingLoading,
    error: routingError,
    addPoint,
    updatePoint,
  } = routeStore;

  // Handle map click for route building
  const lastRouteClickRef = useRef<{ lng: number; lat: number; ts: number } | null>(null);

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

        // Read the latest store points (avoid stale closures).
        const currentPoints = useRouteStore.getState().points;

        // Native-like UX: keep only start + end points.
        // 1st click -> start, 2nd click -> end, 3rd click -> replace end.
        if (currentPoints.length === 0) {
          addPoint(coords, address);
          return;
        }

        if (currentPoints.length === 1) {
          addPoint(coords, address);
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
      }
    },
    [mode, addPoint, routeStore, updatePoint]
  );

  // Build route to travel item
  const buildRouteTo = useCallback(
    (item: TravelCoords) => {
      if (!item?.coord) return;
      const rawCoordStr = String(item.coord);
      const cleanedCoordStr = rawCoordStr.replace(/;/g, ',').replace(/\s+/g, '');
      const parsed = CoordinateConverter.fromLooseString(cleanedCoordStr);
      // Keep the focus string normalized for stable zooming.
      const coordStr = parsed ? CoordinateConverter.toString(parsed) : cleanedCoordStr;

      // Popup matching can be sensitive to exact string keys (e.g. full precision).
      // Try a small set of candidates in a stable order.
      const popupCoordCandidates = Array.from(
        new Set([cleanedCoordStr, rawCoordStr, coordStr].filter(Boolean))
      );

      try {
        mapUiApi?.focusOnCoord?.(coordStr, { zoom: 14 });
      } catch {
        // noop
      }

      try {
        // Open popup after the map starts moving so user immediately sees the exact point.
        setTimeout(() => {
          for (const candidate of popupCoordCandidates) {
            try {
              mapUiApi?.openPopupForCoord?.(candidate);
            } catch {
              // noop
            }
          }
        }, 420);
      } catch {
        // noop
      }
    },
    [mapUiApi]
  );

  // Automatically build route when points are added
  const lastPointsCountRef = useRef(0);
  useEffect(() => {
    if (mode === 'route' && routeStorePoints.length >= 2) {
      // Only trigger if the number of points actually changed
      if (lastPointsCountRef.current !== routeStorePoints.length) {
        lastPointsCountRef.current = routeStorePoints.length;

        const points: [number, number][] = routeStorePoints.map((p) => [
          p.coordinates.lng,
          p.coordinates.lat,
        ]);
        console.info('[useRouteController] Auto-building route with points:', points);
        setRoutePoints(points);
      }
    } else {
      lastPointsCountRef.current = 0;
    }
  }, [mode, routeStorePoints.length, routeStorePoints, setRoutePoints]);

  return {
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
    fullRouteCoords,
    setRoutePoints,
    setRouteDistance,
    setRouteDuration,
    setFullRouteCoords,
    handleClearRoute,
    handleAddressSelect,
    handleAddressClear,
    onRemoveRoutePoint: routeStore.removePoint,
    swapStartEnd: routeStore.swapStartEnd,
    routingLoading,
    routingError,
    handleMapClick,
    buildRouteTo,
  };
}
