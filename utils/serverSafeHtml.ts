import type { ServerRichTextBlock } from '@/types/types'

// #710/#709: серверный canonical rich-text (rich_text.*.safe_html).
// Бэкенд уже санитизировал этот HTML, поэтому полный клиентский pipeline
// (normalizeArticleEditorHtmlForInput + sanitize-html) для него не запускается.
// Но серверу не доверяем слепо: дешёвый финальный guard срезает исполняемые
// вектора — script/style-блоки, on*-атрибуты, javascript:/vbscript:/data:text-URL
// и iframe с не-allowlisted хостов.

const BLOCKED_TAG_BLOCK_RE = /<(script|style)\b[\s\S]*?<\/\1\s*>/gi
const BLOCKED_TAG_STRAY_RE = /<\/?(script|style|object|embed|base)\b[^>]*>/gi
const IFRAME_RE = /<iframe\b[^>]*>[\s\S]*?<\/iframe\s*>|<iframe\b[^>]*\/?>/gi
const ON_ATTR_RE = /\son[a-z0-9_-]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi
const URL_ATTR_RE = /\s(href|src|xlink:href|formaction|action)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/gi
// Зеркалит ALLOWED_IFRAME_HOSTS полного санитайзера (utils/sanitizeRichText.ts).
const ALLOWED_IFRAME_SRC_RE =
  /^https?:\/\/(?:www\.)?(?:youtube(?:-nocookie)?\.com|youtu\.be|player\.vimeo\.com|instagram\.com|google\.com)\//i

const isBlockedUrlValue = (value: string): boolean => {
  const compact = String(value || '')
    .replace(/[\s\u0000-\u001f\u007f]+/g, '') // eslint-disable-line no-control-regex
    .toLowerCase()
  return /^(?:javascript|vbscript):/.test(compact) || compact.startsWith('data:text')
}

const cleanTagAttributes = (tag: string): string =>
  tag
    .replace(ON_ATTR_RE, '')
    .replace(URL_ATTR_RE, (full, _attr, _quoted, doubleQuoted, singleQuoted, bare) =>
      isBlockedUrlValue(doubleQuoted ?? singleQuoted ?? bare ?? '') ? '' : full,
    )

export const guardServerSafeHtml = (html: string): string => {
  const source = String(html || '')
  if (!source) return ''

  let out = source.replace(BLOCKED_TAG_BLOCK_RE, '').replace(BLOCKED_TAG_STRAY_RE, '')

  out = out.replace(IFRAME_RE, (frame) => {
    const srcMatch = frame.match(/\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)')/i)
    const src = (srcMatch?.[1] ?? srcMatch?.[2] ?? '').trim()
    return ALLOWED_IFRAME_SRC_RE.test(src) ? frame : ''
  })

  return out.replace(/<[a-z][^>]*>/gi, cleanTagAttributes)
}

export type ResolvedRichTextHtml = {
  html: string
  /** true — html пришёл как canonical safe_html с бэка (#709) */
  serverSanitized: boolean
}

// Выбор источника HTML для рендера: серверный safe_html, если он есть и непустой,
// иначе legacy-поле (старый payload) с полным клиентским pipeline.
export const resolveServerRichTextHtml = (
  block: ServerRichTextBlock | null | undefined,
  fallbackHtml: string | null | undefined,
): ResolvedRichTextHtml => {
  const safeHtml = typeof block?.safe_html === 'string' ? block.safe_html : ''
  if (safeHtml.trim()) {
    return { html: safeHtml, serverSanitized: true }
  }
  return { html: fallbackHtml ?? '', serverSanitized: false }
}
