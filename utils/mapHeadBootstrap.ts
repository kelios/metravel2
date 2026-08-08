import { DEFAULT_ZOOM } from '@/components/MapPage/Map/constants'
import {
  OSM_LOCAL_WEB_HOSTNAMES,
  OSM_PRIVATE_WEB_HOST_PATTERNS,
  OSM_PROXY_PUBLIC_ORIGIN,
  OSM_PROXY_TILE_PATH,
  resolveOsmTileRequest,
} from '@/config/mapWebTileContract'
import { DEFAULT_MAP_CENTER } from '@/constants/mapConfig'

export const MAP_ROUTE_PATH = '/map'
export const MAP_TILE_PROXY_PATH = OSM_PROXY_TILE_PATH
export const MAP_TILE_PRECONNECT_ID = 'metravel-tile-preconnect'
export const MAP_TILE_PRELOAD_ID = 'metravel-map-tile-preload'
export const MAP_TILE_PUBLIC_FALLBACK_ORIGIN = OSM_PROXY_PUBLIC_ORIGIN
export const MAP_TILE_SIZE_PX = 256

const LEAFLET_CSS_ID = 'metravel-leaflet-css'
const MARKERCLUSTER_CSS_ID = 'metravel-markercluster-css'

type WarmupTileParams = {
  lat?: number
  lng?: number
  zoom?: number
  hostname?: string | null
  envApiUrl?: string | null
}

export function latLngToSlippyTilePlacement(
  lat: number,
  lng: number,
  zoom: number,
): { x: number; y: number; offsetX: number; offsetY: number } {
  const clampedLat = Math.max(-85.05112878, Math.min(85.05112878, Number(lat)))
  const normalizedLng = ((Number(lng) + 180) % 360 + 360) % 360 - 180
  const safeZoom = Math.max(0, Math.floor(Number.isFinite(zoom) ? zoom : DEFAULT_ZOOM))
  const latRad = (clampedLat * Math.PI) / 180
  const scale = 2 ** safeZoom
  const worldX = ((normalizedLng + 180) / 360) * scale
  const worldY = ((1 - Math.asinh(Math.tan(latRad)) / Math.PI) / 2) * scale
  const x = Math.floor(worldX)
  const y = Math.floor(worldY)

  return {
    x: Math.max(0, Math.min(scale - 1, x)),
    y: Math.max(0, Math.min(scale - 1, y)),
    offsetX: Number((-(worldX - x) * MAP_TILE_SIZE_PX).toFixed(3)),
    offsetY: Number((-(worldY - y) * MAP_TILE_SIZE_PX).toFixed(3)),
  }
}

export function latLngToSlippyTileXY(
  lat: number,
  lng: number,
  zoom: number,
): { x: number; y: number } {
  const { x, y } = latLngToSlippyTilePlacement(lat, lng, zoom)
  return { x, y }
}

