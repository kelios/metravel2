// components/map-core/useMapLifecycle.ts
// C2.3: Shared Leaflet container lifecycle — cleanup, ResizeObserver, invalidateSize
import { useEffect, useLayoutEffect, useRef } from 'react';
import { Platform } from 'react-native';

const LEAFLET_MAP_CONTAINER_ID_PREFIX = 'metravel-leaflet-map';

const isWeb = Platform.OS === 'web';

// ---------------------------------------------------------------------------
// Unique instance ID generator
// ---------------------------------------------------------------------------

const generateInstanceId = (): string => {
  const raw =
    typeof crypto !== 'undefined' && typeof (crypto as any).randomUUID === 'function'
      ? (crypto as any).randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return String(raw).replace(/[^a-zA-Z0-9_-]/g, '');
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const clearContainer = (el: any) => {
  if (!el) return;
  try { delete el._leaflet_map; } catch { /* noop */ }
  try { delete el._leaflet_id; } catch { /* noop */ }
  try { if (typeof el.innerHTML === 'string') el.innerHTML = ''; } catch { /* noop */ }
};

const hasMapPane = (map: any) => !!map && !!(map as any)?._mapPane;

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export interface UseMapLifecycleOptions {
  /** Ref to the root wrapper element (for ResizeObserver) */
  rootRef: React.RefObject<any>;
  /** Ref to the Leaflet map instance */
  mapRef: React.MutableRefObject<any>;
}

export interface UseMapLifecycleReturn {
  /** Unique key for <MapContainer key={…}> */
  mapInstanceKeyRef: React.MutableRefObject<string>;
  /** Unique DOM id for the container element */
  mapContainerIdRef: React.MutableRefObject<string>;
}

export const useMapLifecycle = ({
  rootRef,
  mapRef,
}: UseMapLifecycleOptions): UseMapLifecycleReturn => {
  const instanceIdRef = useRef<string>('');
  if (!instanceIdRef.current) {
    instanceIdRef.current = generateInstanceId();
  }

  const mapInstanceKeyRef = useRef<string>(`leaflet-map-${instanceIdRef.current}`);
  const mapContainerIdRef = useRef<string>(`${LEAFLET_MAP_CONTAINER_ID_PREFIX}-${instanceIdRef.current}`);
  const containerElRef = useRef<any>(null);

  // 1. Pre-paint: clean stale _leaflet_id from our container (prevents "Map container is being reused")
  useLayoutEffect(() => {
    if (!isWeb || typeof document === 'undefined') return;
    try {
      const allContainers = document.querySelectorAll(`[id^="${LEAFLET_MAP_CONTAINER_ID_PREFIX}"]`);
      allContainers.forEach((el: any) => {
        if (el.id !== mapContainerIdRef.current) return;
        if (!el._leaflet_id) return;
        clearContainer(el);
      });
    } catch { /* noop */ }
  }, []);

  // 2. Post-mount: clean orphaned containers from other instances
  useEffect(() => {
    if (!isWeb || typeof document === 'undefined') return;
    try {
      containerElRef.current = document.getElementById(mapContainerIdRef.current) as any;

      const allContainers = document.querySelectorAll(`[id^="${LEAFLET_MAP_CONTAINER_ID_PREFIX}"]`);
      allContainers.forEach((el: any) => {
        if (el.id === mapContainerIdRef.current) {
          if (el._leaflet_id) clearContainer(el);
          return;
        }
        if (el && typeof el.isConnected === 'boolean' && el.isConnected) return;
        clearContainer(el);
      });
    } catch (e) {
      console.warn('[Map] Failed to clean orphaned containers:', e);
    }
  }, []);

  // 3. Unmount: cleanup mapRef + DOM container
  useEffect(() => {
    const containerId = mapContainerIdRef.current;
    return () => {
      mapRef.current = null;

      // Clear global reference (used by some map tools)
      try {
        if (typeof window !== 'undefined') {
          const w = window as any;
          if (w.__metravelLeafletMap) delete w.__metravelLeafletMap;
        }
      } catch { /* noop */ }

      if (!isWeb || typeof document === 'undefined') return;
      try {
        const rootEl = rootRef.current;
        const container =
          (containerElRef.current as any) ||
          (rootEl as any)?.querySelector?.('.leaflet-container') as any ||
          (document.getElementById(containerId) as any);
        if (container) clearContainer(container);
      } catch { /* noop */ }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 4. ResizeObserver: invalidate map size on container resize
  useEffect(() => {
    if (!isWeb) return;
    const el = rootRef.current as HTMLElement | null;
    if (!el || typeof ResizeObserver === 'undefined') return;

    const ro = new ResizeObserver(() => {
      const map = mapRef.current;
      if (!map || typeof map.invalidateSize !== 'function') return;
      try { map.invalidateSize(true); } catch { /* noop */ }
    });
    ro.observe(el);
    return () => { ro.disconnect(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { mapInstanceKeyRef, mapContainerIdRef };
};

/** Check whether a Leaflet map instance has a valid _mapPane (is fully initialized) */
export { hasMapPane };

