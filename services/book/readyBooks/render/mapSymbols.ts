import symbolTable from '../../../../data/travelBooks/maps/symbols.json';

export type MapSymbol = 'castle' | 'ruins' | 'palace' | 'park' | 'nature' | 'trail' | 'lake' | 'spring' | 'waterfall'
  | 'peak' | 'tower' | 'cave' | 'shelter' | 'quest' | 'place';

const table: Record<string, MapSymbol | undefined> = symbolTable.symbols as Record<string, MapSymbol>;

/** Kind of place for a printed stop (#2968); quest volumes mark the start of each quest. */
export function mapSymbolFor(stopId: string, kind?: 'quests'): MapSymbol {
  return kind === 'quests' ? 'quest' : table[stopId] ?? 'place';
}

// Four map inks: heritage, nature, water, heights. The quest flag shares the heritage ink.
export const SYMBOL_INK = {heritage: '#8a4b2f', nature: '#4e6b35', water: '#2f6f80', heights: '#6b5a86'} as const;
export const SYMBOL_GROUP: Record<MapSymbol, 'heritage' | 'nature' | 'water' | 'heights'> = {
  castle: 'heritage', ruins: 'heritage', palace: 'heritage', quest: 'heritage', place: 'heritage',
  park: 'nature', nature: 'nature', trail: 'nature', cave: 'nature',
  lake: 'water', spring: 'water', waterfall: 'water',
  peak: 'heights', tower: 'heights', shelter: 'heights',
};

export const SYMBOL_NAME: Record<MapSymbol, string> = {
  castle: 'Замок', ruins: 'Руины', palace: 'Дворец, усадьба', park: 'Парк', nature: 'Заповедная природа', trail: 'Тропа',
  lake: 'Озеро, река', spring: 'Родник', waterfall: 'Водопад', peak: 'Вершина', tower: 'Смотровая башня',
  cave: 'Пещера', shelter: 'Горный приют', quest: 'Квест', place: 'Место',
};

// Pictograms in a 10×10 box centred on (5, 5); drawn in one ink, filled shapes plus a few strokes.
const GLYPH: Record<MapSymbol, {fill?: string; stroke?: string}> = {
  castle: {fill: 'M1.6 9.2V3.4h1.3v1.1h1V3.4h1.3v1.1h1V3.4h1.3v1.1h1V3.4h1.3v5.8H6.1V7.1a1.1 1.1 0 0 0-2.2 0v2.1z'},
  ruins: {fill: 'M1.2 9.2V4.6l1-.8V2.6l1.2.9v1.6l1-.6v5.1zM5.6 9.2V6.4l1.1-.7.7 1 .8-.6 1 1.2v1.9z'},
  palace: {fill: 'M5 1.4 9.4 4.2H.6zM1.4 4.9h7.2v.6H1.4zM1.8 5.9h1v2.8h-1zM4.5 5.9h1v2.8h-1zM7.2 5.9h1v2.8h-1zM1 9h8v.7H1z'},
  park: {fill: 'M5 .9a3.1 3.1 0 0 0-3.1 3.1A2.7 2.7 0 0 0 4.4 6.7v2.6h1.2V6.7A2.7 2.7 0 0 0 8.1 4 3.1 3.1 0 0 0 5 .9z'},
  nature: {fill: 'M3.4 .9 1 5.1h1.4L.9 7.6h2v1.7h1V7.6h2L4.4 5.1h1.4zM7.2 3l-1.6 2.9h1L5.3 8h1.5v1.3h.8V8h1.5L7.8 5.9h1z'},
  trail: {stroke: 'M1.4 8.8c1.6-.4 2.1-1.8 3.4-2.3S7.4 5.2 7.9 3.4', fill: 'M7.2 .8h.7v3h-.7zM7.9.9h1.9l-.6.8.6.8H7.9z'},
  lake: {stroke: 'M1 3.6c1-.8 1.8.8 2.7 0s1.7.8 2.6 0 1.8.8 2.7 0M1 5.9c1-.8 1.8.8 2.7 0s1.7.8 2.6 0 1.8.8 2.7 0M1 8.2c1-.8 1.8.8 2.7 0s1.7.8 2.6 0 1.8.8 2.7 0'},
  spring: {fill: 'M5 .9C3.6 3.2 2.3 4.8 2.3 6.5a2.7 2.7 0 0 0 5.4 0C7.7 4.8 6.4 3.2 5 .9z'},
  waterfall: {fill: 'M1 1.2h8v1.4H1z', stroke: 'M3.2 3.2v4.4M5 3.2v5.2M6.8 3.2v4.4M1.6 9.1h6.8'},
  peak: {fill: 'M.6 9.1 3.9 2.6l1.9 3.1 1-1.5 2.6 4.9zM3.9 2.6l-.9 1.8.9-.4.9.4z'},
  tower: {fill: 'M3.7 1h2.6l.7 1.6H3zM3.5 3.1h3l-.6 6.1H4.1z'},
  cave: {fill: 'M.8 9.1C.8 4.7 2.7 2 5 2s4.2 2.7 4.2 7.1H6.6c0-2.2-.7-3.7-1.6-3.7s-1.6 1.5-1.6 3.7z'},
  shelter: {fill: 'M.8 5.2 5 1.4l4.2 3.8H8.2v4H6V6.7H4v2.5H1.8v-4z'},
  quest: {fill: 'M2.6 .8h.9v8.6h-.9zM3.5 1.2h5.2L7.3 3.1l1.4 1.9H3.5z'},
  place: {fill: 'M5 2.2a2.8 2.8 0 1 0 0 5.6 2.8 2.8 0 0 0 0-5.6z'},
};

/** Inline legend badge for lists: the map medallion without its number; the graphic edition prints it in its two inks. */
export function mapSymbolBadge(symbol: MapSymbol, sizeMm: number, graphic = false): string {
  const disc = graphic ? '#111' : SYMBOL_INK[SYMBOL_GROUP[symbol]], glyph = graphic ? '#fff' : '#fffefa';
  return `<svg class="map-symbol" viewBox="0 0 10 10" width="${sizeMm}mm" height="${sizeMm}mm" style="vertical-align:-.25em" role="img" aria-label="${SYMBOL_NAME[symbol]}"><circle cx="5" cy="5" r="4.8" fill="${disc}"/>${mapSymbolSvg(symbol, 5, 5, 6.4, glyph)}</svg>`;
}

/** The pictogram scaled to `size` mm and centred on (x, y). */
export function mapSymbolSvg(symbol: MapSymbol, x: number, y: number, size: number, color: string): string {
  const glyph = GLYPH[symbol];
  const scale = size / 10;
  const transform = `translate(${(x - size / 2).toFixed(3)} ${(y - size / 2).toFixed(3)}) scale(${scale.toFixed(4)})`;
  return `<g transform="${transform}">${glyph.fill ? `<path d="${glyph.fill}" fill="${color}"/>` : ''}${glyph.stroke ? `<path d="${glyph.stroke}" fill="none" stroke="${color}" stroke-width=".9" stroke-linecap="round"/>` : ''}</g>`;
}
