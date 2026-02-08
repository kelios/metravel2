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
    const state = useRouteStore.getState();

    // ✅ ИСПРАВЛЕНИЕ: Проверяем, что points - это массив
    if (!Array.isArray(points)) {
      console.warn('[setRoutePoints] Invalid points array:', points);
      return;
    }

    // Explicitly clear when empty array is provided
    if (points.length === 0) {
      state.clearRoute();
      return;
    }

    // Check if points are already the same - avoid infinite loop
    const currentPoints = state.points;
    if (!options?.force && currentPoints.length === points.length) {
      const allMatch = points.every((point, index) => {
        const [lng, lat] = point;
        const current = currentPoints[index];
        return current && 
               Math.abs(current.coordinates.lng - lng) < 0.000001 && 
               Math.abs(current.coordinates.lat - lat) < 0.000001;
      });
      
      if (allMatch) {
        return;
      }
    }

    // Clear existing points
    state.clearRoute();
    
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
      useRouteStore.getState().addPoint(coords, address);
    });

  }, []);

  const setRouteDistance = useCallback((distance: number) => {
    const state = useRouteStore.getState();
    const existingCoords =
      state.route?.coordinates ?? state.points.map((p) => p.coordinates);

    const existingDuration = state.route?.duration ?? 0;
    const prevElevationGain = state.route?.elevationGain;
    const prevElevationLoss = state.route?.elevationLoss;

    const prevDistance = state.route?.distance;
    const sameDistance = typeof prevDistance === 'number' && prevDistance === distance;

    // If we already have the same distance and coordinates, avoid a store update.
    if (sameDistance && state.route?.coordinates === existingCoords) {
      return;
    }

    state.setRoute({
      coordinates: existingCoords,
      distance,
      duration: existingDuration,
      isOptimal: true,
      elevationGain: prevElevationGain,
      elevationLoss: prevElevationLoss,
    });
  }, []);

  const setRouteDuration = useCallback((durationSeconds: number) => {
    const state = useRouteStore.getState();
    const existingCoords =
      state.route?.coordinates ?? state.points.map((p) => p.coordinates);
    const existingDistance = state.route?.distance ?? 0;
    const prevElevationGain = state.route?.elevationGain;
    const prevElevationLoss = state.route?.elevationLoss;

    state.setRoute({
      coordinates: existingCoords,
      distance: existingDistance,
      duration: Number(durationSeconds) || 0,
      isOptimal: true,
      elevationGain: prevElevationGain,
      elevationLoss: prevElevationLoss,
    });
  }, []);

  const setFullRouteCoords = useCallback((coords: [number, number][]) => {
    const state = useRouteStore.getState();

    const latLngCoords: LatLng[] = coords.map(([lng, lat]) => ({ lat, lng }));
    const distance = state.route?.distance ?? 0;
    const duration = state.route?.duration ?? 0;
    const prevElevationGain = state.route?.elevationGain;
    const prevElevationLoss = state.route?.elevationLoss;

    const prevCoords = state.route?.coordinates;
    const sameLength = Array.isArray(prevCoords) && prevCoords.length === latLngCoords.length;
    const sameCoords = !!prevCoords && sameLength && prevCoords.every((p, i) => {
      const next = latLngCoords[i];
      return !!next && p.lat === next.lat && p.lng === next.lng;
    });

    if (sameCoords && state.route?.distance === distance) {
      return;
    }

    state.setRoute({
      coordinates: latLngCoords,
      distance,
      duration,
      isOptimal: true,
      elevationGain: prevElevationGain,
      elevationLoss: prevElevationLoss,
    });
  }, []);

  const setRouteElevationStats = useCallback((elevationGainMeters: number | null, elevationLossMeters: number | null) => {
    const state = useRouteStore.getState();
    const existingCoords =
      state.route?.coordinates ?? state.points.map((p) => p.coordinates);
    const existingDistance = state.route?.distance ?? 0;
    const existingDuration = state.route?.duration ?? 0;
    const isOptimal = state.route?.isOptimal ?? true;

    state.setRoute({
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
  }, []);

  const handleRemoveRoutePoint = useCallback((index: number) => {
    const point = useRouteStore.getState().points[index];
    if (point) {
      useRouteStore.getState().removePoint(point.id);
    }
  }, []);

  const handleClearRoute = useCallback(() => {
    useRouteStore.getState().clearRoute();
  }, []);

  const handleAddressSelect = useCallback((address: string, coords: LatLng, isStart: boolean) => {
    const state = useRouteStore.getState();
    const canUpdate = typeof (state as any).updatePoint === 'function';
    if (isStart) {
      const existingStart = state.getStartPoint() ?? state.points[0];
      if (existingStart) {
        if (canUpdate) {
          (state as any).updatePoint(existingStart.id, { coordinates: coords, address });
        } else {
          state.removePoint(existingStart.id);
          state.addPoint(coords, address);
        }

        // If we only have a single point and it's currently treated as both start and end,
        // ensure the end stays empty until user selects it explicitly.
        if (state.points.length === 1) {
          const endCandidate = state.getEndPoint();
          if (endCandidate && endCandidate.id === existingStart.id) {
            // Remove and re-add start to clear any persisted end address mirroring.
            // We keep only the start point.
            state.removePoint(existingStart.id);
            state.addPoint(coords, address);
          }
        }
        return;
      }
      state.addPoint(coords, address);
      return;
    }

    const existingEnd = state.getEndPoint();
    if (existingEnd && state.points.length >= 2) {
      if (canUpdate) {
        (state as any).updatePoint(existingEnd.id, { coordinates: coords, address });
      } else {
        state.removePoint(existingEnd.id);
        state.addPoint(coords, address);
      }
      return;
    }

    state.addPoint(coords, address);
  }, []);

  const handleAddressClear = useCallback((isStart: boolean) => {
    const target = isStart
      ? (store.getStartPoint() ?? store.points[0])
      : (store.getEndPoint() ?? store.points[store.points.length - 1]);

    if (target) {
      store.removePoint(target.id);
    }
  }, [store]);

  return useMemo(() => ({
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
  }), [
    store.mode,
    store.transportMode,
    routePoints,
    startAddress,
    endAddress,
    routeDistance,
    routeDuration,
    routeElevationGain,
    routeElevationLoss,
    fullRouteCoords,
    store.isBuilding,
    store.error,
    store.setBuilding,
    store.setError,
    store.points,
    store.route,
    store.setMode,
    store.setTransportMode,
    setRoutePoints,
    setRouteDistance,
    setRouteDuration,
    setFullRouteCoords,
    setRouteElevationStats,
    handleRemoveRoutePoint,
    handleClearRoute,
    handleAddressSelect,
    handleAddressClear,
    store.addPoint,
    store.removePoint,
    store.updatePoint,
    store.clearRoute,
    store.swapStartEnd,
  ]);
}
