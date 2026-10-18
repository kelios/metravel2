import { valhallaRoute, type ValhallaRequestInit } from '@/api/external/valhalla';
import {
  decodePolyline6,
  estimateDurationSeconds,
  filterValidCoords,
  getValhallaCosting,
  haversineMeters,
  validateRoutePoints,
} from '@/utils/routingHelpers';
import type { LngLat } from '@/utils/routeExport';

export type ValhallaRoutingResult =
  | { ok: true; coords: LngLat[]; distanceM: number; durationS: number }
  | { ok: false; response?: Response };

// The public instance limits /route to ten locations, including repeated ones.
const MAX_LOCATIONS = 10;

const throwIfAborted = (signal?: AbortSignal): void => {
  if (!signal?.aborted) return;
  const error = new Error('Aborted');
  error.name = 'AbortError';
  throw error;
};

// Preserve every shape vertex and its precision. Omit only an exact shared
// endpoint between whole legs/chunks; input waypoints are never deduplicated.
const appendTrack = (target: LngLat[], shape: LngLat[]): void => {
  const last = target[target.length - 1];
  const first = shape[0];
  const offset = last && first && last[0] === first[0] && last[1] === first[1] ? 1 : 0;
  for (let index = offset; index < shape.length; index += 1) target.push(shape[index]);
};

const trackDistanceM = (track: LngLat[]): number =>
  track.reduce((sum, point, index) => index ? sum + haversineMeters(track[index - 1], point) : 0, 0);

// The shared decoder intentionally keeps a valid prefix of truncated input.
// A healthy provider leg must instead contain complete latitude/longitude pairs.
const isCompleteShape6 = (shape: string): boolean => {
  let groups = 0;
  let width = 0;
  for (const character of shape) {
    const byte = character.charCodeAt(0) - 63;
    if (byte < 0 || byte > 63 || ++width > 6) return false;
    if (byte < 32) {
      groups += 1;
      width = 0;
    }
  }
  return width === 0 && groups >= 2 && groups % 2 === 0;
};

/**
 * Bounded, sequential requests share one waypoint: [0..9], [9..18], ... .
 * Both map and quest callers receive a complete road route or an explicit
 * failure, never a partial success. The real failing HTTP response is preserved
 * so each caller retains its existing localized status/error policy.
 */
export async function fetchValhallaRouteGeometry(
  points: LngLat[],
  mode: 'car' | 'bike' | 'foot',
  init: ValhallaRequestInit = {},
): Promise<ValhallaRoutingResult> {
  throwIfAborted(init.signal);
  validateRoutePoints(points);
  const coords: LngLat[] = [];
  let distanceM = 0;
  let durationS = 0;

  // A caller's existing signal/deadline covers all requests and is never reset.
  for (let start = 0; start < points.length - 1; start += MAX_LOCATIONS - 1) {
    throwIfAborted(init.signal);
    const chunk = points.slice(start, start + MAX_LOCATIONS);
    const response = await valhallaRoute({
      locations: chunk.map(([lng, lat]) => ({ lat, lon: lng })),
      costing: getValhallaCosting(mode),
      directions_options: { units: 'kilometers' },
    }, init);
    throwIfAborted(init.signal);
    if (!response.ok) return { ok: false, response };

    const data = await response.json();
    throwIfAborted(init.signal);
    const legs = Array.isArray(data?.trip?.legs) ? data.trip.legs : [];
    // Default break locations require one leg per requested segment. Accepting
    // a missing/empty middle leg would fabricate a direct connection instead.
    if (legs.length !== chunk.length - 1) return { ok: false };
    const chunkTrack: LngLat[] = [];
    for (const [legIndex, leg] of legs.entries()) {
      if (typeof leg?.shape !== 'string' || !isCompleteShape6(leg.shape)) return { ok: false };
      const shape = decodePolyline6(leg.shape);
      const valid = filterValidCoords(shape);
      if (!valid.length || valid.length !== shape.length) return { ok: false };
      if (valid.length === 1) {
        const from = chunk[legIndex];
        const to = chunk[legIndex + 1];
        const samePoint = from[0] === to[0] && from[1] === to[1];
        const explicitZero = Number.isFinite(leg?.summary?.length) && leg.summary.length === 0
          && Number.isFinite(leg?.summary?.time) && leg.summary.time === 0;
        if (!samePoint && !explicitZero) return { ok: false };
      }
      appendTrack(chunkTrack, valid);
    }
    const lengthM = Number(data?.trip?.summary?.length) * 1000;
    const timeS = Number(data?.trip?.summary?.time);
    const chunkDistanceM = Number.isFinite(lengthM) && lengthM > 0
      ? lengthM : trackDistanceM(chunkTrack);
    distanceM += chunkDistanceM;
    durationS += Number.isFinite(timeS) && timeS > 0
      ? timeS : estimateDurationSeconds(chunkDistanceM, mode);
    appendTrack(coords, chunkTrack);
  }

  if (coords.length < 2) return { ok: false };
  return { ok: true, coords, distanceM, durationS };
}
