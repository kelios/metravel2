#!/usr/bin/env node

/**
 * Static quest SEO gate for the production build.
 *
 * generate-seo-pages.js writes a page per quest, per city alias and per city
 * landing. A transient API failure used to skip that whole block while the
 * build still succeeded, so a release could silently ship without a single
 * quest page. This verifier compares the live quest catalog against the built
 * dist and fails the deploy before anything reaches the server.
 *
 * Usage:
 *   node scripts/verify-static-quest-seo.js [--dist <dir>] [--api <url>] [--sample-size <n>]
 *     [--verify-country-sitemap]
 */

const fs = require('fs')
const path = require('path')
const http = require('http')
const https = require('https')

const { fetchJson } = require('./lib/fetchJson')
const {
  questRouteKey,
  buildQuestCityAliasMap,
  buildQuestCityLandingGroups,
  questRouteVariants,
} = require('../utils/questCityAlias')
const { buildQuestCountryLandingGroups } = require('../utils/questCountryLanding')

const args = process.argv.slice(2)

function getArg(name, fallback) {
  const index = args.indexOf(`--${name}`)
  return index !== -1 && args[index + 1] ? args[index + 1] : fallback
}

const DIST_DIR = path.resolve(getArg('dist', 'dist/prod'))
const API_BASE = getArg('api', 'https://metravel.by').replace(/\/+$/, '')
const SITE_URL = 'https://metravel.by'
// Country sitemap ownership is Django task #1606. Pre-deploy frontend builds
// verify local country HTML but do not require not-yet-deployed sitemap rows.
// Production acceptance enables this explicit flag after the coordinated deploy.
const VERIFY_COUNTRY_SITEMAP = args.includes('--verify-country-sitemap')
const sampleSizeArg = getArg('sample-size')
const SAMPLE_SIZE =
  typeof sampleSizeArg === 'string' && sampleSizeArg.trim().length > 0
    ? Math.max(1, Number.parseInt(sampleSizeArg, 10) || 1)
    : null
const MAX_CATALOG_PAGES = 50
const MAX_SITEMAP_REDIRECTS = 5
const FETCH_TIMEOUT_MS = 30000

function fetchText(url, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https:') ? https : http
    const request = mod.get(
      url,
      {
        timeout: FETCH_TIMEOUT_MS,
        headers: {
          Accept: 'application/xml,text/xml;q=0.9,*/*;q=0.8',
          'User-Agent': 'MeTravelSeoBuild/1.0 (+https://metravel.by)',
        },
      },
      (response) => {
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          response.resume()
          if (redirectCount >= MAX_SITEMAP_REDIRECTS) {
            reject(new Error(`${url} redirected more than ${MAX_SITEMAP_REDIRECTS} times`))
            return
          }
          const nextUrl = new URL(response.headers.location, url).toString()
          fetchText(nextUrl, redirectCount + 1).then(resolve, reject)
          return
        }
        if (response.statusCode !== 200) {
          response.resume()
          reject(new Error(`${url} answered HTTP ${response.statusCode}`))
          return
        }

        let body = ''
        response.setEncoding('utf8')
        response.on('data', (chunk) => {
          body += chunk
        })
        response.on('end', () => resolve(body))
      },
    )

    request.on('error', reject)
    request.on('timeout', () => {
      request.destroy()
      reject(new Error(`${url} did not answer in ${FETCH_TIMEOUT_MS} ms`))
    })
  })
}

async function fetchBackendSitemap(fetcher = fetchText) {
  const sitemapUrl = `${API_BASE}/sitemap.xml`
  const sitemapXml = String(await fetcher(sitemapUrl) || '').trim()
  if (!sitemapXml) throw new Error(`Backend sitemap is empty: ${sitemapUrl}`)
  if (!/<urlset(?:\s|>)/i.test(sitemapXml)) {
    throw new Error(`Backend sitemap has no <urlset>: ${sitemapUrl}`)
  }
  return sitemapXml
}

function extractItems(payload) {
  if (Array.isArray(payload)) return payload
  if (payload && typeof payload === 'object') {
    return payload.data || payload.results || payload.items || []
  }
  return []
}

function getTitle(html) {
  const match = html.match(/<title[^>]*>(.*?)<\/title>/i)
  return match ? match[1].trim() : ''
}

function getMetaContent(html, attr, name) {
  const regex = new RegExp(`<meta[^>]*${attr}="${name}"[^>]*content="([^"]*)"[^>]*\\/?>`, 'i')
  const match = html.match(regex)
  return match ? match[1] : ''
}

