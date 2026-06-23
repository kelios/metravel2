// useMapInstance.ts - Hook for managing map instance and layers
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import {
  getActiveOverlayLayers,
  getThemedBaseTileUrl,
  getThemedBaseAttribution,
  getThemedBaseMaxZoom,
} from '@/config/mapWebLayers';
import { createLeafletLayer, attachTileRetry } from '@/utils/mapWebLayers';
import { attachOsmCampingOverlay } from '@/utils/mapWebOverlays/osmCampingOverlay';
import { attachLasyZanocujWfsOverlay } from '@/utils/mapWebOverlays/lasyZanocujWfsOverlay';
import { attachOsmPoiOverlay } from '@/utils/mapWebOverlays/osmPoiOverlay';
import { attachOsmRoutesOverlay } from '@/utils/mapWebOverlays/osmRoutesOverlay';
import { attachOsmFeaturesOverlay } from '@/utils/mapWebOverlays/osmFeaturesOverlay';
import { attachWeatherTempLabelsOverlay } from '@/utils/mapWebOverlays/weatherTempLabelsOverlay';

interface UseMapInstanceProps {
  map: any;
  L: any;
  /**
   * Тёмная тема приложения. Базовая подложка карты на неё больше НЕ реагирует
   * (карта всегда обычная/светлая по требованию пользователя); проп оставлен
   * для обратной совместимости вызова.
   */
  isDark?: boolean;
}

/**
 * Опции базового tile-слоя подложки. Подложка всегда светлая (OSM-прокси, без
 * {s}), независимо от темы приложения.
 *
 * OSM-прокси отдаёт только @1x. Не включаем Leaflet detectRetina: на HiDPI он
 * запрашивает следующий zoom и режет тайлы до 128px, что резко увеличивает
 * нагрузку на прокси и даёт "шахматку" при первичном auto-fit карты.
 */
export const getThemedBaseLayerOptions = () => ({
  attribution: getThemedBaseAttribution(),
  maxZoom: getThemedBaseMaxZoom(),
  // Сглаживаем зум: держим больше окружающих тайлов в памяти, не перезапрашиваем
  // во время зум-анимации (грузим по её завершении) и плавно проявляем загруженные
  // тайлы. Без этого Leaflet рисует «шахматку» из серых пустых ячеек при зуме.
  keepBuffer: 4,
  updateWhenZooming: false,
  updateWhenIdle: false,
  fadeAnimation: true,
  crossOrigin: 'anonymous' as const,
});

const createThemedBaseLayer = (L: any) => {
  if (!L) return null;
  return attachTileRetry(L.tileLayer(getThemedBaseTileUrl(), getThemedBaseLayerOptions()));
};

