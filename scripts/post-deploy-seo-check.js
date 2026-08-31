#!/usr/bin/env node
/**
 * Post-deploy SEO checker.
 *
 * Validates raw HTML on production after deploy:
 * - status code / final URL
 * - title / description / canonical
 * - Open Graph / Twitter meta
 * - robots rules
 * - travel page SSR markers (H1 + Article JSON-LD)
 * - mobile icon / manifest presence on home
 *
 * `--help` prints USAGE below; every flag goes through the shared SEO CLI
 * contract (#1391). The hand-rolled `args.indexOf('--url')` this replaced answered
 * a typo with the default target, so `--ur https://dev.metravel.by` gated
 * PRODUCTION while reporting on the site nobody asked about (`SEO-OPS-001`).
 *
 * Exit codes: 0 = clean, 1 = errors found, 2 = bad invocation.
 */

const https = require('https')
const http = require('http')

const {
  parseCliArgs,
  requireNonEmptySelection,
  requireNoBatchFailures,
  runSeoCli,
} = require('./lib/seo-cli-contract')

const USAGE = `Post-deploy SEO check — metravel.by

Usage:
  node scripts/post-deploy-seo-check.js [options]

Options:
  --url <origin>        origin to check (default https://metravel.by)
  --verbose             also list passing pages and warning-only pages
  --json                print the full summary as JSON instead of a report
  --limit <n>           check only the first n queued URLs, 0 = all (default 0)
  --concurrency <n>     parallel page fetches (default 12)
  --insecure            skip TLS certificate validation (same as SEO_TEST_INSECURE=1)
  --help, -h            print this help and exit

Examples:
  node scripts/post-deploy-seo-check.js
  node scripts/post-deploy-seo-check.js --url https://dev.metravel.by --limit 30 --verbose`

/**
 * Every flag this script accepts. Anything else is a UsageError, so a mistyped
 * flag can no longer widen or redirect a production gate silently (#1391).
 */
const CLI_SPEC = {
  name: 'post-deploy-seo-check',
  usage: USAGE,
  selection: 'sitemap entries',
  flags: {
    url: {
      type: 'string',
      valueName: 'an origin',
      default: 'https://metravel.by',
      stripTrailingSlash: true,
    },
    verbose: { type: 'boolean' },
    json: { type: 'boolean' },
    limit: { type: 'int', min: 0, valueName: 'a non-negative integer', default: 0 },
    concurrency: { type: 'int', min: 1, valueName: 'a positive integer', default: 12 },
    insecure: { type: 'boolean' },
  },
}

const parseArgs = (argv) => parseCliArgs(argv, CLI_SPEC)

// Assigned in main() right after the parse: a module-level parse would run
// before runSeoCli() could map a UsageError onto exit code 2.
let SITE = ''
let VERBOSE = false
let JSON_OUTPUT = false
let INSECURE_TLS = false
let LIMIT = 0
let CONCURRENCY = 12

const FALLBACK_DESC = 'Найди место для путешествия и поделись своим опытом.'
const GENERIC_TITLES = new Set(['Metravel', 'MeTravel', 'Статья | Metravel'])

function fetchUrl(url, redirectDepth = 0, originalUrl = url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http
    const opts = {
      timeout: 30000,
      headers: { 'User-Agent': 'MeTravelPostDeploySEOCheck/1.0' },
    }
    if (mod === https) opts.rejectUnauthorized = !INSECURE_TLS

    const req = mod.get(url, opts, (res) => {
      const status = Number(res.statusCode || 0)
      if (status >= 300 && status < 400 && res.headers.location) {
        if (redirectDepth > 5) {
          reject(new Error(`Too many redirects for ${url}`))
          return
        }
        const nextUrl = res.headers.location.startsWith('http')
          ? res.headers.location
          : new URL(res.headers.location, url).toString()
        fetchUrl(nextUrl, redirectDepth + 1, originalUrl).then(resolve, reject)
        return
      }

      let body = ''
      res.setEncoding('utf8')
      res.on('data', (chunk) => { body += chunk })
      res.on('end', () => {
        resolve({
          url: originalUrl,
          finalUrl: url,
          status,
          headers: res.headers,
          body,
        })
      })
    })

    req.on('error', reject)
    req.on('timeout', () => {
      req.destroy()
      reject(new Error(`Timeout: ${url}`))
    })
  })
}

