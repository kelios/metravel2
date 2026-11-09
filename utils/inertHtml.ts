import {
  escapeHtmlText,
  serializeStartTag,
  tokenizeHtml,
  type HtmlAttribute,
} from '@/utils/htmlTokens'

/**
 * #3202: последний рубеж перед web-стоком rich-text.
 *
 * Строка разбирается на токены и собирается заново: текст и значения атрибутов
 * экранируются, каждое значение — в двойных кавычках. Исполняемое выбрасывается
 * независимо от того, кто и как чистил вход: `on*`, атрибуты с невалидным именем,
 * `srcdoc`, опасные URL; `script`/`style`/`svg`/… вместе с содержимым; комментарии.
 *
 * Безопасность не зависит от того, совпал ли наш разбор с браузерным: на выходе нет
 * ни одной конструкции, которую браузер прочёл бы иначе, чем мы её записали
 * (сырого текста элементов `script`/`textarea`/… и комментариев в выходе нет;
 * `iframe` выводится только пустым).
 */

declare const inertHtmlBrand: unique symbol
export type InertHtml = string & { readonly [inertHtmlBrand]: true }

// Выбрасываются вместе с содержимым: исполняемое, меняющее документ или режим
// разбора браузера (rawtext/RCDATA, foreign content).
const DROP_WITH_CONTENT = new Set([
  'script', 'style', 'object', 'embed', 'applet', 'base', 'link', 'meta', 'textarea', 'title',
  'xmp', 'noembed', 'noframes', 'noscript', 'plaintext', 'svg', 'math', 'template', 'frameset',
  'frame', 'portal',
])
// Их содержимое токенизатор отдаёт отдельным rawtext-токеном, вложенных тегов нет.
const RAW_TEXT_DROPPED = new Set(['script', 'style', 'xmp', 'noembed', 'noframes', 'noscript', 'textarea', 'title', 'plaintext'])
// Сам тег не нужен, содержимое остаётся.
const DROP_TAG_ONLY = new Set(['html', 'head', 'body'])
const VOID_ELEMENTS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'frame', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source',
  'track', 'wbr',
])
const VALID_TAG_NAME_RE = /^[a-z][a-z0-9-]*$/
const VALID_ATTRIBUTE_NAME_RE = /^[A-Za-z_:][-A-Za-z0-9_:.]*$/
const URL_ATTRIBUTES = new Set([
  'href', 'src', 'xlink:href', 'formaction', 'action', 'poster', 'background', 'cite', 'data',
  'longdesc', 'lowsrc', 'dynsrc', 'ping', 'codebase', 'manifest', 'itemid',
])
// Зеркалит ALLOWED_IFRAME_HOSTS полного санитайзера (utils/sanitizeRichText.ts).
const ALLOWED_IFRAME_SRC_RE =
  /^https?:\/\/(?:www\.)?(?:youtube(?:-nocookie)?\.com|youtu\.be|player\.vimeo\.com|instagram\.com|google\.com)\//i

// Именованные ссылки, которыми можно собрать схему URL: буквы схемы именованными
// ссылками не записываются, остаются разделитель и пробельные символы.
const URL_NAMED_REFERENCES: Record<string, string> = {
  colon: ':', tab: '\t', newline: '\n', nbsp: '\u00a0', amp: '&',
}

const decodeUrlReferences = (raw: string): string =>
  raw.replace(/&(?:#(\d+)|#[xX]([0-9a-fA-F]+)|([A-Za-z]+));?/g, (match, dec, hex, named) => {
    if (dec || hex) {
      const code = Number.parseInt(dec ?? hex, dec ? 10 : 16)
      return Number.isFinite(code) && code <= 0x10ffff ? String.fromCodePoint(code) : ''
    }
    return URL_NAMED_REFERENCES[String(named).toLowerCase()] ?? match
  })

const isIgnoredUrlCodeUnit = (code: number): boolean => code <= 0x20 || (code >= 0x7f && code <= 0xa0)

/** Нормализованный для сравнения URL: браузер игнорирует управляющие и пробельные символы. */
const compactUrl = (raw: string): string => {
  const decoded = decodeUrlReferences(raw)
  let out = ''
  for (let i = 0; i < decoded.length; i += 1) {
    if (!isIgnoredUrlCodeUnit(decoded.charCodeAt(i))) out += decoded[i]
  }
  return out.toLowerCase()
}

