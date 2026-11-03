import type {BookVisualStyle} from '../../../../data/travelBooks/schema/editorial';
import countries from '../../../../data/travelBooks/maps/countries.json';
import basemap from '../../../../data/travelBooks/maps/basemap.json';
import {escapeHtml} from '../../../pdf-export/utils/htmlUtils';
import {mapSymbolFor, mapSymbolSvg, SYMBOL_GROUP, SYMBOL_INK, type MapSymbol} from './mapSymbols';
import {placeMapLabels, mapLabelDistance as distance, MAP_LABEL_GAP_MM, MAP_DOT_RADIUS_MM, type MapRect} from './mapLabels';

type Country = 'BY' | 'PL';
type ProfileId = 'pocket-150x100' | 'album-a5';
type Position = {x: number; y: number};
type MapStop = {id: string; title?: string; lat: number; lng: number};
type MapBook = {kind?:'quests';visualStyle?:BookVisualStyle;country: Country; stops: readonly MapStop[]};
type MapSize = 'page' | 'compact';

export type ReadyBookMapMarker = Position & {
  stopId: string; ordinal: number; title: string; symbol: MapSymbol; label: Position;
};
export type ReadyBookMapCity = Position & {name: string; capital: boolean; anchor: 'start' | 'end'};
export type ReadyBookMapLabel = Position & {text: string; kind: 'country' | 'sea'};
export type ReadyBookEndMapModel = {
  country: Country; widthMm: number; heightMm: number; fontSizePt: number;
  labelRadiusMm: number; labelGapMm: number; outlinePaths: string[];
  landPaths: string[]; lakePaths: string[]; riverPaths: string[];
  cities: ReadyBookMapCity[]; labels: ReadyBookMapLabel[];
  scaleBar: {x: number; y: number; lengthMm: number; km: number};
  markers: ReadyBookMapMarker[];
};

// A whole page for the book's own map; `compact` leaves room for the quest volume's closing text.
const PROFILES = {
  page: {
    'pocket-150x100': {widthMm: 128, heightMm: 74, fontSizePt: 9, labelRadiusMm: 3.1},
    'album-a5': {widthMm: 124, heightMm: 150, fontSizePt: 10.5, labelRadiusMm: 3.6},
  },
  compact: {
    'pocket-150x100': {widthMm: 120, heightMm: 54, fontSizePt: 9, labelRadiusMm: 3.1},
    'album-a5': {widthMm: 118, heightMm: 130, fontSizePt: 10.5, labelRadiusMm: 3.6},
  },
} as const;
const LABEL_GAP_MM = MAP_LABEL_GAP_MM;
const DOT_RADIUS_MM = MAP_DOT_RADIUS_MM;
const RADIANS = Math.PI / 180;
const EARTH_KM = 6371;
const CITY_PT = 6.5, REGION_PT = 6;
const SCALE_BAR = {x: 3.5, width: 30, height: 8};
const REGIONAL_SHARE = .45;
const number = (value: number) => String(Number(value.toFixed(3)));
const mm = (pt: number) => pt * 25.4 / 72;
// Approximate advance of the book faces at a given size; only used to keep labels off city names.
const textWidth = (text: string, pt: number, tracking = 0) => text.length * (mm(pt) * .52 + tracking);

/** One north-up Mercator projection is used for the geographic outline and every stop. */
export function projectReadyBookMapCoordinate(lat: number, lng: number): Position {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    throw new Error('Book map requires finite WGS84 latitude/longitude');
  }
  const latitude = Math.max(-85.05112878, Math.min(85.05112878, lat));
  return {x: lng * RADIANS, y: -Math.log(Math.tan(Math.PI / 4 + latitude * RADIANS / 2))};
}

