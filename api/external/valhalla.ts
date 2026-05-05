const BASE = 'https://valhalla1.openstreetmap.de';

export interface ValhallaLocation {
  lat: number;
  lon: number;
}

export interface ValhallaRouteBody {
  locations: ValhallaLocation[];
  costing: string;
  directions_options?: { units?: string };
  [extra: string]: unknown;
}

export interface ValhallaRequestInit {
  signal?: AbortSignal;
  headers?: HeadersInit;
}

export function valhallaRoute(body: ValhallaRouteBody, init: ValhallaRequestInit = {}): Promise<Response> {
  const url = `${BASE}/route?json=${encodeURIComponent(JSON.stringify(body))}`;
  return fetch(url, { headers: init.headers, signal: init.signal });
}
