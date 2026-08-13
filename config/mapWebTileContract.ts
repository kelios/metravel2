/**
 * Pure web OSM tile contract shared by the runtime map and the pre-hydration
 * HTML bootstrap. Keep this module free of UI/i18n/layer-registry imports so
 * `app/+html.tsx` does not pull the full map configuration into its boundary.
 */
export const OSM_PROXY_TILE_PATH = '/proxy/tiles/osm/{z}/{x}/{y}.png';
export const OSM_ATTRIBUTION_URL = 'https://www.openstreetmap.org/copyright';
export const OSM_PROXY_ATTRIBUTION =
  `&copy; <a href="${OSM_ATTRIBUTION_URL}" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors`;
export const OSM_PROXY_MAX_ZOOM = 19;
export const OSM_PROXY_PUBLIC_ORIGIN = 'https://metravel.by';

export const OSM_LOCAL_WEB_HOSTNAMES = [
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
] as const;
export const OSM_PRIVATE_WEB_HOST_PATTERNS = [
  '^10\\.',
  '^192\\.168\\.',
  '^172\\.(1[6-9]|2\\d|3[01])\\.',
] as const;

export type OsmTileRequestContext = {
  hostname?: string | null;
  pageOrigin?: string | null;
  envApiUrl?: string | null;
};

export type OsmTileRequest = {
  url: string;
  crossOrigin?: 'anonymous';
};

const OSM_LOCAL_WEB_HOSTS = new Set<string>(OSM_LOCAL_WEB_HOSTNAMES);
const OSM_PRIVATE_WEB_HOST_REGEXPS = OSM_PRIVATE_WEB_HOST_PATTERNS.map(
  (pattern) => new RegExp(pattern),
);

const isPrivateTileProxyHost = (hostname: string): boolean => {
  const host = hostname.toLowerCase();
  if (OSM_LOCAL_WEB_HOSTS.has(host)) return true;
  return OSM_PRIVATE_WEB_HOST_REGEXPS.some((pattern) => pattern.test(host));
};

const getOsmProxyOrigin = (envApiUrl?: string | null): string | null => {
  try {
    const raw = String(
      envApiUrl === undefined ? process.env.EXPO_PUBLIC_API_URL || '' : envApiUrl || '',
    ).trim();
    if (!raw) return null;
    const base = raw.replace(/\/api\/?$/i, '');
    const parsed = new URL(base);
    if (isPrivateTileProxyHost(parsed.hostname)) return null;
    return parsed.origin || null;
  } catch {
    return null;
  }
};

/**
 * Resolves both the effective tile URL and its fetch mode. The preload, SSG
 * tile and Leaflet runtime must all use this result so one URL is requested in
 * one mode instead of creating separate browser cache entries.
 */
export const resolveOsmTileRequest = ({
  hostname,
  pageOrigin,
  envApiUrl,
}: OsmTileRequestContext = {}): OsmTileRequest => {
  const host = String(hostname || '').trim().toLowerCase();
  const needsPublicProxy = isPrivateTileProxyHost(host);
  const url = needsPublicProxy
    ? `${getOsmProxyOrigin(envApiUrl) || OSM_PROXY_PUBLIC_ORIGIN}${OSM_PROXY_TILE_PATH}`
    : OSM_PROXY_TILE_PATH;

  if (!/^https?:\/\//i.test(url)) {
    return { url, crossOrigin: 'anonymous' };
  }

  try {
    if (pageOrigin && new URL(url).origin === new URL(pageOrigin).origin) {
      return { url, crossOrigin: 'anonymous' };
    }
  } catch {
    // Invalid page origin: keep the cross-origin request in no-CORS mode.
  }

  return { url };
};

export const getOsmTileUrl = (): string =>
  resolveOsmTileRequest({
    hostname: typeof window !== 'undefined' ? window.location?.hostname : null,
    pageOrigin: typeof window !== 'undefined' ? window.location?.origin : null,
  }).url;

export const getOsmTileCrossOrigin = (): 'anonymous' | undefined =>
  resolveOsmTileRequest({
    hostname: typeof window !== 'undefined' ? window.location?.hostname : null,
    pageOrigin: typeof window !== 'undefined' ? window.location?.origin : null,
  }).crossOrigin;
