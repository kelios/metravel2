const BASE = 'https://router.project-osrm.org';

export type OsrmProfile = 'driving' | 'walking' | 'cycling';

export interface OsrmRouteParams {
  coords: Array<[number, number]>; // [lng, lat]
  profile?: OsrmProfile;
  overview?: 'full' | 'simplified' | 'false';
  geometries?: 'geojson' | 'polyline';
  steps?: boolean;
}

export interface OsrmRequestInit {
  signal?: AbortSignal;
  headers?: HeadersInit;
}

export function buildOsrmRouteUrl(params: OsrmRouteParams): string {
  const profile = params.profile ?? 'driving';
  const coordsStr = params.coords.map(([lng, lat]) => `${lng},${lat}`).join(';');
  const search = new URLSearchParams({ overview: params.overview ?? 'false' });
  if (params.geometries) search.set('geometries', params.geometries);
  if (params.steps) search.set('steps', 'true');
  return `${BASE}/route/v1/${profile}/${coordsStr}?${search.toString()}`;
}

export function osrmRoute(
  params: OsrmRouteParams,
  init: OsrmRequestInit = {},
): Promise<Response> {
  return fetch(buildOsrmRouteUrl(params), {
    headers: init.headers,
    signal: init.signal,
  });
}
