#!/usr/bin/env node
'use strict'

// Post-review physical acceptance only. No production accounts, live assets, or API calls.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const fsp = require('node:fs/promises')
const path = require('node:path')
const crypto = require('node:crypto')
const readline = require('node:readline')
const { Module, createRequire } = require('node:module')
const { fork, execFileSync } = require('node:child_process')
const { Parser } = require('htmlparser2')

const ROOT = path.resolve(__dirname, '..')
const SCRATCH = path.join(ROOT, '.codex-temp', 'tests')
const FIELDS = ['description', 'plus', 'minus', 'recommendation']
const LOCALES = ['RU', 'BE', 'UK', 'PL', 'EN']
const REVIEWED_INPUTS = ['scripts/pdf-book-worker-acceptance.cjs', '__tests__/fixtures/pdfBook/buildSnapshotFixture.ts', 'types/bookDocument.ts', 'types/bookSettings.ts']
const THEMES = ['minimal', 'light', 'dark', 'travel-magazine', 'classic', 'modern', 'romantic',
  'adventure', 'illustrated', 'black-white', 'sepia', 'newspaper', 'ocean', 'forest', 'sunset',
  'nordic', 'retro', 'tropical', 'editorial-luxe', 'watercolor']
const hash = value => crypto.createHash('sha256').update(value).digest('hex')
const json = value => `${JSON.stringify(value, null, 2)}\n`

function privateRef(root, ref) {
  assert.equal(typeof ref, 'string')
  assert(!path.isAbsolute(ref) && !ref.split(/[\\/]/).includes('..'), 'Unsafe private reference')
  const target = path.resolve(root, ref)
  assert(target.startsWith(path.resolve(root) + path.sep), 'Reference escaped its private root')
  let cursor = target
  while (cursor !== path.resolve(root)) {
    if (fs.existsSync(cursor)) assert(!fs.lstatSync(cursor).isSymbolicLink(), 'Symlink in private path')
    cursor = path.dirname(cursor)
  }
  return target
}

async function* rows(file) {
  const stream = fs.createReadStream(file, { encoding: 'utf8' })
  const lines = readline.createInterface({ input: stream, crlfDelay: Infinity })
  try { for await (const line of lines) if (line) yield JSON.parse(line) }
  finally { lines.close(); stream.destroy() }
}

// Compile only the existing test helper and its two pure runtime imports.
// This is never a source loader for the worker: the worker runs the pinned artifact.
function fixtureHelper() {
  const ts = require('typescript')
  const allowed = new Set(['__tests__/fixtures/pdfBook/buildSnapshotFixture.ts', 'types/bookSettings.ts', 'types/bookDocument.ts'])
  const cache = new Map()
  function load(file) {
    assert(allowed.has(file), `Unexpected fixture dependency: ${file}`)
    if (cache.has(file)) return cache.get(file).exports
    const filename = path.join(ROOT, file)
    const mod = new Module(filename)
    cache.set(file, mod)
    const nativeRequire = createRequire(filename)
    mod.require = name => name.startsWith('@/') ? load(`${name.slice(2)}.ts`) : nativeRequire(name)
    const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      fileName: filename, reportDiagnostics: true,
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
    })
    assert(!(compiled.diagnostics || []).some(item => item.category === ts.DiagnosticCategory.Error), 'Fixture compilation failed')
    mod._compile(compiled.outputText, filename)
    return mod.exports
  }
  return load('__tests__/fixtures/pdfBook/buildSnapshotFixture.ts')
}

async function verifyArtifact(directory, expectedHash) {
  const artifact = path.resolve(directory)
  assert(artifact.startsWith(path.join(ROOT, '.codex-temp') + path.sep), 'Artifact must be in ignored .codex-temp/')
  assert.equal(await fsp.realpath(artifact), artifact, 'Artifact root/ancestor must not be a symlink')
  const manifest = JSON.parse(await fsp.readFile(privateRef(artifact, 'renderer-manifest.json'), 'utf8'))
  assert.equal(manifest.prepared_source_schema_version, 3, 'Unsupported prepared source artifact')
  assert.equal(manifest.content_hash, expectedHash, 'Artifact differs from reviewed content hash')
  const digest = crypto.createHash('sha256')
  const files = [...manifest.files].sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0)
  for (const file of files) {
    const bytes = await fsp.readFile(privateRef(artifact, file.path))
    assert.equal(bytes.length, file.size_bytes)
    assert.equal(hash(bytes), file.sha256, `Artifact integrity: ${file.path}`)
    digest.update(`${file.path}\0${bytes.length}\0`).update(bytes).update('\0')
  }
  assert.equal(digest.digest('hex'), manifest.content_hash)
  assert(files.some(file => file.path === 'renderer-runtime.json'), 'Hashed runtime metadata is required')
  const runtime = JSON.parse(await fsp.readFile(privateRef(artifact, 'renderer-runtime.json'), 'utf8'))
  for (const key of Object.keys(runtime)) assert.deepEqual(manifest[key], runtime[key], `Unpinned artifact metadata: ${key}`)
  assert(files.some(file => file.path === manifest.entrypoint), 'Entrypoint must be a verified artifact file')
  assert(manifest.fonts && files.some(file => file.path === 'fonts/fonts.css'), 'Physical acceptance requires frozen fonts')
  return { artifact, manifest }
}

/** Tooling operator input: require only the reverified entrypoint of the pinned private artifact. */
function loadArtifactEntrypoint(artifactModulePath, artifact, manifest) {
  const modulePath = path.resolve(process.cwd(), artifactModulePath)
  assert.equal(modulePath, privateRef(artifact, manifest.entrypoint), 'Module is outside the verified artifact entrypoint')
  const entry = manifest.files.find(file => file.path === manifest.entrypoint)
  assert(entry, 'Entrypoint must be verified before loading')
  const bytes = fs.readFileSync(modulePath)
  assert.equal(bytes.length, entry.size_bytes)
  assert.equal(hash(bytes), entry.sha256, 'Entrypoint changed after artifact verification')
  return require(path.resolve(process.cwd(), artifactModulePath))
}

function parseOptions(args) {
  const options = {}
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index]
    assert(['--artifact', '--artifact-hash', '--reviewed-sha', '--suite', '--case', '--read-bytes', '--profile'].includes(key) && args[index + 1] && !options[key], 'See docs/book-renderer-contract.md for usage')
    options[key] = args[index + 1]
  }
  return options
}

