#!/usr/bin/env node
// Indexing monitor for metravel.by. Uses the Google Search Console URL Inspection
// API to learn, per URL, whether Google has it indexed and — if not — why
// (coverageState / verdict).
//
// `--section` picks what the run covers. Until #1559 there was only one section
// and it was implicit: the published travels of a single author, 310 of the 673
// URLs in sitemap.xml. The other 54% — every quest page, every city page, every
// other author's article — had never been checked by any run, which is why 17
// city pages sat outside the index unnoticed. `--section all` is the whole map.
//
// Usage:
//   node scripts/index-status.js                  # author articles, human summary
//   node scripts/index-status.js --section all    # every URL in sitemap.xml
//   node scripts/index-status.js --section quests # quest pages and city pages
//   node scripts/index-status.js --json           # machine-readable (for the agent)
//   node scripts/index-status.js --only-problems   # list only not-indexed URLs
//   node scripts/index-status.js --limit 5        # inspect first 5 (smoke test)
//   node scripts/index-status.js --user-id 1 --site sc-domain:metravel.by
//
// Auth: reuses the owner OAuth token (npm run stats:login). Scope webmasters.readonly
// covers URL Inspection. Quota: ~2000 inspections/day, 600/min per property.
const fs = require('fs')
const path = require('path')
const https = require('https')
const { getAccessToken } = require('./lib/google-token')
const { readResponseText, withAcceptEncoding } = require('./lib/httpText')
const {
  UsageError,
  parseCliArgs,
  requireNonEmptySelection,
  requireNoBatchFailures,
  runSeoCli,
} = require('./lib/seo-cli-contract')

const SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly'

// `articles` is the historical run and stays the default so the daily routine and
// the #1387/#1388 control slices keep meaning the same thing. The other three read
// their URLs from sitemap.xml, i.e. from exactly the list Google was handed.
const SECTIONS = ['articles', 'travels', 'quests', 'all']
const DEFAULT_USER_ID = '1'

// Kinds are finer than sections because the answer differs between them: on the
// 25.08.2026 slice all 156 quest pages were indexed while 17 city pages were not,
// and a single «quests: 17 outside» number would have hidden that.
const KIND_TRAVEL = 'travel'
const KIND_QUEST_PAGE = 'quest-page'
const KIND_QUEST_CITY = 'quest-city'
const KIND_STATIC = 'static'

const INDEXED_VERDICT = 'PASS'
const NOT_INDEXED_VERDICTS = new Set(['PARTIAL', 'FAIL', 'NEUTRAL'])

const KIND_LABELS = {
  [KIND_TRAVEL]: 'Статьи /travels/<slug>',
  [KIND_QUEST_PAGE]: 'Страницы квестов /quests/<город>/<квест>',
  [KIND_QUEST_CITY]: 'Городские страницы /quests/<город>',
  [KIND_STATIC]: 'Статические адреса',
}

// Catalog routes that live under /quests but are not one city: `/quests` lists
// every city, `/quests/scenario` groups quests by scenario. Counting them as city
// pages would make the report claim one more city than the catalog has.
const QUEST_CATALOG_ROUTES = new Set(['/quests', '/quests/scenario'])

const SECTION_KINDS = {
  travels: [KIND_TRAVEL],
  quests: [KIND_QUEST_PAGE, KIND_QUEST_CITY],
  all: null, // every kind in the sitemap
}

const USAGE = `Indexing monitor — metravel.by

Usage:
  node scripts/index-status.js [options]

Options:
  --json                machine-readable output (for the agent)
  --only-problems       list every not-indexed URL instead of the first 40
  --section <name>      what to inspect (default articles):
                          articles — published travels of one author, from the API
                          travels  — every /travels/ URL in sitemap.xml (all authors)
                          quests   — every quest page and city page in sitemap.xml
                          all      — every URL in sitemap.xml
  --user-id <id>        author to inspect (default 1); only with --section articles
  --api <origin>        API origin the article list comes from
  --origin <origin>     site origin the inspected URLs are built from
  --site <property>     Search Console property (default sc-domain:metravel.by)
  --limit <n>           inspect only the first n URLs of the section (smoke test)
  --delay <ms>          pause between inspections, per worker (default 250)
  --concurrency <n>     inspections in flight at once (default 6)
  --checkpoint <file>   append one JSON line per inspected URL as it lands, and
                        resume from that file instead of re-spending quota
  --help, -h            print this help and exit

Examples:
  node scripts/index-status.js --limit 5
  node scripts/index-status.js --json --only-problems
  node scripts/index-status.js --section all --json --only-problems
  node scripts/index-status.js --section all --checkpoint .codex-temp/index-all.jsonl`

