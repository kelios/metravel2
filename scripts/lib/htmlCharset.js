// HTML5 encoding sniffing only scans the first 1024 bytes of a document
// (https://html.spec.whatwg.org/multipage/parsing.html#prescan-a-byte-stream-to-determine-its-encoding).
// Expo Router's static export inserts React Helmet's per-page tags
// (`data-rh="true"`: title, description, og:*, twitter:*) at the START of
// <head>, ahead of the <head> children declared in app/+html.tsx:~517 —
// including `<meta charSet="utf-8" />`. On a page whose Helmet-managed
// description/og:description is long (Cyrillic is multi-byte in UTF-8), the
// charset meta lands past that 1024-byte window and the browser falls back to
// encoding-guessing, then re-parses once it later finds the real declaration
// (#2088).
//
// normalizeHeadCharset() strips every charset <meta> found anywhere in the
// document (any attribute casing/order, self-closing or not, including
// accidental duplicates) and reinserts exactly one as the very first child of
// <head>, keeping whatever charset value was originally declared.

const HEAD_OPEN_RE = /<head[^>]*>/i
const CHARSET_META_RE = /<meta\b[^>]*\bcharset\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'>]+)[^>]*\/?>/gi
const CHARSET_VALUE_RE = /charset\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/i

function normalizeHeadCharset(html) {
  const headMatch = HEAD_OPEN_RE.exec(html)
  if (!headMatch) return html

  const charsetMatches = html.match(CHARSET_META_RE)
  if (!charsetMatches || charsetMatches.length === 0) return html

  const valueMatch = CHARSET_VALUE_RE.exec(charsetMatches[0])
  const charsetValue = (valueMatch && (valueMatch[1] || valueMatch[2] || valueMatch[3])) || 'utf-8'

  const withoutCharset = html.replace(CHARSET_META_RE, '')
  const headIdx = withoutCharset.indexOf(headMatch[0])
  // Removing charset metas only touches content after the <head> open tag, so
  // it must still be found verbatim. Bail out rather than corrupt output if
  // that invariant is ever broken.
  if (headIdx === -1) return html

  const insertAt = headIdx + headMatch[0].length
  return `${withoutCharset.slice(0, insertAt)}<meta charset="${charsetValue}"/>${withoutCharset.slice(insertAt)}`
}

module.exports = { normalizeHeadCharset }
