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
const { GRAPH, discoverIgAccount, gget, loadToken, redact } = require('./lib/instagramGraph')

const IG_GRAPH = 'https://graph.instagram.com'
const OUT_DIR = path.join(process.cwd(), '.cache', 'instagram')
const OUT_PATH = path.join(OUT_DIR, 'media.json')

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
      const d = await discoverIgAccount(token)
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
