// scripts/instagram-media.js
// Pull ALL published media of the connected Instagram Business/Creator account
// (@metravelby) via the Meta Graph API, using the OWNER's access token.
//
// Why: the data export has captions/photos/GPS but NO public post links. The Graph
// API "permalink" field is the only reliable source of instagram.com/p/<shortcode>/
// URLs needed to build the article embeds.
//
// Secrets live ONLY in .secrets/ (gitignored) and are never printed.
// Token file: .secrets/instagram-token.json  →  { "access_token": "..." }
//             (optionally add "ig_user_id": "..." to skip auto-discovery)
// Output:     .cache/instagram/media.json   (public data: permalinks + captions + dates)
const fs = require('fs')
const path = require('path')

const GRAPH = 'https://graph.facebook.com/v19.0'
const IG_GRAPH = 'https://graph.instagram.com'
const SECRETS = path.join(process.cwd(), '.secrets')
const TOKEN_PATH = path.join(SECRETS, 'instagram-token.json')
const OUT_DIR = path.join(process.cwd(), '.cache', 'instagram')
const OUT_PATH = path.join(OUT_DIR, 'media.json')

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
    .replace(/^["'\s,]+|["'\s,]+$/g, '')
  if (!token) throw new Error('instagram-token.json has no "access_token".')
  return { token, igUserId: j.ig_user_id ? String(j.ig_user_id).trim() : '' }
}

// Never let a token reach logs: redact anything token-shaped and any access_token= param.
function redact(s) {
  return String(s || '')
    .replace(/EAA[A-Za-z0-9]+/g, 'EAA…[redacted]')
    .replace(/(access_token=)[^&\s]+/gi, '$1[redacted]')
}

async function gget(url) {
  const res = await fetch(url)
  const j = await res.json().catch(() => ({}))
  if (!res.ok || j.error) {
    const e = j.error || {}
    const malformed = /malformed|invalid/i.test(e.message || '') || e.code === 190
    const hint = malformed
      ? '\n  → Token rejected. Generate a FRESH token and re-save it (see scripts/INSTAGRAM_SETUP.md).'
      : ''
    throw new Error(`Graph API ${res.status}: ${redact(e.message || JSON.stringify(j))}${hint}`)
  }
  return j
}

// Resolve the IG business account id from the owner's Facebook Pages.
async function discoverIgUserId(token) {
  const j = await gget(
    `${GRAPH}/me/accounts?fields=name,instagram_business_account{id,username}&access_token=${encodeURIComponent(token)}`
  )
  const pages = Array.isArray(j.data) ? j.data : []
  for (const p of pages) {
    const iba = p.instagram_business_account
    if (iba && iba.id) return { id: String(iba.id), username: iba.username || '' }
  }
  throw new Error(
    'No instagram_business_account linked to any Facebook Page for this token.\n' +
      '  → Ensure @metravelby is a Business/Creator account linked to a FB Page,\n' +
      '    and the token has scopes: instagram_basic, pages_show_list.'
  )
}

const MEDIA_FIELDS =
  'id,caption,permalink,timestamp,media_type,media_url,thumbnail_url,children{media_url,media_type,thumbnail_url}'

async function pullPaged(startUrl) {
  let url = startUrl
  const all = []
  let page = 0
  while (url) {
    const j = await gget(url)
    const data = Array.isArray(j.data) ? j.data : []
    all.push(...data)
    page += 1
    process.stdout.write(`\rFetched ${all.length} media (page ${page})…`)
    url = j.paging && j.paging.next ? j.paging.next : ''
  }
  process.stdout.write('\n')
  return all
}

// Path A: a direct Instagram-Login token works against graph.instagram.com.
async function tryInstagramDirect(token) {
  try {
    const res = await fetch(`${IG_GRAPH}/me?fields=id,username&access_token=${encodeURIComponent(token)}`)
    const j = await res.json().catch(() => ({}))
    if (res.ok && j.id) return { id: String(j.id), username: j.username || '' }
  } catch {
    // fall through to FB flow
  }
  return null
}

async function main() {
  const { token, igUserId: provided } = loadToken()
  let igUserId = provided
  let username = ''
  let media

  const direct = await tryInstagramDirect(token)
  if (direct) {
    // Instagram-Login token → read media straight from graph.instagram.com
    username = direct.username
    console.log(`Instagram-Login token detected: @${username || direct.id}`)
    media = await pullPaged(
      `${IG_GRAPH}/me/media?fields=${encodeURIComponent(MEDIA_FIELDS)}&limit=100&access_token=${encodeURIComponent(token)}`
    )
    igUserId = direct.id
  } else {
    // Facebook-Login token → discover IG business account via Pages
    if (!igUserId) {
      const d = await discoverIgUserId(token)
      igUserId = d.id
      username = d.username
      console.log(`Resolved IG account: @${username} (id ${igUserId})`)
    }
    media = await pullPaged(
      `${GRAPH}/${igUserId}/media?fields=${encodeURIComponent(MEDIA_FIELDS)}&limit=100&access_token=${encodeURIComponent(token)}`
    )
  }
  const slim = media.map((m) => ({
    id: m.id,
    permalink: m.permalink || '',
    caption: m.caption || '',
    timestamp: m.timestamp || '',
    ts: m.timestamp ? Math.floor(new Date(m.timestamp).getTime() / 1000) : 0,
    media_type: m.media_type || '',
    media_url: m.media_url || m.thumbnail_url || '',
    children: Array.isArray(m.children?.data)
      ? m.children.data.map((c) => ({ media_url: c.media_url || c.thumbnail_url || '', media_type: c.media_type || '' }))
      : [],
  }))
  fs.mkdirSync(OUT_DIR, { recursive: true })
  fs.writeFileSync(
    OUT_PATH,
    JSON.stringify(
      { ig_user_id: igUserId, username, count: slim.length, fetched_at: new Date().toISOString(), media: slim },
      null,
      2
    )
  )
  const withCaption = slim.filter((m) => m.caption.trim().length >= 10).length
  console.log(`Saved ${slim.length} posts (${withCaption} with captions) → ${path.relative(process.cwd(), OUT_PATH)}`)
}

main().catch((e) => {
  console.error('\nERROR:', redact(e.message))
  process.exitCode = 1
})
