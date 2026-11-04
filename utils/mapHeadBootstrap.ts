import {
  OSM_LOCAL_WEB_HOSTNAMES,
  OSM_PRIVATE_WEB_HOST_PATTERNS,
  resolveOsmTileRequest,
} from '@/config/mapWebTileContract'
import {
  DEFAULT_MAP_CENTER, DEFAULT_RADIUS_KM, MAP_COLLAPSED_SHEET_OFFSET, MAP_COMPACT_MIN_FIT_ZOOM,
  MAP_COMPACT_PANE_MAX_WIDTH, MAP_RADIUS_FIT_AIR, MAP_TRAVELS_PER_PAGE,
} from '@/constants/mapDefaults'
import { buildMapRadiusQuery, MAP_RADIUS_QUERY_PATH, roundMapRadiusAnchorCoordinate } from '@/utils/mapRadiusQuery'
import { MAP_RADIUS_PRELOAD_GLOBAL, MAP_RADIUS_PRELOAD_TTL_MS } from '@/utils/mapRadiusPreload'
import { MAP_FILTERS_STORAGE_KEY, MAP_LOCATION_STORAGE_KEY, MAP_ROUTE_STORAGE_KEY } from '@/utils/mapStartupStorage'
import { MAP_PRECISE_WEB_LOCATION_OPTIONS, MAP_STARTUP_LOCATION_KEY } from '@/utils/mapStartupLocation'
import { safeJsonString } from '@/utils/htmlUtils'
import { isLikelySelfProxyApiUrl, resolveApiBaseUrl } from '@/utils/resolveApiBaseUrl'

export const MAP_ROUTE_PATH = '/map'
export const MAP_TILE_PRECONNECT_ID = 'metravel-tile-preconnect'

const LEAFLET_CSS_ID = 'metravel-leaflet-css'
const MARKERCLUSTER_CSS_ID = 'metravel-markercluster-css'
const LOCATION_PERMISSION_PROBE_MS = 250

type TilePreconnectParams = {
  hostname?: string | null
  envApiUrl?: string | null
}

/**
 * Resolve only an external tile-proxy origin that can be safely preconnected.
 * A concrete tile URL requires a confirmed viewport. Every initiated OSM
 * request is part of the strict startup cardinality contract (#1291).
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

// The clean compact fallback starts at the circle centre at the compact zoom
// floor, shifted by half the collapsed padding. Leaflet adopts that fit.
function compactStartupTile() {
  const tileSize = 256
  const zoom = MAP_COMPACT_MIN_FIT_ZOOM
  const scale = 2 ** zoom
  const latitude = DEFAULT_MAP_CENTER.latitude * Math.PI / 180
  const worldX = (DEFAULT_MAP_CENTER.longitude + 180) / 360 * scale
  const worldY = (1 - Math.asinh(Math.tan(latitude)) / Math.PI) / 2 * scale +
    (MAP_COLLAPSED_SHEET_OFFSET + MAP_RADIUS_FIT_AIR) / (2 * tileSize)
  const x = Math.floor(worldX)
  const y = Math.floor(worldY)
  const { url, crossOrigin } = resolveOsmTileRequest()
  return {
    href: url.replace('{z}', String(zoom)).replace('{x}', String(x)).replace('{y}', String(y)),
    crossOrigin,
    offsetX: `${(x - worldX) * tileSize}px`,
    offsetY: `${(y - worldY) * tileSize}px`,
  }
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
    function hasStoredState() {
      return storedStateKeys.some(function(key) { return window.localStorage.getItem(key) !== null; });
    }
    if (hasStoredState()) return;
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

    var compact = window.matchMedia && window.matchMedia(
      '(max-width: ${MAP_COMPACT_PANE_MAX_WIDTH}px) and (orientation: portrait)'
    );
    if (isLocal || !compact || !compact.matches || !window.navigator.permissions) return;
    function isCleanCompactMap() {
      return /^\/map\/?$/.test(window.location.pathname) && !window.location.search &&
        compact.matches && !hasStoredState();
    }
    var locationPermission = new Promise(function(resolve) {
      var deadline = setTimeout(function() { resolve(null); }, ${LOCATION_PERMISSION_PROBE_MS});
      function settle(permission) {
        clearTimeout(deadline);
        resolve(permission);
      }
      Promise.resolve().then(function() {
        return window.navigator.permissions.query({ name: 'geolocation' });
      }).then(settle, function() { settle(null); });
    });
    var locationResult = locationPermission.then(function(permission) {
      if (!permission || permission.state !== 'prompt' || !window.navigator.geolocation ||
          !isCleanCompactMap()) return null;
      return new Promise(function(resolve) {
        window.navigator.geolocation.getCurrentPosition(
          function(position) { resolve({ position: position }); },
          function(error) { resolve({ error: error }); },
          ${JSON.stringify(MAP_PRECISE_WEB_LOCATION_OPTIONS)}
        );
      });
    }).catch(function() { return null; });
    var locationKey = ${JSON.stringify(MAP_STARTUP_LOCATION_KEY)};
    var locationEntry = { result: locationResult };
    window[locationKey] = locationEntry;
    locationResult.then(function() {
      if (window[locationKey] !== locationEntry) return;
      setTimeout(function() {
        if (window[locationKey] === locationEntry) delete window[locationKey];
      }, ${MAP_RADIUS_PRELOAD_TTL_MS});
    });

    Promise.all([locationPermission, locationResult]).then(function(values) {
      var permission = values[0];
      var location = values[1];
      if (!permission || !isCleanCompactMap() || permission.state === 'granted' ||
          (permission.state !== 'denied' && !(location && location.error && location.error.code === 1))) return;
      var shellTileSelector = '#ssg-skeleton img[data-ssg-map-tile]';
      var request = ${JSON.stringify(compactStartupTile())};
      function paintConfirmedTile(tile) {
        if (!isCleanCompactMap() || permission.state === 'granted' || tile.hasAttribute('src') ||
            document.querySelector('#root .leaflet-tile')) return;
        tile.parentElement.style.setProperty('--metravel-map-shell-tile-offset-x', request.offsetX);
        tile.parentElement.style.setProperty('--metravel-map-shell-tile-offset-y', request.offsetY);
        tile.setAttribute('fetchpriority', 'high');
        if (request.crossOrigin) tile.crossOrigin = request.crossOrigin;
        tile.setAttribute('data-ssg-map-startup-circle', 'true');
        tile.src = request.href;
      }
      var tile = document.querySelector(shellTileSelector);
      if (tile) return paintConfirmedTile(tile);
      if (document.readyState !== 'loading' || !window.MutationObserver) return;

      // Permission may resolve before the shell arrives in the HTML stream.
      // Discover the image now, then paint it as soon as the parser adds it.
      var preload = document.createElement('link');
      preload.rel = 'preload';
      preload.setAttribute('as', 'image');
      preload.setAttribute('fetchpriority', 'high');
      if (request.crossOrigin) preload.crossOrigin = request.crossOrigin;
      preload.href = request.href;
      document.head.appendChild(preload);
      function paintParsedTile() {
        var parsedTile = document.querySelector(shellTileSelector);
        if (!parsedTile) return;
        observer.disconnect();
        paintConfirmedTile(parsedTile);
      }
      var observer = new MutationObserver(paintParsedTile);
      observer.observe(document.documentElement, { childList: true, subtree: true });
      document.addEventListener('DOMContentLoaded', function() {
        observer.disconnect();
        paintParsedTile();
      }, { once: true });
    }).catch(function(){});
  } catch (_e) {}
})();
`;
}
