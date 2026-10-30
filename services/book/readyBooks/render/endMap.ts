import countries from '../../../../data/travelBooks/maps/countries.json';
import {escapeHtml} from '../../../pdf-export/utils/htmlUtils';

type Country = 'BY' | 'PL';
type ProfileId = 'pocket-150x100' | 'album-a5';
type Position = {x: number; y: number};
type MapStop = {id: string; title?: string; lat: number; lng: number};
type MapBook = {country: Country; stops: readonly MapStop[]};

export type ReadyBookMapMarker = Position & {
  stopId: string; ordinal: number; title: string; label: Position;
};
export type ReadyBookEndMapModel = {
  country: Country; widthMm: number; heightMm: number; fontSizePt: number;
  labelRadiusMm: number; labelGapMm: number; outlinePaths: string[];
  markers: ReadyBookMapMarker[];
};

const PROFILES = {
  'pocket-150x100': {widthMm: 120, heightMm: 54, fontSizePt: 9, labelRadiusMm: 2.4},
  'album-a5': {widthMm: 118, heightMm: 130, fontSizePt: 10.5, labelRadiusMm: 2.7},
} as const;
const LABEL_GAP_MM = .65;
const DOT_RADIUS_MM = .45;
const RADIANS = Math.PI / 180;
const number = (value: number) => String(Number(value.toFixed(3)));
const distance = (a: Position, b: Position) => Math.hypot(a.x - b.x, a.y - b.y);

/** One north-up Mercator projection is used for the geographic outline and every stop. */
export function projectReadyBookMapCoordinate(lat: number, lng: number): Position {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    throw new Error('Book map requires finite WGS84 latitude/longitude');
  }
  const latitude = Math.max(-85.05112878, Math.min(85.05112878, lat));
  return {x: lng * RADIANS, y: -Math.log(Math.tan(Math.PI / 4 + latitude * RADIANS / 2))};
}

function crosses(a: Position, b: Position, c: Position, d: Position): boolean {
  const side = (p: Position, q: Position, r: Position) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  return side(a, b, c) * side(a, b, d) < 0 && side(c, d, a) * side(c, d, b) < 0;
}

function findLabel(point: ReadyBookMapMarker, all: readonly ReadyBookMapMarker[], placed: readonly ReadyBookMapMarker[], geometry: typeof PROFILES[ProfileId]): Position {
  const {widthMm, heightMm, labelRadiusMm: radius} = geometry;
  const inset = radius + LABEL_GAP_MM;
  let best: Position | undefined, bestScore = Infinity;
  const step = (2 * radius + LABEL_GAP_MM) * .65;
  const limit = Math.hypot(widthMm, heightMm);
  for (let ring = 0; ring * step <= limit; ring++) {
    const count = ring === 0 ? 1 : 32;
    for (let slot = 0; slot < count; slot++) {
      const angle = slot / count * Math.PI * 2 - Math.PI / 2;
      const candidate = {x: point.x + Math.cos(angle) * ring * step, y: point.y + Math.sin(angle) * ring * step};
      if (candidate.x < inset || candidate.x > widthMm - inset || candidate.y < inset || candidate.y > heightMm - inset) continue;
      // Reserve the north arrow, other labels and the actual dots of nearby places.
      if (candidate.x + radius > widthMm - 12 && candidate.y - radius < 14) continue;
      if (placed.some(other => distance(candidate, other.label) < 2 * radius + LABEL_GAP_MM)) continue;
      if (all.some(other => other.stopId !== point.stopId && distance(candidate, other) < radius + DOT_RADIUS_MM + .2)) continue;
      const crossings = placed.filter(other => crosses(point, candidate, other, other.label)).length;
      const score = distance(point, candidate) + crossings * step * 2;
      if (score < bestScore) {best = candidate; bestScore = score;}
    }
    // A farther ring cannot improve a candidate with no crossing penalty.
    if (best && (ring + 1) * step > bestScore) break;
  }
  if (!best) throw new Error('Selected places need more map space to keep every numbered label readable');
  return best;
}

