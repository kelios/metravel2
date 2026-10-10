/** @jest-environment node */
import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import { buildSnapshotFixture, fixtureCanonicalJson } from '../fixtures/pdfBook/buildSnapshotFixture'
import { PRINT_ASSET_RECIPE, PRINT_VARIANT_RECIPE, PRINT_ORIENTED_VARIANT_RECIPE } from '@/services/pdf-export/segments/printAssetsTypes'

const ROOT = path.resolve(__dirname, '../..')
const nativeRequire = createRequire(__filename)
const { privateRef, verifyArtifact, loadArtifactEntrypoint, parseOptions, corpus, readProfile, enforceProfile, renderedCaptions, renderedMapText, renderedMapPoints, assertRouteCoverage, semanticText, verifyPrintResources } = nativeRequire(
  path.join(ROOT, 'scripts/pdf-book-worker-acceptance.cjs'),
)
const sha256 = (value: string | Buffer) => createHash('sha256').update(value).digest('hex')

describe('physical book acceptance evidence boundaries (no browser)', () => {
  let scratch: string
  beforeAll(async () => {
    await mkdir(path.join(ROOT, '.codex-temp', 'tests'), { recursive: true })
    scratch = await mkdtemp(path.join(ROOT, '.codex-temp', 'tests', 'acceptance-contract-'))
  })
  afterAll(async () => { await rm(scratch, { recursive: true, force: true }) })

  it('rejects unknown, duplicate and incomplete CLI options', () => {
    expect(parseOptions(['--suite', 'stress', '--case', 'huge-chapter'])).toEqual({ '--suite': 'stress', '--case': 'huge-chapter' })
    expect(() => parseOptions(['--measure', 'fake'])).toThrow()
    expect(() => parseOptions(['--suite', 'stress', '--suite', 'golden'])).toThrow()
    expect(() => parseOptions(['--reviewed-sha'])).toThrow()
  })

  it('extracts exact caption text separately from page labels and rejects duplicate ordinals', () => {
    expect(renderedCaptions('<h2>Photo 7</h2><figcaption class="book-gallery-caption" data-photo-ordinal="7">ё &amp; 😀</figcaption>'))
      .toEqual(new Map([['7', 'ё & 😀']]))
    expect(renderedCaptions('<div class="book-gallery-caption-continuation"><h2>Photo 7</h2><div class="book-gallery-caption-text"><p>continued &lt;text&gt;</p></div></div>'))
      .toEqual(new Map([['continuation', 'continued <text>']]))
    expect(() => renderedCaptions('<figcaption class="book-gallery-caption" data-photo-ordinal="1">first</figcaption><figcaption class="book-gallery-caption" data-photo-ordinal="1">duplicate</figcaption>'))
      .toThrow('Duplicate rendered caption')
  })

  it('extracts exact route field text without labels or structural indentation', () => {
    const html = '<div class="map-location-card" data-point-id="16277" data-point-ordinal="39"><h2>Point 39</h2>' +
      '<div class="book-map-source-text" data-point-id="16277" data-point-ordinal="39" data-point-field="address"><p>A, B, C, D · 😀界 &amp; &lt;script&gt;</p></div></div>'
    expect(renderedMapPoints(html)).toEqual([{ id: '16277', ordinal: 39, images: [] }])
    expect(renderedMapText(html).map((field: { id: string; ordinal: number; field: string; text: string }) => ({ id: field.id, ordinal: field.ordinal, field: field.field, text: field.text })))
      .toEqual([{ id: '16277', ordinal: 39, field: 'address', text: 'A, B, C, D · 😀界 & <script>' }])
    expect(() => renderedMapText('<div class="book-map-source-text" data-point-id="16277" data-point-ordinal="0" data-point-field="address">text</div>')).toThrow('identity')
  })

  it.each(['A, B, C', 'A, C, B, D', 'A, B, C, D, D'])('rejects omitted/reordered/repeated raw map fields: %s', actual => {
    expect(() => assertRouteCoverage(new Map([['761:16277', { rendered: 1 }]]), new Map([['761:16277:address', { expected: 'A, B, C, D', actual }]])))
      .toThrow('Incomplete source map field')
  })

  it.each([0, 2])('rejects missing or duplicated source point cards (%s)', rendered => {
    expect(() => assertRouteCoverage(new Map([['761:16277', { rendered }]]), new Map())).toThrow('source map point')
  })

  const contentPage = (content: string, elsewhere = '') => `<html><head><title>${elsewhere}</title><style>${elsewhere}</style></head><body>
    <section class="travel-content-page"><style>${elsewhere}</style><table class="content-layout">
      <thead><tr><td>${elsewhere}</td></tr></thead><tbody><tr><td>${content}</td></tr></tbody>
    </table></section><footer>${elsewhere}</footer><script>${elsewhere}</script></body></html>`

  it.each([
    ['<h2>Heading</h2><p>Before <strong>bold</strong> <a>linked text</a> after.</p>',
      '<h3>Heading</h3>\n  <p>Before <strong>bold</strong> <a>linked text</a> after.</p>', 'Heading Before bold linked text after.'],
    ['<p>First</p><p>Second</p>', '<p>First</p>\n<p>Second</p>', 'First Second'],
    ['<table><tr><th>Column</th><td>Value</td></tr></table><ol><li>One</li><li>Two</li></ol>',
      '<table>\n<tr><th>Column</th>\n<td>Value</td></tr></table>\n<ol><li>One</li>\n<li>Two</li></ol>', 'Column Value One Two'],
    ['<p>A<br>B &amp; 😀</p>', '<p>A<br />\nB &amp; 😀</p>', 'A B & 😀'],
  ])('compares semantic block boundaries without requiring renderer indentation: %s', (source, rendered, expected) => {
    expect(semanticText(source)).toBe(expected)
    expect(semanticText(contentPage(rendered), { contentOnly: true })).toBe(expected)
  })

  it('preserves inline adjacency and authored whitespace between words', () => {
    expect(semanticText('<p>pre<strong>fix</strong> <a>next</a> word</p>')).toBe('prefix next word')
    expect(semanticText('<p>foo <strong>bar</strong></p>')).not.toBe(semanticText('<p>foo<strong>bar</strong></p>'))
  })

  it.each([
    ['missing word', '<p>alpha beta gamma</p>', '<p>alpha gamma</p>'],
    ['changed order', '<p>alpha beta gamma</p>', '<p>alpha gamma beta</p>'],
    ['lost repetition', '<p>repeat repeat repeat</p>', '<p>repeat repeat</p>'],
    ['merged words', '<p>foo bar</p>', '<p>foobar</p>'],
  ])('rejects %s even when exact source text appears outside the content body', (_reason, source, rendered) => {
    const delivered = semanticText(contentPage(rendered, semanticText(source)), { contentOnly: true })
    expect(delivered.includes(semanticText(source))).toBe(false)
  })

  it('excludes non-content head/style/script/template text and requires the canonical content body', () => {
    expect(semanticText('<head><title>head</title></head><style>style</style><script>script</script><template>template</template><p>body</p>'))
      .toBe('body')
    expect(semanticText('<section class="travel-content-page"><p>outside body</p></section>', { contentOnly: true })).toBe('')
    expect(semanticText(contentPage('<p>visible</p><script>hidden</script><template>hidden</template>'), { contentOnly: true })).toBe('visible')
  })

  it('rejects escaped references and symlinked private files', async () => {
    expect(() => privateRef(scratch, '../outside')).toThrow()
    expect(() => privateRef(scratch, path.join(scratch, 'absolute'))).toThrow()
    await writeFile(path.join(scratch, 'target'), 'private')
    await symlink(path.join(scratch, 'target'), path.join(scratch, 'linked'))
    expect(() => privateRef(scratch, 'linked')).toThrow()
  })

  it('independently rejects unreferenced bindings, missing/duplicate responses and changed served bytes', async () => {
    const fixture = await buildSnapshotFixture(path.join(scratch, 'binding-input'), { travels: [{ id: 41, title: 'Binding proof' }] })
    const chunk = fixture.manifest.find(value => value.kind === 'media')!
    const original = await readFile(path.join(fixture.jobDir, chunk.file_ref))
    const out = path.join(scratch, 'binding-output'); await mkdir(out)
    const identity = { executable_sha256: 'c'.repeat(64) }
    const policyHash = sha256(fixtureCanonicalJson(PRINT_ASSET_RECIPE)), identityHash = sha256(fixtureCanonicalJson(identity))
    const body = { original_checksum: chunk.checksum, served_checksum: chunk.checksum, served_file_ref: 'derived.png',
      mode: 'encoded', mime: 'image/png', width: 1, height: 1, encoded_bytes: original.length,
      original_encoded_bytes: original.length, original_pixels: 1, served_pixels: 1, recipe_hash: policyHash, encoder_identity_hash: identityHash }
    const descriptor = fixtureCanonicalJson({ original_checksum: chunk.checksum, oriented_width: 1, oriented_height: 1,
      has_source_alpha: true, has_output_alpha: true, recipe: PRINT_ASSET_RECIPE, encoder_identity: identity, binding: body })
    await writeFile(path.join(out, 'descriptor.json'), descriptor); await writeFile(path.join(out, body.served_file_ref), original)
    const source = { source_schema_version: 3, resource_bindings: [{ ...body, descriptor_ref: 'descriptor.json', descriptor_checksum: sha256(descriptor) }],
      resource_bindings_hash: '', resource_policy_hash: policyHash, encoder_identity_hash: identityHash }
    source.resource_bindings_hash = sha256(fixtureCanonicalJson(source.resource_bindings))
    const sourceBytes = fixtureCanonicalJson(source); await writeFile(path.join(out, 'source.json'), sourceBytes)
    const response = { original_checksum: chunk.checksum, served_checksum: chunk.checksum }
    const row = { segment_ref: 'source.json', source_checksum: sha256(sourceBytes), resource_bindings_hash: source.resource_bindings_hash,
      resource_policy_hash: policyHash, encoder_identity_hash: identityHash, served_resources: [response] }
    const certificate = { print_encoder_identity: identity }, manifest = { print_asset_recipe: PRINT_ASSET_RECIPE, print_encoder_pin: {} }
    const html = `<p>https://book-snapshot.invalid/assets/${chunk.checksum}</p><img src="https://book-snapshot.invalid/print-assets/${chunk.checksum}/${chunk.checksum}">`
    await expect(verifyPrintResources(fixture, out, row, html, certificate, manifest)).resolves.toEqual(source)
    const legacyStyle = 'filter:sepia(100%); --metravel-print-effect:sepia(1); --metravel-print-theme:sepia;'
    await expect(verifyPrintResources(fixture, out, row, html.replace('<img ', `<img style="${legacyStyle}" `), certificate, manifest)).resolves.toEqual(source)
    await expect(verifyPrintResources(fixture, out, row, '<p>no resource</p>', certificate, manifest)).rejects.toThrow('never referenced')
    await expect(verifyPrintResources(fixture, out, { ...row, served_resources: [] }, html, certificate, manifest)).rejects.toThrow('never served')
    await expect(verifyPrintResources(fixture, out, { ...row, served_resources: [response, response] }, html, certificate, manifest)).rejects.toThrow('Duplicate actual')
    await writeFile(path.join(out, body.served_file_ref), Buffer.from('corruption'))
    await expect(verifyPrintResources(fixture, out, row, html, certificate, manifest)).rejects.toThrow('Saved served bytes')
  })

  it('independently reconciles mixed variants of identical source/served bytes and rejects effect/response substitution', async () => {
    const fixture = await buildSnapshotFixture(path.join(scratch, 'variant-input'), { travels: [{ id: 41, title: 'Variant proof' }], settings: { template: 'sepia' } })
    const chunk = fixture.manifest.find(value => value.kind === 'media')!, original = await readFile(path.join(fixture.jobDir, chunk.file_ref))
    const out = path.join(scratch, 'variant-output'); await mkdir(out)
    const identity = { executable_sha256: 'c'.repeat(64) }, identityHash = sha256(fixtureCanonicalJson(identity))
    const policyHash = sha256(fixtureCanonicalJson(PRINT_VARIANT_RECIPE))
    const bindings = []
    for (const effect of [{ theme_id: 'unfiltered', filter: 'none' }, { theme_id: 'sepia', filter: 'sepia(1)' }]) {
      const variant = sha256(fixtureCanonicalJson([chunk.checksum, effect, policyHash, identityHash]))
      const body = { original_checksum: chunk.checksum, served_checksum: chunk.checksum, variant_hash: variant, effect,
        filter_working_pixels: effect.filter === 'none' ? 0 : 1, served_file_ref: 'derived.png', mode: 'encoded', mime: 'image/png',
        width: 1, height: 1, encoded_bytes: original.length, original_encoded_bytes: original.length, original_pixels: 1,
        served_pixels: 1, recipe_hash: policyHash, encoder_identity_hash: identityHash }
      const descriptor = fixtureCanonicalJson({ original_checksum: chunk.checksum, oriented_width: 1, oriented_height: 1,
        has_source_alpha: true, has_output_alpha: true, recipe: PRINT_VARIANT_RECIPE, encoder_identity: identity, binding: body })
      await writeFile(path.join(out, `${variant}.json`), descriptor)
      bindings.push({ ...body, descriptor_ref: `${variant}.json`, descriptor_checksum: sha256(descriptor) })
    }
    await writeFile(path.join(out, 'derived.png'), original)
    const source = { source_schema_version: 4, resource_bindings: bindings, resource_bindings_hash: sha256(fixtureCanonicalJson(bindings)),
      resource_policy_hash: policyHash, encoder_identity_hash: identityHash }
    const sourceBytes = fixtureCanonicalJson(source); await writeFile(path.join(out, 'source.json'), sourceBytes)
    const responses = bindings.map(value => ({ original_checksum: value.original_checksum, served_checksum: value.served_checksum, variant_hash: value.variant_hash }))
    const row = { segment_ref: 'source.json', source_checksum: sha256(sourceBytes), resource_bindings_hash: source.resource_bindings_hash,
      resource_policy_hash: policyHash, encoder_identity_hash: identityHash, served_resources: responses }
    const certificate = { print_encoder_identity: identity }, manifest = { print_variant_recipe: PRINT_VARIANT_RECIPE, print_encoder_pin: {} }
    const img = (index: number, style = '') => `<img src="https://book-snapshot.invalid/print-assets/${chunk.checksum}/${bindings[index].variant_hash}/${chunk.checksum}" style="${style}">`
    const html = img(0) + img(1, 'filter:blur(28px); filter:none; --metravel-print-effect:sepia(1); --metravel-print-theme:sepia;')
    await expect(verifyPrintResources(fixture, out, row, html, certificate, manifest)).resolves.toEqual(source)
    await expect(verifyPrintResources(fixture, out, row, img(0) + img(1), certificate, manifest)).rejects.toThrow('authorized effect')
    await expect(verifyPrintResources(fixture, out, { ...row, served_resources: [responses[0], responses[0]] }, html, certificate, manifest)).rejects.toThrow('Duplicate actual')
    await expect(verifyPrintResources(fixture, out, { ...row, served_resources: [responses[0]] }, html, certificate, manifest)).rejects.toThrow('never served')
    await expect(verifyPrintResources(fixture, out, row, html.replace('filter:none;', ''), certificate, manifest)).rejects.toThrow('CSS filtering')
  })

  it('retains genuine rotated PNG/WebP fixtures with independently expected orientation', async () => {
    for (const mediaFixture of ['rotated-png', 'rotated-webp'] as const) {
      expect(corpus('golden').some((entry: { mediaFixture?: string }) => entry.mediaFixture === mediaFixture)).toBe(true)
      const fixture = await buildSnapshotFixture(path.join(scratch, mediaFixture), { travels: [{ id: 41, title: 'Orientation fixture' }], mediaFixture })
      expect(fixture.expected.print_media).toMatchObject(mediaFixture === 'rotated-png'
        ? { oriented_width: 2, oriented_height: 2501 } : { oriented_width: 200, oriented_height: 300 })
      const chunk = fixture.manifest.find(value => value.kind === 'media')!
      const bytes = await readFile(path.join(fixture.jobDir, chunk.file_ref))
      expect(sha256(bytes)).toBe(chunk.checksum)
      expect(bytes.includes(Buffer.from(mediaFixture === 'rotated-png' ? 'eXIf' : 'EXIF'))).toBe(true)
    }
  })

  it('requires per-original independent schema5 orientation/carrier facts and rejects a rehashed square-image mirror forgery', async () => {
    const fixture = await buildSnapshotFixture(path.join(scratch, 'orientation-proof-input'), { travels: [{ id: 41, title: 'Orientation proof' }] })
    const chunk = fixture.manifest.find(value => value.kind === 'media')!, original = await readFile(path.join(fixture.jobDir, chunk.file_ref))
    const out = path.join(scratch, 'orientation-proof-output'); await mkdir(out)
    const identity = { executable_sha256: 'c'.repeat(64) }, identityHash = sha256(fixtureCanonicalJson(identity))
    const effect = { theme_id: 'unfiltered', filter: 'none' }, policyHash = sha256(fixtureCanonicalJson(PRINT_ORIENTED_VARIANT_RECIPE))
    const variant = sha256(fixtureCanonicalJson([chunk.checksum, effect, policyHash, identityHash]))
    const body = { ...fixture.expected.print_orientation_by_checksum[chunk.checksum], oriented_width: 1, oriented_height: 1,
      original_checksum: chunk.checksum, served_checksum: chunk.checksum, variant_hash: variant, effect, filter_working_pixels: 0,
      served_file_ref: 'derived.png', mode: 'encoded', mime: 'image/png', width: 1, height: 1, encoded_bytes: original.length,
      original_encoded_bytes: original.length, original_pixels: 1, served_pixels: 1, recipe_hash: policyHash, encoder_identity_hash: identityHash }
    const descriptor = { schema_version: 3, original_checksum: chunk.checksum, oriented_width: 1, oriented_height: 1,
      has_source_alpha: true, has_output_alpha: true, recipe: PRINT_ORIENTED_VARIANT_RECIPE, encoder_identity: identity, binding: body }
    await writeFile(path.join(out, 'derived.png'), original)
    const persist = async () => {
      const descriptorBytes = fixtureCanonicalJson(descriptor); await writeFile(path.join(out, 'descriptor.json'), descriptorBytes)
      const bindings = [{ ...body, descriptor_ref: 'descriptor.json', descriptor_checksum: sha256(descriptorBytes) }]
      const source = { source_schema_version: 5, resource_bindings: bindings, resource_bindings_hash: sha256(fixtureCanonicalJson(bindings)), resource_policy_hash: policyHash, encoder_identity_hash: identityHash }
      const sourceBytes = fixtureCanonicalJson(source); await writeFile(path.join(out, 'source.json'), sourceBytes)
      return { segment_ref: 'source.json', source_checksum: sha256(sourceBytes), resource_bindings_hash: source.resource_bindings_hash, resource_policy_hash: policyHash, encoder_identity_hash: identityHash,
        served_resources: [{ original_checksum: chunk.checksum, served_checksum: chunk.checksum, variant_hash: variant }] }
    }
    const row = await persist(), certificate = { print_encoder_identity: identity }, manifest = { print_oriented_variant_recipe: PRINT_ORIENTED_VARIANT_RECIPE, print_encoder_pin: {} }
    const html = `<img src="https://book-snapshot.invalid/print-assets/${chunk.checksum}/${variant}/${chunk.checksum}">`
    await expect(verifyPrintResources(fixture, out, row, html, certificate, manifest)).resolves.toMatchObject({ source_schema_version: 5 })
    await expect(verifyPrintResources({ ...fixture, expected: { ...fixture.expected, print_orientation_by_checksum: { ['f'.repeat(64)]: body } } }, out, row, html, certificate, manifest)).rejects.toThrow('independent original/carrier')
    Object.assign(body, { original_orientation: 2, normalized_decode_checksum: 'f'.repeat(64), normalization_working_bytes: original.length })
    await expect(verifyPrintResources(fixture, out, await persist(), html, certificate, manifest)).rejects.toThrow('independent fixture: original_orientation')
    Object.assign(body, { original_orientation: 1, normalization_working_bytes: 0 })
    await expect(verifyPrintResources(fixture, out, await persist(), html, certificate, manifest)).rejects.toThrow('independent fixture: normalized_decode_checksum')
  })

  it('verifies reviewed artifact bytes and rejects changed bytes or a symlinked artifact root', async () => {
    const artifact = path.join(scratch, 'artifact')
    await mkdir(path.join(artifact, 'fonts'), { recursive: true })
    const runtime = { entrypoint: 'index.js', renderer_version: 'fixture/1.0.0', prepared_source_schema_version: 4 }
    const files = [{ path: 'fonts/fonts.css', value: 'pinned font stylesheet' }, { path: 'index.js', value: 'module.exports = {}' }, { path: 'renderer-runtime.json', value: JSON.stringify(runtime) }]
    const content = createHash('sha256')
    for (const file of files) {
      await writeFile(path.join(artifact, file.path), file.value)
      content.update(`${file.path}\0${Buffer.byteLength(file.value)}\0`).update(file.value).update('\0')
    }
    const contentHash = content.digest('hex')
    await writeFile(path.join(artifact, 'renderer-manifest.json'), JSON.stringify({
      ...runtime, content_hash: contentHash, fonts: { stylesheet: 'fonts/fonts.css' },
      files: files.map(file => ({ path: file.path, sha256: sha256(file.value), size_bytes: Buffer.byteLength(file.value) })),
    }))
    const verified = await verifyArtifact(artifact, contentHash)
    expect(verified.manifest.content_hash).toBe(contentHash)
    expect(loadArtifactEntrypoint(path.join(artifact, 'index.js'), artifact, verified.manifest)).toEqual({})
    expect(() => loadArtifactEntrypoint(path.join(artifact, 'fonts/fonts.css'), artifact, verified.manifest)).toThrow('outside')
    await expect(verifyArtifact(artifact, '0'.repeat(64))).rejects.toThrow('reviewed content hash')
    await symlink(artifact, path.join(scratch, 'artifact-link'))
    await expect(verifyArtifact(path.join(scratch, 'artifact-link'), contentHash)).rejects.toThrow('symlink')
    const metadata = JSON.parse(await readFile(path.join(artifact, 'renderer-manifest.json'), 'utf8'))
    await writeFile(path.join(artifact, 'renderer-manifest.json'), JSON.stringify({ ...metadata, entrypoint: 'unverified.js' }))
    await expect(verifyArtifact(artifact, contentHash)).rejects.toThrow('Unpinned artifact metadata')
    await writeFile(path.join(artifact, 'renderer-manifest.json'), JSON.stringify(metadata))
    await writeFile(path.join(artifact, 'index.js'), 'module.exports = 42')
    expect(() => loadArtifactEntrypoint(path.join(artifact, 'index.js'), artifact, verified.manifest)).toThrow()
    await expect(verifyArtifact(artifact, contentHash)).rejects.toThrow()
  })

  it('retains product-limit crossing loads, huge paragraph/table, manual order and all production locales', () => {
    const cases = corpus('all')
    expect(cases.filter((entry: { locale?: string }) => entry.locale).map((entry: { locale: string }) => entry.locale)).toEqual(['RU', 'BE', 'UK', 'PL', 'EN'])
    expect(cases.filter((entry: { name: string }) => entry.name.startsWith('photos-')).map((entry: { travels: Array<{ photos: number }> }) => entry.travels[0].photos)).toEqual([201, 1000, 5000])
    const selection = cases.find((entry: { name: string }) => entry.name === 'selection-51')
    expect(selection.travels).toHaveLength(51)
    expect(selection.travels[0].id).toBeGreaterThan(selection.travels[50].id)
    const huge = cases.find((entry: { name: string }) => entry.name === 'huge-chapter').travels[0]
    expect(huge.description.length + huge.plus.length).toBeGreaterThan(500_000)
    expect(huge.plus).toContain('<table>')
    expect(huge.minus.length).toBeGreaterThan(100_000)
    expect(huge.minus).toContain('LAST_LIST_ITEM')
    expect(huge.points).toBeGreaterThan(30)
    expect(cases.find((entry: { name: string }) => entry.name === 'layout-polaroid')).toBeDefined()
    const captions = cases.find((entry: { name: string }) => entry.name === 'polaroid-multiline-captions').travels[0].captions
    expect(captions.every((caption: string) => caption.length > 200)).toBe(true)
    for (const layout of ['polaroid', 'collage']) {
      const captionCase = cases.find((entry: { name: string }) => entry.name === `caption-500-${layout}`)
      expect(Array.from(captionCase.travels[0].captions[0])).toHaveLength(500)
      expect(captionCase.settings.galleryColumns).toBe(4)
    }
  })

  it('keeps long map corpus rows within immutable snapshot record budgets', () => {
    for (const name of ['map-complete-0', 'map-complete-1']) {
      const travel = corpus('all').find((entry: { name: string }) => entry.name === name).travels[0]
      expect(travel.routeAddresses.some((value: string) => value.length > 40000)).toBe(true)
      expect(travel.routeCategories.some((value: string) => Array.from(value).length > 10000)).toBe(true)
      for (const value of travel.routeAddresses) expect(Buffer.byteLength(JSON.stringify({ id: 1, address: value, country_id: 1, lat: '53.9000000', lng: '27.5600000', coord: '53.9,27.56', image: 'uploads/fixture-shared.png', image_detail: '', image_landscape: '' }))).toBeLessThanOrEqual(65536)
      for (const value of travel.routeCategories) expect(Buffer.byteLength(JSON.stringify({ id: 2, name: value, route_id: 1 }))).toBeLessThanOrEqual(65536)
    }
  })

  it('requires complete explicit units and enforces every provided B2 budget without inventing a default', async () => {
    const profilePath = path.join(scratch, 'budget.json')
    const limits = { profile_kind: 'diagnostic-run', profile_version: 1, concurrency: 1, process_tree_peak_rss_bytes: 100,
      browser_tree_peak_rss_bytes: 80, cpu_seconds: 2, wall_ms: 1000, temp_disk_peak_bytes: 200,
      renderer_resources: { encoded_resource_bytes: 100, encoded_portion_bytes: 200,
        decoded_resource_pixels: 100, decoded_portion_pixels: 200, dom_nodes: 1000 } }
    await writeFile(profilePath, JSON.stringify(limits))
    const profile = await readProfile(profilePath)
    expect(profile.hash).toBe(sha256(await readFile(profilePath)))
    expect(await readProfile(undefined)).toBeNull()
    const metrics = { sampled_process_tree_peak_rss_bytes: 100, sampled_browser_tree_peak_rss_bytes: 80,
      sampled_cpu_seconds: 2, wall_ms: 1000, temp_disk_peak_bytes: 200 }
    expect(() => enforceProfile(metrics, profile)).not.toThrow()
    for (const metric of Object.keys(metrics)) expect(() => enforceProfile({ ...metrics, [metric]: 10000 }, profile)).toThrow('B2_PROFILE_EXCEEDED')
    expect(() => enforceProfile({}, profile)).toThrow('Unavailable runtime metric')
    await writeFile(profilePath, JSON.stringify({ ...limits, cpu_seconds: undefined }))
    await expect(readProfile(profilePath)).rejects.toThrow('cpu_seconds')
  })

  it('preserves actual B2 profile identity/file hash and never applies a per-portion CPU budget to the whole book', async () => {
    const b2 = { version: 1, id: 'owner-approved-test', approved_by: 'fixture-owner', isolation: 'fixture-only', concurrency: 1,
      rss_bytes: 10000, cpu_seconds: 10, cpu_cores: 1, app_rss_bytes: 10000, app_cpu_cores: 1,
      temp_disk_bytes: 10000, disk_reserve_bytes: 1000, encoded_resource_bytes: 100, encoded_portion_bytes: 200,
      decoded_resource_pixels: 100, decoded_portion_pixels: 200, dom_nodes: 1000, manifest_rows: 100,
      text_bytes: 1000, pages: 1, portion_seconds: 30, api_p95_ms: 100, api_error_rate_max: 0.01, api_degradation_ratio_max: 1.2 }
    const file = path.join(scratch, 'actual-b2-profile.json')
    await writeFile(file, JSON.stringify(b2))
    const profile = await readProfile(file)
    expect(profile.kind).toBe('b2')
    expect(profile.id).toBe(b2.id)
    expect(profile.limits).not.toHaveProperty('cpu_seconds')
    expect(profile.unenforced).toContain('per-portion CPU/time')
    expect(() => enforceProfile({ sampled_process_tree_peak_rss_bytes: 9999, temp_disk_peak_bytes: 9999, sampled_cpu_seconds: 5000 }, profile)).not.toThrow()
    expect(() => enforceProfile({ sampled_process_tree_peak_rss_bytes: 10001, temp_disk_peak_bytes: 9999 }, profile)).toThrow('B2_PROFILE_EXCEEDED')
    await writeFile(file, JSON.stringify(Object.fromEntries(Object.entries(b2).reverse())))
    expect((await readProfile(file)).hash).not.toBe(profile.hash)
    expect((await readProfile(file)).limits).toEqual(profile.limits)
  })
})