const PROFILE_METRICS = {
  process_tree_peak_rss_bytes: 'sampled_process_tree_peak_rss_bytes',
  browser_tree_peak_rss_bytes: 'sampled_browser_tree_peak_rss_bytes',
  cpu_seconds: 'sampled_cpu_seconds', wall_ms: 'wall_ms', temp_disk_peak_bytes: 'temp_disk_peak_bytes',
}
const RENDERER_PROFILE_KEYS = ['encoded_resource_bytes', 'encoded_portion_bytes', 'decoded_resource_pixels', 'decoded_portion_pixels', 'dom_nodes']
const B2_LIMIT_KEYS = ['rss_bytes', 'cpu_seconds', 'cpu_cores', 'app_rss_bytes', 'app_cpu_cores', 'temp_disk_bytes', 'disk_reserve_bytes',
  ...RENDERER_PROFILE_KEYS, 'manifest_rows', 'text_bytes', 'pages', 'portion_seconds', 'api_p95_ms', 'api_error_rate_max', 'api_degradation_ratio_max']

async function readProfile(file) {
  if (!file) return null
  const target = path.resolve(file)
  assert(target.startsWith(path.join(ROOT, '.codex-temp') + path.sep), 'B2 profile must be a private ignored file')
  assert.equal(await fsp.realpath(target), target, 'B2 profile must not traverse symlinks')
  const bytes = await fsp.readFile(target)
  assert(bytes.length < 16384, 'Profile exceeded bounded configuration size')
  const profile = JSON.parse(bytes.toString('utf8'))
  if (profile.version === 1) {
    assert.equal(profile.concurrency, 1)
    for (const key of ['id', 'approved_by', 'isolation']) assert(typeof profile[key] === 'string' && profile[key].length, `Missing B2 identity: ${key}`)
    for (const key of B2_LIMIT_KEYS) assert(typeof profile[key] === 'number' && Number.isFinite(profile[key]) && profile[key] > 0, `Missing positive B2 budget: ${key}`)
    assert(profile.api_error_rate_max <= 1 && profile.api_degradation_ratio_max >= 1, 'Invalid B2 API health thresholds')
    assert(profile.encoded_resource_bytes <= profile.temp_disk_bytes && profile.encoded_portion_bytes <= profile.temp_disk_bytes, 'B2 encoded limits exceed disk budget')
    const rendererResources = Object.fromEntries(RENDERER_PROFILE_KEYS.map(key => [key, profile[key]]))
    for (const key of RENDERER_PROFILE_KEYS) assert(Number.isSafeInteger(profile[key]), `Renderer budget must be an integer: ${key}`)
    return { kind: 'b2', hash: hash(bytes), id: profile.id,
      limits: { process_tree_peak_rss_bytes: profile.rss_bytes, temp_disk_peak_bytes: profile.temp_disk_bytes, renderer_resources: rendererResources },
      unenforced: ['per-portion CPU/time', 'CPU cores and cgroup isolation', 'application RSS/CPU/API health', 'disk reserve', 'manifest/text/page budgets', 'global concurrency outside this runner'] }
  }
  assert.equal(profile.profile_kind, 'diagnostic-run', 'Non-B2 profile must explicitly identify diagnostic whole-run semantics')
  assert.equal(profile.profile_version, 1)
  assert.equal(profile.concurrency, 1, 'Acceptance runner executes one worker at a time')
  for (const key of Object.keys(PROFILE_METRICS)) assert(typeof profile[key] === 'number' && Number.isFinite(profile[key]) && profile[key] > 0, `Missing positive budget: ${key}`)
  for (const key of RENDERER_PROFILE_KEYS) assert(Number.isSafeInteger(profile.renderer_resources?.[key]) && profile.renderer_resources[key] > 0, `Missing positive renderer budget: ${key}`)
  return { kind: 'diagnostic-run', hash: hash(bytes), limits: profile, unenforced: ['authoritative B2 readiness'] }
}

function enforceProfile(metrics, profile) {
  if (!profile) return
  for (const [limit, metric] of Object.entries(PROFILE_METRICS)) {
    if (!(limit in profile.limits)) continue
    assert(typeof metrics[metric] === 'number' && Number.isFinite(metrics[metric]), `Unavailable runtime metric: ${metric}`)
    assert(metrics[metric] <= profile.limits[limit], `B2_PROFILE_EXCEEDED:${limit}`)
  }
}

