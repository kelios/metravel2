import {
  appendClassAttribute,
  editFirstStartTag,
  findFirstStartTag,
  getAttribute,
  setAttribute,
  type HtmlAttribute,
} from '@/utils/htmlTokens'

// Вынесено из `htmlTransform.ts` (#3202): правки атрибутов рамки идут по
// разобранному тегу, а не регулярками по строке.

// Тело открывающего тега с учётом кавычек: `>` внутри значения не закрывает тег.
const TAG_BODY = String.raw`(?:[^>"']|"[^"]*"|'[^']*')*`
const P_IMAGE_ONLY_RE = new RegExp(
  String.raw`(<p\b${TAG_BODY}>)(\s*<img\b${TAG_BODY}>\s*(?:<br\s*\/?>\s*)?)<\/p>`,
  'gi',
)
const FIGURE_WITH_IMAGE_RE = new RegExp(
  String.raw`(<figure\b${TAG_BODY}>)([\s\S]*?<img\b${TAG_BODY}>[\s\S]*?)<\/figure>`,
  'gi',
)

/** Теги без закрывающей пары — они не меняют глубину вложенности при обходе. */
const VOID_HTML_TAGS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr',
])

const DIGITS_RE = /^\d+$/

const firstImageAttrs = (markup: string): HtmlAttribute[] | null => findFirstStartTag(markup, 'img')?.attrs ?? null

const hasImageSource = (markup: string): boolean => Boolean(getAttribute(firstImageAttrs(markup) ?? [], 'src'))

const buildRichImageAspectDeclaration = (imgMarkup: string) => {
  const attrs = firstImageAttrs(imgMarkup) ?? []
  const widthValue = getAttribute(attrs, 'width') ?? ''
  const heightValue = getAttribute(attrs, 'height') ?? ''
  const width = DIGITS_RE.test(widthValue) ? Number(widthValue) : 0
  const height = DIGITS_RE.test(heightValue) ? Number(heightValue) : 0
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return ''
  }
  return `--travel-rich-image-aspect:${width}/${height}`
}

const appendStyleDeclaration = (attrs: HtmlAttribute[], declaration: string) => {
  const current = getAttribute(attrs, 'style')
  if (current === undefined) {
    attrs.push({ name: 'style', value: declaration })
    return
  }
  const style = current ?? ''
  if (style.includes(declaration)) return
  const nextStyle = style.trim().replace(/;$/, '')
  setAttribute(attrs, 'style', nextStyle ? `${nextStyle};${declaration}` : declaration)
}

/** Рамка несёт только геометрию — см. `decorateRichImageFrames`. */
const decorateFrameTag = (openingTag: string, tagName: 'p' | 'figure', imgMarkup: string) =>
  editFirstStartTag(openingTag, tagName, (attrs) => {
    appendClassAttribute(attrs, 'rich-image-frame')
    const frameDeclaration = buildRichImageAspectDeclaration(imgMarkup)
    if (frameDeclaration) appendStyleDeclaration(attrs, frameDeclaration)
  })

/**
 * Диапазоны `<img>`, лежащих в КОРНЕ описания, а не внутри `<p>`/`<figure>`/строки
 * галереи.
 *
 * #1188: `decorateRichImageFrames` умел оборачивать только картинку внутри абзаца
 * или `<figure>`, а редакторская разметка сплошь и рядом кладёт `<img>` прямо между
 * заголовками — соседями `H2`/`H3`/`P`. Замер прода 2026-07-31 на статье о
 * заброшенных дворцах: 37 картинок тела, 0 в `.rich-image-frame`, то есть блюр-фона
 * не было ни у одной, и портрет 374×499 в зарезервированном слоте 16:9 оставлял
 * 59% площади пустой белой.
 *
 * Глубину считаем обходом тегов: обёртки (журнальные сетки и instagram-карточки)
 * поднимают её выше нуля, поэтому их содержимое сюда не попадает и раскладка не меняется.
 */