export function resolveMapTileWarmupOrigin({
  hostname,
  envApiUrl,
}: Pick<WarmupTileParams, 'hostname' | 'envApiUrl'>): string | null {
  const { url } = resolveOsmTileRequest({ hostname, envApiUrl })
  if (!/^https?:\/\//i.test(url)) return null
  try {
    return new URL(url).origin
  } catch {
    return null
  }
}

export function buildMapWarmupTileHref({
  lat = DEFAULT_MAP_CENTER.latitude,
  lng = DEFAULT_MAP_CENTER.longitude,
  zoom = DEFAULT_ZOOM,
  hostname,
  envApiUrl,
}: WarmupTileParams = {}): string {
  const { x, y } = latLngToSlippyTileXY(lat, lng, zoom)
  const { url } = resolveOsmTileRequest({ hostname, envApiUrl })

  return url
    .replace('{z}', String(Math.max(0, Math.floor(zoom))))
    .replace('{x}', String(x))
    .replace('{y}', String(y))
}

export function buildMapTileWarmupRequest(
  params: WarmupTileParams = {},
): { href: string; crossOrigin?: 'anonymous' } {
  const request = resolveOsmTileRequest({
    hostname: params.hostname,
    envApiUrl: params.envApiUrl,
  })
  return {
    href: buildMapWarmupTileHref(params),
    ...(request.crossOrigin ? { crossOrigin: request.crossOrigin } : {}),
  }
}

export function buildMapHeadBootstrapScript(envApiUrl = process.env.EXPO_PUBLIC_API_URL): string {
  const productionRequest = buildMapTileWarmupRequest({
    hostname: 'metravel.by',
    envApiUrl: envApiUrl || null,
  })
  const localRequest = buildMapTileWarmupRequest({
    hostname: 'localhost',
    envApiUrl: envApiUrl || null,
  })
  const placement = latLngToSlippyTilePlacement(
    DEFAULT_MAP_CENTER.latitude,
    DEFAULT_MAP_CENTER.longitude,
    DEFAULT_ZOOM,
  )

  return String.raw`
(function(){
  try {
    var path = String(window.location && window.location.pathname || '');
    if (path === '/map/') path = '/map';
    if (path !== ${JSON.stringify(MAP_ROUTE_PATH)}) return;
    function addSheet(id, href, fallbackHref) {
      if (document.getElementById(id)) return;
      var link = document.createElement('link');
      link.id = id;
      link.rel = 'stylesheet';
      link.href = href;
      if (id === ${JSON.stringify(LEAFLET_CSS_ID)}) {
        link.setAttribute('data-metravel-leaflet-css', 'preloaded');
      }
      link.onerror = function() {
        if (link.getAttribute('data-css-fallback')) return;
        link.setAttribute('data-css-fallback', 'cdn');
        link.href = fallbackHref;
      };
      document.head.appendChild(link);
    }
    addSheet(${JSON.stringify(LEAFLET_CSS_ID)}, '/vendor/leaflet.css', 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css');
    addSheet(${JSON.stringify(MARKERCLUSTER_CSS_ID)}, '/vendor/MarkerCluster.css', 'https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css');

    var host = String(window.location && window.location.hostname || '').toLowerCase();
    var isLocal = ${JSON.stringify(OSM_LOCAL_WEB_HOSTNAMES)}.indexOf(host) !== -1 ||
      ${JSON.stringify(OSM_PRIVATE_WEB_HOST_PATTERNS)}.some(function(pattern) {
        return new RegExp(pattern).test(host);
      });
    var request = isLocal ? ${JSON.stringify(localRequest)} : ${JSON.stringify(productionRequest)};
    var pageOrigin = String(window.location && window.location.origin || '');
    var href = request.href;
    var tileOrigin = '';
    try { tileOrigin = new URL(href, pageOrigin || undefined).origin; } catch (_urlError) {}

    if (tileOrigin && tileOrigin !== pageOrigin && !document.getElementById(${JSON.stringify(MAP_TILE_PRECONNECT_ID)})) {
      var preconnect = document.createElement('link');
      preconnect.id = ${JSON.stringify(MAP_TILE_PRECONNECT_ID)};
      preconnect.rel = 'preconnect';
      preconnect.href = tileOrigin;
      preconnect.crossOrigin = 'anonymous';
      document.head.appendChild(preconnect);
    }

    window.__metravelMapTileWarmupHref = href;

    window.__metravelMountMapShellTile = function() {
      var tile = document.querySelector('img[data-ssg-map-tile="true"]');
      if (!tile) return;
      var existingHref = tile.getAttribute('src');
      if (existingHref && existingHref !== href) return;
      tile.width = ${MAP_TILE_SIZE_PX};
      tile.height = ${MAP_TILE_SIZE_PX};
      tile.style.left = '50%';
      tile.style.top = '50%';
      tile.style.transform = 'translate(${placement.offsetX}px, ${placement.offsetY}px)';
      try {
        tile.fetchPriority = 'high';
        tile.setAttribute('fetchPriority', 'high');
      } catch (_priorityError) {}
      if (request.crossOrigin) tile.crossOrigin = request.crossOrigin;
      else tile.removeAttribute('crossorigin');
      if (!existingHref) tile.src = href;
    };

    if (!document.getElementById(${JSON.stringify(MAP_TILE_PRELOAD_ID)})) {
      var preload = document.createElement('link');
      preload.id = ${JSON.stringify(MAP_TILE_PRELOAD_ID)};
      preload.rel = 'preload';
      preload.as = 'image';
      preload.href = href;
      preload.setAttribute('data-metravel-map-tile-preload', 'true');
      try {
        preload.fetchPriority = 'high';
        preload.setAttribute('fetchPriority', 'high');
      } catch (_e) {}
      if (request.crossOrigin) preload.crossOrigin = request.crossOrigin;
      document.head.appendChild(preload);
    }
    window.__metravelMountMapShellTile();
  } catch (_e) {}
})();
`;
}
