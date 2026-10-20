const META_ROBOTS_RE = /<meta\b[^>]*\bname\s*=\s*(?:"robots"|'robots')[^>]*>/gi
const CONTENT_RE = /\bcontent\s*=\s*(?:"([^"]*)"|'([^']*)')/i

function isNoindex(html) {
  return (String(html).match(META_ROBOTS_RE) || []).some((tag) => {
    const match = CONTENT_RE.exec(tag)
    const content = match ? match[1] ?? match[2] : ''
    return content.toLowerCase().split(/[\s,]+/).includes('noindex')
  })
}

module.exports = { isNoindex }
