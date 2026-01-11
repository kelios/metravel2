import type { BBox, OSMLineFeature } from '@/src/utils/overpass';
import { bboxAreaKm2, fetchOsmRoutes, overpassToLines } from '@/src/utils/overpass';

type LeafletMap = any;

export type OsmRoutesOverlayOptions = {
  maxAreaKm2?: number;
  debounceMs?: number;
};

const defaultOpts: Required<OsmRoutesOverlayOptions> = {
  maxAreaKm2: 1500,
  debounceMs: 750,
};

export const attachOsmRoutesOverlay = (L: any, map: LeafletMap, opts?: OsmRoutesOverlayOptions) => {
  const options = { ...defaultOpts, ...(opts || {}) };

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
      return {
        south: sw.lat,
        west: sw.lng,
        north: ne.lat,
        east: ne.lng,
      };
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

    const nextHalfLat = halfLat * factor;
    const nextHalfLng = halfLng * factor;

    return {
      south: centerLat - nextHalfLat,
      west: centerLng - nextHalfLng,
      north: centerLat + nextHalfLat,
      east: centerLng + nextHalfLng,
    };
  };

  const keyFromBBox = (bbox: BBox) => {
    const r = (n: number) => Math.round(n * 100) / 100;
    return `${r(bbox.south)}|${r(bbox.west)}|${r(bbox.north)}|${r(bbox.east)}`;
  };

  const escapeHtml = (s: string) =>
    (s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');

  const renderLines = (lines: OSMLineFeature[]) => {
    layerGroup.clearLayers();

    const style = {
      color: '#ff7a00',
      weight: 4,
      opacity: 0.85,
    };

    for (const line of lines) {
      if (!line.coords?.length || line.coords.length < 2) continue;

      const poly = L.polyline(line.coords.map((c: { lat: number; lng: number }) => [c.lat, c.lng]), style);

      const routeType = line.tags.route || line.tags.network || '';
      const html = `
        <div style="max-width:260px">
          <div style="font-weight:800;margin-bottom:4px">${escapeHtml(line.title)}</div>
          ${routeType ? `<div style="font-size:12px;opacity:0.8">${escapeHtml(String(routeType))}</div>` : ''}
          ${line.osmUrl ? `<div style="margin-top:6px"><a href="${line.osmUrl}" target="_blank" rel="noopener noreferrer">Открыть в OpenStreetMap</a></div>` : ''}
        </div>
      `;

      try {
        poly.bindPopup(html);
      } catch {
        // noop
      }

      poly.addTo(layerGroup);
    }
  };

  const load = async () => {
    if (!map || !L) return;
    if (isLoading) return;

    const now = Date.now();
    if (now < nextAllowedAt) return;

    const rawBBox = makeBBox();
    if (!rawBBox) return;

    const bbox = shrinkBBoxToMaxArea(rawBBox, options.maxAreaKm2);

    const key = keyFromBBox(bbox);
    if (key === lastKey) return;
    lastKey = key;

    abort?.abort();
    abort = new AbortController();
    isLoading = true;

    try {
      const data = await fetchOsmRoutes(bbox, { signal: abort.signal });
      const lines = overpassToLines(data);
      renderLines(lines);

      backoffMs = 0;
      nextAllowedAt = Date.now() + 800;
    } catch (e: any) {
      if (e?.name === 'AbortError') return;

      const msg = String(e?.message || '').toLowerCase();
      const isRateLimited = msg.includes('429') || msg.includes('too many requests');
      const isTimeoutish = msg.includes('timeout') || msg.includes('too busy');

      if (isRateLimited || isTimeoutish) {
        backoffMs = backoffMs ? Math.min(backoffMs * 2, 30000) : 2000;
        nextAllowedAt = Date.now() + backoffMs;
      } else {
        nextAllowedAt = Date.now() + 1500;
      }

      if (isTimeoutish || isRateLimited) {
        console.warn('[OSM Routes Overlay] Overpass API is busy, skipping load.');
      } else {
        console.warn('[OSM Routes Overlay] Failed to load data:', e?.message || e);
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

  return {
    layer: layerGroup,
    start,
    stop,
  };
};
