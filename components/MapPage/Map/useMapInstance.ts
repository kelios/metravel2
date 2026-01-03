// useMapInstance.ts - Hook for managing map instance and layers
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { WEB_MAP_BASE_LAYERS, WEB_MAP_OVERLAY_LAYERS } from '@/src/config/mapWebLayers';
import { createLeafletLayer } from '@/src/utils/mapWebLayers';
import { attachOsmCampingOverlay } from '@/src/utils/mapWebOverlays/osmCampingOverlay';

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

    const overpassControllerRef: any = leafletControlRef;

    // Clean existing overlay layers
    try {
      leafletOverlayLayersRef.current.forEach((layer) => {
        try {
          if (map.hasLayer?.(layer)) map.removeLayer(layer);
        } catch {
          // noop
        }
      });
      leafletOverlayLayersRef.current.clear();
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
      } catch {
        // noop
      }
    }

    // Setup other overlay layers
    WEB_MAP_OVERLAY_LAYERS.filter((d) => d.kind !== 'osm-overpass-camping').forEach((def) => {
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
        } catch {
          // noop
        }
      }
    });

    return () => {
      try {
        overpassController?.stop();
        if (overpassController?.layer && map.hasLayer?.(overpassController.layer)) {
          map.removeLayer(overpassController.layer);
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

