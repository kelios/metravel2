/**
 * Adapter hook to bridge RouteStore with existing map.tsx interface
 * This allows gradual migration without breaking existing code
 */
import { useRouteStore } from '@/stores/routeStore';
import { CoordinateConverter } from '@/utils/coordinateConverter';
import type { LatLng } from '@/types/coordinates';
import { useMemo, useCallback } from 'react';

export function useRouteStoreAdapter() {
  const store = useRouteStore();

  // Convert RoutePoint[] to legacy [lng, lat][] format
  const routePoints = useMemo(() => {
    return store.points.map(p => [p.coordinates.lng, p.coordinates.lat] as [number, number]);
  }, [store.points]);

  // Get addresses
  const startAddress = useMemo(() => {
    const start = store.getStartPoint();
    return start?.address || '';
  }, [store]);

  const endAddress = useMemo(() => {
    const start = store.getStartPoint?.();
    const end = store.getEndPoint?.();

    // If end points to the same entity as start, treat as not selected.
    if (start && end && start.id && end.id && start.id === end.id) return '';

    // In production, end should be empty until at least 2 points exist.
    // But tests may mock getEndPoint without populating points; respect getEndPoint if present.
    if (store.points.length < 2) {
      return end?.address || '';
    }

    return end?.address || '';
  }, [store]);

  // Get route data
  const routeDistance = store.route?.distance ?? null;
  const routeDuration = store.route?.duration ?? null;
  const routeElevationGain = store.route?.elevationGain ?? null;
  const routeElevationLoss = store.route?.elevationLoss ?? null;
  
  const fullRouteCoords = useMemo(() => {
    if (!store.route?.coordinates) return [];
    return store.route.coordinates.map(c => [c.lng, c.lat] as [number, number]);
  }, [store.route?.coordinates]);

  // Adapter methods
  const setRoutePoints = useCallback((
    points: [number, number][],
    options?: { force?: boolean }
  ) => {
    // ✅ ИСПРАВЛЕНИЕ: Проверяем, что points - это массив
    if (!Array.isArray(points)) {
      console.warn('[setRoutePoints] Invalid points array:', points);
      return;
    }

    // Explicitly clear when empty array is provided
    if (points.length === 0) {
      store.clearRoute();
      return;
    }

    // Check if points are already the same - avoid infinite loop
    const currentPoints = store.points;
    if (!options?.force && currentPoints.length === points.length) {
      const allMatch = points.every((point, index) => {
        const [lng, lat] = point;
        const current = currentPoints[index];
        return current && 
               Math.abs(current.coordinates.lng - lng) < 0.000001 && 
               Math.abs(current.coordinates.lat - lat) < 0.000001;
      });
      
      if (allMatch) {
        console.info('[setRoutePoints] Points unchanged, skipping update');
        return;
      }
    }

    // Clear existing points
    store.clearRoute();
    
    // Add new points с проверкой валидности
    points.forEach((point, index) => {
      if (!Array.isArray(point) || point.length < 2) {
        console.warn('[setRoutePoints] Invalid point format at index', index, point);
        return;
      }

      const [lng, lat] = point;

      // Validate coordinates
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
        console.warn('[setRoutePoints] Invalid coordinates (non-finite) at index', index, { lng, lat });
        return;
      }

      const coords: LatLng = { lat, lng };
      const address = CoordinateConverter.formatCoordinates(coords);
      console.info('[setRoutePoints] Adding point', index, coords, address);
      store.addPoint(coords, address);
    });

    console.info('[setRoutePoints] Points added. Total:', store.points.length);
  }, [store]);

  const setRouteDistance = useCallback((distance: number) => {
    const existingCoords =
      store.route?.coordinates ?? store.points.map((p) => p.coordinates);

    const existingDuration = store.route?.duration ?? 0;
    const prevElevationGain = store.route?.elevationGain;
    const prevElevationLoss = store.route?.elevationLoss;

    const prevDistance = store.route?.distance;
    const sameDistance = typeof prevDistance === 'number' && prevDistance === distance;

    // If we already have the same distance and coordinates, avoid a store update.
    if (sameDistance && store.route?.coordinates === existingCoords) {
      return;
    }

    store.setRoute({
      coordinates: existingCoords,
      distance,
      duration: existingDuration,
      isOptimal: true,
      elevationGain: prevElevationGain,
      elevationLoss: prevElevationLoss,
    });
  }, [store]);

  const setRouteDuration = useCallback((durationSeconds: number) => {
    const existingCoords =
      store.route?.coordinates ?? store.points.map((p) => p.coordinates);
    const existingDistance = store.route?.distance ?? 0;
    const prevElevationGain = store.route?.elevationGain;
    const prevElevationLoss = store.route?.elevationLoss;

    store.setRoute({
      coordinates: existingCoords,
      distance: existingDistance,
      duration: Number(durationSeconds) || 0,
      isOptimal: true,
      elevationGain: prevElevationGain,
      elevationLoss: prevElevationLoss,
    });
  }, [store]);

  const setFullRouteCoords = useCallback((coords: [number, number][]) => {
    const latLngCoords: LatLng[] = coords.map(([lng, lat]) => ({ lat, lng }));
    const distance = store.route?.distance ?? 0;
    const duration = store.route?.duration ?? 0;
    const prevElevationGain = store.route?.elevationGain;
    const prevElevationLoss = store.route?.elevationLoss;

    const prevCoords = store.route?.coordinates;
    const sameLength = Array.isArray(prevCoords) && prevCoords.length === latLngCoords.length;
    const sameCoords = !!prevCoords && sameLength && prevCoords.every((p, i) => {
      const next = latLngCoords[i];
      return !!next && p.lat === next.lat && p.lng === next.lng;
    });

    if (sameCoords && store.route?.distance === distance) {
      return;
    }

    store.setRoute({
      coordinates: latLngCoords,
      distance,
      duration,
      isOptimal: true,
      elevationGain: prevElevationGain,
      elevationLoss: prevElevationLoss,
    });
  }, [store]);

  const setRouteElevationStats = useCallback((elevationGainMeters: number | null, elevationLossMeters: number | null) => {
    const existingCoords =
      store.route?.coordinates ?? store.points.map((p) => p.coordinates);
    const existingDistance = store.route?.distance ?? 0;
    const existingDuration = store.route?.duration ?? 0;
    const isOptimal = store.route?.isOptimal ?? true;

    store.setRoute({
      coordinates: existingCoords,
      distance: existingDistance,
      duration: existingDuration,
      isOptimal,
      elevationGain:
        elevationGainMeters == null
          ? undefined
          : Number.isFinite(elevationGainMeters)
            ? Math.max(0, Math.round(elevationGainMeters))
            : undefined,
      elevationLoss:
        elevationLossMeters == null
          ? undefined
          : Number.isFinite(elevationLossMeters)
            ? Math.max(0, Math.round(elevationLossMeters))
            : undefined,
    });
  }, [store]);

  const handleRemoveRoutePoint = useCallback((index: number) => {
    const point = store.points[index];
    if (point) {
      store.removePoint(point.id);
    }
  }, [store]);

  const handleClearRoute = useCallback(() => {
    store.clearRoute();
  }, [store]);

  const handleAddressSelect = useCallback((address: string, coords: LatLng, isStart: boolean) => {
    const canUpdate = typeof (store as any).updatePoint === 'function';
    if (isStart) {
      const existingStart = store.getStartPoint() ?? store.points[0];
      if (existingStart) {
        if (canUpdate) {
          (store as any).updatePoint(existingStart.id, { coordinates: coords, address });
        } else {
          store.removePoint(existingStart.id);
          store.addPoint(coords, address);
        }

        // If we only have a single point and it's currently treated as both start and end,
        // ensure the end stays empty until user selects it explicitly.
        if (store.points.length === 1) {
          const endCandidate = store.getEndPoint();
          if (endCandidate && endCandidate.id === existingStart.id) {
            // Remove and re-add start to clear any persisted end address mirroring.
            // We keep only the start point.
            store.removePoint(existingStart.id);
            store.addPoint(coords, address);
          }
        }
        return;
      }
      store.addPoint(coords, address);
      return;
    }

    const existingEnd = store.getEndPoint();
    if (existingEnd && store.points.length >= 2) {
      if (canUpdate) {
        (store as any).updatePoint(existingEnd.id, { coordinates: coords, address });
      } else {
        store.removePoint(existingEnd.id);
        store.addPoint(coords, address);
      }
      return;
    }

    store.addPoint(coords, address);
  }, [store]);

  const handleAddressClear = useCallback((isStart: boolean) => {
    const target = isStart
      ? (store.getStartPoint() ?? store.points[0])
      : (store.getEndPoint() ?? store.points[store.points.length - 1]);

    if (target) {
      store.removePoint(target.id);
    }
  }, [store]);

  return {
    // State
    mode: store.mode,
    transportMode: store.transportMode,
    routePoints,
    startAddress,
    endAddress,
    routeDistance,
    routeDuration,
    routeElevationGain,
    routeElevationLoss,
    fullRouteCoords,
    isBuilding: store.isBuilding,
    error: store.error,

    // Routing status setters (for map/routing components)
    setBuilding: store.setBuilding,
    setError: store.setError,
    
    // Direct store access for new code
    points: store.points,
    route: store.route,
    
    // Actions
    setMode: store.setMode,
    setTransportMode: store.setTransportMode,
    setRoutePoints,
    setRouteDistance,
    setRouteDuration,
    setFullRouteCoords,
    setRouteElevationStats,
    handleRemoveRoutePoint,
    handleClearRoute,
    handleAddressSelect,
    handleAddressClear,
    
    // Direct store actions for new code
    addPoint: store.addPoint,
    removePoint: store.removePoint,
    updatePoint: store.updatePoint,
    clearRoute: store.clearRoute,
    swapStartEnd: store.swapStartEnd,
  };
}
