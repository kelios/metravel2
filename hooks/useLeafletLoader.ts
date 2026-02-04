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

const LEAFLET_CSS_HREF = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';

const leafletCssSeemsApplied = () => {
  if (typeof document === 'undefined' || typeof window === 'undefined') return false;
  try {
    const probe = document.createElement('div');
    probe.className = 'leaflet-map-pane';
    probe.style.position = 'absolute';
    probe.style.top = '-9999px';
    probe.style.left = '-9999px';
    document.body.appendChild(probe);
    const z = window.getComputedStyle(probe).zIndex;
    probe.remove();
    // Leaflet core CSS sets .leaflet-map-pane { z-index: 400; }
    return z === '400';
  } catch {
    return false;
  }
};

const ensureLeafletCss = async (): Promise<void> => {
  if (typeof document === 'undefined') return;

  // If Leaflet core CSS is already applied, do nothing.
  if (leafletCssSeemsApplied()) return;

  // In Jest/JSDOM we don't load real external stylesheets reliably.
  // Keep tests deterministic by injecting a small known-good fallback and exiting early.
  if (isTestEnv) {
    if (document.querySelector('style[data-leaflet-fallback="true"]')) return;

    const style = document.createElement('style');
    style.setAttribute('data-leaflet-fallback', 'true');
    style.textContent =
      '.leaflet-control-container{position:absolute;top:0;left:0;right:0;bottom:0;pointer-events:none}' +
      '.leaflet-top,.leaflet-bottom{position:absolute;z-index:1000;pointer-events:none}' +
      '.leaflet-top{top:0}.leaflet-bottom{bottom:0}.leaflet-left{left:0}.leaflet-right{right:0}' +
      '.leaflet-control{position:relative;z-index:1000;pointer-events:auto;float:left;clear:both}' +
      '.leaflet-right .leaflet-control{float:right}' +
      '.leaflet-control-attribution{margin:0;padding:0 5px;color:#333;font-size:11px;background:rgba(255,255,255,0.7)}';
    document.head.appendChild(style);
    return;
  }

  // If bundling failed, try CDN CSS. If that fails (CSP/offline), inject a minimal layout fallback.
  if (document.querySelector('style[data-leaflet-fallback="true"]')) return;

  const existing = document.querySelector(`link[rel="stylesheet"][href="${LEAFLET_CSS_HREF}"]`) as
    | HTMLLinkElement
    | null;
  if (existing) {
    // A link tag was injected elsewhere (e.g. app layout). Give it a moment to apply.
    const started = Date.now();
    while (Date.now() - started < 3000) {
      if (leafletCssSeemsApplied()) return;
      await new Promise((r) => setTimeout(r, 50));
    }
    // Still not applied → fall back to minimal CSS.
    const style = document.createElement('style');
    style.setAttribute('data-leaflet-fallback', 'true');
    style.textContent =
      '.leaflet-container{position:relative;overflow:hidden;outline:0}' +
      '.leaflet-pane,.leaflet-map-pane,.leaflet-tile-pane,.leaflet-overlay-pane,.leaflet-shadow-pane,.leaflet-marker-pane,.leaflet-tooltip-pane,.leaflet-popup-pane{position:absolute;top:0;left:0}' +
      '.leaflet-tile{position:absolute;left:0;top:0;filter:inherit;visibility:inherit}' +
      '.leaflet-zoom-animated{transform-origin:0 0}' +
      '.leaflet-control-container{position:absolute;top:0;left:0;right:0;bottom:0;pointer-events:none}' +
      '.leaflet-top,.leaflet-bottom{position:absolute;z-index:1000;pointer-events:none}' +
      '.leaflet-top{top:0}.leaflet-bottom{bottom:0}.leaflet-left{left:0}.leaflet-right{right:0}' +
      '.leaflet-control{position:relative;z-index:1000;pointer-events:auto;float:left;clear:both}' +
      '.leaflet-right .leaflet-control{float:right}' +
      '.leaflet-control-attribution{margin:0;padding:0 5px;color:#333;font-size:11px;background:rgba(255,255,255,0.7)}';
    document.head.appendChild(style);
    return;
  }

  await new Promise<void>((resolve) => {
    const fallback = () => {
      if (document.querySelector('style[data-leaflet-fallback="true"]')) {
        resolve();
        return;
      }

      const style = document.createElement('style');
      style.setAttribute('data-leaflet-fallback', 'true');
      style.textContent =
        // Core pane layout (critical for tiles + SVG overlays)
        '.leaflet-container{position:relative;overflow:hidden;outline:0}' +
        '.leaflet-pane,.leaflet-map-pane,.leaflet-tile-pane,.leaflet-overlay-pane,.leaflet-shadow-pane,.leaflet-marker-pane,.leaflet-tooltip-pane,.leaflet-popup-pane{position:absolute;top:0;left:0}' +
        '.leaflet-tile{position:absolute;left:0;top:0;filter:inherit;visibility:inherit}' +
        '.leaflet-zoom-animated{transform-origin:0 0}' +
        // Controls positioning
        '.leaflet-control-container{position:absolute;top:0;left:0;right:0;bottom:0;pointer-events:none}' +
        '.leaflet-top,.leaflet-bottom{position:absolute;z-index:1000;pointer-events:none}' +
        '.leaflet-top{top:0}.leaflet-bottom{bottom:0}.leaflet-left{left:0}.leaflet-right{right:0}' +
        '.leaflet-control{position:relative;z-index:1000;pointer-events:auto;float:left;clear:both}' +
        '.leaflet-right .leaflet-control{float:right}' +
        '.leaflet-control-attribution{margin:0;padding:0 5px;color:#333;font-size:11px;background:rgba(255,255,255,0.7)}';
      document.head.appendChild(style);
      resolve();
    };

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = LEAFLET_CSS_HREF;
    link.setAttribute('data-metravel-leaflet-css', 'cdn');

    let settled = false;
    const settleResolve = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    const settleFallback = () => {
      if (settled) return;
      settled = true;
      fallback();
    };

    const timeout = window.setTimeout(() => {
      settleFallback();
    }, 5000);

    link.onload = () => {
      window.clearTimeout(timeout);
      settleResolve();
    };
    link.onerror = () => {
      window.clearTimeout(timeout);
      settleFallback();
    };

    document.head.appendChild(link);
  });
};

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

  // Ensure Leaflet CSS is present ASAP (before JS is loaded) to avoid controls/attribution layout glitches.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (!enabled) return;

    ensureLeafletCss().catch(() => {
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
        await ensureLeafletCss();
        if (cancelled) return;

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
