/**
 * Smart image layout utilities for rich text content.
 * Groups consecutive image paragraphs into visually appealing layouts.
 */

/**
 * Groups consecutive image paragraphs into smart layouts:
 * - 2 images → side-by-side row (.img-row-2)
 * - 3+ images → grid layout (.img-grid)
 * - 1 image between text → alternating float left/right (.img-float-right/.img-float-left)
 */
export function groupConsecutiveImages(html: string): string {
  if (!html || typeof html !== 'string') return html ?? '';

  // Split into paragraphs while preserving structure
  const parts = html.split(/(<p[^>]*>[\s\S]*?<\/p>)/gi).filter(Boolean);
  const result: string[] = [];
  let imageBuffer: string[] = [];
  let floatDirection = 0; // 0 = right, 1 = left, alternates

  const flushImageBuffer = (): void => {
    if (imageBuffer.length === 0) return;

    if (imageBuffer.length === 1) {
      // Single image - add float class alternating left/right
      const floatClass = floatDirection % 2 === 0 ? 'img-float-right' : 'img-float-left';
      const img = imageBuffer[0].replace(/<p([^>]*)>/, `<p$1 class="${floatClass}">`);
      result.push(img);
      floatDirection++;
    } else if (imageBuffer.length === 2) {
      // Two images - side by side
      result.push(`<div class="img-row-2">${imageBuffer.join('')}</div>`);
    } else {
      // 3+ images - grid
      result.push(`<div class="img-grid">${imageBuffer.join('')}</div>`);
    }
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

  // Remove wrapper divs for img-row-2 and img-grid, keeping inner content
  result = result.replace(/<div\s+class="img-row-2">([\s\S]*?)<\/div>/gi, '$1');
  result = result.replace(/<div\s+class="img-grid">([\s\S]*?)<\/div>/gi, '$1');

  // Remove float classes from paragraphs
  result = result.replace(/(<p[^>]*)\s+class="img-float-(?:right|left)"([^>]*>)/gi, '$1$2');

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