// Every flag lives in the shared SEO CLI contract (#1391): a mistyped `--limt 5`
// used to be dropped on the floor and quietly inspect all 306 articles.
const CLI_SPEC = {
  name: 'index-status',
  usage: USAGE,
  selection: 'URLs',
  flags: {
    json: { type: 'boolean' },
    'only-problems': { type: 'boolean' },
    section: { type: 'string', valueName: `one of ${SECTIONS.join(', ')}`, default: 'articles' },
    // No default author on purpose: `null` is what tells `--section quests
    // --user-id 1` apart from `--section quests`, so an author id that the run
    // cannot honour is refused instead of silently dropped.
    'user-id': { type: 'string', valueName: 'an author id', default: null },
    api: { type: 'string', valueName: 'an origin', default: 'https://metravel.by', stripTrailingSlash: true },
    origin: { type: 'string', valueName: 'an origin', default: 'https://metravel.by', stripTrailingSlash: true },
    site: { type: 'string', valueName: 'a Search Console property', default: 'sc-domain:metravel.by' },
    limit: { type: 'int', min: 0, valueName: 'a non-negative integer', default: 0 },
    delay: { type: 'int', key: 'delayMs', min: 0, valueName: 'milliseconds', default: 250 },
    // URL Inspection answers in ~7 s, so one URL at a time made `--section all`
    // a 2-hour run (probe 01.09.2026: 5-7 URLs/min). Six workers put ~50 req/min
    // on the wire against a documented ceiling of 600/min per property, so the
    // run fits inside one token lifetime and the daily quota is untouched — the
    // number of inspections is the same, only the waiting is shared.
    concurrency: { type: 'int', min: 1, valueName: 'a positive integer', default: 6 },
    checkpoint: { type: 'string', valueName: 'a file path', default: null },
  },
}

function parseArgs(argv) {
  const args = parseCliArgs(argv, CLI_SPEC)
  // Every other string flag here fails loudly when it arrives empty (`--origin ""`
  // cannot be fetched, `--site ""` is refused by GSC). `--checkpoint ""` — what an
  // unset `--checkpoint "$FILE"` expands to — would instead run the full two-hour
  // sweep with no log and nothing to resume from, and say nothing about it.
  if (args.checkpoint !== null && !args.checkpoint.trim()) {
    throw new UsageError('--checkpoint expects a file path')
  }
  return args
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

// Google mints an access token for 3599 s (probe 25.08.2026), and URL Inspection
// answers in ~6.7 s, so `--section all` over the 673 URLs of sitemap.xml runs
// longer than the token lives. If it were still taken once before the loop — as it
// was when the longest run was 310 articles and fitted in the hour — it would die
// mid-run and the remaining inspections would come back HTTP 401. Refresh before
// expiry, and treat a failed retry as a run failure rather than an index verdict.
const TOKEN_MAX_AGE_MS = 45 * 60 * 1000

function createTokenSource() {
  let token = null
  let takenAt = 0
  // Workers ask for the token independently, so without this the expiry moment
  // would mint one token per worker in flight instead of one for the run.
  let refreshing = null
  return async (force = false) => {
    if (!force && token && Date.now() - takenAt < TOKEN_MAX_AGE_MS) return token
    if (refreshing) return refreshing
    // Cleared before the call, not after it: a refresh that fails must not leave
    // the dead token in place, or the run would carry on and write one HTTP 401
    // row per remaining URL instead of stopping at the failure.
    token = null
    refreshing = getAccessToken(SCOPE)
      .then(({ accessToken }) => {
        token = accessToken
        takenAt = Date.now()
        return token
      })
      .finally(() => {
        refreshing = null
      })
    return refreshing
  }
}

// The three questions every «go to prod and read this URL» helper in scripts/
// answers differently (SEO-OPS-001, известное расхождение 2026-08-10) are answered
// here in one place: hops are capped, a relative `Location` is resolved against the
// URL it came from, and a 3xx without `Location` falls through to the status check
// instead of being read as a body. A run of `--section all` is unattended and over
// an hour long, so a stalled socket has to time out rather than hang the routine.
const MAX_REDIRECTS = 5
const FETCH_TIMEOUT_MS = 30000

function fetchText(url, hop = 0) {
  return new Promise((resolve, reject) => {
    const opts = {
      timeout: FETCH_TIMEOUT_MS,
      headers: withAcceptEncoding({ 'User-Agent': 'metravel-index-status' }),
    }
    const req = https
      .get(url, opts, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume()
          if (hop >= MAX_REDIRECTS) {
            return reject(new Error(`${url} redirected more than ${MAX_REDIRECTS} times`))
          }
          const next = new URL(res.headers.location, url).toString()
          return fetchText(next, hop + 1).then(resolve, reject)
        }
        // A 404 sitemap or a 502 API used to arrive here as unparseable text and
        // be reported as "bad JSON"; naming the status keeps «нет данных» apart
        // from «нет проблем» at the point where the difference is still visible.
        if (res.statusCode !== 200) {
          res.resume()
          return reject(new Error(`${url} answered HTTP ${res.statusCode}`))
        }
        // #1649: buffered whole, decoded once. `data += chunk` decoded each
        // Buffer on its own, so a Cyrillic article name split across two chunks
        // came back with U+FFFD in the middle of the reported title.
        readResponseText(res).then(resolve, reject)
      })
      .on('error', reject)
    req.on('timeout', () => {
      req.destroy()
      reject(new Error(`${url} did not answer in ${FETCH_TIMEOUT_MS} ms`))
    })
  })
}