export function buildReadyBookEndMapModel(book: MapBook, profile: {id: ProfileId}, size: MapSize = 'page'): ReadyBookEndMapModel {
  const geometry = PROFILES[size]?.[profile.id];
  const feature = countries.features.find(item => item.properties.isoA2 === book.country);
  const context = basemap.countries[book.country];
  if (!geometry || !feature || !context || feature.geometry.type !== 'Polygon') throw new Error('Unsupported ready-book map country or profile');
  if (!book.stops.length || new Set(book.stops.map(stop => stop.id)).size !== book.stops.length || book.stops.some(stop => !stop.id.trim())) {
    throw new Error('Book map needs distinct selected places');
  }
  const project = ([lng, lat]: readonly number[]) => projectReadyBookMapCoordinate(lat, lng);
  const rings = feature.geometry.coordinates.map(ring => ring.map(project));
  const projected = book.stops.map(stop => projectReadyBookMapCoordinate(stop.lat, stop.lng));
  // A book whose places fill only a region of the country (the mountains in the south) gets a regional map.
  const span = (points: readonly Position[]) => {
    const xs = points.map(point => point.x), ys = points.map(point => point.y);
    return {minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys)};
  };
  const land = span(rings.flat()), places = span(projected);
  const regional = places.maxY - places.minY < (land.maxY - land.minY) * REGIONAL_SHARE && places.maxX - places.minX < (land.maxX - land.minX) * .8;
  // The region keeps at least that share of the country around its places, so a tight cluster still has room for numbers.
  const grow = (min: number, max: number, least: number) => {
    const size = Math.max((max - min) * 1.24, least), centre = (min + max) / 2;
    return [centre - size / 2, centre + size / 2];
  };
  const [regionMinX, regionMaxX] = grow(places.minX, places.maxX, (land.maxX - land.minX) * REGIONAL_SHARE);
  const [regionMinY, regionMaxY] = grow(places.minY, places.maxY, (land.maxY - land.minY) * REGIONAL_SHARE);
  const {minX, maxX, minY, maxY} = regional
    ? {minX: regionMinX, maxX: regionMaxX, minY: regionMinY, maxY: regionMaxY}
    : span([...rings.flat(), ...projected]);
  const padding = geometry.labelRadiusMm + 3;
  const scale = Math.min((geometry.widthMm - padding * 2) / (maxX - minX), (geometry.heightMm - padding * 2) / (maxY - minY));
  const offsetX = (geometry.widthMm - (maxX - minX) * scale) / 2;
  const offsetY = (geometry.heightMm - (maxY - minY) * scale) / 2;
  const fit = (point: Position): Position => ({x: offsetX + (point.x - minX) * scale, y: offsetY + (point.y - minY) * scale});
  const path = (points: readonly Position[], closed: boolean) => points.map((point, index) => {const p = fit(point); return `${index ? 'L' : 'M'}${number(p.x)},${number(p.y)}`;}).join('') + (closed ? 'Z' : '');
  const inside = (point: Position, inset = 0) => point.x >= inset && point.x <= geometry.widthMm - inset && point.y >= inset && point.y <= geometry.heightMm - inset;

  // The scale bar shows a round distance at the map's central latitude.
  const centreLat = (Math.atan(Math.sinh(-(minY + maxY) / 2)) / RADIANS);
  const mmPerKm = scale / (EARTH_KM * Math.cos(centreLat * RADIANS));
  const km = [25, 50, 100, 200].find(value => value * mmPerKm >= 10) ?? 200;
  const scaleBar = {x: SCALE_BAR.x, y: geometry.heightMm - 3.5, lengthMm: km * mmPerKm, km};
  const reserved: MapRect[] = [{x: 0, y: geometry.heightMm - SCALE_BAR.height, width: SCALE_BAR.width, height: SCALE_BAR.height}];

  const cityFont = mm(CITY_PT);
  const cities = context.cities.flatMap((city): ReadyBookMapCity[] => {
    const point = fit(projectReadyBookMapCoordinate(city.lat, city.lng));
    if (!inside(point, 2)) return [];
    const anchor = point.x + 1.4 + textWidth(city.name, CITY_PT) > geometry.widthMm - 2 ? 'end' : 'start';
    return [{...point, name: city.name, capital: city.capital, anchor}];
  });
  const cityRect = (city: ReadyBookMapCity): MapRect => {
    const width = textWidth(city.name, CITY_PT) + 1.6;
    return {x: city.anchor === 'start' ? city.x - 1 : city.x - width + 1, y: city.y - cityFont, width, height: cityFont * 1.4};
  };
  // The capital's name is never covered; other city names only cost a detour.
  reserved.push(...cities.filter(city => city.capital).map(cityRect));
  const avoid: MapRect[] = cities.filter(city => !city.capital).map(cityRect);
  const markers = book.stops.map((stop, index): ReadyBookMapMarker => ({
    ...fit(projected[index]), stopId: stop.id, ordinal: index + 1, title: stop.title ?? stop.id, symbol: mapSymbolFor(stop.id, book.kind), label: {x: 0, y: 0},
  }));
  placeMapLabels(markers, {...geometry, reserved, avoid});
  // Neighbour and sea names are decoration: one that would touch a number, a city or the compass is left out.
  const overlaps = (a: MapRect, b: MapRect) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
  const taken: MapRect[] = [...reserved, ...avoid, {x: geometry.widthMm - 13, y: 0, width: 13, height: 15},
    ...markers.flatMap(marker => [marker, marker.label].map(point => ({x: point.x - geometry.labelRadiusMm, y: point.y - geometry.labelRadiusMm, width: geometry.labelRadiusMm * 2, height: geometry.labelRadiusMm * 2})))];
  const labels = context.labels.flatMap((label): ReadyBookMapLabel[] => {
    const point = fit(projectReadyBookMapCoordinate(label.lat, label.lng));
    const half = textWidth(label.text, REGION_PT, label.kind === 'country' ? .45 : 0) / 2;
    const box = {x: point.x - half, y: point.y - mm(REGION_PT), width: half * 2, height: mm(REGION_PT) * 1.3};
    const clear = box.x > 2 && box.x + box.width < geometry.widthMm - 2 && box.y > 2 && box.y + box.height < geometry.heightMm - 2 && !taken.some(rect => overlaps(box, rect));
    return clear ? [{...point, text: label.text, kind: label.kind as ReadyBookMapLabel['kind']}] : [];
  });
  return {
    country: book.country, ...geometry, labelGapMm: LABEL_GAP_MM,
    outlinePaths: rings.map(ring => path(ring, true)),
    landPaths: context.land.flatMap(land => land.rings.map(ring => path(ring.map(project), true))),
    lakePaths: context.lakes.map(ring => path(ring.map(project), true)),
    riverPaths: context.rivers.flatMap(river => river.lines.map(line => path(line.map(project), false))),
    cities, labels, scaleBar, markers,
  };
}

