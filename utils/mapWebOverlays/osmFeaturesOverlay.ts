import type { BBox, OverpassFeatureFilterInput } from '@/utils/overpass';
import {
  bboxAreaKm2,
  buildOsmFeaturesOverpassQL,
  DEFAULT_OVERPASS_ENDPOINT,
  normalizeBBox,
  overpassToPoints,
  type OSMPointFeature,
} from '@/utils/overpass';
import { DESIGN_TOKENS } from '@/constants/designSystem';

type LeafletMap = any;

export type OsmFeaturesOverlayOptions = {
  filters: OverpassFeatureFilterInput[];
  /** Цвет заливки маркера. */
  color?: string;
  /** Минимальный зум, ниже которого запрос пропускается (с логом). */
  minZoom?: number;
  /** Метка для лога (id слоя). */
  layerId?: string;
  maxAreaKm2?: number;
  debounceMs?: number;
};

const defaultOpts = {
  color: DESIGN_TOKENS.colors.warningDark,
  minZoom: 12,
  maxAreaKm2: 2500,
  debounceMs: 700,
} as const;

const escapeHtml = (s: string) =>
  String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

/**
 * Универсальный Overpass-оверлей точечных фич: фильтры + цвет + minZoom-гейт.
 * Попап показывает name и ele (высота, если есть). При зуме ниже minZoom
 * запрос пропускается и пишется лог.
 */
