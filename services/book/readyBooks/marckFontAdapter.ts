import type {PDFDocument} from '@cantoo/pdf-lib';
import profile from '../../../data/travelBooks/assets/fonts/marckscript/profile.json';

type Fontkit = Parameters<PDFDocument['registerFontkit']>[0];
type Font = Extract<Awaited<ReturnType<Fontkit['create']>>, {layout: unknown}>;
type Glyph = ReturnType<Font['layout']>['glyphs'][number];
type BoundingBox = Font['bbox'];
type TypeFeatures = NonNullable<Parameters<Font['layout']>[1]>;

export type CoverGlyph = Glyph & {bbox: BoundingBox};
export type CoverFont = Omit<Font, 'glyphForCodePoint' | 'layout'> & {
  glyphForCodePoint(codePoint: number): CoverGlyph;
  layout(text: string, features?: TypeFeatures | string[]): {glyphs: CoverGlyph[]};
};
export interface MarckFontkit extends Fontkit {
  create(bytes: Uint8Array, postscriptName?: string): CoverFont;
}

const boundingBox = (values: number[]): BoundingBox => ({
  minX: values[0], minY: values[1], maxX: values[2], maxY: values[3],
  width: values[2] - values[0], height: values[3] - values[1],
});
const invalidFont = () => new Error('Unsupported Marck Script font bytes');

/** Exact metrics for the SHA-bound, GSUB-free face; the original full TTF is embedded. */
export async function createMarckFontkit(bytes: Uint8Array): Promise<MarckFontkit> {
  if (bytes.length !== profile.bytes || !globalThis.crypto?.subtle) throw invalidFont();
  const verifiedBytes = new Uint8Array(bytes);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', verifiedBytes);
  const sha = Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, '0')).join('');
  if (sha !== profile.fontSha256) throw invalidFont();
  const cmap = new Map(profile.cmap.map(([codePoint, glyphId]) => [codePoint, glyphId]));

  return {
    create(fontBytes, postscriptName) {
      if ((postscriptName && postscriptName !== profile.postscriptName) || fontBytes.length !== verifiedBytes.length ||
          fontBytes.some((value, index) => value !== verifiedBytes[index])) throw invalidFont();
      // Fontkit caches glyphs by ID. Preserve first-use codePoints for aliases and ToUnicode.
      const glyphCache = new Map<number, CoverGlyph>();
      const glyphForCodePoint = (codePoint: number): CoverGlyph => {
        const id = cmap.get(codePoint) ?? 0;
        let glyph = glyphCache.get(id);
        if (!glyph) {
          const [advanceWidth, ...bounds] = profile.glyphs[id];
          glyph = {id, codePoints: [codePoint], advanceWidth, bbox: boundingBox(bounds)};
          glyphCache.set(id, glyph);
        }
        return glyph;
      };
      return {
        postscriptName: profile.postscriptName, unitsPerEm: profile.unitsPerEm,
        ascent: profile.ascent, descent: profile.descent, italicAngle: profile.italicAngle,
        capHeight: profile.capHeight, xHeight: profile.xHeight, bbox: boundingBox(profile.bbox),
        'OS/2': {sFamilyClass: profile.familyClass}, head: {macStyle: {italic: profile.italic}},
        post: {isFixedPitch: profile.fixedPitch}, characterSet: profile.cmap.map(([codePoint]) => codePoint),
        glyphForCodePoint,
        layout(text) { return {glyphs: Array.from(text, character => glyphForCodePoint(character.codePointAt(0)!))}; },
        createSubset() { throw new Error('Marck cover fonts must be embedded in full'); },
      };
    },
  };
}
