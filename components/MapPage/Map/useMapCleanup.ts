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

    try {
      const allLeafletContainers = document.querySelectorAll(`[id^="${LEAFLET_MAP_CONTAINER_ID_PREFIX}"]`);
      allLeafletContainers.forEach((el: any) => {
        if (el.id === mapContainerIdRef.current) return;

        try {
          const leafletId = el._leaflet_id;

          if ((window as any).L?.Util?._stamps && leafletId) {
            delete (window as any).L.Util._stamps[leafletId];
          }

          if (el._leaflet_map) {
            try {
              el._leaflet_map.remove();
            } catch {
              // Ignore
            }
            delete el._leaflet_map;
          }

          delete el._leaflet_id;
          delete el._leaflet;
          delete el._leaflet_pos;
          delete el._leaflet_events;
        } catch {
          // Ignore
        }
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

        const leafletId = container._leaflet_id;

        if ((window as any).L?.Util?._stamps && leafletId) {
          delete (window as any).L.Util._stamps[leafletId];
        }

        if (container._leaflet_map) {
          try {
            container._leaflet_map.remove();
          } catch {
            // Ignore
          }
          delete container._leaflet_map;
        }

        delete container._leaflet_id;
        delete container._leaflet;
        delete container._leaflet_pos;
        delete container._leaflet_events;
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
