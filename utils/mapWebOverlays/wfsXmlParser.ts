// utils/mapWebOverlays/wfsXmlParser.ts
// J3: WFS XML → GeoJSON parser (extracted from lasyZanocujWfsOverlay.ts)

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

export const parseCoords = (raw: string) => {
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

export const extractGeometryFromGml = (featureEl: Element): Record<string, unknown> | null => {
  const geomEl = findFirstByLocalNames(
    featureEl,
    new Set([
      'Point', 'LineString', 'Polygon', 'MultiPoint',
      'MultiLineString', 'MultiPolygon', 'Surface', 'MultiSurface',
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

export const wfsXmlToGeoJson = (xmlText: string) => {
  if (typeof DOMParser === 'undefined') return null;
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, 'text/xml');
  const parseError = doc.querySelector('parsererror');
  if (parseError) return null;

  const allEls = Array.from(doc.getElementsByTagName('*')) as Element[];
  const members = allEls.filter((el) => {
    const ln = localName(el.tagName);
    return ln === 'featureMember' || ln === 'member' || ln === 'featureMembers';
  });
  const features: Array<Record<string, unknown>> = [];

  for (const m of members) {
    const ln = localName(m.tagName);
    const candidateFeatures: Element[] =
      ln === 'featureMembers'
        ? (Array.from(m.children || []) as Element[])
        : ([Array.from(m.children || [])[0]] as Array<Element | undefined>).filter(Boolean) as Element[];

    for (const featureEl of candidateFeatures) {
      if (!featureEl) continue;

      const geometry = extractGeometryFromGml(featureEl);
      if (!geometry) continue;

      const props: Record<string, string> = {};
      for (const child of Array.from(featureEl.children)) {
        const tag = localName(child.tagName);
        if (tag === String(geometry.type ?? '')) continue;

        const isGeomChild = !!child.querySelector(
          'Point,LineString,Polygon,MultiPoint,MultiLineString,MultiPolygon,Surface,MultiSurface,gml\\:Point,gml\\:LineString,gml\\:Polygon,gml\\:MultiPoint,gml\\:MultiLineString,gml\\:MultiPolygon,gml\\:Surface,gml\\:MultiSurface'
        );
        if (isGeomChild) continue;
        const val = gmlText(child);
        if (val) props[tag] = val;
      }

      features.push({ type: 'Feature', geometry, properties: props });
    }
  }

  if (!features.length) return null;
  return { type: 'FeatureCollection', features };
};