function countHtmlMatches(html, regex) {
  return (String(html || '').match(regex) || []).length
}

function hasQuestIntroSection(html) {
  return /<section[^>]*data-ssg-quest-intro="true"[^>]*>[\s\S]*?<\/section>/i.test(html)
}

function hasQuestCityLandingSection(html) {
  return /<section[^>]*data-ssg-quest-city="true"[^>]*>[\s\S]*?<\/section>/i.test(html)
}

function hasQuestCityStandaloneContent(html) {
  return (
    /data-ssg-quest-city-overview="true"/i.test(html) &&
    /data-ssg-quest-city-practical="true"/i.test(html)
  )
}

function hasQuestCountryLandingSection(html) {
  return /<section[^>]*data-ssg-quest-country="true"[^>]*>[\s\S]*?<\/section>/i.test(html)
}

function hasQuestCountryStandaloneContent(html) {
  return (
    /data-ssg-quest-country-overview="true"/i.test(html) &&
    /data-ssg-quest-country-cities="true"/i.test(html) &&
    /data-ssg-quest-country-practical="true"/i.test(html)
  )
}

function getCanonical(html) {
  const match = html.match(/<link[^>]*rel="canonical"[^>]*href="([^"]*)"[^>]*\/?>/i)
  return match ? match[1] : ''
}

function verifyQuestCityHtml(html, expectedCanonical, childHtml = '') {
  const title = getTitle(html)
  const description = getMetaContent(html, 'name', 'description')
  const issues = []

  if (!title || title === 'Metravel') issues.push('generic-or-missing <title>')
  if (!description) issues.push('missing description')
  if (getCanonical(html) !== expectedCanonical) {
    issues.push(`bad canonical: ${getCanonical(html) || 'missing'}`)
  }
  if (!hasQuestCityLandingSection(html)) issues.push('missing crawlable quest-city section')
  if (!hasQuestCityStandaloneContent(html)) issues.push('missing independent city overview/practical content')

  if (childHtml) {
    const childTitle = getTitle(childHtml)
    const childDescription = getMetaContent(childHtml, 'name', 'description')
    if (childTitle && title === childTitle) issues.push('title duplicates the only quest page')
    if (childDescription && description === childDescription) {
      issues.push('description duplicates the only quest page')
    }
  }

  return issues
}

function verifyQuestCountryHtml(
  html,
  expectedCanonical,
  expectedCityPaths = [],
  expectedQuestPaths = [],
  childHtml = '',
) {
  const title = getTitle(html)
  const description = getMetaContent(html, 'name', 'description')
  const canonical = getCanonical(html)
  const ogUrl = getMetaContent(html, 'property', 'og:url')
  const issues = []

  if (!title || title === 'Metravel') issues.push('generic-or-missing <title>')
  if (countHtmlMatches(html, /<title(?:\s[^>]*)?>[\s\S]*?<\/title>/gi) > 1) {
    issues.push('duplicate <title>')
  }
  if (!description) issues.push('missing description')
  if (countHtmlMatches(html, /<meta[^>]*name="description"[^>]*\/?>/gi) > 1) {
    issues.push('duplicate description')
  }
  if (canonical !== expectedCanonical) {
    issues.push(`bad canonical: ${canonical || 'missing'}`)
  }
  if (countHtmlMatches(html, /<link[^>]*rel="canonical"[^>]*\/?>/gi) > 1) {
    issues.push('duplicate canonical')
  }
  if (ogUrl !== expectedCanonical) {
    issues.push(`bad og:url: ${ogUrl || 'missing'}`)
  }
  if (countHtmlMatches(html, /<meta[^>]*property="og:url"[^>]*\/?>/gi) > 1) {
    issues.push('duplicate og:url')
  }
  if (!hasQuestCountryLandingSection(html)) issues.push('missing crawlable quest-country section')
  if (!hasQuestCountryStandaloneContent(html)) {
    issues.push('missing independent country overview/cities/practical content')
  }

  for (const cityPath of expectedCityPaths) {
    if (!html.includes(`href="${cityPath}"`)) issues.push(`missing city link: ${cityPath}`)
  }
  for (const questPath of expectedQuestPaths) {
    if (!html.includes(`href="${questPath}"`)) issues.push(`missing quest link: ${questPath}`)
  }

  if (childHtml) {
    const childTitle = getTitle(childHtml)
    const childDescription = getMetaContent(childHtml, 'name', 'description')
    if (childTitle && title === childTitle) issues.push('title duplicates the only quest page')
    if (childDescription && description === childDescription) {
      issues.push('description duplicates the only quest page')
    }
  }

  return issues
}

