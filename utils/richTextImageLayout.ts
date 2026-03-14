/**
 * Smart image layout utilities for rich text content.
 * Groups consecutive image paragraphs into visually appealing layouts.
 */

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

/**
 * Checks if image is landscape (horizontal) orientation.
 * Returns true if width > height * 1.2 (clearly horizontal)
 */
function isLandscapeImage(imgTag: string): boolean {
  const dims = extractImageDimensions(imgTag);
  if (!dims) return false;
  // Consider landscape if width is at least 20% greater than height
  return dims.width > dims.height * 1.2;
}

/**
 * Groups consecutive image paragraphs into smart layouts:
 * - 2 images → side-by-side row (.img-row-2)
 * - 3+ images → grid layout (.img-grid)
 * - 1 horizontal image → full width centered (.img-single-wide)
 * - 1 vertical/square image → alternating float left/right (.img-float-right/.img-float-left)
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
      const imgParagraph = imageBuffer[0];
      // Check if image is landscape (horizontal)
      if (isLandscapeImage(imgParagraph)) {
        // Horizontal image - show full width, centered
        const img = imgParagraph.replace(/<p([^>]*)>/, '<p$1 class="img-single-wide">');
        result.push(img);
      } else {
        // Vertical/square image - add float class alternating left/right
        const floatClass = floatDirection % 2 === 0 ? 'img-float-right' : 'img-float-left';
        const img = imgParagraph.replace(/<p([^>]*)>/, `<p$1 class="${floatClass}">`);
        result.push(img);
        floatDirection++;
      }
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

  // Remove float and single-wide classes from paragraphs
  result = result.replace(/(<p[^>]*)\s+class="img-float-(?:right|left)"([^>]*>)/gi, '$1$2');
  result = result.replace(/(<p[^>]*)\s+class="img-single-wide"([^>]*>)/gi, '$1$2');

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
