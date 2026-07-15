import type { BBox, OSMLineFeature, OSMPointFeature } from '@/utils/overpass';
import { resolveApiBaseUrl } from '@/utils/resolveApiBaseUrl';
import { translate as i18nT } from '@/i18n';

/**
 * Canonical overlay path: backend proxy/cache `/api/map/overlays/` (BE #714).
 *
 * Возвращает нормализованные features вместо прямых Overpass QL / WFS запросов
 * и клиентского парсинга. Каждый web overlay-контроллер сначала пытается этот
 * путь; при недоступности / сетевой ошибке / `skipped: upstream_error`
 * контроллер откатывается на прежнюю прямую Overpass/WFS-логику.
 *
 * Контракт ответа (#714):
 *   GET /api/map/overlays/?layer={id}&bbox={s},{w},{n},{e}&zoom={n}
 *   → 200 {
 *       layer, bbox, source, cache_hit, min_zoom, skipped, reason,
 *       features: [{ id, kind: point|line|polygon, title, lat?, lng?,
 *                    geometry?, tags?, popup: { title, subtitle?, source_label } }]
 *     }
 */

export type BackendOverlayLayerId =
  | 'osm-overpass-poi'
  | 'osm-overpass-routes'
  | 'osm-overpass-features'
  | 'wfs-geojson'
  | 'lasy-zanocuj-wfs';

export type BackendOverlayFeaturePopup = {
  title: string;
  subtitle?: string;
  source_label?: string;
};

export type BackendOverlayFeature = {
  id: string;
  kind: 'point' | 'line' | 'polygon';
  title: string;
  lat?: number;
  lng?: number;
  geometry?: unknown;
  tags?: Record<string, string>;
  popup?: BackendOverlayFeaturePopup;
};

export type BackendOverlayResponse = {
  layer: string;
  bbox: { south: number; west: number; north: number; east: number };
  source: 'overpass' | 'wfs' | 'static' | 'cache' | string;
  cache_hit: boolean;
  min_zoom: number | null;
  skipped: boolean;
  reason: string | null;
  features: BackendOverlayFeature[];
};

/**
 * Итог адаптера для контроллера:
 * - `status: 'ok'` — features получены и нормализованы, рендерим их;
 * - `status: 'skip'` — backend осознанно пропустил слой (min_zoom / bbox_too_large):
 *   контроллер уважает это как «не показывать» (очистить слой), без fallback;
 * - `status: 'fallback'` — недоступность / сеть / `upstream_error`:
 *   контроллер идёт по прежнему прямому пути.
 */
export type BackendOverlayResult =
  | {
      status: 'ok';
      source: BackendOverlayResponse['source'];
      cacheHit: boolean;
      points: OSMPointFeature[];
      lines: OSMLineFeature[];
      geojson: Record<string, unknown> | null;
      raw: BackendOverlayResponse;
    }
  | { status: 'skip'; reason: string | null; minZoom: number | null }
  | { status: 'fallback'; reason: string };

const OVERLAYS_PATH = '/map/overlays/';

const isProbablyUpstreamError = (reason: string | null): boolean => {
  const r = String(reason || '').toLowerCase();
  return r.startsWith('upstream_error') || r.includes('timeout') || r.includes('error');
};

const resolveOverlaysBaseUrl = (): string => {
  const isLocalApi = String(process.env.EXPO_PUBLIC_IS_LOCAL_API || '').toLowerCase() === 'true';
  const isE2E = String(process.env.EXPO_PUBLIC_E2E || '').toLowerCase() === 'true';
  const platformOS = typeof window !== 'undefined' ? 'web' : 'node';
  return resolveApiBaseUrl({
    platformOS,
    envApiUrl: process.env.EXPO_PUBLIC_API_URL,
    prodApiUrl: process.env.PROD_API_URL,
    nodeEnv: process.env.NODE_ENV,
    isE2E,
    isLocalApi,
    windowOrigin: typeof window !== 'undefined' ? window.location?.origin ?? null : null,
    windowHostname: typeof window !== 'undefined' ? window.location?.hostname ?? null : null,
  });
};

const numOr = (v: unknown, fallback: number): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const toStringTags = (tags: Record<string, string> | undefined): Record<string, string> => {
  if (!tags || typeof tags !== 'object') return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(tags)) {
    if (v == null) continue;
    out[String(k)] = String(v);
  }
  return out;
};

/**
 * Мержит popup-текст бэка в теги, чтобы прежний рендер попапов
 * (name / description / source_label) продолжал работать без изменений UX.
 */
const tagsWithPopup = (
  feature: BackendOverlayFeature,
): Record<string, string> => {
  const tags = toStringTags(feature.tags);
  const popup = feature.popup;
  if (popup?.subtitle && !tags.description && !tags['description:ru']) {
    tags.description = String(popup.subtitle);
  }
  return tags;
};

