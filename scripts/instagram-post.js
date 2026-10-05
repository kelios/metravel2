// scripts/instagram-post.js
// Publish a prepared post to @metravelby through the Meta Graph API: a carousel or a
// single image built by the instagram-editor agent, or a Reel (optionally a Trial Reel
// shown to non-followers only).
//
// Usage:
//   node scripts/instagram-post.js --carousel <dir-with-01.jpg…> --caption-file <txt>
//   node scripts/instagram-post.js --image <file.jpg> --caption-file <txt>
//   node scripts/instagram-post.js --reel <file.mp4> --caption-file <txt> [--trial manual|auto]
//
// Without --publish-approved the run is a rehearsal: media is uploaded and the containers
// are created (Instagram deletes unpublished containers after 24 hours), nothing appears
// in the account. --publish-approved is passed ONLY after the owner said «да» in chat to
// this exact post; the flag is the last step of that approval, never a default.
//
// Images must be reachable by Instagram over a public URL, so slides go to the gallery of
// a service draft on metravel.by (never published, owned by the QA account). Videos are
// sent straight to Meta with the resumable upload protocol.

const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')
const { GRAPH, GRAPH_VERSION, gget, graphUrl, loadToken, redact } = require('./lib/instagramGraph')

const SITE = 'https://metravel.by'
/** Unpublished service draft «Instagram: слайды каруселей» that hosts slide images. */
const SLIDES_TRAVEL_ID = 786
const MAX_CAPTION = 2200
const MAX_CAROUSEL_ITEMS = 10
const TRIAL_STRATEGIES = { manual: 'MANUAL', auto: 'SS_PERFORMANCE' }

function parseArgs(argv) {
  const args = { publishApproved: argv.includes('--publish-approved') }
  for (const key of ['carousel', 'image', 'reel', 'caption-file', 'trial']) {
    const i = argv.indexOf(`--${key}`)
    if (i >= 0) args[key] = argv[i + 1]
  }
  const kinds = ['carousel', 'image', 'reel'].filter((k) => args[k])
  if (kinds.length !== 1) throw new Error('Pass exactly one of --carousel <dir>, --image <file>, --reel <file>.')
  if (!args['caption-file']) throw new Error('--caption-file is required.')
  if (args.trial && !args.reel) throw new Error('--trial applies to --reel only.')
  if (args.trial && !TRIAL_STRATEGIES[args.trial]) throw new Error('--trial expects manual or auto.')
  return { ...args, kind: kinds[0] }
}

function readCaption(file) {
  const caption = fs.readFileSync(file, 'utf8').trim()
  if (!caption) throw new Error('Caption file is empty.')
  if (caption.length > MAX_CAPTION) throw new Error(`Caption is ${caption.length} chars, Instagram allows ${MAX_CAPTION}.`)
  return caption
}

function listSlides(dir) {
  const slides = fs
    .readdirSync(dir)
    .filter((f) => /\.(jpe?g|png)$/i.test(f))
    .sort()
    .map((f) => path.join(dir, f))
  if (slides.length < 2) throw new Error(`A carousel needs at least 2 slides, ${dir} has ${slides.length}.`)
  if (slides.length > MAX_CAROUSEL_ITEMS) throw new Error(`A carousel takes at most ${MAX_CAROUSEL_ITEMS} slides.`)
  return slides
}

async function gpost(pathname, params, token) {
  const res = await fetch(`${GRAPH}/${pathname}`, {
    method: 'POST',
    body: new URLSearchParams({ ...params, access_token: token }),
  })
  const j = await res.json().catch(() => ({}))
  if (!res.ok || j.error) throw new Error(`Graph API ${res.status}: ${redact(j.error?.message || JSON.stringify(j))}`)
  return j
}