function corpus(suite) {
  const small = { id: 41, title: 'Pinned golden chapter', description: '<h2>Heading</h2><p>Before <strong>bold</strong> <a href="https://example.com/source">linked text</a> after.</p>', photos: 2, points: 2 }
  const result = []
  if (suite !== 'stress') {
    for (const mediaFixture of ['opaque-rgba', 'single-alpha', 'rotated-png', 'rotated-webp']) result.push({ name: `print-${mediaFixture}`, mediaFixture, travels: [{ ...small, routeThumbnails: true }], settings: { includeMap: true, includeGallery: true, includeToc: false, photoPageLayout: 'framed' } })
    for (const template of THEMES) result.push({ name: `theme-${template}`, travels: [small], settings: {
      title: 'Pinned book title', subtitle: 'Pinned subtitle', template, includeMap: true, includeToc: true,
      includeChecklists: true, galleryPhotosPerPage: 0, galleryColumns: 4, showCaptions: true, photoPageLayout: 'framed',
    } })
    for (const locale of LOCALES) result.push({ name: `locale-${locale}`, locale, travels: [small] })
    for (const includeGallery of [false, true]) for (const includeMap of [false, true]) result.push({
      name: `inclusion-${Number(includeGallery)}-${Number(includeMap)}`, travels: [small],
      settings: { includeGallery, includeMap, includeToc: false, includeChecklists: false, showCaptions: false },
    })
    for (const galleryLayout of ['grid', 'collage', 'slideshow', 'polaroid']) result.push({
      name: `layout-${galleryLayout}`, travels: [{ ...small, photos: 15 }],
      settings: { galleryLayout, galleryPhotosPerPage: 0, captionPosition: 'overlay', gallerySpacing: 'compact' },
    })
    result.push({ name: 'polaroid-multiline-captions', travels: [{ ...small, photos: 2,
      captions: ['First multiline caption '.repeat(12).trim(), 'Second multiline caption '.repeat(12).trim()] }],
      settings: { galleryLayout: 'polaroid', showCaptions: true, includeMap: false, includeToc: false } })
    for (const galleryLayout of ['polaroid', 'collage']) result.push({ name: `caption-500-${galleryLayout}`,
      travels: [{ ...small, photos: 1, captions: ['😀界'.repeat(250)] }],
      settings: { galleryLayout, galleryColumns: 4, galleryPhotosPerPage: 0, showCaptions: true,
        captionPosition: 'overlay', includeMap: false, includeToc: false } })
  }
  if (suite !== 'golden') {
    for (const photos of [201, 1000, 5000]) result.push({ name: `photos-${photos}`, travels: [{ ...small, photos }], settings: { galleryPhotosPerPage: 0, includeMap: false } })
    result.push({ name: 'selection-51', travels: Array.from({ length: 51 }, (_, index) => ({ ...small, id: 1000 - index, title: `Ordered chapter ${index}`, photos: 1, points: 0 })) })
    result.push({ name: 'huge-chapter', travels: [{ id: 90, title: 'Huge first chapter',
      description: `<h2 id="first-heading">FIRST</h2><p>${'ёжик 😀 linked value '.repeat(14000)}END_PARAGRAPH</p><a href="#last-heading">forward link</a><h2 id="last-heading">LAST</h2>`,
      plus: `<table><tbody><tr><td>FIRST_CELL ${'table value '.repeat(24000)} LAST_CELL</td><td>SECOND_CELL</td></tr></tbody></table>`,
      minus: '<ol><li>FIRST_LIST_ITEM ' + 'continued numbered item '.repeat(6000) + '</li><li>LAST_LIST_ITEM</li></ol>',
      recommendation: '<p>FINAL_RECOMMENDATION</p>', photos: 31, points: 37,
    }, { id: 12, title: 'Final chapter', description: '<p>FINAL_CHAPTER_TEXT</p>', photos: 1, points: 1 }] })
    for (const showCoordinatesOnMapPage of [false, true]) result.push({ name: `map-complete-${Number(showCoordinatesOnMapPage)}`,
      travels: [{ id: 761, title: 'Complete map fields', points: 8, routeThumbnails: true,
        routeAddresses: ['Автовокзал Luxexpo на Кирхберге: автобусы 201 и 211 в Эхтернах', 'A, B, C, D · E 😀界', 'LongWord'.repeat(6000)],
        routeCategories: ['Category, full value', '😀界'.repeat(8000)], routeCoordinates: ['53.9;27.56'] }],
      settings: { includeMap: true, showCoordinatesOnMapPage, includeGallery: false, includeToc: false } })
    const inline = '/media/uploads/fixture-shared.png'
    result.push({ name: 'repeated-inline', travels: [{ ...small, description: `<p>${'inline value '.repeat(6000)}</p><img src="${inline}"><img src="${inline}"><p>INLINE_END</p>`, photos: 31 }] })
  }
  return result
}

function textSink() {
  const digest = crypto.createHash('sha256')
  let characters = 0
  const parser = new Parser({ ontext(value) { digest.update(value); characters += Array.from(value).length } }, { decodeEntities: true })
  return { parser, finish() { parser.end(); return { hash: digest.digest('hex'), characters } } }
}

/** Preserve inline words while treating structural HTML boundaries as whitespace. */
function semanticText(html, { contentOnly = false } = {}) {
  const boundaries = new Set(['address', 'article', 'blockquote', 'br', 'dd', 'div', 'dl', 'dt', 'figcaption', 'figure',
    'footer', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'hr', 'li', 'main', 'ol', 'p', 'pre', 'section',
    'table', 'tbody', 'td', 'tfoot', 'th', 'thead', 'tr', 'ul'])
  const excluded = new Set(['head', 'style', 'script', 'template'])
  const stack = []
  let value = ''
  const accepts = frame => frame && !frame.excluded && (!contentOnly || frame.content)
  new Parser({
    onopentag(name, attributes) {
      const parent = stack.at(-1)
      const classes = (attributes.class || '').split(/\s+/)
      const page = parent?.page || classes.includes('travel-content-page')
      const layout = parent?.layout || (page && name === 'table' && classes.includes('content-layout'))
      const frame = { page, layout, excluded: parent?.excluded || excluded.has(name),
        content: parent?.content || (layout && name === 'tbody') }
      stack.push(frame)
      if (accepts(frame) && boundaries.has(name)) value += ' '
    },
    ontext(part) {
      const frame = stack.at(-1)
      if (accepts(frame) || (!frame && !contentOnly)) value += part
    },
    onclosetag(name) {
      const frame = stack.pop()
      if (accepts(frame) && boundaries.has(name)) value += ' '
    },
  }, { decodeEntities: true }).end(html)
  return value.replace(/\s+/g, ' ').trim()
}

function renderedCaptions(html) {
  const captions = new Map()
  let active = null
  new Parser({
    onopentag(name, attributes) {
      if (!(attributes.class || '').split(/\s+/).some(value => value === 'book-gallery-caption' || value === 'book-gallery-caption-text')) return
      assert.equal(active, null, 'Nested caption containers')
      const key = attributes['data-photo-ordinal'] || 'continuation'
      assert(!captions.has(key), 'Duplicate rendered caption')
      active = { name, key }; captions.set(key, '')
    },
    ontext(value) { if (active) captions.set(active.key, captions.get(active.key) + value) },
    onclosetag(name) { if (active?.name === name) active = null },
  }, { decodeEntities: true }).end(html)
  return captions
}

function assertRouteCoverage(points, fields) {
  for (const [key, point] of points) assert.equal(point.rendered, 1, `Missing or duplicated source map point: ${key}`)
  for (const [key, field] of fields) assert.equal(field.actual, field.expected, `Incomplete source map field: ${key}`)
}

function renderedMapPoints(html, originalHash = value => value) {
  const points = []
  let depth = 0, active = null
  new Parser({
    onopentag(name, attributes) {
      depth++
      if ((attributes.class || '').split(/\s+/).includes('map-location-card')) {
        assert.equal(active, null, 'Nested map cards')
        const id = attributes['data-point-id'], ordinal = Number(attributes['data-point-ordinal'])
        assert(id && Number.isSafeInteger(ordinal) && ordinal > 0, 'Missing map point identity')
        active = { id, ordinal, images: [], depth }; points.push(active)
      }
      if (active && name === 'img' && /^https:\/\/book-snapshot\.invalid\/(?:assets\/[a-f0-9]{64}|print-assets\/[a-f0-9]{64}\/[a-f0-9]{64})$/.test(attributes.src || '')) active.images.push(originalHash(attributes.src.split('/').pop(), attributes.src))
    },
    onclosetag() { if (active?.depth === depth) active = null; depth-- },
  }).end(html)
  return points.map(point => ({ id: point.id, ordinal: point.ordinal, images: point.images }))
}