async function fetchJson(url) {
  const body = await fetchText(url)
  try {
    return JSON.parse(body)
  } catch (e) {
    throw new Error(`Bad JSON from ${url}: ${e.message}`)
  }
}

function classifyUrl(pathname) {
  if (pathname.startsWith('/travels/')) return KIND_TRAVEL
  if (QUEST_CATALOG_ROUTES.has(pathname)) return KIND_STATIC
  if (pathname.startsWith('/quests/')) {
    return pathname.slice('/quests/'.length).includes('/') ? KIND_QUEST_PAGE : KIND_QUEST_CITY
  }
  return KIND_STATIC
}

// One flat `<urlset>`, read live from the origin the URLs are inspected on: a
// checked-in copy would report the sitemap of whenever it was last generated,
// while the whole question here is what Google is being handed today.
function parseSitemap(xml) {
  const out = []
  const seen = new Set()
  for (const match of String(xml || '').matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/g)) {
    const loc = match[1].trim()
    if (!loc || seen.has(loc)) continue
    seen.add(loc)
    let pathname
    try {
      pathname = new URL(loc).pathname.replace(/(.)\/+$/, '$1')
    } catch {
      continue
    }
    out.push({ url: loc, pathname, kind: classifyUrl(pathname) })
  }
  return out
}

/**
 * `--user-id` belongs to the API-driven section only. Refusing it elsewhere
 * rather than ignoring it is the SEO-OPS-001 rule: a flag the run cannot honour
 * must fail where the operator sees it, not quietly widen or narrow the set.
 */
