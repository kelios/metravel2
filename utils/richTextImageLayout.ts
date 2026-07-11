/**
 * Justified magazine layout for rich text images.
 * Groups consecutive image paragraphs into full-width justified rows
 * (Flickr/Google-Photos style): images are packed into rows by the sum of
 * their aspect ratios, so any mix of portrait/landscape photos and any
 * group size produces rows that span the whole content column with a
 * pleasant height. Row aspect is emitted as a class bucket (not an inline
 * style) so the markup stays safe for saved drafts and native RNRH.
 */

const DEFAULT_ASPECT = 4 / 3;
// A row is "full" once the sum of aspect ratios crosses this threshold:
// two landscapes, landscape+portrait, or three portraits per row.
const ROW_ASPECT_TARGET = 1.9;
const MAX_IMAGES_PER_ROW = 3;
// Row aspect class buckets (`jrow-ar-100` … `jrow-ar-400`, step 0.25).
// CSS pre-generates a rule per bucket; the blur backdrop of
// .rich-image-frame absorbs the ±0.125 rounding error.
const ROW_ASPECT_MIN = 1;
const ROW_ASPECT_MAX = 4;
const ROW_ASPECT_STEP = 0.25;
// Below this aspect an image is an upright frame that must not be left
// alone in the trailing row (it would balloon to the column width).
const ORPHAN_ASPECT_LIMIT = 1.2;

function expandMultiImageOnlyParagraphs(html: string): string {
  if (!html || typeof html !== 'string') return html ?? '';

  return html.replace(/<p([^>]*)>([\s\S]*?)<\/p>/gi, (full, attrs = '', inner = '') => {
    const normalizedInner = String(inner || '').trim();
    if (!normalizedInner) return full;

    const withoutImagesAndBreaks = normalizedInner
      .replace(/<img\b[^>]*>/gi, '')
      .replace(/<br\s*\/?>/gi, '')
      .replace(/&nbsp;/gi, ' ')
      .replace(/\s+/g, '')
      .trim();

    if (withoutImagesAndBreaks.length > 0) return full;

    const images = normalizedInner.match(/<img\b[^>]*>\s*(?:<br\s*\/?>\s*)*/gi) ?? [];
    if (images.length <= 1) return full;

    return images.map((img) => `<p${attrs}>${img.trim()}</p>`).join('');
  });
}

/**
 * Extracts width and height from an img tag.
 * Returns { width, height } or null if not found.
 */
function extractImageDimensions(imgTag: string): { width: number; height: number } | null {
  const widthMatch = imgTag.match(/\bwidth="(\d+)"/i);
  const heightMatch = imgTag.match(/\bheight="(\d+)"/i);
  if (widthMatch && heightMatch) {
    return { width: parseInt(widthMatch[1], 10), height: parseInt(heightMatch[1], 10) };
  }
  // Try to extract from aspect-ratio in style
  const aspectMatch = imgTag.match(/aspect-ratio:\s*(\d+)\s*\/\s*(\d+)/i);
  if (aspectMatch) {
    return { width: parseInt(aspectMatch[1], 10), height: parseInt(aspectMatch[2], 10) };
  }
  return null;
}

function imageAspect(imgParagraph: string): number {
  const dims = extractImageDimensions(imgParagraph);
  if (!dims || dims.width <= 0 || dims.height <= 0) return DEFAULT_ASPECT;
  return dims.width / dims.height;
}

function rowAspectClass(aspectSum: number): string {
  const clamped = Math.min(ROW_ASPECT_MAX, Math.max(ROW_ASPECT_MIN, aspectSum));
  const bucket = Math.round(clamped / ROW_ASPECT_STEP) * ROW_ASPECT_STEP;
  return `jrow-ar-${Math.round(bucket * 100)}`;
}

/**
 * Packs image indices into justified rows: a row closes once its aspect
 * sum reaches ROW_ASPECT_TARGET or it holds MAX_IMAGES_PER_ROW images.
 * A lone trailing portrait steals a neighbour from the previous row so it
 * never renders as a giant single upright frame.
 */
function packJustifiedRows(aspects: number[]): number[][] {
  const rows: number[][] = [];
  let row: number[] = [];
  let aspectSum = 0;

  aspects.forEach((aspect, index) => {
    row.push(index);
    aspectSum += aspect;
    if (aspectSum >= ROW_ASPECT_TARGET || row.length === MAX_IMAGES_PER_ROW) {
      rows.push(row);
      row = [];
      aspectSum = 0;
    }
  });
  if (row.length > 0) rows.push(row);

  const last = rows[rows.length - 1];
  const prev = rows[rows.length - 2];
  if (last && prev && last.length === 1 && aspects[last[0]] < ORPHAN_ASPECT_LIMIT && prev.length >= 2) {
    const moved = prev.pop();
    if (moved !== undefined) last.unshift(moved);
  }

  return rows;
}

