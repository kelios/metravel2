/**
 * Hook for lazy loading Leaflet and React-Leaflet
 * Handles web-only conditional loading with idle callback optimization
 * @module hooks/useLeafletLoader
 */

import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

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
   * If browser doesn't idle within this time, force load
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
  L: any | null;

  /**
   * React-Leaflet library instance (null until loaded)
   */
  RL: any | null;

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

const isTestEnv = typeof process !== 'undefined' &&
  (process as any).env?.NODE_ENV === 'test';

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
    idleTimeout = 1200,
    fallbackDelay = 600,
  } = options;

  const [L, setL] = useState<any>(null);
  const [RL, setRL] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [shouldLoad, setShouldLoad] = useState(isTestEnv);

  // Schedule loading with idle callback or timeout
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (!enabled) return;
    if (isTestEnv) return; // Already set to load immediately in test env
    if (shouldLoad) return;

    let cancelled = false;
    let idleHandle: any = null;
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

    const enableLoading = () => {
      if (cancelled) return;
      setShouldLoad(true);
    };

    if (useIdleCallback && typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      idleHandle = (window as any).requestIdleCallback(enableLoading, { timeout: idleTimeout });
    } else {
      timeoutHandle = setTimeout(enableLoading, fallbackDelay);
    }

    return () => {
      cancelled = true;
      try {
        if (idleHandle && typeof window !== 'undefined' && 'cancelIdleCallback' in window) {
          (window as any).cancelIdleCallback(idleHandle);
        }
      } catch {
        // Ignore cancellation errors
      }
      if (timeoutHandle) clearTimeout(timeoutHandle);
    };
  }, [enabled, shouldLoad, useIdleCallback, idleTimeout, fallbackDelay]);

  // Load Leaflet and React-Leaflet
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (!enabled) return;
    if (!shouldLoad) return;
    if (L && RL) return; // Already loaded

    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        // Import Leaflet
        const LeafletModule = await import('leaflet');
        if (cancelled) return;

        // Import React-Leaflet
        const ReactLeafletModule = await import('react-leaflet');
        if (cancelled) return;

        // Import Leaflet fix for React (icon paths)
        await import('@/src/utils/leafletFix');
        if (cancelled) return;

        setL(LeafletModule.default);
        setRL(ReactLeafletModule);
      } catch (err) {
        if (cancelled) return;
        const error = err instanceof Error ? err : new Error('Failed to load Leaflet');
        console.error('[useLeafletLoader] Error loading Leaflet:', error);
        setError(error);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, shouldLoad, L, RL]);

  const ready = !!(L && RL && !loading && !error);

  return {
    L,
    RL,
    loading,
    error,
    ready,
  };
}
