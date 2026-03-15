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
 * Checks if image is portrait (vertical) orientation.
 * Returns true if height > width * 1.2 (clearly vertical)
 */
function isPortraitImage(imgTag: string): boolean {
  const dims = extractImageDimensions(imgTag);
  if (!dims) return false;
  // Consider portrait if height is at least 20% greater than width
  return dims.height > dims.width * 1.2;
}

/**
 * Analyzes orientation composition of image group.
 * Returns counts of landscape, portrait, and square images.
 */
function analyzeImageGroup(images: string[]): { landscape: number; portrait: number; square: number } {
  let landscape = 0;
  let portrait = 0;
  let square = 0;
  
  for (const img of images) {
    if (isLandscapeImage(img)) {
      landscape++;
    } else if (isPortraitImage(img)) {
      portrait++;
    } else {
      square++;
    }
  }
  
  return { landscape, portrait, square };
}

/**
 * Finds the index of the portrait image in a group.
 * Returns -1 if no portrait found.
 */
function findPortraitIndex(images: string[]): number {
  return images.findIndex(img => isPortraitImage(img));
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
      // Two images - analyze orientation for better layout
      const composition = analyzeImageGroup(imageBuffer);
      if (composition.portrait === 2) {
        // Both portrait - use taller row
        result.push(`<div class="img-row-2 img-row-2-portrait">${imageBuffer.join('')}</div>`);
      } else if (composition.portrait === 1) {
        // Mixed - portrait + landscape/square
        const portraitIdx = findPortraitIndex(imageBuffer);
        const reordered = portraitIdx === 0 
          ? imageBuffer 
          : [imageBuffer[1], imageBuffer[0]];
        result.push(`<div class="img-row-2 img-row-2-mixed">${reordered.join('')}</div>`);
      } else {
        // Both landscape or square - standard row
        result.push(`<div class="img-row-2">${imageBuffer.join('')}</div>`);
      }
    } else {
      // 3+ images - analyze composition for smart grid layout
      const composition = analyzeImageGroup(imageBuffer);
      
      if (composition.portrait === 1 && imageBuffer.length === 3) {
        // Special case: 2 landscape/square + 1 portrait
        // Put portrait on the side, landscapes stacked
        const portraitIdx = findPortraitIndex(imageBuffer);
        const portrait = imageBuffer[portraitIdx];
        const others = imageBuffer.filter((_, i) => i !== portraitIdx);
        result.push(`<div class="img-grid-mixed"><div class="img-grid-mixed-stack">${others.join('')}</div>${portrait}</div>`);
      } else if (composition.portrait >= 2) {
        // Multiple portraits - use portrait-optimized grid
        result.push(`<div class="img-grid img-grid-portrait">${imageBuffer.join('')}</div>`);
      } else {
        // All landscape/square - standard grid
        result.push(`<div class="img-grid">${imageBuffer.join('')}</div>`);
      }
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

  // Remove wrapper divs for img-row-2 and img-grid variants, keeping inner content
  result = result.replace(/<div\s+class="img-row-2(?:\s+img-row-2-(?:portrait|mixed))?">([\s\S]*?)<\/div>/gi, '$1');
  result = result.replace(/<div\s+class="img-grid(?:\s+img-grid-portrait)?">([\s\S]*?)<\/div>/gi, '$1');
  // Remove img-grid-mixed wrapper and inner stack div
  result = result.replace(/<div\s+class="img-grid-mixed"><div\s+class="img-grid-mixed-stack">([\s\S]*?)<\/div>([\s\S]*?)<\/div>/gi, '$1$2');

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