function appendJustifiedGroup(result: string[], images: string[]): void {
  if (images.length === 0) return;

  const aspects = images.map(imageAspect);
  for (const rowIndices of packJustifiedRows(aspects)) {
    const aspectSum = rowIndices.reduce((acc, index) => acc + aspects[index], 0);
    const cells = rowIndices.map((index) => images[index]).join('');
    result.push(`<div class="img-jrow ${rowAspectClass(aspectSum)}">${cells}</div>`);
  }
}

/**
 * Groups consecutive image paragraphs into justified magazine rows
 * (.img-jrow) that always span the full content width regardless of the
 * number of images or their orientation mix.
 */
export function groupConsecutiveImages(html: string): string {
  if (!html || typeof html !== 'string') return html ?? '';

  const normalizedHtml = expandMultiImageOnlyParagraphs(html);

  // Split into paragraphs while preserving structure
  const parts = normalizedHtml.split(/(<p[^>]*>[\s\S]*?<\/p>)/gi).filter(Boolean);
  const result: string[] = [];
  let imageBuffer: string[] = [];

  const flushImageBuffer = (): void => {
    if (imageBuffer.length === 0) return;
    appendJustifiedGroup(result, imageBuffer);
    imageBuffer = [];
  };

  for (const part of parts) {
    // Check if paragraph contains only an image (possibly with whitespace/br tags)
    const isImageParagraph = /<p[^>]*>[\s]*<img\b[^>]*>[\s]*(?:<br\s*\/?>[\s]*)?<\/p>/i.test(part);

    if (isImageParagraph) {
      imageBuffer.push(part);
    } else {
      flushImageBuffer();
      result.push(part);
    }
  }
  flushImageBuffer();

  return result.join('');
}

/**
 * Removes smart image layout classes from HTML.
 * Useful for re-processing or when raw HTML is needed.
 */
export function removeImageLayoutClasses(html: string): string {
  if (!html || typeof html !== 'string') return html ?? '';

  let result = html;

  result = result.replace(/<div\b[^>]*class="[^"]*\bimg-grid-mixed\b[^"]*\bimg-grid-mixed-reverse\b[^"]*"[^>]*><p>([\s\S]*?)<\/p><div\b[^>]*class="[^"]*\bimg-grid-mixed-stack\b[^"]*"[^>]*>([\s\S]*?)<\/div><\/div>/gi, '<p>$1</p>$2');
  result = result.replace(/<div\b[^>]*class="[^"]*\bimg-grid-mixed\b[^"]*"[^>]*><div\b[^>]*class="[^"]*\bimg-grid-mixed-stack\b[^"]*"[^>]*>([\s\S]*?)<\/div><p>([\s\S]*?)<\/p><\/div>/gi, '$1<p>$2</p>');

  // Remove wrapper divs for image groups, keeping inner content.
  // Stored HTML may contain justified rows from this pass or nested
  // smart-layout wrappers from previous generations of the algorithm.
  let previous = '';
  while (result !== previous) {
    previous = result;
    result = result.replace(/<div\b[^>]*class="[^"]*\bimg-jrow\b[^"]*"[^>]*>([\s\S]*?)<\/div>/gi, '$1');
    result = result.replace(/<div\b[^>]*class="[^"]*\bimg-row-2\b[^"]*"[^>]*>([\s\S]*?)<\/div>/gi, '$1');
    result = result.replace(/<div\b[^>]*class="[^"]*\bimg-grid\b[^"]*"[^>]*>([\s\S]*?)<\/div>/gi, '$1');
  }

  const stripParagraphClasses = (value: string, classesToStrip: string[]) =>
    value.replace(/<p([^>]*)class="([^"]*)"([^>]*)>/gi, (match, before = '', classValue = '', after = '') => {
      const nextClasses = classValue
        .split(/\s+/)
        .filter(Boolean)
        .filter((className: string) => !classesToStrip.includes(className));

      // Normalize surrounding whitespace so repeated passes stay idempotent:
      // without trimming, the space that separated `<p` from `class="` is kept in
      // `before` AND re-added before the rebuilt ` class="…"`, so each pass adds one
      // extra space (`<p class` → `<p  class` → …). That silent drift makes a
      // re-saved description differ from the stored one and surfaces a phantom draft.
      const beforeAttr = before.trim() ? ` ${before.trim()}` : '';
      const afterAttr = after.trim() ? ` ${after.trim()}` : '';
      const classAttr = nextClasses.length ? ` class="${nextClasses.join(' ')}"` : '';
      return `<p${beforeAttr}${classAttr}${afterAttr}>`;
    });

  result = stripParagraphClasses(result, [
    'img-float-right',
    'img-float-left',
    'img-single-wide',
    'figure-portrait',
    'figure-landscape',
  ]);
  return result;
}

/**
 * Applies smart image layout to description HTML.
 * First removes any existing layout classes, then applies fresh grouping.
 */
export function applySmartImageLayout(html: string): string {
  const cleaned = removeImageLayoutClasses(html);
  return groupConsecutiveImages(cleaned);
}
