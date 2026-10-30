#!/usr/bin/env node
// Compile the one approved full TTF; no universal font decoder is shipped to browsers.
import {createHash} from 'node:crypto';
import {readFile, writeFile} from 'node:fs/promises';
import {create} from '@cantoo/fontkit';

const fontPath = 'data/travelBooks/assets/fonts/marckscript/MarckScript-Regular.ttf';
const profilePath = 'data/travelBooks/assets/fonts/marckscript/profile.json';
const expectedSha256 = '504de8cc6f919163bc9afb67b9bc208d258230c5e8d00cb82ec52474f9fafc3b';
const args = process.argv.slice(2);
if (args.length > 1 || (args.length === 1 && args[0] !== '--check')) throw new Error('Use generate-marck-font-profile.mjs [--check]');
const bytes = await readFile(fontPath);
if (createHash('sha256').update(bytes).digest('hex') !== expectedSha256) throw new Error('Only the approved full Marck Script TTF can generate this profile');
const font = create(bytes);
if (!('layout' in font) || font.GSUB?.featureList?.length || font.GSUB?.lookupList?.length || font.cff) throw new Error('The cover profile requires the approved TrueType face without glyph substitution');
const box = value => [value.minX, value.minY, value.maxX, value.maxY];
const glyphs = Array.from({length: font.numGlyphs}, (_, id) => {
  const glyph = font.getGlyph(id);
  const record = [glyph.advanceWidth, ...box(glyph.bbox)];
  if (!record.every(Number.isFinite)) throw new Error(`Non-finite glyph metric: ${id}`);
  return record;
});
const cmap = font.characterSet.map(codePoint => [codePoint, font.glyphForCodePoint(codePoint).id]);
for (const [codePoint, glyphId] of cmap) {
  const face = create(bytes);
  const run = face.layout(String.fromCodePoint(codePoint)).glyphs;
  if (run.length !== 1 || run[0].id !== glyphId) throw new Error(`Unsupported cover glyph composition: ${codePoint}`);
}
const profile = {
  version: 1, fontSha256: expectedSha256, bytes: bytes.length,
  postscriptName: font.postscriptName, unitsPerEm: font.unitsPerEm,
  ascent: font.ascent, descent: font.descent, italicAngle: font.italicAngle,
  capHeight: font.capHeight, xHeight: font.xHeight, bbox: box(font.bbox),
  familyClass: font['OS/2'].sFamilyClass, italic: font.head.macStyle.italic,
  fixedPitch: font.post.isFixedPitch,
  // Glyph records are indexed by original glyph ID: advance, minX, minY, maxX, maxY.
  glyphs,
  cmap,
};
const output = JSON.stringify(profile) + '\n';
if (args[0] === '--check') {
  if (await readFile(profilePath, 'utf8') !== output) throw new Error('Marck Script profile differs; regenerate from the approved TTF');
} else {
  await writeFile(profilePath, output);
}
console.log(JSON.stringify({profilePath, bytes: Buffer.byteLength(output), glyphs: glyphs.length, characters: profile.cmap.length, check: args[0] === '--check'}));
