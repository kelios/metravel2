/** @jest-environment node */
import { createHash } from 'node:crypto'
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import type { BookSnapshotChunk } from '@/types/bookDocument'
import type { PdfThemeName } from '@/services/pdf-export/themes/types'
import type { BookDocument } from '@/types/bookDocument'
import type { PreparedPageRequest, PreparedPageReceipt } from '@/workers/book-renderer/portion'
import type { BookSettings } from '@/types/bookSettings'
import type { TravelForBook } from '@/types/pdf-export'
import type { BookSegmentPage } from '@/services/pdf-export/segments/types'
import type { NormalizedLocation } from '@/services/pdf-export/generators/v2/runtime/types'
import { BOOK_RENDERER_VERSION, BOOK_SNAPSHOT_TEXT_CHARACTERS } from '@/types/bookDocument'
import {
  buildSnapshotFixture,
  fixtureCanonicalJson,
  SNAPSHOT_FIXTURE_IMAGE_SRC,
} from '../../fixtures/pdfBook/buildSnapshotFixture'

interface WorkerCertificate {
  expected: { travels: number; blocks: number; mediaOccurrences: number; pages: number }
  completed: WorkerCertificate['expected']
  snapshot_hash: string
  settings_hash: string
  renderer_version: string
  measured: boolean
  source_media_coverage: { expected: number; completed: number }
}

type WorkerRun = (
  jobDir: string,
  outDir: string,
  options: { read_bytes: number; measure: (html: string) => Promise<{ pages: number; fits: boolean }> },
) => Promise<WorkerCertificate>

const ROOT = path.resolve(__dirname, '../../..')
const nativeRequire = createRequire(__filename)
const sha256 = (bytes: string | Uint8Array): string => createHash('sha256').update(bytes).digest('hex')

interface HtmlNode { nodeName: string; value?: string; childNodes?: HtmlNode[]; attrs?: Array<{ name: string; value: string }> }
const parseFragment = (nativeRequire('parse5') as { parseFragment: (html: string) => HtmlNode }).parseFragment
function sourceText(html: string): string {
  const text = (node: HtmlNode): string => node.nodeName === '#text'
    ? node.value ?? '' : (node.childNodes ?? []).map(text).join('')
  return text(parseFragment(html))
}

function logicalSnapshotImages(html: string): number {
  const count = (node: HtmlNode): number => {
    const attrs = Object.fromEntries((node.attrs ?? []).map((attribute) => [attribute.name, attribute.value]))
    const placement = node.nodeName === 'img' && /^https:\/\/book-snapshot\.invalid\/assets\/[0-9a-f]{64}$/.test(attrs.src ?? '') && attrs['aria-hidden'] !== 'true'
    return Number(placement) + (node.childNodes ?? []).reduce((sum, child) => sum + count(child), 0)
  }
  return count(parseFragment(html))
}

const THEMES: PdfThemeName[] = [
  'minimal', 'light', 'dark', 'travel-magazine', 'classic', 'modern', 'romantic', 'adventure',
  'illustrated', 'black-white', 'sepia', 'newspaper', 'ocean', 'forest', 'sunset', 'nordic',
  'retro', 'tropical', 'editorial-luxe', 'watercolor',
]

async function readRows<T>(file: string): Promise<T[]> {
  return (await readFile(file, 'utf8')).split('\n').filter(Boolean).map((line) => JSON.parse(line) as T)
}