function renderedMapText(html) {
  const fields = []
  let depth = 0, active = null
  new Parser({
    onopentag(name, attributes) {
      depth++
      if (!(attributes.class || '').split(/\s+/).includes('book-map-source-text')) return
      assert.equal(active, null, 'Nested map field containers')
      const field = attributes['data-point-field'], id = attributes['data-point-id'], ordinal = Number(attributes['data-point-ordinal'])
      assert(['address', 'category', 'coord'].includes(field) && id && Number.isSafeInteger(ordinal) && ordinal > 0, 'Invalid map field identity')
      active = { id, field, ordinal, text: '', depth }; fields.push(active)
    },
    ontext(value) { if (active) active.text += value },
    onclosetag() { if (active?.depth === depth) active = null; depth-- },
  }, { decodeEntities: true }).end(html)
  return fields
}

/** Independent saved-source/original/cache/served-byte proof, not a renderer digest echo. */
async function verifyPrintResources(fixture, out, row, html, certificate, manifest) {
  const canonical = fixtureHelper().fixtureCanonicalJson
  const sourceBytes = await fsp.readFile(privateRef(out, row.segment_ref))
  assert.equal(hash(sourceBytes), row.source_checksum, 'Prepared source differs from committed plan')
  const source = JSON.parse(sourceBytes)
  assert.equal(source.source_schema_version, 3)
  assert.equal(source.resource_bindings_hash, hash(canonical(source.resource_bindings)))
  assert.equal(source.resource_policy_hash, hash(canonical(manifest.print_asset_recipe)))
  assert.equal(source.encoder_identity_hash, hash(canonical(certificate.print_encoder_identity)))
  for (const key of ['resource_bindings_hash', 'resource_policy_hash', 'encoder_identity_hash']) assert.equal(row[key], source[key])
  for (const key of Object.keys(manifest.print_encoder_pin)) assert.equal(certificate.print_encoder_identity[key], manifest.print_encoder_pin[key])
  assert(/^[a-f0-9]{64}$/.test(certificate.print_encoder_identity.executable_sha256))
  const byServed = new Map(), originals = new Set()
  const { imageSize } = require('image-size')
  for (const binding of source.resource_bindings) {
    assert(!originals.has(binding.original_checksum), 'Repeated resource binding')
    originals.add(binding.original_checksum)
    const chunk = fixture.manifest.find(value => value.kind === 'media' && value.checksum === binding.original_checksum)
    assert(chunk, 'Derivative origin is outside immutable snapshot')
    const original = await fsp.readFile(privateRef(fixture.jobDir, chunk.file_ref))
    assert.equal(hash(original), binding.original_checksum)
    assert.equal(original.length, binding.original_encoded_bytes)
    const descriptorBytes = await fsp.readFile(privateRef(out, binding.descriptor_ref))
    assert.equal(hash(descriptorBytes), binding.descriptor_checksum)
    const descriptor = JSON.parse(descriptorBytes)
    assert.equal(descriptor.original_checksum, binding.original_checksum)
    if (fixture.expected?.print_media) {
      assert.equal(descriptor.has_source_alpha, fixture.expected.print_media.source_has_alpha, 'Actual alpha decision differs from native fixture pixels')
      assert.equal(binding.mime, fixture.expected.print_media.served_mime, 'Opaque/transparent print policy changed')
      if (fixture.expected.print_media.oriented_width !== undefined) {
        assert.equal(descriptor.oriented_width, fixture.expected.print_media.oriented_width, 'Fixture EXIF orientation was ignored')
        assert.equal(descriptor.oriented_height, fixture.expected.print_media.oriented_height, 'Fixture EXIF orientation was ignored')
      }
    }
    assert.deepEqual(descriptor.recipe, manifest.print_asset_recipe)
    assert.deepEqual(descriptor.encoder_identity, certificate.print_encoder_identity)
    const expectedBinding = { ...binding }; delete expectedBinding.descriptor_ref; delete expectedBinding.descriptor_checksum
    assert.deepEqual(descriptor.binding, expectedBinding)
    const encoded = await fsp.readFile(privateRef(out, binding.served_file_ref))
    assert.equal(hash(encoded), binding.served_checksum, 'Saved served bytes differ from lineage')
    assert.equal(encoded.length, binding.encoded_bytes)
    const raw = imageSize(original), dimensions = imageSize(encoded)
    const rotated = raw.orientation >= 5 && raw.orientation <= 8
    const exactOrientation = descriptor.oriented_width === (rotated ? raw.height : raw.width) && descriptor.oriented_height === (rotated ? raw.width : raw.height)
    const decoderWitness = ['png', 'webp'].includes(raw.type) && raw.orientation === undefined && descriptor.oriented_width === raw.height && descriptor.oriented_height === raw.width
    assert(exactOrientation || decoderWitness, 'Oriented dimensions are outside immutable header bounds')
    assert.equal(binding.original_pixels, raw.width * raw.height)
    const mime = encoded[0] === 255 && encoded[1] === 216 ? 'image/jpeg' : encoded.subarray(1, 4).toString() === 'PNG' ? 'image/png' : null
    assert.equal(mime, binding.mime)
    if (binding.mode === 'passthrough') {
      assert.equal(binding.mime, 'image/jpeg')
      assert.equal(binding.served_checksum, binding.original_checksum)
      assert(original.length <= manifest.print_asset_recipe.jpeg_passthrough_bytes)
      assert.equal(binding.width, descriptor.oriented_width); assert.equal(binding.height, descriptor.oriented_height)
    } else {
      assert.equal(binding.mode, 'encoded')
      assert.equal(dimensions.width, binding.width); assert.equal(dimensions.height, binding.height)
      const scale = Math.min(1, manifest.print_asset_recipe.max_long_edge / Math.max(descriptor.oriented_width, descriptor.oriented_height),
        Math.sqrt(manifest.print_asset_recipe.max_pixels / (descriptor.oriented_width * descriptor.oriented_height)))
      assert.equal(binding.width, Math.max(1, Math.floor(descriptor.oriented_width * scale)))
      assert.equal(binding.height, Math.max(1, Math.floor(descriptor.oriented_height * scale)))
      if (descriptor.has_source_alpha || descriptor.has_output_alpha) assert.equal(binding.mime, 'image/png', 'Source alpha was flattened')
    }
    assert(Math.max(binding.width, binding.height) <= manifest.print_asset_recipe.max_long_edge)
    assert.equal(binding.served_pixels, binding.width * binding.height)
    assert.equal(binding.recipe_hash, source.resource_policy_hash)
    assert.equal(binding.encoder_identity_hash, source.encoder_identity_hash)
    byServed.set(`${binding.original_checksum}/${binding.served_checksum}`, binding.original_checksum)
  }
  const requested = new Set()
  // Only resources are inspected; authored text and hyperlink URLs remain source text.
  const inspect = value => { for (const match of value.matchAll(/https:\/\/book-snapshot\.invalid\/(assets|print-assets)\/([a-f0-9]{64})(?:\/([a-f0-9]{64}))?/g)) {
    assert.equal(match[1], 'print-assets', 'Schema3 still serves original encoding')
    const pair = `${match[2]}/${match[3]}`
    assert(byServed.has(pair), 'HTML references unbound served bytes'); requested.add(pair)
  } }
  let inStyle = false
  new Parser({ onopentag(name, attributes) {
    if (name === 'img' || name === 'source') inspect(attributes.src || '')
    if (name === 'video') inspect(attributes.poster || '')
    for (const match of (attributes.style || '').matchAll(/url\(([^)]*)\)/g)) inspect(match[1])
    if (name === 'style') inStyle = true
  }, ontext(text) { if (inStyle) for (const match of text.matchAll(/url\(([^)]*)\)/g)) inspect(match[1]) }, onclosetag(name) { if (name === 'style') inStyle = false } }).end(html)
  assert.equal(requested.size, byServed.size, 'Prepared binding was never referenced by HTML')
  for (const served of row.served_resources) {
    assert.equal(byServed.get(`${served.original_checksum}/${served.served_checksum}`), served.original_checksum, 'Actual response lacks origin binding')
    assert(requested.has(`${served.original_checksum}/${served.served_checksum}`), 'Receipt claims unrequested resource')
  }
  const actual = new Set(row.served_resources.map(value => `${value.original_checksum}/${value.served_checksum}`))
  assert.equal(actual.size, row.served_resources.length, 'Duplicate actual resource response identity')
  for (const served of requested) assert(actual.has(served), 'HTML resource was never served during measurement')
  return source
}

