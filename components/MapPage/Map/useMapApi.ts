// useMapApi.ts - Hook for exposing map API to parent components
import { useEffect, useCallback } from 'react';
import { CoordinateConverter } from '@/utils/coordinateConverter';
import type { MapUiApi } from '@/src/types/mapUi';
import type { LatLng } from '@/types/coordinates';
import { buildGpx, buildKml, downloadTextFileWeb } from '@/src/utils/routeExport';
import { WEB_MAP_BASE_LAYERS } from '@/src/config/mapWebLayers';
import { createLeafletLayer } from '@/src/utils/mapWebLayers';

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
    const gpxContent = buildGpx(routePoints);
    const fileName = `route_${new Date().toISOString().split('T')[0]}.gpx`;
    downloadTextFileWeb(gpxContent, fileName);
  }, [routePoints]);

  const handleDownloadKml = useCallback(() => {
    if (routePoints.length < 2) return;
    const kmlContent = buildKml(routePoints);
    const fileName = `route_${new Date().toISOString().split('T')[0]}.kml`;
    downloadTextFileWeb(kmlContent, fileName);
  }, [routePoints]);

  useEffect(() => {
    if (!map || !L || !onMapUiApiReady) return;

    const api: MapUiApi = {
      centerOnUserLocation,
      fitAllTravelPoints: () => {
        if (!travelData?.length) return;
        try {
          const coords = travelData
            .map((p) => CoordinateConverter.fromLooseString(p.coord))
            .filter(Boolean) as LatLng[];
          if (coords.length === 0) return;

          const bounds = (L as any).latLngBounds(
            coords.map((c) => CoordinateConverter.toLeaflet(c))
          );
          map.fitBounds(bounds.pad(0.2), { animate: false });
        } catch {
          // noop
        }
      },
      fitRoutePoints: (coords: [number, number][]) => {
        if (!coords?.length) return;
        try {
          const bounds = (L as any).latLngBounds(
            coords.map(([lng, lat]) => (L as any).latLng(lat, lng))
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
          const layer = leafletOverlayLayersRef.current.get(id);
          if (!layer) return;

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
        } catch {
          // noop
        }
      },
    };

    onMapUiApiReady(api);
    return () => {
      onMapUiApiReady(null);
    };
  }, [
    L,
    map,
    onMapUiApiReady,
    centerOnUserLocation,
    handleDownloadGpx,
    handleDownloadKml,
    travelData,
    userLocation,
    leafletBaseLayerRef,
    leafletOverlayLayersRef,
    leafletControlRef,
  ]);
}