function normalizeComparableUrl(input) {
  try {
    const parsed = new URL(input)
    parsed.hash = ''
    if (parsed.pathname !== '/') {
      parsed.pathname = parsed.pathname.replace(/\/+$/, '')
    }
    return parsed.toString()
  } catch {
    return String(input || '').trim()
  }
}

function normalizeFetchedUrl(input) {
  try {
    const parsed = new URL(input)
    parsed.hash = ''
    return parsed.toString()
  } catch {
    return String(input || '').trim()
  }
}

function extractTitle(html) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  return match ? match[1].replace(/\s+/g, ' ').trim() : ''
}

function extractCanonical(html) {
  const match = html.match(/<link[^>]*rel="canonical"[^>]*href="([^"]*)"[^>]*\/?>/i)
  return match ? match[1].trim() : ''
}

function extractMetaContents(html, attr, value) {
  const pattern = new RegExp(`<meta[^>]*${attr}="${value}"[^>]*\\/?>`, 'gi')
  const matches = html.match(pattern) || []
  return matches.map((item) => item.match(/content="([^"]*)"/i)?.[1]?.trim() || '')
}

function countMatches(html, pattern) {
  return (html.match(pattern) || []).length
}

function extractJsonLdScripts(html) {
  return [...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)]
    .map((match) => match[1])
}

function getHeaderValue(headers, name) {
  const raw = headers?.[String(name || '').toLowerCase()]
  if (Array.isArray(raw)) return raw.join(', ')
  return typeof raw === 'string' ? raw : ''
}

function detectPageType(url) {
  const pathname = new URL(url).pathname
  if (pathname === '/') return 'home'
  if (pathname.startsWith('/travels/')) return 'travel'
  if (pathname.startsWith('/article/')) return 'article'
  if (pathname === '/search') return 'search'
  if (pathname === '/map') return 'map'
  if (pathname === '/login' || pathname === '/registration') return 'auth'
  return 'page'
}

function validateTitle(title, pageType) {
  const issues = []
  if (!title) {
    issues.push({ severity: 'error', code: 'title.missing', message: 'Missing <title>' })
    return issues
  }
  if (GENERIC_TITLES.has(title)) {
    issues.push({ severity: 'error', code: 'title.generic', message: `Generic title: "${title}"` })
  }
  if (title.length < 10 || title.length > 70) {
    issues.push({
      severity: pageType === 'travel' || pageType === 'article' ? 'warning' : 'warning',
      code: 'title.length',
      message: `Suspicious title length ${title.length}`,
    })
  }
  return issues
}

function validateDescription(desc, count) {
  const issues = []
  if (count !== 1) {
    issues.push({
      severity: 'error',
      code: 'description.duplicate',
      message: `Expected exactly 1 meta description, found ${count}`,
    })
  }
  if (!desc) {
    issues.push({ severity: 'error', code: 'description.missing', message: 'Missing meta description' })
    return issues
  }
  if (desc === FALLBACK_DESC) {
    issues.push({
      severity: 'error',
      code: 'description.generic',
      message: 'Description is generic fallback',
    })
  }
  if (desc.length < 80 || desc.length > 170) {
    issues.push({
      severity: 'warning',
      code: 'description.length',
      message: `Suspicious description length ${desc.length}`,
    })
  }
  return issues
}

function validateCanonical(canonical, html, finalUrl) {
  const issues = []
  const count = countMatches(html, /<link[^>]*rel="canonical"[^>]*\/?>/gi)
  if (!canonical) {
    issues.push({ severity: 'error', code: 'canonical.missing', message: 'Missing canonical' })
    return issues
  }
  if (count !== 1) {
    issues.push({
      severity: 'error',
      code: 'canonical.duplicate',
      message: `Expected exactly 1 canonical, found ${count}`,
    })
  }
  if (normalizeComparableUrl(canonical) !== normalizeComparableUrl(finalUrl)) {
    issues.push({
      severity: 'error',
      code: 'canonical.mismatch',
      message: `Canonical mismatch: "${canonical}" vs "${finalUrl}"`,
    })
  }
  return issues
}