async function verifyResult(fixture, out, manifest, artifact, profile) {
  const { PDF_THEMES, getFixedTranslator } = loadArtifactEntrypoint(privateRef(artifact, manifest.entrypoint), artifact, manifest)
  const translate = getFixedTranslator(fixture.document.settings.locale)
  const theme = PDF_THEMES[fixture.document.settings.template]
  assert(theme, 'Unknown pinned theme')
  const certificate = JSON.parse(await fsp.readFile(path.join(out, 'certificate.json'), 'utf8'))
  assert.equal(certificate.prepared_source_schema_version, 3, 'Certificate source schema differs from artifact')
  assert.equal(certificate.print_resource_policy_hash, manifest.print_resource_policy_hash)
  assert.equal(manifest.print_resource_policy_hash, hash(fixtureHelper().fixtureCanonicalJson(manifest.print_asset_recipe)))
  assert.equal(certificate.measured, true, 'Injected measurements cannot pass physical acceptance')
  if (profile) assert.deepEqual(certificate.resource_profile, profile.limits.renderer_resources, 'Renderer ignored supplied B2 resource profile')
  assert.equal(certificate.renderer_version, manifest.renderer_version)
  assert.equal(certificate.snapshot_hash, fixture.document.snapshot_hash)
  assert.equal(certificate.settings_hash, fixture.document.settings_hash)
  assert.deepEqual(certificate.expected, certificate.completed)
  assert.equal(certificate.completed.travels, fixture.expected.travel_ids.length)
  assert.equal(certificate.source_count, fixture.manifest.length)
  let position = 0
  for await (const row of rows(path.join(out, 'sources-plan.ndjson'))) {
    const chunk = fixture.manifest[position++]
    assert(chunk, 'Unexpected source entry')
    assert.equal(row.order, chunk.position)
    assert.equal(row.travel_id, chunk.travel_id ?? 'book')
    assert.equal(row.occurrence_key || '', chunk.occurrence_key)
  }
  assert.equal(position, fixture.manifest.length)
  const sourceMedia = fixture.manifest.filter(chunk => chunk.kind === 'media' &&
    (chunk.metadata.role === 'cover' || chunk.metadata.role === 'inline' ||
      (chunk.metadata.role === 'gallery' && fixture.document.settings.includeGallery) ||
      (chunk.metadata.role === 'route-image' && fixture.document.settings.includeMap)))
  assert.deepEqual(certificate.source_media_coverage, { expected: sourceMedia.length, completed: sourceMedia.length })
  for (const chunk of fixture.manifest.filter(chunk => chunk.kind === 'media')) {
    const file = path.join(out, 'coverage', 'occurrences', hash(chunk.occurrence_key))
    if (sourceMedia.includes(chunk)) assert.equal(await fsp.readFile(file, 'utf8'), chunk.occurrence_key)
    else assert(!fs.existsSync(file), 'Excluded source media was rendered')
  }
  const expectedText = new Map(), actualText = new Map()
  for (const id of fixture.expected.travel_ids) for (const field of FIELDS) {
    const key = `${id}:${field}`
    expectedText.set(key, textSink()); actualText.set(key, textSink())
  }
  for (const chunk of fixture.manifest) if (chunk.kind === 'text') {
    const sink = expectedText.get(`${chunk.travel_id}:${chunk.metadata.field}`)
    for await (const part of fs.createReadStream(privateRef(fixture.jobDir, chunk.file_ref), { encoding: 'utf8' })) sink.parser.write(part)
  }
  const chapters = [], countsChecked = new Set()
  for await (const body of rows(path.join(out, 'body.ndjson'))) {
    const source = JSON.parse(await fsp.readFile(privateRef(out, body.ref), 'utf8'))
    if (source.page.type === 'photo') chapters.push(body.travel_id)
    const travel = source.page.travel
    if (travel) {
      const photos = fixture.manifest.filter(chunk => chunk.travel_id === body.travel_id && chunk.kind === 'gallery').length
      const locations = fixture.manifest.filter(chunk => chunk.travel_id === body.travel_id && chunk.kind === 'route').length
      assert.deepEqual(travel.sourceCounts, { photos, locations }, 'Continuation stats lost source totals')
      countsChecked.add(body.travel_id)
    }
    if (source.page.type === 'content') actualText.get(`${body.travel_id}:${source.page.field}`).parser.write(source.page.html)
    if (source.page.type === 'legacy-content') for (const field of FIELDS) actualText.get(`${body.travel_id}:${field}`).parser.write(source.page.travel[field] || '')
  }
  assert.deepEqual(chapters, fixture.expected.travel_ids, 'Chapter selection/order differs')
  assert.equal(countsChecked.size, fixture.expected.travel_ids.length)
  for (const [key, sink] of expectedText) assert.deepEqual(actualText.get(key).finish(), sink.finish(), `Incomplete text: ${key}`)
  const routeCoverage = new Map(), routeOrdinals = new Map(), routePoints = new Map(), routeImagePositions = new Map()
  if (fixture.document.settings.includeMap) for (const chunk of fixture.manifest.filter(row => row.kind === 'route')) {
    const ordinal = (routeOrdinals.get(chunk.travel_id) || 0) + 1
    routeOrdinals.set(chunk.travel_id, ordinal)
    const imagePosition = routeImagePositions.get(chunk.travel_id) || 0
    const image = chunk.metadata.image ? fixture.manifest.filter(row => row.kind === 'media' && row.travel_id === chunk.travel_id && row.metadata.role === 'route-image')[imagePosition] : undefined
    if (chunk.metadata.image) {
      assert(image && image.metadata.resource_key === chunk.metadata.image, 'Independent route media order differs')
      routeImagePositions.set(chunk.travel_id, imagePosition + 1)
    }
    routePoints.set(`${chunk.travel_id}:${chunk.metadata.id}`, { ordinal, rendered: 0, image_checksum: image?.checksum, occurrence_key: image?.occurrence_key })
    const labels = fixture.manifest.filter(row => row.kind === 'route-category' && row.travel_id === chunk.travel_id && row.metadata.route_id === chunk.metadata.id)
      .map(row => row.metadata.name).filter(Boolean).join(', ')
    const fields = { address: chunk.metadata.address, category: labels,
      coord: fixture.document.settings.showCoordinatesOnMapPage ? chunk.metadata.coord || `${chunk.metadata.lat},${chunk.metadata.lng}` : '' }
    for (const [field, expected] of Object.entries(fields)) if (expected) routeCoverage.set(`${chunk.travel_id}:${chunk.metadata.id}:${field}`, { expected, actual: '', ordinal })
  }
  let pages = 0, blocks = 0, occurrences = 0
  const captionsEnabled = fixture.document.settings.includeGallery && fixture.document.settings.showCaptions && fixture.document.settings.captionPosition !== 'none'
  const captionCoverage = new Map(fixture.manifest.filter(chunk => chunk.kind === 'gallery' && captionsEnabled && chunk.metadata.caption.trim())
    .map(chunk => [`${chunk.travel_id}:${chunk.metadata.id}`, { expected: chunk.metadata.caption, actual: '' }]))
  const pageTypes = new Set()
  const pageDigest = crypto.createHash('sha256')
  for await (const row of rows(path.join(out, 'plan.ndjson'))) {
    assert.equal(row.order, pages)
    assert.equal(row.start_page, pages + 1)
    assert.equal(row.folio_area_mm, 12)
    assert.equal(row.measured_pages, 1)
    const bytes = await fsp.readFile(privateRef(out, row.file_ref))
    assert(bytes.length <= 512 * 1024, 'Page HTML exceeded bounded segment size')
    assert.equal(hash(bytes), row.checksum)
    assert(bytes.toString('utf8').includes(`font-family: ${theme.typography.bodyFont}`), 'Theme typography changed')
    assert(bytes.toString('utf8').includes(`background: ${theme.colors.background}`), 'Theme background changed')
    pageDigest.update(row.checksum)
    pageTypes.add(row.type)
    if (row.type === 'content' || row.type === 'gallery' || row.type === 'gallery-caption' || row.type === 'map' || row.type === 'map-text') {
      let images = 0
      new Parser({ onopentag(name, attributes) {
        if (name === 'img' && /^https:\/\/book-snapshot\.invalid\/(?:assets\/[0-9a-f]{64}|print-assets\/[0-9a-f]{64}\/[0-9a-f]{64})$/.test(attributes.src || '') && attributes['aria-hidden'] !== 'true') images++
      } }).end(bytes.toString('utf8'))
      assert.equal(images, row.occurrences.length, 'Media receipts differ from rendered images')
    }
    const source = await verifyPrintResources(fixture, out, row, bytes.toString('utf8'), certificate, manifest)
    if (!row.frontmatter) {
      assert.equal(source.source_schema_version, 3, 'Plan source omitted pinned schema')
      for (const point of renderedMapPoints(bytes.toString('utf8'), (served, url) => {
        const original = url.split('/').at(-2)
        const bound = source.resource_bindings.find(value => value.original_checksum === original && value.served_checksum === served)
        assert(bound, 'Map thumbnail has no immutable-origin binding')
        return bound.original_checksum
      })) {
        const coverage = routePoints.get(`${source.page.travel?.id}:${point.id}`)
        assert(coverage, 'Unexpected map point')
        assert.equal(point.ordinal, coverage.ordinal, 'Map card ordinal changed')
        assert.deepEqual(point.images, coverage.image_checksum ? [coverage.image_checksum] : [], 'Map thumbnail changed source or repeated placement')
        coverage.rendered++
      }
      for (const field of renderedMapText(bytes.toString('utf8'))) {
        const coverage = routeCoverage.get(`${source.page.travel?.id}:${field.id}:${field.field}`)
        assert(coverage, 'Unexpected or disabled map field')
        assert.equal(field.ordinal, coverage.ordinal, 'Map point ordinal changed after subdivision')
        coverage.actual += field.text
      }
      if (source.page.type === 'map') assert.deepEqual(row.occurrences, source.page.locations.map(location => routePoints.get(`${source.page.travel.id}:${location.id}`)?.occurrence_key).filter(Boolean), 'Map image occurrence order differs from source points')
      if (source.page.type === 'map-text') assert.equal(row.occurrences.length, 0, 'Map text repeated a source image')
      const sourceFields = source.page.type === 'legacy-content' ? FIELDS.map(field => source.page.travel[field] || '') : source.page.type === 'content' ? [source.page.html] : []
      const delivered = semanticText(bytes.toString('utf8'), { contentOnly: true })
      for (const html of sourceFields) assert(delivered.includes(semanticText(html)), 'Planned text missing from saved HTML')
      if (source.page.type === 'legacy-content' || (source.page.type === 'content' && source.page.first)) {
        const counts = source.page.travel.sourceCounts
        if (counts.photos) assert(delivered.includes(translate('errors:utils.pluralize.photosCount', { count: counts.photos })), 'Visible photo stats lost source totals/locale')
        if (counts.locations) assert(delivered.includes(`${counts.locations} ${translate('errors:utils.pluralize.placeNoun', { count: counts.locations })}`), 'Visible location stats lost source totals/locale')
      }
      if (source.page.type === 'gallery') {
        const rendered = renderedCaptions(bytes.toString('utf8'))
        const inline = captionsEnabled && source.page.caption_policy !== 'detached'
        const expectedCount = source.page.travel.gallery.filter(photo => inline && photo.caption?.trim()).length
        assert.equal(rendered.size, expectedCount, 'Caption settings changed')
        for (const [index, photo] of source.page.travel.gallery.entries()) {
          if (!inline || !photo.caption?.trim()) continue
          const text = rendered.get(String((source.page.start_index || 0) + index + 1))
          assert.equal(text, photo.caption, 'Caption text or source ordinal changed')
          const coverage = captionCoverage.get(`${source.page.travel.id}:${photo.id}`)
          assert(coverage, 'Unexpected gallery caption')
          coverage.actual += text
        }
      } else if (source.page.type === 'gallery-caption') {
        const rendered = renderedCaptions(bytes.toString('utf8'))
        assert.equal(rendered.size, 1, 'Missing caption continuation text')
        const coverage = captionCoverage.get(`${source.page.travel.id}:${source.page.photo_id}`)
        assert(coverage, 'Unexpected caption continuation')
        coverage.actual += rendered.get('continuation')
      }
    }
    blocks += row.blocks.length; occurrences += row.occurrences.length; pages++
  }
  assert.equal(pages, certificate.completed.pages)
  assert.equal(blocks, certificate.completed.blocks)
  assert.equal(occurrences, certificate.completed.mediaOccurrences)
  assertRouteCoverage(routePoints, routeCoverage)
  for (const [key, caption] of captionCoverage) assert.equal(caption.actual, caption.expected, `Incomplete source caption: ${key}`)
  assert.equal(pageTypes.has('gallery'), fixture.document.settings.includeGallery && fixture.manifest.some(chunk => chunk.kind === 'gallery'))
  assert.equal(pageTypes.has('map'), fixture.document.settings.includeMap && fixture.manifest.some(chunk => chunk.kind === 'route'))
  assert.equal(pageTypes.has('toc'), fixture.document.settings.includeToc)
  assert.equal(pageTypes.has('checklists'), fixture.document.settings.includeChecklists && fixture.document.settings.checklistSections.length > 0)
  return { certificate, page_digest: pageDigest.digest('hex'), unique_resources: fixture.expected.unique_media_hashes.length }
}

