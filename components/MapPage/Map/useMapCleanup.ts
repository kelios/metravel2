// components/MapPage/map/useMapCleanup.ts
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { LEAFLET_MAP_CONTAINER_ID_PREFIX } from './constants';

export const useMapCleanup = () => {
  // `useId()` гарантирует уникальность только внутри одного React root.
  // На web у Expo/Router возможны несколько root-деревьев, поэтому используем
  // собственный безопасный идентификатор для DOM id/ключей Leaflet контейнера.
  const instanceIdRef = useRef<string>('');
  if (!instanceIdRef.current) {
    const raw =
      typeof crypto !== 'undefined' && typeof (crypto as any).randomUUID === 'function'
        ? (crypto as any).randomUUID()
        : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    // Leaflet/DOM ids: держим только безопасные символы.
    instanceIdRef.current = String(raw).replace(/[^a-zA-Z0-9_-]/g, '');
  }

  const mapInstanceKeyRef = useRef<string>(`leaflet-map-${instanceIdRef.current}`);
  const mapContainerIdRef = useRef<string>(`${LEAFLET_MAP_CONTAINER_ID_PREFIX}-${instanceIdRef.current}`);
  const containerElRef = useRef<any>(null);

  // Глобальная очистка старых контейнеров при монтировании
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;

    const clearContainer = (el: any) => {
      if (!el) return;
      // Do NOT call el._leaflet_map.remove() here — react-leaflet handles its
      // own cleanup via MapContainer's unmount effect, and our leafletFix.ts
      // patch makes that safe. Calling .remove() here causes the container
      // mismatch that triggers the "reused by another instance" error.
      try { delete el._leaflet_map; } catch { /* noop */ }
      try { delete el._leaflet_id; } catch { /* noop */ }
      try { if (typeof el.innerHTML === 'string') el.innerHTML = ''; } catch { /* noop */ }
    };

    try {
      // Keep a stable reference to the current container element for unmount cleanup.
      try {
        containerElRef.current = document.getElementById(mapContainerIdRef.current) as any;
      } catch {
        // noop
      }

      const allLeafletContainers = document.querySelectorAll(`[id^="${LEAFLET_MAP_CONTAINER_ID_PREFIX}"]`);
      allLeafletContainers.forEach((el: any) => {
        // Always clean the TARGET container if it has a stale _leaflet_id
        // (previous instance left it dirty before unmount cleanup ran).
        if (el.id === mapContainerIdRef.current) {
          if (el._leaflet_id) {
            clearContainer(el);
          }
          return;
        }

        // Only touch other containers that are truly orphaned (not connected to DOM).
        if (el && typeof el.isConnected === 'boolean' && el.isConnected) return;

        clearContainer(el);
      });
    } catch (e) {
      console.warn('[Map] Failed to clean orphaned containers:', e);
    }
  }, []);

  // Очистка при размонтировании
  useEffect(() => {
    const containerId = mapContainerIdRef.current;

    return () => {
      if (Platform.OS !== 'web' || typeof document === 'undefined') return;

      try {
        // Prefer a direct element reference (it may already be detached from DOM).
        const container = (containerElRef.current as any) || (document.getElementById(containerId) as any);
        if (!container) return;

        // Do NOT call container._leaflet_map.remove() — react-leaflet handles
        // its own cleanup, and our leafletFix.ts patch makes that safe.
        try { delete container._leaflet_map; } catch { /* noop */ }
        try { delete container._leaflet_id; } catch { /* noop */ }
        try { if (typeof container.innerHTML === 'string') container.innerHTML = ''; } catch { /* noop */ }
      } catch (e) {
        console.warn('[Map] Failed to clean container on unmount:', e);
      }
    };
  }, []);

  return {
    mapInstanceKeyRef,
    mapContainerIdRef,
  };
};