function resolveSection(args) {
  if (!SECTIONS.includes(args.section)) {
    throw new UsageError(`--section expects one of ${SECTIONS.join(', ')} — got "${args.section}"`)
  }
  if (args.section !== 'articles' && args.userId !== null) {
    throw new UsageError(
      `--user-id works only with --section articles: ${args.section} reads its URLs from sitemap.xml, ` +
        'which carries no author',
    )
  }
  return { section: args.section, userId: args.section === 'articles' ? args.userId || DEFAULT_USER_ID : null }
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

async function selectTargets(args, section, userId) {
  if (section === 'articles') {
    // An empty list is an environment/contract failure, not "0 problems": reporting
    // it as a success is exactly how the broken envelope read stayed invisible.
    const travels = requireNonEmptySelection(await listTravels(args.api, userId), {
      message:
        `${args.api}/api/travels/ вернул 0 статей для user_id=${userId} — ` +
        'проверьте доступность API и формат ответа',
    })
    return travels.map((t) => ({
      id: t.id,
      name: t.name,
      url: `${args.origin}/travels/${t.slug}`,
      kind: KIND_TRAVEL,
    }))
  }

  const sitemapUrl = `${args.origin}/sitemap.xml`
  const sitemap = requireNonEmptySelection(parseSitemap(await fetchText(sitemapUrl)), {
    message: `${sitemapUrl} вернул 0 адресов — проверьте доступность и формат карты сайта`,
  })
  const kinds = SECTION_KINDS[section]
  const picked = kinds ? sitemap.filter((u) => kinds.includes(u.kind)) : sitemap
  // A section that matches nothing is the same failure one level down: the
  // sitemap answered, but the run still has nothing to say about --section quests.
  return requireNonEmptySelection(picked, {
    message:
      `в ${sitemapUrl} нет ни одного адреса раздела --section ${section} ` +
      `(всего в карте сайта ${sitemap.length}) — проверьте генерацию sitemap`,
  }).map((u) => ({ id: null, name: u.pathname, url: u.url, kind: u.kind }))
}

async function inspect(token, site, inspectionUrl) {
  const body = JSON.stringify({ inspectionUrl, siteUrl: site, languageCode: 'ru' })
  const options = {
    method: 'POST',
    hostname: 'searchconsole.googleapis.com',
    path: '/v1/urlInspection/index:inspect',
    headers: withAcceptEncoding({
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
    }),
    timeout: FETCH_TIMEOUT_MS,
  }
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      readResponseText(res).then((data) => {
        if (res.statusCode === 200) {
          try {
            resolve({ ok: true, result: JSON.parse(data) })
          } catch (e) {
            reject(new Error(`Bad inspect JSON: ${e.message}`))
          }
        } else {
          resolve({ ok: false, status: res.statusCode, body: data })
        }
      }, reject)
    })
    req.on('error', reject)
    req.on('timeout', () => {
      req.destroy(new Error(`URL Inspection did not answer in ${FETCH_TIMEOUT_MS} ms`))
    })
    req.write(body)
    req.end()
  })
}

function classify(r) {
  const idx = (r && r.inspectionResult && r.inspectionResult.indexStatusResult) || {}
  return {
    verdict: idx.verdict || 'UNKNOWN', // PASS | PARTIAL | FAIL | NEUTRAL
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

function inspectionOutcome(verdict) {
  if (verdict === INDEXED_VERDICT) return 'indexed'
  if (NOT_INDEXED_VERDICTS.has(verdict)) return 'notIndexed'
  return 'unchecked'
}

function summarizeItems(items) {
  const byCoverageState = {}
  const byKind = {}
  const problems = []
  const uncheckedItems = []
  let indexed = 0
  let notIndexed = 0
  let unchecked = 0

  for (const item of items) {
    byCoverageState[item.coverageState] = (byCoverageState[item.coverageState] || 0) + 1
    const bucket =
      byKind[item.kind] ||
      (byKind[item.kind] = { total: 0, indexed: 0, notIndexed: 0, unchecked: 0 })
    const outcome = inspectionOutcome(item.verdict)
    bucket.total++
    bucket[outcome]++
    if (outcome === 'indexed') indexed++
    else if (outcome === 'notIndexed') {
      notIndexed++
      problems.push(item)
    } else {
      unchecked++
      uncheckedItems.push(item)
    }
  }

  return {
    total: items.length,
    indexed,
    notIndexed,
    unchecked,
    byKind,
    byCoverageState,
    problems,
    uncheckedItems,
  }
}

// The checkpoint is the run's live log: one JSON line per URL the moment its
// verdict lands, so a `--section all` run can be read while it is still going
// and a killed run resumes instead of re-spending quota on what it already knows.
function readCheckpoint(file) {
  const rows = new Map()
  if (!file || !fs.existsSync(file)) return rows
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const text = line.trim()
    if (!text) continue
    let row
    // A run killed mid-write leaves a half-written last line. That is a torn
    // record, not a corrupt log: drop it and re-inspect that one URL.
    try {
      row = JSON.parse(text)
    } catch {
      continue
    }
    // Only settled verdicts are reusable. An ERROR row is exactly what the retry
    // is for, and keeping it would let a transient failure freeze into the slice.
    if (row && row.url && inspectionOutcome(row.verdict) !== 'unchecked') rows.set(row.url, row)
  }
  return rows
}

function createCheckpointWriter(file) {
  if (!file) return () => {}
  fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true })
  // A killed run leaves its last line without the closing newline. Appending
  // straight onto it would glue the next record to the torn one, so the resume
  // after that would lose both records instead of the single torn one.
  if (fs.existsSync(file) && fs.statSync(file).size > 0) {
    const tail = fs.readFileSync(file, 'utf8').slice(-1)
    if (tail !== '\n') fs.appendFileSync(file, '\n')
  }
  return (row) => {
    fs.appendFileSync(file, JSON.stringify(row) + '\n')
  }
}

