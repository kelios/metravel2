// useMapApi.ts - Hook for exposing map API to parent components
import { useEffect, useCallback, useMemo, useRef } from 'react';
import { Platform } from 'react-native';
import { CoordinateConverter } from '@/utils/coordinateConverter';
import type { MapUiApi } from '@/types/mapUi';
import type { LatLng } from '@/types/coordinates';
import { buildGpx, buildKml, downloadTextFileWeb } from '@/utils/routeExport';
import { WEB_MAP_BASE_LAYERS } from '@/config/mapWebLayers';
import { createLeafletLayer } from '@/utils/mapWebLayers';
import type { OsmPoiCategory } from '@/utils/overpass';

const MOBILE_WEB_USER_FOCUS_MAX_WIDTH = 768;
const MOBILE_WEB_USER_FOCUS_OFFSET: [number, number] = [84, -92];
const USER_LOCATION_FOCUS_ZOOM = 14;

interface Point {
  id?: string | number;
  coord: string;
  address: string;
}

interface UseMapApiProps {
  map: any;
  L: any;
  onMapUiApiReady?: (api: MapUiApi | null) => void;
  travelData: Point[];
  userLocation: LatLng | null;
  routePoints: [number, number][];
  leafletBaseLayerRef: React.MutableRefObject<any>;
  leafletOverlayLayersRef: React.MutableRefObject<Map<string, any>>;
  leafletControlRef: React.MutableRefObject<any>;
  onRequestUserLocationFocus?: () => void | Promise<void>;
}

