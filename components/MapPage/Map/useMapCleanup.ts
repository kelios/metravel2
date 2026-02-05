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
      try {
        if (el._leaflet_map) {
          try {
            el._leaflet_map.remove();
          } catch {
            // Ignore
          }
        }
      } catch {
        // Ignore
      }
      try {
        delete el._leaflet_map;
      } catch {
        // Ignore
      }
      try {
        delete el._leaflet_id;
      } catch {
        // Ignore
      }
      try {
        if (typeof el.innerHTML === 'string') el.innerHTML = '';
      } catch {
        // Ignore
      }
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
        if (el.id === mapContainerIdRef.current) return;

        // Only touch containers that are truly orphaned (not connected to DOM).
        // Avoid mutating Leaflet internal/private fields (_leaflet_id, _leaflet_events, L.Util._stamps).
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

        if (container._leaflet_map) {
          try {
            container._leaflet_map.remove();
          } catch {
            // Ignore
          }
        }

        try {
          delete container._leaflet_map;
        } catch {
          // Ignore
        }
        try {
          delete container._leaflet_id;
        } catch {
          // Ignore
        }
        try {
          if (typeof container.innerHTML === 'string') container.innerHTML = '';
        } catch {
          // Ignore
        }
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
