import type { WebMapLayerDefinition } from '@/src/config/mapWebLayers';
import type { BBox } from '@/src/utils/overpass';
import { bboxAreaKm2, normalizeBBox } from '@/src/utils/overpass';

type LeafletMap = any;

export type LasyZanocujWfsOverlayOptions = {
  maxAreaKm2?: number;
  debounceMs?: number;
};

const defaultOpts: Required<LasyZanocujWfsOverlayOptions> = {
  maxAreaKm2: 5000,
  debounceMs: 700,
};

const looksLikeOwsExceptionReport = (text: string) => {
  const t = (text || '').trim().slice(0, 400).toLowerCase();
  return t.includes('<ows:exceptionreport') || t.includes('exceptionreport') || t.includes('ows:exception');
};

const localName = (n: string) => (n || '').split(':').pop() || n;

const gmlText = (el: Element | null | undefined) => (el?.textContent || '').trim();

const findFirstByLocalNames = (root: Element, names: Set<string>) => {
  const els = Array.from(root.getElementsByTagName('*')) as Element[];
  for (const el of els) {
    if (names.has(localName(el.tagName))) return el;
  }
  return null;
};

const findAllByLocalNames = (root: Element, names: Set<string>) => {
  const els = Array.from(root.getElementsByTagName('*')) as Element[];
  return els.filter((el) => names.has(localName(el.tagName)));
};

const parseCoords = (raw: string) => {
  const s = (raw || '').trim();
  if (!s) return [] as Array<[number, number]>;
  const hasComma = s.includes(',');
  const parts = s
    .replace(/\s+/g, ' ')
    .trim()
    .split(hasComma ? /\s+/ : /\s+/)
    .filter(Boolean);

  if (hasComma) {
    const pairs = s
      .replace(/\s+/g, ' ')
      .trim()
      .split(' ')
      .map((p) => p.split(',').map((x) => Number(x)) as [number, number])
      .filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]));
    return pairs;
  }

  const nums = parts.map((x) => Number(x)).filter((x) => Number.isFinite(x));
  const out: Array<[number, number]> = [];
  for (let i = 0; i + 1 < nums.length; i += 2) {
    out.push([nums[i + 1], nums[i]]);
  }
  return out;
};

const extractGeometryFromGml = (featureEl: Element) => {
  const geomEl = findFirstByLocalNames(
    featureEl,
    new Set([
      'Point',
      'LineString',
      'Polygon',
      'MultiPoint',
      'MultiLineString',
      'MultiPolygon',
      'Surface',
      'MultiSurface',
    ])
  );
  if (!geomEl) return null;

  const name = localName(geomEl.tagName);

  if (name === 'Point') {
    const pos = findFirstByLocalNames(geomEl, new Set(['pos']));
    const coords = parseCoords(gmlText(pos));
    if (coords.length !== 1) return null;
    return { type: 'Point', coordinates: coords[0] };
  }

  if (name === 'LineString') {
    const posList = findFirstByLocalNames(geomEl, new Set(['posList']));
    const coordinatesEl = findFirstByLocalNames(geomEl, new Set(['coordinates']));
    const coords = parseCoords(gmlText(posList) || gmlText(coordinatesEl));
    if (!coords.length) return null;
    return { type: 'LineString', coordinates: coords };
  }

  if (name === 'Polygon' || name === 'Surface') {
    const rings: Array<Array<[number, number]>> = [];
    const linearRings = findAllByLocalNames(geomEl, new Set(['LinearRing']));
    for (const ring of linearRings) {
      const posList = findFirstByLocalNames(ring, new Set(['posList']));
      const coordinatesEl = findFirstByLocalNames(ring, new Set(['coordinates']));
      const coords = parseCoords(gmlText(posList) || gmlText(coordinatesEl));
      if (coords.length) rings.push(coords);
    }
    if (!rings.length) {
      const posList = findFirstByLocalNames(geomEl, new Set(['posList']));
      const coords = parseCoords(gmlText(posList));
      if (coords.length) rings.push(coords);
    }
    if (!rings.length) return null;
    return { type: 'Polygon', coordinates: rings };
  }

  if (name === 'MultiPoint') {
    const points: Array<[number, number]> = [];
    const posEls = findAllByLocalNames(geomEl, new Set(['pos']));
    for (const posEl of posEls) {
      const coords = parseCoords(gmlText(posEl));
      if (coords.length === 1) points.push(coords[0]);
    }
    if (!points.length) return null;
    return { type: 'MultiPoint', coordinates: points };
  }

  if (name === 'MultiLineString') {
    const lines: Array<Array<[number, number]>> = [];
    const lineStrings = findAllByLocalNames(geomEl, new Set(['LineString']));
    for (const ls of lineStrings) {
      const posList = findFirstByLocalNames(ls, new Set(['posList']));
      const coordinatesEl = findFirstByLocalNames(ls, new Set(['coordinates']));
      const coords = parseCoords(gmlText(posList) || gmlText(coordinatesEl));
      if (coords.length) lines.push(coords);
    }
    if (!lines.length) return null;
    return { type: 'MultiLineString', coordinates: lines };
  }

  if (name === 'MultiPolygon' || name === 'MultiSurface') {
    const polys: Array<Array<Array<[number, number]>>> = [];
    const polygonEls = findAllByLocalNames(geomEl, new Set(['Polygon', 'Surface']));
    for (const polyEl of polygonEls) {
      const rings: Array<Array<[number, number]>> = [];
      const linearRings = findAllByLocalNames(polyEl, new Set(['LinearRing']));
      for (const ring of linearRings) {
        const posList = findFirstByLocalNames(ring, new Set(['posList']));
        const coordinatesEl = findFirstByLocalNames(ring, new Set(['coordinates']));
        const coords = parseCoords(gmlText(posList) || gmlText(coordinatesEl));
        if (coords.length) rings.push(coords);
      }
      if (rings.length) polys.push(rings);
    }
    if (!polys.length) return null;
    return { type: 'MultiPolygon', coordinates: polys };
  }

  return null;
};

