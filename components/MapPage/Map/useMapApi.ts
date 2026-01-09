// useMapApi.ts - Hook for exposing map API to parent components
import { useEffect, useCallback, useMemo, useRef } from 'react';
import { CoordinateConverter } from '@/utils/coordinateConverter';
import type { MapUiApi } from '@/src/types/mapUi';
import type { LatLng } from '@/types/coordinates';
import { buildGpx, buildKml, downloadTextFileWeb } from '@/src/utils/routeExport';
import { WEB_MAP_BASE_LAYERS } from '@/src/config/mapWebLayers';
import { createLeafletLayer } from '@/src/utils/mapWebLayers';
import type { OsmPoiCategory } from '@/src/utils/overpass';

interface Point {
  id?: number;
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
}: UseMapApiProps) {
  const pendingOverlayTogglesRef = useRef<Map<string, boolean>>(new Map());
  const pendingOverlayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingOverlayAttemptsRef = useRef(0);

  const canExportRoute = useMemo(() => routePoints.length >= 2, [routePoints.length]);

  const centerOnUserLocation = useCallback(() => {
    if (!map || !userLocation) return;
    try {
      map.setView(CoordinateConverter.toLeaflet(userLocation), 13, { animate: true });
    } catch {
      // noop
    }
  }, [map, userLocation]);

  const handleDownloadGpx = useCallback(() => {
    if (routePoints.length < 2) return;
    const result = buildGpx({
      track: routePoints,
      name: `Route ${new Date().toISOString().split('T')[0]}`,
    });
    downloadTextFileWeb(result);
  }, [routePoints]);

  const handleDownloadKml = useCallback(() => {
    if (routePoints.length < 2) return;
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
            pendingOverlayAttemptsRef.current = 0;

            for (const [id, enabled] of toApply) {
              try {
                const layer = available.get(id);
                if (!layer) continue;
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
          const key = String(coord ?? '').trim();
          if (!key) return;

          const markerIndex: Map<string, any> | undefined = (leafletControlRef as any).markerByCoord;
          const marker = markerIndex?.get?.(key);
          if (!marker) return;

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

          setTimeout(() => {
            if (didOpen) return;
            didOpen = true;
            try {
              marker.openPopup?.();
            } catch {
              // noop
            }
          }, 420);

          // Reset zIndex after a short delay so it doesn't permanently stay on top
          setTimeout(() => {
            try {
              marker.setZIndexOffset?.(0);
            } catch {
              // noop
            }
          }, 1400);
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
          console.info('[useMapApi] setOverlayEnabled called:', id, enabled);
          const layer = leafletOverlayLayersRef.current.get(id);
          if (!layer) {
            if (leafletOverlayLayersRef.current.size === 0) {
              pendingOverlayTogglesRef.current.set(id, enabled);
              schedulePendingOverlayFlush();
              return;
            }

            console.warn('[useMapApi] Layer not found:', id, 'Available layers:', Array.from(leafletOverlayLayersRef.current.keys()));
            return;
          }

          console.info('[useMapApi] Layer found, toggling:', id, enabled);
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
            console.info('[useMapApi] Controller found for layer:', id);
            if (enabled) controller.start?.();
            else controller.stop?.();
          }
        } catch {
          // noop
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

  // Store api in ref to avoid triggering effects on every render
  const apiRef = useRef<MapUiApi | null>(null);
  apiRef.current = api;

  // Track if api is ready (map and L are available)
  const isApiReady = Boolean(map && L);
  const wasApiReadyRef = useRef(false);

  useEffect(() => {
    if (!onMapUiApiReady) return;

    // Only call onMapUiApiReady when readiness changes
    if (isApiReady && !wasApiReadyRef.current) {
      wasApiReadyRef.current = true;
      onMapUiApiReady(apiRef.current);
    } else if (!isApiReady && wasApiReadyRef.current) {
      wasApiReadyRef.current = false;
      onMapUiApiReady(null);
    }
  }, [isApiReady, onMapUiApiReady]);

  useEffect(() => {
    if (!onMapUiApiReady) return;
    return () => {
      onMapUiApiReady(null);
    };
  }, [onMapUiApiReady]);
}
