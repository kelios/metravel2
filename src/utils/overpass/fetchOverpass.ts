import { buildOsmCampingOverpassQL, type BBox, normalizeBBox } from './buildOverpassQuery';

export type FetchOverpassOptions = {
  endpoint?: string;
  signal?: AbortSignal;
};

export const DEFAULT_OVERPASS_ENDPOINT =
  process.env.EXPO_PUBLIC_OVERPASS_ENDPOINT || 'https://overpass-api.de/api/interpreter';

export const fetchOsmCamping = async (bbox: BBox, opts?: FetchOverpassOptions) => {
  const endpoint = opts?.endpoint || DEFAULT_OVERPASS_ENDPOINT;
  const b = normalizeBBox(bbox);

  const ql = buildOsmCampingOverpassQL(b);

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
    },
    body: `data=${encodeURIComponent(ql)}`,
    signal: opts?.signal,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Overpass error ${res.status}: ${text.slice(0, 200)}`);
  }

  return res.json();
};