const collectRootLevelImageRanges = (html: string): Array<[number, number]> => {
  const ranges: Array<[number, number]> = []
  const tagPattern = new RegExp(String.raw`<(\/?)([a-z][a-z0-9]*)\b${TAG_BODY}?(\/?)>`, 'gi')
  let depth = 0
  let match: RegExpExecArray | null

  while ((match = tagPattern.exec(html)) !== null) {
    const [tag, closing, rawName, selfClosing] = match
    const name = rawName.toLowerCase()

    if (name === 'img') {
      if (!closing && depth === 0) ranges.push([match.index, match.index + tag.length])
      continue
    }
    if (VOID_HTML_TAGS.has(name) || selfClosing === '/') continue

    if (closing) depth = Math.max(0, depth - 1)
    else depth += 1
  }

  return ranges
}

/**
 * #1265: `<img>`, оставленный редактором ВНУТРИ заголовка.
 *
 * `collectRootLevelImageRanges` считает такую картинку вложенной (глубина 1), а под
 * правила `<p>`/`<figure>` она не подходит — то есть рамки не получает вовсе.
 * Замер прода 2026-08-05, `/travels/reka-isloch-…`: разметка
 * `<h2 id="…"><img src="…0164614223…"></h2>`, у кадра нет ни заливки полей
 * (`rgba(0, 0, 0, 0)`), ни принятия натуральных пропорций после загрузки, тогда как
 * соседний кадр в `<p>` получает и то, и другое.
 *
 * Картинку выносим ПОСЛЕ заголовка, а сам заголовок оставляем на месте даже пустым:
 * его `id` — цель якоря и оглавления, и удаление ломало бы навигацию по статье.
 * Дальше вынесенный `<p>` проходит обычным правилом абзаца.
 */
const liftHeadingImages = (html: string): string =>
  html.replace(
    /<(h[1-6])(\b[^>]*)>([\s\S]*?)<\/\1>/gi,
    (match, tag: string, attrs = '', inner = '') => {
      const images = inner.match(/<img\b[^>]*>/gi)
      if (!images?.length) return match
      // Картинку-ссылку не трогаем: вынос из заголовка оторвал бы её от `<a>`, то
      // есть отнял бы переход. Такой кадр остаётся как был — без рамки, но кликабельным.
      if (/<a\b/i.test(inner)) return match
      const rest = inner.replace(/<img\b[^>]*>/gi, '')
      const lifted = images.map((img: string) => `<p>${img}</p>`).join('')
      return `<${tag}${attrs}>${rest}</${tag}>${lifted}`
    },
  )

export const decorateRichImageFrames = (html: string) => {
  if (!html) return html

  const wrapRootLevelImages = (input: string) => {
    const ranges = collectRootLevelImageRanges(input)
    if (ranges.length === 0) return input

    let out = ''
    let cursor = 0
    for (const [start, end] of ranges) {
      const imgMarkup = input.slice(start, end)
      out += `${input.slice(cursor, start)}${decorateFrameTag('<p>', 'p', imgMarkup)}${imgMarkup}</p>`
      cursor = end
    }
    return out + input.slice(cursor)
  }

  // Рамка несёт только геометрию: URL фотографии в inline-CSS сделал бы из неё
  // второй растр слота и обошёл бы `loading="lazy"` у самого `<img>` (#1208/#1213).
  return wrapRootLevelImages(
    liftHeadingImages(html)
      .replace(P_IMAGE_ONLY_RE, (match, openingTag: string, inner: string) =>
        hasImageSource(inner) ? `${decorateFrameTag(openingTag, 'p', inner)}${inner}</p>` : match)
      .replace(FIGURE_WITH_IMAGE_RE, (match, openingTag: string, inner: string) =>
        hasImageSource(inner) ? `${decorateFrameTag(openingTag, 'figure', inner)}${inner}</figure>` : match),
  )
}
