// #3237: `alt` картинок тела статьи. Подпись фото в редакторе статьи и есть
// `alt` картинки (manifest `media.article_body[*].alt` повторяет его же), поэтому
// единственный честный источник — сам атрибут. Подписи нет — `alt=""`: картинка
// без описания, но с явным атрибутом. Текст вместо подписи не выдумываем
// (раньше клиент писал «Изображение маршрута N», а серверный HTML — ничего).

import { getAttribute, rewriteStartTags, setAttribute, type HtmlAttribute } from '@/utils/htmlTokens'

/** Правит разобранные атрибуты одного `<img>`; `true` — атрибут изменён. */
export const applyRichTextImageAlt = (attrs: HtmlAttribute[]): boolean => {
  const alt = getAttribute(attrs, 'alt')
  if (typeof alt === 'string' && alt.trim()) return false
  if (alt === '') return false
  setAttribute(attrs, 'alt', '')
  return true
}

/** Каждый `<img>` в HTML получает `alt`: подпись автора или пустой. */
export const ensureRichTextImageAlt = (html: string): string =>
  rewriteStartTags(html, ['img'], ({ attrs }) => (applyRichTextImageAlt(attrs) ? undefined : false))