export function useMapInstance({ map, L }: UseMapInstanceProps) {
  const leafletBaseLayerRef = useRef<any>(null);
  const leafletOverlayLayersRef = useRef<Map<string, any>>(new Map());
  const leafletControlRef = useRef<any>(null);
  const hasInitializedLayersRef = useRef(false);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (!map || !L) return;
    if (typeof map.addLayer !== 'function') return;

    const cleanup = () => {
      try {
        const controllers: Map<string, any> | undefined = (leafletControlRef as any).overlayControllers;
        const overlayLayersSnapshot = new Map(leafletOverlayLayersRef.current);

        const overpassControllerToStop = (leafletControlRef as any).overpassController;
        const poiControllerToStop = (leafletControlRef as any).poiController;
        const routesControllerToStop = (leafletControlRef as any).routesController;
        const wfsControllerToStop = (leafletControlRef as any).wfsController;

        try {
          controllers?.forEach?.((c) => {
            try {
              c?.stop?.();
            } catch {
              // noop
            }
          });
          controllers?.clear?.();
        } catch {
          // noop
        }

        try {
          overlayLayersSnapshot.forEach((layer) => {
            try {
              if (map.hasLayer?.(layer)) map.removeLayer(layer);
            } catch {
              // noop
            }
          });
          overlayLayersSnapshot.clear();
          try {
            leafletOverlayLayersRef.current.clear();
          } catch {
            // noop
          }
        } catch {
          // noop
        }

        try {
          const baseLayer = leafletBaseLayerRef.current;
          if (baseLayer && map.hasLayer?.(baseLayer)) {
            map.removeLayer(baseLayer);
          }
          leafletBaseLayerRef.current = null;
        } catch {
          // noop
        }

        try {
          if ((overpassControllerToStop as any)?.layer && map.hasLayer?.((overpassControllerToStop as any).layer)) {
            map.removeLayer((overpassControllerToStop as any).layer);
          }
          if ((poiControllerToStop as any)?.layer && map.hasLayer?.((poiControllerToStop as any).layer)) {
            map.removeLayer((poiControllerToStop as any).layer);
          }
          if ((routesControllerToStop as any)?.layer && map.hasLayer?.((routesControllerToStop as any).layer)) {
            map.removeLayer((routesControllerToStop as any).layer);
          }
          if ((wfsControllerToStop as any)?.layer && map.hasLayer?.((wfsControllerToStop as any).layer)) {
            map.removeLayer((wfsControllerToStop as any).layer);
          }
        } catch {
          // noop
        }

        try {
          (overpassControllerToStop as any)?.stop?.();
          (poiControllerToStop as any)?.stop?.();
          (routesControllerToStop as any)?.stop?.();
          (wfsControllerToStop as any)?.stop?.();
        } catch {
          // noop
        }

        // Drop ad-hoc controller references so we don't retain stopped
        // controllers across re-initializations.
        (leafletControlRef as any).overpassController = undefined;
        (leafletControlRef as any).poiController = undefined;
        (leafletControlRef as any).routesController = undefined;
        (leafletControlRef as any).wfsController = undefined;
        (leafletControlRef as any).overlayControllers = undefined;
      } catch {
        // noop
      }
    };

    const canInitializeNow = () => {
      try {
        const center = map.getCenter?.();
        if (!center || !Number.isFinite(center.lat) || !Number.isFinite(center.lng)) return false;

        const zoom = map.getZoom?.();
        if (!Number.isFinite(zoom)) return false;

        const size = map.getSize?.();
        const x = size?.x;
        const y = size?.y;
        if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
        return !(x <= 0 || y <= 0);
      } catch {
        return false;
      }
    };

    const setupLayers = () => {
      if (hasInitializedLayersRef.current) return;
      if (!canInitializeNow()) return;

      // Stop/cleanup any previous controllers/layers (defensive)
      const prevControllers: Map<string, any> | undefined = (leafletControlRef as any).overlayControllers;
      if (prevControllers && typeof prevControllers.forEach === 'function') {
        try {
          prevControllers.forEach((c) => {
            try {
              c?.stop?.();
            } catch {
              // noop
            }
          });
        } catch {
          // noop
        }
      }

      const controllers: Map<string, any> = new Map<string, any>();
      (leafletControlRef as any).overlayControllers = controllers;

      // КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: НЕ удаляем существующие overlay слои!
      // Линия маршрута уже может быть нарисована в overlay pane
      // Мы только добавляем новые слои, не удаляем старые
      // Clean existing base layer only
      try {
        const baseLayer = leafletBaseLayerRef.current;
        if (baseLayer && map.hasLayer?.(baseLayer)) {
          map.removeLayer(baseLayer);
        }
        leafletBaseLayerRef.current = null;
      } catch {
        // noop
      }

      // Setup base layer (всегда светлая OSM-подложка, независимо от темы UI).
      const baseLayer = createThemedBaseLayer(L);
      if (baseLayer) {
        leafletBaseLayerRef.current = baseLayer;
      }

      const overlays: Record<string, any> = {};

      // Активные слои (отфильтрованы по requiresEnv — слои без ключа скрыты).
      const overlayDefs = getActiveOverlayLayers();

      // Setup Overpass layer (camping sites)
      const overpassDef = overlayDefs.find((d) => d.kind === 'osm-overpass-camping');
      let overpassController: ReturnType<typeof attachOsmCampingOverlay> | null = null;
      if (overpassDef) {
        try {
          overpassController = attachOsmCampingOverlay(L, map, {
            maxAreaKm2: 2500,
            debounceMs: 700,
          });
          leafletOverlayLayersRef.current.set(overpassDef.id, overpassController.layer);
          overlays[overpassDef.title] = overpassController.layer;
          (leafletControlRef as any).overpassController = overpassController;

          controllers.set(overpassDef.id, overpassController);
        } catch (e) {
          console.warn('[useMapInstance] Failed to create camping overlay:', e);
        }
      }

      // Setup Overpass layer (POI)
      const poiDef = overlayDefs.find((d) => d.kind === 'osm-overpass-poi');
      let poiController: ReturnType<typeof attachOsmPoiOverlay> | null = null;
      if (poiDef) {
        try {
          poiController = attachOsmPoiOverlay(L, map, {
            maxAreaKm2: 2500,
            debounceMs: 700,
          });
          leafletOverlayLayersRef.current.set(poiDef.id, poiController.layer);
          overlays[poiDef.title] = poiController.layer;
          controllers.set(poiDef.id, poiController);
        } catch (e) {
          console.warn('[useMapInstance] Failed to create POI overlay:', e);
        }
      }

      // Setup Overpass layer (routes)
      const routesDef = overlayDefs.find((d) => d.kind === 'osm-overpass-routes');
      let routesController: ReturnType<typeof attachOsmRoutesOverlay> | null = null;
      if (routesDef) {
        try {
          routesController = attachOsmRoutesOverlay(L, map, {
            maxAreaKm2: 1500,
            debounceMs: 800,
          });
          leafletOverlayLayersRef.current.set(routesDef.id, routesController.layer);
          overlays[routesDef.title] = routesController.layer;
          controllers.set(routesDef.id, routesController);
        } catch (e) {
          console.warn('[useMapInstance] Failed to create routes overlay:', e);
        }
      }

      // Setup generic Overpass feature overlays (nature/sights/service).
      overlayDefs
        .filter((d) => d.kind === 'osm-overpass-features')
        .forEach((def) => {
          try {
            const featuresController = attachOsmFeaturesOverlay(L, map, {
              filters: def.overpassFilters ?? [],
              color: def.markerColor,
              minZoom: def.minZoom,
              layerId: def.id,
              maxAreaKm2: 2500,
              debounceMs: 700,
            });
            leafletOverlayLayersRef.current.set(def.id, featuresController.layer);
            overlays[def.title] = featuresController.layer;
            controllers.set(def.id, featuresController);
          } catch (e) {
            console.warn(`[useMapInstance] Failed to create features overlay ${def.id}:`, e);
          }
        });

      // Setup weather temperature labels overlay (OWM /data/2.5/weather grid, numeric °C)
      const tempLabelsDef = overlayDefs.find((d) => d.kind === 'weather-temp-labels');
      if (tempLabelsDef) {
        try {
          const tempLabelsController = attachWeatherTempLabelsOverlay(L, map, {
            debounceMs: 600,
            maxLabels: 12,
            gridCols: 4,
            gridRows: 3,
          });
          leafletOverlayLayersRef.current.set(tempLabelsDef.id, tempLabelsController.layer);
          overlays[tempLabelsDef.title] = tempLabelsController.layer;
          controllers.set(tempLabelsDef.id, tempLabelsController);
        } catch (e) {
          console.warn('[useMapInstance] Failed to create weather temp labels overlay:', e);
        }
      }

      // Setup WFS layer (Zanocuj w lesie)
      const wfsDef = overlayDefs.find((d) => d.kind === 'wfs-geojson');
      let wfsController: ReturnType<typeof attachLasyZanocujWfsOverlay> | null = null;
      if (wfsDef) {
        try {
          wfsController = attachLasyZanocujWfsOverlay(L, map, wfsDef, {
            maxAreaKm2: 1200,
            debounceMs: 800,
          });
          leafletOverlayLayersRef.current.set(wfsDef.id, wfsController.layer);
          overlays[wfsDef.title] = wfsController.layer;

          controllers.set(wfsDef.id, wfsController);
        } catch (e) {
          console.warn('[useMapInstance] Failed to create WFS overlay:', e);
        }
      }

      // Setup other overlay layers (exclude kinds that have dedicated controllers)
      overlayDefs
        .filter((d) =>
          d.kind !== 'osm-overpass-camping' &&
          d.kind !== 'osm-overpass-poi' &&
          d.kind !== 'osm-overpass-routes' &&
          d.kind !== 'osm-overpass-features' &&
          d.kind !== 'weather-temp-labels' &&
          d.kind !== 'wfs-geojson'
        )
        .forEach((def) => {
          const layer = createLeafletLayer(L, def);
          if (!layer) return;
          leafletOverlayLayersRef.current.set(def.id, layer);
          overlays[def.title] = layer;
        });

      // Add base layer to map
      try {
        const baseLayer = leafletBaseLayerRef.current;
        if (baseLayer && !map.hasLayer?.(baseLayer)) {
          baseLayer.addTo(map);
        }
      } catch (e: any) {
        // If the map is in an invalid sizing/zoom state, Leaflet can throw here.
        // We'll retry on the next map event.
        try {
          if (typeof e?.message === 'string' && e.message.includes('infinite number of tiles')) {
            const baseLayer = leafletBaseLayerRef.current;
            if (baseLayer && map.hasLayer?.(baseLayer)) map.removeLayer(baseLayer);
            leafletBaseLayerRef.current = null;
          }
        } catch {
          // noop
        }
        // Tear down everything created in this aborted pass so the next retry
        // doesn't end up with a duplicate set of overlays/controllers/subscriptions.
        cleanup();
        return;
      }

      // Add default enabled overlays
      overlayDefs.filter((d) => d.defaultEnabled).forEach((def) => {
        const layer = leafletOverlayLayersRef.current.get(def.id);
        if (layer) {
          try {
            layer.addTo(map);
            if ((leafletControlRef as any).overpassController?.layer === layer) {
              (leafletControlRef as any).overpassController?.start?.();
            }

            const controllers: Map<string, any> = (leafletControlRef as any).overlayControllers;
            const controller = controllers?.get?.(def.id);
            if (controller?.layer === layer) {
              controller.start?.();
            }
          } catch {
            // noop
          }
        }
      });

      hasInitializedLayersRef.current = true;

      // Cleanup будет вызван через return основного useEffect
      return undefined;
    };

    let lastCleanup: (() => void) | undefined;
    const trySetup = () => {
      if (lastCleanup) return;
      const cleanupFn = setupLayers();
      if (cleanupFn) lastCleanup = cleanupFn;
    };

    trySetup();

    const onLoad = () => trySetup();
    const onResize = () => trySetup();

    try {
      map.on?.('load', onLoad);
      map.on?.('resize', onResize);
      map.on?.('moveend', onResize);
      map.on?.('zoomend', onResize);
    } catch {
      // noop
    }

    return () => {
      try {
        map.off?.('load', onLoad);
        map.off?.('resize', onResize);
        map.off?.('moveend', onResize);
        map.off?.('zoomend', onResize);
      } catch {
        // noop
      }

      hasInitializedLayersRef.current = false;
      lastCleanup?.();
      lastCleanup = undefined;
      cleanup();
    };
  }, [map, L]);

  // Базовая подложка карты всегда светлая (OSM-прокси) и не реагирует на смену
  // темы приложения — отдельный theme-swap-эффект для подложки больше не нужен.

  return {
    leafletBaseLayerRef,
    leafletOverlayLayersRef,
    leafletControlRef,
  };
}
