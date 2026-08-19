// components/map-core/useMapRouting.ts
// C4.2: Unified routing hook — combines useRouting + RoutingMachine sync + useElevation
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouting } from '@/components/MapPage/useRouting';
import { useElevation, type ElevationSample } from './useElevation';
import { showRouteBuiltToast, showRouteErrorToast } from '@/utils/mapToasts';
import type { TransportMode } from './types';
import { translate as i18nT } from '@/i18n';

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
  /**
   * Тосты «маршрут построен / не построен». На /map это единственная обратная
   * связь о результате, а в конструкторе поездки маршрут перестраивается на
   * каждую правку точки, поэтому там их выключают (#1490).
   */
  showToasts?: boolean;
}

export interface UseMapRoutingResult {
  /** True while the route is being computed */
  loading: boolean;
  /** Error message (or null if no error) */
  error: string | null;
  /** Distance in meters */
  distance: number;
  /** Duration in seconds */
  duration: number;
  /** Route geometry as [lng, lat] tuples */
  coords: [number, number][];
  /** Elevation gain in meters (bike/foot only) */
  elevationGain: number | null;
  /** Elevation loss in meters (bike/foot only) */
  elevationLoss: number | null;
  /** Замеры высот вдоль `coords` — для профиля высот (bike/foot only) */
  elevationSamples: ElevationSample[] | null;
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
  const {
    routePoints,
    transportMode,
    apiKey,
    enableElevation = true,
    showToasts = true,
  } = options;

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

  // Elevation: храним в state (а не ref), чтобы приход высот ПОСЛЕ построения
  // маршрута пересоздавал result и доставлял свежие gain/loss через onRouteChange (#121).
  const [elevationGain, setElevationGain] = useState<number | null>(null);
  const [elevationLoss, setElevationLoss] = useState<number | null>(null);
  const [elevationSamples, setElevationSamples] = useState<ElevationSample[] | null>(null);

  const handleElevationResult = useCallback(
    (gain: number | null, loss: number | null, samples: ElevationSample[] | null) => {
      setElevationGain(gain);
      setElevationLoss(loss);
      setElevationSamples(samples);
    },
    [],
  );

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
    error: typeof routingState.error === 'string' && routingState.error ? routingState.error : null,
    distance: routingState.distance,
    duration: routingState.duration,
    coords: routingState.coords,
    elevationGain,
    elevationLoss,
    elevationSamples,
  }), [routingState.loading, routingState.error, routingState.distance, routingState.duration, routingState.coords, elevationGain, elevationLoss, elevationSamples]);

  // Sync to parent & show toasts
  const prevStateRef = useRef<string>('');
  const lastSentRef = useRef<string>('');

  useEffect(() => {
    if (!hasTwoPoints) {
      // Clear when not enough points
      const emptyResult: UseMapRoutingResult = {
        loading: false,
        error: null,
        distance: 0,
        duration: 0,
        coords: [] as [number, number][],
        elevationGain: null,
        elevationLoss: null,
        elevationSamples: null,
      };
      onRouteChange?.(emptyResult);
      return;
    }

    const stateKey = `${result.loading}|${result.error}|${result.distance}|${result.duration}|${coordsKey}|${result.elevationGain}|${result.elevationLoss}`;
    if (stateKey === prevStateRef.current) return;
    prevStateRef.current = stateKey;

    if (stateKey === lastSentRef.current) return;
    lastSentRef.current = stateKey;

    // Toasts
    if (showToasts) {
      if (result.error) {
        showRouteErrorToast(result.error || i18nT('errorsStatic:map.routeFailed'));
      } else if (!result.loading && result.distance > 0 && result.duration > 0) {
        showRouteBuiltToast(result.distance / 1000, result.duration / 60);
      }
    }

    onRouteChange?.(result);
    // result is derived from the listed primitives; onRouteChange omitted intentionally as a stable parent callback
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasTwoPoints, showToasts, result.loading, result.error, result.distance, result.duration, coordsKey, result.elevationGain, result.elevationLoss]);

  return result;
}
