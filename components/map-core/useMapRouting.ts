// components/map-core/useMapRouting.ts
// C4.2: Unified routing hook — combines useRouting + RoutingMachine sync + useElevation
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useRouting } from '@/components/MapPage/useRouting';
import { useElevation } from './useElevation';
import { showRouteBuiltToast, showRouteErrorToast } from '@/utils/mapToasts';
import type { TransportMode, RouteState } from './types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UseMapRoutingOptions {
  /** Route waypoints as [lng, lat] tuples */
  routePoints: [number, number][];
  /** Transport mode */
  transportMode: TransportMode;
  /** ORS API key */
  apiKey?: string;
  /** Whether elevation should be computed (for bike/foot) */
  enableElevation?: boolean;
}

export interface UseMapRoutingResult extends RouteState {
  /** True while the route is being computed */
  loading: boolean;
  /** Error message (or false if no error) */
  error: string | false;
}

export type RouteChangeCallback = (result: UseMapRoutingResult) => void;

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Unified routing hook that combines:
 * - useRouting (ORS/OSRM/Valhalla chain)
 * - Elevation fetching (useElevation)
 * - Toast notifications
 * - State sync to parent via single callback
 */
export function useMapRouting(
  options: UseMapRoutingOptions,
  onRouteChange?: RouteChangeCallback,
): UseMapRoutingResult {
  const { routePoints, transportMode, apiKey, enableElevation = true } = options;

  const hasTwoPoints = routePoints.length >= 2;
  const routingState = useRouting(routePoints, transportMode, apiKey);

  // Stable key for coords comparison
  const coordsKey = useMemo(() => {
    const coords = routingState.coords;
    if (!Array.isArray(coords) || coords.length < 2) return '';
    const first = coords[0];
    const last = coords[coords.length - 1];
    const fmt = (v: any) => (Number.isFinite(Number(v)) ? Number(v).toFixed(5) : '0');
    return `${coords.length}:${fmt(first?.[0])},${fmt(first?.[1])}:${fmt(last?.[0])},${fmt(last?.[1])}`;
  }, [routingState.coords]);

  // Elevation
  const elevationGainRef = useRef<number | null>(null);
  const elevationLossRef = useRef<number | null>(null);

  const handleElevationResult = useCallback((gain: number | null, loss: number | null) => {
    elevationGainRef.current = gain;
    elevationLossRef.current = loss;
  }, []);

  useElevation(
    {
      coords: routingState.coords,
      transportMode,
      enabled: enableElevation && hasTwoPoints && !routingState.loading && routingState.coords.length >= 2,
      coordsKey,
    },
    handleElevationResult,
  );

  // Build result
  const result = useMemo<UseMapRoutingResult>(() => ({
    loading: routingState.loading,
    error: typeof routingState.error === 'string' && routingState.error ? routingState.error : false,
    distance: routingState.distance,
    duration: routingState.duration,
    coords: routingState.coords,
    elevationGain: elevationGainRef.current,
    elevationLoss: elevationLossRef.current,
  }), [routingState.loading, routingState.error, routingState.distance, routingState.duration, routingState.coords]);

  // Sync to parent & show toasts
  const prevStateRef = useRef<string>('');
  const lastSentRef = useRef<string>('');

  useEffect(() => {
    if (!hasTwoPoints) {
      // Clear when not enough points
      const emptyResult: UseMapRoutingResult = {
        loading: false,
        error: false,
        distance: 0,
        duration: 0,
        coords: [],
        elevationGain: null,
        elevationLoss: null,
      };
      onRouteChange?.(emptyResult);
      return;
    }

    const stateKey = `${result.loading}|${result.error}|${result.distance}|${result.duration}|${coordsKey}`;
    if (stateKey === prevStateRef.current) return;
    prevStateRef.current = stateKey;

    if (stateKey === lastSentRef.current) return;
    lastSentRef.current = stateKey;

    // Toasts
    if (result.error) {
      showRouteErrorToast(typeof result.error === 'string' ? result.error : 'Ошибка маршрута');
    } else if (!result.loading && result.distance > 0 && result.duration > 0) {
      showRouteBuiltToast(result.distance / 1000, result.duration / 60);
    }

    onRouteChange?.(result);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasTwoPoints, result.loading, result.error, result.distance, result.duration, coordsKey]);

  return result;
}

