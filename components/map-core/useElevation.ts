// components/map-core/useElevation.ts
// C4.1: Extracted elevation logic from RoutingMachine.tsx
import { useEffect, useRef } from 'react';
import type { TransportMode } from './types';

// ---------------------------------------------------------------------------
// Constants & cache
// ---------------------------------------------------------------------------

const MAX_ELEVATION_SAMPLES = 60;
const elevationCache = new Map<string, { gain: number; loss: number }>();
let elevationNextAllowedAtMs = 0;
let elevationLastAttemptAtMs = 0;
const ELEVATION_MIN_INTERVAL_MS = 1500;
const ELEVATION_429_COOLDOWN_MS = 30_000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const sampleIndices = (total: number, maxSamples: number): number[] => {
  if (!Number.isFinite(total) || total <= 0) return [];
  if (total <= maxSamples) return Array.from({ length: total }, (_, i) => i);
  if (maxSamples <= 1) return [0];
  const out: number[] = [];
  for (let i = 0; i < maxSamples; i++) {
    const idx = Math.round((i * (total - 1)) / (maxSamples - 1));
    out.push(idx);
  }
  return Array.from(new Set(out)).sort((a, b) => a - b);
};

const computeElevationGainLoss = (elevations: number[]) => {
  let gain = 0;
  let loss = 0;
  const noiseThresholdMeters = 3;
  for (let i = 1; i < elevations.length; i++) {
    const prev = elevations[i - 1];
    const next = elevations[i];
    if (!Number.isFinite(prev) || !Number.isFinite(next)) continue;
    const delta = next - prev;
    if (Math.abs(delta) < noiseThresholdMeters) continue;
    if (delta > 0) gain += delta;
    else loss += Math.abs(delta);
  }
  return { gain: Math.round(gain), loss: Math.round(loss) };
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export interface UseElevationOptions {
  /** Route coordinates [lng, lat] array */
  coords: [number, number][];
  /** Transport mode — elevation is only fetched for bike/foot */
  transportMode: TransportMode;
  /** Whether to enable fetching (e.g. route finished loading) */
  enabled: boolean;
  /** Stable key for coords comparison (avoids deep equality) */
  coordsKey: string;
}

export interface UseElevationResult {
  gain: number | null;
  loss: number | null;
}

/**
 * Fetches elevation data for a route and computes gain/loss.
 * Only active for bike/foot transport modes.
 * Uses Open-Meteo elevation API (no API key required).
 */
export const useElevation = (
  options: UseElevationOptions,
  onResult: (gain: number | null, loss: number | null) => void,
): void => {
  const { coords, transportMode, enabled, coordsKey } = options;
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  // Reset elevation for car mode
  useEffect(() => {
    if (transportMode !== 'car') return;
    try {
      onResultRef.current(null, null);
    } catch {
      // noop
    }
  }, [transportMode]);

  // Fetch elevation for bike/foot
  useEffect(() => {
    if (!enabled) return;
    if (transportMode === 'car') return;
    if (!Array.isArray(coords) || coords.length < 2) return;

    const indices = sampleIndices(coords.length, MAX_ELEVATION_SAMPLES);
    if (indices.length < 2) return;

    const sampled = indices
      .map((i) => coords[i])
      .filter((p) => Array.isArray(p) && p.length >= 2 && Number.isFinite(p[0]) && Number.isFinite(p[1]));

    if (sampled.length < 2) return;

    const latitudes = sampled.map((p) => Number(p[1]).toFixed(5)).join(',');
    const longitudes = sampled.map((p) => Number(p[0]).toFixed(5)).join(',');

    const cacheKey = `${transportMode}:${latitudes}:${longitudes}`;
    const cached = elevationCache.get(cacheKey);
    if (cached) {
      try {
        onResultRef.current(cached.gain, cached.loss);
      } catch {
        // noop
      }
      return;
    }

    // Clear stale values while we fetch
    try {
      onResultRef.current(null, null);
    } catch {
      // noop
    }

    const now = Date.now();
    if (now < elevationNextAllowedAtMs) return;
    if (now - elevationLastAttemptAtMs < ELEVATION_MIN_INTERVAL_MS) return;
    elevationLastAttemptAtMs = now;

    const abortController = new AbortController();
    let cancelled = false;

    const fetchElevations = async () => {
      try {
        const url = `https://api.open-meteo.com/v1/elevation?latitude=${latitudes}&longitude=${longitudes}`;
        const res = await fetch(url, { signal: abortController.signal });
        if (res.status === 429) {
          elevationNextAllowedAtMs = Date.now() + ELEVATION_429_COOLDOWN_MS;
          return;
        }
        if (!res.ok) return;
        const data = await res.json().catch(() => null);
        const elevations = (data as any)?.elevation;
        if (!Array.isArray(elevations) || elevations.length < 2) return;
        if (cancelled) return;

        const stats = computeElevationGainLoss(elevations.map((x: any) => Number(x)));
        elevationCache.set(cacheKey, stats);
        try {
          onResultRef.current(stats.gain, stats.loss);
        } catch {
          // noop
        }
      } catch (e: any) {
        if (e?.name === 'AbortError') return;
      }
    };

    void fetchElevations();

    return () => {
      cancelled = true;
      try {
        abortController.abort();
      } catch {
        // noop
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, transportMode, coordsKey]);
};

// Export helpers for testing
export { sampleIndices, computeElevationGainLoss };

