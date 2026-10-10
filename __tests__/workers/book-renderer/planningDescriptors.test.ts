/** @jest-environment node */
import { mkdir, mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import path from 'node:path'
import { buildSnapshotFixture } from '../../fixtures/pdfBook/buildSnapshotFixture'
import { advanceDescriptors, initialDescriptors, restoreDescriptors, type DescriptorState, type PlanningDescriptor } from '@/workers/book-renderer/planningDescriptors'
import { initialBookPlanning, type BookPlanningState } from '@/workers/book-renderer/planningBookTypes'
import { PlanningStorage, readPlanningFile } from '@/workers/book-renderer/planningStorage'
import type { PageQueuePorts } from '@/workers/book-renderer/planningPageQueue'
import type { BookSegmentSource } from '@/services/pdf-export/segments/renderSegment'
import type { PlanningFile } from '@/workers/book-renderer/planningTypes'
import { sha256 } from '@/workers/book-renderer/filesystem'

const LIMITS = { input_bytes: 256, output_bytes: 4_194_304, output_records: 24, probes: 1 }
const IDENTITY = { identity: 'd'.repeat(64), renderer_content_hash: 'e'.repeat(64), resource_profile_hash: 'f'.repeat(64), measured: false, planning_protocol_version: 2 as const }
const freeze = (source: BookSegmentSource): BookSegmentSource => ({ ...source, source_schema_version: 5, resource_bindings: [],
  resource_bindings_hash: 'a'.repeat(64), resource_policy_hash: 'b'.repeat(64), encoder_identity_hash: 'c'.repeat(64) })

describe('final descriptors and original-occurrence coverage', () => {
  let root: string
  beforeEach(async () => {
    const base = path.resolve(__dirname, '../../../.codex-temp/tests'); await mkdir(base, { recursive: true })
    root = await mkdtemp(path.join(base, 'planning-descriptors-'))
  })
  afterEach(async () => { await rm(root, { recursive: true, force: true }) })

  async function seed(bodyOverride?: BookSegmentSource, expectedKey = 'original-image') {
    const fixture = await buildSnapshotFixture(path.join(root, 'input'), { travels: [{ id: 81, title: 'Descriptor fixture', cover: false }] })
    const plan = path.join(root, 'plan'); await mkdir(plan, { mode: 0o700 })
    const committed = new Map<string, PlanningFile>()
    const storage = new PlanningStorage(plan, LIMITS)
    const sources: BookSegmentSource[] = [
      { page: { type: 'checklists' }, blocks: ['front-cover'], occurrences: ['derived-cover'] },
      bodyOverride ?? { page: { type: 'content', travel: { id: 81, name: 'Body' }, field: 'description', html: '<p>Body</p>', first: true, last: true, qr: '' }, blocks: ['body-text'], occurrences: ['original-image'] },
      { page: { type: 'checklists' }, blocks: ['body-end'], occurrences: [] },
    ]
    for (let index = 0; index < sources.length; index++) {
      const source = await storage.put(`book/sources/${index}.json`, freeze(sources[index]))
      await storage.put(`book/${index === 0 ? 'frontmatter' : 'body'}/${index === 0 ? 0 : index - 1}.json`, { source, travel_id: index === 0 ? 0 : 81, ordinal: index === 0 ? 0 : index - 1 })
    }
    await storage.put('index/occurrences/0.json', { key: expectedKey, position: 1 })
    const seal = await storage.put('book/complete.json', { version: 1 })
    for (const file of storage.outputs) committed.set(file.ref, file)
    const book: BookPlanningState = { ...initialBookPlanning(), phase: 'done', body_tail: 'done', body_seal: seal, toc_seal: seal, frontmatter_seal: seal,
      counts: { pages: 2, frontmatter_pages: 1, toc_pages: 0, atlas_pages: 0,
        blocks: sources.reduce((n, source) => n + source.blocks.length, 0), occurrences: sources.reduce((n, source) => n + source.occurrences.length, 0) } }
    return { plan, book, committed, document: fixture.document }
  }

  function ports(storage: PlanningStorage, contexts: number[], mode: 'fit' | 'overflow' | 'mutate' = 'fit'): PageQueuePorts {
    return { read: async (file, max) => JSON.parse((await readPlanningFile(storage.root, file, max)).toString('utf8')) as unknown,
      put: (ref, value, max) => storage.put(ref, value, max), admit: (records, bytes) => storage.admit(records, bytes),
      parserStores: () => { throw new Error('Descriptors never parse HTML') }, parserReadStores: () => { throw new Error('Descriptors never parse HTML') },
      probe: async (source, context) => {
        contexts.push(context.start_page); expect(context.folio_area_mm).toBe(12)
        return { source: mode === 'mutate' ? freeze({ ...source, occurrences: [] }) : freeze(source),
          measurement: { pages: mode === 'overflow' ? 2 : 1, fits: mode !== 'overflow' } }
      } }
  }

  async function finish(f: Awaited<ReturnType<typeof seed>>) {
    const contexts: number[] = []; let state = initialDescriptors()
    for (let step = 0; state.phase !== 'done'; step++) {
      expect(step).toBeLessThan(100)
      const storage = new PlanningStorage(f.plan, LIMITS, async ref => f.committed.get(ref) ?? null)
      const previous = JSON.stringify(state); const probesBefore = contexts.length
      const result = await advanceDescriptors(storage, f.document, f.book, 1, state, ports(storage, contexts), IDENTITY)
      expect(JSON.stringify(state)).toBe(previous)
      expect(result.probes).toBe(contexts.length - probesBefore)
      expect(result.probes).toBeLessThanOrEqual(1)
      expect(storage.outputs.length).toBeLessThanOrEqual(3)
      for (const file of storage.outputs) f.committed.set(file.ref, file)
      state = restoreDescriptors(JSON.parse(JSON.stringify(result.state)) as DescriptorState, f.book, 1)
    }
    return { state, contexts }
  }

  it('freezes exact absolute folios in frontmatter/body order and seals counted original coverage', async () => {
    const f = await seed(); const { state, contexts } = await finish(f)
    expect(contexts).toEqual([1, 2, 3])
    const descriptors: PlanningDescriptor[] = []
    for (let order = 0; order < 3; order++) descriptors.push(JSON.parse(await readFile(path.join(f.plan, `descriptors/${order}.json`), 'utf8')) as PlanningDescriptor)
    expect(descriptors.map(row => [row.order, row.travel_id, row.type, row.page_context.start_page])).toEqual([
      [0, 0, 'checklists', 1], [1, 81, 'content', 2], [2, 81, 'checklists', 3],
    ])
    expect(descriptors.flatMap(row => row.blocks)).toEqual(['front-cover', 'body-text', 'body-end'])
    expect(descriptors.flatMap(row => row.occurrences)).toEqual(['derived-cover', 'original-image'])
    expect(JSON.parse((await readPlanningFile(f.plan, state.summary!, 65_536)).toString('utf8'))).toMatchObject({
      pages: 3, blocks: 3, occurrences: 2, included_media_occurrences: 1, measured: false, source_schema_version: 5, ...IDENTITY,
    })
  })

  it('rejects a missing original occurrence even when all accepted descriptor counts balance', async () => {
    const f = await seed(undefined, 'missing-original')
    await expect(finish(f)).rejects.toThrow('WORKER_SOURCE_MEDIA_COVERAGE_MISMATCH')
    expect(await readdir(f.plan)).not.toContain('plan-summary.json')
  })

  it('rejects the same placement identity on two pages rather than merely matching totals', async () => {
    const f = await seed({ page: { type: 'checklists' }, blocks: ['body-text'], occurrences: ['derived-cover'] })
    await expect(finish(f)).rejects.toThrow('WORKER_COVERAGE_DUPLICATED')
  })

  it.each(['overflow', 'mutate'] as const)('rejects final-page %s before publishing a descriptor', async mode => {
    const f = await seed(); const storage = new PlanningStorage(f.plan, LIMITS, async ref => f.committed.get(ref) ?? null)
    await expect(advanceDescriptors(storage, f.document, f.book, 1, initialDescriptors(), ports(storage, [], mode), IDENTITY)).rejects.toThrow('WORKER_FINAL_PAGE_GEOMETRY_MISMATCH')
    expect(storage.outputs).toEqual([])
  })

  it('ignores an uncommitted future coverage record and retries the exact placement bytes', async () => {
    const f = await seed()
    const unpublished = new PlanningStorage(f.plan, LIMITS)
    await unpublished.put(`coverage/occurrences/${sha256('original-image')}.json`, { key: 'original-image', order: 1 })
    expect(f.committed.has(unpublished.outputs[0].ref)).toBe(false)
    expect((await finish(f)).state.source_occurrences).toBe(1)
  })

  it('rejects forged descriptor count, lane completion and pending receipt envelopes', async () => {
    const f = await seed(); const base = initialDescriptors()
    for (const forged of [ { ...base, blocks: 4 }, { ...base, phase: 'done', summary: { ref: 'plan-summary.json', checksum: 'a'.repeat(64), size_bytes: 1 } },
      { ...base, phase: 'coverage', pending: { ref: 'descriptors/1.json', checksum: 'a'.repeat(64), size_bytes: 1 } } ]) {
      expect(() => restoreDescriptors(forged as DescriptorState, f.book, 1)).toThrow('WORKER_DESCRIPTOR_CHECKPOINT_INVALID')
    }
  })
})