export function useMapApi({
  map,
  L,
  onMapUiApiReady,
  travelData,
  userLocation,
  routePoints,
  leafletBaseLayerRef,
  leafletOverlayLayersRef,
  leafletControlRef,
  onRequestUserLocationFocus,
}: UseMapApiProps) {
  const pendingOverlayTogglesRef = useRef<Map<string, boolean>>(new Map());
  const pendingOverlayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingOverlayAttemptsRef = useRef(0);
  // Таймеры openPopupForCoord — трекаем, чтобы снять при unmount (иначе колбэк
  // дёргает openPopup/setZIndexOffset на снятом маркере уже размонтированной карты).
  const popupTimersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

  const centerMapOnUser = useCallback((targetLocation: LatLng, zoom = USER_LOCATION_FOCUS_ZOOM) => {
    if (!map) return;
    try {
      const target = CoordinateConverter.toLeaflet(targetLocation);
      map.setView(target, zoom, { animate: true });

      const containerWidth = Number(map?.getContainer?.()?.clientWidth ?? 0);
      const shouldOffsetForCompactWeb =
        Platform.OS === 'web' &&
        containerWidth > 0 &&
        containerWidth < MOBILE_WEB_USER_FOCUS_MAX_WIDTH &&
        typeof map?.panBy === 'function';

      if (shouldOffsetForCompactWeb) {
        map.panBy(MOBILE_WEB_USER_FOCUS_OFFSET, { animate: true });
      }
    } catch {
      // noop
    }
  }, [map]);

  const canExportRoute = useMemo(() => (routePoints?.length ?? 0) >= 2, [routePoints?.length]);

  const centerOnUserLocation = useCallback(() => {
    if (!map) return;
    if (userLocation) {
      centerMapOnUser(userLocation, 13);
      return;
    }
    if (onRequestUserLocationFocus) {
      try {
        void onRequestUserLocationFocus();
      } catch {
        // noop
      }
    }
  }, [centerMapOnUser, map, onRequestUserLocationFocus, userLocation]);

  const handleDownloadGpx = useCallback(() => {
    if (!routePoints || routePoints.length < 2) return;
    const result = buildGpx({
      track: routePoints,
      name: `Route ${new Date().toISOString().split('T')[0]}`,
    });
    downloadTextFileWeb(result);
  }, [routePoints]);

  const handleDownloadKml = useCallback(() => {
    if (!routePoints || routePoints.length < 2) return;
    const result = buildKml({
      track: routePoints,
      name: `Route ${new Date().toISOString().split('T')[0]}`,
    });
    downloadTextFileWeb(result);
  }, [routePoints]);

  const api = useMemo<MapUiApi | null>(() => {
    if (!map || !L) return null;

    const schedulePendingOverlayFlush = () => {
      try {
        if (pendingOverlayTimerRef.current) return;
        pendingOverlayTimerRef.current = setTimeout(() => {
          pendingOverlayTimerRef.current = null;
          try {
            const available = leafletOverlayLayersRef.current;
            if (!available || available.size === 0) {
              pendingOverlayAttemptsRef.current += 1;
              if (pendingOverlayAttemptsRef.current < 10) {
                schedulePendingOverlayFlush();
              } else {
                pendingOverlayTogglesRef.current.clear();
                pendingOverlayAttemptsRef.current = 0;
              }
              return;
            }

            const toApply = Array.from(pendingOverlayTogglesRef.current.entries());
            pendingOverlayTogglesRef.current.clear();

            for (const [id, enabled] of toApply) {
              try {
                const layer = available.get(id);
                if (!layer) {
                  pendingOverlayTogglesRef.current.set(id, enabled);
                  continue;
                }
                if (enabled) {
                  layer.addTo(map);
                } else if (map.hasLayer?.(layer)) {
                  map.removeLayer(layer);
                }

                const overpassController = (leafletControlRef as any).overpassController;
                if (overpassController?.layer === layer) {
                  if (enabled) overpassController.start?.();
                  else overpassController.stop?.();
                }

                const controllers: Map<string, any> = (leafletControlRef as any).overlayControllers;
                const controller = controllers?.get?.(id);
                if (controller?.layer === layer) {
                  if (enabled) controller.start?.();
                  else controller.stop?.();
                }
              } catch {
                // noop
              }
            }

            if (pendingOverlayTogglesRef.current.size > 0) {
              pendingOverlayAttemptsRef.current += 1;
              if (pendingOverlayAttemptsRef.current < 10) {
                schedulePendingOverlayFlush();
              } else {
                pendingOverlayTogglesRef.current.clear();
                pendingOverlayAttemptsRef.current = 0;
              }
            } else {
              pendingOverlayAttemptsRef.current = 0;
            }
          } catch {
            // noop
          }
        }, 220);
      } catch {
        // noop
      }
    };

    return {
      zoomIn: () => {
        try {
          map.zoomIn();
        } catch {
          // noop
        }
      },
      zoomOut: () => {
        try {
          map.zoomOut();
        } catch {
          // noop
        }
      },
      centerOnUser: centerOnUserLocation,
      focusOnCoord: (coord: string, options?: { zoom?: number }) => {
        try {
          const parsed = CoordinateConverter.fromLooseString(String(coord));
          if (!parsed || !CoordinateConverter.isValid(parsed)) return;

          const targetZoom =
            typeof options?.zoom === 'number' && Number.isFinite(options.zoom)
              ? options.zoom
              : 14;

          try {
            map.closePopup?.();
          } catch {
            // noop
          }

          if (typeof map.flyTo === 'function') {
            map.flyTo(CoordinateConverter.toLeaflet(parsed), targetZoom, { animate: true, duration: 0.35 } as any);
            return;
          }
          if (typeof map.setView === 'function') {
            map.setView(CoordinateConverter.toLeaflet(parsed), targetZoom, { animate: true } as any);
          }
        } catch {
          // noop
        }
      },
      openPopupForCoord: (coord: string) => {
        try {
          const rawKey = String(coord ?? '').trim();
          if (!rawKey) return;

          // Продьюсер (Map.web.tsx) пишет markerByCoord напрямую на объект ref,
          // а не в .current — читаем оттуда же.
          const markerIndex: Map<string, any> | undefined =
            (leafletControlRef as any)?.markerByCoord;

          const tryFindMarker = () => {
            const parsed = CoordinateConverter.fromLooseString(rawKey);
            const key = parsed ? CoordinateConverter.toString(parsed) : rawKey;
            return markerIndex?.get?.(key) ?? markerIndex?.get?.(rawKey) ?? null;
          };

          const marker = tryFindMarker();
          if (!marker) {
            // Marker refs can appear shortly after flyTo/cluster recompute; retry once.
            const retryTimer = setTimeout(() => {
              popupTimersRef.current.delete(retryTimer);
              try {
                const nextMarker = tryFindMarker();
                if (!nextMarker) return;
                try {
                  nextMarker.openPopup?.();
                } catch {
                  // noop
                }
              } catch {
                // noop
              }
            }, 500);
            popupTimersRef.current.add(retryTimer);
            return;
          }

          try {
            marker.setZIndexOffset?.(1000);
          } catch {
            // noop
          }

          const mapInstance = marker?._map;
          let didOpen = false;

          try {
            if (mapInstance && typeof mapInstance.once === 'function') {
              mapInstance.once('moveend', () => {
                if (didOpen) return;
                didOpen = true;
                try {
                  marker.openPopup?.();
                } catch {
                  // noop
                }
              });
            }
          } catch {
            // noop
          }

          const openTimer = setTimeout(() => {
            popupTimersRef.current.delete(openTimer);
            if (didOpen) return;
            didOpen = true;
            try {
              marker.openPopup?.();
            } catch {
              // noop
            }
          }, 420);
          popupTimersRef.current.add(openTimer);

          // Reset zIndex after a short delay so it doesn't permanently stay on top
          const zIndexTimer = setTimeout(() => {
            popupTimersRef.current.delete(zIndexTimer);
            try {
              marker.setZIndexOffset?.(0);
            } catch {
              // noop
            }
          }, 1400);
          popupTimersRef.current.add(zIndexTimer);
        } catch {
          // noop
        }
      },
      fitToResults: () => {
        if (!travelData?.length) return;
        try {
          const coords = travelData
            .map((p) => CoordinateConverter.fromLooseString(p.coord))
            .filter((c): c is LatLng => c != null && CoordinateConverter.isValid(c));
          if (coords.length === 0) return;

          const bounds = (L as any).latLngBounds(
            coords.map((c) => CoordinateConverter.toLeaflet(c))
          );
          map.fitBounds(bounds.pad(0.2), { animate: false });
        } catch {
          // noop
        }
      },
      exportGpx: handleDownloadGpx,
      exportKml: handleDownloadKml,
      setBaseLayer: (id: string) => {
        try {
          const def = WEB_MAP_BASE_LAYERS.find((d) => d.id === id);
          if (!def) return;
          // Базовая подложка всегда светлая (OSM-прокси), независимо от темы UI.
          const newLayer = createLeafletLayer(L, def);
          if (!newLayer) return;

          const current = leafletBaseLayerRef.current;
          if (current && map.hasLayer?.(current)) {
            map.removeLayer(current);
          }
          leafletBaseLayerRef.current = newLayer;
          newLayer.addTo(map);
        } catch {
          // noop
        }
      },
      setOverlayEnabled: (id: string, enabled: boolean) => {
        try {
          const layer = leafletOverlayLayersRef.current.get(id);
          if (!layer) {
            pendingOverlayTogglesRef.current.set(id, enabled);
            schedulePendingOverlayFlush();
            console.warn(
              '[useMapApi] Layer not found (queued):',
              id,
              'Available layers:',
              Array.from(leafletOverlayLayersRef.current.keys())
            );
            return;
          }

          if (enabled) {
            layer.addTo(map);
          } else if (map.hasLayer?.(layer)) {
            map.removeLayer(layer);
          }

          // Get controller from the unified overlayControllers map
          const controllers: Map<string, any> = (leafletControlRef as any).overlayControllers;
          const controller = controllers?.get?.(id);

          if (controller) {
            if (enabled) {
              controller.start?.();
            } else {
              controller.stop?.();
            }
          } else {
            const looksLikeTileLayer = Boolean(
              (layer as any)?.getTileUrl ||
                (layer as any)?._url ||
                (typeof (layer as any)?.getContainer === 'function' && (layer as any)?.getContainer())
            );
            if (!looksLikeTileLayer) {
              console.warn(
                '[useMapApi] No controller for non-tile overlay layer:',
                id,
                'available controllers:',
                controllers ? Array.from(controllers.keys()) : 'none'
              );
            }
          }
        } catch (e) {
          console.warn('[useMapApi] setOverlayEnabled error:', e);
        }
      },
      setOsmPoiCategories: (categories: string[]) => {
        try {
          const controllers: Map<string, any> = (leafletControlRef as any).overlayControllers;
          const controller = controllers?.get?.('osm-poi');
          controller?.setCategories?.(categories as unknown as OsmPoiCategory[]);
        } catch {
          // noop
        }
      },
      capabilities: {
        canCenterOnUser: Boolean(userLocation),
        canFitToResults: Boolean(travelData?.length),
        canExportRoute,
      },
    };
  }, [
    L,
    map,
    centerOnUserLocation,
    handleDownloadGpx,
    handleDownloadKml,
    travelData,
    userLocation,
    canExportRoute,
    leafletBaseLayerRef,
    leafletOverlayLayersRef,
    leafletControlRef,
  ]);

  // Track if api is ready (map and L are available)
  const isApiReady = Boolean(map && L);

  // Держим колбэк в ref, чтобы немемоизированный onMapUiApiReady от родителя не
  // приводил к лишнему null-уведомлению на каждый ререндер (см. cleanup ниже).
  const onMapUiApiReadyRef = useRef(onMapUiApiReady);
  onMapUiApiReadyRef.current = onMapUiApiReady;

  // Пере-доставляем api при каждом его изменении (а не только при первом переходе
  // в ready), иначе родитель держит устаревший объект с замороженными capabilities
  // (canCenterOnUser/canFitToResults/...). api === null ровно когда карта не готова,
  // так что отдельная ветка для not-ready не нужна. Cleanup тут НЕ шлёт null, чтобы
  // не мигать null→api при каждом изменении api; null при unmount — в эффекте ниже.
  useEffect(() => {
    onMapUiApiReadyRef.current?.(api);
  }, [api, isApiReady]);

  // Снимаем все отложенные таймеры при unmount и уведомляем родителя об уходе api.
  // overlay-flush и popup-таймеры не должны срабатывать на уничтоженной карте.
  useEffect(() => {
    const popupTimers = popupTimersRef.current;
    return () => {
      if (pendingOverlayTimerRef.current) {
        clearTimeout(pendingOverlayTimerRef.current);
        pendingOverlayTimerRef.current = null;
      }
      popupTimers.forEach((t) => clearTimeout(t));
      popupTimers.clear();
      onMapUiApiReadyRef.current?.(null);
    };
  }, []);
}
