'use strict'

/**
 * Internal article links inside a travel's rich-text fields (#3330).
 *
 * `scripts/seo-fix-links.js` used to read and rewrite `description` only, so a
 * link sitting in `recommendation` went through a 301 forever while the dry-run
 * printed «0». Everything that touches those links — the rewrite, the
 * post-write regression check, the corruption check and the live completeness
 * check — now walks the same field list through the same scanner, so a field
 * cannot be handled by one step and invisible to another.
 *
 * The list is the set of rich-text fields `PUT /api/travels/upsert/` accepts
 * (`buildUpsertPayload` in `scripts/seo-edit.js`). `rich_text.*` in the detail
 * is a read-only projection of the same four fields and `url` is the article's
 * own address — neither is a place a link can be fixed in.
 */
const TRAVEL_LINK_FIELDS = Object.freeze(['description', 'recommendation', 'plus', 'minus'])

const DERIVED_FIELD_PREFIXES = Object.freeze(['rich_text', 'url'])

const LINK_PATTERN = '/travels/([a-z0-9-]+)'
// What can stand glued to the left of `/travels/` and still be part of the same
// address: scheme, host, a parent path. Anything else (quote, `=`, `>`, space,
// Cyrillic prose) ends the address.
const ADDRESS_CHAR = /[A-Za-z0-9:/.\-_~%@]/
const OWN_HOST = /(?:^|[^A-Za-z0-9.-])(?:https?:\/\/)?(?:www\.)?metravel\.by$/i
const SLUG_CONTINUATION = /[A-Za-z0-9_%]/

/**
 * Every `/travels/<slug>` of our own site in a piece of HTML or text.
 *
 * A relative address and one on `metravel.by` (any scheme, with or without
 * `www`) are ours; the same path on another host or nested under another path
 * (`https://example.com/travels/x`, `/blog/travels/x`) is not, and probing or
 * rewriting it against our slugs would be a false hit. `partial` marks a slug
 * the pattern could not read to its end (`/travels/Foo`, `/travels/a_b`): it is
 * never rewritten, and the completeness check reports it instead of probing a
 * truncated address.
 */
function scanTravelLinks(html) {
  const text = String(html || '')
  const links = []
  const pattern = new RegExp(LINK_PATTERN, 'g')
  for (let match = pattern.exec(text); match; match = pattern.exec(text)) {
    let start = match.index
    while (start > 0 && ADDRESS_CHAR.test(text[start - 1])) start--
    const prefix = text.slice(start, match.index)
    if (prefix && !OWN_HOST.test(prefix)) continue
    const end = match.index + match[0].length
    links.push({
      slug: match[1],
      slugStart: end - match[1].length,
      end,
      partial: SLUG_CONTINUATION.test(text[end] || ''),
    })
  }
  return links
}

/**
 * Replace every stale internal slug with its current one.
 * @returns {{ html: string, count: number }} count = links rewritten
 */
function rewriteLinks(html, slugMap) {
  const text = String(html || '')
  let out = ''
  let cursor = 0
  let count = 0
  for (const link of scanTravelLinks(text)) {
    const to = link.partial ? null : slugMap.get(link.slug)
    if (!to) continue
    out += text.slice(cursor, link.slugStart) + to
    cursor = link.end
    count++
  }
  return { html: count ? out + text.slice(cursor) : text, count }
}

/**
 * Rewrite all link-carrying fields of one article.
 * `changes` holds only the fields that actually changed, keyed the way
 * `buildUpsertPayload` takes its overrides.
 */
function rewriteTravelFields(detail, slugMap) {
  const changes = {}
  const counts = {}
  let total = 0
  for (const field of TRAVEL_LINK_FIELDS) {
    const { html, count } = rewriteLinks(detail && detail[field], slugMap)
    if (!count) continue
    changes[field] = html
    counts[field] = count
    total += count
  }
  return { changes, counts, total }
}

/** Every internal link of an article with the field it sits in. */
function collectTravelLinks(detail) {
  const links = []
  for (const field of TRAVEL_LINK_FIELDS) {
    for (const link of scanTravelLinks(detail && detail[field])) {
      links.push({ field, slug: link.slug, partial: link.partial })
    }
  }
  return links
}

/**
 * Paths of string values OUTSIDE the handled fields that still carry an internal
 * article link. A new rich-text field added by the backend lands here, so the
 * completeness check goes red instead of reporting a clean «0» it cannot see.
 */
function findUnhandledLinkFields(detail) {
  const found = new Set()
  const skip = new Set([...TRAVEL_LINK_FIELDS, ...DERIVED_FIELD_PREFIXES])
  const walk = (value, trail) => {
    if (typeof value === 'string') {
      if (scanTravelLinks(value).length) found.add(trail)
    } else if (Array.isArray(value)) {
      for (const item of value) walk(item, `${trail}[]`)
    } else if (value && typeof value === 'object') {
      for (const [key, child] of Object.entries(value)) walk(child, trail ? `${trail}.${key}` : key)
    }
  }
  for (const [key, value] of Object.entries(detail || {})) {
    if (!skip.has(key)) walk(value, key)
  }
  return [...found].sort()
}

module.exports = {
  TRAVEL_LINK_FIELDS,
  collectTravelLinks,
  findUnhandledLinkFields,
  rewriteLinks,
  rewriteTravelFields,
  scanTravelLinks,
}
