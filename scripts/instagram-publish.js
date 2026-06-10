// scripts/instagram-publish.js
// Append Instagram post embeds (the owner's own photos) to the relevant travel
// articles. Reads .cache/instagram/matches.json (produced by instagram-match.js),
// fetches each article, appends an "Instagram" section with iframe embeds for the
// matched posts, and saves via PUT /travels/upsert/ — exactly the shape the editor
// wizard sends, so map points / gallery / relations round-trip untouched.
//
// Safety:
//   - dry-run by default; pass --live to actually write.
//   - full GET backup of every touched article → .cache/instagram/backups/<id>.json
//   - idempotent: posts already embedded (by shortcode) are skipped.
//   - post-write verify: re-GET and assert point/gallery counts are unchanged.
//
// Auth: .secrets/metravel-token.json  { "token": "<userToken>" }  (author login).
//       The backend only lets the authenticated author edit her own articles.
//
// Usage:
//   node scripts/instagram-publish.js                       # dry-run, all (high+medium)
//   node scripts/instagram-publish.js --only 638            # dry-run, one article
//   node scripts/instagram-publish.js --only 638 --live     # write one article
//   node scripts/instagram-publish.js --live                # write all
//   flags: --min-confidence high|medium|low  --limit N
const fs = require('fs')
const path = require('path')

const DIR = path.join(process.cwd(), '.cache', 'instagram')
const BACKUP_DIR = path.join(DIR, 'backups')
const SECRET = path.join(process.cwd(), '.secrets', 'metravel-token.json')
const API_BASE = (process.env.EXPO_PUBLIC_API_URL || 'https://metravel.by').replace(/\/+$/, '') + '/api'
const MARKER = '<!-- metravel:instagram-embeds -->'
const CONF_RANK = { high: 0, medium: 1, low: 2 }

const argv = process.argv.slice(2)
const has = (f) => argv.includes(f)
const val = (f, d) => {
  const i = argv.indexOf(f)
  return i >= 0 && argv[i + 1] ? argv[i + 1] : d
}
const LIVE = has('--live')
const ONLY = val('--only', '')
const LIMIT = Number(val('--limit', '0')) || 0
const MIN_CONF = val('--min-confidence', 'medium')
const MAX_RANK = CONF_RANK[MIN_CONF] ?? 1

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'))
}
function token() {
  if (!fs.existsSync(SECRET)) {
    console.error(`Missing ${SECRET} — put { "token": "<userToken>" } there (see scripts/INSTAGRAM_SETUP.md, ключ 2).`)
    process.exit(1)
  }
  const t = readJson(SECRET).token
  if (!t) {
    console.error('metravel-token.json has no "token" field.')
    process.exit(1)
  }
  return t
}
function authHeaders(t) {
  return { Authorization: `Token ${t}`, 'Content-Type': 'application/json', Accept: 'application/json' }
}

// Instagram permalink → canonical post shortcode (works for /p/ and /reel/).
function shortcode(permalink) {
  const m = String(permalink || '').match(/instagram\.com\/(?:p|reel|tv)\/([A-Za-z0-9_-]+)/i)
  return m ? m[1] : ''
}
function embedHtml(permalink) {
  const code = shortcode(permalink)
  const src = `https://www.instagram.com/p/${code}/embed/captioned/`
  return `<p><iframe class="ql-video" frameborder="0" allowfullscreen="true" src="${src}" height="640"></iframe></p>`
}

// Map a GET /travels/{id}/ response to the upsert (TravelFormData) body, mirroring
// the wizard's transform+normalize. Relations → string-id arrays; coordsMeTravel and
// cover URLs round-trip as-is; gallery drops `order`.
function toIds(arr) {
  return (Array.isArray(arr) ? arr : [])
    .map((x) => (x && typeof x === 'object' ? x.id ?? x.country_id ?? x.pk ?? x.value : x))
    .filter((x) => x !== undefined && x !== null)
    .map((x) => String(x))
}
function buildUpsertBody(t, newDescription) {
  const gallery = (Array.isArray(t.gallery) ? t.gallery : [])
    .map((g) => (typeof g === 'string' ? { url: g } : { url: g.url, id: g.id }))
    .filter((g) => g.url && !/^blob:/.test(g.url))
  const galleryIds = gallery.map((g) => g.id).filter((id) => Number.isFinite(id))
  const coords = (Array.isArray(t.coordsMeTravel) ? t.coordsMeTravel : []).map((c) => ({
    id: c.id ?? null,
    lat: c.lat,
    lng: c.lng,
    country: c.country ?? null,
    address: c.address ?? '',
    categories: Array.isArray(c.categories) ? c.categories.map(Number).filter(Number.isFinite) : [],
    image: typeof c.image === 'string' && !/^blob:/.test(c.image) ? c.image : null,
  }))
  const cover = (u) => (typeof u === 'string' && !/^blob:/.test(u) ? u : null)
  const numOrNull = (v) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v))
  return {
    id: t.id,
    slug: t.slug,
    name: t.name,
    description: newDescription,
    plus: t.plus ?? null,
    minus: t.minus ?? null,
    recommendation: t.recommendation ?? null,
    youtube_link: t.youtube_link ?? t.youtubeLink ?? null,
    year: t.year != null ? String(t.year) : '',
    budget: numOrNull(t.budget),
    number_peoples: numOrNull(t.number_peoples),
    number_days: numOrNull(t.number_days),
    countries: toIds(t.countries),
    cities: toIds(t.cities),
    categories: toIds(t.categories),
    transports: toIds(t.transports),
    companions: toIds(t.companions),
    complexity: toIds(t.complexity),
    month: toIds(t.month),
    over_nights_stay: toIds(t.over_nights_stay),
    publish: Boolean(t.publish),
    moderation: Boolean(t.moderation),
    visa: Boolean(t.visa),
    coordsMeTravel: coords,
    gallery,
    thumbs200ForCollectionArr: galleryIds,
    travelImageThumbUrlArr: galleryIds,
    travelImageThumbUrArr: galleryIds,
    travelImageAddress: galleryIds,
    travel_image_thumb_url: cover(t.travel_image_thumb_url),
    travel_image_thumb_small_url: cover(t.travel_image_thumb_small_url),
  }
}

