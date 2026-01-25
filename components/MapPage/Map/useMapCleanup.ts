// components/MapPage/map/useMapCleanup.ts
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { LEAFLET_MAP_CONTAINER_ID_PREFIX } from './constants';
import { generateUniqueId } from './utils';

export const useMapCleanup = () => {
  const mapInstanceKeyRef = useRef<string>(`leaflet-map-${generateUniqueId()}`);
  const mapContainerIdRef = useRef<string>(`${LEAFLET_MAP_CONTAINER_ID_PREFIX}-${generateUniqueId()}`);

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
        const container = document.getElementById(containerId) as any;
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
