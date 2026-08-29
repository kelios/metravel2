/**
 * Smart image layout utilities for rich text content.
 * Groups consecutive image paragraphs into visually appealing layouts.
 *
 * Раскладка определяется ДВУМЯ свойствами группы: ориентацией кадров
 * (портрет / ландшафт / квадрат) и их количеством. Именно эта пара выбирает
 * журнальный вариант — пара портретов, ландшафтный стек, «лоскут» из трёх,
 * квартет и т.д. Тот же словарь классов читает PDF-экспорт
 * (`services/pdf-export/parsers/ContentParser.ts` → `getGalleryLayout`), поэтому
 * веб и книга раскладывают одну и ту же группу одинаково.
 *
 * История: раскладку по ориентации однажды заменили на упаковку по сумме
 * aspect-ratio (`.img-jrow` + бакеты `jrow-ar-*`). Та модель не различала
 * ориентацию вообще, а в PDF ни один её класс не совпадал со словарём
 * `getGalleryLayout`, из-за чего книга всегда падала в `grid-default`.
 * Разметку той эпохи снимает `removeImageLayoutClasses` — описания
 * перекладываются на журнальную модель при первом же проходе.
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
 * Кадр, который раскладываем как широкий: объявленный ландшафт ИЛИ кадр без
 * объявленных размеров.
 *
 * Разметка редактора почти никогда не несёт `width`/`height`. На web этого не
 * видно: `normalizeImgTags` подставляет резервные `aspect-ratio:800/450`, и все
 * такие кадры доезжают сюда ландшафтными. PDF-экспорт раскладывает СЫРОЕ
 * описание, без резерва — те же кадры выглядели «ни ландшафт, ни портрет» и
 * уходили в портретные ветки: одиночные — в 56%-колонку с чередованием
 * право/лево (в книге это рваная лесенка, потому что обтекания текстом там
 * нет), группы — мимо журнальных раскладок. Одно допущение «размеров нет →
 * кадр широкий» держит книгу и страницу на одной раскладке.
 *
 * Объявленный квадрат остаётся квадратом — его ветки не трогаем.
 */
function isWideImage(imgTag: string): boolean {
  return isLandscapeImage(imgTag) || extractImageDimensions(imgTag) === null;
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
    if (isWideImage(img)) {
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
      return `<p${attrs.replace(/class="([^"]*)"/i, (_match: string, current: string) => {
        const merged = `${current} ${className}`
          .split(/\s+/)
          .filter(Boolean)
          .filter((value, index, values) => values.indexOf(value) === index)
          .join(' ');
        // `attrs` already contains the separator before `class`. Returning a
        // second leading space here makes the transform drift on every path
        // that preserves an authored single-image layout.
        return `class="${merged}"`;
      })}>`;
    }
    return `<p${attrs} class="${className}">`;
  });
}

function stripClassesFromParagraph(paragraphHtml: string, classesToStrip: string[]): string {
  return paragraphHtml.replace(
    /<p([^>]*)class="([^"]*)"([^>]*)>/i,
    (_match, before = '', classValue = '', after = '') => {
      const nextClasses = String(classValue)
        .split(/\s+/)
        .filter(Boolean)
        .filter((className) => !classesToStrip.includes(className));
      const beforeAttr = String(before).trim() ? ` ${String(before).trim()}` : '';
      const afterAttr = String(after).trim() ? ` ${String(after).trim()}` : '';
      const classAttr = nextClasses.length ? ` class="${nextClasses.join(' ')}"` : '';
      return `<p${beforeAttr}${classAttr}${afterAttr}>`;
    }
  );
}

function wrapImageGroup(wrapperClassName: string, images: string[]): string {
  return `<div class="${wrapperClassName}">${images.join('')}</div>`;
}

function isSingleImageParagraph(paragraphHtml: string): boolean {
  return /^<p[^>]*>\s*<img\b[^>]*>\s*(?:<br\s*\/?>\s*)?<\/p>$/i.test(paragraphHtml);
}