// Append (or extend) the Instagram embeds section, skipping already-embedded posts.
function appendEmbeds(description, posts) {
  const desc = String(description || '')
  const present = new Set()
  const re = /instagram\.com\/(?:p|reel|tv)\/([A-Za-z0-9_-]+)/gi
  let m
  while ((m = re.exec(desc))) present.add(m[1])
  const fresh = posts.filter((p) => {
    const code = shortcode(p.permalink)
    return code && !present.has(code)
  })
  if (!fresh.length) return { description: desc, added: 0 }
  // newest first reads best at the bottom of an article
  fresh.sort((a, b) => (b.ts || 0) - (a.ts || 0))
  const block = [
    MARKER,
    '<h2>Мои фото этих мест в Instagram</h2>',
    ...fresh.map((p) => embedHtml(p.permalink)),
  ].join('\n')
  return { description: `${desc.trim()}\n${block}`, added: fresh.length }
}

async function getArticle(id) {
  const r = await fetch(`${API_BASE}/travels/${id}/`, { headers: { Accept: 'application/json' } })
  if (!r.ok) throw new Error(`GET ${id} → ${r.status}`)
  return r.json()
}
async function putArticle(t, body) {
  const r = await fetch(`${API_BASE}/travels/upsert/`, { method: 'PUT', headers: authHeaders(t), body: JSON.stringify(body) })
  const text = await r.text()
  if (!r.ok) throw new Error(`PUT upsert ${body.id} → ${r.status}: ${text.slice(0, 300)}`)
  return text
}

async function main() {
  const data = readJson(path.join(DIR, 'matches.json'))
  const t = LIVE ? token() : ''
  fs.mkdirSync(BACKUP_DIR, { recursive: true })

  // Group selected matches by article.
  const byArticle = new Map()
  for (const m of data.matches) {
    if ((CONF_RANK[m.confidence] ?? 9) > MAX_RANK) continue
    if (!m.permalink || !shortcode(m.permalink)) continue
    if (ONLY && String(m.articleId) !== String(ONLY)) continue
    if (!byArticle.has(m.articleId)) byArticle.set(m.articleId, [])
    byArticle.get(m.articleId).push(m)
  }
  let articles = [...byArticle.entries()]
  if (LIMIT) articles = articles.slice(0, LIMIT)

  console.log(`Mode: ${LIVE ? 'LIVE (writing)' : 'DRY-RUN (no writes)'} · min-confidence: ${MIN_CONF} · articles: ${articles.length}`)
  let touched = 0
  let totalAdded = 0
  for (const [id, posts] of articles) {
    let art
    try {
      art = await getArticle(id)
    } catch (e) {
      console.log(`  [${id}] GET failed: ${e.message}`)
      continue
    }
    fs.writeFileSync(path.join(BACKUP_DIR, `${id}.json`), JSON.stringify(art, null, 2))
    const { description, added } = appendEmbeds(art.description, posts)
    if (!added) {
      console.log(`  [${id}] ${art.name?.slice(0, 50)} — all ${posts.length} already embedded, skip`)
      continue
    }
    const body = buildUpsertBody(art, description)
    const ptsBefore = (art.coordsMeTravel || []).length
    const galBefore = (art.gallery || []).length
    console.log(`  [${id}] ${art.name?.slice(0, 50)} — +${added} embeds (points ${ptsBefore}, gallery ${galBefore})`)
    if (!LIVE) {
      fs.writeFileSync(path.join(BACKUP_DIR, `${id}.upsert.json`), JSON.stringify(body, null, 2))
      touched++
      totalAdded += added
      continue
    }
    try {
      await putArticle(t, body)
      const after = await getArticle(id)
      const ptsAfter = (after.coordsMeTravel || []).length
      const galAfter = (after.gallery || []).length
      const ok = ptsAfter === ptsBefore && galAfter === galBefore
      if (!ok) {
        console.log(`    ⚠️  VERIFY FAILED: points ${ptsBefore}→${ptsAfter}, gallery ${galBefore}→${galAfter}. Backup at backups/${id}.json`)
      } else {
        console.log(`    ✓ saved & verified (points ${ptsAfter}, gallery ${galAfter})`)
      }
      touched++
      totalAdded += added
    } catch (e) {
      console.log(`    ✗ PUT failed: ${e.message}`)
    }
  }
  console.log(`\n${LIVE ? 'Wrote' : 'Would write'} ${totalAdded} embeds across ${touched} articles.`)
  if (!LIVE) console.log('Dry-run only. Review backups/*.upsert.json, then re-run with --live.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