function validateSocialMeta(html, title, desc, canonical, pageType) {
  const issues = []
  const ogTitle = extractMetaContents(html, 'property', 'og:title')[0] || ''
  const ogDesc = extractMetaContents(html, 'property', 'og:description')[0] || ''
  const ogImage = extractMetaContents(html, 'property', 'og:image')[0] || ''
  const ogUrl = extractMetaContents(html, 'property', 'og:url')[0] || ''
  const ogType = extractMetaContents(html, 'property', 'og:type')[0] || ''
  const twitterCard = extractMetaContents(html, 'name', 'twitter:card')[0] || ''
  const twitterTitle = extractMetaContents(html, 'name', 'twitter:title')[0] || ''
  const twitterDesc = extractMetaContents(html, 'name', 'twitter:description')[0] || ''
  const twitterImage = extractMetaContents(html, 'name', 'twitter:image')[0] || ''

  if (!ogTitle) issues.push({ severity: 'error', code: 'og.title.missing', message: 'Missing og:title' })
  if (!ogDesc) issues.push({ severity: 'error', code: 'og.description.missing', message: 'Missing og:description' })
  if (!ogImage) issues.push({ severity: 'error', code: 'og.image.missing', message: 'Missing og:image' })
  if (!ogUrl) issues.push({ severity: 'error', code: 'og.url.missing', message: 'Missing og:url' })
  if (!ogType) issues.push({ severity: 'error', code: 'og.type.missing', message: 'Missing og:type' })
  if (ogTitle && ogTitle !== title) {
    issues.push({ severity: 'error', code: 'og.title.mismatch', message: 'og:title differs from <title>' })
  }
  if (ogDesc && ogDesc !== desc) {
    issues.push({ severity: 'warning', code: 'og.description.mismatch', message: 'og:description differs from description' })
  }
  if (ogUrl && normalizeComparableUrl(ogUrl) !== normalizeComparableUrl(canonical)) {
    issues.push({ severity: 'error', code: 'og.url.mismatch', message: 'og:url differs from canonical' })
  }
  const expectedOgType = pageType === 'travel' || pageType === 'article' ? 'article' : 'website'
  if (ogType && ogType !== expectedOgType) {
    issues.push({
      severity: 'error',
      code: 'og.type.invalid',
      message: `Expected og:type="${expectedOgType}", got "${ogType}"`,
    })
  }
  if (ogImage && ogImage.includes('thumb_200')) {
    issues.push({ severity: 'error', code: 'og.image.thumb', message: 'og:image points to thumb_200' })
  }

  if (twitterCard !== 'summary_large_image') {
    issues.push({
      severity: 'error',
      code: 'twitter.card.invalid',
      message: `Expected twitter:card="summary_large_image", got "${twitterCard}"`,
    })
  }
  if (!twitterTitle) issues.push({ severity: 'error', code: 'twitter.title.missing', message: 'Missing twitter:title' })
  if (!twitterDesc) issues.push({ severity: 'error', code: 'twitter.description.missing', message: 'Missing twitter:description' })
  if (!twitterImage) issues.push({ severity: 'error', code: 'twitter.image.missing', message: 'Missing twitter:image' })

  return issues
}

/**
 * Routes the site deliberately keeps out of the index, where `noindex` is the
 * intended state and not a regression.
 *
 * The articles section is closed end to end: `scripts/generate-seo-pages.js`
 * stamps `noindex, nofollow` on `/articles`, on the id-less `/article` shell and
 * on every generated `/article/<id>` page, while `scripts/generate-sitemap.js`
 * emits none of them. This gate, though, hardcodes `/articles` into its core
 * route queue and treats every `page`/`article` as indexable, so it failed each
 * deploy on `robots.noindex` over a state the site had chosen on purpose.
 * `/places` is closed the same way (audit 2026-08-08) and would fail identically
 * the moment it entered the queue.
 *
 * Keep in sync with the `robots` fields in `scripts/generate-seo-pages.js`.
 */
const INTENTIONALLY_NOINDEX_PATHS = new Set(['/articles', '/article', '/places'])

function isIntentionallyNoindex(url) {
  if (!url) return false
  let pathname
  try {
    pathname = new URL(url).pathname
  } catch {
    return false
  }
  const normalized = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
  return INTENTIONALLY_NOINDEX_PATHS.has(normalized) || normalized.startsWith('/article/')
}

