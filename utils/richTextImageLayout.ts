/**
 * Smart image layout utilities for rich text content.
 * Groups consecutive image paragraphs into visually appealing layouts.
 */

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

function appendClassToParagraph(paragraphHtml: string, className: string): string {
  return paragraphHtml.replace(/<p([^>]*)>/i, (match, attrs = '') => {
    if (/\bclass="/i.test(attrs)) {
      return `<p${attrs.replace(/class="([^"]*)"/i, (_, current) => ` class="${`${current} ${className}`.trim()}"`)}>`;
    }
    return `<p${attrs} class="${className}">`;
  });
}

function appendSingleImage(result: string[], imgParagraph: string, floatDirection: number): number {
  if (isLandscapeImage(imgParagraph)) {
    const img = appendClassToParagraph(imgParagraph, 'img-single-wide');
    result.push(img);
    return floatDirection;
  }

  const floatClass = floatDirection % 2 === 0 ? 'img-float-right' : 'img-float-left';
  const img = appendClassToParagraph(imgParagraph, floatClass);
  result.push(img);
  return floatDirection + 1;
}

function buildMixedThreeImageLayout(images: string[]): string | null {
  if (images.length !== 3) return null;

  const portraitIndex = images.findIndex((image) => isPortraitImage(image));
  if (portraitIndex < 0) return null;

  const portrait = images[portraitIndex];
  const supporting = images.filter((_, index) => index !== portraitIndex);
  if (supporting.length !== 2 || supporting.some((image) => !isLandscapeImage(image))) {
    return null;
  }

  if (portraitIndex === 0) {
    return `<div class="img-grid-mixed img-grid-mixed-reverse"><p>${portrait.replace(/^<p[^>]*>|<\/p>$/gi, '')}</p><div class="img-grid-mixed-stack">${supporting.join('')}</div></div>`;
  }

  return `<div class="img-grid-mixed"><div class="img-grid-mixed-stack">${supporting.join('')}</div><p>${portrait.replace(/^<p[^>]*>|<\/p>$/gi, '')}</p></div>`;
}

function buildBalancedFourImageLayout(images: string[]): string | null {
  if (images.length !== 4) return null;

  const composition = analyzeImageGroup(images);
  if (composition.portrait >= 3) {
    return `<div class="img-grid img-grid-portrait">${images.join('')}</div>`;
  }

  if (composition.landscape >= 3) {
    return `<div class="img-grid img-grid-quilt">${images.join('')}</div>`;
  }

  if (composition.landscape === 2 && composition.portrait === 2) {
    return `<div class="img-grid img-grid-balanced">${images.join('')}</div>`;
  }

  return null;
}

function appendUniformImageGroup(result: string[], images: string[], floatDirection: number): number {
  if (images.length === 0) return floatDirection;

  if (images.length === 1) {
    return appendSingleImage(result, images[0], floatDirection);
  }

  const composition = analyzeImageGroup(images);
  if (images.length === 2) {
    if (composition.portrait === 2) {
      result.push(`<div class="img-row-2 img-row-2-portrait">${images.join('')}</div>`);
      return floatDirection;
    }
    if (composition.landscape === 2) {
      result.push(`<div class="img-row-2 img-row-2-landscape">${images.join('')}</div>`);
      return floatDirection;
    }
    if (composition.landscape === 1 && composition.portrait === 1) {
      result.push(`<div class="img-row-2 img-row-2-mixed">${images.join('')}</div>`);
      return floatDirection;
    }
    result.push(`<div class="img-row-2 img-row-2-balanced">${images.join('')}</div>`);
    return floatDirection;
  }

  const mixedThreeLayout = buildMixedThreeImageLayout(images);
  if (mixedThreeLayout) {
    result.push(mixedThreeLayout);
    return floatDirection;
  }

  const balancedFourLayout = buildBalancedFourImageLayout(images);
  if (balancedFourLayout) {
    result.push(balancedFourLayout);
    return floatDirection;
  }

  if (composition.portrait >= images.length - composition.portrait) {
    result.push(`<div class="img-grid img-grid-portrait">${images.join('')}</div>`);
    return floatDirection;
  }

  result.push(`<div class="img-grid">${images.join('')}</div>`);
  return floatDirection;
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

  const normalizedHtml = expandMultiImageOnlyParagraphs(html);

  // Split into paragraphs while preserving structure
  const parts = normalizedHtml.split(/(<p[^>]*>[\s\S]*?<\/p>)/gi).filter(Boolean);
  const result: string[] = [];
  let imageBuffer: string[] = [];
  let floatDirection = 0; // 0 = right, 1 = left, alternates

  const flushImageBuffer = (): void => {
    if (imageBuffer.length === 0) return;

    floatDirection = appendUniformImageGroup(result, imageBuffer, floatDirection);
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
  result = result.replace(/<div\s+class="img-row-2(?:\s+img-row-2-(?:portrait|mixed|landscape|balanced))?">([\s\S]*?)<\/div>/gi, '$1');
  result = result.replace(/<div\s+class="img-grid(?:\s+img-grid-(?:portrait|quilt|balanced))?">([\s\S]*?)<\/div>/gi, '$1');
  result = result.replace(/<div\s+class="img-grid-mixed(?:\s+img-grid-mixed-reverse)?"><div\s+class="img-grid-mixed-stack">([\s\S]*?)<\/div><p>([\s\S]*?)<\/p><\/div>/gi, '$1<p>$2</p>');
  result = result.replace(/<div\s+class="img-grid-mixed(?:\s+img-grid-mixed-reverse)?"><p>([\s\S]*?)<\/p><div\s+class="img-grid-mixed-stack">([\s\S]*?)<\/div><\/div>/gi, '<p>$1</p>$2');

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
