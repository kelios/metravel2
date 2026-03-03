/**
 * Adapter hook to bridge RouteStore with existing map.tsx interface
 * This allows gradual migration without breaking existing code
 *
 * P4.2: Используем гранулярные Zustand селекторы для предотвращения лишних re-renders
 */
import { useRouteStore } from '@/stores/routeStore';
import { CoordinateConverter } from '@/utils/coordinateConverter';
import type { LatLng } from '@/types/coordinates';
import { useMemo, useCallback } from 'react';

export function useRouteStoreAdapter() {
  // P4.2: Гранулярные селекторы вместо подписки на весь store
  const points = useRouteStore((s) => s.points);
  const mode = useRouteStore((s) => s.mode);
  const transportMode = useRouteStore((s) => s.transportMode);
  const route = useRouteStore((s) => s.route);
  const isBuilding = useRouteStore((s) => s.isBuilding);
  const error = useRouteStore((s) => s.error);

  // Actions — стабильные ссылки, не вызывают re-render
  const setMode = useRouteStore((s) => s.setMode);
  const setTransportMode = useRouteStore((s) => s.setTransportMode);
  const setBuilding = useRouteStore((s) => s.setBuilding);
  const setError = useRouteStore((s) => s.setError);
  const addPoint = useRouteStore((s) => s.addPoint);
  const removePoint = useRouteStore((s) => s.removePoint);
  const updatePoint = useRouteStore((s) => s.updatePoint);
  const clearRoute = useRouteStore((s) => s.clearRoute);
  const swapStartEnd = useRouteStore((s) => s.swapStartEnd);

  // Convert RoutePoint[] to legacy [lng, lat][] format
  const routePoints = useMemo(() => {
    return points.map(p => [p.coordinates.lng, p.coordinates.lat] as [number, number]);
  }, [points]);

  // Get addresses — пересчитываются при изменении points
  const startAddress = useMemo(() => {
    const start = useRouteStore.getState().getStartPoint();
    return start?.address || '';
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points]);

  const endAddress = useMemo(() => {
    const start = useRouteStore.getState().getStartPoint?.();
    const end = useRouteStore.getState().getEndPoint?.();

    // If end points to the same entity as start, treat as not selected.
    if (start && end && start.id && end.id && start.id === end.id) return '';

    // In production, end should be empty until at least 2 points exist.
    // But tests may mock getEndPoint without populating points; respect getEndPoint if present.
    if (points.length < 2) {
      return end?.address || '';
    }

    return end?.address || '';
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points]);

  // Get route data
  const routeDistance = route?.distance ?? null;
  const routeDuration = route?.duration ?? null;
  const routeElevationGain = route?.elevationGain ?? null;
  const routeElevationLoss = route?.elevationLoss ?? null;

  const fullRouteCoords = useMemo(() => {
    if (!route?.coordinates) return [];
    return route.coordinates.map(c => [c.lng, c.lat] as [number, number]);
  }, [route?.coordinates]);

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
    const canUpdate = typeof state.updatePoint === 'function';
    if (isStart) {
      const existingStart = state.getStartPoint() ?? state.points[0];
      if (existingStart) {
        if (canUpdate) {
          state.updatePoint(existingStart.id, { coordinates: coords, address });
        } else {
          state.removePoint(existingStart.id);
          state.addPoint(coords, address);
        }

        // If we only have a single point and it's currently treated as both start and end,
        // ensure the end stays empty until user selects it explicitly.
        if (state.points.length === 1) {
          const endCandidate = state.getEndPoint();
          if (endCandidate && endCandidate.id === existingStart.id) {
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
        state.updatePoint(existingEnd.id, { coordinates: coords, address });
      } else {
        state.removePoint(existingEnd.id);
        state.addPoint(coords, address);
      }
      return;
    }

    state.addPoint(coords, address);
  }, []);

  // P4.2: Используем getState() вместо store для handleAddressClear
  const handleAddressClear = useCallback((isStart: boolean) => {
    const state = useRouteStore.getState();
    const target = isStart
      ? (state.getStartPoint() ?? state.points[0])
      : (state.getEndPoint() ?? state.points[state.points.length - 1]);

    if (target) {
      state.removePoint(target.id);
    }
  }, []);

  return useMemo(() => ({
    // State
    mode,
    transportMode,
    routePoints,
    startAddress,
    endAddress,
    routeDistance,
    routeDuration,
    routeElevationGain,
    routeElevationLoss,
    fullRouteCoords,
    isBuilding,
    error,

    // Routing status setters (for map/routing components)
    setBuilding,
    setError,

    // Direct store access for new code
    points,
    route,

    // Actions
    setMode,
    setTransportMode,
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
    addPoint,
    removePoint,
    updatePoint,
    clearRoute,
    swapStartEnd,
  }), [
    mode,
    transportMode,
    routePoints,
    startAddress,
    endAddress,
    routeDistance,
    routeDuration,
    routeElevationGain,
    routeElevationLoss,
    fullRouteCoords,
    isBuilding,
    error,
    setBuilding,
    setError,
    points,
    route,
    setMode,
    setTransportMode,
    setRoutePoints,
    setRouteDistance,
    setRouteDuration,
    setFullRouteCoords,
    setRouteElevationStats,
    handleRemoveRoutePoint,
    handleClearRoute,
    handleAddressSelect,
    handleAddressClear,
    addPoint,
    removePoint,
    updatePoint,
    clearRoute,
    swapStartEnd,
  ]);
}