function verifyQuestCountryMetadataUniqueness(pages) {
  const seenTitles = new Map()
  const seenDescriptions = new Map()
  const issues = []

  const check = (pagePath, field, value, seen) => {
    const key = String(value || '').trim().replace(/\s+/g, ' ').toLowerCase()
    if (!key) return

    const previousPath = seen.get(key)
    if (previousPath && previousPath !== pagePath) {
      issues.push(`country landing ${pagePath}: ${field} duplicates ${previousPath}`)
      return
    }
    seen.set(key, pagePath)
  }

  for (const page of Array.isArray(pages) ? pages : []) {
    const pagePath = String(page?.path || '').trim() || '(unknown country path)'
    const html = String(page?.html || '')
    check(pagePath, 'title', getTitle(html), seenTitles)
    check(pagePath, 'description', getMetaContent(html, 'name', 'description'), seenDescriptions)
  }

  return issues
}

function hasQuestJsonLd(html) {
  return /<script[^>]*application\/ld\+json[^>]*>[\s\S]*?"@type"\s*:\s*"TouristTrip"[\s\S]*?<\/script>/i.test(html)
}

/** Every file generate-seo-pages.js must have written for one quest */
function expectedQuestFiles(quest, cityAliasMap) {
  return questRouteVariants(quest, cityAliasMap).flatMap((variant) => [
    path.join('quests', variant.cityId, `${variant.questId}.html`),
    path.join('quests', variant.cityId, variant.questId, 'index.html'),
  ])
}

/**
 * The travel↔quest cross-link block. It is written onto travel pages, but it is
 * built from the quest catalog — so an empty catalog strips it from every travel
 * page while verify-static-travel-seo.js stays green.
 */
const TRAVEL_QUEST_PROMO_MARKER = 'data-ssg-travel-quest-promo="true"'

/** Travel pages on disk, as generate-seo-pages.js writes them */
function listTravelPageFiles(distDir) {
  const travelsDir = path.join(distDir, 'travels')
  if (!fs.existsSync(travelsDir)) return []

  return fs
    .readdirSync(travelsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(travelsDir, entry.name, 'index.html'))
    .filter((filePath) => fs.existsSync(filePath))
}

/** How many travel pages actually carry a quest promo block */
function countTravelQuestPromoPages(files, readFile) {
  const read = readFile || ((filePath) => fs.readFileSync(filePath, 'utf8'))
  return files.filter((filePath) => read(filePath).includes(TRAVEL_QUEST_PROMO_MARKER)).length
}

/**
 * Quest routes each alias landing must link to. Several city_id values can map
 * to one alias (the same city duplicated in the catalog), and the alias landing
 * addresses the city — so it has to list all of their quests, not just the ones
 * that survived the last write.
 */
function expectedAliasLandingQuests(quests, cityAliasMap) {
  const byAlias = new Map()

  for (const quest of Array.isArray(quests) ? quests : []) {
    const route = questRouteKey(quest)
    if (!route) continue
    const alias = cityAliasMap?.get(route.cityId)
    if (!alias || alias === route.cityId) continue
    if (!byAlias.has(alias)) byAlias.set(alias, new Set())
    byAlias.get(alias).add(route.path)
  }

  return byAlias
}

/** Quest routes an already-rendered landing links to */
function missingLandingQuestLinks(html, questPaths) {
  return [...questPaths].filter((questPath) => !html.includes(`href="${questPath}"`))
}

/** Every city landing (numeric id + alias) implied by the quest catalog */
function expectedCityLandingFiles(quests, cityAliasMap) {
  const files = new Set()
  for (const city of buildQuestCityLandingGroups(quests, cityAliasMap)) {
    for (const segment of [...city.cityIds, city.segment]) {
      files.add(path.join('quests', segment, 'index.html'))
    }
  }
  return [...files]
}

/** Every canonical country landing implied by valid catalog country codes. */
function expectedCountryLandingFiles(quests) {
  return buildQuestCountryLandingGroups(quests, { locale: 'ru' })
    .map((country) => path.join('quests', 'country', country.countryAlias, 'index.html'))
}

