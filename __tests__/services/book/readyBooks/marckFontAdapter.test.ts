/** @jest-environment node */
import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';
import * as oracleFontkit from '@cantoo/fontkit';
import {PDFDocument} from '@cantoo/pdf-lib';
import {createMarckFontkit} from '@/services/book/readyBooks/marckFontAdapter';
import profile from '@/data/travelBooks/assets/fonts/marckscript/profile.json';

const fontBytes = new Uint8Array(readFileSync('data/travelBooks/assets/fonts/marckscript/MarckScript-Regular.ttf'));
const cryptoDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
beforeAll(() => {
  // Node's real digest receives Node-owned bytes rather than the Jest VM's ArrayBuffer.
  Object.defineProperty(globalThis, 'crypto', {configurable: true, value: {subtle: {
    digest(algorithm: string, bytes: BufferSource) {
      const view = ArrayBuffer.isView(bytes) ? new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength) : new Uint8Array(bytes);
      return webcrypto.subtle.digest(algorithm, Buffer.from(Array.from(view)));
    },
  }}});
});
afterAll(() => {
  if (cryptoDescriptor) Object.defineProperty(globalThis, 'crypto', cryptoDescriptor);
  else Reflect.deleteProperty(globalThis, 'crypto');
});
function oracleFont() {
  const font = oracleFontkit.create(fontBytes);
  if (!('layout' in font)) throw new Error('Expected the approved single face');
  return font;
}
const box = (value: {minX: number; minY: number; maxX: number; maxY: number}) => [value.minX, value.minY, value.maxX, value.maxY];
const samples = ['Хорошо, когда есть куда вернуться.', 'Беларусь — Іўе, успаміны', 'Київ, ґанак і подорож', 'Łódź, źródło, Żywiec', 'Our memories, office and flowers', 'Cafe\u0301 — «успаміны»'];

it('binds all445 exact glyph metrics and cmap/descriptor flags to the full approved TTF', async () => {
  const oracle = oracleFont();
  const actual = (await createMarckFontkit(fontBytes)).create(fontBytes);
  expect(profile.fontSha256).toBe('504de8cc6f919163bc9afb67b9bc208d258230c5e8d00cb82ec52474f9fafc3b');
  expect(profile.glyphs).toHaveLength(oracle.numGlyphs);
  for (const [id, record] of profile.glyphs.entries()) {
    const glyph = oracle.getGlyph(id);
    expect(record).toEqual([glyph.advanceWidth, ...box(glyph.bbox)]);
  }
  expect(actual.characterSet).toEqual(oracle.characterSet);
  for (const codePoint of actual.characterSet) {
    const expected = oracle.glyphForCodePoint(codePoint), glyph = actual.glyphForCodePoint(codePoint);
    expect({id: glyph.id, advanceWidth: glyph.advanceWidth, bbox: box(glyph.bbox)}).toEqual({id: expected.id, advanceWidth: expected.advanceWidth, bbox: box(expected.bbox)});
  }
  for (const key of ['postscriptName', 'unitsPerEm', 'ascent', 'descent', 'italicAngle', 'capHeight', 'xHeight'] as const) expect(actual[key]).toBe(oracle[key]);
  expect(box(actual.bbox)).toEqual(box(oracle.bbox));
  expect(actual['OS/2']?.sFamilyClass).toBe(Reflect.get(oracle, 'OS/2').sFamilyClass);
  expect(actual.head?.macStyle?.italic).toBe(Reflect.get(oracle, 'head').macStyle.italic);
  expect(actual.post?.isFixedPitch).toBe(Reflect.get(oracle, 'post').isFixedPitch);
  expect(Reflect.get(oracle, 'GSUB').featureList).toHaveLength(0);
  expect(Reflect.get(oracle, 'GSUB').lookupList).toHaveLength(0);
});

it('needs no substitution for any accepted code point, including cmap aliases', async () => {
  const adapter = await createMarckFontkit(fontBytes);
  for (const [codePoint] of profile.cmap) {
    const text = String.fromCodePoint(codePoint);
    expect(adapter.create(fontBytes).layout(text).glyphs.map(glyph => glyph.id)).toEqual(oracleFont().layout(text).glyphs.map(glyph => glyph.id));
  }
});

it.each(samples)('preserves exact glyph IDs, aliases and ink metrics for %s', async input => {
  const text = input.normalize('NFC'), oracle = oracleFont();
  const adapter = await createMarckFontkit(fontBytes);
  const actual = adapter.create(fontBytes);
  const describeGlyph = (glyph: {id: number; codePoints: number[]; advanceWidth: number; bbox: {minX: number; minY: number; maxX: number; maxY: number}}) => ({id: glyph.id, codePoints: glyph.codePoints, advanceWidth: glyph.advanceWidth, bbox: box(glyph.bbox)});
  expect(actual.layout(text).glyphs.map(describeGlyph)).toEqual(oracle.layout(text).glyphs.map(describeGlyph));
  // Fontkit retains the first Unicode alias used for a glyph ID, and new faces reset that cache.
  for (const codePoint of actual.characterSet) expect(actual.glyphForCodePoint(codePoint).codePoints).toEqual(oracle.glyphForCodePoint(codePoint).codePoints);
  expect(adapter.create(fontBytes).glyphForCodePoint(160).codePoints).toEqual(oracleFont().glyphForCodePoint(160).codePoints);
});

it.each(samples)('produces identical full-font PDF bytes to the decoder for %s', async input => {
  const template = await PDFDocument.create();
  template.addPage([420, 595]);
  const templateBytes = await template.save({useObjectStreams: false});
  const adapter = await createMarckFontkit(fontBytes);
  const stamp = async (fontkit: Parameters<PDFDocument['registerFontkit']>[0]) => {
    const document = await PDFDocument.load(templateBytes, {updateMetadata: false});
    document.registerFontkit(fontkit);
    const font = await document.embedFont(fontBytes, {subset: false});
    document.getPage(0).drawText(input.normalize('NFC'), {font, x: 20, y: 200, size: 24});
    return document.save({useObjectStreams: false, addDefaultPage: false, updateFieldAppearances: false});
  };
  expect(await stamp(adapter)).toEqual(await stamp(oracleFontkit));
});

it('rejects changed font bytes/faces and does not decode or subset another font', async () => {
  const altered = fontBytes.slice(); altered[altered.length - 1] ^= 1;
  await expect(createMarckFontkit(altered)).rejects.toThrow('Unsupported Marck Script font bytes');
  await expect(createMarckFontkit(new Uint8Array([0, 1, 0, 0]))).rejects.toThrow('Unsupported Marck Script font bytes');
  const adapter = await createMarckFontkit(fontBytes);
  expect(() => adapter.create(altered)).toThrow('Unsupported Marck Script font bytes');
  expect(() => adapter.create(fontBytes, 'OtherFont')).toThrow('Unsupported Marck Script font bytes');
  expect(() => adapter.create(fontBytes).createSubset()).toThrow('embedded in full');
});
