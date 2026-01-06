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

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (!map || !L) return;
    if (typeof map.addLayer !== 'function') return;

    const overlayLayersSnapshot = leafletOverlayLayersRef.current;
    const baseLayerSnapshot = leafletBaseLayerRef.current;

    // Check if map is properly initialized with valid center
    try {
      const center = map.getCenter?.();
      if (!center || !Number.isFinite(center.lat) || !Number.isFinite(center.lng)) {
        // Map not yet initialized with valid center, skip layer setup
        return;
      }
    } catch {
      // Map not ready
      return;
    }

    const overpassControllerRef: any = leafletControlRef;
    const overlayControllersRef: any = leafletControlRef;

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
      const baseLayer = baseLayerSnapshot;
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
    WEB_MAP_OVERLAY_LAYERS.filter((d) => d.kind !== 'osm-overpass-camping' && d.kind !== 'wfs-geojson').forEach((def) => {
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
    } catch {
      // noop
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

    return () => {
      try {
        overpassController?.stop?.();
        poiController?.stop?.();
        routesController?.stop?.();
        wfsController?.stop?.();

        try {
          const controllers: Map<string, any> | undefined = (overlayControllersRef as any).overlayControllers;
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
          if ((overpassController as any)?.layer && map.hasLayer?.((overpassController as any).layer)) {
            map.removeLayer((overpassController as any).layer);
          }
          if ((poiController as any)?.layer && map.hasLayer?.((poiController as any).layer)) {
            map.removeLayer((poiController as any).layer);
          }
          if ((routesController as any)?.layer && map.hasLayer?.((routesController as any).layer)) {
            map.removeLayer((routesController as any).layer);
          }
          if ((wfsController as any)?.layer && map.hasLayer?.((wfsController as any).layer)) {
            map.removeLayer((wfsController as any).layer);
          }
        } catch {
          // noop
        }
      } catch {
        // noop
      }
    };
  }, [map, L]);

  return {
    leafletBaseLayerRef,
    leafletOverlayLayersRef,
    leafletControlRef,
  };
}

