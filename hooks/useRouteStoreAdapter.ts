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
  }, [store.points]);

  const endAddress = useMemo(() => {
    const end = store.getEndPoint();
    return end?.address || '';
  }, [store.points]);

  // Get route data
  const routeDistance = store.route?.distance ?? null;
  
  const fullRouteCoords = useMemo(() => {
    if (!store.route?.coordinates) return [];
    return store.route.coordinates.map(c => [c.lng, c.lat] as [number, number]);
  }, [store.route?.coordinates]);

  // Adapter methods
  const setRoutePoints = useCallback((points: [number, number][]) => {
    // Clear existing points
    store.clearRoute();
    
    // Add new points
    points.forEach((point, index) => {
      const coords: LatLng = { lat: point[1], lng: point[0] };
      const address = CoordinateConverter.formatCoordinates(coords);
      store.addPoint(coords, address);
    });
  }, [store]);

  const setRouteDistance = useCallback((distance: number) => {
    // Distance is managed by store automatically
    // This is a no-op for compatibility
  }, []);

  const setFullRouteCoords = useCallback((coords: [number, number][]) => {
    // Route coords are managed by store automatically
    // This is a no-op for compatibility
  }, []);

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
    if (isStart) {
      // Remove existing start point if any
      const existingStart = store.getStartPoint();
      if (existingStart) {
        store.removePoint(existingStart.id);
      }
      // Add new start point at beginning
      store.addPoint(coords, address);
    } else {
      // Add as end point
      store.addPoint(coords, address);
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
    fullRouteCoords,
    isBuilding: store.isBuilding,
    error: store.error,
    
    // Direct store access for new code
    points: store.points,
    route: store.route,
    
    // Actions
    setMode: store.setMode,
    setTransportMode: store.setTransportMode,
    setRoutePoints,
    setRouteDistance,
    setFullRouteCoords,
    handleRemoveRoutePoint,
    handleClearRoute,
    handleAddressSelect,
    
    // Direct store actions for new code
    addPoint: store.addPoint,
    removePoint: store.removePoint,
    clearRoute: store.clearRoute,
  };
}