function appendSingleImage(result: string[], imgParagraph: string, floatDirection: number): number {
  if (/\bimg-single-wide\b/i.test(imgParagraph)) {
    result.push(appendClassToParagraph(imgParagraph, 'figure-landscape'));
    return floatDirection;
  }

  const assignedFloat = imgParagraph.match(/\bimg-float-(right|left)\b/i)?.[1]?.toLowerCase();
  if (assignedFloat === 'right' || assignedFloat === 'left') {
    result.push(appendClassToParagraph(imgParagraph, 'figure-portrait'));
    // `floatDirection` encodes the side of the next automatic portrait
    // (even=right, odd=left). Continue on the opposite side of the authored
    // float even when its side differs from the algorithm's current parity.
    const nextShouldBeLeft = assignedFloat === 'right';
    const parityAlreadyMatches = (floatDirection % 2 === 1) === nextShouldBeLeft;
    return parityAlreadyMatches ? floatDirection : floatDirection + 1;
  }

  if (isWideImage(imgParagraph)) {
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

  const groupedImages = images.map((image) =>
    stripClassesFromParagraph(image, [
      'img-float-right',
      'img-float-left',
      'img-single-wide',
      'figure-portrait',
      'figure-landscape',
    ])
  );
  const composition = analyzeImageGroup(groupedImages);
  if (groupedImages.length === 2) {
    if (composition.portrait === 2) {
      result.push(wrapImageGroup('img-pair-portraits img-row-2 img-row-2-portrait', groupedImages));
      return floatDirection;
    }
    if (composition.landscape === 2) {
      result.push(wrapImageGroup('img-stack-landscape img-row-2 img-row-2-landscape', groupedImages));
      return floatDirection;
    }
    if (composition.landscape === 1 && composition.portrait === 1) {
      result.push(wrapImageGroup('img-pair-mixed img-row-2 img-row-2-mixed', groupedImages));
      return floatDirection;
    }
    result.push(wrapImageGroup('img-pair-balanced img-row-2 img-row-2-balanced', groupedImages));
    return floatDirection;
  }

  const mixedThreeLayout = buildMixedThreeImageLayout(groupedImages);
  if (mixedThreeLayout) {
    result.push(mixedThreeLayout);
    return floatDirection;
  }

  const balancedFourLayout = buildBalancedFourImageLayout(groupedImages);
  if (balancedFourLayout) {
    result.push(balancedFourLayout);
    return floatDirection;
  }

  const portraitStoryLayout = buildPortraitStoryLayout(groupedImages);
  if (portraitStoryLayout) {
    result.push(portraitStoryLayout);
    return floatDirection;
  }

  if (composition.portrait >= groupedImages.length - composition.portrait) {
    result.push(wrapImageGroup('img-column-portraits img-grid img-grid-portrait', groupedImages));
    return floatDirection;
  }

  result.push(wrapImageGroup('img-editorial-grid img-grid', groupedImages));
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
  // Разделители между абзацами. Редактор пишет описание с переводами строк
  // (`</p>\n<p>`), и раньше такой фрагмент считался контентом и обрывал группу:
  // подряд идущие фото ни разу не собирались в журнальную раскладку — ни в
  // книге, ни на странице, хотя весь словарь классов и CSS для них есть.
  // Пробельный фрагмент контентом не является: внутри группы он отбрасывается,
  // перед группой — сохраняется, чтобы разметка вокруг текста не менялась.
  let pendingWhitespace = '';

  const flushImageBuffer = (): void => {
    if (imageBuffer.length === 0) return;

    floatDirection = appendUniformImageGroup(result, imageBuffer, floatDirection);
    imageBuffer = [];
  };

  for (const part of parts) {
    // Check if paragraph contains only an image (possibly with whitespace/br tags)
    const isImageParagraph = isSingleImageParagraph(part);

    if (isImageParagraph) {
      if (imageBuffer.length === 0 && pendingWhitespace) result.push(pendingWhitespace);
      pendingWhitespace = '';
      imageBuffer.push(part);
      continue;
    }

    if (!part.trim()) {
      pendingWhitespace += part;
      continue;
    }

    flushImageBuffer();
    if (pendingWhitespace) {
      result.push(pendingWhitespace);
      pendingWhitespace = '';
    }
    result.push(part);
  }
  flushImageBuffer();
  if (pendingWhitespace) result.push(pendingWhitespace);

  return result.join('');
}

/**
 * Removes smart image layout classes from HTML.
 * Useful for re-processing or when raw HTML is needed.
 */
function removeImageLayoutClassesInternal(html: string, preserveSingleImageLayout: boolean): string {
  if (!html || typeof html !== 'string') return html ?? '';

  let result = html;

  result = result.replace(/<div\b[^>]*class="[^"]*\bimg-grid-mixed\b[^"]*\bimg-grid-mixed-reverse\b[^"]*"[^>]*><p>([\s\S]*?)<\/p><div\b[^>]*class="[^"]*\bimg-grid-mixed-stack\b[^"]*"[^>]*>([\s\S]*?)<\/div><\/div>/gi, '<p>$1</p>$2');
  result = result.replace(/<div\b[^>]*class="[^"]*\bimg-grid-mixed\b[^"]*"[^>]*><div\b[^>]*class="[^"]*\bimg-grid-mixed-stack\b[^"]*"[^>]*>([\s\S]*?)<\/div><p>([\s\S]*?)<\/p><\/div>/gi, '$1<p>$2</p>');

  // Remove wrapper divs for image groups, keeping inner content.
  // Stored HTML may already contain nested smart-layout wrappers from a previous
  // pass, and `.img-jrow` from the aspect-sum generation of this algorithm —
  // снимаем и его, иначе описание навсегда осталось бы в той раскладке.
  let previous = '';
  while (result !== previous) {
    previous = result;
    result = result.replace(/<div\b[^>]*class="[^"]*\bimg-jrow\b[^"]*"[^>]*>([\s\S]*?)<\/div>/gi, '$1');
    result = result.replace(/<div\b[^>]*class="[^"]*\bimg-row-2\b[^"]*"[^>]*>([\s\S]*?)<\/div>/gi, '$1');
    result = result.replace(/<div\b[^>]*class="[^"]*\bimg-grid\b[^"]*"[^>]*>([\s\S]*?)<\/div>/gi, '$1');
  }

  // Normalize surrounding whitespace while stripping classes so repeated passes
  // stay idempotent and do not surface a phantom draft.
  result = result.replace(/<p[^>]*>[\s\S]*?<\/p>/gi, (paragraphHtml) => {
    const preserveLayout = preserveSingleImageLayout && isSingleImageParagraph(paragraphHtml);
    return paragraphHtml.replace(/^<p[^>]*>/i, (paragraphStart) =>
      stripClassesFromParagraph(paragraphStart, [
        ...(preserveLayout ? [] : ['img-float-right', 'img-float-left', 'img-single-wide']),
        'figure-portrait',
        'figure-landscape',
      ])
    );
  });
  return result;
}

export function removeImageLayoutClasses(html: string): string {
  return removeImageLayoutClassesInternal(html, false);
}

/**
 * Applies smart image layout to description HTML.
 * First removes any existing layout classes, then applies fresh grouping.
 */
export function applySmartImageLayout(html: string): string {
  // Explicit single-image alignment is authored content, not a stale generated
  // grid. Keep it while rebuilding group wrappers so PDF export and repeated
  // saves do not silently flip left/right or turn a forced wide image into a float.
  const cleaned = removeImageLayoutClassesInternal(html, true);
  return groupConsecutiveImages(cleaned);
}

// ============================================================================
// #1623 — render-only backward float wrap. WEB DISPLAY ONLY.
//
// A CSS float can only wrap content that comes AFTER it in the DOM. When the
// authored order is `[paragraph][single portrait][heading]` there is nothing
// following the photo to wrap, so the preceding paragraph is stranded
// full-width above an unwrapped float (ticket evidence: prior `p`
// 720x134 full width, float photo below it with dead space beside it).
//
// This function is intentionally SEPARATE from `applySmartImageLayout` /
// `groupConsecutiveImages` above and must stay that way:
//   - `hooks/useTravelFormPersistence.ts` runs `applySmartImageLayout` on the
//     SAVED description on every autosave/save (`saveFormData`,
//     `saveContentDelta`). Its result is what the server stores. Reordering
//     paragraphs inside that persisted transform is a data-corruption risk on
//     any interleaved article ([text][photo][text][photo][heading]): a
//     backward swap can hand a preceding paragraph to a LATER float even
//     though an EARLIER float already claims it as its forward wrap target,
//     making two floats land adjacent to each other. The very next save then
//     re-parses that output, `groupConsecutiveImages` buffers the two now-
//     adjacent single images as a GROUP, and the author's assigned side is
//     lost — a genuine idempotency break that writes corrupted HTML to the
//     database, not merely a stale render.
//   - `services/pdf-export/renderers/BlockRenderer.ts` also runs
//     `applySmartImageLayout` directly for print; the ticket's scope
//     explicitly excludes touching print (owned by #1602).
// Keeping the swap here, applied AFTER `applySmartImageLayout` has already
// produced the string that gets persisted/printed, and wiring it ONLY from
// `components/travel/StableContent.web.tsx` (which feeds a `dangerouslySetInnerHTML`
// string that is discarded after paint, never fed back into a save or PDF
// call), makes data corruption structurally impossible: this function's
// output never reaches the server or the print pipeline.
//
// DO NOT call this from `hooks/useTravelFormPersistence.ts`,
// `services/pdf-export/**`, or any other path whose output is persisted or
// printed.
const MIN_PRECEDING_TEXT_CHARS_FOR_BACKWARD_FLOAT = 60;

function stripTagsForLength(html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isFloatedSingleImageParagraph(html: string): boolean {
  return isSingleImageParagraph(html) && /\bimg-float-(left|right)\b/i.test(html);
}

// A following paragraph only counts as a real wrap target when it has visible
// text. Editors routinely insert `<p>&nbsp;</p>` placeholder paragraphs; a
// tag-only check (`starts with <p`) treats those as "already handled" and
// silently skips the swap, leaving the float unwrapped anyway.
function isNonEmptyTextParagraph(html: string): boolean {
  if (!/^<p(?:\s[^>]*)?>/i.test(html)) return false;
  return stripTagsForLength(html).length > 0;
}

function isWrappableTextParagraph(html: string): boolean {
  if (!/^<p(?:\s[^>]*)?>/i.test(html)) return false;
  if (/<img\b/i.test(html)) return false;
  return stripTagsForLength(html).length >= MIN_PRECEDING_TEXT_CHARS_FOR_BACKWARD_FLOAT;
}

/**
 * Render-only post-pass over ALREADY fully-classed HTML (i.e. the output of
 * `applySmartImageLayout`). Moves a floated single portrait that has nothing
 * wrappable after it (heading/group/end of content) to sit immediately before
 * the nearest preceding plain-text paragraph, IF that paragraph has enough
 * text (`isWrappableTextParagraph`) AND is not already the forward wrap
 * target of an earlier float (`isClaimed`) — the latter check is what keeps
 * interleaved articles ([text][photo1][text][photo2][heading]) safe: photo1
 * already owns the middle paragraph via the existing, unmodified forward-wrap
 * CSS, so photo2 is left exactly as `applySmartImageLayout` produced it
 * instead of being forced onto an already-used neighbor.
 */
export function applyBackwardFloatWrap(html: string): string {
  if (!html || typeof html !== 'string') return html ?? '';

  const parts = html.split(/(<p[^>]*>[\s\S]*?<\/p>)/gi).filter(Boolean);
  const result: string[] = [];

  const lastSignificantIndex = (): number => {
    for (let index = result.length - 1; index >= 0; index -= 1) {
      if (result[index].trim()) return index;
    }
    return -1;
  };

  const isClaimed = (index: number): boolean => {
    for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
      if (!result[cursor].trim()) continue;
      return isFloatedSingleImageParagraph(result[cursor]);
    }
    return false;
  };

  for (let i = 0; i < parts.length; i += 1) {
    const part = parts[i];

    if (isFloatedSingleImageParagraph(part)) {
      let next: string | undefined;
      for (let j = i + 1; j < parts.length; j += 1) {
        if (parts[j].trim()) {
          next = parts[j];
          break;
        }
      }
      const hasFollowingParagraph = next !== undefined && isNonEmptyTextParagraph(next);

      if (!hasFollowingParagraph) {
        const targetIndex = lastSignificantIndex();
        const target = targetIndex >= 0 ? result[targetIndex] : undefined;
        if (target !== undefined && isWrappableTextParagraph(target) && !isClaimed(targetIndex)) {
          result[targetIndex] = part;
          result.push(target);
          continue;
        }
      }
    }

    result.push(part);
  }

  return result.join('');
}
