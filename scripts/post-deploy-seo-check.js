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
 * Usage:
 *   node scripts/post-deploy-seo-check.js [--url https://metravel.by] [--verbose]
 *     [--json] [--limit 50] [--concurrency 12] [--insecure]
 */

const https = require('https')
const http = require('http')

const args = process.argv.slice(2)

function hasFlag(name) {
  return args.includes(`--${name}`)
}

function getArg(name, fallback) {
  const idx = args.indexOf(`--${name}`)
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : fallback
}

const SITE = getArg('url', 'https://metravel.by').replace(/\/+$/, '')
const VERBOSE = hasFlag('verbose')
const JSON_OUTPUT = hasFlag('json')
const INSECURE_TLS =
  hasFlag('insecure') || String(process.env.SEO_TEST_INSECURE || '0') === '1'
const LIMIT = Math.max(0, Number.parseInt(getArg('limit', '0'), 10) || 0)
const CONCURRENCY = Math.max(1, Number.parseInt(getArg('concurrency', '12'), 10) || 12)
const FALLBACK_DESC = 'Найди место для путешествия и поделись своим опытом.'
const GENERIC_TITLES = new Set(['Metravel', 'MeTravel', 'Статья | Metravel'])

function fetchUrl(url, redirectDepth = 0) {
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
        fetchUrl(nextUrl, redirectDepth + 1).then(resolve, reject)
        return
      }

      let body = ''
      res.setEncoding('utf8')
      res.on('data', (chunk) => { body += chunk })
      res.on('end', () => {
        resolve({
          url,
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

function validateRobots(html, pageType) {
  const robots = extractMetaContents(html, 'name', 'robots')[0] || ''
  const issues = []
  if ((pageType === 'home' || pageType === 'search' || pageType === 'map' || pageType === 'page' || pageType === 'travel' || pageType === 'article') &&
      /noindex/i.test(robots)) {
    issues.push({ severity: 'error', code: 'robots.noindex', message: `Indexable page has robots="${robots}"` })
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
  if (!/data-ssg-travel-h1="true"/i.test(html)) {
    issues.push({
      severity: 'error',
      code: 'travel.h1.marker',
      message: 'Missing SSR travel H1 marker',
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

function validateHomeAssets(html) {
  const issues = []
  if (!/<link[^>]*rel="apple-touch-icon"[^>]*href="\/assets\/icons\/apple-touch-icon-180x180\.png"/i.test(html)) {
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

  issues.push(...validateTitle(title, pageType))
  issues.push(...validateDescription(desc, descriptions.length))
  issues.push(...validateCanonical(canonical, html, result.finalUrl))
  issues.push(...validateSocialMeta(html, title, desc, canonical, pageType))
  issues.push(...validateRobots(html, pageType))

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

  const sitemapUrls = parseSitemapUrls(sitemapResponse.body)
  const coreUrls = [
    `${SITE}/`,
    `${SITE}/search`,
    `${SITE}/map`,
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

  if (summary.errorCount > 0) {
    process.exit(1)
  }

  process.exit(0)
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    detectPageType,
    extractTitle,
    extractCanonical,
    extractMetaContents,
    normalizeComparableUrl,
    parseSitemapUrls,
    validateCanonical,
    validateDescription,
    validateHomeAssets,
    validatePageResult,
    validateSitemapResponse,
    validateRobots,
    validateSocialMeta,
    validateTitle,
    validateTravelHtml,
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error('❌ Post-deploy SEO check failed:', error)
    process.exit(1)
  })
}
