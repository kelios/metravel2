// components/map-core/useElevation.ts
// C4.1: Extracted elevation logic from RoutingMachine.tsx
import { useEffect, useRef } from 'react';
import type { TransportMode } from './types';

// ---------------------------------------------------------------------------
// Constants & cache
// ---------------------------------------------------------------------------

const MAX_ELEVATION_SAMPLES = 60;
const MAX_ELEVATION_CACHE_ENTRIES = 50;

/**
 * Одна замеренная высота на маршруте. `index` — позиция в исходном массиве
 * `coords`, поэтому потребитель может разложить редкие замеры обратно на плотную
 * геометрию и построить профиль высот той же линии (#1490).
 */
export interface ElevationSample {
  index: number;
  elevationM: number;
}

type ElevationCacheEntry = {
  gain: number;
  loss: number;
  /** Длина `coords`, на которой считались индексы: чужая длина делает их бессмысленными. */
  total: number;
  samples: ElevationSample[];
};

const elevationCache = new Map<string, ElevationCacheEntry>();

const elevationCacheGet = (key: string) => {
  const value = elevationCache.get(key);
  if (value !== undefined) {
    // Refresh recency (move to end) for LRU ordering.
    elevationCache.delete(key);
    elevationCache.set(key, value);
  }
  return value;
};

const elevationCacheSet = (key: string, value: ElevationCacheEntry) => {
  elevationCache.delete(key);
  if (elevationCache.size >= MAX_ELEVATION_CACHE_ENTRIES) {
    const oldest = elevationCache.keys().next().value;
    if (oldest !== undefined) elevationCache.delete(oldest);
  }
  elevationCache.set(key, value);
};

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
 * Приёмник результата. Третий аргумент — сами замеры высот вдоль `coords`
 * (#1490): по ним планировщик поездок строит профиль высот превью-маршрута.
 * Потребителям, которым нужны только набор/сброс, его можно не объявлять.
 */
export type ElevationResultCallback = (
  gain: number | null,
  loss: number | null,
  samples: ElevationSample[] | null,
) => void;

/**
 * Fetches elevation data for a route and computes gain/loss.
 * Only active for bike/foot transport modes.
 * Uses Open-Meteo elevation API (no API key required).
 */
export const useElevation = (
  options: UseElevationOptions,
  onResult: ElevationResultCallback,
): void => {
  const { coords, transportMode, enabled, coordsKey } = options;
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  // Reset elevation for car mode
  useEffect(() => {
    if (transportMode !== 'car') return;
    try {
      onResultRef.current(null, null, null);
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

    // Индексы уцелевших точек нужны так же, как их координаты: по ним ответ
    // Open-Meteo раскладывается обратно на исходную геометрию маршрута (#1490).
    const sampledIndices: number[] = [];
    const sampled: Array<[number, number]> = [];
    for (const i of indices) {
      const point = coords[i];
      if (!Array.isArray(point) || point.length < 2) continue;
      if (!Number.isFinite(point[0]) || !Number.isFinite(point[1])) continue;
      sampledIndices.push(i);
      sampled.push(point);
    }

    if (sampled.length < 2) return;

    const latitudes = sampled.map((p) => Number(p[1]).toFixed(5)).join(',');
    const longitudes = sampled.map((p) => Number(p[0]).toFixed(5)).join(',');

    const cacheKey = `${transportMode}:${latitudes}:${longitudes}`;
    const cached = elevationCacheGet(cacheKey);
    if (cached) {
      try {
        // Индексы замеров привязаны к длине геометрии, на которой их считали:
        // при чужой длине отдаём только набор/сброс, без профиля.
        onResultRef.current(
          cached.gain,
          cached.loss,
          cached.total === coords.length ? cached.samples : null,
        );
      } catch {
        // noop
      }
      return;
    }

    // Clear stale values while we fetch
    try {
      onResultRef.current(null, null, null);
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
        if (cancelled) return;
        if (res.status === 429) {
          elevationNextAllowedAtMs = Date.now() + ELEVATION_429_COOLDOWN_MS;
          return;
        }
        if (!res.ok) return;
        const data = await res.json().catch(() => null);
        if (cancelled) return;
        const elevations = (data as any)?.elevation;
        if (!Array.isArray(elevations) || elevations.length < 2) return;

        const numericElevations = elevations.map((x: any) => Number(x));
        const stats = computeElevationGainLoss(numericElevations);
        // `sampled` собран из `indices` тем же фильтром, поэтому i-й ответ
        // Open-Meteo принадлежит i-й уцелевшей точке, а не i-му индексу.
        const samples: ElevationSample[] = [];
        for (let i = 0; i < sampledIndices.length && i < numericElevations.length; i += 1) {
          const elevationM = numericElevations[i];
          if (!Number.isFinite(elevationM)) continue;
          samples.push({ index: sampledIndices[i], elevationM });
        }
        // Cache even if stale; but only emit to the (possibly unmounted) callback when current.
        elevationCacheSet(cacheKey, { ...stats, total: coords.length, samples });
        if (cancelled) return;
        try {
          onResultRef.current(stats.gain, stats.loss, samples);
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
    // coordsKey is a stable hash of coords; onResultRef is a ref so neither needs listing
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, transportMode, coordsKey]);
};

// Export helpers for testing
export { sampleIndices, computeElevationGainLoss };

