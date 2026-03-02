import type { WebMapLayerDefinition } from '@/config/mapWebLayers';
import type { BBox } from '@/utils/overpass';
import { bboxAreaKm2, normalizeBBox } from '@/utils/overpass';

// Re-export from extracted modules for backward compatibility
export { filterGeoJsonByBBox, sanitizeGeoJson, computeGeoJsonBounds, bboxesOverlap, swapGeoJsonAxes, geometryHasFiniteCoords } from './geoJsonUtils';
export { wfsXmlToGeoJson as __wfsXmlToGeoJson } from './wfsXmlParser';

import { wfsXmlToGeoJson } from './wfsXmlParser';
import { filterGeoJsonByBBox, sanitizeGeoJson, computeGeoJsonBounds, bboxesOverlap, swapGeoJsonAxes } from './geoJsonUtils';

type LeafletMap = Record<string, unknown> & {
  getBounds: () => { getSouthWest: () => { lat: number; lng: number }; getNorthEast: () => { lat: number; lng: number } };
  on: (event: string, handler: () => void) => void;
  off: (event: string, handler: () => void) => void;
};

export type LasyZanocujWfsOverlayOptions = {
  maxAreaKm2?: number;
  debounceMs?: number;
};

const defaultOpts: Required<LasyZanocujWfsOverlayOptions> = {
  maxAreaKm2: 5000,
  debounceMs: 700,
};

const STATIC_DATA_PATH = '/assets/data/lasy-zanocuj.json';

const isProductionHost = () =>
  typeof window !== 'undefined' &&
  window.location.hostname !== 'localhost' &&
  !window.location.hostname.startsWith('192.168.');

let staticDataCache: Record<string, unknown> | null = null;
let staticDataFailed = false;

const fetchStaticData = async (signal?: AbortSignal): Promise<Record<string, unknown> | null> => {
  if (staticDataCache) return staticDataCache;
  if (staticDataFailed) return null;

  try {
    const res = await fetch(STATIC_DATA_PATH, { signal });
    if (!res.ok) {
      staticDataFailed = true;
      return null;
    }
    const data = await res.json();
    if (data?.type === 'FeatureCollection' && Array.isArray(data.features) && data.features.length > 0) {
      staticDataCache = data;
      return data;
    }
    staticDataFailed = true;
    return null;
  } catch {
    staticDataFailed = true;
    return null;
  }
};

const looksLikeOwsExceptionReport = (text: string) => {
  const t = (text || '').trim().slice(0, 400).toLowerCase();
  return t.includes('<ows:exceptionreport') || t.includes('exceptionreport') || t.includes('ows:exception');
};

const tryParseGeoJsonFromResponse = async (res: Response) => {
  const contentType = (res.headers.get('content-type') || '').toLowerCase();
  const text = await res.text();

  if (looksLikeOwsExceptionReport(text)) {
    return { ok: false as const, errorText: text };
  }

  if (!contentType.includes('xml') && !text.trim().startsWith('<')) {
    try {
      const parsed = JSON.parse(text);
      return { ok: true as const, data: parsed };
    } catch {
      return { ok: false as const, errorText: text };
    }
  }

  const geojson = wfsXmlToGeoJson(text);
  if (!geojson) return { ok: false as const, errorText: text };
  return { ok: true as const, data: geojson };
};

