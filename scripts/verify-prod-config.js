#!/usr/bin/env node
'use strict'

// Fail-closed verification that a built prod artifact carries the RIGHT config
// before it is shipped. This is the cause-agnostic guard against "prod deployed
// with the wrong config": it does not matter WHY the config is wrong (wrong
// build flow, stale dist, concurrent build clobbering .env, env drift) — a bad
// artifact simply cannot pass this gate.
//
// Checks (against the built dist dir):
//   1. Analytics is NOT the disabled stub (i.e. EXPO_PUBLIC_METRIKA_ID/GA4 were
//      present at build time).
//   2. The Yandex Metrika id and GA4 id from .env.prod are actually present in
//      index.html (the stub check alone misses a build that lost only one id).
//   3. No dev/LAN config leaked into the app bundle (192.168.* — the signature
//      of EXPO_PUBLIC_API_URL=http://192.168.x.x / IS_LOCAL_API builds).
//
// Usage: node scripts/verify-prod-config.js [--dist dist/prod]
// Exit 0 = artifact is safe to ship; non-zero = abort the deploy.

const fs = require('fs')
const path = require('path')

const repoRoot = path.resolve(__dirname, '..')

function getArg(name, def) {
  const i = process.argv.indexOf(name)
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : def
}

function envProdVar(key) {
  const p = path.join(repoRoot, '.env.prod')
  if (!fs.existsSync(p)) return ''
  for (const raw of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq === -1) continue
    if (line.slice(0, eq).trim() === key) {
      let v = line.slice(eq + 1).trim()
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      ) {
        v = v.slice(1, -1)
      }
      return v
    }
  }
  return ''
}

const distDir = path.resolve(getArg('--dist', path.join(repoRoot, 'dist', 'prod')))
const indexPath = path.join(distDir, 'index.html')

const errors = []

if (!fs.existsSync(indexPath)) {
  console.error(`[verify-prod-config] FAIL: index.html not found at ${indexPath}`)
  process.exit(1)
}

const html = fs.readFileSync(indexPath, 'utf8')

// 1) Analytics must not be the disabled stub.
if (html.includes('Analytics disabled')) {
  errors.push(
    'analytics is DISABLED in index.html — build ran without EXPO_PUBLIC_METRIKA_ID/GA4 (wrong env/flow)'
  )
}

// 2) The configured Metrika id must actually be in the shipped HTML.
const metrikaId = envProdVar('EXPO_PUBLIC_METRIKA_ID')
if (metrikaId) {
  if (!html.includes(metrikaId)) {
    errors.push(`expected Yandex Metrika id ${metrikaId} (.env.prod) not found in index.html`)
  }
} else {
  console.warn('[verify-prod-config] WARN: EXPO_PUBLIC_METRIKA_ID not set in .env.prod — skipping id check')
}

// 2b) The configured GA4 id must actually be in the shipped HTML. The stub
// check above only fires when BOTH ids are missing (utils/analyticsInlineScript.ts
// emits the disabled stub only without Metrika AND GA), so a build that has
// Metrika but lost EXPO_PUBLIC_GOOGLE_GA4 ships silently without GA — this is
// exactly the 2026-06-27/28 incident (GA sessions = 0 for two days on prod).
const gaId = envProdVar('EXPO_PUBLIC_GOOGLE_GA4')
if (gaId) {
  if (!html.includes(gaId)) {
    errors.push(`expected GA4 id ${gaId} (.env.prod) not found in index.html`)
  }
} else {
  console.warn('[verify-prod-config] WARN: EXPO_PUBLIC_GOOGLE_GA4 not set in .env.prod — skipping id check')
}

// 3) No LAN/dev API must leak into the app bundle. The bug signature is a
// private-range IP used as a URL (e.g. EXPO_PUBLIC_API_URL=http://192.168.50.36).
// Match only private IPs inside an http(s):// URL — NOT bare "192.168." string
// literals, which legitimately appear in runtime LAN-detection code
// (window.location.hostname.startsWith('192.168.')).
const LAN_URL_RE = /https?:\/\/(?:192\.168\.|10\.|172\.(?:1[6-9]|2\d|3[01])\.)\d/
const lanHits = []
const scanRoots = [indexPath, path.join(distDir, '_expo', 'static', 'js')]
const scan = (target) => {
  let stat
  try {
    stat = fs.statSync(target)
  } catch {
    return
  }
  if (stat.isDirectory()) {
    for (const entry of fs.readdirSync(target)) {
      if (lanHits.length > 5) return
      scan(path.join(target, entry))
    }
    return
  }
  if (!/\.(html|js|json)$/.test(target)) return
  let content
  try {
    content = fs.readFileSync(target, 'utf8')
  } catch {
    return
  }
  if (LAN_URL_RE.test(content)) lanHits.push(path.relative(distDir, target))
}
for (const root of scanRoots) scan(root)
if (lanHits.length) {
  errors.push(`LAN/dev API URL leaked into prod build (private-IP URL in: ${lanHits.slice(0, 5).join(', ')})`)
}

if (errors.length) {
  for (const e of errors) console.error(`[verify-prod-config] FAIL: ${e}`)
  process.exit(1)
}

console.log(
  `[verify-prod-config] OK: ${path.relative(repoRoot, distDir)} verified ` +
    `(analytics enabled${metrikaId ? `, metrika ${metrikaId} present` : ''}${gaId ? `, GA4 ${gaId} present` : ''}, no LAN/dev leak)`
)