async function diskBytes(directory) {
  let bytes = 0
  for (const entry of await fsp.readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name)
    if (entry.isDirectory()) bytes += await diskBytes(file)
    else if (entry.isFile()) bytes += (await fsp.stat(file)).size
    else throw new Error('Unexpected symlink/device in acceptance output')
  }
  return bytes
}

function processSample(pid) {
  const records = execFileSync('ps', ['-eo', 'pid=,ppid=,rss=,time=,comm='], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }).trim().split('\n').map(line => {
    const match = line.trim().match(/^(\d+)\s+(\d+)\s+(\d+)\s+([\d:.-]+)\s+(.+)$/)
    if (!match) return null
    const time = match[4].split(/[-:]/).map(Number)
    let cpu = time.pop() + (time.pop() || 0) * 60 + (time.pop() || 0) * 3600 + (time.pop() || 0) * 86400
    return { pid: Number(match[1]), ppid: Number(match[2]), rss: Number(match[3]) * 1024, cpu, command: path.basename(match[5]) }
  }).filter(Boolean)
  const descendants = new Set([pid])
  let previous = 0
  while (previous !== descendants.size) {
    previous = descendants.size
    for (const row of records) if (descendants.has(row.ppid)) descendants.add(row.pid)
  }
  return records.filter(row => descendants.has(row.pid))
}

