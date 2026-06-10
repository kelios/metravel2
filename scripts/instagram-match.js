// scripts/instagram-match.js
// Match Instagram posts to the owner's travel articles by GPS proximity + caption
// place-name corroboration. Produces a reviewable table BEFORE anything is published.
//
// Inputs (from .cache/instagram/):
//   export-posts.json  — posts with caption + GPS (from the data export)   [required]
//   articles.json      — owner articles with map points (lat/lng+address)  [required]
//   media.json         — Graph API posts with permalink + caption          [optional]
//                        (when present, permalinks are joined onto matches)
// Outputs:
//   matches.json  — machine-readable matches
//   matches.md    — human-readable table grouped by article
const fs = require('fs')
const path = require('path')

const DIR = path.join(process.cwd(), '.cache', 'instagram')
const DIRECT_KM = 2.0 // point essentially at the post location → strong match
const NEAR_KM = 12.0 // same area → needs caption place-name corroboration
const LISTICLE_POINTS = 8 // articles with >= this many points are roundups

function readJson(name) {
  const p = path.join(DIR, name)
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : null
}

function haversineKm(a, b) {
  const R = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const la1 = (a.lat * Math.PI) / 180
  const la2 = (b.lat * Math.PI) / 180
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

// A post is a repost of someone else's content when it carries the Instagram
// "#Repost @account" / "Regram" credit convention. These are NOT the owner's
// own photos, so they must never be embedded into her articles.
function isRepost(caption) {
  const c = String(caption || '')
  return /(^|[^\w])#?\s*repost\b/i.test(c) || /regram/i.test(c)
}

const STOP = new Set(
  'и в во на по за из от до для с со о об у к а но или это что как где беларусь belarus travel путешествие маршрут день один'.split(
    /\s+/
  )
)
function tokens(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-zа-яё0-9\s]/gi, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !STOP.has(w))
}

function captionMentions(caption, article) {
  const capTokens = new Set(tokens(caption))
  const names = [article.name, ...article.points.map((p) => p.address)].join(' ')
  const hits = tokens(names).filter((w) => capTokens.has(w))
  return [...new Set(hits)]
}

// Normalize a caption for joining export ↔ Graph posts.
function capKey(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80)
}