async function hostImage(file, siteToken) {
  const form = new FormData()
  const type = /\.png$/i.test(file) ? 'image/png' : 'image/jpeg'
  form.append('file', new File([fs.readFileSync(file)], path.basename(file), { type }))
  form.append('collection', 'gallery')
  form.append('id', String(SLIDES_TRAVEL_ID))
  const res = await fetch(`${SITE}/api/upload`, { method: 'POST', headers: { Authorization: `Token ${siteToken}` }, body: form })
  const j = await res.json().catch(() => ({}))
  if (!res.ok || !j.url) throw new Error(`Slide upload failed for ${path.basename(file)}: HTTP ${res.status}`)
  return j.url.replace(/^http:/, 'https:')
}

async function waitUntilReady(containerId, token) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const j = await gget(graphUrl(containerId, { fields: 'status_code,status' }, token))
    if (j.status_code === 'FINISHED') return
    if (j.status_code === 'ERROR' || j.status_code === 'EXPIRED') {
      throw new Error(`Container ${containerId} is ${j.status_code}: ${j.status || ''}`)
    }
    await new Promise((r) => setTimeout(r, 5000))
  }
  throw new Error(`Container ${containerId} was not ready in 5 minutes.`)
}

async function createImageContainers(files, caption, { token, igUserId }) {
  const siteToken = execFileSync('node', [path.join(__dirname, 'get-quest-token.js')], { encoding: 'utf8' }).trim()
  const single = files.length === 1
  const ids = []
  for (const file of files) {
    const imageUrl = await hostImage(file, siteToken)
    const params = single ? { image_url: imageUrl, caption } : { image_url: imageUrl, is_carousel_item: 'true' }
    ids.push((await gpost(`${igUserId}/media`, params, token)).id)
    console.log(`  ${path.basename(file)} → container ready`)
  }
  if (single) return ids[0]
  return (await gpost(`${igUserId}/media`, { media_type: 'CAROUSEL', children: ids.join(','), caption }, token)).id
}

async function createReelContainer(file, caption, trial, { token, igUserId }) {
  const params = { media_type: 'REELS', upload_type: 'resumable', caption }
  if (trial) params.trial_params = JSON.stringify({ graduation_strategy: TRIAL_STRATEGIES[trial] })
  const { id, uri } = await gpost(`${igUserId}/media`, params, token)
  const size = fs.statSync(file).size
  const res = await fetch(uri || `https://rupload.facebook.com/ig-api-upload/${GRAPH_VERSION}/${id}`, {
    method: 'POST',
    headers: { Authorization: `OAuth ${token}`, offset: '0', file_size: String(size) },
    body: fs.readFileSync(file),
  })
  const j = await res.json().catch(() => ({}))
  if (!res.ok || j.success === false) throw new Error(`Video upload failed: HTTP ${res.status} ${redact(JSON.stringify(j)).slice(0, 200)}`)
  console.log(`  ${path.basename(file)} uploaded (${Math.round(size / 1e6)} MB), Instagram is processing it…`)
  return id
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const caption = readCaption(args['caption-file'])
  const account = loadToken()
  if (!account.igUserId) throw new Error('ig_user_id missing in the token file — run instagram-insights.js --exchange-code first.')

  let containerId
  if (args.kind === 'reel') containerId = await createReelContainer(args.reel, caption, args.trial, account)
  else containerId = await createImageContainers(args.kind === 'carousel' ? listSlides(args.carousel) : [args.image], caption, account)
  await waitUntilReady(containerId, account.token)

  if (!args.publishApproved) {
    console.log(`Rehearsal passed: container ${containerId} is ready, nothing was published.`)
    console.log('Publish after the owner approves this post: rerun with --publish-approved.')
    return
  }
  const published = await gpost(`${account.igUserId}/media_publish`, { creation_id: containerId }, account.token)
  const media = await gget(graphUrl(published.id, { fields: 'permalink' }, account.token))
  console.log(`Published: ${media.permalink}`)
}

if (require.main === module) {
  main().catch((e) => {
    console.error('\nERROR:', redact(e.message))
    process.exitCode = 1
  })
}

module.exports = { listSlides, parseArgs, readCaption }