export const __wfsXmlToGeoJson = (xmlText: string) => {
  if (typeof DOMParser === 'undefined') return null;
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, 'text/xml');
  const parseError = doc.querySelector('parsererror');
  if (parseError) return null;

  const allEls = Array.from(doc.getElementsByTagName('*')) as Element[];
  const members = allEls.filter((el) => {
    const ln = localName(el.tagName);
    return ln === 'featureMember' || ln === 'member';
  });
  const features: any[] = [];

  for (const m of members) {
    const featureEl = Array.from(m.children || [])[0] as Element | undefined;
    if (!featureEl) continue;

    const geometry = extractGeometryFromGml(featureEl);
    if (!geometry) continue;

    const props: Record<string, any> = {};
    for (const child of Array.from(featureEl.children)) {
      const tag = localName(child.tagName);
      if (tag === localName((geometry as any)?.type || '')) continue;

      const isGeomChild = !!child.querySelector(
        'Point,LineString,Polygon,MultiPoint,MultiLineString,MultiPolygon,Surface,MultiSurface,gml\\:Point,gml\\:LineString,gml\\:Polygon,gml\\:MultiPoint,gml\\:MultiLineString,gml\\:MultiPolygon,gml\\:Surface,gml\\:MultiSurface'
      );
      if (isGeomChild) continue;
      const val = gmlText(child);
      if (val) props[tag] = val;
    }

    features.push({ type: 'Feature', geometry, properties: props });
  }

  if (!features.length) return null;
  return { type: 'FeatureCollection', features };
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

  const geojson = __wfsXmlToGeoJson(text);
  if (!geojson) return { ok: false as const, errorText: text };
  return { ok: true as const, data: geojson };
};