async function physicalRun(artifact, manifest, job, out, readBytes, profile) {
  const started = performance.now()
  const inputBytes = await diskBytes(job)
  const child = fork(__filename, ['--internal-worker', artifact, manifest.entrypoint, job, out, String(readBytes), JSON.stringify(profile?.limits.renderer_resources ?? null), manifest.content_hash], { detached: true, stdio: ['ignore', 'ignore', 'pipe', 'ipc'] })
  let stderr = '', failure, peakRss = 0, peakBrowserRss = 0, peakDisk = 0
  const processCpu = new Map()
  child.stderr.on('data', bytes => { stderr = (stderr + bytes.toString()).slice(-16384) })
  const completion = new Promise(resolve => {
    child.once('error', error => { failure = error; resolve() })
    child.once('exit', (code, signal) => { if (code !== 0) failure = new Error(`Physical worker failed (${code ?? signal}): ${stderr}`); resolve() })
  })
  let finished = false
  const metricValues = () => ({ wall_ms: Math.round(performance.now() - started), sampled_process_tree_peak_rss_bytes: peakRss,
    sampled_browser_tree_peak_rss_bytes: peakBrowserRss, sampled_cpu_seconds: [...processCpu.values()].reduce((a, b) => a + b, 0),
    temp_disk_peak_bytes: inputBytes + peakDisk })
  completion.then(() => { finished = true })
  try { while (!finished) {
    let samples
    try { samples = processSample(child.pid) }
    catch (error) {
      try { process.kill(-child.pid, 'SIGTERM') } catch { /* Process may already have exited. */ }
      await completion
      throw new Error(`Required process-tree monitor failed: ${error.message}`)
    }
    peakRss = Math.max(peakRss, samples.reduce((sum, row) => sum + row.rss, 0))
    peakBrowserRss = Math.max(peakBrowserRss, samples.filter(row => row.pid !== child.pid).reduce((sum, row) => sum + row.rss, 0))
    for (const row of samples) processCpu.set(row.pid, Math.max(processCpu.get(row.pid) || 0, row.cpu))
    if (fs.existsSync(out)) peakDisk = Math.max(peakDisk, await diskBytes(out))
    try { enforceProfile(metricValues(), profile) }
    catch (error) {
      error.metrics = metricValues()
      for (const row of samples.reverse()) { try { process.kill(row.pid, 'SIGTERM') } catch { /* Exited since sample. */ } }
      try { process.kill(-child.pid, 'SIGTERM') } catch { /* Process may already have exited. */ }
      await completion
      throw error
    }
    await Promise.race([completion, new Promise(resolve => setTimeout(resolve, 1000))])
  } } finally {
    if (!finished) {
      try { process.kill(-child.pid, 'SIGTERM') } catch { /* Process may already have exited. */ }
      await completion
    }
  }
  await completion
  if (failure) throw failure
  peakDisk = Math.max(peakDisk, await diskBytes(out))
  enforceProfile(metricValues(), profile)
  return { ...metricValues(), sample_interval_ms: 1000,
    metric_limit: 'RSS/CPU are sampled lower bounds; exited descendants between samples may be missed. Disk uses logical file bytes.' }
}

