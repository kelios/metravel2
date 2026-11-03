#!/usr/bin/env node
// Cut the end-of-book map layers for BY and PL from Natural Earth 5.1.1 (public domain, #2968).
// Usage: node scripts/books/extract-map-basemap.mjs [<dir with the downloaded ne_*.geojson>]
// Writes data/travelBooks/maps/{countries,basemap,source}.json; the renderer never reads the raw files.
import {createHash} from 'node:crypto';
import {readFileSync, writeFileSync} from 'node:fs';
import path from 'node:path';

const input = process.argv[2] ?? '.codex-temp/books-map-ne';
const RELEASE = 'v5.1.1';
const LAYERS = {
  countries: 'ne_50m_admin_0_countries',
  rivers: 'ne_10m_rivers_lake_centerlines',
  lakes: 'ne_10m_lakes',
};
const ROUND = 1e4;
// Context window around each country, degrees: wide enough for any page aspect the renderer fits.
const MARGIN = {lng: 5.5, lat: 2.4};
// Douglas–Peucker tolerance for context layers, degrees (~300 m): far below a printed 0.3 mm line.
const TOLERANCE = .003;
const NEIGHBOURS = ['BY', 'PL', 'LT', 'LV', 'RU', 'UA', 'DE', 'CZ', 'SK', 'AT', 'HU', 'DK', 'SE'];
// Major rivers only: Natural Earth scalerank <= 8, the named rivers of the two countries and their borders.
const RIVER_MAX_RANK = 8;
const LAKE_MAX_RANK = 9;
const RIVER_NAMES_RU = {Dnipro: 'Днепр', Daugava: 'Западная Двина', Neman: 'Неман', Pripyat: 'Припять', Bug: 'Буг', Vistula: 'Висла', Oder: 'Одра', Warta: 'Варта', Neris: 'Вилия', Desna: 'Десна', Mukhavyets: 'Мухавец', Dniester: 'Днестр', Elbe: 'Эльба', Morava: 'Морава', Velikaya: 'Великая'};
const RIVER_NAMED = new Set(Object.keys(RIVER_NAMES_RU));
// Regional centres; coordinates are the city centres (OpenStreetMap), names as printed in the books.
const CITIES = {
  BY: [['Минск', 53.9023, 27.5619, true], ['Брест', 52.0976, 23.7341], ['Гродно', 53.6694, 23.8131], ['Витебск', 55.1904, 30.2049], ['Могилёв', 53.9007, 30.3314], ['Гомель', 52.4412, 30.9878]],
  PL: [['Варшава', 52.2297, 21.0122, true], ['Краков', 50.0647, 19.945], ['Гданьск', 54.352, 18.6466], ['Вроцлав', 51.1079, 17.0385], ['Познань', 52.4064, 16.9252], ['Щецин', 53.4285, 14.5528], ['Люблин', 51.2465, 22.5684], ['Белосток', 53.1325, 23.1688], ['Лодзь', 51.7592, 19.456], ['Жешув', 50.0412, 21.9991]],
};
// Neighbour and sea names sit on their own land/water near the border; the renderer drops any outside the page frame.
const LABELS = {
  BY: [['Литва', 55.15, 24.6, 'country'], ['Латвия', 56.45, 26.6, 'country'], ['Россия', 54.9, 33.6, 'country'], ['Украина', 51.15, 26.4, 'country'], ['Польша', 52.6, 22.0, 'country']],
  PL: [['Германия', 52.2, 12.9, 'country'], ['Чехия', 50.15, 14.6, 'country'], ['Словакия', 48.95, 21.6, 'country'], ['Украина', 49.6, 25.1, 'country'], ['Беларусь', 52.5, 25.6, 'country'], ['Литва', 54.75, 23.9, 'country'], ['Россия', 54.85, 21.1, 'country'], ['Балтийское море', 55.15, 16.7, 'sea']],
};

function simplify(points) {
  if (points.length < 3) return points;
  const [a, b] = [points[0], points.at(-1)];
  let index = 0, worst = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i], dx = b[0] - a[0], dy = b[1] - a[1], length = Math.hypot(dx, dy);
    const distance = length ? Math.abs(dy * p[0] - dx * p[1] + b[0] * a[1] - b[1] * a[0]) / length : Math.hypot(p[0] - a[0], p[1] - a[1]);
    if (distance > worst) {worst = distance; index = i;}
  }
  return worst > TOLERANCE ? [...simplify(points.slice(0, index + 1)).slice(0, -1), ...simplify(points.slice(index))] : [a, b];
}
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const round = value => Math.round(value * ROUND) / ROUND;
const read = name => {
  const bytes = readFileSync(path.join(input, `${name}.geojson`));
  return {bytes, data: JSON.parse(bytes.toString('utf8'))};
};
const polygons = geometry => geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.type === 'MultiPolygon' ? geometry.coordinates : [];
const lines = geometry => geometry.type === 'LineString' ? [geometry.coordinates] : geometry.type === 'MultiLineString' ? geometry.coordinates : [];

