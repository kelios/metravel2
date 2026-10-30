import type {Font} from '@cantoo/fontkit';

export type CoverTextRegion = {
  pageIndex: 0;
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
  maxFontSizePt: number;
  minFontSizePt: number;
  lineHeight: number;
  colorHex: string;
};

export type CoverTextErrorCode =
  | 'COVER_TEXT_EMPTY' | 'COVER_TEXT_TOO_LONG' | 'COVER_UNSUPPORTED_GLYPH'
  | 'COVER_TEXT_OVERFLOW' | 'COVER_TEMPLATE_INVALID' | 'COVER_FONT_INVALID';

export class CoverTextError extends Error {
  constructor(readonly code: CoverTextErrorCode) {
    super(code);
    this.name = 'CoverTextError';
  }
}

export function normalizeCoverText(text: string, maxCharacters: number): string {
  const normalized = text.normalize('NFC').trim();
  if (!normalized) throw new CoverTextError('COVER_TEXT_EMPTY');
  if (!Number.isInteger(maxCharacters) || maxCharacters < 1 || maxCharacters > 120 || Array.from(normalized).length > maxCharacters) {
    throw new CoverTextError('COVER_TEXT_TOO_LONG');
  }
  return normalized;
}

const mmToPt = (value: number) => value * 72 / 25.4;
const finitePositive = (value: number) => Number.isFinite(value) && value > 0;
type Ink = {minX: number; maxX: number; minY: number; maxY: number};
type Line = {text: string; ink: Ink};

// Match the glyph advances that pdf-lib writes into the embedded font's W
// table. Fontkit positioning adjustments are not emitted by drawText's Tj.
function inkAtSize(font: Font, text: string, size: number): Ink {
  const scale = size / font.unitsPerEm;
  let advance = 0, minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const glyph of font.layout(text).glyphs) {
    if (glyph.id === 0) throw new CoverTextError('COVER_UNSUPPORTED_GLYPH');
    const box = glyph.bbox;
    if ([box.minX, box.maxX, box.minY, box.maxY].every(Number.isFinite) && box.maxX > box.minX && box.maxY > box.minY) {
      minX = Math.min(minX, advance + box.minX);
      maxX = Math.max(maxX, advance + box.maxX);
      minY = Math.min(minY, box.minY);
      maxY = Math.max(maxY, box.maxY);
    }
    advance += glyph.advanceWidth;
  }
  return minX === Infinity
    ? {minX: 0, maxX: 0, minY: 0, maxY: 0}
    : {minX: minX * scale, maxX: maxX * scale, minY: minY * scale, maxY: maxY * scale};
}

function layoutAtSize(font: Font, text: string, size: number, width: number, height: number, lineHeight: number) {
  const lines: Line[] = [];
  for (const paragraph of text.split(/\r\n?|\n/)) {
    if (!paragraph.trim()) {
      lines.push({text: '', ink: inkAtSize(font, '', size)});
      continue;
    }
    let current = '';
    for (const word of paragraph.trim().split(/\s+/u)) {
      const candidate = current ? `${current} ${word}` : word;
      const ink = inkAtSize(font, candidate, size);
      if (ink.maxX - ink.minX <= width) {
        current = candidate;
      } else {
        if (!current) return null;
        lines.push({text: current, ink: inkAtSize(font, current, size)});
        current = word;
        const wordInk = inkAtSize(font, word, size);
        if (wordInk.maxX - wordInk.minX > width) return null;
      }
    }
    lines.push({text: current, ink: inkAtSize(font, current, size)});
  }
  const minY = Math.min(...lines.map((line, index) => line.ink.minY - index * size * lineHeight));
  const maxY = Math.max(...lines.map((line, index) => line.ink.maxY - index * size * lineHeight));
  return maxY - minY <= height ? {lines, minY, maxY, size} : null;
}

export type PersonalizedCoverInput = {
  templateBytes: Uint8Array;
  fontBytes: Uint8Array;
  text: string;
  maxCharacters: number;
  textRegion: CoverTextRegion;
  expectedPageCount: number;
  widthMm: number;
  heightMm: number;
};

