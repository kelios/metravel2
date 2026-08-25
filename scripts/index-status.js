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
const https = require('https')
const { getAccessToken } = require('./lib/google-token')
const {
  UsageError,
  parseCliArgs,
  requireNonEmptySelection,
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
  --delay <ms>          pause between inspections (default 250)
  --help, -h            print this help and exit

Examples:
  node scripts/index-status.js --limit 5
  node scripts/index-status.js --json --only-problems
  node scripts/index-status.js --section all --json --only-problems`

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
  },
}

const parseArgs = (argv) => parseCliArgs(argv, CLI_SPEC)

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

// Google mints an access token for 3599 s (probe 25.08.2026), and URL Inspection
// answers in ~6.7 s, so `--section all` over the 673 URLs of sitemap.xml runs
// longer than the token lives. Taken once before the loop — as it was until #1559,
// when the longest run was 310 articles and fitted in the hour — the token dies
// mid-run and every remaining inspection comes back HTTP 401, which the loop below
// files as `verdict: ERROR`, i.e. as «не в индексе». That would be an auth failure
// printed as an index verdict, on the one run whose job is to say how much of the
// site Google has.
const TOKEN_MAX_AGE_MS = 45 * 60 * 1000

function createTokenSource() {
  let token = null
  let takenAt = 0
  return async (force = false) => {
    if (!force && token && Date.now() - takenAt < TOKEN_MAX_AGE_MS) return token
    // Cleared before the call, not after it: a refresh that fails must not leave
    // the dead token in place, or the run would carry on and write one HTTP 401
    // row per remaining URL instead of stopping at the failure.
    token = null
    const { accessToken } = await getAccessToken(SCOPE)
    token = accessToken
    takenAt = Date.now()
    return token
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
      rejectUnauthorized: false,
      timeout: FETCH_TIMEOUT_MS,
      headers: { 'User-Agent': 'metravel-index-status' },
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
        let data = ''
        // Explicit, because `data += chunk` decodes each Buffer on its own: a
        // Cyrillic article name split across two chunks would come back with
        // U+FFFD in the middle of the reported title.
        res.setEncoding('utf8')
        res.on('data', (c) => (data += c))
        res.on('end', () => resolve(data))
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
  const { section, userId } = resolveSection(args)
  const getToken = createTokenSource()
  await getToken() // a broken login fails here, before the selection spends a fetch on it

  let targets = await selectTargets(args, section, userId)
  if (args.limit > 0) targets = targets.slice(0, args.limit)
  if (!args.json) {
    const scope = section === 'articles' ? `статей (user_id=${userId})` : `адресов (--section ${section})`
    console.error(`🔎 Проверяю индексацию ${targets.length} ${scope}…`)
  }

  const items = []
  const byState = {}
  // Keyed by kind, not by `--section`: the two taxonomies are different (there is
  // no `--section quest-city`), and the same JSON already carries `section` at the
  // top level, so one name for both would send a reader to a flag that does not exist.
  const byKind = {}
  let done = 0
  for (const t of targets) {
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
      info = resp.ok ? classify(resp.result) : { verdict: 'ERROR', coverageState: `HTTP ${resp.status}` }
    } catch (e) {
      info = { verdict: 'ERROR', coverageState: e.message.slice(0, 60) }
    }
    // verdict PASS == "URL is on Google" (indexed). NEUTRAL/FAIL == not indexed.
    const indexed = info.verdict === 'PASS'
    const row = { id: t.id, name: t.name, url, kind: t.kind, indexed, ...info }
    items.push(row)
    byState[info.coverageState] = (byState[info.coverageState] || 0) + 1
    const bucket = byKind[t.kind] || (byKind[t.kind] = { total: 0, indexed: 0, notIndexed: 0 })
    bucket.total++
    bucket[indexed ? 'indexed' : 'notIndexed']++
    done++
    if (!args.json && done % 25 === 0) console.error(`   …${done}/${targets.length}`)
    if (args.delayMs) await sleep(args.delayMs)
  }

  const problems = items.filter((r) => !r.indexed)
  // A URL the run could not inspect is «нет данных», not «не в индексе». It stays
  // counted in notIndexed, so the field means for the daily run exactly what it
  // meant before, but it is also named on its own: шаг 1.2 of the seo-daily routine
  // files a card when notIndexed grows, and a dead token or a 500 must not be what
  // raises it.
  const unchecked = items.filter((r) => r.verdict === 'ERROR').length
  const result = {
    source: 'gsc-url-inspection',
    site: args.site,
    section,
    userId,
    checkedAt: new Date().toISOString(),
    total: items.length,
    indexed: items.length - problems.length,
    notIndexed: problems.length,
    unchecked,
    byKind,
    byCoverageState: byState,
    problems: problems.map((p) => ({
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
  }

  if (args.json) {
    process.stdout.write(JSON.stringify(result, null, 2) + '\n')
    return
  }

  const scope = section === 'articles' ? `статей user_id=${userId}` : `раздела --section ${section}`
  console.log(`\n📑 Индексация ${scope} — ${args.site}`)
  console.log(`   Всего проверено: ${result.total}`)
  console.log(`   ✅ В индексе:     ${result.indexed}`)
  console.log(`   ❌ Не в индексе:  ${result.notIndexed}`)
  if (unchecked) {
    console.log(`   ⚠️  Из них не проверено (ошибка запроса, не вердикт Google): ${unchecked}`)
  }
  console.log('')
  const kindKeys = Object.keys(byKind)
  if (kindKeys.length > 1) {
    console.log('   Виды страниц:')
    for (const kind of kindKeys) {
      const b = byKind[kind]
      const label = KIND_LABELS[kind] || kind
      console.log(`     ${String(b.total).padStart(4)} | ${label}: ✅ ${b.indexed} / ❌ ${b.notIndexed}`)
    }
    console.log('')
  }
  console.log('   Причины (coverageState):')
  for (const [state, n] of Object.entries(byState).sort((a, b) => b[1] - a[1])) {
    console.log(`     ${String(n).padStart(4)} | ${state}`)
  }
  if (problems.length) {
    console.log(`\n   ❌ Не проиндексированные${args.onlyProblems ? '' : ' (первые 40)'}:`)
    const show = args.onlyProblems ? problems : problems.slice(0, 40)
    for (const p of show) {
      console.log(`     [${p.id === null ? p.kind : p.id}] ${p.coverageState} | ${p.url}`)
    }
  }
  console.log('')
}

if (require.main === module) {
  runSeoCli(main, { name: 'index-status', usage: USAGE })
}

module.exports = {
  CLI_SPEC,
  SECTIONS,
  TOKEN_MAX_AGE_MS,
  USAGE,
  classify,
  classifyUrl,
  createTokenSource,
  parseArgs,
  parseSitemap,
  pickListRows,
  resolveSection,
}