function main() {
  const exp = readJson('export-posts.json')
  const arts = readJson('articles.json')
  if (!exp || !arts) {
    console.error('Missing .cache/instagram/export-posts.json or articles.json. Run instagram-export-geo.js and fetch articles first.')
    process.exit(1)
  }
  const media = readJson('media.json')

  // Build permalink lookup by caption key + by ts (for later join).
  const permByCap = new Map()
  const permByTs = new Map()
  if (media && Array.isArray(media.media)) {
    for (const m of media.media) {
      if (!m.permalink) continue
      if (m.caption) permByCap.set(capKey(m.caption), m.permalink)
      if (m.ts) permByTs.set(m.ts, m.permalink)
    }
  }
  const findPermalink = (post) => {
    if (post.caption && permByCap.has(capKey(post.caption))) return permByCap.get(capKey(post.caption))
    if (post.ts) {
      // nearest ts within 6h
      let best = null
      let bestD = Infinity
      for (const [ts, link] of permByTs) {
        const d = Math.abs(ts - post.ts)
        if (d < bestD) {
          bestD = d
          best = link
        }
      }
      if (best && bestD <= 6 * 3600) return best
    }
    return ''
  }

  // Pre-flatten article points.
  const articles = arts.articles.map((a) => ({
    ...a,
    pts: a.points.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng)),
    isListicle: a.points.length >= LISTICLE_POINTS,
  }))

  const allGeoPosts = exp.posts.filter((p) => p.geo)
  const geoPosts = allGeoPosts.filter((p) => !isRepost(p.caption))
  const skippedReposts = allGeoPosts.length - geoPosts.length
  const matches = []
  let matched = 0

  for (const post of geoPosts) {
    let best = null
    for (const a of articles) {
      for (const pt of a.pts) {
        const dist = haversineKm(post.geo, pt)
        if (!best || dist < best.dist) best = { article: a, pt, dist }
      }
    }
    if (!best) continue

    const mentions = captionMentions(post.caption, best.article)
    let confidence = ''
    if (best.dist <= DIRECT_KM) confidence = mentions.length ? 'high' : 'medium'
    else if (best.dist <= NEAR_KM && mentions.length) confidence = 'medium'
    else if (best.dist <= NEAR_KM) confidence = 'low'

    if (!confidence) continue
    matched += 1
    matches.push({
      ts: post.ts,
      date: post.dateISO.slice(0, 10),
      caption: post.caption.replace(/\s+/g, ' ').trim(),
      geo: post.geo,
      mediaCount: post.mediaCount,
      permalink: findPermalink(post),
      articleId: best.article.id,
      articleName: best.article.name,
      articleSlug: best.article.slug,
      matchedAddress: best.pt.address,
      distanceKm: Number(best.dist.toFixed(2)),
      isListicle: best.article.isListicle,
      mentions,
      confidence,
    })
  }

  // The Instagram data export duplicates some posts, so the same post can match
  // the same article several times. Collapse to one embed per (article, post),
  // keeping the closest/most-confident occurrence.
  const rank = { high: 0, medium: 1, low: 2 }
  const bestByKey = new Map()
  for (const mt of matches) {
    const key = `${mt.articleId}|${mt.permalink || mt.ts}`
    const prev = bestByKey.get(key)
    if (!prev || rank[mt.confidence] < rank[prev.confidence] || (mt.confidence === prev.confidence && mt.distanceKm < prev.distanceKm)) {
      bestByKey.set(key, mt)
    }
  }
  const dedupedBefore = matches.length
  matches.length = 0
  matches.push(...bestByKey.values())
  matched = matches.length
  const removedDups = dedupedBefore - matched

  // Group by article.
  const byArticle = new Map()
  for (const m of matches) {
    if (!byArticle.has(m.articleId)) byArticle.set(m.articleId, { name: m.articleName, slug: m.articleSlug, items: [] })
    byArticle.get(m.articleId).items.push(m)
  }

  fs.writeFileSync(path.join(DIR, 'matches.json'), JSON.stringify({ totalGeoPosts: geoPosts.length, matched, byArticleCount: byArticle.size, matches }, null, 2))

  // Markdown report.
  const conf = { high: 0, medium: 0, low: 0 }
  matches.forEach((m) => (conf[m.confidence] += 1))
  const lines = []
  lines.push(`# Instagram → статьи: предварительный подбор`)
  lines.push('')
  lines.push(`Постов с GPS: **${geoPosts.length}** · сматчено: **${matched}** · статей затронуто: **${byArticle.size}**`)
  lines.push(`Уверенность: high ${conf.high} · medium ${conf.medium} · low ${conf.low}`)
  lines.push(`Permalink'и подставлены: **${matches.filter((m) => m.permalink).length}/${matched}** ${media ? '' : '(media.json пока нет — появятся после токена)'}`)
  lines.push('')
  const sorted = [...byArticle.entries()].sort((a, b) => b[1].items.length - a[1].items.length)
  for (const [id, g] of sorted) {
    lines.push(`## [${id}] ${g.name}`)
    lines.push(`\`${g.slug}\` — постов: ${g.items.length}`)
    lines.push('')
    lines.push('| дата | conf | дист., км | точка | подпись | permalink |')
    lines.push('|---|---|---|---|---|---|')
    for (const m of g.items.sort((x, y) => x.distanceKm - y.distanceKm)) {
      const cap = m.caption.slice(0, 70).replace(/\|/g, '/')
      lines.push(`| ${m.date} | ${m.confidence} | ${m.distanceKm} | ${(m.matchedAddress || '').slice(0, 30)} | ${cap}… | ${m.permalink || '—'} |`)
    }
    lines.push('')
  }
  fs.writeFileSync(path.join(DIR, 'matches.md'), lines.join('\n'))

  console.log(`Skipped ${skippedReposts} reposts (#Repost/Regram — not owner's own photos).`)
  console.log(`Removed ${removedDups} duplicate (article, post) pairs from the export.`)
  console.log(`Matched ${matched} own posts across ${byArticle.size} articles.`)
  console.log(`  confidence: high ${conf.high} · medium ${conf.medium} · low ${conf.low}`)
  console.log(`  permalinks attached: ${matches.filter((m) => m.permalink).length}/${matched}`)
  console.log(`  → .cache/instagram/matches.md (review), matches.json`)
}

main()
