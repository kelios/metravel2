import {buildStickerSheets, validateStickerSheets} from '../../../../services/book/readyBooks/stickers';

const book = (count: number) => ({id: 'belarus-memory', revision: 'test-r1', stops: Array.from({length: count}, (_, index) => ({id: `point-${index}`, title: `Место ${index}`}))});

it.each([30, 31, 35])('prints each of %i selected places exactly once in both standalone variants', count => {
  const source = book(count);
  for (const variant of ['color', 'no-background'] as const) {
    const sheets = buildStickerSheets(source, variant);
    expect(sheets).toHaveLength(2);
    expect(sheets[0].stickers.map(sticker => sticker.stopId)).toEqual(source.stops.map(stop => stop.id));
    expect(sheets[1].stickers).toHaveLength(30);
    expect(sheets[1].stickers.every(sticker => !sticker.stopId)).toBe(true);
    expect(sheets.every(sheet => sheet.variant === variant && sheet.safeMm === 10 && sheet.scale === 1 && sheet.rulerMm === 50)).toBe(true);
    for (const sheet of sheets) for (const sticker of sheet.stickers) {
      expect(sticker.widthMm).toBe(35); expect(sticker.heightMm).toBe(35);
      expect(sticker.xMm).toBeGreaterThanOrEqual(10); expect(sticker.yMm + sticker.heightMm).toBeLessThanOrEqual(287);
    }
  }
});

it('refuses missing/duplicate places and an expanded composition that would leave the sheet', () => {
  expect(() => buildStickerSheets(book(29), 'color')).toThrow();
  expect(() => buildStickerSheets(book(36), 'color')).toThrow();
  const duplicate = book(31); duplicate.stops[1].id = duplicate.stops[0].id;
  expect(() => buildStickerSheets(duplicate, 'color')).toThrow('unique');
});

it('rejects omitted marks, changed print scaling, collisions and safe-area violations', () => {
  const source = book(31), ids = source.stops.map(stop => stop.id);
  for (const mutate of [
    (s: ReturnType<typeof buildStickerSheets>) => {s[0].stickers.pop();},
    (s: ReturnType<typeof buildStickerSheets>) => {s[0].scale = .9 as 1;},
    (s: ReturnType<typeof buildStickerSheets>) => {s[0].stickers[0].xMm = 0;},
    (s: ReturnType<typeof buildStickerSheets>) => {s[0].stickers[1].xMm = s[0].stickers[0].xMm;},
  ]) {
    const sheets = buildStickerSheets(source, 'color'); mutate(sheets);
    expect(() => validateStickerSheets(sheets, ids)).toThrow();
  }
});