export const attachOsmFeaturesOverlay = (
  L: any,
  map: LeafletMap,
  opts: OsmFeaturesOverlayOptions,
) => {
  const options = {
    color: opts.color ?? defaultOpts.color,
    minZoom: opts.minZoom ?? defaultOpts.minZoom,
    layerId: opts.layerId ?? 'osm-features',
    maxAreaKm2: opts.maxAreaKm2 ?? defaultOpts.maxAreaKm2,
    debounceMs: opts.debounceMs ?? defaultOpts.debounceMs,
    filters: Array.isArray(opts.filters) ? opts.filters : [],
  };

  const layerGroup = L.layerGroup();

  let abort: AbortController | null = null;
  let timer: any = null;
  let lastKey: string | null = null;
  let isLoading = false;
  let nextAllowedAt = 0;
  let backoffMs = 0;
  let started = false;

  const makeBBox = (): BBox | null => {
    try {
      const b = map.getBounds?.();
      if (!b) return null;
      const sw = b.getSouthWest?.();
      const ne = b.getNorthEast?.();
      if (!sw || !ne) return null;
      if (!Number.isFinite(sw.lat) || !Number.isFinite(sw.lng) || !Number.isFinite(ne.lat) || !Number.isFinite(ne.lng)) {
        return null;
      }
      return { south: sw.lat, west: sw.lng, north: ne.lat, east: ne.lng };
    } catch {
      return null;
    }
  };

  const shrinkBBoxToMaxArea = (bbox: BBox, maxAreaKm2: number): BBox => {
    const area = bboxAreaKm2(bbox);
    if (!(area > maxAreaKm2)) return bbox;
    const factor = Math.sqrt(maxAreaKm2 / area);
    const centerLat = (bbox.north + bbox.south) / 2;
    const centerLng = (bbox.east + bbox.west) / 2;
    const halfLat = Math.abs(bbox.north - bbox.south) / 2;
    const halfLng = Math.abs(bbox.east - bbox.west) / 2;
    return {
      south: centerLat - halfLat * factor,
      west: centerLng - halfLng * factor,
      north: centerLat + halfLat * factor,
      east: centerLng + halfLng * factor,
    };
  };

  const keyFromBBox = (bbox: BBox) => {
    const r = (n: number) => Math.round(n * 100) / 100;
    return `${r(bbox.south)}|${r(bbox.west)}|${r(bbox.north)}|${r(bbox.east)}`;
  };

  const renderPoints = (points: OSMPointFeature[]) => {
    layerGroup.clearLayers();
    for (const p of points) {
      if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng)) continue;
      try {
        const marker = L.circleMarker([p.lat, p.lng], {
          radius: 6,
          color: DESIGN_TOKENS.colors.surface,
          weight: 2,
          fillColor: options.color,
          fillOpacity: 0.95,
        });

        const ele = p.tags?.ele;
        const eleNum = ele != null ? Number(ele) : NaN;
        const eleLine = Number.isFinite(eleNum)
          ? `<div style="margin-top:4px;font-size:12px;color:${escapeHtml(DESIGN_TOKENS.colors.textMuted)}">Высота: ${Math.round(eleNum)} м</div>`
          : '';

        const html = `<div style="max-width:260px"><div style="font-weight:800;font-size:14px;color:${escapeHtml(
          DESIGN_TOKENS.colors.text,
        )};word-break:break-word">${escapeHtml(p.title)}</div>${eleLine}<div style="margin-top:6px;font-size:11px;color:${escapeHtml(
          DESIGN_TOKENS.colors.textSubtle,
        )}">Источник: OpenStreetMap</div></div>`;

        marker.bindPopup(html);
        marker.addTo(layerGroup);
      } catch {
        // noop
      }
    }
  };

  const load = async () => {
    if (!map || !L) return;
    if (isLoading) return;

    const zoom = typeof map.getZoom === 'function' ? Number(map.getZoom()) : NaN;
    if (Number.isFinite(zoom) && zoom < options.minZoom) {
      console.warn(
        `[OSM Features Overlay:${options.layerId}] Skipped load: zoom ${zoom} < minZoom ${options.minZoom}`,
      );
      layerGroup.clearLayers();
      lastKey = null;
      return;
    }

    const now = Date.now();
    if (now < nextAllowedAt) return;

    const rawBBox = makeBBox();
    if (!rawBBox) return;
    const bbox = shrinkBBoxToMaxArea(normalizeBBox(rawBBox), options.maxAreaKm2);

    const key = keyFromBBox(bbox);
    if (key === lastKey) return;
    lastKey = key;

    if (!options.filters.length) return;

    abort?.abort();
    abort = new AbortController();
    isLoading = true;

    try {
      const ql = buildOsmFeaturesOverpassQL(bbox, options.filters);
      const res = await fetch(DEFAULT_OVERPASS_ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded; charset=UTF-8' },
        body: `data=${encodeURIComponent(ql)}`,
        signal: abort.signal,
      });
      if (!res.ok) throw new Error(`Overpass error ${res.status}`);
      const data = await res.json();
      renderPoints(overpassToPoints(data));
      backoffMs = 0;
      nextAllowedAt = Date.now() + 800;
    } catch (e: any) {
      if (e?.name === 'AbortError') return;
      const msg = String(e?.message || '').toLowerCase();
      const transient = msg.includes('429') || msg.includes('timeout') || msg.includes('too busy');
      if (transient) {
        backoffMs = backoffMs ? Math.min(backoffMs * 2, 30000) : 2000;
        nextAllowedAt = Date.now() + backoffMs;
        console.warn(`[OSM Features Overlay:${options.layerId}] Overpass busy, skipping load.`);
      } else {
        nextAllowedAt = Date.now() + 1500;
        console.warn(`[OSM Features Overlay:${options.layerId}] Failed to load data:`, e?.message || e);
      }
      layerGroup.clearLayers();
    } finally {
      isLoading = false;
    }
  };

  const schedule = () => {
    if (timer) clearTimeout(timer);
    const now = Date.now();
    const delay = Math.max(options.debounceMs, Math.max(0, nextAllowedAt - now));
    timer = setTimeout(load, delay);
  };

  const onMoveEnd = () => schedule();

  const start = () => {
    if (started) return;
    started = true;
    try {
      if (typeof map.whenReady === 'function') {
        map.whenReady(() => {
          if (!started) return;
          try {
            map.on('moveend', onMoveEnd);
          } catch {
            // noop
          }
          schedule();
        });
      } else {
        map.on('moveend', onMoveEnd);
        schedule();
      }
    } catch {
      // noop
    }
  };

  const stop = () => {
    if (!started) return;
    started = false;
    try {
      map.off?.('moveend', onMoveEnd);
    } catch {
      // noop
    }
    abort?.abort();
    abort = null;
    if (timer) clearTimeout(timer);
    timer = null;
    lastKey = null;
    layerGroup.clearLayers();
  };

  return { layer: layerGroup, start, stop };
};
