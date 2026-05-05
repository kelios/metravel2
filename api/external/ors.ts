const BASE = 'https://api.openrouteservice.org';

export type OrsProfile =
  | 'driving-car'
  | 'foot-walking'
  | 'cycling-regular'
  | 'cycling-road'
  | 'cycling-mountain';

export interface OrsDirectionsBody {
  coordinates: Array<[number, number]>;
  radiuses?: Array<number | -1>;
  [extra: string]: unknown;
}

export interface OrsRequestInit {
  signal?: AbortSignal;
  headers?: HeadersInit;
}

export function orsDirections(
  profile: OrsProfile,
  body: OrsDirectionsBody,
  apiKey: string,
  init: OrsRequestInit = {},
): Promise<Response> {
  return fetch(`${BASE}/v2/directions/${profile}/geojson`, {
    method: 'POST',
    headers: {
      Authorization: apiKey,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
    body: JSON.stringify(body),
    signal: init.signal,
  });
}
