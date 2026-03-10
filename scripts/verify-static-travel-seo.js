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
const SAMPLE_SIZE = Math.max(1, Number.parseInt(getArg('sample-size', '12'), 10) || 12)

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

function verifyTravelHtml(html, routeKey) {
  const title = getTitle(html)
  const description = getMetaContent(html, 'name', 'description')
  const ogTitle = getMetaContent(html, 'property', 'og:title')
  const ogImage = getMetaContent(html, 'property', 'og:image')
  const twitterImage = getMetaContent(html, 'name', 'twitter:image')
  const canonicalMatch = html.match(/<link[^>]*rel="canonical"[^>]*href="([^"]*)"[^>]*\/?>/i)
  const canonical = canonicalMatch ? canonicalMatch[1] : ''

  const issues = []
  if (!title || title === 'Metravel') issues.push('generic-or-missing <title>')
  if (!description) issues.push('missing description')
  if (!ogTitle) issues.push('missing og:title')
  if (!ogImage) issues.push('missing og:image')
  if (!twitterImage) issues.push('missing twitter:image')
  if (!canonical.includes(`/travels/${routeKey}`)) issues.push(`bad canonical: ${canonical || 'missing'}`)

  return issues
}

async function main() {
  const params = new URLSearchParams({
    page: '1',
    perPage: String(Math.max(SAMPLE_SIZE, 10)),
    where: JSON.stringify({ publish: 1, moderation: 1 }),
  })
  const url = `${API_BASE}/api/travels/?${params}`
  const payload = await fetchJson(url)
  const travels = extractItems(payload)
    .filter((travel) => travel && (travel.slug || travel.id))
    .slice(0, SAMPLE_SIZE)

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

  console.log(`[verify-static-travel-seo] Verified ${travels.length} travel pages in ${DIST_DIR}`)
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    extractItems,
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