/** Sutherland–Hodgman against an axis-aligned window; the renderer clips to the page frame again. */
function clipRing(ring, box) {
  const edges = [
    [p => p[0] >= box.west, (a, b) => at(a, b, 0, box.west)],
    [p => p[0] <= box.east, (a, b) => at(a, b, 0, box.east)],
    [p => p[1] >= box.south, (a, b) => at(a, b, 1, box.south)],
    [p => p[1] <= box.north, (a, b) => at(a, b, 1, box.north)],
  ];
  let points = ring;
  for (const [inside, cross] of edges) {
    const next = [];
    for (let index = 0; index < points.length; index++) {
      const current = points[index], previous = points[(index + points.length - 1) % points.length];
      if (inside(current)) {
        if (!inside(previous)) next.push(cross(previous, current));
        next.push(current);
      } else if (inside(previous)) next.push(cross(previous, current));
    }
    points = next;
    if (!points.length) break;
  }
  const simple = simplify(points.map(([lng, lat]) => [round(lng), round(lat)]));
  return simple.length >= 3 ? simple : null;
}
function at(a, b, axis, value) {
  const t = (value - a[axis]) / (b[axis] - a[axis]);
  return axis === 0 ? [value, a[1] + t * (b[1] - a[1])] : [a[0] + t * (b[0] - a[0]), value];
}
/** Keep the runs of a line that touch the window, with one outside vertex at each end for continuity. */
function clipLine(line, box) {
  const inside = p => p[0] >= box.west && p[0] <= box.east && p[1] >= box.south && p[1] <= box.north;
  const runs = [];
  let run = [];
  for (let index = 0; index < line.length; index++) {
    const keep = inside(line[index]) || (index > 0 && inside(line[index - 1])) || (index < line.length - 1 && inside(line[index + 1]));
    if (keep) run.push([round(line[index][0]), round(line[index][1])]);
    else if (run.length) {runs.push(run); run = [];}
  }
  if (run.length) runs.push(run);
  return runs.map(simplify).filter(item => item.length >= 2);
}

const sources = Object.fromEntries(Object.entries(LAYERS).map(([key, name]) => [key, {name, ...read(name)}]));
const countryFeature = iso => sources.countries.data.features.find(feature => feature.properties.ISO_A2 === iso);
const countries = {type: 'FeatureCollection', features: ['BY', 'PL'].map(iso => {
  const feature = countryFeature(iso);
  if (feature?.geometry.type !== 'Polygon') throw new Error(`Natural Earth ${iso} is expected to be one polygon`);
  return {type: 'Feature', properties: {isoA2: iso, nameRu: iso === 'BY' ? 'Беларусь' : 'Польша'}, geometry: feature.geometry};
})};

const basemap = {schemaVersion: 1, countries: {}};
for (const iso of ['BY', 'PL']) {
  const ring = countryFeature(iso).geometry.coordinates[0];
  const lngs = ring.map(point => point[0]), lats = ring.map(point => point[1]);
  const box = {west: round(Math.min(...lngs) - MARGIN.lng), east: round(Math.max(...lngs) + MARGIN.lng), south: round(Math.min(...lats) - MARGIN.lat), north: round(Math.max(...lats) + MARGIN.lat)};
  const land = NEIGHBOURS.filter(code => code !== iso).flatMap(code => {
    const feature = countryFeature(code);
    if (!feature) throw new Error(`Missing Natural Earth country ${code}`);
    const rings = polygons(feature.geometry).map(polygon => clipRing(polygon[0], box)).filter(Boolean);
    return rings.length ? [{isoA2: code, rings}] : [];
  });
  const rivers = sources.rivers.data.features
    .filter(feature => feature.properties.featurecla === 'River' && Number(feature.properties.scalerank) <= RIVER_MAX_RANK && RIVER_NAMED.has(feature.properties.name))
    .flatMap(feature => {
      const runs = lines(feature.geometry).flatMap(line => clipLine(line, box));
      const name = feature.properties.name;
      return runs.length ? [{name: RIVER_NAMES_RU[name] ?? name ?? '', lines: runs}] : [];
    });
  const lakes = sources.lakes.data.features
    .filter(feature => Number(feature.properties.scalerank) <= LAKE_MAX_RANK)
    .flatMap(feature => polygons(feature.geometry).map(polygon => clipRing(polygon[0], box)).filter(Boolean));
  basemap.countries[iso] = {
    window: box, land, rivers, lakes,
    cities: CITIES[iso].map(([name, lat, lng, capital]) => ({name, lat, lng, capital: Boolean(capital)})),
    labels: LABELS[iso].map(([text, lat, lng, kind]) => ({text, lat, lng, kind})),
  };
}

const write = (file, value) => {
  const text = JSON.stringify(value) + '\n';
  writeFileSync(path.join('data/travelBooks/maps', file), text);
  return sha256(Buffer.from(text));
};
const countriesSha = write('countries.json', countries);
const basemapSha = write('basemap.json', basemap);
const base = `https://raw.githubusercontent.com/nvkelso/natural-earth-vector/${RELEASE}/geojson/`;
writeFileSync('data/travelBooks/maps/source.json', JSON.stringify({
  schemaVersion: 2,
  dataset: 'Natural Earth',
  version: RELEASE.slice(1),
  coordinateReferenceSystem: 'WGS84 longitude/latitude (EPSG:4326)',
  termsUrl: 'https://www.naturalearthdata.com/about/terms-of-use/',
  license: 'Public domain',
  attributionRequired: false,
  checkedAt: '2026-11-03',
  layers: Object.fromEntries(Object.entries(sources).map(([key, source]) => [key, {name: source.name, sourceUrl: `${base}${source.name}.geojson`, upstreamSha256: sha256(source.bytes)}])),
  extraction: 'scripts/books/extract-map-basemap.mjs: BY and PL outlines unchanged (1:50m); neighbours, named major rivers (scalerank <= 8) and lakes (scalerank <= 9) clipped to a window around each country; Russian names and regional centres added editorially.',
  countries: ['BY', 'PL'],
  extractedSha256: countriesSha,
  basemapSha256: basemapSha,
}, null, 2) + '\n');
console.log(JSON.stringify({countriesSha, basemapSha, bytes: Object.fromEntries(Object.entries(basemap.countries).map(([iso, item]) => [iso, JSON.stringify(item).length]))}));
