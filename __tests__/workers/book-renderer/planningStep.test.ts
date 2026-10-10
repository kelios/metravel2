/** @jest-environment node */
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises'
import path from 'node:path'
import { mkdirSync } from 'node:fs'
import { buildSnapshotFixture } from '../../fixtures/pdfBook/buildSnapshotFixture'
import type { BookDocument } from '@/types/bookDocument'
import type { BookSegmentSource } from '@/services/pdf-export/segments/renderSegment'
import { maxPlanningOutputBytes, preparePlanningStep, type PlanningStepOptions } from '@/workers/book-renderer/planningStep'
import { PlanningStorage, readPlanningFile } from '@/workers/book-renderer/planningStorage'
import { readGenerationLedger } from '@/workers/book-renderer/planningLedger'
import type { BookPlanningPorts } from '@/workers/book-renderer/planningBookTypes'
import type { PlanningCheckpoint, PlanningFile, PlanningRequest, PlanningStepResult } from '@/workers/book-renderer/planningTypes'
import type { PlanningDescriptor } from '@/workers/book-renderer/planningDescriptors'
import { createDiskCheckpointStores } from '@/workers/book-renderer/htmlCheckpoint/diskStores'
import { DEFAULT_RENDERER_RESOURCE_PROFILE } from '@/workers/book-renderer/measurement'
import { canonicalJson, sha256 } from '@/workers/book-renderer/filesystem'
import { enqueueBookPage } from '@/workers/book-renderer/planningBody'
import { initialBookPlanning } from '@/workers/book-renderer/planningBookTypes'

const RENDERER = 'a'.repeat(64)
const LIMITS = { input_bytes: 257, output_bytes: 4_194_304, output_records: 24, probes: 1 }
const freeze = (source: BookSegmentSource): BookSegmentSource => ({ ...source, source_schema_version: 5, resource_bindings: [],
  resource_bindings_hash: 'b'.repeat(64), resource_policy_hash: 'c'.repeat(64), encoder_identity_hash: 'd'.repeat(64) })

