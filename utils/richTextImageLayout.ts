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
      return `<p${attrs.replace(/class="([^"]*)"/i, (_, current) => {
        const merged = `${current} ${className}`
          .split(/\s+/)
          .filter(Boolean)
          .filter((value, index, values) => values.indexOf(value) === index)
          .join(' ');
        return ` class="${merged}"`;
      })}>`;
    }
    return `<p${attrs} class="${className}">`;
  });
}

function wrapImageGroup(wrapperClassName: string, images: string[]): string {
  return `<div class="${wrapperClassName}">${images.join('')}</div>`;
}

function appendSingleImage(result: string[], imgParagraph: string, floatDirection: number): number {
  if (isLandscapeImage(imgParagraph)) {
    const img = appendClassToParagraph(imgParagraph, 'img-single-wide figure-landscape');
    result.push(img);
    return floatDirection;
  }

  const floatClass = floatDirection % 2 === 0 ? 'img-float-right' : 'img-float-left';
  const img = appendClassToParagraph(imgParagraph, `${floatClass} figure-portrait`);
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
    return `<div class="img-quilt-3 img-grid-mixed img-grid-mixed-reverse"><p>${portrait.replace(/^<p[^>]*>|<\/p>$/gi, '')}</p><div class="img-grid-mixed-stack">${supporting.join('')}</div></div>`;
  }

  return `<div class="img-quilt-3 img-grid-mixed"><div class="img-grid-mixed-stack">${supporting.join('')}</div><p>${portrait.replace(/^<p[^>]*>|<\/p>$/gi, '')}</p></div>`;
}

function buildBalancedFourImageLayout(images: string[]): string | null {
  if (images.length !== 4) return null;

  const composition = analyzeImageGroup(images);
  if (composition.portrait >= 3) {
    return wrapImageGroup('img-portrait-quartet img-grid img-grid-portrait', images);
  }

  if (composition.landscape >= 3) {
    return wrapImageGroup('img-quilt-4 img-grid img-grid-quilt', images);
  }

  if (composition.landscape === 2 && composition.portrait === 2) {
    return wrapImageGroup('img-pair-grid img-grid img-grid-balanced', images);
  }

  return null;
}

function buildPortraitStoryLayout(images: string[]): string | null {
  const composition = analyzeImageGroup(images);
  if (composition.portrait < images.length - composition.portrait) {
    return null;
  }

  if (images.length === 3) {
    return wrapImageGroup('img-portrait-triptych img-grid img-grid-portrait', images);
  }

  if (images.length === 4) {
    return wrapImageGroup('img-portrait-quartet img-grid img-grid-portrait', images);
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
      result.push(wrapImageGroup('img-pair-portraits img-row-2 img-row-2-portrait', images));
      return floatDirection;
    }
    if (composition.landscape === 2) {
      result.push(wrapImageGroup('img-stack-landscape img-row-2 img-row-2-landscape', images));
      return floatDirection;
    }
    if (composition.landscape === 1 && composition.portrait === 1) {
      result.push(wrapImageGroup('img-pair-mixed img-row-2 img-row-2-mixed', images));
      return floatDirection;
    }
    result.push(wrapImageGroup('img-pair-balanced img-row-2 img-row-2-balanced', images));
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

  const portraitStoryLayout = buildPortraitStoryLayout(images);
  if (portraitStoryLayout) {
    result.push(portraitStoryLayout);
    return floatDirection;
  }

  if (composition.portrait >= images.length - composition.portrait) {
    result.push(wrapImageGroup('img-column-portraits img-grid img-grid-portrait', images));
    return floatDirection;
  }

  result.push(wrapImageGroup('img-editorial-grid img-grid', images));
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

  result = result.replace(/<div\b[^>]*class="[^"]*\bimg-grid-mixed\b[^"]*\bimg-grid-mixed-reverse\b[^"]*"[^>]*><p>([\s\S]*?)<\/p><div\b[^>]*class="[^"]*\bimg-grid-mixed-stack\b[^"]*"[^>]*>([\s\S]*?)<\/div><\/div>/gi, '<p>$1</p>$2');
  result = result.replace(/<div\b[^>]*class="[^"]*\bimg-grid-mixed\b[^"]*"[^>]*><div\b[^>]*class="[^"]*\bimg-grid-mixed-stack\b[^"]*"[^>]*>([\s\S]*?)<\/div><p>([\s\S]*?)<\/p><\/div>/gi, '$1<p>$2</p>');

  // Remove wrapper divs for image groups, keeping inner content.
  // Stored HTML may already contain nested smart-layout wrappers from a previous pass.
  let previous = '';
  while (result !== previous) {
    previous = result;
    result = result.replace(/<div\b[^>]*class="[^"]*\bimg-row-2\b[^"]*"[^>]*>([\s\S]*?)<\/div>/gi, '$1');
    result = result.replace(/<div\b[^>]*class="[^"]*\bimg-grid\b[^"]*"[^>]*>([\s\S]*?)<\/div>/gi, '$1');
  }

  const stripParagraphClasses = (value: string, classesToStrip: string[]) =>
    value.replace(/<p([^>]*)class="([^"]*)"([^>]*)>/gi, (match, before = '', classValue = '', after = '') => {
      const nextClasses = classValue
        .split(/\s+/)
        .filter(Boolean)
        .filter((className) => !classesToStrip.includes(className));

      const classAttr = nextClasses.length ? ` class="${nextClasses.join(' ')}"` : '';
      return `<p${before}${classAttr}${after}>`;
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
