/**
 * scripts/lib/instagramGraph.js
 * Shared Meta Graph API access for the @metravelby owner scripts
 * (instagram-media.js, instagram-insights.js).
 *
 * Secrets live ONLY in .secrets/ (gitignored) and are never printed:
 *   .secrets/instagram-token.json   { "access_token": "...", "ig_user_id"?: "..." }
 *   .secrets/metravel-instagram.env INSTAGRAM_GRAPH_APP_ID / _APP_SECRET (for --exchange)
 */

const fs = require('fs')
const path = require('path')

const GRAPH_VERSION = 'v23.0'
const GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`
const SECRETS = path.join(process.cwd(), '.secrets')
const TOKEN_PATH = path.join(SECRETS, 'instagram-token.json')
const APP_ENV_PATH = path.join(SECRETS, 'metravel-instagram.env')

function redact(s) {
  return String(s || '')
    .replace(/(EAA|IGAA)[A-Za-z0-9]+/g, '$1…[redacted]')
    .replace(/(access_token=|client_secret=|fb_exchange_token=)[^&\s]+/gi, '$1[redacted]')
}

function loadToken() {
  if (!fs.existsSync(TOKEN_PATH)) {
    throw new Error(
      'Token not found at .secrets/instagram-token.json.\n' +
        'See scripts/INSTAGRAM_SETUP.md — create the token and save it there (never paste it in chat).'
    )
  }
  const j = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'))
  // Defensive: strip surrounding whitespace/quotes/commas accidentally copied in.
  const token = String(j.access_token || j.token || '')
    .trim()
    .replace(/^["']+|["',]+$/g, '')
  if (!token) throw new Error('access_token is empty in .secrets/instagram-token.json')
  return { token, igUserId: j.ig_user_id ? String(j.ig_user_id) : '', kind: j.token_kind || '' }
}

function saveToken(payload) {
  fs.mkdirSync(SECRETS, { recursive: true })
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(payload, null, 2), { mode: 0o600 })
}

function loadAppCredentials() {
  if (!fs.existsSync(APP_ENV_PATH)) throw new Error('App credentials not found at .secrets/metravel-instagram.env')
  const env = {}
  for (const line of fs.readFileSync(APP_ENV_PATH, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/)
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
  if (!env.INSTAGRAM_GRAPH_APP_ID || !env.INSTAGRAM_GRAPH_APP_SECRET) {
    throw new Error('INSTAGRAM_GRAPH_APP_ID / INSTAGRAM_GRAPH_APP_SECRET missing in .secrets/metravel-instagram.env')
  }
  return { appId: env.INSTAGRAM_GRAPH_APP_ID, appSecret: env.INSTAGRAM_GRAPH_APP_SECRET }
}

async function gget(url) {
  const res = await fetch(url)
  const j = await res.json().catch(() => ({}))
  if (!res.ok || j.error) {
    const e = j.error || {}
    const tokenDead = e.code === 190 || /malformed|invalid/i.test(e.message || '')
    const hint = tokenDead
      ? '\n  → Token rejected. Generate a FRESH token and re-save it (see scripts/INSTAGRAM_SETUP.md).'
      : ''
    const err = new Error(`Graph API ${res.status}: ${redact(e.message || JSON.stringify(j))}${hint}`)
    err.code = e.code
    throw err
  }
  return j
}

function graphUrl(pathname, params, token) {
  const qs = new URLSearchParams({ ...params, access_token: token })
  return `${GRAPH}/${pathname}?${qs}`
}

// Resolve the IG business account (and its Page token) from the owner's Facebook Pages.
async function discoverIgAccount(token, targetUsername = 'metravelby') {
  const j = await gget(graphUrl('me/accounts', { fields: 'name,access_token,instagram_business_account{id,username}' }, token))
  const pages = Array.isArray(j.data) ? j.data : []
  const linked = pages.filter((p) => p.instagram_business_account && p.instagram_business_account.id)
  const match =
    linked.find((p) => String(p.instagram_business_account.username || '').toLowerCase() === targetUsername) ||
    linked[0]
  if (!match) {
    throw new Error(
      'No instagram_business_account linked to any Facebook Page for this token.\n' +
        '  → Ensure @metravelby is a Business/Creator account linked to a FB Page,\n' +
        '    and the token has scopes: instagram_basic, pages_show_list.'
    )
  }
  return {
    id: String(match.instagram_business_account.id),
    username: match.instagram_business_account.username || '',
    pageToken: match.access_token || '',
  }
}

module.exports = {
  GRAPH,
  GRAPH_VERSION,
  TOKEN_PATH,
  discoverIgAccount,
  gget,
  graphUrl,
  loadAppCredentials,
  loadToken,
  redact,
  saveToken,
}
