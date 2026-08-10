#!/usr/bin/env node
/**
 * IndexNow batch submit — metravel.by
 *
 * `--help` prints USAGE below; a unit test asserts that every flag in CLI_SPEC is
 * documented there, so the help cannot quietly fall behind the parser.
 *
 * A mode (--all / --sitemap / --urls-file) is mandatory and there is deliberately
 * no default set: an unknown or mistyped flag used to fall through to "submit the
 * whole site", which on 2026-08-10 pushed 544 URLs by accident (#1389). The strict
 * parse behind that now lives in the shared SEO CLI contract (#1391).
 *
 * Submits to: api.indexnow.org (→ Bing/Yandex/etc.) + yandex.com/indexnow separately
 */

const https = require('https')
const http = require('http')
const fs = require('fs')

const {
  UsageError,
  parseCliArgs,
  requireNonEmptySelection,
  runSeoCli,
} = require('./lib/seo-cli-contract')

const KEY = 'eb1c0d4b6f120c68a79525b7fe86581b'
const HOST = 'metravel.by'
const SITE = 'https://metravel.by'
const KEY_LOCATION = `${SITE}/${KEY}.txt`
const API_BASE = 'https://metravel.by'
const DEFAULT_PAGE_SIZE = 100

const STATIC_ROUTES = ['/', '/search', '/map', '/travelsby', '/about', '/contact', '/roulette']

const USAGE = `IndexNow batch submit — metravel.by

Usage:
  node scripts/indexnow-submit.js <mode> [options]

Modes (exactly one is required — the script never picks a URL set for you):
  --all                 every published travel, every quest and the static routes
  --sitemap             the URLs listed in sitemap.xml
  --urls-file <path>    exactly the URLs listed in a text file (one per line)

Options:
  --dry-run             print the URLs, send nothing
  --recent-days <n>     with --sitemap: keep only URLs changed in the last n days
  --help, -h            print this help and exit

Examples:
  node scripts/indexnow-submit.js --all
  node scripts/indexnow-submit.js --sitemap --recent-days 2
  node scripts/indexnow-submit.js --urls-file batch.txt --dry-run`

/**
 * Every flag this script accepts. The shared contract refuses anything else, so
 * a typo can no longer fall through to the widest possible action (#1389).
 */
const CLI_SPEC = {
  name: 'indexnow',
  usage: USAGE,
  flags: {
    all: { type: 'boolean' },
    sitemap: { type: 'boolean' },
    'urls-file': { type: 'string', valueName: 'a path' },
    'dry-run': { type: 'boolean' },
    'recent-days': {
      type: 'int',
      min: 1,
      valueName: 'a positive integer',
      requiresMode: 'sitemap',
      reason: 'API records do not expose lastmod',
    },
  },
  modes: {
    flags: ['all', 'sitemap', 'urls-file'],
    label: 'URL sets',
    missing: 'No mode given: pass --all, --sitemap or --urls-file <path> explicitly',
  },
}

const parseArgs = (argv) => parseCliArgs(argv, CLI_SPEC)

/**
 * URLs from a plain-text batch file: one URL per line, `#` comments and blank
 * lines ignored. Everything must live on this host — a foreign URL in an
 * IndexNow payload gets the whole batch rejected, so fail on it instead of
 * silently submitting a partial list.
 */