/** Finite protocol fixtures: fake page measurement is not physical-pagination evidence. */
describe('isolated book renderer worker protocol', () => {
  let scratch: string
  let runWorker: WorkerRun
  let artifactManifest: { renderer_version: string; files: Array<{ path: string; sha256: string; size_bytes: number }> }

  beforeAll(async () => {
    await mkdir(path.join(ROOT, '.codex-temp', 'tests'), { recursive: true })
    scratch = await mkdtemp(path.join(ROOT, '.codex-temp', 'tests', 'book-worker-'))
    const { buildBookRenderer } = nativeRequire(path.join(ROOT, 'scripts', 'build-book-renderer.js')) as {
      buildBookRenderer: (options: { outDir: string }) => {
        outDir: string
        manifest: typeof artifactManifest & { entrypoint: string }
      }
    }
    const artifact = buildBookRenderer({ outDir: path.join(scratch, 'artifact') })
    artifactManifest = artifact.manifest
    runWorker = (nativeRequire(path.join(artifact.outDir, artifact.manifest.entrypoint)) as { runWorker: WorkerRun }).runWorker
  }, 30_000)

  afterAll(async () => {
    if (scratch) await rm(scratch, { recursive: true, force: true })
  })

  it('publishes a pinned artifact with a closed dependency graph and reproducible file checksums', async () => {
    expect(artifactManifest.renderer_version).toBe(BOOK_RENDERER_VERSION)
    expect((artifactManifest as typeof artifactManifest & { prepared_source_schema_version: number }).prepared_source_schema_version).toBe(3)
    expect(artifactManifest.files.some((file) => file.path.includes('ContentParser'))).toBe(true)
    expect(artifactManifest.files.some((file) => file.path.includes('EnhancedPdfGeneratorBase'))).toBe(true)
    for (const file of artifactManifest.files) {
      expect(file.path).not.toMatch(/^(?:components|hooks|app|context|stores)\//)
      expect(file.path).not.toMatch(/\.web\.js$/)
      const bytes = await readFile(path.join(scratch, 'artifact', file.path))
      expect(bytes.length).toBe(file.size_bytes)
      expect(sha256(bytes)).toBe(file.sha256)
    }
  })

  it('renders a prepared page from independently pinned plan keys and records a bounded receipt', async () => {
    const fixture = await buildSnapshotFixture(path.join(scratch, 'prepared-input'), {
      travels: [{ id: 23, title: 'Prepared chapter', description: '<p>Source</p>' }],
    })
    const planRoot = path.join(scratch, 'prepared-plan')
    await mkdir(planRoot)
    const source = { page: { type: 'content', travel: { id: 23, name: 'Prepared chapter' }, field: 'description',
      html: '<p>Prepared source</p>', first: false, last: false, qr: '' }, blocks: ['23:description:0'], occurrences: [] }
    const bytes = fixtureCanonicalJson(source)
    await writeFile(path.join(planRoot, 'page.json'), bytes)
    const { renderPreparedPage } = nativeRequire(path.join(scratch, 'artifact', 'workers/book-renderer/index.js')) as {
      renderPreparedPage: (jobRoot: string, planRoot: string, out: string, pinned: BookDocument, request: PreparedPageRequest,
        options: { measure: (html: string) => Promise<{ pages: number; fits: boolean }> }) => Promise<PreparedPageReceipt>
    }
    const request: PreparedPageRequest = { segment_ref: 'page.json', snapshot_hash: fixture.document.snapshot_hash,
      source_checksum: sha256(bytes), page_context: { start_page: 900, folio_area_mm: 12 }, expected: { blocks: source.blocks, occurrences: [] } }
    const options = { measure: async () => ({ pages: 1, fits: true }) }
    const receipt = await renderPreparedPage(fixture.jobDir, planRoot, path.join(scratch, 'prepared-output'), fixture.document, request, options)
    expect(receipt.measured).toBe(false)
    expect(receipt.completed).toEqual({ blocks: 1, mediaOccurrences: 0 })
    expect(receipt.source_checksum).toBe(request.source_checksum)
    await expect(renderPreparedPage(fixture.jobDir, planRoot, path.join(scratch, 'prepared-rejected'), fixture.document,
      { ...request, expected: { blocks: ['different-block'], occurrences: [] } }, options)).rejects.toThrow('SEGMENT_PLAN_INTEGRITY_FAILED')
  })

  it('creates independent B1 settings/selection/snapshot hashes and one-based Unicode windows', async () => {
    const text = `<p>${'ёжик 😀 '.repeat(5_000)}</p>`
    const fixture = await buildSnapshotFixture(path.join(scratch, 'unicode-input'), {
      travels: [{ id: 11, title: 'Unicode source', description: text, photos: 2 }],
    })
    expect(sha256(fixtureCanonicalJson(fixture.document.settings))).toBe(fixture.document.settings_hash)
    const digest = createHash('sha256')
    digest.update(fixtureCanonicalJson([2, 1, fixture.document.selection_hash, fixture.document.settings_hash, fixture.document.entitlement]))
    for (const chunk of fixture.manifest) {
      const bytes = await readFile(path.join(fixture.jobDir, chunk.file_ref))
      expect(sha256(bytes)).toBe(chunk.checksum)
      expect(bytes.length).toBe(chunk.size_bytes)
      digest.update(fixtureCanonicalJson([
        chunk.position, chunk.travel_id, chunk.kind, chunk.source_key, chunk.occurrence_key,
        chunk.checksum, chunk.size_bytes, chunk.metadata,
      ]))
    }
    expect(digest.digest('hex')).toBe(fixture.document.snapshot_hash)
    const texts = fixture.manifest.filter((chunk) => chunk.kind === 'text')
    expect(texts.map((chunk) => chunk.metadata.offset)).toEqual(texts.map((_, index) => index * BOOK_SNAPSHOT_TEXT_CHARACTERS + 1))
    expect((await Promise.all(texts.map((chunk) => readFile(path.join(fixture.jobDir, chunk.file_ref), 'utf8')))).join('')).toBe(text)
    expect(fixture.expected.unique_media_hashes).toHaveLength(1)
    expect(new Set(fixture.expected.media_occurrence_keys).size).toBe(fixture.expected.media_occurrence_keys.length)
  })

  it.each(THEMES)('preserves canonical %s theme and full settings in a tiny protocol fixture', async (template) => {
    const fixture = await buildSnapshotFixture(path.join(scratch, `theme-${template}-input`), {
      travels: [{ id: 21, title: 'Template corpus', description: '<h2>Corpus</h2><p>Before <strong>bold</strong> and <a href="https://example.com/source">link</a>.</p>', photos: 1 }],
      settings: { template, includeMap: false, includeToc: false, includeChecklists: true,
        galleryPhotosPerPage: 0, galleryColumns: 4, showCaptions: true, photoPageLayout: 'framed' },
    })
    const outDir = path.join(scratch, `theme-${template}-output`)
    const result = await runWorker(fixture.jobDir, outDir, {
      read_bytes: 257, measure: async () => ({ pages: 1, fits: true }),
    })
    expect(result.measured).toBe(false)
    expect(result.expected).toEqual(result.completed)
    expect(result.settings_hash).toBe(fixture.document.settings_hash)
    const { PDF_THEMES } = nativeRequire(path.join(scratch, 'artifact', 'services/pdf-export/themes/PdfThemeConfig.js')) as {
      PDF_THEMES: Record<PdfThemeName, { colors: { background: string }; typography: { bodyFont: string } }>
    }
    expect(Object.keys(PDF_THEMES).sort()).toEqual([...THEMES].sort())
    const pages = await readRows<{ file_ref: string }>(path.join(outDir, 'plan.ndjson'))
    const html = (await Promise.all(pages.map((page) => readFile(path.join(outDir, page.file_ref), 'utf8')))).join('\n')
    expect(html).toContain(`background: ${PDF_THEMES[template].colors.background}`)
    expect(html).toContain(`font-family: ${PDF_THEMES[template].typography.bodyFont}`)
    expect(html).toContain('Pinned caption 1')
    expect(html).toContain('https://example.com/source')
  })

  it.each(THEMES)('matches legacy canonical tiny page bodies and theme document styles for %s', async (template) => {
    const fixture = await buildSnapshotFixture(path.join(scratch, `parity-${template}-input`), {
      travels: [{ id: 24, title: 'Canonical parity' }],
      settings: { template, includeGallery: true, showCaptions: true, captionPosition: 'bottom', photoPageLayout: 'framed' },
    })
    const { EnhancedPdfGeneratorBase: Base } = nativeRequire(path.join(scratch, 'artifact', 'services/pdf-export/generators/v2/runtime/EnhancedPdfGeneratorBase.js')) as {
      EnhancedPdfGeneratorBase: typeof import('@/services/pdf-export/generators/v2/runtime/EnhancedPdfGeneratorBase').EnhancedPdfGeneratorBase
    }
    const { CanonicalPageRenderer } = nativeRequire(path.join(scratch, 'artifact', 'services/pdf-export/segments/CanonicalPageRenderer.js')) as {
      CanonicalPageRenderer: typeof import('@/services/pdf-export/segments/CanonicalPageRenderer').CanonicalPageRenderer
    }
    const { generateSharedCoverPageMarkup } = nativeRequire(path.join(scratch, 'artifact', 'services/pdf-export/generators/v2/runtime/coverPage.js')) as typeof import('@/services/pdf-export/generators/v2/runtime/coverPage')
    class LegacyPages extends Base {
      async prepare(settings: BookSettings): Promise<void> {
        this.currentSettings = settings
        this.initRenderers()
        await this.ensureParser()
        await this.ensureBlockRenderer()
      }
      document(markup: string): string { return this.buildHtmlDocument([markup], this.currentSettings!, true) }
      content(travel: TravelForBook): string { return this.renderTravelContentPage(travel, '', 7) }
      photo(travel: TravelForBook): string { return this.renderTravelPhotoPage(travel, 7) }
      map(travel: TravelForBook, points: NormalizedLocation[]): Promise<string> { return this.renderMapPage(travel, points, 7, { startIndex: 0, textPolicy: 'inline' }) }
      cover(data: Parameters<typeof generateSharedCoverPageMarkup>[1]): Promise<string> { return generateSharedCoverPageMarkup(this.theme, data) }
      async description(raw: string): Promise<string> { return (await this.ensureBlockRenderer()).renderRichText(raw, 'description') }
    }
    const legacy = new LegacyPages(template)
    const bounded = new CanonicalPageRenderer(template)
    await legacy.prepare(fixture.document.settings)
    const travel: TravelForBook = { id: 24, name: 'Canonical parity', slug: 'canonical-parity',
      description: '<p>Before <strong>bold</strong> and <a href="https://example.com/source">link</a>.</p>',
      travel_image_url: 'https://book-snapshot.invalid/assets/' + 'a'.repeat(64),
      gallery: [{ id: 91, url: 'https://book-snapshot.invalid/assets/' + 'b'.repeat(64), caption: 'Enabled caption' }],
      plus: '<p>Advantage</p>', minus: '<p>Disadvantage</p>', recommendation: '<p>Recommendation</p>', sourceCounts: { photos: 1, locations: 1 } }
    const points: NormalizedLocation[] = [{ id: '1', address: 'Pinned point', lat: 53.9, lng: 27.56 }]
    const cover = { title: 'Pinned cover', subtitle: 'Subtitle', userName: 'Author', travelCount: 1, generatedAt: fixture.document.generated_at }
    const pairs: Array<{ source: BookSegmentPage; legacy: string }> = [
      { source: { type: 'legacy-content', travel, qr: '' }, legacy: legacy.content(travel) },
      { source: { type: 'photo', travel }, legacy: legacy.photo(travel) },
      { source: { type: 'map', travel, locations: points }, legacy: await legacy.map(travel, points) },
      { source: { type: 'cover', data: cover }, legacy: await legacy.cover(cover) },
    ]
    const descriptionTravel = { ...travel, gallery: undefined, plus: undefined, minus: undefined, recommendation: undefined }
    pairs.push({ source: { type: 'content', travel: descriptionTravel, field: 'description', html: await legacy.description(travel.description!), first: true, last: true, qr: '' },
      legacy: legacy.content(descriptionTravel) })
    for (const pair of pairs) {
      const html = await bounded.renderBoundedPage(pair.source, { start_page: 7, folio_area_mm: 12 }, fixture.document)
      // Only the documented worker print-adapter style is excluded: pinned folio,
      // printable-page sizing and continuation CSS. Canonical body and theme CSS stay exact.
      const canonical = html.replace(/<style>\s*@page \{ @bottom-center[\s\S]*?<\/style>(?=<\/head>)/, '')
      expect(canonical).toBe(legacy.document(pair.legacy))
    }
    await legacy.prepare({ ...fixture.document.settings, includeGallery: false, showCaptions: false, captionPosition: 'none' })
    const hiddenPinned = { ...fixture.document, settings: { ...fixture.document.settings, includeGallery: false, showCaptions: false, captionPosition: 'none' as const } }
    const hiddenHtml = await bounded.renderBoundedPage({ type: 'legacy-content', travel, qr: '' }, { start_page: 7, folio_area_mm: 12 }, hiddenPinned)
    expect(hiddenHtml.replace(/<style>\s*@page \{ @bottom-center[\s\S]*?<\/style>(?=<\/head>)/, '')).toBe(legacy.document(legacy.content(travel)))
  }, 30_000)

  it.each([{ includeGallery: false }, { showCaptions: false }, { captionPosition: 'none' as const }])('rejects a prepared caption page hidden by pinned settings %j', async (settings) => {
    const fixture = await buildSnapshotFixture(path.join(scratch, `caption-guard-${Object.keys(settings)[0]}`), {
      travels: [{ id: 25, title: 'Caption guard' }], settings,
    })
    const { CanonicalPageRenderer } = nativeRequire(path.join(scratch, 'artifact', 'services/pdf-export/segments/CanonicalPageRenderer.js')) as {
      CanonicalPageRenderer: typeof import('@/services/pdf-export/segments/CanonicalPageRenderer').CanonicalPageRenderer
    }
    await expect(new CanonicalPageRenderer(fixture.document.settings.template).renderBoundedPage({ type: 'gallery-caption',
      travel: { id: 25, name: 'Caption guard' }, photo_ordinal: 1, photo_id: 101, html: '<p>Hidden caption</p>' },
    { start_page: 7, folio_area_mm: 12 }, fixture.document)).rejects.toThrow('SEGMENT_CAPTION_SETTINGS_MISMATCH')
  })

  it('keeps full chapter/huge paragraph/table/repeated photo coverage across source read budgets', async () => {
    const fixture = await buildSnapshotFixture(path.join(scratch, 'large-input'), {
      travels: [
        { id: 90, title: 'FIRST_CHAPTER_SENTINEL',
          description: `<p>FIRST_BODY_SENTINEL ${'ёжик 😀 linked value '.repeat(2_500)} LAST_BODY_SENTINEL</p>`
            + `<img src="${SNAPSHOT_FIXTURE_IMAGE_SRC}"><img src="${SNAPSHOT_FIXTURE_IMAGE_SRC}">`,
          plus: '<table><tbody><tr><td>FIRST_CELL_SENTINEL '
            + 'cell value '.repeat(1_800) + ' LAST_CELL_SENTINEL</td></tr></tbody></table>',
          photos: 201 },
        { id: 12, title: 'LAST_CHAPTER_SENTINEL', description: '<p>FINAL_BODY_SENTINEL</p>', photos: 2 },
      ],
      settings: { includeToc: true, includeMap: false, includeChecklists: true },
    })
    const results: WorkerCertificate[] = []
    const plans: Array<Array<Record<string, unknown>>> = []
    const measurements: number[] = []
    for (const readBytes of [17, 65_536]) {
      let measured = 0
      const outDir = path.join(scratch, `large-output-${readBytes}`)
      const result = await runWorker(fixture.jobDir, outDir, {
        read_bytes: readBytes,
        measure: async (html) => {
          measured++
          expect(Buffer.byteLength(html)).toBeLessThanOrEqual(512 * 1024)
          return { pages: 1, fits: true }
        },
      })
      results.push(result)
      plans.push(await readRows<Record<string, unknown>>(path.join(outDir, 'plan.ndjson')))
      measurements.push(measured)
      expect(result.measured).toBe(false)
      expect(result.expected).toEqual(result.completed)
      expect(result.source_media_coverage).toEqual({ expected: fixture.expected.media_occurrence_keys.length, completed: fixture.expected.media_occurrence_keys.length })
      expect(result.expected.travels).toBe(2)
      expect(result.expected.mediaOccurrences).toBeGreaterThanOrEqual(fixture.expected.media_occurrence_keys.length)
      expect(result.expected.pages).toBeGreaterThan(20)
      expect(result.snapshot_hash).toBe(fixture.document.snapshot_hash)
      expect(result.settings_hash).toBe(fixture.document.settings_hash)
      expect(result.renderer_version).toBe(BOOK_RENDERER_VERSION)
      const saved = JSON.parse(await readFile(path.join(outDir, 'certificate.json'), 'utf8')) as WorkerCertificate
      expect(saved).toEqual(result)
      const sourcePlan = await readRows<{ order: number; travel_id: number | string; occurrence_key?: string }>(path.join(outDir, 'sources-plan.ndjson'))
      expect(sourcePlan.map((entry) => entry.order)).toEqual(fixture.manifest.map((chunk) => chunk.position))
      expect(sourcePlan.filter((entry) => entry.occurrence_key).map((entry) => entry.occurrence_key))
        .toEqual(fixture.expected.media_occurrence_keys)
      const bodyRows = await readRows<{ ref: string; travel_id: number }>(path.join(outDir, 'body.ndjson'))
      const fieldText = new Map<string, string>()
      for (const body of bodyRows) {
        const entry = JSON.parse(await readFile(path.join(outDir, body.ref), 'utf8')) as {
          page: { type: string; field?: string; html?: string; travel?: Record<string, unknown> }
        }
        if (entry.page.type === 'content') {
          const key = `${body.travel_id}:${entry.page.field}`
          fieldText.set(key, (fieldText.get(key) ?? '') + sourceText(entry.page.html ?? ''))
        } else if (entry.page.type === 'legacy-content') {
          for (const field of ['description', 'plus', 'minus', 'recommendation']) {
            fieldText.set(`${body.travel_id}:${field}`, sourceText(String(entry.page.travel?.[field] || '')))
          }
        }
      }
      for (const [travelId, fields] of Object.entries(fixture.expected.text_by_field)) {
        for (const [field, html] of Object.entries(fields)) {
          expect(fieldText.get(`${travelId}:${field}`) ?? '').toBe(sourceText(html))
        }
      }
      const pageHtml = await Promise.all(plans.at(-1)!.map((entry) => {
        const ref = String(entry.file_ref)
        return readFile(path.join(outDir, ref), 'utf8')
      }))
      plans.at(-1)!.forEach((entry, index) => {
        if (entry.type === 'gallery' || entry.type === 'content') {
          expect(logicalSnapshotImages(pageHtml[index])).toBe((entry.occurrences as string[]).length)
        }
      })
      const allHtml = pageHtml.join('\n')
      const deliveredSourceText = [...fieldText.values()].join('')
      for (const sentinel of ['FIRST_BODY_SENTINEL', 'LAST_BODY_SENTINEL', 'FIRST_CELL_SENTINEL', 'LAST_CELL_SENTINEL', 'FINAL_BODY_SENTINEL']) {
        expect(deliveredSourceText).toContain(sentinel)
      }
      expect(allHtml).not.toContain('\uFFFD')
      expect(allHtml).not.toContain('src="/media/uploads/')
      expect(allHtml).toContain('Pinned caption 201')
    }
    expect(results[0].expected).toEqual(results[1].expected)
    expect(plans[0]).toEqual(plans[1])
    expect(measurements[0]).toBe(measurements[1])
  }, 90_000)

  it('fails closed on corrupted frozen bytes without publishing a completion certificate', async () => {
    const fixture = await buildSnapshotFixture(path.join(scratch, 'corrupt-input'), {
      travels: [{ id: 17, title: 'Corruption source', description: '<p>Frozen bytes</p>', photos: 1 }],
    })
    const chunk = fixture.manifest.find((entry) => entry.kind === 'text') as BookSnapshotChunk
    const original = await readFile(path.join(fixture.jobDir, chunk.file_ref))
    original[0] ^= 1
    await writeFile(path.join(fixture.jobDir, chunk.file_ref), original)
    const outDir = path.join(scratch, 'corrupt-output')
    await expect(runWorker(fixture.jobDir, outDir, {
      read_bytes: 17, measure: async () => ({ pages: 1, fits: true }),
    })).rejects.toThrow(/SNAPSHOT_INTEGRITY_FAILED/)
    await expect(access(path.join(outDir, 'certificate.json'))).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('reads durable attempt refs and variable Unicode windows including final empty termination', async () => {
    const text = `<p>${'😀 durable '.repeat(300)}</p>`
    const fixture = await buildSnapshotFixture(path.join(scratch, 'durable-input'), {
      travels: [{ id: 49, title: 'Durable source', description: text, plus: 'x'.repeat(512) }], durableTextWindow: 256,
      settings: { includeToc: false, includeGallery: false, includeMap: false },
    })
    expect(fixture.manifest.every(row => row.file_ref.includes('/attempt-1/'))).toBe(true)
    expect(fixture.manifest.some(row => row.kind === 'text' && row.size_bytes === 0 && row.metadata.field_end === true)).toBe(true)
    const result = await runWorker(fixture.jobDir, path.join(scratch, 'durable-output'), {
      read_bytes: 17, measure: async () => ({ pages: 1, fits: true }),
    })
    expect(result.completed).toEqual(result.expected)
  }, 30_000)

  it('adapts physically rejected single fragments and indexes more than 200 route points', async () => {
    const fixture = await buildSnapshotFixture(path.join(scratch, 'adaptive-input'), {
      travels: [{ id: 51, title: 'Adaptive chapter', description: `<p>${'ADAPTIVE_SOURCE '.repeat(200)}</p>`, photos: 3, points: 201 }],
      settings: { includeToc: false, includeMap: true, galleryPhotosPerPage: 0 },
    })
    const out = path.join(scratch, 'adaptive-output')
    const result = await runWorker(fixture.jobDir, out, { read_bytes: 257,
      measure: async html => ({ pages: 1, fits: [...html.matchAll(/ADAPTIVE_SOURCE/g)].length <= 10 }) })
    expect(result.expected).toEqual(result.completed)
    const rows = await readRows<{ ref: string }>(path.join(out, 'body.ndjson'))
    let actual = ''
    let points = 0
    for (const row of rows) {
      const entry = JSON.parse(await readFile(path.join(out, row.ref), 'utf8')) as { page: { type: string; html?: string; locations?: unknown[] } }
      if (entry.page.type === 'content') actual += sourceText(entry.page.html || '')
      if (entry.page.type === 'map') points += entry.page.locations!.length
    }
    expect(actual).toBe('ADAPTIVE_SOURCE '.repeat(200))
    expect(points).toBe(201)
  }, 90_000)

  it.each([false, true])('adapts PDF-budget map portions and preserves full detached route fields (coordinates=%s)', async (showCoordinatesOnMapPage) => {
    const address = 'ROUTE_VALUE 😀界, fourth, fifth · & <literal> '.repeat(900)
    const category = 'CATEGORY_WORD'.repeat(2000)
    const fixture = await buildSnapshotFixture(path.join(scratch, `map-fields-${showCoordinatesOnMapPage}-input`), {
      travels: [{ id: 761, title: 'Map completeness', points: 8, routeThumbnails: true, routeAddresses: [address, 'A, B, C, D · E'], routeCategories: [category] }],
      settings: { includeMap: true, showCoordinatesOnMapPage, includeToc: false, includeGallery: false },
    })
    const out = path.join(scratch, `map-fields-${showCoordinatesOnMapPage}-output`)
    const certificate = await runWorker(fixture.jobDir, out, { read_bytes: 257, measure: async html => {
      const cards = [...html.matchAll(/class="map-location-card"/g)].length
      if (cards > 2) throw new Error('WORKER_SEGMENT_PDF_BUDGET_EXCEEDED')
      return { pages: 1, fits: !(cards && html.includes('ROUTE_VALUE')) && [...html.matchAll(/ROUTE_VALUE/g)].length <= 10 }
    } })
    expect(certificate.expected).toEqual(certificate.completed)
    expect(certificate.source_media_coverage).toEqual({ expected: 9, completed: 9 })
    const fields = new Map<string, string>(), ordinals: number[] = [], placements: string[] = []
    for (const row of await readRows<{ ref: string }>(path.join(out, 'body.ndjson'))) {
      const source = JSON.parse(await readFile(path.join(out, row.ref), 'utf8')) as import('@/services/pdf-export/segments/renderSegment').BookSegmentSource
      placements.push(...source.occurrences)
      if (source.page.type === 'map') {
        expect(source.page.locations.length).toBeLessThanOrEqual(2)
        ordinals.push(...source.page.locations.map((_, index) => source.page.type === 'map' ? source.page.point_start! + index + 1 : 0))
      }
      if (source.page.type === 'map-text') {
        expect(source.source_schema_version).toBe(2)
        expect(source.page.point_ordinal).toBe(1)
        expect(source.page.point_id).toBe('1')
        fields.set(source.page.field, (fields.get(source.page.field) || '') + sourceText(source.page.html))
      }
    }
    expect(ordinals).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
    expect(fields.get('address')).toBe(address)
    expect(fields.get('category')).toBe(category)
    expect(fields.get('coord')).toBe(showCoordinatesOnMapPage ? '53.9,27.56' : undefined)
    expect(new Set(placements).size).toBe(9)
  }, 90_000)

  it.each([undefined, 1, 3, 4])('rejects a prepared map-text envelope with incompatible schema %s before measuring', async source_schema_version => {
    const fixture = await buildSnapshotFixture(path.join(scratch, `map-schema-${source_schema_version}-input`), { travels: [{ id: 1, title: 'Map schema' }], settings: { includeMap: true } })
    const planRoot = path.join(scratch, `map-schema-${source_schema_version}-plan`)
    await mkdir(planRoot)
    const source = { ...(source_schema_version === undefined ? {} : { source_schema_version }), page: { type: 'map-text', travel: { id: 1, name: 'Map' },
      point_id: '16277', point_ordinal: 1, field: 'address', html: '<p>Exact address</p>' }, blocks: ['point:text:address'], occurrences: [] }
    const bytes = fixtureCanonicalJson(source)
    await writeFile(path.join(planRoot, 'page.json'), bytes)
    const { renderPreparedPage } = nativeRequire(path.join(scratch, 'artifact', 'workers/book-renderer/index.js')) as { renderPreparedPage: typeof import('@/workers/book-renderer/portion').renderPreparedPage }
    const measure = jest.fn(async () => ({ pages: 1, fits: true }))
    await expect(renderPreparedPage(fixture.jobDir, planRoot, path.join(scratch, `map-schema-${source_schema_version}-output`), fixture.document,
      { segment_ref: 'page.json', snapshot_hash: fixture.document.snapshot_hash, source_checksum: sha256(bytes), page_context: { start_page: 1, folio_area_mm: 12 }, expected: { blocks: source.blocks, occurrences: [] } }, { measure }))
      .rejects.toThrow(source_schema_version === 3 ? 'SEGMENT_RESOURCE_BINDING_INVALID' : 'SEGMENT_SOURCE_SCHEMA_UNSUPPORTED')
    expect(measure).not.toHaveBeenCalled()
  })

  it.each(['SNAPSHOT_IMAGE_ENCODED_BUDGET_EXCEEDED', 'SNAPSHOT_IMAGE_DECODE_BUDGET_EXCEEDED', 'SNAPSHOT_IMAGE_UNAVAILABLE', 'SNAPSHOT_FONT_UNAVAILABLE', 'WORKER_FONT_INTEGRITY_FAILED', 'SNAPSHOT_MUTABLE_RESOURCE_REQUEST'])('does not turn fatal resource failure %s into adaptive layout', async (failure) => {
    const fixture = await buildSnapshotFixture(path.join(scratch, `fatal-${failure}-input`), { travels: [{ id: 9, title: 'Fatal resource' }] })
    const measure = jest.fn(async () => { throw new Error(failure) })
    await expect(runWorker(fixture.jobDir, path.join(scratch, `fatal-${failure}-output`), { read_bytes: 257, measure })).rejects.toThrow(failure)
    expect(measure).toHaveBeenCalledTimes(1)
  })

  it.each(['polaroid', 'collage'] as const)('preserves rejected %s captions across caption-only pages and keeps each photo once', async (galleryLayout) => {
    const caption = 'CAPTION_WORD '.repeat(38) + 'abcdef'
    expect(caption.length).toBe(500)
    const fixture = await buildSnapshotFixture(path.join(scratch, `captions-${galleryLayout}-input`), {
      travels: [{ id: 66, title: 'Caption chapter', photos: 3, captions: [caption, caption, caption] }],
      settings: { galleryLayout, galleryColumns: 4, galleryPhotosPerPage: 0, showCaptions: true, captionPosition: 'bottom', includeToc: false, includeMap: false },
    })
    const out = path.join(scratch, `captions-${galleryLayout}-output`)
    const certificate = await runWorker(fixture.jobDir, out, { read_bytes: 257, measure: async html => {
      const gallery = /class="pdf-page gallery-page"/.test(html)
      const continuation = /class="book-gallery-caption-text"/.test(html)
      return { pages: 1, fits: !(gallery && html.includes('CAPTION_WORD')) &&
        !(continuation && [...html.matchAll(/CAPTION_WORD/g)].length > 10) }
    } })
    expect(certificate.completed).toEqual(certificate.expected)
    expect(certificate.source_media_coverage.expected).toBe(4)
    expect(certificate.source_media_coverage.completed).toBe(4)
    const captions = new Map<number, string>()
    const occurrences: string[] = []
    for (const row of await readRows<{ ref: string }>(path.join(out, 'body.ndjson'))) {
      const source = JSON.parse(await readFile(path.join(out, row.ref), 'utf8')) as {
        page: { type: string; photo_ordinal?: number; html?: string; start_index?: number; caption_policy?: string }; occurrences: string[] }
      if (source.page.type === 'gallery-caption') {
        const ordinal = source.page.photo_ordinal!
        captions.set(ordinal, (captions.get(ordinal) || '') + sourceText(source.page.html || ''))
        expect(source.occurrences).toEqual([])
      }
      if (source.page.type === 'gallery') {
        expect(source.page.caption_policy).toBe('detached')
        occurrences.push(...source.occurrences)
      }
    }
    expect([...captions.keys()]).toEqual([1, 2, 3])
    expect([...captions.values()]).toEqual([caption, caption, caption])
    expect(occurrences).toEqual(fixture.expected.media_occurrence_keys.filter(key => key.includes(':gallery:')))
  }, 30_000)

  it.each(['settings', 'manifest'] as const)('rejects altered pinned %s without a completion certificate', async (target) => {
    const fixture = await buildSnapshotFixture(path.join(scratch, `altered-${target}-input`), {
      travels: [{ id: 18, title: 'Pinned source title', description: '<p>Pinned source content</p>' }],
    })
    if (target === 'settings') {
      await writeFile(path.join(fixture.jobDir, 'document.json'), fixtureCanonicalJson({
        ...fixture.document, settings: { ...fixture.document.settings, subtitle: 'Altered after snapshot' },
      }))
    } else {
      const rows = fixture.manifest.map((chunk) => chunk.kind === 'travel'
        ? { ...chunk, metadata: { ...chunk.metadata, name: 'Altered after snapshot' } } : chunk)
      await writeFile(path.join(fixture.jobDir, 'manifest.ndjson'), rows.map((row) => `${fixtureCanonicalJson(row)}\n`).join(''))
    }
    const outDir = path.join(scratch, `altered-${target}-output`)
    await expect(runWorker(fixture.jobDir, outDir, {
      read_bytes: 17, measure: async () => ({ pages: 1, fits: true }),
    })).rejects.toThrow(target === 'settings' ? 'SNAPSHOT_SETTINGS_HASH_MISMATCH' : 'SNAPSHOT_MANIFEST_HASH_MISMATCH')
    await expect(access(path.join(outDir, 'certificate.json'))).rejects.toMatchObject({ code: 'ENOENT' })
  })
})
