/** @jest-environment node */
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { buildSnapshotFixture, SNAPSHOT_FIXTURE_IMAGE_SRC, type SnapshotFixtureOptions } from '@/__tests__/fixtures/pdfBook/buildSnapshotFixture'
import { advanceBookPlanning, enqueueBookPage } from '@/workers/book-renderer/planningBody'
import { initialBookPlanning, restoreBookPlanning, type BookPlanningState, type BookPlanningPorts, type PlannedPageRecord } from '@/workers/book-renderer/planningBookTypes'
import { preparePlanningStep } from '@/workers/book-renderer/planningStep'
import { PlanningStorage, readPlanningFile } from '@/workers/book-renderer/planningStorage'
import { createDiskCheckpointStores } from '@/workers/book-renderer/htmlCheckpoint/diskStores'
import { DEFAULT_RENDERER_RESOURCE_PROFILE, probeFrozenImage, type RendererResourceProfile } from '@/workers/book-renderer/measurement'
import type { BookSegmentSource } from '@/services/pdf-export/segments/renderSegment'
import type { PlanningCheckpoint, PlanningFile } from '@/workers/book-renderer/planningTypes'
import { indexSnapshot } from '@/workers/book-renderer/snapshot'
import { planBody, frontmatter, type BodyRecord } from '@/workers/book-renderer/planner'
import { canonicalJson, jsonLines } from '@/workers/book-renderer/filesystem'
import { mockWorkerDurability } from '../../helpers/mockWorkerDurability'

// Mirror the worker artifact alias (scripts/build-book-renderer.js): a frozen job has no tile network.
jest.mock('@/utils/mapImageGenerator', () => jest.requireActual('@/workers/book-renderer/mapImageGenerator'))

const LIMITS = { input_bytes: 255, output_bytes: 4_194_304, output_records: 24, probes: 1 }
const HASHES = { resource_bindings_hash: 'a'.repeat(64), resource_policy_hash: 'b'.repeat(64), encoder_identity_hash: 'c'.repeat(64) }
const prepared = (html: string) => ({ html, resource_bindings: [], ...HASHES })