class FatalInspectionError extends Error {}

function assertInspectionCanContinue(resp, url) {
  if (resp.ok || ![401, 403, 429].includes(resp.status)) return
  throw new FatalInspectionError(
    `URL Inspection ${url} answered HTTP ${resp.status}; refusing to continue an incomplete run`,
  )
}

async function inspectTarget(t, args, getToken) {
  const url = t.url
  // Outside the try on purpose: a token that cannot be minted at all is a
  // precondition failure for every URL left, so it takes the run down here
  // instead of becoming one more ERROR row.
  const token = await getToken()
  let info
  try {
    let resp = await inspect(token, args.site, url)
    // 401 only. A GSC 403 means «no access to this property» or a rate limit,
    // and a fresh token changes neither — it would just double the quota this
    // run spends on every URL.
    if (!resp.ok && resp.status === 401) resp = await inspect(await getToken(true), args.site, url)
    if (!resp.ok && resp.status === 429) {
      // backoff and retry once
      await sleep(60000)
      resp = await inspect(await getToken(), args.site, url)
    }
    // Auth, property access and exhausted quota are run-wide preconditions. If
    // a permitted refresh/backoff did not recover them, stop instead of spending
    // the remaining quota on hundreds of rows that can only be unchecked.
    assertInspectionCanContinue(resp, url)
    info = resp.ok ? classify(resp.result) : { verdict: 'ERROR', coverageState: `HTTP ${resp.status}` }
  } catch (e) {
    if (e instanceof FatalInspectionError) throw e
    info = { verdict: 'ERROR', coverageState: e.message.slice(0, 60) }
  }
  // verdict PASS == "URL is on Google" (indexed). NEUTRAL/FAIL == not indexed.
  return { id: t.id, name: t.name, url, kind: t.kind, indexed: info.verdict === 'PASS', ...info }
}

function assertCompleteSummary(summary) {
  requireNoBatchFailures(summary.unchecked, {
    total: summary.total,
    what: 'URLs',
    message: `${summary.unchecked} URL не проверено — полный срез недействителен до успешного повтора`,
  })
}

