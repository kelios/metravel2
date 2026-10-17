// Local evidence gate, not a legal determination. See INSTAGRAM_CONTENT_SPEC §27.
const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const childProcess = require('child_process')

const ACCOUNT = '@metravelby'
const KINDS = ['image', 'video', 'audio', 'font', 'reference']
const BASES = ['owned', 'licensed', 'ai-generated', 'meta-sound-collection', 'public-domain']
const MEDIA = /\.(jpe?g|png|webp|mp4|mov|m4v)$/i
// Control sheets of the editor/creator (section 0: `qa-sheet.jpg`, `contact-sheet*.jpg` live in the package root) are review aids, never uploads.
const CONTROL_SHEET = /(?:^|[-_.])(?:qa|contact|control)-?sheet/i

function fail(message) { throw new Error(`Instagram rights: ${message}`) }
function hash(file) { return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex') }
function nonempty(value) { return typeof value === 'string' && value.trim().length > 0 }
function date(value, label) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '') || new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value) fail(`${label} must be YYYY-MM-DD`)
  return value
}
function localFile(root, name) {
  if (!nonempty(name) || path.isAbsolute(name)) fail('file paths must be relative to rights.json')
  const resolved = fs.realpathSync(path.resolve(root, name))
  if (!resolved.startsWith(`${root}${path.sep}`) || !fs.statSync(resolved).isFile()) fail(`file escapes package or is not a file: ${name}`)
  if (!fs.statSync(resolved).size) fail(`empty file: ${name}`)
  return resolved
}
function checkHash(file, expected) {
  if (!/^[a-f0-9]{64}$/.test(expected || '') || hash(file) !== expected) fail(`SHA-256 mismatch: ${path.basename(file)}`)
}
function evidence(root, records, label) {
  if (!Array.isArray(records) || !records.length) fail(`${label}: local evidence is required`)
  for (const record of records) {
    const file = localFile(root, record?.file)
    checkHash(file, record.sha256)
  }
}
function scope(value, intended, today, label) {
  if (!value || value.account !== ACCOUNT || !Array.isArray(value.platforms) || !value.platforms.includes('instagram') || !Array.isArray(value.uses) || !value.uses.includes('organic') || !Array.isArray(value.territories) || !value.territories.includes('worldwide')) fail(`${label}: scope must cover ${ACCOUNT}, Instagram organic use worldwide`)
  const from = date(value.validFrom, `${label}.validFrom`)
  const until = value.validUntil === 'perpetual' ? '9999-12-31' : date(value.validUntil, `${label}.validUntil`)
  if (from > intended || intended > until) fail(`${label}: license does not cover intendedPublishAt`)
  if (from > today || today > until) fail(`${label}: license does not cover the current upload date`)
}
function probeVideo(file) {
  const run = childProcess.spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_type', '-of', 'json', file], { encoding: 'utf8', timeout: 30000 })
  if (run.error || run.status !== 0) fail(`ffprobe could not verify video audio: ${path.basename(file)}`)
  let data
  try { data = JSON.parse(run.stdout) } catch { fail('invalid ffprobe output') }
  if (!Array.isArray(data.streams) || !data.streams.some((stream) => stream.codec_type === 'video')) fail('no video stream')
  return data.streams.some((stream) => stream.codec_type === 'audio')
}
function exportedFiles(root) {
  // Package-level exports and conventional carousel outputs; source/build media stay explicit records.
  const files = []
  for (const dir of [root, path.join(root, 'carousel'), path.join(root, 'slides')]) {
    if (!fs.existsSync(dir)) continue
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isFile() && MEDIA.test(entry.name) && !CONTROL_SHEET.test(entry.name)) files.push(path.join(dir, entry.name))
    }
  }
  return files
}
function validateRights(manifestFile, selectedFiles, { now = new Date(), publishNow = false } = {}) {
  if (!manifestFile) fail('--rights-file <rights.json> is required before any upload, including rehearsal')
  const manifestPath = fs.realpathSync(manifestFile)
  const root = path.dirname(manifestPath)
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  if (manifest.version !== 1 || manifest.account !== ACCOUNT) fail(`rights.json version 1 for ${ACCOUNT} is required`)
  const today = now.toISOString().slice(0, 10)
  const reviewed = date(manifest.reviewedAt, 'reviewedAt')
  const intended = date(manifest.intendedPublishAt, 'intendedPublishAt')
  if (reviewed > today || reviewed > intended || intended < today) fail('review date is in the future or intended publication date has passed')
  if (publishNow && intended !== today) fail('immediate publication requires intendedPublishAt to match today')
  if (!Array.isArray(manifest.assets) || !manifest.assets.length) fail('assets must contain the actual final exports and their sources')
  const cleared = new Map()
  for (const asset of manifest.assets) {
    const file = localFile(root, asset?.file)
    if (cleared.has(file)) fail(`duplicate asset: ${asset.file}`)
    checkHash(file, asset.sha256)
    if (!KINDS.includes(asset.kind) || !BASES.includes(asset.basis) || !nonempty(asset.source)) fail(`${asset.file}: kind, rights basis and specific source are required`)
    evidence(root, asset.evidence, asset.file)
    scope(asset.scope, intended, today, asset.file)
    if (asset.kind === 'video') {
      const audio = asset.audio
      if (!audio || !['silent', 'original', 'licensed'].includes(audio.mode)) fail(`${asset.file}: audio review is required`)
      const hasAudio = probeVideo(file)
      if ((audio.mode === 'silent') === hasAudio) fail(`${asset.file}: audio declaration does not match exported streams`)
      if (audio.mode !== 'silent') evidence(root, audio.evidence, `${asset.file} audio`)
      if (audio.mode === 'licensed') {
        if (!['licensed', 'meta-sound-collection'].includes(audio.basis) || !nonempty(audio.source)) fail(`${asset.file}: licensed audio source/basis required`)
        scope(audio.scope, intended, today, `${asset.file} audio`)
      }
    }
    cleared.set(file, asset)
  }
  const exports = selectedFiles || exportedFiles(root)
  if (!exports.length) fail('no final exports selected')
  for (const selected of exports) {
    const file = fs.realpathSync(typeof selected === 'string' ? selected : selected.file)
    const asset = cleared.get(file)
    if (!asset) fail(`selected export is missing from rights.json: ${path.basename(file)}`)
    const expectedKind = typeof selected === 'object' ? selected.kind : /\.(mp4|mov|m4v)$/i.test(file) ? 'video' : 'image'
    if (asset.kind !== expectedKind) fail(`selected export has wrong kind: ${path.basename(file)}`)
  }
  return manifest
}

if (require.main === module) {
  try {
    if (process.argv.length !== 3) fail('usage: node scripts/lib/instagramRights.js <rights.json>')
    validateRights(process.argv[2])
    console.log('Rights evidence and export hashes verified; human legal review remains required.')
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
module.exports = { validateRights }
