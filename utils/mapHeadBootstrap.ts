import { DEFAULT_ZOOM } from '@/components/MapPage/Map/constants'
import { DEFAULT_MAP_CENTER } from '@/constants/mapConfig'

export const MAP_ROUTE_PATH = '/map'
export const MAP_TILE_PROXY_PATH = '/proxy/tiles/osm/{z}/{x}/{y}.png'
export const MAP_TILE_PRECONNECT_ID = 'metravel-tile-preconnect'
export const MAP_TILE_PRELOAD_ID = 'metravel-map-tile-preload'
export const MAP_TILE_PUBLIC_FALLBACK_ORIGIN = 'https://metravel.by'

const LEAFLET_CSS_ID = 'metravel-leaflet-css'
const MARKERCLUSTER_CSS_ID = 'metravel-markercluster-css'

type WarmupTileParams = {
  lat?: number
  lng?: number
  zoom?: number
  hostname?: string | null
  envApiUrl?: string | null
}

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1'])

function normalizeHost(value: string | null | undefined): string {
  return String(value || '').trim().toLowerCase()
}

function isLocalHost(hostname: string | null | undefined): boolean {
  return LOCAL_HOSTS.has(normalizeHost(hostname))
}

function isPrivateHost(hostname: string | null | undefined): boolean {
  const host = normalizeHost(hostname)
  if (!host) return false
  if (isLocalHost(host)) return true
  if (/^10\./.test(host)) return true
  if (/^192\.168\./.test(host)) return true
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(host)) return true
  return false
}

function resolvePublicApiOrigin(envApiUrl?: string | null): string | null {
  const raw = String(envApiUrl || '').trim()
  if (!raw) return null

  try {
    const base = raw.replace(/\/api\/?$/i, '')
    const parsed = new URL(base)
    if (isPrivateHost(parsed.hostname)) return null
    return parsed.origin || null
  } catch {
    return null
  }
}

export function latLngToSlippyTileXY(
  lat: number,
  lng: number,
  zoom: number,
): { x: number; y: number } {
  const clampedLat = Math.max(-85.05112878, Math.min(85.05112878, Number(lat)))
  const normalizedLng = ((Number(lng) + 180) % 360 + 360) % 360 - 180
  const safeZoom = Math.max(0, Math.floor(Number.isFinite(zoom) ? zoom : DEFAULT_ZOOM))
  const latRad = (clampedLat * Math.PI) / 180
  const scale = 2 ** safeZoom
  const x = Math.floor(((normalizedLng + 180) / 360) * scale)
  const y = Math.floor(
    ((1 - Math.asinh(Math.tan(latRad)) / Math.PI) / 2) * scale,
  )

  return {
    x: Math.max(0, Math.min(scale - 1, x)),
    y: Math.max(0, Math.min(scale - 1, y)),
  }
}

export function resolveMapTileWarmupOrigin({
  hostname,
  envApiUrl,
}: Pick<WarmupTileParams, 'hostname' | 'envApiUrl'>): string | null {
  if (!isLocalHost(hostname)) return null
  return resolvePublicApiOrigin(envApiUrl) || MAP_TILE_PUBLIC_FALLBACK_ORIGIN
}

export function buildMapWarmupTileHref({
  lat = DEFAULT_MAP_CENTER.latitude,
  lng = DEFAULT_MAP_CENTER.longitude,
  zoom = DEFAULT_ZOOM,
  hostname,
  envApiUrl,
}: WarmupTileParams = {}): string {
  const { x, y } = latLngToSlippyTileXY(lat, lng, zoom)
  const origin = resolveMapTileWarmupOrigin({ hostname, envApiUrl })
  const prefix = origin ? origin.replace(/\/+$/, '') : ''

  return `${prefix}${MAP_TILE_PROXY_PATH}`
    .replace('{z}', String(Math.max(0, Math.floor(zoom))))
    .replace('{x}', String(x))
    .replace('{y}', String(y))
}

export function buildMapTileWarmupRequest(
  params: WarmupTileParams = {},
): { href: string; crossOrigin?: 'anonymous' } {
  const origin = resolveMapTileWarmupOrigin(params)
  return {
    href: buildMapWarmupTileHref(params),
    crossOrigin: origin ? undefined : 'anonymous',
  }
}

export function buildMapHeadBootstrapScript(envApiUrl = process.env.EXPO_PUBLIC_API_URL): string {
  const warmupTilePath = buildMapWarmupTileHref({
    hostname: 'metravel.by',
    envApiUrl: null,
  })
  const localWarmupOrigin =
    resolveMapTileWarmupOrigin({
      hostname: 'localhost',
      envApiUrl: envApiUrl || null,
    }) || MAP_TILE_PUBLIC_FALLBACK_ORIGIN

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
    var isLocal = host === 'localhost' || host === '127.0.0.1' || host === '::1';
    var origin = isLocal ? ${JSON.stringify(localWarmupOrigin)} : '';
    var pageOrigin = String(window.location && window.location.origin || '');
    var href = origin + ${JSON.stringify(warmupTilePath)};
    var shouldUseAnonymous = !origin || origin === pageOrigin;

    if (origin && origin !== pageOrigin && !document.getElementById(${JSON.stringify(MAP_TILE_PRECONNECT_ID)})) {
      var preconnect = document.createElement('link');
      preconnect.id = ${JSON.stringify(MAP_TILE_PRECONNECT_ID)};
      preconnect.rel = 'preconnect';
      preconnect.href = origin;
      preconnect.crossOrigin = 'anonymous';
      document.head.appendChild(preconnect);
    }

    if (window.__metravelMapTileWarmupHref === href) return;
    window.__metravelMapTileWarmupHref = href;

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
      if (shouldUseAnonymous) {
        preload.crossOrigin = 'anonymous';
      }
      document.head.appendChild(preload);
    }
  } catch (_e) {}
})();
`;
}
