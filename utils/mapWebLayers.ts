import type { WebMapLayerDefinition } from '@/config/mapWebLayers';
import { clampOpacity } from '@/utils/routeExport/normalize';

interface TileRetryOptions {
  /** Максимум повторов на тайл (по умолчанию 3). */
  maxRetries?: number;
  /** Базовая задержка в мс; реальная = baseDelay * attempt (по умолчанию 500). */
  baseDelay?: number;
}

/**
 * Авто-retry упавших тайлов Leaflet. Прокси/upstream OSM под burst'ом
 * (холодный прыжок на дальний регион) изредка роняет часть тайлов — немедленный
 * повтор того же URL отдаёт 200. Leaflet сам не повторяет, поэтому подписываемся
 * на 'tileerror' и перезапрашиваем тайл с cache-buster'ом, форсируя свежий запрос.
 * Web-only по факту использования (createLeafletLayer / useMapInstance — web-пути).
 */
export const attachTileRetry = (layer: any, opts?: TileRetryOptions) => {
  if (!layer || typeof layer.on !== 'function') return layer;

  const maxRetries = opts?.maxRetries ?? 3;
  const baseDelay = opts?.baseDelay ?? 500;

  layer.on('tileerror', (event: any) => {
    const tile: HTMLImageElement | undefined = event?.tile;
    if (!tile) return;

    const attempt = Number(tile.getAttribute('data-tile-retry') ?? '0') || 0;
    if (attempt >= maxRetries) return;

    const nextAttempt = attempt + 1;
    tile.setAttribute('data-tile-retry', String(nextAttempt));

    const baseUrl = (tile.src || '').replace(/([?&])_retry=\d+(&|$)/, (_m, p1: string, p2: string) =>
      p2 === '&' ? p1 : '',
    );
    const separator = baseUrl.includes('?') ? '&' : '?';
    const nextUrl = `${baseUrl}${separator}_retry=${nextAttempt}`;

    setTimeout(() => {
      tile.src = nextUrl;
    }, baseDelay * nextAttempt);
  });

  return layer;
};

export const createLeafletLayer = (L: any, def: WebMapLayerDefinition) => {
  if (!L) return null;

  if (def.kind === 'weather-temp-labels') {
    // Управляется отдельным контроллером attachWeatherTempLabelsOverlay
    // (нужен доступ к map bounds/events и async загрузка).
    return null;
  }

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
    return attachTileRetry(layer);
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
    return attachTileRetry(layer);
  }

  return null;
};