function parseUrlsFileContent(text, site = SITE) {
  const urls = String(text || '')
    .split(/\r?\n/)
    .map((line) => line.replace(/#.*$/, '').trim())
    .filter(Boolean)

  const foreign = urls.filter((url) => !url.startsWith(`${site}/`) && url !== `${site}/`)
  if (foreign.length) {
    throw new Error(`--urls-file contains URLs outside ${site}: ${foreign.slice(0, 3).join(', ')}`)
  }
  return [...new Set(urls)]
}

function readUrlsFile(filePath) {
  return parseUrlsFileContent(fs.readFileSync(filePath, 'utf8'))
}

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

  // Городские квесты: /quests + детальные /quests/{cityId}/{quest_id}
  const questsIndex = `${SITE}/quests`
  if (!seen.has(questsIndex)) { seen.add(questsIndex); urls.push(questsIndex) }
  let questsUrl = `${API_BASE}/api/quests/`
  while (questsUrl) {
    const payload = await fetchJson(questsUrl)
    const items = Array.isArray(payload) ? payload : (payload.results || payload.data || [])
    for (const q of items) {
      const cityId = q.city && (q.city.id || q.city) != null ? (q.city.id || q.city) : q.city_id
      if (!cityId || !q.quest_id) continue
      const loc = `${SITE}/quests/${cityId}/${q.quest_id}`
      if (!seen.has(loc)) { seen.add(loc); urls.push(loc) }
    }
    questsUrl = !Array.isArray(payload) && payload.next ? payload.next : null
  }

  return urls
}

function parseSitemapEntries(xml) {
  return [...String(xml).matchAll(/<url>([\s\S]*?)<\/url>/g)]
    .map((match) => {
      const block = match[1]
      const loc = block.match(/<loc>([\s\S]*?)<\/loc>/)?.[1]?.trim() || ''
      const lastmod = block.match(/<lastmod>([\s\S]*?)<\/lastmod>/)?.[1]?.trim() || ''
      return { loc, lastmod }
    })
    .filter((entry) => entry.loc)
}

function filterRecentSitemapEntries(entries, recentDays, now = new Date()) {
  if (!recentDays) return entries
  const cutoff = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() - (recentDays - 1),
  ))

  return entries.filter((entry) => {
    if (!entry.lastmod) return false
    const changedAt = new Date(entry.lastmod)
    return !Number.isNaN(changedAt.getTime()) && changedAt >= cutoff
  })
}

async function collectFromSitemap({ recentDays = null, now = new Date() } = {}) {
  const xml = await fetchText(`${SITE}/sitemap.xml`)
  const entries = filterRecentSitemapEntries(parseSitemapEntries(xml), recentDays, now)
  return entries.map((entry) => entry.loc)
}

// ── Submit ────────────────────────────────────────────────────────────────────

// `dryRun` has no default on purpose: a call site that forgets it must fail
// loudly, not quietly turn a rehearsal into a real submission (#1389).
async function submit(endpoint, urlList, { dryRun } = {}) {
  if (typeof dryRun !== 'boolean') {
    throw new Error('submit() requires an explicit dryRun flag')
  }
  const body = { host: HOST, key: KEY, keyLocation: KEY_LOCATION, urlList }
  if (dryRun) {
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

const DEFAULT_DEPS = { collectFromApi, collectFromSitemap, readUrlsFile, submit }

async function main(argv = process.argv, deps = {}) {
  const collectors = { ...DEFAULT_DEPS, ...deps }

  const args = parseArgs(argv)

  console.log('[indexnow] Collecting URLs…')
  const urls = args.mode === 'urls-file'
    ? collectors.readUrlsFile(args.urlsFile)
    : args.mode === 'sitemap'
      ? await collectors.collectFromSitemap({ recentDays: args.recentDays })
      : await collectors.collectFromApi()
  console.log(`[indexnow] ${urls.length} URLs collected${args.urlsFile ? ` from ${args.urlsFile}` : ''}`)
  if (args.recentDays) {
    console.log(`[indexnow] Filter: sitemap lastmod within ${args.recentDays} day(s)`)
  }

  if (args.dryRun) {
    urls.forEach((u) => console.log(' ', u))
  }

  if (urls.length === 0) {
    // A `--recent-days` window with nothing in it is a real no-op. An empty set
    // anywhere else means the collector or the batch file broke, and reporting
    // that as a clean run is the #1325 shape: a green report over zero rows.
    if (args.recentDays) {
      console.log('[indexnow] No recent URL changes to submit.')
      return
    }
    requireNonEmptySelection(urls, {
      what: 'URLs',
      source: args.mode === 'urls-file' ? args.urlsFile : `--${args.mode} collector`,
      hint: 'nothing would be submitted — check the source instead of treating it as a clean run',
    })
  }

  // IndexNow batch limit = 10 000, chunk just in case
  const CHUNK = 9000
  for (let i = 0; i < urls.length; i += CHUNK) {
    const chunk = urls.slice(i, i + CHUNK)
    // api.indexnow.org propagates to all participating engines (Bing, Yandex, etc.)
    await collectors.submit('api.indexnow.org/indexnow', chunk, { dryRun: args.dryRun })
    // Yandex also accepts directly (belt + suspenders)
    await collectors.submit('yandex.com/indexnow', chunk, { dryRun: args.dryRun })
  }

  console.log('[indexnow] Done.')
}

if (require.main === module) {
  runSeoCli(main, { name: 'indexnow', usage: USAGE })
}

module.exports = {
  CLI_SPEC,
  UsageError,
  USAGE,
  filterRecentSitemapEntries,
  main,
  parseArgs,
  parseSitemapEntries,
  parseUrlsFileContent,
  submit,
}
