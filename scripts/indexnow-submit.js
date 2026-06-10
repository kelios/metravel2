#!/usr/bin/env node
/**
 * IndexNow batch submit — metravel.by
 *
 * Usage:
 *   node scripts/indexnow-submit.js              # submit all URLs
 *   node scripts/indexnow-submit.js --dry-run    # print URLs, no HTTP POST
 *   node scripts/indexnow-submit.js --sitemap    # parse sitemap.xml instead of API
 *
 * Submits to: api.indexnow.org (→ Bing/Yandex/etc.) + yandex.com/indexnow separately
 */

const https = require('https')
const http = require('http')

const KEY = 'eb1c0d4b6f120c68a79525b7fe86581b'
const HOST = 'metravel.by'
const SITE = 'https://metravel.by'
const KEY_LOCATION = `${SITE}/${KEY}.txt`
const API_BASE = 'https://metravel.by'
const DEFAULT_PAGE_SIZE = 100

const STATIC_ROUTES = ['/', '/search', '/map', '/travelsby', '/about', '/contact', '/roulette']

const DRY_RUN = process.argv.includes('--dry-run')
const USE_SITEMAP = process.argv.includes('--sitemap')

// ── HTTP helpers ──────────────────────────────────────────────────────────────

function fetchText(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http
    const opts = { timeout: 30000, rejectUnauthorized: false }
    const req = mod.get(url, opts, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchText(res.headers.location).then(resolve, reject)
      }
      let data = ''
      res.setEncoding('utf8')
      res.on('data', (c) => (data += c))
      res.on('end', () => resolve(data))
    })
    req.on('error', reject)
    req.on('timeout', () => { req.destroy(); reject(new Error(`Timeout: ${url}`)) })
  })
}

function fetchJson(url) {
  return fetchText(url).then(JSON.parse)
}

function postJson(host, path, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body)
    const opts = {
      hostname: host,
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(payload),
      },
      timeout: 30000,
    }
    const req = https.request(opts, (res) => {
      let data = ''
      res.on('data', (c) => (data += c))
      res.on('end', () => resolve({ status: res.statusCode, body: data }))
    })
    req.on('error', reject)
    req.on('timeout', () => { req.destroy(); reject(new Error(`Timeout POST ${host}${path}`)) })
    req.write(payload)
    req.end()
  })
}

// ── URL collectors ────────────────────────────────────────────────────────────

async function collectFromApi() {
  const urls = STATIC_ROUTES.map((r) => (r === '/' ? `${SITE}/` : `${SITE}${r}`))
  const seen = new Set(urls)

  let page = 1
  while (true) {
    const params = new URLSearchParams({
      page: String(page),
      perPage: String(DEFAULT_PAGE_SIZE),
      where: JSON.stringify({ publish: 1, moderation: 1 }),
    })
    const payload = await fetchJson(`${API_BASE}/api/travels/?${params}`)
    const items = Array.isArray(payload) ? payload : (payload.results || payload.data || [])
    if (!items.length) break

    for (const t of items) {
      const slug = String(t.slug || t.id || '').trim()
      if (!slug) continue
      const loc = `${SITE}/travels/${slug}`
      if (!seen.has(loc)) { seen.add(loc); urls.push(loc) }
    }

    const total = Number(payload.count || payload.total || items.length)
    if (items.length < DEFAULT_PAGE_SIZE || urls.length >= total) break
    page++
  }

  return urls
}

async function collectFromSitemap() {
  const xml = await fetchText(`${SITE}/sitemap.xml`)
  const matches = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)]
  return matches.map((m) => m[1].trim()).filter(Boolean)
}

// ── Submit ────────────────────────────────────────────────────────────────────

async function submit(endpoint, urlList) {
  const body = { host: HOST, key: KEY, keyLocation: KEY_LOCATION, urlList }
  if (DRY_RUN) {
    console.log(`[dry-run] POST https://${endpoint} — ${urlList.length} URLs`)
    return
  }
  const [host, ...pathParts] = endpoint.split('/')
  const path = '/' + pathParts.join('/')
  const res = await postJson(host, path, body)
  const ok = res.status >= 200 && res.status < 300
  console.log(`[indexnow] ${endpoint} → HTTP ${res.status} ${ok ? 'OK' : 'ERROR'} (${urlList.length} URLs)`)
  if (!ok) console.error('  body:', res.body.slice(0, 300))
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('[indexnow] Collecting URLs…')
  const urls = USE_SITEMAP ? await collectFromSitemap() : await collectFromApi()
  console.log(`[indexnow] ${urls.length} URLs collected`)

  if (DRY_RUN) {
    urls.forEach((u) => console.log(' ', u))
  }

  // IndexNow batch limit = 10 000, chunk just in case
  const CHUNK = 9000
  for (let i = 0; i < urls.length; i += CHUNK) {
    const chunk = urls.slice(i, i + CHUNK)
    // api.indexnow.org propagates to all participating engines (Bing, Yandex, etc.)
    await submit('api.indexnow.org/indexnow', chunk)
    // Yandex also accepts directly (belt + suspenders)
    await submit('yandex.com/indexnow', chunk)
  }

  console.log('[indexnow] Done.')
}

main().catch((e) => { console.error('[indexnow] Fatal:', e.message); process.exit(1) })
