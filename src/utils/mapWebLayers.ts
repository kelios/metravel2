import type { WebMapLayerDefinition } from '@/src/config/mapWebLayers';
import { clampOpacity } from '@/src/utils/routeExport/normalize';

export const createLeafletLayer = (L: any, def: WebMapLayerDefinition) => {
  if (!L) return null;

  if (
    def.kind === 'osm-overpass-camping' ||
    def.kind === 'osm-overpass-poi' ||
    def.kind === 'osm-overpass-routes'
  ) {
    // Этот слой создаётся/управляется отдельно через attachOsmCampingOverlay,
    // потому что ему нужен доступ к map events и async загрузка.
    return null;
  }

  if (def.kind === 'wfs-geojson') {
    return null;
  }

  if (def.kind === 'tile') {
    const isWaymarked = typeof def.id === 'string' && def.id.startsWith('waymarked-');
    const layer = L.tileLayer(def.url, {
      attribution: def.attribution,
      minZoom: def.minZoom,
      maxZoom: def.maxZoom,
      opacity: clampOpacity(def.opacity),
      ...(isWaymarked
        ? {
            updateWhenZooming: false,
            keepBuffer: 2,
          }
        : null),
    });
    if (def.zIndex != null && typeof layer.setZIndex === 'function') layer.setZIndex(def.zIndex);
    return layer;
  }

  if (def.kind === 'wms') {
    if (!def.url) return null;
    const layer = L.tileLayer.wms(def.url, {
      layers: def.wmsParams?.layers,
      format: def.wmsParams?.format ?? 'image/png',
      transparent: def.wmsParams?.transparent ?? true,
      version: def.wmsParams?.version ?? '1.3.0',
      styles: def.wmsParams?.styles,
      opacity: clampOpacity(def.opacity),
      attribution: def.attribution,
    });
    if (def.zIndex != null && typeof layer.setZIndex === 'function') layer.setZIndex(def.zIndex);
    return layer;
  }

  return null;
};
