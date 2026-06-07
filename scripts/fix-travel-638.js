#!/usr/bin/env node
/**
 * One-off fixer for travel id=638 (the "33 mest u vody" Belarus summary).
 *
 * Two bugs in the article description we patch here:
 *   1. After many <h3>Heading</h3> the next <img src="…/address-image/{id}/…">
 *      points to a DIFFERENT lake/river than the heading. We replace the image
 *      with the address-image of the point whose `address` matches the heading.
 *   2. There are no internal links to the standalone source travels (e.g. the
 *      separate article about "Озеро Глубокое"). For each heading we look up
 *      `/api/travels/?query=<heading>` and, if a same-author article with the
 *      same name exists, wrap the heading text in <a href="…">.
 *
 * The actual write reuses scripts/seo-edit.js (composeDescription +
 * buildUpsertPayload + auto-rollback on regression).
 *
 *   node scripts/fix-travel-638.js --dry-run   # preview, writes report
 *   node scripts/fix-travel-638.js --apply     # backup + PUT + verify
 *
 * Token: METRAVEL_TOKEN env or ~/.metravel_token (same as seo-edit.js).
 */

const fs = require('fs')
const os = require('os')
const path = require('path')
const https = require('https')
const http = require('http')

const seoEdit = require('./seo-edit')

const TRAVEL_ID = 638
const API = (process.env.METRAVEL_API || 'https://metravel.by/api').replace(/\/+$/, '')
const REPORT_DIR = path.join(__dirname, '.fix-travel-638')
const DEFAULT_BACKUP_DIR = path.join(__dirname, '.seo-backups')

// ---------- args ----------
const args = process.argv.slice(2)
const has = (n) => args.includes(`--${n}`)
const getArg = (n, d) => { const i = args.indexOf(`--${n}`); return i !== -1 && args[i + 1] ? args[i + 1] : d }
const DRY = has('dry-run')
const APPLY = has('apply')
const BACKUP_DIR = getArg('backup-dir', DEFAULT_BACKUP_DIR)
if (!DRY && !APPLY) { console.error('ERROR: pass --dry-run or --apply'); process.exit(1) }

// ---------- token ----------
function loadToken() {
  if (process.env.METRAVEL_TOKEN) return process.env.METRAVEL_TOKEN.trim()
  const p = path.join(os.homedir(), '.metravel_token')
  if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8').trim()
  return null
}

// ---------- io ----------
function rawRequest(method, url, { token: tok, body } = {}) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http
    const buf = body != null ? Buffer.from(JSON.stringify(body)) : null
    const opts = { method, timeout: 60000, headers: { 'Cache-Control': 'no-cache' } }
    if (mod === https) opts.rejectUnauthorized = false
    if (tok) opts.headers.Authorization = `Token ${tok}`
    if (buf) { opts.headers['Content-Type'] = 'application/json'; opts.headers['Content-Length'] = buf.length }
    const req = mod.request(url, opts, (res) => {
      let acc = ''
      res.setEncoding('utf8')
      res.on('data', (c) => (acc += c))
      res.on('end', () => resolve({ status: res.statusCode, text: acc }))
    })
    req.on('error', reject)
    req.on('timeout', () => { req.destroy(); reject(new Error(`Timeout ${url}`)) })
    if (buf) req.write(buf)
    req.end()
  })
}

async function getTravel(id, tok) {
  const { status, text } = await rawRequest('GET', `${API}/travels/${id}/`, { token: tok })
  if (status !== 200) throw new Error(`GET travel ${id} → HTTP ${status}: ${text.slice(0, 200)}`)
  return JSON.parse(text)
}

async function putTravel(payload, tok) {
  return rawRequest('PUT', `${API}/travels/upsert/`, { token: tok, body: payload })
}

const searchCache = new Map()
async function searchByName(name) {
  if (searchCache.has(name)) return searchCache.get(name)
  const url = `${API}/travels/?query=${encodeURIComponent(name)}&perPage=10`
  const { status, text } = await rawRequest('GET', url)
  if (status !== 200) { searchCache.set(name, []); return [] }
  let parsed
  try { parsed = JSON.parse(text) } catch { parsed = {} }
  const items = parsed.data || parsed.results || parsed.items || []
  searchCache.set(name, items)
  return items
}