describe('fenced bounded planning protocol through sealed descriptors', () => {
  let root: string
  beforeEach(async () => {
    const base = path.resolve(__dirname, '../../../.codex-temp/tests'); await mkdir(base, { recursive: true })
    root = await mkdtemp(path.join(base, 'planning-step-'))
  })
  afterEach(async () => { jest.restoreAllMocks(); await rm(root, { recursive: true, force: true }) })

  function options(committed: Map<string, PlanningFile>): PlanningStepOptions {
    return { committed: async ref => committed.get(ref) ?? null, ports_factory: (storage): BookPlanningPorts => ({
      resource_profile: DEFAULT_RENDERER_RESOURCE_PROFILE,
      anchor_receipt: ref => committed.get(ref) ?? null,
      read: async (file, maximum) => JSON.parse((await readPlanningFile(storage.root, file, maximum)).toString('utf8')) as unknown,
      put: (ref, value, maximum) => storage.put(ref, value, maximum), admit: (records, bytes) => storage.admit(records, bytes),
      parserStores: scope => {
        const directory = path.join(storage.root, scope); mkdirSync(directory, { recursive: true, mode: 0o700 })
        return createDiskCheckpointStores(directory, { onwrite: file => storage.recordExternalReceipt({ ...file, ref: `${scope}/${file.ref}` }) })
      },
      parserReadStores: scope => createDiskCheckpointStores(path.join(storage.root, scope), { readonly: true }),
      imageDimensions: async chunk => ({ width: 1, height: 1, aspect: 1, read_bytes: chunk.size_bytes * 2 }),
      // Protocol fixture only: no browser or physical-fit claim.
      probe: async source => ({ source: freeze(source), measurement: { pages: 1, fits: true } }),
    }) }
  }
  function commit(result: PlanningStepResult, receipts: Map<string, PlanningFile>) {
    for (const file of result.outputs) receipts.set(file.ref, JSON.parse(JSON.stringify(file)) as PlanningFile)
  }
  async function setup() {
    const f = await buildSnapshotFixture(path.join(root, 'input'), { travels: [{ id: 91, title: 'Small 😀', description: '<p>Pinned chapter</p>' }],
      settings: { includeToc: false, includeGallery: false, includeMap: false, includeChecklists: false }, durableTextWindow: 17 })
    return { ...f, plan: path.join(root, 'plan'), committed: new Map<string, PlanningFile>() }
  }
  async function step(f: Awaited<ReturnType<typeof setup>>, request: PlanningRequest, document: BookDocument = f.document) {
    const result = await preparePlanningStep(f.jobDir, f.plan, document, request, options(f.committed))
    commit(result, f.committed); return result
  }

  it('restarts every generation, accounts all outputs, and finishes the independent four-page fixture', async () => {
    const f = await setup(); let checkpoint: PlanningFile | undefined; let result: PlanningStepResult | undefined
    const phases = new Set<string>(); let generation = 0
    while (!result || result.phase !== 'plan_ready') {
      result = await step(f, { renderer_content_hash: RENDERER, generation: ++generation, checkpoint, limits: LIMITS })
      phases.add(result.phase)
      expect(result.outputs.length).toBeLessThanOrEqual(LIMITS.output_records)
      expect(result.outputs.reduce((n, file) => n + file.size_bytes, 0)).toBeLessThanOrEqual(LIMITS.output_bytes)
      expect(result.consumed_bytes).toBeLessThanOrEqual(LIMITS.input_bytes)
      expect(result.probes).toBeLessThanOrEqual(1)
      for (const file of result.outputs) {
        const bytes = await readPlanningFile(f.plan, file, LIMITS.output_bytes)
        expect(sha256(bytes)).toBe(file.checksum)
      }
      const state = JSON.parse((await readPlanningFile(f.plan, result.checkpoint, 1_048_576)).toString('utf8')) as PlanningCheckpoint
      const ledger = await readGenerationLedger(f.plan, result.ledger, state.identity, generation)
      // Circular self-certification is forbidden: checkpoint points to ledger;
      // ledger contains bounded producer receipts, never itself or the checkpoint.
      expect(ledger.outputs.map(file => file.ref)).toEqual(result.outputs.filter(file => !/^(ledgers|checkpoints)\//.test(file.ref)).map(file => file.ref))
      expect(ledger.outputs.some(file => file.ref === result!.checkpoint.ref || file.ref === result!.ledger.ref)).toBe(false)
      checkpoint = JSON.parse(JSON.stringify(result.checkpoint)) as PlanningFile
      expect(generation).toBeLessThan(2000)
    }
    expect([...phases]).toEqual(['index', 'indexed', 'book', 'descriptors', 'plan_ready'])
    const descriptors: PlanningDescriptor[] = []
    for (let order = 0; order < 4; order++) descriptors.push(JSON.parse(await readFile(path.join(f.plan, `descriptors/${order}.json`), 'utf8')) as PlanningDescriptor)
    expect(descriptors.map(row => row.type)).toEqual(['cover', 'photo', 'legacy-content', 'final'])
    expect(descriptors.map(row => row.page_context)).toEqual([1, 2, 3, 4].map(start_page => ({ start_page, folio_area_mm: 12 })))
    expect(descriptors.flatMap(row => row.blocks)).toEqual(['book:cover', '91:photo', '91:description:small', '91:online', 'book:final'])
    expect(descriptors.flatMap(row => row.occurrences)).toEqual(['91:cover:1:book-cover', '91:cover:1'])
    const summary = JSON.parse(await readFile(path.join(f.plan, 'plan-summary.json'), 'utf8')) as Record<string, unknown>
    expect(summary).toMatchObject({ pages: 4, blocks: 5, occurrences: 2, included_media_occurrences: 1, measured: false,
      planning_protocol_version: 2, renderer_content_hash: RENDERER, resource_profile_hash: sha256(canonicalJson(DEFAULT_RENDERER_RESOURCE_PROFILE)) })
    await expect(step(f, { renderer_content_hash: RENDERER, generation: generation + 1, checkpoint })).rejects.toThrow('WORKER_PLANNING_ALREADY_COMPLETE')
  }, 120_000)

  it('retries after a crash-written ledger without committing discarded candidate outputs', async () => {
    const f = await setup(); const receipts = f.committed
    const put = PlanningStorage.prototype.put
    jest.spyOn(PlanningStorage.prototype, 'put').mockImplementation(async function (this: PlanningStorage, ref, value, maximum) {
      if (ref.startsWith('checkpoints/')) throw new Error('CRASH_AFTER_LEDGER')
      return put.call(this, ref, value, maximum)
    })
    await expect(step(f, { renderer_content_hash: RENDERER, generation: 1, limits: { input_bytes: 257 } })).rejects.toThrow('CRASH_AFTER_LEDGER')
    expect(receipts.size).toBe(0)
    jest.restoreAllMocks()
    const retry = await step(f, { renderer_content_hash: RENDERER, generation: 1, limits: { input_bytes: 257 } })
    expect(retry.generation).toBe(1)
    expect(receipts.size).toBe(retry.outputs.length)
    const state = JSON.parse(await readFile(path.join(f.plan, retry.checkpoint.ref), 'utf8')) as PlanningCheckpoint
    expect((await readGenerationLedger(f.plan, retry.ledger, state.identity, 1)).previous).toBeNull()
  })

  it('binds snapshot, artifact, physical profile and generation before reading any prior producer', async () => {
    const f = await setup(); const first = await step(f, { renderer_content_hash: RENDERER, generation: 1, limits: { input_bytes: 17 } })
    const request = { renderer_content_hash: RENDERER, generation: 2, checkpoint: first.checkpoint }
    await expect(step(f, request, { ...f.document, seed: 'different' })).rejects.toThrow('WORKER_PLANNING_CHECKPOINT_INVALID')
    await expect(step(f, { ...request, renderer_content_hash: 'f'.repeat(64) })).rejects.toThrow('WORKER_PLANNING_CHECKPOINT_INVALID')
    await expect(step(f, { ...request, resource_profile: { ...DEFAULT_RENDERER_RESOURCE_PROFILE, decoded_portion_pixels: DEFAULT_RENDERER_RESOURCE_PROFILE.decoded_portion_pixels - 1 } })).rejects.toThrow('WORKER_PLANNING_CHECKPOINT_INVALID')
    await expect(step(f, { ...request, generation: 3 })).rejects.toThrow('WORKER_PLANNING_CHECKPOINT_INVALID')
    await expect(preparePlanningStep(f.jobDir, f.plan, f.document, request, { committed: options(f.committed).committed })).rejects.toThrow('WORKER_PLANNING_CHECKPOINT_INVALID')
  })

  it('requires committed authority and adequate envelope budget before publishing a generation', async () => {
    const f = await setup()
    await expect(preparePlanningStep(f.jobDir, f.plan, f.document, { renderer_content_hash: RENDERER, generation: 1 }, undefined as unknown as PlanningStepOptions)).rejects.toThrow('WORKER_PLANNING_COMMITTED_LOOKUP_REQUIRED')
    await expect(step(f, { renderer_content_hash: RENDERER, generation: 1, limits: { output_bytes: 100 } })).rejects.toThrow('WORKER_PLANNING_OUTPUT_BUDGET_EXCEEDED')
    expect(f.committed.size).toBe(0)
  })

  /** Indexes the fixture, then commits a book checkpoint whose next step probes one queued page. */
  async function queuedPage(f: Awaited<ReturnType<typeof setup>>) {
    let checkpoint: PlanningFile | undefined; let generation = 0
    while (true) {
      const result = await step(f, { renderer_content_hash: RENDERER, generation: ++generation, checkpoint })
      checkpoint = result.checkpoint
      if (result.phase === 'indexed') break
    }
    const state = JSON.parse(await readFile(path.join(f.plan, checkpoint.ref), 'utf8')) as PlanningCheckpoint
    const seed = new PlanningStorage(f.plan, LIMITS)
    const book = initialBookPlanning()
    await enqueueBookPage(seed, book, { page: { type: 'checklists' }, blocks: ['cache-fixture'], occurrences: [] }, 0, 'body')
    const queued = { ...state, phase: 'book' as const, book }
    checkpoint = await seed.put(`checkpoints/${sha256(canonicalJson(queued))}.json`, queued)
    for (const file of seed.outputs) f.committed.set(file.ref, file)
    return { checkpoint, generation, book }
  }

  it('commits cache-only progress with the exact unchanged book cursor, then resumes after a fresh generation', async () => {
    const f = await setup()
    const queued = await queuedPage(f)
    const { checkpoint, book } = queued
    let { generation } = queued
    const factory = options(f.committed)
    const createPorts = factory.ports_factory!
    factory.ports_factory = storage => ({ ...createPorts(storage), probe: async source => {
      for (let asset = 0; asset < 14; asset++) {
        const ref = `print-cache/${sha256(String(asset))}.json`
        if (await storage.readIndex(ref)) continue
        storage.admit(2, 128)
        await storage.put(`print-assets/${sha256(String(asset))}`, { asset })
        await storage.put(ref, { asset })
      }
      return { source: freeze(source), measurement: { pages: 1, fits: true } }
    } })
    const first = await preparePlanningStep(f.jobDir, f.plan, f.document,
      { renderer_content_hash: RENDERER, generation: ++generation, checkpoint }, factory)
    const unchanged = JSON.parse(await readFile(path.join(f.plan, first.checkpoint.ref), 'utf8')) as PlanningCheckpoint
    expect(unchanged.book).toEqual(book)
    expect(first.probes).toBe(0)
    expect(first.outputs.filter(file => file.ref.startsWith('print-cache/'))).toHaveLength(10)
    expect(first.outputs.length).toBeLessThanOrEqual(24)
    commit(first, f.committed)
    const second = await preparePlanningStep(f.jobDir, f.plan, f.document,
      { renderer_content_hash: RENDERER, generation: ++generation, checkpoint: first.checkpoint }, factory)
    const advanced = JSON.parse(await readFile(path.join(f.plan, second.checkpoint.ref), 'utf8')) as PlanningCheckpoint
    expect(advanced.book!.queue).toBeUndefined()
    expect(advanced.book!.counts.pages).toBe(1)
    expect(second.probes).toBe(1)
  })

  it('retries one oversized resource pair with its exact required budget instead of failing the book', async () => {
    const f = await setup()
    const { checkpoint, generation } = await queuedPage(f)
    const served = { blob: 'x'.repeat(5_000_000) }
    const servedBytes = Buffer.byteLength(canonicalJson(served))
    const factory = options(f.committed)
    const createPorts = factory.ports_factory!
    factory.ports_factory = storage => ({ ...createPorts(storage), probe: async source => {
      if (!await storage.readIndex('print-cache/large.json')) {
        storage.admit(2, servedBytes + 64)
        await storage.put('print-assets/large', served, 6_000_000)
        await storage.put('print-cache/large.json', { large: true })
      }
      return { source: freeze(source), measurement: { pages: 1, fits: true } }
    } })
    const request = { renderer_content_hash: RENDERER, generation: generation + 1, checkpoint }
    const failure = await preparePlanningStep(f.jobDir, f.plan, f.document, request, factory).catch((error: unknown) => error)
    expect(failure).toMatchObject({ message: 'WORKER_PLANNING_OUTPUT_BUDGET_EXCEEDED' })
    const required = (failure as { required_budget: { output_bytes: number; output_records: number } }).required_budget
    expect(required.output_bytes).toBeGreaterThan(4_194_304)
    expect(required.output_bytes).toBeLessThanOrEqual(maxPlanningOutputBytes(DEFAULT_RENDERER_RESOURCE_PROFILE))
    await expect(readFile(path.join(f.plan, 'print-assets', 'large'))).rejects.toThrow('ENOENT')
    const retried = await preparePlanningStep(f.jobDir, f.plan, f.document,
      { ...request, limits: { output_bytes: required.output_bytes, output_records: Math.max(24, required.output_records) } }, factory)
    // The pair alone filled the retried envelope: it commits as cache-only progress with the book cursor unchanged.
    expect(retried.outputs.map(file => file.ref)).toEqual(expect.arrayContaining(['print-assets/large', 'print-cache/large.json']))
    expect(retried.probes).toBe(0)
    commit(retried, f.committed)
    const next = await preparePlanningStep(f.jobDir, f.plan, f.document,
      { renderer_content_hash: RENDERER, generation: request.generation + 1, checkpoint: retried.checkpoint }, factory)
    expect(next.probes).toBe(1)
    expect(next.outputs.some(file => file.ref.startsWith('print-'))).toBe(false)
    const advanced = JSON.parse(await readFile(path.join(f.plan, next.checkpoint.ref), 'utf8')) as PlanningCheckpoint
    expect(advanced.book!.counts.pages).toBe(1)
    await expect(preparePlanningStep(f.jobDir, f.plan, f.document,
      { ...request, limits: { output_bytes: maxPlanningOutputBytes(DEFAULT_RENDERER_RESOURCE_PROFILE) + 1 } }, factory)).rejects.toThrow('WORKER_PLANNING_CHECKPOINT_INVALID')
    const unledgerable = { ...DEFAULT_RENDERER_RESOURCE_PROFILE, encoded_resource_bytes: DEFAULT_RENDERER_RESOURCE_PROFILE.encoded_resource_bytes + 1 }
    await expect(preparePlanningStep(f.jobDir, f.plan, f.document, { ...request, resource_profile: unledgerable }, factory)).rejects.toThrow('WORKER_RESOURCE_PROFILE_INVALID')
  })

  it('rejects a crash-written checkpoint even when its checksum and identity are valid', async () => {
    const f = await setup()
    const first = await step(f, { renderer_content_hash: RENDERER, generation: 1, limits: { input_bytes: 17 } })
    f.committed.delete(first.checkpoint.ref)
    await expect(step(f, { renderer_content_hash: RENDERER, generation: 2, checkpoint: first.checkpoint })).rejects.toThrow('WORKER_PLANNING_COMMITTED_REFERENCE_INVALID')
    f.committed.set(first.checkpoint.ref, first.checkpoint)
    f.committed.delete(first.ledger.ref)
    await expect(step(f, { renderer_content_hash: RENDERER, generation: 2, checkpoint: first.checkpoint })).rejects.toThrow('WORKER_PLANNING_COMMITTED_REFERENCE_INVALID')
  })
})