// Схема уже определена первыми символами — ссылки на символы её не поменяют.
const PLAIN_SAFE_URL_RE = /^(?:https?:\/\/|\/|#|\?|[a-z0-9_-]+(?:[/.?#]|$))/i

const isBlockedUrl = (raw: string): boolean => {
  if (PLAIN_SAFE_URL_RE.test(raw)) return false
  const compact = compactUrl(raw)
  if (/^(?:javascript|vbscript):/.test(compact)) return true
  return compact.startsWith('data:') && !compact.startsWith('data:image/')
}

/** Кандидаты `srcset` по правилам HTML: URL до пробела, дескрипторы до запятой. */
const filterSrcset = (raw: string): string | null => {
  const kept: string[] = []
  let changed = false
  const length = raw.length
  let i = 0
  while (i < length) {
    while (i < length && /[\s,]/.test(raw[i])) i += 1
    if (i >= length) break
    const urlStart = i
    while (i < length && !/\s/.test(raw[i])) i += 1
    let url = raw.slice(urlStart, i)
    let descriptors = ''
    if (url.endsWith(',')) {
      url = url.replace(/,+$/, '')
    } else {
      const descriptorStart = i
      let depth = 0
      while (i < length && (depth > 0 || raw[i] !== ',')) {
        if (raw[i] === '(') depth += 1
        else if (raw[i] === ')') depth = Math.max(0, depth - 1)
        i += 1
      }
      descriptors = raw.slice(descriptorStart, i).trim()
    }
    if (isBlockedUrl(url)) changed = true
    else kept.push(descriptors ? `${url} ${descriptors}` : url)
  }
  if (!changed) return raw
  return kept.length ? kept.join(', ') : null
}

// #3262: подмена глобальных имён через DOM. `name` у img/iframe/form/embed/object
// становится свойством document и window — оставляем его только у `<a>` (якорь
// старого формата, его ищет scrollToHashTarget; именованным свойством он не
// становится). `id` — якоря заголовков и ссылки `#…`, поэтому значения сохраняются;
// выбрасываются только `__…` — пространство глобальных имён приложения (`__metravel*`).
const isClobberingIdentity = (tagName: string, attr: HtmlAttribute): boolean =>
  (attr.name === 'name' && tagName !== 'a') || (attr.name === 'id' && (attr.value ?? '').startsWith('__'))

const sanitizeAttributes = (tagName: string, attrs: readonly HtmlAttribute[]): HtmlAttribute[] => {
  const out: HtmlAttribute[] = []
  for (const attr of attrs) {
    const name = attr.name
    if (!VALID_ATTRIBUTE_NAME_RE.test(name) || name.startsWith('on') || name === 'srcdoc') continue
    if (isClobberingIdentity(tagName, attr)) continue
    if (attr.value !== null && URL_ATTRIBUTES.has(name) && isBlockedUrl(attr.value)) continue
    if (attr.value !== null && (name === 'srcset' || name === 'imagesrcset')) {
      const value = filterSrcset(attr.value)
      if (value !== null) out.push({ name, value })
      continue
    }
    out.push({ name, value: attr.value })
  }
  return out
}

const isAllowedIframe = (attrs: readonly HtmlAttribute[]): boolean => {
  const src = attrs.find((attr) => attr.name === 'src')?.value
  return typeof src === 'string' && ALLOWED_IFRAME_SRC_RE.test(decodeUrlReferences(src).trim())
}

export function toInertHtml(html: string | null | undefined): InertHtml {
  const source = String(html ?? '')
  if (!source) return '' as InertHtml
  let out = ''
  // Глубина выбрасываемого элемента (по одноимённым тегам): пока она > 0, вывода нет.
  let dropName: string | null = null
  let dropDepth = 0

  for (const token of tokenizeHtml(source)) {
    if (dropName !== null) {
      if (token.kind === 'start' && token.name === dropName && !token.selfClosing) dropDepth += 1
      else if (token.kind === 'end' && token.name === dropName) dropDepth -= 1
      if (dropDepth === 0) dropName = null
      continue
    }
    switch (token.kind) {
      case 'text':
        out += escapeHtmlText(source.slice(token.start, token.end))
        break
      case 'start': {
        const { name } = token
        if (DROP_WITH_CONTENT.has(name)) {
          const opensContent = !VOID_ELEMENTS.has(name) && !token.selfClosing
          if (opensContent && !RAW_TEXT_DROPPED.has(name)) {
            dropName = name
            dropDepth = 1
          }
          break
        }
        if (!VALID_TAG_NAME_RE.test(name) || DROP_TAG_ONLY.has(name)) break
        const attrs = sanitizeAttributes(name, token.attrs)
        if (name === 'iframe') {
          if (isAllowedIframe(attrs)) out += `${serializeStartTag(name, attrs)}</iframe>`
          break
        }
        out += serializeStartTag(name, attrs)
        break
      }
      case 'end':
        // `</iframe>` уже выведен вместе с открывающим тегом.
        if (token.closesRawText || token.name === 'iframe') break
        if (DROP_WITH_CONTENT.has(token.name) || DROP_TAG_ONLY.has(token.name)) break
        if (!VALID_TAG_NAME_RE.test(token.name) || VOID_ELEMENTS.has(token.name)) break
        out += `</${token.name}>`
        break
      default:
        // rawtext (содержимое script/style/iframe/…) и комментарии не выводятся.
        break
    }
  }
  return out as InertHtml
}

/** Единственный допустимый источник `dangerouslySetInnerHTML` для rich-text (#3202). */
export const inertMarkup = (html: InertHtml): { __html: InertHtml } => ({ __html: html })