/** Shared server/browser engine. Only the explicit generation action loads PDF libraries. */
export async function createPersonalizedCoverPdf(input: PersonalizedCoverInput): Promise<Uint8Array> {
  const text = normalizeCoverText(input.text, input.maxCharacters);
  const region = input.textRegion;
  if (!finitePositive(input.widthMm) || !finitePositive(input.heightMm) || !Number.isInteger(input.expectedPageCount) || input.expectedPageCount < 1 ||
      region.pageIndex !== 0 || !Number.isFinite(region.xMm) || !Number.isFinite(region.yMm) || region.xMm < 0 || region.yMm < 0 ||
      !finitePositive(region.widthMm) || !finitePositive(region.heightMm) || region.xMm + region.widthMm > input.widthMm || region.yMm + region.heightMm > input.heightMm ||
      !finitePositive(region.minFontSizePt) || region.maxFontSizePt < region.minFontSizePt || !Number.isFinite(region.maxFontSizePt) || region.maxFontSizePt > 144 ||
      !Number.isFinite(region.lineHeight) || region.lineHeight < 1 || region.lineHeight > 3 || !/^#[a-f\d]{6}$/i.test(region.colorHex)) {
    throw new CoverTextError('COVER_TEMPLATE_INVALID');
  }
  const [{PDFDocument, rgb}, fontkit] = await Promise.all([import('@cantoo/pdf-lib'), import('@cantoo/fontkit')]);
  let pdf: import('@cantoo/pdf-lib').PDFDocument;
  try {
    pdf = await PDFDocument.load(input.templateBytes, {updateMetadata: false});
  } catch {
    throw new CoverTextError('COVER_TEMPLATE_INVALID');
  }
  const pages = pdf.getPages();
  if (pages.length !== input.expectedPageCount || pages.some(page => {
    const box = page.getMediaBox();
    return ![box.x,box.y,box.width,box.height].every(Number.isFinite) || Math.abs(box.width - mmToPt(input.widthMm)) > 0.1 || Math.abs(box.height - mmToPt(input.heightMm)) > 0.1;
  }) || pages[0].getRotation().angle % 360 !== 0) throw new CoverTextError('COVER_TEMPLATE_INVALID');
  let metrics: Font;
  try {
    const parsed = fontkit.create(input.fontBytes);
    if (!('layout' in parsed) || !finitePositive(parsed.unitsPerEm)) throw new Error('font');
    metrics = parsed;
  } catch {
    throw new CoverTextError('COVER_FONT_INVALID');
  }
  const supported = new Set(metrics.characterSet);
  if (Array.from(text).some(character => !/[\r\n\t]/.test(character) && !supported.has(character.codePointAt(0)!))) {
    throw new CoverTextError('COVER_UNSUPPORTED_GLYPH');
  }
  const width = mmToPt(region.widthMm), height = mmToPt(region.heightMm);
  let layout: ReturnType<typeof layoutAtSize> = null;
  for (let size = region.maxFontSizePt; ; size = Math.max(region.minFontSizePt, size - 0.25)) {
    layout = layoutAtSize(metrics, text, size, width, height, region.lineHeight);
    if (layout || size === region.minFontSizePt) break;
  }
  if (!layout) throw new CoverTextError('COVER_TEXT_OVERFLOW');
  pdf.registerFontkit(fontkit);
  const font = await pdf.embedFont(input.fontBytes, {subset: false});
  const page = pages[0], media = page.getMediaBox();
  const originX = media.x + mmToPt(region.xMm), originY = media.y + mmToPt(region.yMm);
  const baseline = originY + (height - (layout.maxY - layout.minY)) / 2 - layout.minY;
  const color = rgb(parseInt(region.colorHex.slice(1, 3), 16) / 255, parseInt(region.colorHex.slice(3, 5), 16) / 255, parseInt(region.colorHex.slice(5, 7), 16) / 255);
  for (const [index, line] of layout.lines.entries()) {
    if (!line.text) continue;
    page.drawText(line.text, {
      font, size: layout.size, color,
      x: originX + (width - (line.ink.maxX - line.ink.minX)) / 2 - line.ink.minX,
      y: baseline - index * layout.size * region.lineHeight,
    });
  }
  return pdf.save({useObjectStreams: false, addDefaultPage: false, updateFieldAppearances: false});
}