function sitemapHasUrl(xml, url) {
  const escaped = String(url).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return xml.includes(`<loc>${escaped}</loc>`)
}

/** Country landing aliases the backend sitemap actually publishes. */
function sitemapCountryAliases(xml) {
  const prefix = `${SITE_URL}/quests/country/`
  const aliases = new Set()
  for (const [, loc] of String(xml).matchAll(/<loc>([^<]+)<\/loc>/g)) {
    const decoded = loc
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .trim()
    if (!decoded.startsWith(prefix)) continue
    const alias = decoded.slice(prefix.length).replace(/\/+$/, '')
    if (alias && !alias.includes('/')) aliases.add(alias)
  }
  return aliases
}

/**
 * Both directions of the FE↔BE alias contract, because the alias vocabulary is
 * the contract. The frontend derives an alias from the English CLDR display name
 * (`Intl.DisplayNames`), so `RU → russia`; a backend built on ISO 3166 official
 * names produces `russian-federation` instead. The two agree for every country
 * whose official name is a single word and diverge only where it carries extra
 * words — which is why sampling belarus/poland/armenia/denmark passed #1606
 * acceptance on 2026-08-31 while three sitemap URLs were already dead.
 *
 * A missing row only costs discovery. An extra row is worse: nothing serves that
 * path, nginx falls back to the SPA shell, and Google is handed a
 * "Квест не найден" page that still answers HTTP 200.
 */
function verifyQuestCountrySitemap(countryGroups, sitemapXml, required = false) {
  if (!required) return []
  const expected = countryGroups.map((country) => country.countryAlias)
  const failures = expected
    .map((alias) => `${SITE_URL}/quests/country/${alias}`)
    .filter((canonical) => !sitemapHasUrl(sitemapXml, canonical))
    .map((canonical) => `${canonical}: missing from backend sitemap.xml`)

  const known = new Set(expected)
  for (const alias of sitemapCountryAliases(sitemapXml)) {
    if (known.has(alias)) continue
    failures.push(
      `${SITE_URL}/quests/country/${alias}: in backend sitemap.xml but no catalog-derived landing (dead URL)`,
    )
  }
  return failures
}

function verifyQuestHtml(html, expectedCanonical) {
  const title = getTitle(html)
  const description = getMetaContent(html, 'name', 'description')
  const ogTitle = getMetaContent(html, 'property', 'og:title')
  const ogImage = getMetaContent(html, 'property', 'og:image')
  const ogUrl = getMetaContent(html, 'property', 'og:url')
  const canonicalMatch = html.match(/<link[^>]*rel="canonical"[^>]*href="([^"]*)"[^>]*\/?>/i)
  const canonical = canonicalMatch ? canonicalMatch[1] : ''

  const issues = []
  if (!title || title === 'Metravel') issues.push('generic-or-missing <title>')
  if (!description) issues.push('missing description')
  if (!ogTitle) issues.push('missing og:title')
  if (!ogImage) issues.push('missing og:image')
  if (canonical !== expectedCanonical) issues.push(`bad canonical: ${canonical || 'missing'}`)
  if (ogUrl !== expectedCanonical) issues.push(`bad og:url: ${ogUrl || 'missing'}`)
  if (!hasQuestIntroSection(html)) issues.push('missing crawlable quest intro section')
  if (!hasQuestJsonLd(html)) issues.push('missing TouristTrip JSON-LD')

  return issues
}

async function fetchQuestCatalog(fetcher = fetchJson, apiBase = API_BASE) {
  const quests = []
  let nextUrl = `${apiBase}/api/quests/`
  let page = 0

  while (nextUrl) {
    if (page >= MAX_CATALOG_PAGES) {
      throw new Error(`Quest catalog exceeds ${MAX_CATALOG_PAGES} pages`)
    }
    const payload = await fetcher(nextUrl)
    quests.push(...extractItems(payload).filter((quest) => questRouteKey(quest)))
    const rawNext = (payload && typeof payload === 'object' && (payload.next_page_url || payload.next)) || null
    nextUrl = rawNext ? new URL(rawNext, `${apiBase}/`).toString() : null
    page += 1
  }

  if (quests.length === 0) {
    throw new Error('No quests returned by API for static quest SEO verification')
  }
  return quests
}

