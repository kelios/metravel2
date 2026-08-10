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
const { parseCliArgs, requireNonEmptySelection, runSeoCli } = require('./lib/seo-cli-contract')

const SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly'

const USAGE = `Indexing monitor — metravel.by

Usage:
  node scripts/index-status.js [options]

Options:
  --json                machine-readable output (for the agent)
  --only-problems       list every not-indexed URL instead of the first 40
  --user-id <id>        author to inspect (default 1)
  --api <origin>        API origin the article list comes from
  --origin <origin>     site origin the inspected URLs are built from
  --site <property>     Search Console property (default sc-domain:metravel.by)
  --limit <n>           inspect only the first n articles (smoke test)
  --delay <ms>          pause between inspections (default 250)
  --help, -h            print this help and exit

Examples:
  node scripts/index-status.js --limit 5
  node scripts/index-status.js --json --only-problems`

// Every flag lives in the shared SEO CLI contract (#1391): a mistyped `--limt 5`
// used to be dropped on the floor and quietly inspect all 306 articles.
const CLI_SPEC = {
  name: 'index-status',
  usage: USAGE,
  flags: {
    json: { type: 'boolean' },
    'only-problems': { type: 'boolean' },
    'user-id': { type: 'string', valueName: 'an author id', default: '1' },
    api: { type: 'string', valueName: 'an origin', default: 'https://metravel.by', stripTrailingSlash: true },
    origin: { type: 'string', valueName: 'an origin', default: 'https://metravel.by', stripTrailingSlash: true },
    site: { type: 'string', valueName: 'a Search Console property', default: 'sc-domain:metravel.by' },
    limit: { type: 'int', min: 0, valueName: 'a non-negative integer', default: 0 },
    delay: { type: 'int', key: 'delayMs', min: 0, valueName: 'milliseconds', default: 250 },
  },
}

const parseArgs = (argv) => parseCliArgs(argv, CLI_SPEC)

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

// Rows out of the list envelope. `/api/travels/` answers `{count, next, results}`;
// the older shapes stay as fallbacks. Missing `results` here is what made the
// whole monitor report "0 articles checked" with exit code 0 (see seo audit 08.08).
function pickListRows(res) {
  if (Array.isArray(res)) return res
  if (!res || typeof res !== 'object') return []
  const rows = res.results || res.data || res.items || res.rows
  return Array.isArray(rows) ? rows : []
}

// List the author's published+moderated travels (paginated).
async function listTravels(apiBase, userId) {
  const where = JSON.stringify({ user_id: userId, publish: 1, moderation: 1 })
  const out = []
  for (let page = 1; page <= 50; page++) {
    const u = `${apiBase}/api/travels/?where=${encodeURIComponent(where)}&page=${page}&perPage=100`
    const res = await fetchJson(u)
    const rows = pickListRows(res)
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

  // An empty list is an environment/contract failure, not "0 problems": reporting
  // it as a success is exactly how the broken envelope read stayed invisible.
  let travels = requireNonEmptySelection(await listTravels(args.api, args.userId), {
    message:
      `${args.api}/api/travels/ вернул 0 статей для user_id=${args.userId} — ` +
      'проверьте доступность API и формат ответа',
  })
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

if (require.main === module) {
  runSeoCli(main, { name: 'index-status', usage: USAGE })
}

module.exports = { CLI_SPEC, USAGE, pickListRows, parseArgs, classify }
