const DEFAULT_BASE = 'https://overpass-api.de/api/interpreter';

export interface OverpassRequestInit {
  signal?: AbortSignal;
  headers?: HeadersInit;
  endpoint?: string;
}

export function overpassQuery(query: string, init: OverpassRequestInit = {}): Promise<Response> {
  const endpoint = init.endpoint || process.env.EXPO_PUBLIC_OVERPASS_ENDPOINT || DEFAULT_BASE;
  return fetch(endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
      ...(init.headers ?? {}),
    },
    body: `data=${encodeURIComponent(query)}`,
    signal: init.signal,
  });
}
