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

  const toLngLat = (a: number, b: number): [number, number] => {
    const aLooksLat = a >= -90 && a <= 90;
    const bLooksLat = b >= -90 && b <= 90;
    const aLooksLng = a >= -180 && a <= 180;
    const bLooksLng = b >= -180 && b <= 180;
    if (aLooksLat && bLooksLng && !(aLooksLng && bLooksLat)) {
      return [b, a];
    }
    return [a, b];
  };

  if (hasComma) {
    const pairs = s
      .replace(/\s+/g, ' ')
      .trim()
      .split(' ')
      .map((p) => p.split(',').map((x) => Number(x)) as [number, number])
      .filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]))
      .map(([a, b]) => toLngLat(a, b));
    return pairs;
  }

  const nums = parts.map((x) => Number(x)).filter((x) => Number.isFinite(x));
  const out: Array<[number, number]> = [];
  for (let i = 0; i + 1 < nums.length; i += 2) {
    out.push(toLngLat(nums[i], nums[i + 1]));
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

const isFiniteNumber = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value);

const geometryHasFiniteCoords = (geometry: any): boolean => {
  if (!geometry) return false;
  const { type, coordinates } = geometry;
  if (!type || coordinates == null) return false;

  const isCoordPair = (coord: any) =>
    Array.isArray(coord) &&
    coord.length >= 2 &&
    isFiniteNumber(coord[0]) &&
    isFiniteNumber(coord[1]);

  const walk = (coords: any): boolean => {
    if (isCoordPair(coords)) return true;
    if (!Array.isArray(coords)) return false;
    return coords.every((c) => walk(c));
  };

  switch (type) {
    case 'Point':
      return isCoordPair(coordinates);
    case 'MultiPoint':
    case 'LineString':
    case 'MultiLineString':
    case 'Polygon':
    case 'MultiPolygon':
      return walk(coordinates);
    default:
      return false;
  }
};

const sanitizeGeoJson = (geojson: any) => {
  if (!geojson || geojson.type !== 'FeatureCollection' || !Array.isArray(geojson.features)) {
    return null;
  }
  const features = geojson.features.filter((feature: any) =>
    geometryHasFiniteCoords(feature?.geometry)
  );
  if (features.length === 0) return null;
  return { ...geojson, features };
};

const computeGeoJsonBounds = (geojson: any, swapAxes: boolean): BBox | null => {
  if (!geojson || geojson.type !== 'FeatureCollection' || !Array.isArray(geojson.features)) return null;

  let south = Infinity;
  let west = Infinity;
  let north = -Infinity;
  let east = -Infinity;

  const pushPair = (pair: any) => {
    if (!Array.isArray(pair) || pair.length < 2) return;
    const a = Number(pair[0]);
    const b = Number(pair[1]);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return;
    const lng = swapAxes ? b : a;
    const lat = swapAxes ? a : b;
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return;
    south = Math.min(south, lat);
    north = Math.max(north, lat);
    west = Math.min(west, lng);
    east = Math.max(east, lng);
  };

  const walk = (coords: any) => {
    if (!Array.isArray(coords)) return;
    if (coords.length >= 2 && typeof coords[0] === 'number' && typeof coords[1] === 'number') {
      pushPair(coords);
      return;
    }
    for (const c of coords) walk(c);
  };

  for (const f of geojson.features) {
    const g = f?.geometry;
    if (!g || g.coordinates == null) continue;
    walk(g.coordinates);
  }

  if (!Number.isFinite(south) || !Number.isFinite(west) || !Number.isFinite(north) || !Number.isFinite(east)) return null;
  return normalizeBBox({ south, west, north, east });
};

const bboxesOverlap = (a: BBox, b: BBox) => {
  if (!a || !b) return false;
  return !(a.east < b.west || a.west > b.east || a.north < b.south || a.south > b.north);
};

const swapGeoJsonAxes = (geojson: any) => {
  if (!geojson || geojson.type !== 'FeatureCollection' || !Array.isArray(geojson.features)) return geojson;

  const swapCoords = (coords: any): any => {
    if (!Array.isArray(coords)) return coords;
    if (coords.length >= 2 && typeof coords[0] === 'number' && typeof coords[1] === 'number') {
      return [coords[1], coords[0]];
    }
    return coords.map((c) => swapCoords(c));
  };

  return {
    ...geojson,
    features: geojson.features.map((f: any) => {
      const g = f?.geometry;
      if (!g || g.coordinates == null) return f;
      return { ...f, geometry: { ...g, coordinates: swapCoords(g.coordinates) } };
    }),
  };
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

    const sanitized = sanitizeGeoJson(geojson);
    if (!sanitized) return;

    const style = {
      color: '#1f7a1f',
      weight: 2,
      fillColor: '#34c759',
      fillOpacity: 0.25,
      opacity: 0.9,
    };

    const geoLayer = L.geoJSON(sanitized, {
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
      const version = def.wfsParams?.version || '2.0.0';
      const outputFormat = def.wfsParams?.outputFormat || 'GEOJSON';
      const srsName = def.wfsParams?.srsName || 'urn:ogc:def:crs:OGC:1.3:CRS84';

      // Keep attempts tight to avoid spamming WFS servers with many format probes.
      const outputFormatCandidates = [
        outputFormat,
        outputFormat?.toLowerCase() === 'geojson' ? null : 'GEOJSON',
        'GML3',
      ].filter(Boolean) as string[];

      // Attempt list: prefer cached successful params, then config + one fallback.
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

      addAttempt({
        version,
        typeParam: 'typeNames',
        outputFormat: outputFormatCandidates[0] || 'GEOJSON',
        srsName,
        bboxOrder: 'lonlat',
      });
      addAttempt({
        version: '1.1.0',
        typeParam: 'typeName',
        outputFormat: outputFormatCandidates.includes('GML3') ? 'GML3' : (outputFormatCandidates[0] || 'GEOJSON'),
        srsName: 'EPSG:4326',
        bboxOrder: 'latlon',
      });

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

        let dataToRender = parsed.data;
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

      throw new Error(`WFS: no supported GeoJSON outputFormat. Last response: ${String(lastErrorText).slice(0, 200)}`);
    } catch (e: any) {
      if (e?.name === 'AbortError') return;
      const msg = String(e?.message || '').toLowerCase();
      const isRateLimited = msg.includes('429') || msg.includes('too many requests');
      const isTimeoutish = msg.includes('timeout') || msg.includes('too busy');

      if (isRateLimited || isTimeoutish) {
        backoffMs = backoffMs ? Math.min(backoffMs * 2, 30000) : 2000;
        nextAllowedAt = Date.now() + backoffMs;
      } else {
        nextAllowedAt = Date.now() + 2000;
      }
      console.warn('[Lasy Zanocuj WFS Overlay] Failed to load data:', e?.message || e);
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
