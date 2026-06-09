// scripts/instagram-export-geo.js
// Parse the Instagram data export (your_instagram_activity/media/posts.json[+_1])
// into a clean dataset: { ts, dateISO, caption, mediaFiles[], geo:{lat,lng} } per post.
//
// The Graph API does NOT return per-post GPS coordinates, so we recover them here
// from the export EXIF and later join to Graph posts by timestamp. Instagram exports
// non-ASCII text as latin1-escaped UTF-8 (mojibake), which we repair.
//
// Input:  .cache/instagram/export/posts.json (+ posts_1.json)   [extracted from the zip]
// Output: .cache/instagram/export-posts.json
const fs = require('fs')
const path = require('path')

const DIR = path.join(process.cwd(), '.cache', 'instagram')
const EXPORT_DIR = path.join(DIR, 'export')
const OUT = path.join(DIR, 'export-posts.json')

// Instagram encodes UTF-8 bytes as latin1 in the JSON export → repair to real UTF-8.
function fixText(s) {
  if (!s) return ''
  try {
    return Buffer.from(String(s), 'latin1').toString('utf8')
  } catch {
    return String(s)
  }
}

// Walk an arbitrary post node and collect media items wherever they live
// (top-level "media", or inside "label_values[].media").
function collectMedia(post) {
  const items = []
  const pushAll = (arr) => {
    if (Array.isArray(arr)) for (const m of arr) if (m && m.uri) items.push(m)
  }
  pushAll(post.media)
  if (Array.isArray(post.label_values)) {
    for (const lv of post.label_values) pushAll(lv && lv.media)
  }
  return items
}

function extractGeo(mediaItem) {
  const exif = mediaItem?.media_metadata?.photo_metadata?.exif_data
  if (Array.isArray(exif)) {
    for (const e of exif) {
      if (typeof e?.latitude === 'number' && typeof e?.longitude === 'number') {
        return { lat: e.latitude, lng: e.longitude }
      }
    }
  }
  const vexif = mediaItem?.media_metadata?.video_metadata?.exif_data
  if (Array.isArray(vexif)) {
    for (const e of vexif) {
      if (typeof e?.latitude === 'number' && typeof e?.longitude === 'number') {
        return { lat: e.latitude, lng: e.longitude }
      }
    }
  }
  return null
}

function parsePost(post) {
  const media = collectMedia(post)
  const mediaFiles = media.map((m) => m.uri).filter(Boolean)

  // Caption: post-level title if present, else the longest media title.
  const titles = []
  if (post.title) titles.push(fixText(post.title))
  for (const m of media) if (m.title) titles.push(fixText(m.title))
  const caption = titles.sort((a, b) => b.length - a.length)[0] || ''

  // Timestamp: post-level, else min media creation_timestamp.
  let ts = typeof post.timestamp === 'number' ? post.timestamp : 0
  if (!ts) {
    const cts = media.map((m) => m.creation_timestamp).filter((n) => typeof n === 'number')
    if (cts.length) ts = Math.min(...cts)
  }

  // Geo: first media item with EXIF coords.
  let geo = null
  for (const m of media) {
    geo = extractGeo(m)
    if (geo) break
  }

  return {
    ts,
    dateISO: ts ? new Date(ts * 1000).toISOString() : '',
    caption,
    mediaFiles,
    mediaCount: mediaFiles.length,
    geo,
  }
}

function loadArray(file) {
  if (!fs.existsSync(file)) return []
  const raw = fs.readFileSync(file, 'utf8')
  const j = JSON.parse(raw)
  return Array.isArray(j) ? j : Array.isArray(j.media) ? j.media : []
}

function main() {
  const a = loadArray(path.join(EXPORT_DIR, 'posts.json'))
  const b = loadArray(path.join(EXPORT_DIR, 'posts_1.json'))
  const raw = [...a, ...b]
  if (!raw.length) {
    console.error(
      'No posts found. Extract the export first:\n' +
        '  your_instagram_activity/media/posts.json → .cache/instagram/export/'
    )
    process.exit(1)
  }

  const posts = raw.map(parsePost).filter((p) => p.ts || p.caption || p.mediaFiles.length)
  // De-dupe by timestamp+first file (posts.json and posts_1.json can overlap).
  const seen = new Set()
  const deduped = []
  for (const p of posts) {
    const key = `${p.ts}|${p.mediaFiles[0] || ''}`
    if (seen.has(key)) continue
    seen.add(key)
    deduped.push(p)
  }
  deduped.sort((x, y) => x.ts - y.ts)

  const withGeo = deduped.filter((p) => p.geo).length
  const withCaption = deduped.filter((p) => p.caption.trim().length >= 10).length

  fs.mkdirSync(DIR, { recursive: true })
  fs.writeFileSync(OUT, JSON.stringify({ count: deduped.length, withGeo, withCaption, posts: deduped }, null, 2))
  console.log(`Parsed ${deduped.length} posts → ${path.relative(process.cwd(), OUT)}`)
  console.log(`  with GPS:     ${withGeo}`)
  console.log(`  with caption: ${withCaption}`)
}

main()
