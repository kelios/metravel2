#!/usr/bin/env node
// Indexing monitor for ONE author's published travels (default user_id=1, Julia).
// Uses the Google Search Console URL Inspection API to learn, per article URL,
// whether Google has it indexed and — if not — why (coverageState / verdict).
//
// Usage:
//   node scripts/index-status.js                  # all author articles, human summary
//   node scripts/index-status.js --json           # machine-readable (for the agent)
//   node scripts/index-status.js --only-problems   # list only not-indexed URLs
//   node scripts/index-status.js --limit 5        # inspect first 5 (smoke test)
//   node scripts/index-status.js --user-id 1 --site sc-domain:metravel.by
//
// Auth: reuses the owner OAuth token (npm run stats:login). Scope webmasters.readonly
// covers URL Inspection. Quota: ~2000 inspections/day, 600/min per property.
const https = require('https')
const { getAccessToken } = require('./lib/google-token')

const SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly'

function parseArgs(argv) {
  const args = {
    json: false,
    onlyProblems: false,
    userId: '1',
    api: 'https://metravel.by',
    origin: 'https://metravel.by',
    site: 'sc-domain:metravel.by',
    limit: 0,
    delayMs: 250,
  }
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--json') args.json = true
    else if (a === '--only-problems') args.onlyProblems = true
    else if (a === '--user-id') args.userId = argv[++i]
    else if (a === '--api') args.api = argv[++i].replace(/\/+$/, '')
    else if (a === '--origin') args.origin = argv[++i].replace(/\/+$/, '')
    else if (a === '--site') args.site = argv[++i]
    else if (a === '--limit') args.limit = parseInt(argv[++i], 10) || 0
    else if (a === '--delay') args.delayMs = parseInt(argv[++i], 10) || 0
  }
  return args
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const opts = { rejectUnauthorized: false, headers: { 'User-Agent': 'metravel-index-status' } }
    https
      .get(url, opts, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return fetchJson(res.headers.location).then(resolve, reject)
        }
        let data = ''
        res.on('data', (c) => (data += c))
        res.on('end', () => {
          try {
            resolve(JSON.parse(data))
          } catch (e) {
            reject(new Error(`Bad JSON from ${url}: ${e.message}`))
          }
        })
      })
      .on('error', reject)
  })
}

// List the author's published+moderated travels (paginated).
async function listTravels(apiBase, userId) {
  const where = JSON.stringify({ user_id: userId, publish: 1, moderation: 1 })
  const out = []
  for (let page = 1; page <= 50; page++) {
    const u = `${apiBase}/api/travels/?where=${encodeURIComponent(where)}&page=${page}&perPage=100`
    const res = await fetchJson(u)
    const rows = res.data || res.items || res.rows || (Array.isArray(res) ? res : [])
    if (!rows.length) break
    for (const t of rows) {
      // The list `url` field may be "/travels/<slug>", "travels/<slug>", a full
      // URL, or just "<slug>" — normalize to the bare slug after /travels/.
      let seg = String(t.url || t.slug || t.seo_url || '')
        .replace(/^https?:\/\/[^/]+/, '')
        .replace(/^\/+/, '')
        .replace(/^travels\//, '')
      if (seg) out.push({ id: t.id, name: t.name || t.title || '', slug: seg })
    }
    if (rows.length < 100) break
  }
  return out
}

async function inspect(token, site, inspectionUrl) {
  const body = JSON.stringify({ inspectionUrl, siteUrl: site, languageCode: 'ru' })
  const options = {
    method: 'POST',
    hostname: 'searchconsole.googleapis.com',
    path: '/v1/urlInspection/index:inspect',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
    },
  }
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = ''
      res.on('data', (c) => (data += c))
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            resolve({ ok: true, result: JSON.parse(data) })
          } catch (e) {
            reject(new Error(`Bad inspect JSON: ${e.message}`))
          }
        } else {
          resolve({ ok: false, status: res.statusCode, body: data })
        }
      })
    })
    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