// Old-atlas palette on parchment (#2968); marker inks tell heritage, nature, water and heights apart.
const PALETTE = {
  water: '#d3ded5', wave: '#9fbab2', land: '#f0e6cb', country: '#e6e2bb', countryEdge: '#6b5536', countryHalo: '#c8b67f',
  border: '#c4b38c', river: '#6c98a0', city: '#4a3c2a', region: '#9b8659', sea: '#5f8a8a',
  leader: '#6b5536', frame: '#6b5536', paper: '#fffefa', markerText: '#fffefa',
} as const;
const LIGHT = new Set<string>([PALETTE.water, PALETTE.land, PALETTE.country, PALETTE.countryHalo, PALETTE.markerText, PALETTE.paper]);

/** Physical millimetres prevent SVG scaling from silently shrinking its numbered text. */
export function renderReadyBookEndMap(book: MapBook, profile: {id: ProfileId}, size: MapSize = 'page'): string {
  const model = buildReadyBookEndMapModel(book, profile, size);
  // The graphic edition prints in two inks: light areas become paper, every line black.
  const graphic = book.visualStyle === 'graphic';
  const ink = (color: string) => graphic ? (LIGHT.has(color) ? '#fff' : '#111') : color;
  // A translucent veil over the wave hatching would print a third, grey tone in the two-ink edition.
  const veil = graphic ? '' : ' fill-opacity=".85"';
  const {widthMm: w, heightMm: h, fontSizePt, labelRadiusMm} = model;
  const fontMm = mm(fontSizePt);
  const id = `book-map-${book.country}`;
  const countryName = book.country === 'BY' ? 'Беларуси' : 'Польши';
  const title = book.kind === 'quests' ? `Квестов на карте ${countryName}: ${model.markers.length}` : `Места книги на карте ${countryName}: ${model.markers.length}`;
  const leaders = model.markers.filter(marker => distance(marker, marker.label) > .1);
  const outline = model.outlinePaths.join('');
  const compass = {x: w - 6.5, y: 8.2};
  // Eight-point star: cardinal tips at `r`, waist at `k`; the northern arm is inked.
  const star = (r: number, k: number) => Array.from({length: 8}, (_, i) => {
    const a = i * Math.PI / 4, radius = i % 2 ? k : r;
    return `${i ? 'L' : 'M'}${number(compass.x + Math.sin(a) * radius)},${number(compass.y - Math.cos(a) * radius)}`;
  }).join('') + 'Z';
  const {scaleBar: bar} = model;
  const half = bar.lengthMm / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" class="map" width="${w}mm" height="${h}mm" viewBox="0 0 ${w} ${h}" style="width:${w}mm;height:${h}mm;align-self:center;flex:none" role="img" aria-label="${book.kind==='quests'?'Квесты':'Места'} книги на карте ${countryName}" data-country="${book.country}" data-label-font-pt="${fontSizePt}"><title>${title}</title>`
    + `<defs><pattern id="${id}-waves" width="6" height="3.2" patternUnits="userSpaceOnUse"><path d="M.3 1.6c.9-.8 1.8.8 2.7 0s1.8.8 2.7 0" fill="none" stroke="${ink(PALETTE.wave)}" stroke-width=".14" stroke-linecap="round"/></pattern><clipPath id="${id}-frame"><rect width="${w}" height="${h}"/></clipPath><clipPath id="${id}-country"><path d="${outline}"/></clipPath></defs>`
    + `<g clip-path="url(#${id}-frame)"><rect width="${w}" height="${h}" fill="${ink(PALETTE.water)}"/><rect width="${w}" height="${h}" fill="url(#${id}-waves)"/>`
    + `<path d="${model.landPaths.join('')}" fill="${ink(PALETTE.land)}" stroke="${ink(PALETTE.border)}" stroke-width=".2" stroke-linejoin="round"/>`
    + `<path data-country-outline="${book.country}" d="${outline}" fill="${ink(PALETTE.country)}" fill-rule="evenodd"/>`
    + `<path d="${outline}" fill="none" stroke="${ink(PALETTE.countryHalo)}" stroke-width="2.2" stroke-opacity=".55" clip-path="url(#${id}-country)"/>`
    + `<path d="${model.lakePaths.join('')}" fill="${ink(PALETTE.water)}" stroke="${ink(PALETTE.river)}" stroke-width=".12"/>`
    + `<path d="${model.riverPaths.join('')}" fill="none" stroke="${ink(PALETTE.river)}" stroke-width=".3" stroke-linecap="round" stroke-linejoin="round"/>`
    + `<path d="${outline}" fill="none" stroke="${ink(PALETTE.countryEdge)}" stroke-width=".4" stroke-linejoin="round"/>`
    + model.labels.map(label => `<text x="${number(label.x)}" y="${number(label.y)}" text-anchor="middle" font-family="BookHand" font-size="${number(mm(REGION_PT))}" fill="${ink(label.kind === 'sea' ? PALETTE.sea : PALETTE.region)}"${label.kind === 'country' ? ' letter-spacing=".45"' : ' font-style="italic"'}>${escapeHtml(label.kind === 'country' ? label.text.toLocaleUpperCase('ru') : label.text)}</text>`).join('')
    + model.cities.map(city => `<g data-city="${escapeHtml(city.name)}">${city.capital ? `<circle cx="${number(city.x)}" cy="${number(city.y)}" r=".95" fill="${ink(PALETTE.paper)}" stroke="${ink(PALETTE.city)}" stroke-width=".25"/>` : ''}<circle cx="${number(city.x)}" cy="${number(city.y)}" r="${city.capital ? .45 : .55}" fill="${ink(PALETTE.city)}"/><text x="${number(city.x + (city.anchor === 'start' ? 1.4 : -1.4))}" y="${number(city.y + mm(CITY_PT) * .33)}" text-anchor="${city.anchor}" font-family="BookHand" font-size="${number(mm(CITY_PT))}" fill="${ink(PALETTE.city)}">${escapeHtml(city.name)}</text></g>`).join('')
    + leaders.map(marker => `<line x1="${number(marker.x)}" y1="${number(marker.y)}" x2="${number(marker.label.x)}" y2="${number(marker.label.y)}" stroke="${ink(PALETTE.leader)}" stroke-width=".18"/>`).join('')
    + model.markers.map(marker => `<circle data-stop-position="${escapeHtml(marker.stopId)}" cx="${number(marker.x)}" cy="${number(marker.y)}" r="${DOT_RADIUS_MM}" fill="${ink(SYMBOL_INK[SYMBOL_GROUP[marker.symbol]])}" stroke="${ink(PALETTE.paper)}" stroke-width=".15"/>`).join('')
    + model.markers.map(marker => {
      // Medallion: the kind of place above, the number below (9 / 10.5 pt as before).
      const {x, y} = marker.label, r = labelRadiusMm, color = ink(SYMBOL_INK[SYMBOL_GROUP[marker.symbol]]);
      return `<g data-stop-id="${escapeHtml(marker.stopId)}" data-ordinal="${marker.ordinal}" data-symbol="${marker.symbol}"><title>${marker.ordinal}. ${escapeHtml(marker.title)}</title><circle cx="${number(x)}" cy="${number(y)}" r="${r}" fill="${color}" stroke="${ink(PALETTE.paper)}" stroke-width=".35"/>${mapSymbolSvg(marker.symbol, x, y - r * .4, r * .8, ink(PALETTE.markerText))}<text x="${number(x)}" y="${number(y + r * .68)}" text-anchor="middle" font-size="${number(fontMm)}" font-family="BookHand" fill="${ink(PALETTE.markerText)}">${marker.ordinal}</text></g>`;
    }).join('')
    + `</g>`
    + `<g aria-label="Север"><circle cx="${number(compass.x)}" cy="${number(compass.y)}" r="4.6" fill="${ink(PALETTE.paper)}"${veil}/><path d="${star(4, .9)}" fill="${ink(PALETTE.paper)}" stroke="${ink(PALETTE.frame)}" stroke-width=".18" stroke-linejoin="round"/><path d="M${number(compass.x)},${number(compass.y - 4)}L${number(compass.x + .9)},${number(compass.y - .9)}L${number(compass.x)},${number(compass.y)}L${number(compass.x - .9)},${number(compass.y - .9)}Z" fill="${ink(PALETTE.frame)}"/><text x="${number(compass.x)}" y="${number(compass.y - 4.6)}" text-anchor="middle" font-family="BookHand" font-size="${number(mm(REGION_PT))}" fill="${ink(PALETTE.frame)}">С</text></g>`
    + `<g aria-label="Масштаб"><rect x="${number(bar.x - 1.5)}" y="${number(bar.y - 4.2)}" width="${number(bar.lengthMm + 9)}" height="5.6" fill="${ink(PALETTE.paper)}"${veil}/><rect x="${number(bar.x)}" y="${number(bar.y - .8)}" width="${number(half)}" height=".8" fill="${ink(PALETTE.frame)}"/><rect x="${number(bar.x + half)}" y="${number(bar.y - .8)}" width="${number(half)}" height=".8" fill="${ink(PALETTE.paper)}" stroke="${ink(PALETTE.frame)}" stroke-width=".15"/>${[0, bar.km / 2, bar.km].map((value, index) => `<text x="${number(bar.x + half * index)}" y="${number(bar.y - 1.6)}" text-anchor="middle" font-family="BookHand" font-size="${number(mm(REGION_PT))}" fill="${ink(PALETTE.frame)}">${value}${index === 2 ? ' км' : ''}</text>`).join('')}</g>`
    + `<rect x=".2" y=".2" width="${number(w - .4)}" height="${number(h - .4)}" fill="none" stroke="${ink(PALETTE.frame)}" stroke-width=".4"/><rect x="1.1" y="1.1" width="${number(w - 2.2)}" height="${number(h - 2.2)}" fill="none" stroke="${ink(PALETTE.frame)}" stroke-width=".12"/></svg>`;
}