async function main() {
  assert.equal(process.env.METRAVEL_STAGE, 'testing', 'Physical execution requires reviewed testing stage')
  const options = parseOptions(process.argv.slice(2))
  assert(/^[a-f0-9]{40}$/.test(options['--reviewed-sha'] || ''), 'Exact reviewed commit SHA is required')
  assert.equal(execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim(), options['--reviewed-sha'], 'Check out the reviewed commit before execution')
  execFileSync('git', ['diff', '--quiet', 'HEAD', '--', ...REVIEWED_INPUTS], { cwd: ROOT })
  for (const file of REVIEWED_INPUTS) {
    const reviewedBytes = execFileSync('git', ['show', `${options['--reviewed-sha']}:${file}`], { cwd: ROOT })
    assert.equal(hash(await fsp.readFile(path.join(ROOT, file))), hash(reviewedBytes), `Unreviewed acceptance input: ${file}`)
  }
  const { artifact, manifest } = await verifyArtifact(options['--artifact'], options['--artifact-hash'])
  const profile = await readProfile(options['--profile'])
  const suite = options['--suite'] || 'all'
  assert(['golden', 'stress', 'all'].includes(suite))
  const readSizes = (options['--read-bytes'] || '65536').split(',').map(Number)
  assert(readSizes.length > 0 && readSizes.every(value => Number.isSafeInteger(value) && value >= 1 && value <= 65536))
  await fsp.mkdir(SCRATCH, { recursive: true, mode: 0o700 })
  const runDir = await fsp.mkdtemp(path.join(SCRATCH, 'physical-book-'))
  const { buildSnapshotFixture } = fixtureHelper()
  const scenarios = corpus(suite).filter(scenario => !options['--case'] || scenario.name === options['--case'])
  assert(scenarios.length, 'Unknown acceptance case')
  const report = { reviewed_sha: options['--reviewed-sha'], artifact_content_hash: manifest.content_hash,
    renderer_version: manifest.renderer_version, profile_kind: profile?.kind ?? null, profile_file_hash: profile?.hash ?? null,
    profile_hash_scheme: 'sha256-input-file-bytes; not B2 canonical profile_hash',
    profile_id: profile?.id ?? null, profile_limits: profile?.limits ?? null, unenforced_profile_gates: profile?.unenforced ?? ['No profile supplied'],
    capacity_verdict: 'NOT_EVALUATED: authoritative B2 budgets and app-health monitor required', results: [] }
  try {
    for (const scenario of scenarios) {
      const fixture = await buildSnapshotFixture(path.join(runDir, `${scenario.name}-input`), scenario)
      assert.equal(fixture.document.renderer_version, manifest.renderer_version)
      let baseline
      for (const readBytes of readSizes) {
        const out = path.join(runDir, `${scenario.name}-${readBytes}-output`)
        const metrics = await physicalRun(artifact, manifest, fixture.jobDir, out, readBytes, profile)
        const result = await verifyResult(fixture, out, manifest, artifact, profile)
        const comparable = { expected: result.certificate.expected, source_media_coverage: result.certificate.source_media_coverage, page_digest: result.page_digest }
        if (baseline) assert.deepEqual(comparable, baseline, 'Read chunk size changed pagination/order/content')
        baseline = comparable
        report.results.push({ scenario: scenario.name, read_bytes: readBytes, locale: fixture.document.settings.locale,
          settings: fixture.document.settings, ...result, metrics, output_ref: path.relative(runDir, out) })
        await fsp.writeFile(path.join(runDir, 'report.json'), json(report), { mode: 0o600 })
        process.stdout.write(`${scenario.name} read=${readBytes}: verified ${result.certificate.completed.pages} physical pages\n`)
      }
    }
    report.fixture_verdict = 'PASS'; report.sampled_profile_verdict = profile ? 'WITHIN_LIMITS' : 'NO_PROFILE'
  } catch (error) {
    report.fixture_verdict = 'FAIL'; report.error = error.message
    if (error.metrics) report.failure_metrics = error.metrics
    throw error
  } finally {
    await fsp.writeFile(path.join(runDir, 'report.json'), json(report), { mode: 0o600 })
    process.stdout.write(`Private acceptance report: ${path.join(runDir, 'report.json')}\n`)
  }
}

module.exports = { privateRef, verifyArtifact, loadArtifactEntrypoint, parseOptions, corpus, readProfile, enforceProfile, renderedCaptions, renderedMapText, renderedMapPoints, assertRouteCoverage, semanticText, verifyPrintResources }

if (require.main === module) {
  if (process.argv[2] === '--internal-worker') {
    assert.equal(process.env.METRAVEL_STAGE, 'testing')
    const [, , , artifact, entrypoint, job, out, readBytes, resourceProfile, artifactHash] = process.argv
    assert(path.resolve(job).startsWith(SCRATCH + path.sep) && path.resolve(out).startsWith(SCRATCH + path.sep))
    verifyArtifact(artifact, artifactHash).then(({ manifest }) => {
      assert.equal(entrypoint, manifest.entrypoint)
      const { runWorker } = loadArtifactEntrypoint(privateRef(artifact, entrypoint), artifact, manifest)
      return runWorker(job, out, { read_bytes: Number(readBytes), ...(resourceProfile && resourceProfile !== 'null' ? { resource_profile: JSON.parse(resourceProfile) } : {}) })
    }).catch(error => { process.stderr.write(`${error.message}\n`); process.exitCode = 1 })
  } else main().catch(error => { process.stderr.write(`${error.message}\n`); process.exitCode = 1 })
}