function classify(r) {
  const idx = (r && r.inspectionResult && r.inspectionResult.indexStatusResult) || {}
  return {
    verdict: idx.verdict || 'UNKNOWN', // PASS | NEUTRAL | FAIL
    coverageState: idx.coverageState || 'Unknown',
    robotsTxtState: idx.robotsTxtState || null,
    indexingState: idx.indexingState || null,
    pageFetchState: idx.pageFetchState || null,
    lastCrawlTime: idx.lastCrawlTime || null,
    googleCanonical: idx.googleCanonical || null,
    userCanonical: idx.userCanonical || null,
    link: (r && r.inspectionResult && r.inspectionResult.inspectionResultLink) || null,
  }
}

async function main() {
  const args = parseArgs(process.argv)
  const { accessToken } = await getAccessToken(SCOPE)

  let travels = await listTravels(args.api, args.userId)
  if (args.limit > 0) travels = travels.slice(0, args.limit)
  if (!args.json) console.error(`🔎 Проверяю индексацию ${travels.length} статей (user_id=${args.userId})…`)

  const items = []
  const byState = {}
  let done = 0
  for (const t of travels) {
    const url = `${args.origin}/travels/${t.slug}`
    let info
    try {
      const resp = await inspect(accessToken, args.site, url)
      if (!resp.ok) {
        if (resp.status === 429) {
          // backoff and retry once
          await sleep(60000)
          const retry = await inspect(accessToken, args.site, url)
          info = retry.ok ? classify(retry.result) : { verdict: 'ERROR', coverageState: `HTTP ${retry.status}` }
        } else {
          info = { verdict: 'ERROR', coverageState: `HTTP ${resp.status}` }
        }
      } else {
        info = classify(resp.result)
      }
    } catch (e) {
      info = { verdict: 'ERROR', coverageState: e.message.slice(0, 60) }
    }
    // verdict PASS == "URL is on Google" (indexed). NEUTRAL/FAIL == not indexed.
    const indexed = info.verdict === 'PASS'
    const row = { id: t.id, name: t.name, url, indexed, ...info }
    items.push(row)
    byState[info.coverageState] = (byState[info.coverageState] || 0) + 1
    done++
    if (!args.json && done % 25 === 0) console.error(`   …${done}/${travels.length}`)
    if (args.delayMs) await sleep(args.delayMs)
  }

  const problems = items.filter((r) => !r.indexed)
  const result = {
    source: 'gsc-url-inspection',
    site: args.site,
    userId: args.userId,
    checkedAt: new Date().toISOString(),
    total: items.length,
    indexed: items.length - problems.length,
    notIndexed: problems.length,
    byCoverageState: byState,
    problems: problems.map((p) => ({
      id: p.id,
      name: p.name,
      url: p.url,
      coverageState: p.coverageState,
      verdict: p.verdict,
      robotsTxtState: p.robotsTxtState,
      lastCrawlTime: p.lastCrawlTime,
      googleCanonical: p.googleCanonical,
    })),
  }

  if (args.json) {
    process.stdout.write(JSON.stringify(result, null, 2) + '\n')
    return
  }

  console.log(`\n📑 Индексация статей user_id=${args.userId} — ${args.site}`)
  console.log(`   Всего проверено: ${result.total}`)
  console.log(`   ✅ В индексе:     ${result.indexed}`)
  console.log(`   ❌ Не в индексе:  ${result.notIndexed}\n`)
  console.log('   Причины (coverageState):')
  for (const [state, n] of Object.entries(byState).sort((a, b) => b[1] - a[1])) {
    console.log(`     ${String(n).padStart(4)} | ${state}`)
  }
  if (problems.length) {
    console.log(`\n   ❌ Не проиндексированные${args.onlyProblems ? '' : ' (первые 40)'}:`)
    const show = args.onlyProblems ? problems : problems.slice(0, 40)
    for (const p of show) {
      console.log(`     [${p.id}] ${p.coverageState} | ${p.url}`)
    }
  }
  console.log('')
}

main().catch((err) => {
  console.error('Ошибка:', err.message)
  process.exit(1)
})