const escapeHtml = (s: string) =>
  (s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

export const attachLasyZanocujWfsOverlay = (
  L: Record<string, unknown> & { layerGroup: () => unknown; geoJSON: (data: unknown, opts: unknown) => Record<string, unknown> },
  map: LeafletMap,
  def: WebMapLayerDefinition,
  opts?: LasyZanocujWfsOverlayOptions
) => {
  const options = { ...defaultOpts, ...(opts || {}) };

  const layerGroup = L.layerGroup() as Record<string, (...args: unknown[]) => unknown>;

  let abort: AbortController | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastKey: string | null = null;
  let isLoading = false;
  let nextAllowedAt = 0;
  let backoffMs = 0;
  let preferredAttempt: {
    version: string;
    typeParam: 'typeNames' | 'typeName';
    srsName: string;
    bboxOrder: 'lonlat' | 'latlon';
    outputFormat: string;
  } | null = null;

  const makeBBox = (): BBox => {
    const b = map.getBounds();
    const sw = b.getSouthWest();
    const ne = b.getNorthEast();
    return normalizeBBox({
      south: sw.lat,
      west: sw.lng,
      north: ne.lat,
      east: ne.lng,
    });
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

  const buildUrl = (
    bbox: BBox,
    urlOpts: {
      version: string;
      typeParam: 'typeNames' | 'typeName';
      outputFormat: string;
      srsName: string;
      bboxOrder: 'lonlat' | 'latlon';
    }
  ) => {
    let base = def.url;

    const lasyDomain = 'mapserver.bdl.lasy.gov.pl';
    if (base.includes(lasyDomain)) {
      const isProduction = typeof window !== 'undefined' &&
        window.location.hostname !== 'localhost' &&
        !window.location.hostname.startsWith('192.168.');
      if (isProduction) {
        base = '/proxy/wfs/lasy';
      }
    }

    const sep = base.includes('?') ? '&' : '?';
    const typeName = def.wfsParams?.typeName;

    const params = new URLSearchParams();
    params.set('service', 'WFS');
    params.set('request', 'GetFeature');
    params.set('version', urlOpts.version);
    if (typeName) params.set(urlOpts.typeParam, typeName);
    params.set('outputFormat', urlOpts.outputFormat);
    params.set('srsName', urlOpts.srsName);
    const bboxValue =
      urlOpts.bboxOrder === 'latlon'
        ? `${bbox.south},${bbox.west},${bbox.north},${bbox.east}`
        : `${bbox.west},${bbox.south},${bbox.east},${bbox.north}`;
    params.set('bbox', bboxValue);

    return `${base}${sep}${params.toString()}`;
  };

  const renderGeoJson = (geojson: Record<string, unknown>) => {
    layerGroup.clearLayers();

    const sanitized = sanitizeGeoJson(geojson);
    if (!sanitized) return;

    const style = {
      color: 'rgb(31, 122, 31)',
      weight: 2,
      fillColor: 'rgb(52, 199, 89)',
      fillOpacity: 0.25,
      opacity: 0.9,
    };

    const geoLayer = L.geoJSON(sanitized, {
      style: () => style,
      onEachFeature: (feature: Record<string, unknown>, layer: Record<string, (...args: unknown[]) => void>) => {
        const props = (feature?.properties || {}) as Record<string, unknown>;
        const name =
          props?.name ||
          props?.Name ||
          props?.NAZWA ||
          props?.nazwa ||
          props?.Nazwa ||
          '';

        const title = name ? escapeHtml(String(name)) : 'Zanocuj w lesie';
        const html = `<div style="max-width:260px"><div style="font-weight:800;margin-bottom:4px">${title}</div></div>`;
        try {
          layer.bindPopup(html);
        } catch {
          // noop
        }
      },
    });

    if (def.zIndex != null && typeof (geoLayer as Record<string, unknown>).setZIndex === 'function') {
      (geoLayer as Record<string, (...args: unknown[]) => void>).setZIndex(def.zIndex);
    }

    (geoLayer as Record<string, (...args: unknown[]) => void>).addTo(layerGroup);
  };

  const loadFromStaticData = async (bbox: BBox, signal?: AbortSignal): Promise<boolean> => {
    const data = await fetchStaticData(signal);
    if (!data) return false;

    const filtered = filterGeoJsonByBBox(data, bbox);
    if (!filtered) {
      layerGroup.clearLayers();
      return true;
    }

    renderGeoJson(filtered);
    return true;
  };

  const load = async () => {
    if (!map || !L) return;
    if (!def?.url) return;
    if (!def?.wfsParams?.typeName) return;
    if (isLoading) return;

    const now = Date.now();
    if (now < nextAllowedAt) return;

    const bbox = shrinkBBoxToMaxArea(makeBBox(), options.maxAreaKm2);
    const key = keyFromBBox(bbox);
    if (key === lastKey) return;
    lastKey = key;

    abort?.abort();
    abort = new AbortController();
    isLoading = true;

    try {
      if (isProductionHost()) {
        const ok = await loadFromStaticData(bbox, abort.signal);
        if (ok) {
          backoffMs = 0;
          nextAllowedAt = Date.now() + 300;
          return;
        }
      }
      const version = def.wfsParams?.version || '2.0.0';
      const outputFormat = def.wfsParams?.outputFormat || 'GEOJSON';
      const srsName = def.wfsParams?.srsName || 'EPSG:4326';
      const configBboxOrder: 'lonlat' | 'latlon' = def.wfsParams?.bboxOrder || 'lonlat';
      const altBboxOrder: 'lonlat' | 'latlon' = configBboxOrder === 'latlon' ? 'lonlat' : 'latlon';

      const srsCandidates = (() => {
        const out = [srsName];
        const lower = (srsName || '').toLowerCase();
        if (lower.includes('crs84') || lower.includes('ogc:1.3:crs84')) {
          out.push('EPSG:4326');
        }
        if (lower === 'epsg:4326') {
          out.push('urn:ogc:def:crs:EPSG::4326');
        }
        return Array.from(new Set(out)).slice(0, 2);
      })();

      const outputFormatCandidates = [
        outputFormat,
        outputFormat?.toLowerCase() === 'geojson' ? null : 'GEOJSON',
        outputFormat?.toLowerCase() === 'esrigeojson' ? null : 'ESRIGEOJSON',
        'GML3',
      ].filter(Boolean) as string[];

      const uniqueFormats = Array.from(new Set(outputFormatCandidates));
      const formatsToTry = ((): string[] => {
        const first = uniqueFormats[0] || 'GEOJSON';
        if (first.toLowerCase() === 'gml3') return ['GML3'];
        return [first, 'GML3'];
      })();

      type Attempt = {
        version: string;
        typeParam: 'typeNames' | 'typeName';
        srsName: string;
        bboxOrder: 'lonlat' | 'latlon';
        outputFormat: string;
      };

      const attempts: Attempt[] = [];
      const seen = new Set<string>();
      const addAttempt = (a: Attempt) => {
        const k = `${a.version}|${a.typeParam}|${a.srsName}|${a.bboxOrder}|${a.outputFormat}`;
        if (seen.has(k)) return;
        seen.add(k);
        attempts.push(a);
      };

      if (preferredAttempt) addAttempt(preferredAttempt);

      for (const srs of srsCandidates) {
        for (const fmt of formatsToTry) {
          addAttempt({ version, typeParam: 'typeNames', outputFormat: fmt, srsName: srs, bboxOrder: configBboxOrder });
        }
      }

      addAttempt({
        version, typeParam: 'typeName',
        outputFormat: formatsToTry[0] || outputFormatCandidates[0] || 'GEOJSON',
        srsName: srsCandidates[0] || srsName, bboxOrder: configBboxOrder,
      });

      const fmt0 = formatsToTry[0] || outputFormatCandidates[0] || 'GEOJSON';
      if (srsCandidates.includes('EPSG:4326')) {
        addAttempt({ version, typeParam: 'typeNames', outputFormat: fmt0, srsName: 'EPSG:4326', bboxOrder: altBboxOrder });
        addAttempt({ version, typeParam: 'typeName', outputFormat: fmt0, srsName: 'EPSG:4326', bboxOrder: altBboxOrder });
      }

      if (version !== '1.1.0') {
        addAttempt({ version: '1.1.0', typeParam: 'typeName', outputFormat: 'GML3', srsName: 'EPSG:4326', bboxOrder: 'latlon' });
      }

      let lastErrorText = '';
      let lastErrorStatus: number | null = null;
      let lastAttemptObj: Attempt | null = null;

      for (const attempt of attempts) {
        const url = buildUrl(bbox, attempt);
        const res = await fetch(url, { method: 'GET', signal: abort.signal });

        if (res.status === 504 || res.status === 502) {
          throw new Error(`Gateway timeout (${res.status}): upstream server too slow`);
        }

        if (!res.ok) {
          lastErrorText = await res.text().catch(() => '');
          lastErrorStatus = res.status;
          lastAttemptObj = attempt;
          continue;
        }

        const parsed = await tryParseGeoJsonFromResponse(res);
        if (!parsed.ok) { lastErrorText = parsed.errorText; lastErrorStatus = res.status; lastAttemptObj = attempt; continue; }

        const initialSanitized = sanitizeGeoJson(parsed.data as Record<string, unknown>);
        if (!initialSanitized) { lastErrorText = 'Empty or invalid FeatureCollection'; lastErrorStatus = res.status; lastAttemptObj = attempt; continue; }

        let dataToRender = initialSanitized;
        try {
          const boundsNormal = computeGeoJsonBounds(dataToRender, false);
          const boundsSwapped = computeGeoJsonBounds(dataToRender, true);
          if (boundsNormal && boundsSwapped) {
            const okNormal = bboxesOverlap(boundsNormal, bbox);
            const okSwapped = bboxesOverlap(boundsSwapped, bbox);
            if (!okNormal && okSwapped) {
              dataToRender = swapGeoJsonAxes(dataToRender);
            }
          }
        } catch {
          // noop
        }

        renderGeoJson(dataToRender);
        preferredAttempt = attempt;
        backoffMs = 0;
        nextAllowedAt = Date.now() + 1200;
        return;
      }

      throw new Error(
        `WFS: failed to load features.` +
        ` Last status: ${lastErrorStatus ?? 'n/a'}.` +
        ` Last attempt: ${lastAttemptObj ? `${lastAttemptObj.version} ${lastAttemptObj.typeParam} ${lastAttemptObj.srsName} ${lastAttemptObj.bboxOrder} ${lastAttemptObj.outputFormat}` : 'n/a'}.` +
        ` Last response: ${String(lastErrorText).slice(0, 200)}`
      );
    } catch (e: unknown) {
      const err = e as { name?: string; message?: string };
      if (err?.name === 'AbortError') return;
      const msg = String(err?.message || '').toLowerCase();
      const isRateLimited = msg.includes('429') || msg.includes('too many requests');
      const isTimeoutish = msg.includes('timeout') || msg.includes('too busy') || msg.includes('504') || msg.includes('502') || msg.includes('gateway');

      if (isRateLimited || isTimeoutish) {
        backoffMs = backoffMs ? Math.min(backoffMs * 2, 60000) : 5000;
        nextAllowedAt = Date.now() + backoffMs;
      } else {
        nextAllowedAt = Date.now() + 2000;
      }
      console.warn('[Lasy Zanocuj WFS Overlay] Failed to load data:', err?.message || e);
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

  return { layer: layerGroup, start, stop };
};
