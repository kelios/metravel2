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

  // 2. Every city landing exists on disk.
  for (const relativePath of expectedCityLandingFiles(quests, cityAliasMap)) {
    if (!fs.existsSync(path.join(DIST_DIR, relativePath))) {
      failures.push(`city landing: missing file ${relativePath}`)
    }
  }

  // 3. Sampled quest pages carry real metadata, not the bare SPA shell.
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

  if (failures.length > 0) {
    const message = failures.slice(0, 20).map((failure) => ` - ${failure}`).join('\n')
    const overflow = failures.length > 20 ? `\n ... and ${failures.length - 20} more` : ''
    throw new Error(`Static quest SEO verification failed:\n${message}${overflow}`)
  }

  const scopeLabel = SAMPLE_SIZE === null ? `all ${sampled.length}` : `${sampled.length} sampled`
  console.log(
    `[verify-static-quest-seo] Verified ${quests.length} quest pages` +
      ` + ${expectedCityLandingFiles(quests, cityAliasMap).length} city landings` +
      ` (metadata: ${scopeLabel}) in ${DIST_DIR}`
  )
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    expectedCityLandingFiles,
    expectedQuestFiles,
    extractItems,
    getMetaContent,
    getTitle,
    hasQuestIntroSection,
    hasQuestJsonLd,
    verifyQuestHtml,
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`[verify-static-quest-seo] ${error.message}`)
    process.exit(1)
  })
}
