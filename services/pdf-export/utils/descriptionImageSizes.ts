// Размеры фото в описании путешествия.
//
// Журнальная раскладка (`utils/richTextImageLayout`) выбирает вариант по
// ориентации кадров, а разметка редактора почти никогда не несёт `width`/
// `height`. На странице этого не видно: web-конвейер подставляет резервные
// пропорции, а после загрузки фото правит их на настоящие
// (`stableContent/useWebEffects`). Книга собирается из сырого описания, поэтому
// пропорции ей нужно проставить до раскладки — иначе ориентация неизвестна,
// портрет и ландшафт попадают в один и тот же слот, а сами кадры расходятся
// по странице лесенкой.

const IMG_TAG_PATTERN = /<img\b[^>]*>/gi;
const SRC_PATTERN = /\bsrc="([^"]+)"/i;
const HAS_WIDTH_PATTERN = /\bwidth="\d+"/i;
const HAS_HEIGHT_PATTERN = /\bheight="\d+"/i;

// Базовая ширина проставляемого размера: раскладке важно только отношение
// сторон, а целые числа читаются обоими парсерами (web и книга).
const ANNOTATED_WIDTH = 1000;

/** Все `src` картинок описания, у которых размеры не объявлены. */
export function extractUnsizedImageSources(html: string | null | undefined): string[] {
  if (!html || typeof html !== 'string') return [];

  const sources: string[] = [];
  const seen = new Set<string>();

  for (const tag of html.match(IMG_TAG_PATTERN) ?? []) {
    if (HAS_WIDTH_PATTERN.test(tag) && HAS_HEIGHT_PATTERN.test(tag)) continue;
    const src = tag.match(SRC_PATTERN)?.[1]?.trim();
    if (!src || seen.has(src)) continue;
    seen.add(src);
    sources.push(src);
  }

  return sources;
}

/**
 * Проставляет `width`/`height` картинкам описания по замеренным пропорциям
 * (`src` → width/height). Кадры с объявленными размерами и незамеренные
 * (таймаут, ошибка загрузки, SSR) остаются как есть — раскладка для них
 * работает по прежнему фолбэку.
 */
export function annotateImageSizes(
  html: string | null | undefined,
  aspects: Map<string, number>
): string {
  if (!html || typeof html !== 'string') return html ?? '';
  if (!aspects.size) return html;

  return html.replace(IMG_TAG_PATTERN, (tag) => {
    if (HAS_WIDTH_PATTERN.test(tag) && HAS_HEIGHT_PATTERN.test(tag)) return tag;

    const src = tag.match(SRC_PATTERN)?.[1]?.trim();
    if (!src) return tag;

    const aspect = aspects.get(src);
    if (!aspect || !Number.isFinite(aspect) || aspect <= 0) return tag;

    const height = Math.max(1, Math.round(ANNOTATED_WIDTH / aspect));
    return tag.replace(/\s*\/?>$/, ` width="${ANNOTATED_WIDTH}" height="${height}">`);
  });
}
