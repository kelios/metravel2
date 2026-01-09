// useMapInstance.ts - Hook for managing map instance and layers
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { WEB_MAP_BASE_LAYERS, WEB_MAP_OVERLAY_LAYERS } from '@/src/config/mapWebLayers';
import { createLeafletLayer } from '@/src/utils/mapWebLayers';
import { attachOsmCampingOverlay } from '@/src/utils/mapWebOverlays/osmCampingOverlay';
import { attachLasyZanocujWfsOverlay } from '@/src/utils/mapWebOverlays/lasyZanocujWfsOverlay';
import { attachOsmPoiOverlay } from '@/src/utils/mapWebOverlays/osmPoiOverlay';
import { attachOsmRoutesOverlay } from '@/src/utils/mapWebOverlays/osmRoutesOverlay';

interface UseMapInstanceProps {
  map: any;
  L: any;
}

export function useMapInstance({ map, L }: UseMapInstanceProps) {
  const leafletBaseLayerRef = useRef<any>(null);
  const leafletOverlayLayersRef = useRef<Map<string, any>>(new Map());
  const leafletControlRef = useRef<any>(null);
  const hasInitializedLayersRef = useRef(false);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (!map || !L) return;
    if (typeof map.addLayer !== 'function') return;

    const overlayLayersSnapshot = leafletOverlayLayersRef.current;
    const overpassControllerRef: any = leafletControlRef;
    const overlayControllersRef: any = leafletControlRef;

    const cleanup = (
      controllersToStop?: Map<string, any>,
      overpassControllerToStop?: any,
      poiControllerToStop?: any,
      routesControllerToStop?: any,
      wfsControllerToStop?: any
    ) => {
      try {
        overpassControllerToStop?.stop?.();
        poiControllerToStop?.stop?.();
        routesControllerToStop?.stop?.();
        wfsControllerToStop?.stop?.();

        try {
          const controllers: Map<string, any> | undefined =
            controllersToStop || (overlayControllersRef as any).overlayControllers;
          controllers?.forEach?.((c: any) => {
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
        if (x <= 0 || y <= 0) return false;

        return true;
      } catch {
        return false;
      }
    };

    const setupLayers = () => {
      if (hasInitializedLayersRef.current) return;
      if (!canInitializeNow()) return;

      // Stop/cleanup any previous controllers/layers (defensive)
      const prevControllers: Map<string, any> | undefined = (overlayControllersRef as any).overlayControllers;
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
      (overlayControllersRef as any).overlayControllers = controllers;

      // Clean existing overlay layers
      try {
        overlayLayersSnapshot.forEach((layer) => {
          try {
            if (map.hasLayer?.(layer)) map.removeLayer(layer);
          } catch {
            // noop
          }
        });
        overlayLayersSnapshot.clear();
      } catch {
        // noop
      }

      // Clean existing base layer
      try {
        const baseLayer = leafletBaseLayerRef.current;
        if (baseLayer && map.hasLayer?.(baseLayer)) {
          map.removeLayer(baseLayer);
        }
        leafletBaseLayerRef.current = null;
      } catch {
        // noop
      }

      // Setup base layer
      const baseDef = WEB_MAP_BASE_LAYERS.find((l) => l.defaultEnabled) || WEB_MAP_BASE_LAYERS[0];
      if (baseDef) {
        const baseLayer = createLeafletLayer(L, baseDef);
        if (baseLayer) {
          leafletBaseLayerRef.current = baseLayer;
        }
      }

      const overlays: Record<string, any> = {};

      // Setup Overpass layer (camping sites)
      const overpassDef = WEB_MAP_OVERLAY_LAYERS.find((d) => d.kind === 'osm-overpass-camping');
      let overpassController: ReturnType<typeof attachOsmCampingOverlay> | null = null;
      if (overpassDef) {
        try {
          overpassController = attachOsmCampingOverlay(L, map, {
            maxAreaKm2: 2500,
            debounceMs: 700,
          });
          leafletOverlayLayersRef.current.set(overpassDef.id, overpassController.layer);
          overlays[overpassDef.title] = overpassController.layer;
          (overpassControllerRef as any).overpassController = overpassController;

          controllers.set(overpassDef.id, overpassController);
        } catch {
          // noop
        }
      }

      // Setup Overpass layer (POI)
      const poiDef = WEB_MAP_OVERLAY_LAYERS.find((d) => d.kind === 'osm-overpass-poi');
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
        } catch {
          // noop
        }
      }

      // Setup Overpass layer (routes)
      const routesDef = WEB_MAP_OVERLAY_LAYERS.find((d) => d.kind === 'osm-overpass-routes');
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
        } catch {
          // noop
        }
      }

      // Setup WFS layer (Zanocuj w lesie)
      const wfsDef = WEB_MAP_OVERLAY_LAYERS.find((d) => d.kind === 'wfs-geojson');
      let wfsController: ReturnType<typeof attachLasyZanocujWfsOverlay> | null = null;
      if (wfsDef) {
        try {
          wfsController = attachLasyZanocujWfsOverlay(L, map, wfsDef, {
            maxAreaKm2: 5000,
            debounceMs: 700,
          });
          leafletOverlayLayersRef.current.set(wfsDef.id, wfsController.layer);
          overlays[wfsDef.title] = wfsController.layer;

          controllers.set(wfsDef.id, wfsController);
        } catch {
          // noop
        }
      }

      // Setup other overlay layers
      WEB_MAP_OVERLAY_LAYERS
        .filter((d) => d.kind !== 'osm-overpass-camping' && d.kind !== 'wfs-geojson')
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
        return;
      }

      // Add default enabled overlays
      WEB_MAP_OVERLAY_LAYERS.filter((d) => d.defaultEnabled).forEach((def) => {
        const layer = leafletOverlayLayersRef.current.get(def.id);
        if (layer) {
          try {
            layer.addTo(map);
            if ((overpassControllerRef as any).overpassController?.layer === layer) {
              (overpassControllerRef as any).overpassController?.start?.();
            }

            const controllers: Map<string, any> = (overlayControllersRef as any).overlayControllers;
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

      return () => cleanup(controllers, overpassController, poiController, routesController, wfsController);
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

  return {
    leafletBaseLayerRef,
    leafletOverlayLayersRef,
    leafletControlRef,
  };
}

