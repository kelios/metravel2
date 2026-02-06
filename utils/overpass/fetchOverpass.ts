import {
  buildOsmCampingOverpassQL,
  buildOsmPoiOverpassQL,
  buildOsmRoutesOverpassQL,
  type BBox,
  type OsmPoiCategory,
  normalizeBBox,
} from './buildOverpassQuery';

export type FetchOverpassOptions = {
  endpoint?: string;
  signal?: AbortSignal;
};

export const DEFAULT_OVERPASS_ENDPOINT =
  process.env.EXPO_PUBLIC_OVERPASS_ENDPOINT || 'https://overpass-api.de/api/interpreter';

const DEFAULT_OVERPASS_ENDPOINTS = (
  process.env.EXPO_PUBLIC_OVERPASS_ENDPOINTS ||
  process.env.EXPO_PUBLIC_OVERPASS_ENDPOINT ||
  ''
)
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const FALLBACK_OVERPASS_ENDPOINTS = [
  DEFAULT_OVERPASS_ENDPOINT,
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.nchc.org.tw/api/interpreter',
].filter(Boolean);

const isTransientOverpassError = (status: number, text: string) => {
  if ([429, 502, 503, 504].includes(status)) return true;
  const t = (text || '').toLowerCase();
  return t.includes('timeout') || t.includes('too busy') || t.includes('server is probably too busy');
};

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (!ms || ms <= 0) return resolve();
    if (signal?.aborted) return reject(new DOMException('Aborted', 'AbortError'));
    const t = setTimeout(() => {
      cleanup();
      resolve();
    }, ms);
    const onAbort = () => {
      cleanup();
      clearTimeout(t);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    const cleanup = () => signal?.removeEventListener('abort', onAbort);
    signal?.addEventListener('abort', onAbort, { once: true });
  });

const parseRetryAfterMs = (value: string | null | undefined) => {
  const raw = String(value || '').trim();
  if (!raw) return 0;
  const seconds = Number(raw);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1000, 60000);
  const date = Date.parse(raw);
  if (Number.isFinite(date)) {
    const ms = date - Date.now();
    return Math.min(Math.max(ms, 0), 60000);
  }
  return 0;
};

const postOverpass = async (endpoint: string, ql: string, opts?: FetchOverpassOptions) => {
  return fetch(endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
    },
    body: `data=${encodeURIComponent(ql)}`,
    signal: opts?.signal,
  });
};

const fetchOverpassJson = async (ql: string, opts?: FetchOverpassOptions) => {
  const endpoints = opts?.endpoint
    ? [opts.endpoint]
    : DEFAULT_OVERPASS_ENDPOINTS.length
      ? DEFAULT_OVERPASS_ENDPOINTS
      : FALLBACK_OVERPASS_ENDPOINTS;

  let lastStatus = 0;
  let lastText = '';

  let backoffMs = 0;
  const isTestEnv = process.env.NODE_ENV === 'test';
  const baseDelayMs = isTestEnv ? 0 : 600;
  const maxDelayMs = isTestEnv ? 0 : 8000;

  for (const endpoint of endpoints) {
    const res = await postOverpass(endpoint, ql, opts);

    if (res.ok) {
      return res.json();
    }

    const text = await res.text().catch(() => '');
    lastStatus = res.status;
    lastText = text;

    const retryAfterMs = parseRetryAfterMs(res.headers?.get?.('retry-after'));

    if (!isTransientOverpassError(res.status, text)) {
      break;
    }

    if (!isTestEnv) {
      backoffMs = backoffMs ? Math.min(backoffMs * 2, maxDelayMs) : baseDelayMs;
      const waitMs = Math.max(backoffMs, retryAfterMs);
      await sleep(waitMs, opts?.signal);
    }
  }

  throw new Error(`Overpass error ${lastStatus}: ${String(lastText).slice(0, 200)}`);
};

export const fetchOsmCamping = async (bbox: BBox, opts?: FetchOverpassOptions) => {
  const b = normalizeBBox(bbox);

  const ql = buildOsmCampingOverpassQL(b);
  return fetchOverpassJson(ql, opts);
};

export const fetchOsmPoi = async (bbox: BBox, opts?: FetchOverpassOptions & { categories?: OsmPoiCategory[] }) => {
  const b = normalizeBBox(bbox);

  const ql = buildOsmPoiOverpassQL(b, opts?.categories);
  return fetchOverpassJson(ql, opts);
};

export const fetchOsmRoutes = async (bbox: BBox, opts?: FetchOverpassOptions) => {
  const b = normalizeBBox(bbox);

  const ql = buildOsmRoutesOverpassQL(b);
  return fetchOverpassJson(ql, opts);
};