export function buildReadyBookEndMapModel(book: MapBook, profile: {id: ProfileId}): ReadyBookEndMapModel {
  const geometry = PROFILES[profile.id];
  const feature = countries.features.find(item => item.properties.isoA2 === book.country);
  if (!geometry || !feature || feature.geometry.type !== 'Polygon') throw new Error('Unsupported ready-book map country or profile');
  if (!book.stops.length || new Set(book.stops.map(stop => stop.id)).size !== book.stops.length || book.stops.some(stop => !stop.id.trim())) {
    throw new Error('Book map needs distinct selected places');
  }
  const rings = feature.geometry.coordinates.map(ring => ring.map(coordinate => projectReadyBookMapCoordinate(coordinate[1], coordinate[0])));
  const projected = book.stops.map(stop => projectReadyBookMapCoordinate(stop.lat, stop.lng));
  const extent = [...rings.flat(), ...projected];
  const xs = extent.map(point => point.x), ys = extent.map(point => point.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const padding = geometry.labelRadiusMm + 2;
  const scale = Math.min((geometry.widthMm - padding * 2) / (maxX - minX), (geometry.heightMm - padding * 2) / (maxY - minY));
  const offsetX = (geometry.widthMm - (maxX - minX) * scale) / 2;
  const offsetY = (geometry.heightMm - (maxY - minY) * scale) / 2;
  const fit = (point: Position): Position => ({x: offsetX + (point.x - minX) * scale, y: offsetY + (point.y - minY) * scale});
  const markers = book.stops.map((stop, index): ReadyBookMapMarker => ({
    ...fit(projected[index]), stopId: stop.id, ordinal: index + 1, title: stop.title ?? stop.id, label: {x: 0, y: 0},
  }));
  // Place the densest clusters first; ordinal breaks ties without changing book numbering.
  const priority = markers.map(marker => ({marker, nearest: Math.min(...markers.filter(other => other !== marker).map(other => distance(marker, other)))}))
    .sort((a, b) => a.nearest - b.nearest || a.marker.ordinal - b.marker.ordinal);
  const placed: ReadyBookMapMarker[] = [];
  for (const {marker} of priority) {marker.label = findLabel(marker, markers, placed, geometry); placed.push(marker);}
  return {
    country: book.country, ...geometry, labelGapMm: LABEL_GAP_MM,
    outlinePaths: rings.map(ring => ring.map((point, index) => {const p = fit(point); return `${index ? 'L' : 'M'}${number(p.x)},${number(p.y)}`;}).join('') + 'Z'),
    markers,
  };
}

/** Physical millimetres prevent SVG scaling from silently shrinking its numbered text. */
export function renderReadyBookEndMap(book: MapBook, profile: {id: ProfileId}): string {
  const model = buildReadyBookEndMapModel(book, profile);
  const {widthMm, heightMm, fontSizePt, labelRadiusMm} = model;
  const fontMm = fontSizePt * 25.4 / 72;
  const countryName = book.country === 'BY' ? 'Беларуси' : 'Польши';
  const leaders = model.markers.filter(marker => distance(marker, marker.label) > .1);
  return `<svg xmlns="http://www.w3.org/2000/svg" class="map" width="${widthMm}mm" height="${heightMm}mm" viewBox="0 0 ${widthMm} ${heightMm}" style="width:${widthMm}mm;height:${heightMm}mm;align-self:center;flex:none" role="img" aria-label="Места книги на карте ${countryName}" data-country="${book.country}" data-label-font-pt="${fontSizePt}"><title>Все ${model.markers.length} мест книги на карте ${countryName}</title><path data-country-outline="${book.country}" d="${model.outlinePaths.join('')}" fill="#edf0e7" fill-rule="evenodd" stroke="#b4c0ae" stroke-width=".25"/>${leaders.map(marker => `<line x1="${number(marker.x)}" y1="${number(marker.y)}" x2="${number(marker.label.x)}" y2="${number(marker.label.y)}" stroke="#71856d" stroke-width=".18"/>`).join('')}${model.markers.map(marker => `<circle data-stop-position="${escapeHtml(marker.stopId)}" cx="${number(marker.x)}" cy="${number(marker.y)}" r="${DOT_RADIUS_MM}" fill="#31443d"/>`).join('')}${model.markers.map(marker => `<g data-stop-id="${escapeHtml(marker.stopId)}" data-ordinal="${marker.ordinal}"><title>${marker.ordinal}. ${escapeHtml(marker.title)}</title><circle cx="${number(marker.label.x)}" cy="${number(marker.label.y)}" r="${labelRadiusMm}" fill="#fffefa" stroke="#4a6655" stroke-width=".25"/><text x="${number(marker.label.x)}" y="${number(marker.label.y + fontMm * .32)}" text-anchor="middle" font-size="${number(fontMm)}" font-family="BookHand">${marker.ordinal}</text></g>`).join('')}<g aria-label="Север" fill="#485f50" stroke="#485f50"><path d="M${widthMm - 7},12V5m-1.2,2L${widthMm - 7},5l1.2,2" fill="none" stroke-width=".25"/><text x="${widthMm - 7}" y="3.9" text-anchor="middle" font-family="BookHand" stroke="none" font-size="${number(fontMm)}">С</text></g></svg>`;
}