describe('restartable canonical body and frontmatter planning', () => {
  let scratch: string
  beforeEach(async () => {
    mockWorkerDurability()
    const root = path.resolve(__dirname, '../../../.codex-temp/tests')
    await mkdir(root, { recursive: true }); scratch = await mkdtemp(path.join(root, 'book-planning-resume-'))
  })
  afterEach(async () => { jest.restoreAllMocks(); await rm(scratch, { recursive: true, force: true }) })

  async function fixture(options: SnapshotFixtureOptions) {
    const input = await buildSnapshotFixture(path.join(scratch, 'input'), options)
    const out = path.join(scratch, 'bounded')
    const committed = new Map<string, PlanningFile>()
    let checkpoint: PlanningFile | undefined; let generation = 0
    while (true) {
      const result = await preparePlanningStep(input.jobDir, out, input.document, { renderer_content_hash: 'd'.repeat(64), generation: ++generation, checkpoint },
        { committed: async ref => committed.get(ref) ?? null })
      for (const file of result.outputs) committed.set(file.ref, file)
      checkpoint = result.checkpoint
      if (result.phase === 'indexed') break
      expect(generation).toBeLessThan(10_000)
    }
    const indexed = JSON.parse(await readFile(path.join(out, checkpoint.ref), 'utf8')) as PlanningCheckpoint
    return { input, out, summary: indexed.index.summary, committed }
  }

  async function run(options: SnapshotFixtureOptions, forceSmallFailure = false, profile: RendererResourceProfile = DEFAULT_RENDERER_RESOURCE_PROFILE, inputBytes = 255, maxTocEntries = 7) {
    const f = await fixture(options)
    let state = initialBookPlanning(); let steps = 0; let physicalProbes = 0; let assetReadBytes = 0; let imageReads = 0
    while (state.phase !== 'done') {
      const storage = new PlanningStorage(f.out, LIMITS, async ref => f.committed.get(ref) ?? null)
      storage.reserve(2, 1_100_000)
      let probes = 0
      const ports: BookPlanningPorts = {
        anchor_receipt: ref => f.committed.get(ref) ?? null,
        read: async (file, maximum) => JSON.parse((await readPlanningFile(f.out, file, maximum)).toString('utf8')) as unknown,
        put: (ref, value, maximum) => storage.put(ref, value, maximum), admit: (records, bytes) => storage.admit(records, bytes),
        parserStores(scope) {
          const directory = path.join(f.out, scope); mkdirSync(directory, { recursive: true, mode: 0o700 })
          return createDiskCheckpointStores(directory, { onwrite: receipt => storage.recordExternalReceipt({ ...receipt, ref: `${scope}/${receipt.ref}` }) })
        },
        parserReadStores(scope) { return createDiskCheckpointStores(path.join(f.out, scope), { readonly: true }) },
        resource_profile: profile,
        async imageDimensions(chunk) {
          imageReads++
          return { ...await probeFrozenImage(f.input.jobDir, chunk, profile, 5), read_bytes: chunk.size_bytes * 2 }
        },
        async probe(source) {
          probes++
          return { source: { ...source, source_schema_version: 5, resource_bindings: [], ...HASHES },
            measurement: { pages: 1, fits: !(forceSmallFailure && source.page.type === 'legacy-content') && !(source.page.type === 'toc' && source.page.entries.length > maxTocEntries) } }
        },
      }
      const next = await advanceBookPlanning(f.input.jobDir, storage, f.input.document, f.summary,
        JSON.parse(JSON.stringify(state)) as BookPlanningState, { ...LIMITS, input_bytes: inputBytes }, ports)
      expect(next.probes).toBe(probes); expect(probes).toBeLessThanOrEqual(1)
      expect(next.consumed_bytes).toBeLessThanOrEqual(inputBytes)
      expect(storage.outputs.length).toBeLessThanOrEqual(22)
      expect(Buffer.byteLength(canonicalJson(next.state))).toBeLessThan(24_000)
      physicalProbes += probes; assetReadBytes += next.consumed_asset_bytes
      state = JSON.parse(JSON.stringify(next.state)) as BookPlanningState
      for (const file of storage.outputs) f.committed.set(file.ref, file)
      expect(++steps).toBeLessThan(60_000)
    }
    const body: BookSegmentSource[] = []; const front: BookSegmentSource[] = []
    for (const [lane, total, output] of [['body', state.counts.pages, body], ['frontmatter', state.counts.frontmatter_pages, front]] as const) {
      for (let ordinal = 0; ordinal < total; ordinal++) {
        const record = JSON.parse(await readFile(path.join(f.out, 'book', lane, `${ordinal}.json`), 'utf8')) as PlannedPageRecord
        expect(record.ordinal).toBe(ordinal)
        output.push(JSON.parse((await readPlanningFile(f.out, record.source, 524_288)).toString('utf8')) as BookSegmentSource)
      }
    }
    return { ...f, state, body, front, steps, physicalProbes, imageReads, assetReadBytes }
  }

  const semantics = (source: BookSegmentSource) => ({ page: source.page, blocks: source.blocks, occurrences: source.occurrences })
  it('matches the legacy ordered pages, every occurrence, atlas grouping and absolute TOC offsets after every-call JSON restart', async () => {
    const options: SnapshotFixtureOptions = { travels: [
      { id: 41, title: 'First 😀', description: '<p>Raw chapter</p>', plus: '<p>Plus</p>', photos: 15, points: 7, routeThumbnails: true },
      { id: 42, title: 'Second', description: '<p>Another</p>', photos: 2, points: 2 },
      { id: 43, title: 'Third', description: '', cover: false },
    ], settings: { includeToc: true, includeGallery: true, includeMap: true, galleryPhotosPerPage: 14, includeChecklists: true, checklistSections: ['documents'] }, durableTextWindow: 17 }
    const actual = await run(options)
    const old = path.join(scratch, 'legacy')
    await mkdir(path.join(old, 'expected-occurrences'), { recursive: true, mode: 0o700 })
    const summary = await indexSnapshot(actual.input.jobDir, old, actual.input.document)
    const body = await planBody(actual.input.jobDir, old, actual.input.document, summary, async () => ({ pages: 1, fits: true }), 255,
      DEFAULT_RENDERER_RESOURCE_PROFILE, async html => prepared(html), () => undefined)
    const expectedBody: BookSegmentSource[] = []
    for await (const row of jsonLines<BodyRecord>(path.join(old, 'body.ndjson'))) expectedBody.push(JSON.parse(await readFile(path.join(old, row.ref), 'utf8')) as BookSegmentSource)
    const expectedFront: BookSegmentSource[] = []
    for await (const source of frontmatter(old, actual.input.document, summary, body)) expectedFront.push(source)
    expect(actual.body.map(semantics)).toEqual(expectedBody.map(semantics))
    expect(actual.front.map(semantics)).toEqual(expectedFront.map(semantics))
    expect(actual.state.counts.pages).toBe(body.pages)
    expect(actual.state.counts.atlas_pages).toBe(6)
    expect(actual.body.filter(source => source.page.type === 'separator')).toHaveLength(2)
    expect(actual.body.filter(source => source.page.type === 'gallery').map(source => source.page.type === 'gallery' && source.page.travel.gallery?.length)).toEqual([14, 1, 2])
    expect(actual.body.filter(source => source.page.type === 'map').map(source => source.page.type === 'map' && source.page.locations.length)).toEqual([6, 1, 2])
    expect(actual.state.counts.blocks).toBe([...actual.front, ...actual.body].reduce((sum, source) => sum + source.blocks.length, 0))
    expect(actual.state.counts.occurrences).toBe([...actual.front, ...actual.body].reduce((sum, source) => sum + source.occurrences.length, 0))
    // All placements share frozen bytes, but source-order occurrence identities stay distinct.
    expect(actual.imageReads).toBe(1)
    expect(actual.assetReadBytes).toBe(actual.input.manifest.find(chunk => chunk.kind === 'media')!.size_bytes * 2)
  }, 120_000)

  it.each([
    ['raw fit', '<p>Raw &amp; 😀</p>', false, 'legacy-content'],
    ['physical legacy overflow', '<p>Still below raw threshold</p>', true, 'content'],
    ['aggregate over 8192 UTF16', '<p>' + '😀'.repeat(4097) + '</p>', false, 'content'],
    ['table preservation', '<table><tr><td>Cell</td></tr></table>', false, 'content'],
    ['inline placement preservation', `<p><img src="${SNAPSHOT_FIXTURE_IMAGE_SRC}"></p>`, false, 'content'],
  ])('keeps the canonical small-content branch: %s', async (_label, description, fail, expected) => {
    const actual = await run({ travels: [{ id: 51, title: 'Branches', description }], durableTextWindow: 31,
      settings: { includeToc: false, includeMap: false, includeGallery: false } }, fail)
    expect(actual.body[1].page.type).toBe(expected)
    expect(actual.front.map(source => source.page.type)).toEqual(['cover'])
    expect(actual.body.flatMap(source => source.blocks).filter(block => block === '51:online')).toHaveLength(1)
    if (description.includes('<img')) {
      const expectedInline = actual.input.manifest.filter(chunk => chunk.kind === 'media' && chunk.metadata.role === 'inline').map(chunk => chunk.occurrence_key)
      expect(actual.body.flatMap(source => source.occurrences).filter(key => key.includes(':inline:'))).toEqual(expectedInline)
    }
  }, 120_000)

  it('uses the frozen profile for gallery pixel grouping and reads one category per transition', async () => {
    const profile = { ...DEFAULT_RENDERER_RESOURCE_PROFILE, decoded_portion_pixels: 1 }
    const actual = await run({ travels: [{ id: 61, title: 'Profile', photos: 3, points: 1, routeCategories: ['One'] }],
      settings: { includeMap: true, galleryPhotosPerPage: 14 } }, false, profile)
    expect(actual.body.filter(source => source.page.type === 'gallery')).toHaveLength(3)
    const map = actual.body.find(source => source.page.type === 'map')!
    expect(map.page.type === 'map' && map.page.locations[0].categoryName).toBe('One')
    expect(actual.imageReads).toBe(1)
  })

  it('computes offsets only after physical TOC subdivision and retains all chapters in order', async () => {
    const actual = await run({ travels: Array.from({ length: 9 }, (_, ordinal) => ({ id: 80 + ordinal, title: `Chapter ${ordinal + 1}`, cover: false })),
      settings: { includeToc: true, includeGallery: false, includeMap: false } }, false, DEFAULT_RENDERER_RESOURCE_PROFILE, 255, 3)
    const toc = actual.front.filter(source => source.page.type === 'toc')
    expect(actual.state.counts.toc_pages).toBe(4)
    expect(toc.flatMap(source => source.page.type === 'toc' ? source.page.entries.map(entry => entry.travel.id) : [])).toEqual(Array.from({ length: 9 }, (_, ordinal) => 80 + ordinal))
    const offset = 1 + actual.state.counts.toc_pages
    for (let ordinal = 0; ordinal < actual.state.chapters; ordinal++) {
      const chapter = JSON.parse(await readFile(path.join(actual.out, 'book/chapters', `${ordinal}.json`), 'utf8')) as { travel_id: number; start: number }
      const entry = toc.flatMap(source => source.page.type === 'toc' ? source.page.entries : []).find(item => item.travel.id === chapter.travel_id)!
      expect(entry.startPage).toBe(offset + chapter.start + 1)
    }
    expect(actual.state.counts.frontmatter_pages).toBe(offset)
  })

  it('retains forward heading anchors, table continuation and inline ordering with one-byte original feeds', async () => {
    const description = `<p><a href="#later">Jump</a>😀</p><table><tr><td>${'ячейка &amp; '.repeat(70)}</td><td>Next</td></tr></table><h2>Later</h2><p><img src="${SNAPSHOT_FIXTURE_IMAGE_SRC}"></p>`
    const actual = await run({ travels: [{ id: 65, title: 'Two real passes', description }], durableTextWindow: 31,
      settings: { includeMap: false, includeGallery: false, includeToc: false } }, false, DEFAULT_RENDERER_RESOURCE_PROFILE, 1)
    const old = path.join(scratch, 'legacy-anchors')
    await mkdir(path.join(old, 'expected-occurrences'), { recursive: true, mode: 0o700 })
    const summary = await indexSnapshot(actual.input.jobDir, old, actual.input.document)
    await planBody(actual.input.jobDir, old, actual.input.document, summary, async () => ({ pages: 1, fits: true }), 1,
      DEFAULT_RENDERER_RESOURCE_PROFILE, async html => prepared(html), () => undefined)
    const expected: BookSegmentSource[] = []
    for await (const row of jsonLines<BodyRecord>(path.join(old, 'body.ndjson'))) expected.push(JSON.parse(await readFile(path.join(old, row.ref), 'utf8')) as BookSegmentSource)
    expect(actual.body.map(semantics)).toEqual(expected.map(semantics))
    const anchorSeal = JSON.parse(await readFile(path.join(actual.out, 'fields/65/description/anchors/complete.json'), 'utf8')) as { anchors: number; fragments: number }
    expect(anchorSeal.anchors).toBe(1)
    expect(anchorSeal.fragments).toBeGreaterThan(1)
    expect(actual.body.flatMap(source => source.occurrences).filter(key => key.includes(':inline:'))).toEqual(actual.input.manifest
      .filter(chunk => chunk.kind === 'media' && chunk.metadata.role === 'inline').map(chunk => chunk.occurrence_key))
  }, 120_000)

  it('rejects foreign lanes, missing stage metadata, swapped metadata refs and unknown counter fields', async () => {
    const f = await fixture({ travels: [{ id: 71, title: 'Checkpoint' }] })
    const base = initialBookPlanning()
    expect(() => restoreBookPlanning({ ...base, counts: { ...base.counts, pages: undefined, forged: 0 } } as unknown as BookPlanningState, f.summary)).toThrow('WORKER_BOOK_CHECKPOINT_INVALID')
    const travel = { id: 71, start: 0, stage: 'photo' as const, gallery_row: 0, gallery_media: 0, gallery_count: 0, route: 0, route_media: 0 }
    expect(() => restoreBookPlanning({ ...base, travel }, f.summary)).toThrow('WORKER_BOOK_CHECKPOINT_INVALID')
    expect(() => restoreBookPlanning({ ...base, travel: { ...travel, metadata: { ref: 'metadata/72.json', checksum: 'a'.repeat(64), size_bytes: 2 } } }, f.summary)).toThrow('WORKER_BOOK_CHECKPOINT_INVALID')
  })

  it('rejects insufficient queue-plus-acceptance capacity before layout or publication and preserves the checkpoint', async () => {
    const f = await fixture({ travels: [{ id: 75, title: 'Admission' }] })
    const state = initialBookPlanning()
    const setup = new PlanningStorage(f.out, LIMITS)
    await enqueueBookPage(setup, state, { page: { type: 'checklists' }, blocks: ['book:checklists'], occurrences: [] }, 0, 'body')
    for (const file of setup.outputs) f.committed.set(file.ref, file)
    const before = canonicalJson(state)
    const storage = new PlanningStorage(f.out, { ...LIMITS, output_records: 4 }, async ref => f.committed.get(ref) ?? null)
    storage.reserve(2, 1_100_000)
    const probe = jest.fn(async (source: BookSegmentSource) => ({ source, measurement: { pages: 1, fits: true } }))
    const ports: BookPlanningPorts = {
      resource_profile: DEFAULT_RENDERER_RESOURCE_PROFILE,
      imageDimensions: async () => { throw new Error('UNEXPECTED_IMAGE_PROBE') },
      read: async (file, maximum) => JSON.parse((await readPlanningFile(f.out, file, maximum)).toString('utf8')) as unknown,
      anchor_receipt: ref => f.committed.get(ref) ?? null,
      put: (ref, value, maximum) => storage.put(ref, value, maximum), admit: (records, bytes) => storage.admit(records, bytes),
      parserReadStores: () => { throw new Error('UNEXPECTED_PARSER_READ') }, parserStores: () => { throw new Error('UNEXPECTED_PARSER_WRITE') }, probe,
    }
    await expect(advanceBookPlanning(f.input.jobDir, storage, f.input.document, f.summary, state, LIMITS, ports)).rejects.toThrow('WORKER_PLANNING_OUTPUT_BUDGET_EXCEEDED')
    expect(probe).not.toHaveBeenCalled(); expect(storage.outputs).toEqual([]); expect(canonicalJson(state)).toBe(before)
  })
})
