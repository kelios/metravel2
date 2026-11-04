import {
  OSM_LOCAL_WEB_HOSTNAMES,
  OSM_PRIVATE_WEB_HOST_PATTERNS,
  resolveOsmTileRequest,
} from '@/config/mapWebTileContract'
import { DEFAULT_MAP_CENTER, DEFAULT_RADIUS_KM, MAP_TRAVELS_PER_PAGE } from '@/constants/mapDefaults'
import { buildMapRadiusQuery, MAP_RADIUS_QUERY_PATH, roundMapRadiusAnchorCoordinate } from '@/utils/mapRadiusQuery'
import { MAP_RADIUS_PRELOAD_GLOBAL, MAP_RADIUS_PRELOAD_TTL_MS } from '@/utils/mapRadiusPreload'
import { MAP_FILTERS_STORAGE_KEY, MAP_LOCATION_STORAGE_KEY, MAP_ROUTE_STORAGE_KEY } from '@/utils/mapStartupStorage'
import { safeJsonString } from '@/utils/htmlUtils'
import { isLikelySelfProxyApiUrl, resolveApiBaseUrl } from '@/utils/resolveApiBaseUrl'

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

type MapBootstrapApiOptions = {
  prodApiUrl?: string
  nodeEnv?: string
  isE2E?: boolean
  isLocalApi?: boolean
}

export function buildMapHeadBootstrapScript(
  envApiUrl = process.env.EXPO_PUBLIC_API_URL,
  {
    prodApiUrl = process.env.PROD_API_URL,
    nodeEnv = process.env.NODE_ENV,
    isE2E = String(process.env.EXPO_PUBLIC_E2E || '').toLowerCase() === 'true',
    isLocalApi = String(process.env.EXPO_PUBLIC_IS_LOCAL_API || '').toLowerCase() === 'true',
  }: MapBootstrapApiOptions = {},
): string {
  const localTileOrigin = resolveMapTilePreconnectOrigin({
    hostname: 'localhost',
    envApiUrl: envApiUrl || null,
  })

  // Match the web transport when it uses the page origin. Self-proxy dev URLs
  // have hostname-dependent fallback behavior and stay on the normal request.
  const usePageOrigin = nodeEnv !== 'test' && (isE2E || isLocalApi)
  const apiBase = !usePageOrigin && !isLikelySelfProxyApiUrl(envApiUrl)
    ? resolveApiBaseUrl({ platformOS: 'web', envApiUrl, prodApiUrl, nodeEnv, isE2E, isLocalApi })
    : ''
  const query = buildMapRadiusQuery(0, MAP_TRAVELS_PER_PAGE, {
    lat: roundMapRadiusAnchorCoordinate(DEFAULT_MAP_CENTER.latitude),
    lng: roundMapRadiusAnchorCoordinate(DEFAULT_MAP_CENTER.longitude),
    radius: DEFAULT_RADIUS_KM,
  })
  const preloadPath = `${MAP_RADIUS_QUERY_PATH}?${query}`
  const preloadEndpoint = usePageOrigin ? `/api${preloadPath}` : apiBase && `${apiBase}${preloadPath}`
  const storedStateKeys = [MAP_FILTERS_STORAGE_KEY, MAP_LOCATION_STORAGE_KEY, MAP_ROUTE_STORAGE_KEY, 'userId']

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
      link.setAttribute('data-css-state', 'loading');
      link.onload = function() { link.setAttribute('data-css-state', 'loaded'); };
      link.onerror = function() {
        if (link.getAttribute('data-css-fallback')) {
          link.setAttribute('data-css-state', 'failed');
          return;
        }
        link.setAttribute('data-css-fallback', 'cdn');
        link.setAttribute('data-css-state', 'loading');
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

    var endpoint = ${safeJsonString(preloadEndpoint)};
    var preloadKey = ${JSON.stringify(MAP_RADIUS_PRELOAD_GLOBAL)};
    if (!endpoint || window[preloadKey] || window.location.search || window.navigator.onLine === false ||
        !window.AbortController || !window.Storage || !(window.localStorage instanceof window.Storage)) return;
    var storedStateKeys = ${JSON.stringify(storedStateKeys)};
    for (var i = 0; i < storedStateKeys.length; i++) {
      if (window.localStorage.getItem(storedStateKeys[i]) !== null) return;
    }
    var absoluteEndpoint = endpoint.charAt(0) === '/' ? pageOrigin + endpoint : endpoint;
    var requestUrl = new URL(absoluteEndpoint);
    if (requestUrl.origin !== pageOrigin || requestUrl.href !== absoluteEndpoint ||
        requestUrl.username || requestUrl.password) return;

    // The map's public GET uses the cookie session for blocked-author filtering.
    // Only the normal query can claim and settle this response before fitting.
    var controller = new AbortController();
    var response = fetch(requestUrl.href, { method: 'GET', credentials: 'include', redirect: 'error', signal: controller.signal });
    response.catch(function(){});
    var entry = { url: requestUrl.href, startedAt: Date.now(), response: response, controller: controller };
    entry.deadline = setTimeout(function(){
      if (window[preloadKey] === entry) delete window[preloadKey];
      controller.abort();
    }, ${MAP_RADIUS_PRELOAD_TTL_MS});
    window[preloadKey] = entry;
  } catch (_e) {}
})();
`;
}