export const attachLasyZanocujWfsOverlay = (
  L: any,
  map: LeafletMap,
  def: WebMapLayerDefinition,
  opts?: LasyZanocujWfsOverlayOptions
) => {
  const options = { ...defaultOpts, ...(opts || {}) };

  const layerGroup = L.layerGroup();

  let abort: AbortController | null = null;
  let timer: any = null;
  let lastKey: string | null = null;
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

  const buildUrl = (
    bbox: BBox,
    options: {
      version: string;
      typeParam: 'typeNames' | 'typeName';
      outputFormat: string;
      srsName: string;
      bboxOrder: 'lonlat' | 'latlon';
    }
  ) => {
    const base = def.url;
    const sep = base.includes('?') ? '&' : '?';

    const typeName = def.wfsParams?.typeName;

    const params = new URLSearchParams();
    params.set('service', 'WFS');
    params.set('request', 'GetFeature');
    params.set('version', options.version);
    if (typeName) params.set(options.typeParam, typeName);
    params.set('outputFormat', options.outputFormat);
    params.set('srsName', options.srsName);
    // ArcGIS WFSServer часто возвращает 400, если в bbox добавлять ",<srsName>".
    // CRS задаём только через параметр srsName, а bbox оставляем чистым.
    const bboxValue =
      options.bboxOrder === 'latlon'
        ? `${bbox.south},${bbox.west},${bbox.north},${bbox.east}`
        : `${bbox.west},${bbox.south},${bbox.east},${bbox.north}`;
    params.set('bbox', bboxValue);

    return `${base}${sep}${params.toString()}`;
  };

  const renderGeoJson = (geojson: any) => {
    layerGroup.clearLayers();

    const style = {
      color: '#1f7a1f',
      weight: 2,
      fillColor: '#34c759',
      fillOpacity: 0.25,
      opacity: 0.9,
    };

    const geoLayer = L.geoJSON(geojson, {
      style: () => style,
      onEachFeature: (feature: any, layer: any) => {
        const props = feature?.properties || {};
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

    if (def.zIndex != null && typeof geoLayer.setZIndex === 'function') {
      geoLayer.setZIndex(def.zIndex);
    }

    geoLayer.addTo(layerGroup);
  };

  const load = async () => {
    if (!map || !L) return;
    if (!def?.url) return;
    if (!def?.wfsParams?.typeName) return;

    const bbox = shrinkBBoxToMaxArea(makeBBox(), options.maxAreaKm2);
    const key = keyFromBBox(bbox);
    if (key === lastKey) return;
    lastKey = key;

    abort?.abort();
    abort = new AbortController();

    try {
      const version = def.wfsParams?.version || '2.0.0';
      const outputFormat = def.wfsParams?.outputFormat || 'GEOJSON';
      const srsName = def.wfsParams?.srsName || 'urn:ogc:def:crs:OGC:1.3:CRS84';

      // Many ArcGIS WFSServer deployments are picky about outputFormat strings.
      // We try several GeoJSON-like variants.
      const outputFormatCandidates = [
        outputFormat,
        'geojson',
        'GEOJSON',
        'application/geo+json',
        'application/vnd.geo+json',
        'application/json; subtype=geojson',
        'json',
        'GML2',
        'GML3',
        'text/xml; subtype=gml/3.1.1',
        'application/gml+xml; version=3.2',
      ].filter(Boolean);

      // Attempt list: first try the config (often WFS 2.0.0 + CRS84), then fallback to WFS 1.1.0 + EPSG:4326.
      const attempts: Array<{
        version: string;
        typeParam: 'typeNames' | 'typeName';
        srsName: string;
        bboxOrder: 'lonlat' | 'latlon';
        outputFormat: string;
      }> = [];

      const addAttempt = (a: (typeof attempts)[number]) => {
        const key = `${a.version}|${a.typeParam}|${a.srsName}|${a.bboxOrder}|${a.outputFormat}`;
        const seen = new Set(attempts.map((x) => `${x.version}|${x.typeParam}|${x.srsName}|${x.bboxOrder}|${x.outputFormat}`));
        if (seen.has(key)) return;
        attempts.push(a);
      };

      if (preferredAttempt) {
        addAttempt(preferredAttempt);
      }

      for (const fmt of outputFormatCandidates) {
        addAttempt({
          version,
          typeParam: 'typeNames',
          outputFormat: fmt,
          srsName,
          bboxOrder: 'lonlat',
        });
      }
      for (const fmt of outputFormatCandidates) {
        addAttempt({
          version: '1.1.0',
          typeParam: 'typeName',
          outputFormat: fmt,
          srsName: 'EPSG:4326',
          bboxOrder: 'latlon',
        });
      }

      let lastErrorText = '';
      for (const attempt of attempts) {
        const url = buildUrl(bbox, attempt);
        const res = await fetch(url, { method: 'GET', signal: abort.signal });

        if (!res.ok) {
          const text = await res.text().catch(() => '');
          lastErrorText = text;
          continue;
        }

        const parsed = await tryParseGeoJsonFromResponse(res);
        if (!parsed.ok) {
          lastErrorText = parsed.errorText;
          continue;
        }

        renderGeoJson(parsed.data);
        preferredAttempt = attempt;
        return;
      }

      throw new Error(`WFS: no supported GeoJSON outputFormat. Last response: ${String(lastErrorText).slice(0, 200)}`);
    } catch (e: any) {
      if (e?.name === 'AbortError') return;
      console.warn('[Lasy Zanocuj WFS Overlay] Failed to load data:', e?.message || e);
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

const escapeHtml = (s: string) =>
  (s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