async function main() {
  const args = parseArgs(process.argv)
  const { section, userId } = resolveSection(args)
  const getToken = createTokenSource()
  await getToken() // a broken login fails here, before the selection spends a fetch on it

  let targets = await selectTargets(args, section, userId)
  if (args.limit > 0) targets = targets.slice(0, args.limit)
  if (!args.json) {
    const scope = section === 'articles' ? `статей (user_id=${userId})` : `адресов (--section ${section})`
    console.error(`🔎 Проверяю индексацию ${targets.length} ${scope}…`)
  }

  const resumed = readCheckpoint(args.checkpoint)
  const writeCheckpoint = createCheckpointWriter(args.checkpoint)
  // The file's row count, not the reuse count: it may hold URLs outside this
  // section. How many were actually reused is reported after the run.
  if (resumed.size && !args.json) {
    console.error(`   ↻ в чекпойнте ${args.checkpoint}: ${resumed.size} готовых вердиктов`)
  }

  // Results are placed by index, never pushed: workers finish out of order, and
  // the report (and the checkpoint replay) must stay in sitemap order regardless
  // of which worker happened to answer first.
  const items = new Array(targets.length)
  let next = 0
  let done = 0
  let reused = 0
  let fatal = null

  const runWorker = async () => {
    while (fatal === null) {
      const i = next++
      if (i >= targets.length) return
      const t = targets[i]
      const cached = resumed.get(t.url)
      if (cached) {
        items[i] = cached
        reused++
        done++
        continue
      }
      const row = await inspectTarget(t, args, getToken)
      items[i] = row
      writeCheckpoint(row)
      done++
      if (!args.json && done % 25 === 0) console.error(`   …${done}/${targets.length}`)
      if (args.delayMs) await sleep(args.delayMs)
    }
  }

  const workers = Array.from({ length: Math.min(args.concurrency, targets.length) }, () =>
    // A fatal answer is a precondition failure for every URL left, so it stops
    // the other workers too instead of letting them drain the quota behind it.
    runWorker().catch((e) => {
      if (fatal === null) fatal = e
    }),
  )
  await Promise.all(workers)
  if (fatal) throw fatal

  const summary = summarizeItems(items)
  const result = {
    source: 'gsc-url-inspection',
    site: args.site,
    section,
    userId,
    checkedAt: new Date().toISOString(),
    // How many of those rows this run did not inspect. Without it a fully resumed
    // replay is byte-identical in shape to a fresh slice — `checkedAt` says "now"
    // for verdicts that may be days old, and the JSON reader has no way to tell.
    resumedFromCheckpoint: reused,
    total: summary.total,
    indexed: summary.indexed,
    notIndexed: summary.notIndexed,
    unchecked: summary.unchecked,
    byKind: summary.byKind,
    byCoverageState: summary.byCoverageState,
    problems: summary.problems.map((p) => ({
      id: p.id,
      name: p.name,
      url: p.url,
      kind: p.kind,
      coverageState: p.coverageState,
      verdict: p.verdict,
      robotsTxtState: p.robotsTxtState,
      lastCrawlTime: p.lastCrawlTime,
      googleCanonical: p.googleCanonical,
    })),
    uncheckedItems: summary.uncheckedItems.map((p) => ({
      id: p.id,
      name: p.name,
      url: p.url,
      kind: p.kind,
      coverageState: p.coverageState,
      verdict: p.verdict,
    })),
  }

  if (args.json) {
    process.stdout.write(JSON.stringify(result, null, 2) + '\n')
    assertCompleteSummary(summary)
    return
  }

  const scope = section === 'articles' ? `статей user_id=${userId}` : `раздела --section ${section}`
  console.log(`\n📑 Индексация ${scope} — ${args.site}`)
  console.log(`   Всего проверено: ${result.total}`)
  console.log(`   ✅ В индексе:     ${result.indexed}`)
  console.log(`   ❌ Не в индексе:  ${result.notIndexed}`)
  console.log(`   ⚠️  Не проверено:    ${result.unchecked}`)
  if (result.resumedFromCheckpoint) {
    console.log(`   ↻ Из чекпойнта:   ${result.resumedFromCheckpoint} (вердикт прошлого прогона)`)
  }
  console.log('')
  // Keyed by kind, not by `--section`: the two taxonomies are different (there is
  // no `--section quest-city`), and the same JSON already carries `section` at the
  // top level, so one name for both would send a reader to a flag that does not exist.
  const kindKeys = Object.keys(summary.byKind)
  if (kindKeys.length > 1) {
    console.log('   Виды страниц:')
    for (const kind of kindKeys) {
      const b = summary.byKind[kind]
      const label = KIND_LABELS[kind] || kind
      console.log(
        `     ${String(b.total).padStart(4)} | ${label}: ` +
          `✅ ${b.indexed} / ❌ ${b.notIndexed} / ⚠️ ${b.unchecked}`,
      )
    }
    console.log('')
  }
  console.log('   Причины (coverageState):')
  for (const [state, n] of Object.entries(summary.byCoverageState).sort((a, b) => b[1] - a[1])) {
    console.log(`     ${String(n).padStart(4)} | ${state}`)
  }
  if (summary.problems.length) {
    console.log(`\n   ❌ Не проиндексированные${args.onlyProblems ? '' : ' (первые 40)'}:`)
    const show = args.onlyProblems ? summary.problems : summary.problems.slice(0, 40)
    for (const p of show) {
      console.log(`     [${p.id === null ? p.kind : p.id}] ${p.coverageState} | ${p.url}`)
    }
  }
  if (summary.uncheckedItems.length) {
    console.log('\n   ⚠️  Не проверенные адреса (ошибка запроса):')
    for (const p of summary.uncheckedItems) {
      console.log(`     [${p.id === null ? p.kind : p.id}] ${p.coverageState} | ${p.url}`)
    }
  }
  console.log('')
  assertCompleteSummary(summary)
}

if (require.main === module) {
  runSeoCli(main, { name: 'index-status', usage: USAGE })
}

module.exports = {
  CLI_SPEC,
  SECTIONS,
  TOKEN_MAX_AGE_MS,
  USAGE,
  assertCompleteSummary,
  assertInspectionCanContinue,
  classify,
  classifyUrl,
  createCheckpointWriter,
  createTokenSource,
  inspect,
  inspectionOutcome,
  parseArgs,
  parseSitemap,
  pickListRows,
  readCheckpoint,
  resolveSection,
  summarizeItems,
}
