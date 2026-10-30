export type StickerVariant = 'color' | 'no-background';
export type Sticker = {
  id: string; stopId?: string; label: string; kind: 'place' | 'date' | 'visit' | 'mood' | 'frame';
  xMm: number; yMm: number; widthMm: 35; heightMm: 35;
};
export type StickerSheet = {
  bookId: string; revision: string; locale: 'ru'; paper: 'A4'; variant: StickerVariant;
  page: number; safeMm: 10; scale: 1; rulerMm: 50; toleranceMm: 1;
  stickers: Sticker[];
};
type Book = {id: string; revision: string; stops: {id: string; title: string}[]};

const cell = (index: number) => ({xMm: 11.5 + (index % 5) * 38, yMm: 28 + Math.floor(index / 5) * 37, widthMm: 35 as const, heightMm: 35 as const});

/** Two independent, single-sided A4 sheets; never a stock-label template. */
export function buildStickerSheets(book: Book, variant: StickerVariant): StickerSheet[] {
  if (!book.id || !book.revision || !['color', 'no-background'].includes(variant)) throw new Error('Sticker identity and variant are required');
  if (book.stops.length < 30 || book.stops.length > 35) throw new Error('A single 35 mm place sheet supports 30–35 places; add a new sheet before expanding composition');
  if (new Set(book.stops.map(stop => stop.id)).size !== book.stops.length || book.stops.some(stop => !stop.id || !stop.title.trim())) throw new Error('Every selected place must have one unique named sticker');
  const common = {bookId: book.id, revision: book.revision, locale: 'ru' as const, paper: 'A4' as const, variant, safeMm: 10 as const, scale: 1 as const, rulerMm: 50 as const, toleranceMm: 1 as const};
  const place = book.stops.map((stop, index) => ({id: `place-${stop.id}`, stopId: stop.id, label: stop.title, kind: 'place' as const, ...cell(index)}));
  const memories: Sticker[] = Array.from({length: 30}, (_, index) => {
    const kinds = ['date', 'visit', 'mood', 'frame', 'visit'] as const;
    const kind = kinds[index % kinds.length];
    const labels = {date: 'Дата', visit: index % 2 ? 'Был здесь' : 'Вернусь', mood: ['Радость', 'Спокойствие', 'Открытие', 'Приключение', 'Вдохновение', 'Восторг'][Math.floor(index / 5)], frame: 'Кадр дня'};
    return {id: `memory-${index + 1}`, label: labels[kind], kind, ...cell(index)};
  });
  const sheets = [{...common, page: 1, stickers: place}, {...common, page: 2, stickers: memories}];
  validateStickerSheets(sheets, book.stops.map(stop => stop.id));
  return sheets;
}

export function validateStickerSheets(sheets: StickerSheet[], selectedStopIds: string[]): void {
  if (sheets.length !== 2 || sheets.some((sheet, index) => sheet.page !== index + 1 || sheet.safeMm !== 10 || sheet.rulerMm !== 50 || sheet.scale !== 1 || sheet.paper !== 'A4')) throw new Error('Expected two measured A4 sheets at 100%');
  if (sheets.some(sheet => sheet.bookId !== sheets[0].bookId || sheet.revision !== sheets[0].revision || sheet.variant !== sheets[0].variant || sheet.locale !== 'ru') || !['color', 'no-background'].includes(sheets[0].variant)) throw new Error('Sticker sheets must belong to one edition and variant');
  if (sheets[0].stickers.some(sticker => sticker.kind !== 'place' || !sticker.stopId) || sheets[1].stickers.some(sticker => sticker.kind === 'place' || sticker.stopId)) throw new Error('Places and memory marks require separate sheets');
  const placeIds = sheets.flatMap(sheet => sheet.stickers.flatMap(sticker => sticker.stopId ? [sticker.stopId] : []));
  if (new Set(placeIds).size !== placeIds.length || placeIds.length !== selectedStopIds.length || selectedStopIds.some(id => !placeIds.includes(id))) throw new Error('Sticker composition differs from selected places');
  for (const sheet of sheets) {
    if (new Set(sheet.stickers.map(sticker => sticker.id)).size !== sheet.stickers.length) throw new Error('Duplicate sticker ID');
    sheet.stickers.forEach((sticker, index) => {
      if (![sticker.xMm, sticker.yMm, sticker.widthMm, sticker.heightMm].every(Number.isFinite) || sticker.widthMm !== 35 || sticker.heightMm !== 35 || sticker.xMm < 10 || sticker.yMm < 28 || sticker.xMm + sticker.widthMm > 200 || sticker.yMm + sticker.heightMm > 287) throw new Error('Sticker exceeds physical safe area');
      for (const other of sheet.stickers.slice(index + 1)) {
        if (sticker.xMm < other.xMm + other.widthMm && other.xMm < sticker.xMm + sticker.widthMm && sticker.yMm < other.yMm + other.heightMm && other.yMm < sticker.yMm + sticker.heightMm) throw new Error('Sticker cutting contours overlap');
      }
    });
  }
}