function validateRobots(html, pageType, url) {
  const robots = extractMetaContents(html, 'name', 'robots')[0] || ''
  const issues = []
  const deliberatelyClosed = isIntentionallyNoindex(url)
  if ((pageType === 'home' || pageType === 'search' || pageType === 'map' || pageType === 'page' || pageType === 'travel' || pageType === 'article') &&
      /noindex/i.test(robots) && !deliberatelyClosed) {
    issues.push({ severity: 'error', code: 'robots.noindex', message: `Indexable page has robots="${robots}"` })
  }
  // A closed route that quietly reopens is the same defect mirrored: `/places`
  // was found live as an indexable page with 605 characters of text and no
  // sitemap entry, which is how it reached the 2026-08-08 audit at all.
  if (deliberatelyClosed && !/noindex/i.test(robots)) {
    issues.push({
      severity: 'error',
      code: 'robots.closed.indexable',
      message: `Deliberately closed route has robots="${robots || '(none)'}"`,
    })
  }
  if (pageType === 'auth' && !/noindex/i.test(robots)) {
    issues.push({ severity: 'error', code: 'robots.auth', message: 'Auth page must be noindex' })
  }
  return issues
}

function validateSitemapResponse(result) {
  const issues = []
  const xRobotsTag = getHeaderValue(result.headers, 'x-robots-tag')
  const contentType = getHeaderValue(result.headers, 'content-type')

  if (result.status !== 200) {
    issues.push({
      severity: 'error',
      code: 'sitemap.status',
      message: `Sitemap returned HTTP ${result.status}`,
    })
  }

  if (xRobotsTag && /noindex/i.test(xRobotsTag)) {
    issues.push({
      severity: 'error',
      code: 'sitemap.xrobots.noindex',
      message: `Sitemap has X-Robots-Tag="${xRobotsTag}"`,
    })
  }

  if (contentType && !/xml/i.test(contentType)) {
    issues.push({
      severity: 'warning',
      code: 'sitemap.content_type',
      message: `Unexpected sitemap Content-Type "${contentType}"`,
    })
  }

  if (!/<(?:urlset|sitemapindex)\b/i.test(result.body || '')) {
    issues.push({
      severity: 'error',
      code: 'sitemap.body.invalid',
      message: 'Sitemap body is not valid XML sitemap markup',
    })
  }

  return {
    url: result.url,
    finalUrl: result.finalUrl,
    pageType: 'sitemap',
    title: '',
    issues,
  }
}