/** point-feature бэка → внутренний OSMPointFeature. */
export const backendFeatureToPoint = (feature: BackendOverlayFeature): OSMPointFeature | null => {
  if (feature.kind !== 'point') return null;
  const lat = Number(feature.lat);
  const lng = Number(feature.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const tags = tagsWithPopup(feature);
  const title = String(feature.title || feature.popup?.title || '').trim() || i18nT('sharedStatic:map.pointFallback');
  const osmUrl = tags['osm:url'] || tags.osmUrl || undefined;

  return { id: String(feature.id), lat, lng, title, tags, osmUrl };
};

const coordsFromGeometry = (geometry: unknown): Array<{ lat: number; lng: number }> => {
  // GeoJSON LineString: { type:'LineString', coordinates:[[lng,lat],...] }
  // либо голый массив [[lng,lat],...] / [{lat,lng}].
  const raw = (geometry as { coordinates?: unknown })?.coordinates ?? geometry;
  if (!Array.isArray(raw)) return [];

  const out: Array<{ lat: number; lng: number }> = [];
  for (const point of raw) {
    if (Array.isArray(point) && point.length >= 2) {
      const lng = Number(point[0]);
      const lat = Number(point[1]);
      if (Number.isFinite(lat) && Number.isFinite(lng)) out.push({ lat, lng });
    } else if (point && typeof point === 'object') {
      const lat = Number((point as { lat?: unknown }).lat);
      const lng = Number((point as { lng?: unknown }).lng);
      if (Number.isFinite(lat) && Number.isFinite(lng)) out.push({ lat, lng });
    }
  }
  return out;
};

/** line-feature бэка → внутренний OSMLineFeature. */
export const backendFeatureToLine = (feature: BackendOverlayFeature): OSMLineFeature | null => {
  if (feature.kind !== 'line') return null;
  const coords = coordsFromGeometry(feature.geometry);
  if (coords.length < 2) return null;

  const tags = tagsWithPopup(feature);
  const title = String(feature.title || feature.popup?.title || '').trim() || i18nT('sharedStatic:map.routeFallback');
  const osmUrl = tags['osm:url'] || tags.osmUrl || undefined;

  return { id: String(feature.id), title, tags, coords, osmUrl };
};

/** polygon/line-features бэка → GeoJSON FeatureCollection для L.geoJSON. */
export const backendFeaturesToGeoJson = (
  features: BackendOverlayFeature[],
): Record<string, unknown> | null => {
  const geoFeatures = (Array.isArray(features) ? features : [])
    .filter((f) => f && (f.kind === 'polygon' || f.kind === 'line') && f.geometry != null)
    .map((f) => ({
      type: 'Feature',
      geometry: f.geometry,
      properties: {
        ...toStringTags(f.tags),
        name: f.title || f.popup?.title || '',
      },
    }));

  if (!geoFeatures.length) return null;
  return { type: 'FeatureCollection', features: geoFeatures };
};

/**
 * Нормализует raw backend-ответ в результат для контроллера.
 * Разделён от fetch, чтобы юнит-тестировать чистую трансформацию.
 */
export const adaptBackendOverlayResponse = (
  raw: BackendOverlayResponse,
): BackendOverlayResult => {
  if (raw?.skipped) {
    if (isProbablyUpstreamError(raw.reason)) {
      return { status: 'fallback', reason: raw.reason || 'upstream_error' };
    }
    // min_zoom / bbox_too_large и прочие «осознанные» пропуски — уважаем.
    return { status: 'skip', reason: raw.reason ?? null, minZoom: raw.min_zoom ?? null };
  }

  const features = Array.isArray(raw?.features) ? raw.features : [];

  const points: OSMPointFeature[] = [];
  const lines: OSMLineFeature[] = [];
  for (const f of features) {
    if (!f || typeof f !== 'object') continue;
    if (f.kind === 'point') {
      const p = backendFeatureToPoint(f);
      if (p) points.push(p);
    } else if (f.kind === 'line') {
      const l = backendFeatureToLine(f);
      if (l) lines.push(l);
    }
  }

  const geojson = backendFeaturesToGeoJson(features);

  return {
    status: 'ok',
    source: raw.source,
    cacheHit: Boolean(raw.cache_hit),
    points,
    lines,
    geojson,
    raw,
  };
};

export type FetchBackendOverlayOptions = {
  layer: BackendOverlayLayerId;
  bbox: BBox;
  zoom?: number;
  signal?: AbortSignal;
};

/**
 * Дёргает canonical backend endpoint и нормализует ответ.
 * Любая сетевая / HTTP / парсинг-ошибка → `{ status: 'fallback' }`,
 * контроллер идёт по прямому Overpass/WFS-пути.
 */
export const fetchBackendOverlay = async ({
  layer,
  bbox,
  zoom,
  signal,
}: FetchBackendOverlayOptions): Promise<BackendOverlayResult> => {
  const baseUrl = resolveOverlaysBaseUrl();
  if (!baseUrl) return { status: 'fallback', reason: 'no_api_base_url' };

  const south = numOr(bbox.south, NaN);
  const west = numOr(bbox.west, NaN);
  const north = numOr(bbox.north, NaN);
  const east = numOr(bbox.east, NaN);
  if (![south, west, north, east].every(Number.isFinite)) {
    return { status: 'fallback', reason: 'invalid_bbox' };
  }

  const params = new URLSearchParams();
  params.set('layer', layer);
  params.set('bbox', `${south},${west},${north},${east}`);
  if (Number.isFinite(zoom)) params.set('zoom', String(Math.round(Number(zoom))));

  const url = `${baseUrl}${OVERLAYS_PATH}?${params.toString()}`;

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { accept: 'application/json' },
      signal,
    });
    if (!res.ok) {
      return { status: 'fallback', reason: `http_${res.status}` };
    }
    const data = (await res.json()) as BackendOverlayResponse;
    if (!data || typeof data !== 'object') {
      return { status: 'fallback', reason: 'invalid_payload' };
    }
    return adaptBackendOverlayResponse(data);
  } catch (e: unknown) {
    const err = e as { name?: string; message?: string };
    if (err?.name === 'AbortError') {
      return { status: 'fallback', reason: 'aborted' };
    }
    return { status: 'fallback', reason: err?.message || 'network_error' };
  }
};
