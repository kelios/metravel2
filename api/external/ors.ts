// HeiGIT-hosted openrouteservice. The legacy host api.openrouteservice.org is
// switched off on 28.09.2026 (board #1948); the backend routing chain moved to
// the same address in #1919, and the API keys are unchanged — only the URL.
const BASE = 'https://api.heigit.org/openrouteservice';

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
