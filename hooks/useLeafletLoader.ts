/**
 * Hook for lazy loading Leaflet and React-Leaflet
 * Handles web-only conditional loading with idle callback optimization
 * @module hooks/useLeafletLoader
 */

import { useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import { whenLeafletCssReady } from '@/utils/ensureLeafletCss';

type LeafletRuntime = typeof import('leaflet');
type ReactLeafletRuntime = typeof import('react-leaflet');

interface ProcessLike {
  env?: {
    NODE_ENV?: string;
  };
}

type IdleWindow = Window & {
  requestIdleCallback?: (callback: () => void, options?: { timeout?: number }) => number;
  cancelIdleCallback?: (id: number) => void;
};

interface UseLeafletLoaderOptions {
  /**
   * Enable Leaflet loading
   * Set to false to skip loading (e.g., for SSR, native platforms)
   */
  enabled?: boolean;

  /**
   * Use requestIdleCallback for deferred loading
   * Improves initial page load performance
   */
  useIdleCallback?: boolean;

  /**
   * Timeout for idle callback (ms)
   * If browser doesn't idle within this time, force load.
   * The map waits behind its skeleton, so «Timeout policy» caps it at 1000 ms (#2020).
   */
  idleTimeout?: number;

  /**
   * Delay before loading (ms) if idle callback is not available
   * Used as fallback on browsers without requestIdleCallback
   */
  fallbackDelay?: number;
}

interface UseLeafletLoaderResult {
  /**
   * Leaflet library instance (null until loaded)
   */
  L: LeafletRuntime | null;

  /**
   * React-Leaflet library instance (null until loaded)
   */
  RL: ReactLeafletRuntime | null;

  /**
   * Loading state
   */
  loading: boolean;

  /**
   * Error state (if loading failed)
   */
  error: Error | null;

  /**
   * True when both L and RL are loaded and ready
   */
  ready: boolean;
}

const runtimeProcess = typeof process !== 'undefined' ? (process as ProcessLike) : undefined;
const isTestEnv = runtimeProcess?.env?.NODE_ENV === 'test';

/**
 * Lazy load Leaflet and React-Leaflet for web platform
 *
 * Features:
 * - Platform check (web only)
 * - Idle callback optimization for better initial page load
 * - Error handling
 * - Test environment support
 *
 * @example
 * ```typescript
 * const { L, RL, loading, error, ready } = useLeafletLoader({
 *   enabled: Platform.OS === 'web',
 *   useIdleCallback: true,
 * });
 *
 * if (!ready) return <MapSkeleton />;
 * if (error) return <MapError error={error} />;
 *
 * return <MapComponent L={L} RL={RL} />;
 * ```
 */
export function useLeafletLoader(options: UseLeafletLoaderOptions = {}): UseLeafletLoaderResult {
  const {
    enabled = true,
    useIdleCallback = true,
    idleTimeout = 1000,
    fallbackDelay = 600,
  } = options;

  const [L, setL] = useState<LeafletRuntime | null>(null);
  const [RL, setRL] = useState<ReactLeafletRuntime | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  // When idle callback is disabled and delay is 0, start loading immediately (no extra render cycle).
  const [shouldLoad, setShouldLoad] = useState(
    isTestEnv || (enabled && Platform.OS === 'web' && !useIdleCallback && fallbackDelay === 0)
  );

  // Ensure Leaflet CSS is present ASAP (before JS is loaded) to avoid controls/attribution layout glitches.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (!enabled) return;

    // Единый источник стилей Leaflet (core + overrides + markercluster). Движок
    // всё равно ждёт применения CSS в loadLeafletRuntime (#2324); здесь — ранний старт.
    whenLeafletCssReady().catch(() => {
      // noop: map can still attempt to render; error will be handled during JS load.
    });
  }, [enabled]);

  // Schedule loading with idle callback or timeout
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (!enabled) return;
    if (isTestEnv) return; // Already set to load immediately in test env
    if (shouldLoad) return;

    let cancelled = false;
    let idleHandle: number | null = null;
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
    const idleWindow = typeof window !== 'undefined' ? (window as IdleWindow) : undefined;

    const enableLoading = () => {
      if (cancelled) return;
      setShouldLoad(true);
    };

    if (useIdleCallback && idleWindow?.requestIdleCallback) {
      idleHandle = idleWindow.requestIdleCallback(enableLoading, { timeout: idleTimeout });
    } else {
      timeoutHandle = setTimeout(enableLoading, fallbackDelay);
    }

    return () => {
      cancelled = true;
      try {
        if (idleHandle != null) {
          idleWindow?.cancelIdleCallback?.(idleHandle);
        }
      } catch {
        // Ignore cancellation errors
      }
      if (timeoutHandle) clearTimeout(timeoutHandle);
    };
  }, [enabled, shouldLoad, useIdleCallback, idleTimeout, fallbackDelay]);

  // Load Leaflet and React-Leaflet (with retry for transient failures)
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (!enabled) return;
    if (!shouldLoad) return;
    if (L && RL) return; // Already loaded

    let cancelled = false;
    setLoading(true);
    setError(null);

    const MAX_RETRIES = 2;
    const RETRY_DELAY_MS = 1500;

    const loadModules = async (attempt: number): Promise<void> => {
      try {
        // loadLeafletRuntime waits for Leaflet CSS in parallel with the JS chunk
        // (#2324), so the engine never mounts before leaflet.css is applied.
        const { loadLeafletRuntime } = await import('@/utils/loadLeafletRuntime');
        const { L: LeafletResolved, RL: ReactLeafletResolved } = await loadLeafletRuntime();
        if (cancelled) return;

        setL(LeafletResolved);
        setRL(ReactLeafletResolved);
      } catch (err) {
        if (cancelled) return;
        const error = err instanceof Error ? err : new Error('Failed to load Leaflet');

        if (attempt < MAX_RETRIES) {
          console.warn(`[useLeafletLoader] Attempt ${attempt + 1} failed, retrying in ${RETRY_DELAY_MS}ms...`, error.message);
          await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
          if (cancelled) return;
          return loadModules(attempt + 1);
        }

        console.error('[useLeafletLoader] Error loading Leaflet:', error);
        setError(error);
      }
    };

    loadModules(0).finally(() => {
      if (!cancelled) {
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [enabled, shouldLoad, L, RL]);

  const ready = !!(L && RL && !loading && !error);

  return useMemo(() => ({
    L,
    RL,
    loading,
    error,
    ready,
  }), [L, RL, loading, error, ready]);
}
