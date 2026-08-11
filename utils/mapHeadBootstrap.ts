import {
  OSM_LOCAL_WEB_HOSTNAMES,
  OSM_PRIVATE_WEB_HOST_PATTERNS,
  resolveOsmTileRequest,
} from '@/config/mapWebTileContract'

export const MAP_ROUTE_PATH = '/map'
export const MAP_TILE_PRECONNECT_ID = 'metravel-tile-preconnect'

const LEAFLET_CSS_ID = 'metravel-leaflet-css'
const MARKERCLUSTER_CSS_ID = 'metravel-markercluster-css'

type TilePreconnectParams = {
  hostname?: string | null
  envApiUrl?: string | null
}

/**
 * Resolve only an external tile-proxy origin that can be safely preconnected.
 * A concrete tile URL must not be guessed before the map's settled initial fit:
 * its zoom/coordinates may differ from the final viewport and every initiated
 * OSM request is part of the strict startup cardinality contract (#1291).
 */
export function resolveMapTilePreconnectOrigin({
  hostname,
  envApiUrl,
}: TilePreconnectParams): string | null {
  const { url } = resolveOsmTileRequest({ hostname, envApiUrl })
  if (!/^https?:\/\//i.test(url)) return null
  try {
    return new URL(url).origin
  } catch {
    return null
  }
}

export function buildMapHeadBootstrapScript(envApiUrl = process.env.EXPO_PUBLIC_API_URL): string {
  const localTileOrigin = resolveMapTilePreconnectOrigin({
    hostname: 'localhost',
    envApiUrl: envApiUrl || null,
  })

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

    var host = String(window.location && window.location.hostname || '').toLowerCase();
    var isLocal = ${JSON.stringify(OSM_LOCAL_WEB_HOSTNAMES)}.indexOf(host) !== -1 ||
      ${JSON.stringify(OSM_PRIVATE_WEB_HOST_PATTERNS)}.some(function(pattern) {
        return new RegExp(pattern).test(host);
      });
    var pageOrigin = String(window.location && window.location.origin || '');
    var tileOrigin = isLocal ? ${JSON.stringify(localTileOrigin)} : '';

    if (tileOrigin && tileOrigin !== pageOrigin && !document.getElementById(${JSON.stringify(MAP_TILE_PRECONNECT_ID)})) {
      var preconnect = document.createElement('link');
      preconnect.id = ${JSON.stringify(MAP_TILE_PRECONNECT_ID)};
      preconnect.rel = 'preconnect';
      preconnect.href = tileOrigin;
      preconnect.crossOrigin = 'anonymous';
      document.head.appendChild(preconnect);
    }

    addSheet(${JSON.stringify(LEAFLET_CSS_ID)}, '/vendor/leaflet.css', 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css');
    addSheet(${JSON.stringify(MARKERCLUSTER_CSS_ID)}, '/vendor/MarkerCluster.css', 'https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css');
  } catch (_e) {}
})();
`;
}
