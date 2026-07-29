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
 */

const fs = require('fs')
const path = require('path')

const { fetchJson } = require('./lib/fetchJson')
const { questRouteKey, buildQuestCityAliasMap, questRouteVariants } = require('../utils/questCityAlias')

const args = process.argv.slice(2)

function getArg(name, fallback) {
  const index = args.indexOf(`--${name}`)
  return index !== -1 && args[index + 1] ? args[index + 1] : fallback
}

const DIST_DIR = path.resolve(getArg('dist', 'dist/prod'))
const API_BASE = getArg('api', 'https://metravel.by').replace(/\/+$/, '')
const sampleSizeArg = getArg('sample-size')
const SAMPLE_SIZE =
  typeof sampleSizeArg === 'string' && sampleSizeArg.trim().length > 0
    ? Math.max(1, Number.parseInt(sampleSizeArg, 10) || 1)
    : null
const MAX_CATALOG_PAGES = 50

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

function hasQuestIntroSection(html) {
  return /<section[^>]*data-ssg-quest-intro="true"[^>]*>[\s\S]*?<\/section>/i.test(html)
}

function hasQuestCityLandingSection(html) {
  return /<section[^>]*data-ssg-quest-city="true"[^>]*>[\s\S]*?<\/section>/i.test(html)
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
  for (const quest of Array.isArray(quests) ? quests : []) {
    for (const variant of questRouteVariants(quest, cityAliasMap)) {
      files.add(path.join('quests', variant.cityId, 'index.html'))
    }
  }
  return [...files]
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

async function fetchQuestCatalog() {
  const quests = []
  let nextUrl = `${API_BASE}/api/quests/`
  let page = 1

  while (nextUrl && page <= MAX_CATALOG_PAGES) {
    const payload = await fetchJson(nextUrl)
    quests.push(...extractItems(payload).filter((quest) => questRouteKey(quest)))
    nextUrl = (payload && typeof payload === 'object' && (payload.next_page_url || payload.next)) || null
    page += 1
  }

  return quests
}

async function main() {
  const quests = await fetchQuestCatalog()

  if (quests.length === 0) {
    throw new Error('No quests returned by API for static quest SEO verification')
  }

  const cityAliasMap = buildQuestCityAliasMap(quests)
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
    expectedQuestFiles,
    extractItems,
    missingLandingQuestLinks,
    getMetaContent,
    getTitle,
    hasQuestCityLandingSection,
    hasQuestIntroSection,
    hasQuestJsonLd,
    listTravelPageFiles,
    verifyQuestHtml,
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`[verify-static-quest-seo] ${error.message}`)
    process.exit(1)
  })
}
