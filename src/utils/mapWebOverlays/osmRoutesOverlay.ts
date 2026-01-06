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

  const makeBBox = (): BBox => {
    const b = map.getBounds();
    const sw = b.getSouthWest();
    const ne = b.getNorthEast();
    return {
      south: sw.lat,
      west: sw.lng,
      north: ne.lat,
      east: ne.lng,
    };
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

    const bbox = shrinkBBoxToMaxArea(makeBBox(), options.maxAreaKm2);

    const key = keyFromBBox(bbox);
    if (key === lastKey) return;
    lastKey = key;

    abort?.abort();
    abort = new AbortController();

    try {
      const data = await fetchOsmRoutes(bbox, { signal: abort.signal });
      const lines = overpassToLines(data);
      renderLines(lines);
    } catch (e: any) {
      if (e?.name === 'AbortError') return;
      if (e?.message?.includes('timeout') || e?.message?.includes('too busy')) {
        console.warn('[OSM Routes Overlay] Overpass API is busy, skipping load.');
      } else {
        console.warn('[OSM Routes Overlay] Failed to load data:', e?.message || e);
      }
      layerGroup.clearLayers();
    }
  };

  const schedule = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(load, options.debounceMs);
  };

  const onMoveEnd = () => schedule();

  const start = () => {
    map.on('moveend', onMoveEnd);
    schedule();
  };

  const stop = () => {
    map.off('moveend', onMoveEnd);
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
