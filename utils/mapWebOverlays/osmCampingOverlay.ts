import type { BBox } from '@/utils/overpass';
import { bboxAreaKm2, fetchOsmCamping, overpassToPoints, type OSMPointFeature } from '@/utils/overpass';

type LeafletMap = any;

export type OsmCampingOverlayOptions = {
  maxAreaKm2?: number;
  debounceMs?: number;
};

const defaultOpts: Required<OsmCampingOverlayOptions> = {
  maxAreaKm2: 2500, // защитный лимит (примерно 50x50 км)
  debounceMs: 600,
};

export const attachOsmCampingOverlay = (L: any, map: LeafletMap, opts?: OsmCampingOverlayOptions) => {
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
    // 2 decimals ~ 1-2км точности; снижает частоту запросов
    const r = (n: number) => Math.round(n * 100) / 100;
    return `${r(bbox.south)}|${r(bbox.west)}|${r(bbox.north)}|${r(bbox.east)}`;
  };

  const renderPoints = (points: OSMPointFeature[]) => {
    layerGroup.clearLayers();

    for (const p of points) {
      if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng)) continue;

      let marker: any = null;
      try {
        marker = L.circleMarker([p.lat, p.lng], {
          radius: 6,
          color: 'rgb(31, 122, 31)',
          weight: 2,
          fillColor: 'rgb(52, 199, 89)',
          fillOpacity: 0.7,
        });
      } catch (e: any) {
        console.warn('[OSM Camping Overlay] Invalid marker coordinates, skipping:', {
          id: p.id,
          lat: p.lat,
          lng: p.lng,
          title: p.title,
          error: e?.message || e,
        });
        continue;
      }

      const typeLabel = kindLabelRu(p.tags);
      const operator = p.tags.operator || p.tags['operator:ru'] || p.tags['operator:en'] || '';
      const capacity = p.tags.capacity || '';
      const website = p.tags.website || p.tags.url || '';

      const metaLines: string[] = [];
      if (operator) metaLines.push(`Оператор: ${escapeHtml(operator)}`);
      if (capacity) metaLines.push(`Вместимость: ${escapeHtml(capacity)}`);

      const html = `
        <div style="max-width:260px">
          <div style="font-weight:800;margin-bottom:4px">${escapeHtml(p.title)}</div>
          <div style="font-size:12px;opacity:0.8">${escapeHtml(typeLabel)}</div>
          ${metaLines.length ? `<div style="margin-top:6px;font-size:12px;opacity:0.85">${metaLines.map((l) => `<div>${l}</div>`).join('')}</div>` : ''}
          ${website ? `<div style="margin-top:6px"><a href="${escapeAttr(website)}" target="_blank" rel="noopener noreferrer">Сайт</a></div>` : ''}
          ${p.osmUrl ? `<div style="margin-top:6px"><a href="${p.osmUrl}" target="_blank" rel="noopener noreferrer">Открыть в OpenStreetMap</a></div>` : ''}
        </div>
      `;

      try {
        marker.bindPopup(html);
        marker.addTo(layerGroup);
      } catch (e: any) {
        console.warn('[OSM Camping Overlay] Failed to add marker, skipping:', {
          id: p.id,
          lat: p.lat,
          lng: p.lng,
          title: p.title,
          error: e?.message || e,
        });
      }
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
      const data = await fetchOsmCamping(bbox, { signal: abort.signal });
      const pts = overpassToPoints(data);
      renderPoints(pts);

      backoffMs = 0;
      nextAllowedAt = Date.now() + 800;
    } catch (e: any) {
      if (e?.name === 'AbortError') return;

      // Логируем ошибку для отладки, но не показываем пользователю
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
        console.warn('[OSM Camping Overlay] Overpass API is busy, skipping load. This is expected and doesn\'t affect the main map.');
      } else {
        console.warn('[OSM Camping Overlay] Failed to load data:', e?.message || e);
      }

      // Очищаем слой при ошибке
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

const escapeHtml = (s: string) =>
  (s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const escapeAttr = (s: string) => escapeHtml(s).replace(/`/g, '');

const kindLabelRu = (tags: Record<string, string>) => {
  const tourism = tags.tourism;
  const amenity = tags.amenity;

  if (tourism === 'camp_site') return 'Кемпинг';
  if (tourism === 'camp_pitch') return 'Место под палатку';
  if (tourism === 'wilderness_hut') return 'Лесной домик';
  if (amenity === 'shelter') return 'Укрытие';

  // fallback
  return tourism || amenity || 'Ночёвка';
};
