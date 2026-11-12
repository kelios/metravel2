/**
 * #3316: отложенные картинки — часть инертного прохода (`toInertHtml(html, { deferImages: true })`).
 *
 * Картинки серверного острова тела статьи не должны делить канал с LCP-фото.
 * `loading="lazy"` их не держит: под мобильным троттлингом Chrome грузит ленивые
 * картинки ближе 2500 px от экрана, а первые фото тела стоят на 1,7–2,3 тыс. px
 * (прод 12.11.2026, Lighthouse mobile, 1,6 Мбит/с: два кадра тела, 141 КБ, шли
 * вместе с hero с 1,5 с, LCP 4,7 с).
 *
 * Адрес картинки уходит в `data-deferred-*`, в `src` — прозрачная SVG-заглушка
 * той же пропорции: коробка кадра та же, что у загружающейся картинки, сети нет.
 * Сразу за картинкой — `<noscript>` с ней же по исходному адресу для читателя без
 * JS; браузер с JS разбирает его как текст. Вход — атрибуты, уже прошедшие
 * санитайз инертного прохода; чужие `data-deferred-*` выбрасываются, чужой
 * `noscript` инертный проход выбрасывает сам. Адреса возвращает
 * `utils/richTextDeferredImages.ts`.
 */

import { getAttribute, serializeStartTag, type HtmlAttribute } from '@/utils/htmlTokens'

/** Живой атрибут → отложенный. Порядок выдачи: `sizes`, `srcset`, затем `src`. */
export const DEFERRED_IMAGE_ATTRIBUTES = [
  ['sizes', 'data-deferred-sizes'],
  ['srcset', 'data-deferred-srcset'],
  ['src', 'data-deferred-src'],
] as const

export const DEFERRED_IMAGE_SELECTOR = 'img[data-deferred-src],img[data-deferred-srcset]'

const NOSCRIPT_IMAGE_ATTRIBUTES = ['src', 'srcset', 'sizes', 'alt', 'width', 'height'] as const

const DIGITS_RE = /^\d+$/
const positiveDimension = (value: string | null | undefined) =>
  value && DIGITS_RE.test(value) && Number(value) > 0 ? value : null

const placeholderSrc = (width: string | null, height: string | null) =>
  `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' ${
    width && height ? `viewBox='0 0 ${width} ${height}'` : "width='1' height='1'"
  }%2F%3E`

const isDeferredName = (name: string) => DEFERRED_IMAGE_ATTRIBUTES.some(([, deferred]) => deferred === name)
const nonEmpty = (value: string | null | undefined): value is string => typeof value === 'string' && value.trim() !== ''

/** Разметка `<img>` с санитизированными атрибутами: отложенная картинка и её `noscript`-двойник. */
export function serializeDeferredImage(sanitized: readonly HtmlAttribute[]): string {
  const attrs = sanitized.filter(({ name }) => !isDeferredName(name))
  const moved: HtmlAttribute[] = []
  for (const [live, deferred] of DEFERRED_IMAGE_ATTRIBUTES) {
    const value = getAttribute(attrs, live)
    if (nonEmpty(value)) moved.push({ name: deferred, value })
  }
  if (!moved.some(({ name }) => name !== 'data-deferred-sizes')) return serializeStartTag('img', attrs)

  const fallback: HtmlAttribute[] = []
  for (const name of NOSCRIPT_IMAGE_ATTRIBUTES) {
    const value = getAttribute(attrs, name)
    if (typeof value === 'string' && (name === 'alt' || nonEmpty(value))) fallback.push({ name, value })
  }
  fallback.push({ name: 'loading', value: 'lazy' })

  const kept = attrs.filter(({ name }) => name !== 'loading' && !DEFERRED_IMAGE_ATTRIBUTES.some(([live]) => live === name))
  const placeholder = placeholderSrc(positiveDimension(getAttribute(attrs, 'width')), positiveDimension(getAttribute(attrs, 'height')))
  const deferredTag = serializeStartTag('img', [
    ...kept,
    { name: 'src', value: placeholder },
    ...moved,
    { name: 'loading', value: 'lazy' },
  ])
  return `${deferredTag}<noscript>${serializeStartTag('img', fallback)}</noscript>`
}
