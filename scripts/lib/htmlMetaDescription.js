// #2689: app/+html.tsx declares a site-wide default
// `<meta name="description">` so a route that renders no Helmet description
// still ships one. Expo Router's static export does not dedupe that shell tag
// against the page's own Helmet tag (`data-rh="true"`), so every page with a
// Head description is exported with TWO. scripts/generate-seo-pages.js
// rewrites the description only for the routes it owns (injectMeta /
// replaceOrInsert), and every other exported route — /app, the 404 page,
// localized fallbacks — kept the duplicate.
//
// normalizeMetaDescription() closes the family for every HTML file: it keeps
// the page-owned (data-rh) description, or the first one when no page owns
// it, and strips the rest. It runs in the last full pass over dist
// (scripts/add-cache-bust-meta.js); scripts/guard-html-meta-description.js is
// the regression control.

const META_DESCRIPTION_RE = /<meta\b[^>]*\bname\s*=\s*(?:"description"|'description')[^>]*>/gi
const PAGE_OWNED_RE = /\bdata-rh\s*=/i

function countMetaDescriptions(html) {
  return (String(html).match(META_DESCRIPTION_RE) || []).length
}

function normalizeMetaDescription(html) {
  const tags = html.match(META_DESCRIPTION_RE)
  if (!tags || tags.length <= 1) return html

  const keepIndex = Math.max(0, tags.findIndex((tag) => PAGE_OWNED_RE.test(tag)))
  let index = -1
  return html.replace(META_DESCRIPTION_RE, (tag) => {
    index += 1
    return index === keepIndex ? tag : ''
  })
}

module.exports = { countMetaDescriptions, normalizeMetaDescription }