function getTravelSsgH1Tag(html) {
  const tags = String(html || '').match(/<h1\b[^>]*>/gi) || []
  return tags.find((tag) => {
    const className = tag.match(/\bclass\s*=\s*(["'])(.*?)\1/i)?.[2] || ''
    return className.split(/\s+/).includes('ssg-travel-h1')
  }) || ''
}

function hasHiddenTravelH1Declarations(value) {
  return /(?:^|;)\s*(?:position\s*:\s*absolute|display\s*:\s*none|visibility\s*:\s*hidden|overflow\s*:\s*hidden|clip(?:-path)?\s*:|(?:width|height)\s*:\s*(?:0(?:px)?|1px)|opacity\s*:\s*0)(?:\s*!important)?(?:;|$)/i.test(value)
}

function hasVisibleTravelSsgH1(html) {
  const tag = getTravelSsgH1Tag(html)
  if (!tag || /\s(?:hidden|inert)(?:\s|=|>)/i.test(tag) || /aria-hidden\s*=\s*["']true["']/i.test(tag)) {
    return false
  }
  const inlineStyle = tag.match(/\bstyle\s*=\s*(["'])(.*?)\1/i)?.[2] || ''
  const classStyles = [...String(html || '').matchAll(/\.ssg-travel-h1\s*\{([^}]*)\}/gi)]
    .map((match) => match[1])
  return !hasHiddenTravelH1Declarations(inlineStyle) &&
    !classStyles.some(hasHiddenTravelH1Declarations)
}

function validateTravelHtml(html) {
  const issues = []
  const h1Count = countMatches(html, /<h1\b/gi)
  if (h1Count !== 1) {
    issues.push({
      severity: 'error',
      code: 'travel.h1.count',
      message: `Expected exactly 1 raw HTML H1, found ${h1Count}`,
    })
  }
  if (!getTravelSsgH1Tag(html)) {
    issues.push({
      severity: 'error',
      code: 'travel.h1.marker',
      message: 'Missing normal-flow SSR travel H1 marker',
    })
  } else if (!hasVisibleTravelSsgH1(html)) {
    issues.push({
      severity: 'error',
      code: 'travel.h1.hidden',
      message: 'SSR travel H1 is hidden or clipped',
    })
  }
  const hasArticleJsonLd = extractJsonLdScripts(html).some((script) => {
    try {
      const parsed = JSON.parse(script)
      return parsed && parsed['@type'] === 'Article'
    } catch {
      return false
    }
  })
  if (!hasArticleJsonLd) {
    issues.push({
      severity: 'error',
      code: 'travel.schema.article',
      message: 'Missing Article JSON-LD on travel page',
    })
  }
  return issues
}

const SINGLE_H1_CORE_PATHS = new Set(['/map', '/articles', '/contact'])

function validateCorePageH1(html, finalUrl) {
  const pathname = new URL(finalUrl).pathname.replace(/\/+$/, '') || '/'
  if (!SINGLE_H1_CORE_PATHS.has(pathname)) return []

  const h1Count = countMatches(html, /<h1\b/gi)
  if (h1Count === 1) return []

  return [{
    severity: 'error',
    code: 'page.h1.count',
    message: `Expected exactly 1 raw HTML H1 on ${pathname}, found ${h1Count}`,
  }]
}

function validateHomeAssets(html) {
  const issues = []
  if (!/<link(?=[^>]*rel="apple-touch-icon")(?=[^>]*sizes="180x180")(?=[^>]*href="[^"]+\.png")[^>]*>/i.test(html)) {
    issues.push({
      severity: 'error',
      code: 'icon.apple-touch.missing',
      message: 'Missing apple-touch-icon 180x180',
    })
  }
  if (!/<link[^>]*rel="manifest"[^>]*href="\/manifest\.json"/i.test(html)) {
    issues.push({
      severity: 'error',
      code: 'manifest.missing',
      message: 'Missing manifest link',
    })
  }
  return issues
}

function validatePageResult(result) {
  const issues = []
  const pageType = detectPageType(result.finalUrl)
  const html = result.body
  const title = extractTitle(html)
  const descriptions = extractMetaContents(html, 'name', 'description')
  const desc = descriptions[0] || ''
  const canonical = extractCanonical(html)

  if (result.status !== 200) {
    issues.push({
      severity: 'error',
      code: 'http.status',
      message: `Expected 200, got ${result.status}`,
    })
  }

  if (normalizeFetchedUrl(result.url) !== normalizeFetchedUrl(result.finalUrl)) {
    issues.push({
      severity: 'error',
      code: 'http.redirect',
      message: `URL redirected: "${result.url}" -> "${result.finalUrl}"`,
    })
  }

  issues.push(...validateTitle(title, pageType))
  issues.push(...validateDescription(desc, descriptions.length))
  issues.push(...validateCanonical(canonical, html, result.finalUrl))
  issues.push(...validateSocialMeta(html, title, desc, canonical, pageType))
  issues.push(...validateRobots(html, pageType, result.finalUrl))
  issues.push(...validateCorePageH1(html, result.finalUrl))

  if (pageType === 'travel') {
    issues.push(...validateTravelHtml(html))
  }
  if (pageType === 'home') {
    issues.push(...validateHomeAssets(html))
  }

  return {
    url: result.url,
    finalUrl: result.finalUrl,
    pageType,
    title,
    issues,
  }
}

function parseSitemapUrls(xml) {
  return [...xml.matchAll(/<loc>(https?:\/\/[^<]+)<\/loc>/gi)].map((match) => match[1].trim())
}

async function mapLimit(items, limit, worker) {
  const results = new Array(items.length)
  let index = 0

  async function runWorker() {
    while (index < items.length) {
      const current = index++
      results[current] = await worker(items[current], current)
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, runWorker))
  return results
}

async function loadTargetUrls() {
  const sitemapResponse = await fetchUrl(`${SITE}/sitemap.xml`)
  if (sitemapResponse.status !== 200) {
    throw new Error(`Could not fetch sitemap.xml: HTTP ${sitemapResponse.status}`)
  }

  // The seven core routes below are hardcoded, so the merged queue is never
  // empty and cannot detect a broken sitemap. A sitemap that parses to zero
  // <loc> entries means the gate would check the static routes and call the
  // deploy clean without looking at a single article (#1325).
  const sitemapUrls = requireNonEmptySelection(parseSitemapUrls(sitemapResponse.body), {
    what: '<loc> entries',
    source: `${SITE}/sitemap.xml`,
    hint: 'the gate would pass on the static routes alone, checking no article at all',
  })
  const coreUrls = [
    `${SITE}/`,
    `${SITE}/search`,
    `${SITE}/map`,
    `${SITE}/articles`,
    `${SITE}/contact`,
    `${SITE}/travelsby`,
    `${SITE}/about`,
    `${SITE}/login`,
    `${SITE}/registration`,
  ]

  const deduped = Array.from(new Set([...coreUrls, ...sitemapUrls]))
  return {
    sitemapResponse,
    urls: LIMIT > 0 ? deduped.slice(0, LIMIT) : deduped,
  }
}

function printSummary(summary) {
  if (JSON_OUTPUT) {
    console.log(JSON.stringify(summary, null, 2))
    return
  }

  console.log(`\n📊 Checked: ${summary.totalPages} pages`)
  console.log(`❌ Errors: ${summary.errorCount}`)
  console.log(`⚠️  Warnings: ${summary.warningCount}`)

  if (summary.failedPages.length > 0) {
    console.log('\nFailed pages:')
    for (const page of summary.failedPages) {
      console.log(`- ${page.finalUrl}`)
      for (const issue of page.issues) {
        console.log(`  ${issue.severity === 'error' ? '✗' : '!'} ${issue.code}: ${issue.message}`)
      }
    }
  }

  if (VERBOSE && summary.warningPages.length > 0) {
    console.log('\nWarning-only pages:')
    for (const page of summary.warningPages) {
      console.log(`- ${page.finalUrl}`)
      for (const issue of page.issues) {
        console.log(`  ! ${issue.code}: ${issue.message}`)
      }
    }
  }
}

async function main() {
  const args = parseArgs(process.argv)
  SITE = args.url
  VERBOSE = args.verbose
  JSON_OUTPUT = args.json
  INSECURE_TLS = args.insecure || String(process.env.SEO_TEST_INSECURE || '0') === '1'
  LIMIT = args.limit
  CONCURRENCY = args.concurrency

  const { sitemapResponse, urls } = await loadTargetUrls()
  if (!JSON_OUTPUT) {
    console.log(`🌐 Post-deploy SEO check against ${SITE}`)
    console.log(`📄 Queue: ${urls.length + 1} pages`)
  }

  const pageChecks = await mapLimit(urls, CONCURRENCY, async (url) => {
    try {
      const response = await fetchUrl(url)
      const validated = validatePageResult(response)
      if (VERBOSE && validated.issues.length === 0 && !JSON_OUTPUT) {
        console.log(`✅ ${validated.finalUrl}`)
      }
      return validated
    } catch (error) {
      return {
        url,
        finalUrl: url,
        pageType: detectPageType(url),
        title: '',
        issues: [{
          severity: 'error',
          code: 'fetch.failed',
          message: error instanceof Error ? error.message : String(error),
        }],
      }
    }
  })
  const checked = [validateSitemapResponse(sitemapResponse), ...pageChecks]

  const summary = {
    site: SITE,
    totalPages: checked.length,
    errorCount: checked.reduce((acc, page) => acc + page.issues.filter((issue) => issue.severity === 'error').length, 0),
    warningCount: checked.reduce((acc, page) => acc + page.issues.filter((issue) => issue.severity === 'warning').length, 0),
    failedPages: checked.filter((page) => page.issues.some((issue) => issue.severity === 'error')),
    warningPages: checked.filter((page) => page.issues.length > 0 && page.issues.every((issue) => issue.severity === 'warning')),
  }

  printSummary(summary)
  requireNoBatchFailures(summary.failedPages.length, {
    total: summary.totalPages,
    what: 'pages',
    message: `${summary.failedPages.length} of ${summary.totalPages} pages failed with ${summary.errorCount} SEO error(s) — see the report above`,
  })
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    CLI_SPEC,
    USAGE,
    parseArgs,
    detectPageType,
    extractTitle,
    extractCanonical,
    extractMetaContents,
    isIntentionallyNoindex,
    normalizeComparableUrl,
    normalizeFetchedUrl,
    parseSitemapUrls,
    validateCanonical,
    validateCorePageH1,
    validateDescription,
    validateHomeAssets,
    validatePageResult,
    validateSitemapResponse,
    validateRobots,
    validateSocialMeta,
    validateTitle,
    validateTravelHtml,
    hasVisibleTravelSsgH1,
  }
}

if (require.main === module) {
  runSeoCli(main, { name: 'post-deploy-seo-check', usage: USAGE })
}
