import { API_BASE_URL } from '@/api/apiConfig';

export type ServerTransportMode = 'car' | 'bike' | 'foot';

export interface ServerRoutingPoint {
  lat: number;
  lng: number;
}

export interface ServerRoutingRequestInit {
  signal?: AbortSignal;
}

export interface ServerRoutingResponseBody {
  geometry?: Array<[number, number]>;
  distance_m?: number;
  duration_s?: number;
  provider?: string;
  is_optimal?: boolean;
  fallback_reason?: string | null;
  cache_hit?: boolean;
  warnings?: string[];
}

/**
 * Canonical server-side routing endpoint (backed by ORS on the backend, see
 * task board #707/#732). Client-side ORS/OSRM/Valhalla remain only as a
 * fallback path for network errors or older deployments without this route.
 */
export function serverRoute(
  points: ServerRoutingPoint[],
  transportMode: ServerTransportMode,
  init: ServerRoutingRequestInit = {},
): Promise<Response> {
  return fetch(`${API_BASE_URL}/routing/route/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ points, transport_mode: transportMode }),
    signal: init.signal,
  });
}