async function main() {
  const [quests, sitemapXml] = await Promise.all([fetchQuestCatalog(), fetchBackendSitemap()])

  const cityAliasMap = buildQuestCityAliasMap(quests)
  const cityGroups = buildQuestCityLandingGroups(quests, cityAliasMap)
  const countryGroups = buildQuestCountryLandingGroups(quests, { locale: 'ru' })
  const failures = []

  // 1. Every quest page (canonical route + city alias route) exists on disk.
  for (const quest of quests) {
    const route = questRouteKey(quest)
    for (const relativePath of expectedQuestFiles(quest, cityAliasMap)) {
      if (!fs.existsSync(path.join(DIST_DIR, relativePath))) {
        failures.push(`${route.path}: missing file ${relativePath}`)
      }
    }
  }

  // 2. Every city landing exists on disk and carries its crawlable body — an
  // existing file can still be the untouched SPA shell.
  const cityLandingFiles = expectedCityLandingFiles(quests, cityAliasMap)
  for (const relativePath of cityLandingFiles) {
    const filePath = path.join(DIST_DIR, relativePath)
    if (!fs.existsSync(filePath)) {
      failures.push(`city landing: missing file ${relativePath}`)
      continue
    }
    if (!hasQuestCityLandingSection(fs.readFileSync(filePath, 'utf8'))) {
      failures.push(`city landing: ${relativePath} has no crawlable quest-city section`)
    }
  }

  // A one-quest city used to be a thin wrapper around its only child. Apply
  // the rule to the catalog-derived city groups so every newly published city
  // automatically needs independent planning content and unique metadata.
  // sitemap.xml is Django-owned and never copied into dist; the build treats
  // the live backend sitemap as a fail-closed external input and only checks
  // membership here. HTTP/redirect behavior remains a post-deploy concern.

  for (const city of cityGroups) {
    const canonical = `${SITE_URL}/quests/${city.segment}`
    const cityFile = path.join(DIST_DIR, 'quests', city.segment, 'index.html')
    if (!fs.existsSync(cityFile)) continue // already reported as missing above

    let childHtml = ''
    if (city.quests.length === 1) {
      const childRoute = questRouteKey(city.quests[0])
      const childFile = childRoute
        ? path.join(DIST_DIR, 'quests', childRoute.cityId, childRoute.questId, 'index.html')
        : ''
      if (childFile && fs.existsSync(childFile)) childHtml = fs.readFileSync(childFile, 'utf8')
    }

    const issues = verifyQuestCityHtml(fs.readFileSync(cityFile, 'utf8'), canonical, childHtml)
    if (issues.length > 0) {
      failures.push(`city landing /quests/${city.segment}: ${issues.join(', ')}`)
    }
    if (!sitemapHasUrl(sitemapXml, canonical)) {
      failures.push(`city landing /quests/${city.segment}: missing from backend sitemap.xml`)
    }
  }

  // Country HTML is frontend-owned and always fail-closed against the complete
  // catalog-derived set. Backend sitemap membership is a separate explicit
  // post-deploy gate because #1606 can legitimately lag a pre-deploy FE build.
  const countryLandingFiles = expectedCountryLandingFiles(quests)
  const countryMetadataPages = []
  for (const country of countryGroups) {
    const relativePath = path.join('quests', 'country', country.countryAlias, 'index.html')
    const filePath = path.join(DIST_DIR, relativePath)
    if (!fs.existsSync(filePath)) {
      failures.push(`country landing: missing file ${relativePath}`)
      continue
    }

    const expectedCityPaths = country.cities.map((city) => `/quests/${city.cityAlias}`)
    const expectedQuestPaths = country.quests
      .map((quest) => questRouteKey(quest)?.path)
      .filter(Boolean)
    let childHtml = ''
    if (country.quests.length === 1) {
      const childRoute = questRouteKey(country.quests[0])
      const childFile = childRoute
        ? path.join(DIST_DIR, 'quests', childRoute.cityId, childRoute.questId, 'index.html')
        : ''
      if (childFile && fs.existsSync(childFile)) childHtml = fs.readFileSync(childFile, 'utf8')
    }

    const countryPath = `/quests/country/${country.countryAlias}`
    const canonical = `${SITE_URL}${countryPath}`
    const countryHtml = fs.readFileSync(filePath, 'utf8')
    countryMetadataPages.push({ path: countryPath, html: countryHtml })
    const issues = verifyQuestCountryHtml(
      countryHtml,
      canonical,
      expectedCityPaths,
      expectedQuestPaths,
      childHtml,
    )
    if (issues.length > 0) {
      failures.push(`country landing /quests/country/${country.countryAlias}: ${issues.join(', ')}`)
    }
  }
  failures.push(...verifyQuestCountryMetadataUniqueness(countryMetadataPages))
  failures.push(...verifyQuestCountrySitemap(countryGroups, sitemapXml, VERIFY_COUNTRY_SITEMAP))

  // 3. An alias landing lists the quests of every city_id sharing that alias.
  // Duplicated city records used to make one landing silently overwrite the
  // other, dropping half a city's quests off the page both of them canonicalise
  // to.
  for (const [alias, questPaths] of expectedAliasLandingQuests(quests, cityAliasMap)) {
    const relativePath = path.join('quests', alias, 'index.html')
    const filePath = path.join(DIST_DIR, relativePath)
    if (!fs.existsSync(filePath)) continue // already reported as missing above

    const missing = missingLandingQuestLinks(fs.readFileSync(filePath, 'utf8'), questPaths)
    if (missing.length > 0) {
      const shown = missing.slice(0, 5).join(', ')
      const overflow = missing.length > 5 ? ` (+${missing.length - 5} more)` : ''
      failures.push(
        `city landing ${relativePath}: missing ${missing.length}/${questPaths.size} quest links — ${shown}${overflow}`
      )
    }
  }

  // 4. Sampled quest pages carry real metadata, not the bare SPA shell.
  const sampled = SAMPLE_SIZE === null ? quests : quests.slice(0, SAMPLE_SIZE)
  for (const quest of sampled) {
    const route = questRouteKey(quest)
    const filePath = path.join(DIST_DIR, 'quests', route.cityId, route.questId, 'index.html')
    if (!fs.existsSync(filePath)) continue // already reported as missing above

    const issues = verifyQuestHtml(fs.readFileSync(filePath, 'utf8'), `${API_BASE}${route.path}`)
    if (issues.length > 0) {
      failures.push(`${route.path}: ${issues.join(', ')}`)
    }
  }

  // 5. Travel quest promos. Coverage is geo/city scored, so most-but-not-all
  // travels legitimately have one; zero across the whole tree means the promo
  // catalog was empty, which is the same silent degradation as missing pages.
  const travelPageFiles = listTravelPageFiles(DIST_DIR)
  const travelPromoPages = countTravelQuestPromoPages(travelPageFiles)
  if (travelPageFiles.length > 0 && travelPromoPages === 0) {
    failures.push(
      `travel quest promo: 0 of ${travelPageFiles.length} travel pages carry a quest promo while the API lists ${quests.length} quests`
    )
  }

  if (failures.length > 0) {
    const message = failures.slice(0, 20).map((failure) => ` - ${failure}`).join('\n')
    const overflow = failures.length > 20 ? `\n ... and ${failures.length - 20} more` : ''
    throw new Error(`Static quest SEO verification failed:\n${message}${overflow}`)
  }

  const scopeLabel = SAMPLE_SIZE === null ? `all ${sampled.length}` : `${sampled.length} sampled`
  console.log(
    `[verify-static-quest-seo] Verified ${quests.length} quest pages` +
      ` + ${cityLandingFiles.length} city landings` +
      ` + ${countryLandingFiles.length} country landings` +
      ` + ${cityGroups.length} backend sitemap aliases` +
      ` + quest promos on ${travelPromoPages}/${travelPageFiles.length} travel pages` +
      ` (metadata: ${scopeLabel}) in ${DIST_DIR}`
  )
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    TRAVEL_QUEST_PROMO_MARKER,
    countTravelQuestPromoPages,
    expectedAliasLandingQuests,
    expectedCityLandingFiles,
    expectedCountryLandingFiles,
    expectedQuestFiles,
    extractItems,
    fetchBackendSitemap,
    fetchQuestCatalog,
    missingLandingQuestLinks,
    getMetaContent,
    getTitle,
    hasQuestCityLandingSection,
    hasQuestCityStandaloneContent,
    hasQuestCountryLandingSection,
    hasQuestCountryStandaloneContent,
    hasQuestIntroSection,
    hasQuestJsonLd,
    listTravelPageFiles,
    sitemapCountryAliases,
    sitemapHasUrl,
    verifyQuestCityHtml,
    verifyQuestCountryHtml,
    verifyQuestCountryMetadataUniqueness,
    verifyQuestCountrySitemap,
    verifyQuestHtml,
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`[verify-static-quest-seo] ${error.message}`)
    process.exit(1)
  })
}
