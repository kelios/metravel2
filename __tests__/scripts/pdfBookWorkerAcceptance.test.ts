/** @jest-environment node */
import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'

const ROOT = path.resolve(__dirname, '../..')
const nativeRequire = createRequire(__filename)
const { privateRef, verifyArtifact, loadArtifactEntrypoint, parseOptions, corpus, readProfile, enforceProfile, renderedCaptions, semanticText } = nativeRequire(
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

  it('verifies reviewed artifact bytes and rejects changed bytes or a symlinked artifact root', async () => {
    const artifact = path.join(scratch, 'artifact')
    await mkdir(path.join(artifact, 'fonts'), { recursive: true })
    const runtime = { entrypoint: 'index.js', renderer_version: 'fixture/1.0.0' }
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
