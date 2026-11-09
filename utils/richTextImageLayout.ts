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
 *
 * #3202: классы и размеры читаются и правятся по разобранному тегу
 * (`utils/htmlTokens.ts`), а не регулярками по строке тега.
 */

import {
  editFirstStartTag,
  findFirstStartTag,
  getAttribute,
  removeAttribute,
  setAttribute,
  tokenizeHtml,
} from '@/utils/htmlTokens';

const DIGITS_RE = /^\d+$/;
const LAYOUT_WRAPPER_CLASS_RE = /\bimg-(?:jrow|row-2|grid)\b/i;

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
  const attrs = findFirstStartTag(imgTag, 'img')?.attrs ?? [];
  const width = getAttribute(attrs, 'width') ?? '';
  const height = getAttribute(attrs, 'height') ?? '';
  if (DIGITS_RE.test(width) && DIGITS_RE.test(height)) {
    return { width: parseInt(width, 10), height: parseInt(height, 10) };
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

const paragraphClasses = (paragraphHtml: string): string[] =>
  String(getAttribute(findFirstStartTag(paragraphHtml, 'p')?.attrs ?? [], 'class') ?? '')
    .split(/\s+/)
    .filter(Boolean);

function appendClassToParagraph(paragraphHtml: string, className: string): string {
  return editFirstStartTag(paragraphHtml, 'p', (attrs) => {
    const current = getAttribute(attrs, 'class');
    if (current === undefined) {
      attrs.push({ name: 'class', value: className });
      return;
    }
    const merged = `${current ?? ''} ${className}`
      .split(/\s+/)
      .filter(Boolean)
      .filter((value, index, values) => values.indexOf(value) === index)
      .join(' ');
    setAttribute(attrs, 'class', merged);
  });
}

function stripClassesFromParagraph(paragraphHtml: string, classesToStrip: string[]): string {
  const attrs = findFirstStartTag(paragraphHtml, 'p')?.attrs ?? [];
  const current = getAttribute(attrs, 'class');
  if (current === undefined) return paragraphHtml;
  return editFirstStartTag(paragraphHtml, 'p', (parsed) => {
    const nextClasses = String(current ?? '')
      .split(/\s+/)
      .filter(Boolean)
      .filter((className) => !classesToStrip.includes(className));
    if (nextClasses.length) setAttribute(parsed, 'class', nextClasses.join(' '));
    else removeAttribute(parsed, 'class');
  });
}

function wrapImageGroup(wrapperClassName: string, images: string[]): string {
  return `<div class="${wrapperClassName}">${images.join('')}</div>`;
}

function isSingleImageParagraph(paragraphHtml: string): boolean {
  return /^<p[^>]*>\s*<img\b[^>]*>\s*(?:<br\s*\/?>\s*)?<\/p>$/i.test(paragraphHtml);
}

function appendSingleImage(result: string[], imgParagraph: string, floatDirection: number): number {
  const classes = paragraphClasses(imgParagraph);
  if (classes.includes('img-single-wide')) {
    result.push(appendClassToParagraph(imgParagraph, 'figure-landscape'));
    return floatDirection;
  }

  const assignedFloat = classes.includes('img-float-right')
    ? 'right'
    : classes.includes('img-float-left')
      ? 'left'
      : undefined;
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
 * Снимает обёртки групп (`.img-jrow`, `.img-row-2*`, `.img-grid*`), оставляя их
 * содержимое. Пары открывающих/закрывающих `div` считаются по вложенности, поэтому
 * сохранённые разметкой прошлых проходов вложенные обёртки снимаются за один обход.
 */
function unwrapLayoutWrappers(html: string): string {
  const stack: boolean[] = [];
  let out = '';
  let cursor = 0;
  for (const token of tokenizeHtml(html)) {
    if (token.kind === 'start' && token.name === 'div') {
      const isWrapper = LAYOUT_WRAPPER_CLASS_RE.test(String(getAttribute(token.attrs, 'class') ?? ''));
      stack.push(isWrapper);
      if (!isWrapper) continue;
    } else if (token.kind === 'end' && token.name === 'div') {
      if (!stack.pop()) continue;
    } else {
      continue;
    }
    out += html.slice(cursor, token.start);
    cursor = token.end;
  }
  return cursor === 0 ? html : out + html.slice(cursor);
}

/**
 * Removes smart image layout classes from HTML.
 * Useful for re-processing or when raw HTML is needed.
 */
function removeImageLayoutClassesInternal(html: string, preserveSingleImageLayout: boolean): string {
  if (!html || typeof html !== 'string') return html ?? '';

  let result = html;

  result = unwrapLayoutWrappers(result);

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
