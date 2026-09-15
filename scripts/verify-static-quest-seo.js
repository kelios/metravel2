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
const { readResponseText, withAcceptEncoding } = require('./lib/httpText')
const {
  questRouteKey,
  buildQuestCityAliasMap,
  buildQuestCityLandingGroups,
  questRouteVariants,
} = require('../utils/questCityAlias')
const {
  buildQuestCountryLandingGroups,
  questCountryLandingIsIndexable,
} = require('../utils/questCountryLanding')
const { htmlToPlainText } = require('../utils/seoText')

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
        headers: withAcceptEncoding({
          Accept: 'application/xml,text/xml;q=0.9,*/*;q=0.8',
          'User-Agent': 'MeTravelSeoBuild/1.0 (+https://metravel.by)',
        }),
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

        // #1649: whole body buffered, then decoded once.
        readResponseText(response).then(resolve, reject)
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

/**
 * #1569: к обзору и практике добавлен блок заметок о местах города — это
 * единственная часть страницы, которой нет в шаблоне и которая отличает один
 * город от другого. Проверка присутствия здесь не заменяет замер объёма
 * (`verifyQuestPageContentDepth`): она называет пропавший блок по имени, а не
 * оставляет разбираться со счётом слов.
 */
function hasQuestCityStandaloneContent(html) {
  return (
    /data-ssg-quest-city-overview="true"/i.test(html) &&
    /data-ssg-quest-city-practical="true"/i.test(html) &&
    /data-ssg-quest-city-walk="true"/i.test(html)
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
  if (!hasQuestCityStandaloneContent(html)) {
    issues.push('missing independent city overview/walk/practical content')
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

function verifyQuestCountryHtml(
  html,
  expectedCanonical,
  expectedCityPaths = [],
  expectedQuestPaths = [],
  childHtml = '',
  expectIndexable = true,
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

  // #1762: страна с одним городом уходит из выдачи — её лендинг повторяет
  // посадочную этого города. Правило живёт в генераторе, но проверяется здесь,
  // на реальном HTML: расхождение иначе всплывёт в GSC через месяц, а не на
  // сборке.
  const robots = getMetaContent(html, 'name', 'robots') || ''
  const isNoindex = /\bnoindex\b/i.test(robots)
  if (!expectIndexable && !isNoindex) {
    issues.push('single-city country landing is missing noindex')
  }
  if (expectIndexable && isNoindex) {
    issues.push(`multi-city country landing is noindex: ${robots}`)
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

/**
 * #1930: how much text a catalog-derived quest page carries, and how much of it
 * is its own.
 *
 * Three thin templates shipped in three weeks — city (#1569), quest detail
 * (#1763), country (#1929) — and each fix taught the guard about its own level
 * only: "the section tag is present". A tag can be present and hold one
 * sentence, so presence never caught the fourth case.
 *
 * The rule below keys on the `data-ssg-quest*` marker generate-seo-pages.js
 * writes onto every crawlable block it builds under /quests, so a level that
 * does not exist yet — region, theme, whatever comes next — is measured the day
 * it ships instead of after the next GSC report.
 *
 * Both spellings the generator already uses count: `data-ssg-quest-<level>` for
 * the per-page templates and `data-ssg-quests-<level>` for the hub
 * (`generate-seo-pages.js` writes `data-ssg-quests-listing` on /quests). A
 * singular-only pattern would have left the most-crawled catalog page — and the
 * next level named after it — unmeasured, which is the exact miss this rule
 * exists to prevent.
 */
const MIN_QUEST_PAGE_WORDS = 300
const MIN_QUEST_PAGE_DISTINCT_RATIO = 0.3
const QUEST_PAGE_SHINGLE_SIZE = 5
const QUEST_SSG_SECTION_PATTERN = '<section[^>]*\\bdata-ssg-(quests?(?:-[a-z0-9]+)*)="true"[^>]*>'

/**
 * Levels that are thin today, each with the open card that owns its content.
 *
 * The rule above is retroactive, so the two levels it would fail on arrival keep
 * a floor they do meet — nothing may get worse — while every other level gets
 * the full rule immediately. Without this the guard would fail every production
 * build until two content cards land, which is not what it is for.
 *
 * Quest detail pages are deliberately absent: #1763 already raised them and all
 * 182 of them clear the default outright, so the rule bites on a real level
 * today rather than only on hypothetical future ones.
 *
 * Measured against production on 14.09.2026, prose words per crawlable section
 * (link labels excluded), all pages in the catalog:
 *   quest-city    n=132  min 118  median 148  max 182   own wording 0%
 *   quest-country n=18   min 115  median 120  max 270   own wording 0%
 *   quest-intro   n=182  min 318  median 721  max 1226  clears the default
 *   quests-listing     1  737                           clears the default
 *   quest-scenario     1  493                           clears the default
 *
 * Re-measured 15.09.2026 after #1569 gave the city landing its own notes about
 * the places its quests walk past, driving the real builders over the same live
 * catalog (132 cities, 182 quest bundles):
 *   quest-city    n=132  min 352  median 677  max 994   own wording 38.8–79.4%
 * so the city exemption was deleted rather than raised: the level now clears
 * the default outright, and the rule above holds it there.
 *
 * The floors below are NOT those catalog minima. A floor taken from what the
 * catalog happens to contain today only holds until the next page is thinner
 * than every existing one, and the builders can legitimately render less than
 * the current minimum: both optional blocks of a country landing are
 * conditional, so the first quest in an isolated country renders below what the
 * catalog holds today. Driven on the generator's own model at its leanest
 * shape, the country builder produces 112 words, so the floor sits under that
 * at 100: low enough that no legitimate template output can red a fail-closed
 * production build, high enough to catch a section that lost its overview and
 * practical blocks outright (that page measures 42). The number is pinned in
 * the guard's tests, which drive the real builder rather than a hand-written
 * lookalike model.
 *
 * The list can only shrink: once every page of a listed level clears the
 * default, the guard fails on the stale entry, so a fixed level cannot quietly
 * keep its licence to be thin.
 */
const THIN_CONTENT_EXEMPTIONS = [
  { kind: 'quest-country', minWords: 100, minDistinctRatio: 0, ticket: '#1929' },
]

/**
 * The body of one `<section>`, counting nested sections. A non-greedy match to
 * the first `</section>` would truncate the text and fail a page that is
 * actually long enough.
 */
function sliceBalancedSection(html, openTagStart) {
  const source = String(html)
  const openTagEnd = source.indexOf('>', openTagStart)
  if (openTagEnd === -1) return null

  const tagRegex = /<(\/?)section\b/gi
  tagRegex.lastIndex = openTagEnd + 1
  let depth = 1
  let match
  while ((match = tagRegex.exec(source)) !== null) {
    depth += match[1] ? -1 : 1
    if (depth === 0) return source.slice(openTagEnd + 1, match.index)
  }
  return source.slice(openTagEnd + 1)
}

/**
 * The same text with link labels dropped.
 *
 * A catalog-derived landing is mostly a list of links to other pages, and their
 * labels are city names and quest titles — they are unique per page by
 * construction. Counting them made /quests/country/belarus read as 755 words of
 * content when it carries 270 words of prose, and made two landings built from
 * one template look unlike each other because their link lists differ. Body
 * copy is what a thin-content page is missing, so body copy is what is measured.
 */
function sectionProseText(sectionHtml) {
  return htmlToPlainText(String(sectionHtml || '').replace(/<a\b[^>]*>[\s\S]*?<\/a>/gi, ' '))
}

/**
 * The one shape `verifyQuestPageContentDepth` measures.
 *
 * Shared so a probe cannot measure a page assembled differently from the one the
 * build measures: change how a page is folded into text here, and both the guard
 * and its tests follow.
 */
function questPageFromHtml(html, routePath, precomputedSections = null) {
  const sections = precomputedSections || extractQuestSsgSections(html)
  return {
    path: routePath,
    kind: sections.length > 0 ? sections[0].kind : '',
    text: sections.map((section) => section.text).join(' '),
  }
}

/** Every catalog-derived block on a page, with the level it belongs to. */
function extractQuestSsgSections(html) {
  const source = String(html || '')
  const openRegex = new RegExp(QUEST_SSG_SECTION_PATTERN, 'gi')
  const sections = []
  let match
  while ((match = openRegex.exec(source)) !== null) {
    const body = sliceBalancedSection(source, match.index)
    if (body === null) continue
    sections.push({ kind: match[1].toLowerCase(), text: sectionProseText(body) })
  }
  return sections
}

function countWords(text) {
  const words = String(text || '').match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu)
  return words ? words.length : 0
}

/**
 * The page's wording with the parts that always differ removed — numbers and
 * capitalised tokens, which is where city and country names live. What is left
 * is the template itself, so two landings that differ only by their name and
 * their counts reduce to the same tokens.
 */
function templateSkeleton(text) {
  return String(text || '')
    .split(/\s+/)
    .map((token) => token.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ''))
    .filter((token) => token.length > 0 && !/\d/.test(token) && !/^\p{Lu}/u.test(token))
    .map((token) => token.toLowerCase())
}

function textShingles(tokens, size = QUEST_PAGE_SHINGLE_SIZE) {
  const shingles = new Set()
  for (let index = 0; index + size <= tokens.length; index += 1) {
    shingles.add(tokens.slice(index, index + size).join(' '))
  }
  return shingles
}

/**
 * Rounded down, so the failure line cannot read "only 30% ... minimum 30%": a
 * page at 29.7% own wording rounds up to the very floor it just missed, and the
 * build log then argues with itself.
 */
function formatPercent(ratio) {
  return `${Math.floor(ratio * 100)}%`
}

/**
 * Share of a page's phrasing that no other page of its level repeats. `null`
 * when there is nothing to compare against — a level with one page cannot be a
 * template of itself.
 */
function distinctShingleRatio(page, kindPageCount, shingleUses) {
  if (kindPageCount < 2 || page.shingles.size === 0) return null
  let distinct = 0
  for (const shingle of page.shingles) {
    if (shingleUses.get(shingle) === 1) distinct += 1
  }
  return distinct / page.shingles.size
}

/**
 * Catalog-derived pages in a built dist, one entry per canonical page.
 *
 * generate-seo-pages.js writes each quest as both `<id>.html` and
 * `<id>/index.html`, and each city under both its numeric id and its alias —
 * four files, two pages. Keying on the canonical URL the page declares keeps
 * those twins from reading as copies of each other.
 */
function collectQuestSsgPages(distDir, options = {}) {
  const read = options.readFile || ((filePath) => fs.readFileSync(filePath, 'utf8'))
  const root = path.join(distDir, 'quests')
  if (!fs.existsSync(root)) return []

  const byCanonical = new Map()

  const walk = (dir, relative) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      // Expo route templates ("[city].html") are shipped shells, not pages.
      if (entry.name.includes('[')) continue
      const absolute = path.join(dir, entry.name)
      const relativePath = relative ? `${relative}/${entry.name}` : entry.name
      if (entry.isDirectory()) {
        walk(absolute, relativePath)
        continue
      }
      if (!entry.name.endsWith('.html')) continue

      const html = read(absolute)
      const sections = extractQuestSsgSections(html)
      if (sections.length === 0) continue

      const routePath = `quests/${relativePath}`
      const key = getCanonical(html) || routePath.replace(/(?:\/index)?\.html$/, '')
      if (byCanonical.has(key)) continue
      byCanonical.set(key, questPageFromHtml(html, routePath, sections))
    }
  }

  walk(root, '')
  return [...byCanonical.values()]
}

/** Volume and independence, for every level the build actually produced. */
function verifyQuestPageContentDepth(pages, options = {}) {
  const minWords = Number.isFinite(options.minWords) ? options.minWords : MIN_QUEST_PAGE_WORDS
  const minDistinctRatio = Number.isFinite(options.minDistinctRatio)
    ? options.minDistinctRatio
    : MIN_QUEST_PAGE_DISTINCT_RATIO
  const exemptions = new Map(
    (options.exemptions || THIN_CONTENT_EXEMPTIONS).map((entry) => [entry.kind, entry]),
  )

  const byKind = new Map()
  for (const page of Array.isArray(pages) ? pages : []) {
    const kind = String(page?.kind || '').trim().toLowerCase()
    if (!kind) continue
    const text = String(page?.text || '')
    if (!byKind.has(kind)) byKind.set(kind, [])
    byKind.get(kind).push({
      path: String(page?.path || '').trim() || '(unknown quest page)',
      words: countWords(text),
      shingles: textShingles(templateSkeleton(text)),
    })
  }

  const failures = []

  for (const [kind, kindPages] of byKind) {
    const exemption = exemptions.get(kind)
    const wordFloor = exemption ? exemption.minWords : minWords
    const ratioFloor = exemption ? exemption.minDistinctRatio : minDistinctRatio

    const shingleUses = new Map()
    for (const page of kindPages) {
      for (const shingle of page.shingles) {
        shingleUses.set(shingle, (shingleUses.get(shingle) || 0) + 1)
      }
    }

    let clearsDefault = true

    for (const page of kindPages) {
      const ratio = distinctShingleRatio(page, kindPages.length, shingleUses)
      if (page.words < minWords || (ratio !== null && ratio < minDistinctRatio)) {
        clearsDefault = false
      }

      const issues = []
      if (page.words < wordFloor) {
        issues.push(`${page.words} words of crawlable text, minimum ${wordFloor}`)
      }
      if (ratio !== null && ratio < ratioFloor) {
        issues.push(
          `only ${formatPercent(ratio)} of its wording is its own, minimum ${formatPercent(ratioFloor)}` +
            ' — reads as a shared template'
        )
      }
      if (issues.length > 0) failures.push(`${page.path} [${kind}]: ${issues.join('; ')}`)
    }

    if (exemption && clearsDefault) {
      failures.push(
        `thin-content exemption for "${kind}" (${exemption.ticket}) is stale: every page now clears` +
          ` ${minWords} words and ${formatPercent(minDistinctRatio)} own wording` +
          ' — delete the entry from THIN_CONTENT_EXEMPTIONS'
      )
    }
  }

  return failures
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
    for (const segment of [...city.cityIds, city.segment, ...city.legacyAliases]) {
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

  const cityLandingsOnLegacySitemapAlias = []
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
    // sitemap.xml is Django-owned (maintenance/sitemap.py:_alias) and still
    // derives the city segment with the single-token rule this build replaced
    // (#1931), so for a two-word city the two sides name different URLs. The
    // short one is still a live page that declares the full one canonical, so
    // Google keeps discovering the landing and consolidating it — what must
    // never happen is the sitemap pointing at no landing at all, and that is
    // what stays fail-closed here.
    const sitemapSegments = [city.segment, ...city.legacyAliases]
    const sitemapSegment = sitemapSegments.find((segment) =>
      sitemapHasUrl(sitemapXml, `${SITE_URL}/quests/${segment}`),
    )
    if (!sitemapSegment) {
      failures.push(`city landing /quests/${city.segment}: missing from backend sitemap.xml`)
    } else if (sitemapSegment !== city.segment) {
      cityLandingsOnLegacySitemapAlias.push(`/quests/${sitemapSegment} -> /quests/${city.segment}`)
    }
  }

  if (cityLandingsOnLegacySitemapAlias.length > 0) {
    console.warn(
      `  ⚠️  ${cityLandingsOnLegacySitemapAlias.length} city landings are listed in the Django sitemap` +
        ' under the alias the single-token rule produced, not the canonical one' +
        ` — mirror utils/questCityAlias.js in maintenance/sitemap.py:\n     ${cityLandingsOnLegacySitemapAlias.join('\n     ')}`,
    )
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
      questCountryLandingIsIndexable(country),
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

  // 6. #1930: how much crawlable text each catalog-derived page carries and how
  // much of it is its own. Keyed on the `data-ssg-quest*` marker rather than on
  // the three levels that were caught by hand, so the next aggregation level is
  // measured the day it ships.
  const catalogPages = collectQuestSsgPages(DIST_DIR)
  failures.push(...verifyQuestPageContentDepth(catalogPages))

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
      ` + text depth on ${catalogPages.length} catalog-derived pages` +
      ` (metadata: ${scopeLabel}) in ${DIST_DIR}`
  )
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    MIN_QUEST_PAGE_DISTINCT_RATIO,
    MIN_QUEST_PAGE_WORDS,
    THIN_CONTENT_EXEMPTIONS,
    TRAVEL_QUEST_PROMO_MARKER,
    collectQuestSsgPages,
    countTravelQuestPromoPages,
    countWords,
    extractQuestSsgSections,
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
    questPageFromHtml,
    sectionProseText,
    sitemapCountryAliases,
    sitemapHasUrl,
    templateSkeleton,
    verifyQuestCityHtml,
    verifyQuestCountryHtml,
    verifyQuestCountryMetadataUniqueness,
    verifyQuestCountrySitemap,
    verifyQuestHtml,
    verifyQuestPageContentDepth,
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`[verify-static-quest-seo] ${error.message}`)
    process.exit(1)
  })
}