// ---------- string helpers ----------
const STRIP_PUNCT = /[«»"'`„“”«».,;:!?…]/g
function normalize(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/&nbsp;/g, ' ')
    .replace(/ё/g, 'е')
    .replace(STRIP_PUNCT, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
// strip trailing "(blah)" so "Озеро Болдук (Голубые озёра)" → "Озеро Болдук"
function coreName(s) {
  return normalize(String(s || '').replace(/\s*\([^()]*\)\s*$/u, ''))
}

// ---------- domain logic ----------
function buildPointIndex(detail) {
  const list = Array.isArray(detail.travelAddress) ? detail.travelAddress : []
  const coordsList = Array.isArray(detail.coordsMeTravel) ? detail.coordsMeTravel : []
  // coordsMeTravel has `image`; travelAddress has `travelImageThumbUrl`. Index by id.
  const imageById = new Map()
  for (const p of coordsList) if (p && p.id != null) imageById.set(Number(p.id), p.image)
  for (const p of list) if (p && p.id != null && !imageById.has(Number(p.id))) imageById.set(Number(p.id), p.travelImageThumbUrl)
  // index points by normalized full address and by "core" address (without parens)
  const byFull = new Map()
  const byCore = new Map()
  for (const p of list) {
    if (!p || !p.address) continue
    const url = imageById.get(Number(p.id))
    const entry = { id: Number(p.id), address: p.address, url }
    byFull.set(normalize(p.address), entry)
    byCore.set(coreName(p.address), entry)
  }
  return { byFull, byCore }
}

function findPointForHeading(heading, index) {
  const full = normalize(heading)
  if (index.byFull.has(full)) return index.byFull.get(full)
  const core = coreName(heading)
  if (index.byCore.has(core)) return index.byCore.get(core)
  // last-resort: any point whose normalized address contains the core heading text
  for (const [k, v] of index.byCore.entries()) {
    if (k.includes(core) || core.includes(k)) return v
  }
  return null
}

async function findSourceTravel(heading, selfId, selfUserName) {
  const heads = [heading, heading.replace(/\s*\([^()]*\)\s*$/u, '').trim()]
  const seen = new Set()
  const core = coreName(heading)
  for (const q of heads) {
    const items = await searchByName(q)
    for (const t of items) {
      if (!t || t.id === selfId) continue
      if (seen.has(t.id)) continue
      seen.add(t.id)
      const sameAuthor = !selfUserName || (t.userName && t.userName === selfUserName)
      if (!sameAuthor) continue
      const tname = normalize(t.name)
      const tcore = coreName(t.name)
      // Match if the source article name starts with the heading core
      // (so "Озеро Глубокое. Одно из самых прозрачных…" matches "Озеро Глубокое (Полоцкий район)" after core-strip).
      if (tname.startsWith(core) || tcore.startsWith(core) || core.startsWith(tcore)) {
        return t
      }
    }
  }
  return null
}

// Replace, for each <h3> in the description, the *next* <img src=".../address-image/X/...">
// THAT APPEARS BEFORE THE NEXT <h3> with the image of the matching point, and wrap the
// heading text in <a href="…"> when a source article exists.
async function rewriteDescription(detail) {
  const desc = String(detail.description || '')
  const pointIndex = buildPointIndex(detail)
  const log = []

  const H3_RE = /<h3>([\s\S]*?)<\/h3>/g
  const IMG_RE_G = /<img\s+src=("|')(https:\/\/metravel\.by\/address-image\/)(\d+)(\/conversions\/[^"']+\.webp)\1(\s*\/?)>/g

  // Collect h3 and address-image positions in one pass.
  const headings = [] // { startIdx, endIdx, headingHtml, headingText }
  let m
  while ((m = H3_RE.exec(desc)) !== null) {
    const text = m[1].replace(/<[^>]+>/g, '').trim()
    headings.push({ startIdx: m.index, endIdx: m.index + m[0].length, headingHtml: m[1], headingText: text, raw: m[0] })
  }
  const images = [] // { startIdx, endIdx, src, id, tail }
  while ((m = IMG_RE_G.exec(desc)) !== null) {
    images.push({
      startIdx: m.index,
      endIdx: m.index + m[0].length,
      raw: m[0],
      tail: m[5] || '',
      id: Number(m[3]),
    })
  }

  // For each heading, pick the next image whose startIdx > heading.endIdx AND < (next heading.startIdx ?? Infinity)
  const consumed = new Set()
  const planEdits = [] // list of { kind: 'heading'|'image', startIdx, endIdx, replacement, info }
  for (let i = 0; i < headings.length; i++) {
    const h = headings[i]
    const nextHStart = i + 1 < headings.length ? headings[i + 1].startIdx : Infinity

    // 1) source link wrap
    let source = null
    try { source = await findSourceTravel(h.headingText, detail.id, detail.userName) } catch { source = null }
    if (source && source.url) {
      planEdits.push({
        kind: 'heading',
        startIdx: h.startIdx,
        endIdx: h.endIdx,
        replacement: `<h3><a href="${source.url}">${h.headingHtml}</a></h3>`,
      })
      log.push({ heading: h.headingText, link: { id: source.id, name: source.name, url: source.url } })
    } else {
      log.push({ heading: h.headingText, link: null })
    }

    // 2) image swap, if a point matches AND there's an img in this heading's slot
    const point = findPointForHeading(h.headingText, pointIndex)
    const imgIdx = images.findIndex((im, idx) => !consumed.has(idx) && im.startIdx >= h.endIdx && im.startIdx < nextHStart)
    if (imgIdx === -1) continue
    consumed.add(imgIdx)
    const im = images[imgIdx]
    const last = log[log.length - 1]
    if (!point || !point.url) {
      last.image = { skipped: true, reason: 'no matching point', srcId: im.id }
      continue
    }
    if (im.id === point.id) {
      last.image = { ok: true, id: point.id }
      continue
    }
    const newUrlPart = point.url.replace(/^https:\/\/metravel\.by/, '')
    planEdits.push({
      kind: 'image',
      startIdx: im.startIdx,
      endIdx: im.endIdx,
      replacement: `<img src="https://metravel.by${newUrlPart}"${im.tail}>`,
    })
    last.image = { from: im.id, to: point.id, expected: point.address }
  }

  // Apply edits in order (they're already sorted by startIdx within each kind; combine and re-sort).
  planEdits.sort((a, b) => a.startIdx - b.startIdx)
  let out = ''
  let cursor = 0
  for (const e of planEdits) {
    if (e.startIdx < cursor) continue // safety
    out += desc.slice(cursor, e.startIdx)
    out += e.replacement
    cursor = e.endIdx
  }
  out += desc.slice(cursor)
  return { newDescription: out, log }
}

// ---------- main ----------
;(async () => {
  fs.mkdirSync(REPORT_DIR, { recursive: true })
  const tok = loadToken()
  if (!tok) { console.error('ERROR: METRAVEL_TOKEN env or ~/.metravel_token missing'); process.exit(1) }

  console.log(`Fetching travel #${TRAVEL_ID}…`)
  const detail = await getTravel(TRAVEL_ID, tok)
  console.log(`  «${detail.name}»  author=${detail.userName}  points=${(detail.travelAddress || []).length}`)

  const { newDescription, log } = await rewriteDescription(detail)
  const oldDesc = detail.description || ''
  const changed = newDescription !== oldDesc

  console.log(`  description: ${oldDesc.length} → ${newDescription.length} chars`)
  const imgFixed = log.filter((x) => x.image && x.image.from && x.image.from !== x.image.to).length
  const imgOk = log.filter((x) => x.image && x.image.ok).length
  const linksAdded = log.filter((x) => x.link).length
  console.log(`  headings: ${log.length}  images fixed: ${imgFixed}  images already OK: ${imgOk}  source links wrapped: ${linksAdded}`)

  const ts = new Date().toISOString().replace(/[:.]/g, '-')
  const reportPath = path.join(REPORT_DIR, `report-${ts}.json`)
  const descPath = path.join(REPORT_DIR, `description-${ts}.html`)
  fs.writeFileSync(reportPath, JSON.stringify({ travelId: TRAVEL_ID, name: detail.name, changed, log }, null, 2), 'utf8')
  fs.writeFileSync(descPath, newDescription, 'utf8')
  console.log(`  📝 report → ${path.relative(process.cwd(), reportPath)}`)
  console.log(`  📝 new description → ${path.relative(process.cwd(), descPath)}`)

  if (!changed) { console.log('Nothing to change.'); return }

  if (DRY) { console.log('DRY RUN — nothing written.'); return }

  // --apply path: backup + PUT + verify + auto-rollback (parallels seo-edit.main)
  fs.mkdirSync(BACKUP_DIR, { recursive: true })
  const backupFile = path.join(BACKUP_DIR, seoEdit.backupFileName(detail.id, ts))
  fs.writeFileSync(backupFile, JSON.stringify(detail, null, 2), 'utf8')
  console.log(`  💾 backup → ${path.relative(process.cwd(), backupFile)}`)

  const payload = seoEdit.buildUpsertPayload(detail, { description: newDescription })
  const put = await putTravel(payload, tok)
  console.log(`  PUT /travels/upsert/ → HTTP ${put.status}`)
  if (put.status !== 200 && put.status !== 201) {
    console.error(put.text.slice(0, 500))
    process.exit(1)
  }

  const after = await getTravel(TRAVEL_ID, tok)
  const problems = seoEdit.detectRegression(detail, after, { expectChanged: true, newDescription })
  if (problems.length) {
    console.error(`❌ REGRESSION: ${problems.join('; ')}`)
    console.error('   Auto-rolling back to original description…')
    const revert = seoEdit.buildUpsertPayload(detail, { description: oldDesc, meta: detail.meta_description })
    const rb = await putTravel(revert, tok)
    console.error(`   rollback PUT → HTTP ${rb.status}`)
    process.exit(2)
  }
  console.log(`✅ OK — publish=${after.publish}, gallery=${(after.gallery || []).length}, points=${(after.coordsMeTravel || []).length}, desc=${(after.description || '').length} chars`)
})().catch((err) => { console.error('❌ Fatal:', err.message); process.exit(1) })
