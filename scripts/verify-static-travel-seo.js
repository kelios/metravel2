#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const https = require('https')
const http = require('http')

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
const GENERIC_TRAVEL_DESCRIPTION = 'Найди место для путешествия и поделись своим опытом.'

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http
    const opts = { timeout: 30000 }
    if (mod === https) opts.rejectUnauthorized = false

    const req = mod.get(url, opts, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchJson(res.headers.location).then(resolve, reject)
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`))
      }

      let body = ''
      res.setEncoding('utf8')
      res.on('data', (chunk) => {
        body += chunk
      })
      res.on('end', () => {
        try {
          resolve(JSON.parse(body))
        } catch (error) {
          reject(error)
        }
      })
    })

    req.on('error', reject)
    req.on('timeout', () => {
      req.destroy()
      reject(new Error(`Timeout: ${url}`))
    })
  })
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

function countTag(html, regex) {
  const matches = html.match(regex)
  return matches ? matches.length : 0
}

function hasTravelSsgHeading(html) {
  return /<h1[^>]*data-ssg-travel-h1="true"[^>]*>[\s\S]*?<\/h1>/i.test(html)
}

function hasArticleJsonLd(html) {
  return /<script[^>]*application\/ld\+json[^>]*>[\s\S]*?"@type"\s*:\s*"Article"[\s\S]*?<\/script>/i.test(html)
}

function verifyTravelHtml(html, routeKey) {
  const title = getTitle(html)
  const description = getMetaContent(html, 'name', 'description')
  const ogTitle = getMetaContent(html, 'property', 'og:title')
  const ogImage = getMetaContent(html, 'property', 'og:image')
  const ogUrl = getMetaContent(html, 'property', 'og:url')
  const twitterImage = getMetaContent(html, 'name', 'twitter:image')
  const canonicalMatch = html.match(/<link[^>]*rel="canonical"[^>]*href="([^"]*)"[^>]*\/?>/i)
  const canonical = canonicalMatch ? canonicalMatch[1] : ''
  const expectedCanonical = `${API_BASE}/travels/${routeKey}`

  const issues = []
  if (!title || title === 'Metravel') issues.push('generic-or-missing <title>')
  if (!description) issues.push('missing description')
  if (description === GENERIC_TRAVEL_DESCRIPTION) issues.push('generic description')
  if (countTag(html, /<meta[^>]*name="description"[^>]*\/?>/gi) !== 1) {
    issues.push('duplicate description')
  }
  if (!ogTitle) issues.push('missing og:title')
  if (!ogImage) issues.push('missing og:image')
  if (!twitterImage) issues.push('missing twitter:image')
  if (canonical !== expectedCanonical) issues.push(`bad canonical: ${canonical || 'missing'}`)
  if (ogUrl !== expectedCanonical) issues.push(`bad og:url: ${ogUrl || 'missing'}`)
  if (!hasTravelSsgHeading(html)) issues.push('missing SSR H1 marker')
  if (!hasArticleJsonLd(html)) issues.push('missing Article JSON-LD')

  return issues
}

async function main() {
  const allTravels = []
  const perPage = SAMPLE_SIZE === null ? 500 : Math.max(SAMPLE_SIZE, 10)
  let page = 1
  let hasMore = true

  while (hasMore) {
    const params = new URLSearchParams({
      page: String(page),
      perPage: String(perPage),
      where: JSON.stringify({ publish: 1, moderation: 1 }),
    })
    const url = `${API_BASE}/api/travels/?${params}`
    const payload = await fetchJson(url)
    const matchedTravels = extractItems(payload).filter((travel) => travel && (travel.slug || travel.id))

    allTravels.push(...matchedTravels)

    if (SAMPLE_SIZE !== null) {
      hasMore = false
      break
    }

    const total =
      payload && typeof payload === 'object'
        ? typeof payload.total === 'number'
          ? payload.total
          : typeof payload.count === 'number'
            ? payload.count
            : matchedTravels.length
        : matchedTravels.length

    hasMore = allTravels.length < total && matchedTravels.length === perPage
    page += 1
  }

  const travels = SAMPLE_SIZE === null ? allTravels : allTravels.slice(0, SAMPLE_SIZE)

  if (travels.length === 0) {
    throw new Error('No published travels returned by API for SEO verification')
  }

  const failures = []

  for (const travel of travels) {
    const routeKey = String(travel.slug || travel.id)
    const filePath = path.join(DIST_DIR, 'travels', routeKey, 'index.html')

    if (!fs.existsSync(filePath)) {
      failures.push(`${routeKey}: missing file ${path.relative(DIST_DIR, filePath)}`)
      continue
    }

    const html = fs.readFileSync(filePath, 'utf8')
    const issues = verifyTravelHtml(html, routeKey)
    if (issues.length > 0) {
      failures.push(`${routeKey}: ${issues.join(', ')}`)
    }
  }

  if (failures.length > 0) {
    const message = failures.map((failure) => ` - ${failure}`).join('\n')
    throw new Error(`Static travel SEO verification failed:\n${message}`)
  }

  const scopeLabel =
    SAMPLE_SIZE === null ? `all ${travels.length}` : `${travels.length} sampled`
  console.log(`[verify-static-travel-seo] Verified ${scopeLabel} travel pages in ${DIST_DIR}`)
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    countTag,
    extractItems,
    hasArticleJsonLd,
    hasTravelSsgHeading,
    getTitle,
    getMetaContent,
    verifyTravelHtml,
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`[verify-static-travel-seo] ${error.message}`)
    process.exit(1)
  })
}
