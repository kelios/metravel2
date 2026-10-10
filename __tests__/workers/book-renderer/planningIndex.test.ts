/** @jest-environment node */
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { BookDocument } from '@/types/bookDocument'
import { preparePlanningStep as prepareStep } from '@/workers/book-renderer/planningStep'
import { PlanningStorage } from '@/workers/book-renderer/planningStorage'
import type { PlanningCheckpoint, PlanningFile, PlanningRequest, PlanningStepResult } from '@/workers/book-renderer/planningTypes'
import { canonicalJson, sha256 } from '@/workers/book-renderer/filesystem'
import { buildSnapshotFixture } from '../../fixtures/pdfBook/buildSnapshotFixture'

const RENDERER = 'a'.repeat(64)
describe('durable bounded frozen snapshot indexing', () => {
  let scratch: string
  let committed: Map<string, Map<string, PlanningFile>>
  async function preparePlanningStep(job: string, out: string, document: BookDocument, request: PlanningRequest) {
    let receipts = committed.get(out)
    if (!receipts) { receipts = new Map(); committed.set(out, receipts) }
    const result = await prepareStep(job, out, document, request, { committed: async ref => receipts!.get(ref) ?? null })
    // A failed candidate is deliberately never committed.
    for (const file of result.outputs) receipts.set(file.ref, { ...file })
    return result
  }
  beforeEach(async () => {
    committed = new Map()
    const root = path.resolve(__dirname, '../../../.codex-temp/tests')
    await mkdir(root, { recursive: true })
    scratch = await mkdtemp(path.join(root, 'book-planning-index-'))
  })
  afterEach(async () => { jest.restoreAllMocks(); await rm(scratch, { recursive: true, force: true }) })

  async function index(job: string, out: string, document: BookDocument, bytes: number) {
    let checkpoint: PlanningFile | undefined
    let result: PlanningStepResult
    const totals = { sources: 0, travels: 0, included_media_occurrences: 0 }
    let calls = 0
    do {
      result = await preparePlanningStep(job, out, document, { renderer_content_hash: RENDERER, generation: ++calls, checkpoint, limits: { input_bytes: bytes } })
      checkpoint = JSON.parse(JSON.stringify(result.checkpoint)) as PlanningFile
      expect(result.consumed_bytes).toBeLessThanOrEqual(bytes)
      expect(result.outputs.length).toBeLessThanOrEqual(24)
      expect(result.outputs.reduce((sum, file) => sum + file.size_bytes, 0)).toBeLessThanOrEqual(4_194_304)
      for (const key of Object.keys(totals) as Array<keyof typeof totals>) totals[key] += result.deltas[key]
      expect(calls).toBeLessThan(10_000)
    } while (result.phase !== 'indexed')
    const state = JSON.parse(await readFile(path.join(out, checkpoint.ref), 'utf8')) as PlanningCheckpoint
    return { result, state, totals, calls }
  }

  it('retains exact B1 hash, media occurrences and summaries across UTF8 splits and fresh checkpoints', async () => {
    const fixture = await buildSnapshotFixture(path.join(scratch, 'input'), { travels: [
      { id: 11, title: 'Ёжик 😀', description: '<p>ёжик😀 &amp; text</p>'.repeat(100), photos: 2, points: 2, routeThumbnails: true },
      { id: 12, title: 'Repeat resources', description: '<p>same bytes</p>', photos: 1 },
    ], durableTextWindow: 31 })
    const slow = await index(fixture.jobDir, path.join(scratch, 'slow'), fixture.document, 257)
    const fast = await index(fixture.jobDir, path.join(scratch, 'fast'), fixture.document, 65_536)
    expect(slow.state.index.summary).toEqual(fast.state.index.summary)
    expect(slow.totals).toEqual({ sources: fixture.manifest.length, travels: 2, included_media_occurrences: fixture.expected.media_occurrence_keys.length })
    expect(slow.state.index.summary).toMatchObject({ travels: 2, countries: 1, days: 4, photos: 3, points: 2, mapped_travels: 1 })
    expect(slow.calls).toBeGreaterThan(fast.calls)
    const occurrenceRows = []
    for (let ordinal = 0; ordinal < slow.totals.included_media_occurrences; ordinal++) {
      occurrenceRows.push(JSON.parse(await readFile(path.join(scratch, 'slow', 'index', 'occurrences', `${ordinal}.json`), 'utf8')) as { key: string })
    }
    expect(occurrenceRows.map(row => row.key)).toEqual(fixture.expected.media_occurrence_keys)
    for (const chunk of fixture.manifest) {
      expect(JSON.parse(await readFile(path.join(scratch, 'slow', 'index', 'rows', `${chunk.position}.json`), 'utf8'))).toEqual(chunk)
    }
  }, 60_000)

  it('replays crash-written rows without duplicate membership, counters or changed immutable bytes', async () => {
    const f = await buildSnapshotFixture(path.join(scratch, 'input'), { travels: [{ id: 19, title: 'Crash', photos: 2 }] })
    const out = path.join(scratch, 'plan')
    const put = PlanningStorage.prototype.put
    jest.spyOn(PlanningStorage.prototype, 'put').mockImplementation(async function (this: PlanningStorage, ref, value, maximum) {
      if (ref.startsWith('checkpoints/')) throw new Error('SIMULATED_CRASH_BEFORE_CHECKPOINT')
      return put.call(this, ref, value, maximum)
    })
    await expect(preparePlanningStep(f.jobDir, out, f.document, { renderer_content_hash: RENDERER, generation: 1 })).rejects.toThrow('SIMULATED_CRASH_BEFORE_CHECKPOINT')
    const before = await readFile(path.join(out, 'index', 'rows', '0.json'))
    jest.restoreAllMocks()
    const complete = await index(f.jobDir, out, f.document, 65_536)
    expect(await readFile(path.join(out, 'index', 'rows', '0.json'))).toEqual(before)
    expect(complete.state.index.summary).toMatchObject({ countries: 1, travels: 1, photos: 2 })
    expect(complete.totals.sources).toBe(f.manifest.length)
  })

  it('hashes a multi-portion original at persisted offsets, then rejects corrupted original bytes', async () => {
    const f = await buildSnapshotFixture(path.join(scratch, 'input'), { travels: [{ id: 21, title: 'Many source portions' }], mediaFixture: 'opaque-rgba' })
    const complete = await index(f.jobDir, path.join(scratch, 'plan'), f.document, 17)
    expect(complete.result.phase).toBe('indexed')
    const media = f.manifest.find(chunk => chunk.kind === 'media')!
    const bytes = await readFile(path.join(f.jobDir, media.file_ref)); bytes[bytes.length - 1] ^= 1
    await writeFile(path.join(f.jobDir, media.file_ref), bytes)
    await expect(index(f.jobDir, path.join(scratch, 'corrupt'), f.document, 257)).rejects.toThrow('SNAPSHOT_INTEGRITY_FAILED')
  }, 60_000)

  it('rejects snapshot/renderer/generation changes and forged checkpoint offsets', async () => {
    const f = await buildSnapshotFixture(path.join(scratch, 'input'), { travels: [{ id: 25, title: 'Pins' }] })
    const out = path.join(scratch, 'plan')
    const first = await preparePlanningStep(f.jobDir, out, f.document, { renderer_content_hash: RENDERER, generation: 1, limits: { input_bytes: 17 } })
    const request = { renderer_content_hash: RENDERER, generation: 2, checkpoint: first.checkpoint }
    await expect(preparePlanningStep(f.jobDir, out, { ...f.document, seed: 'different' }, request)).rejects.toThrow('WORKER_PLANNING_CHECKPOINT_INVALID')
    await expect(preparePlanningStep(f.jobDir, out, f.document, { ...request, renderer_content_hash: 'b'.repeat(64) })).rejects.toThrow('WORKER_PLANNING_CHECKPOINT_INVALID')
    await expect(preparePlanningStep(f.jobDir, out, f.document, { ...request, generation: 3 })).rejects.toThrow('WORKER_PLANNING_CHECKPOINT_INVALID')
    const state = JSON.parse(await readFile(path.join(out, first.checkpoint.ref), 'utf8')) as PlanningCheckpoint
    state.index.manifest!.offset++
    state.index.manifest!.file_size = 0
    const forged = canonicalJson(state); const hash = sha256(forged); const ref = `checkpoints/${hash}.json`
    await writeFile(path.join(out, ref), forged, { mode: 0o600 })
    committed.get(out)!.set(ref, { ref, checksum: hash, size_bytes: Buffer.byteLength(forged) })
    await expect(preparePlanningStep(f.jobDir, out, f.document, { ...request, checkpoint: { ref, checksum: hash, size_bytes: Buffer.byteLength(forged) } })).rejects.toThrow('WORKER_PLANNING_CHECKPOINT_INVALID')
  })

  it('rejects a conflicting crash-written country marker before it can be committed', async () => {
    const f = await buildSnapshotFixture(path.join(scratch, 'input'), { travels: [{ id: 27, title: 'Future marker' }] })
    const out = path.join(scratch, 'plan')
    await mkdir(path.join(out, 'index', 'countries'), { recursive: true, mode: 0o700 })
    await writeFile(path.join(out, 'index', 'countries', '1.json'), canonicalJson({ first_position: f.manifest.length + 1, value: 1 }), { mode: 0o600 })
    await expect(index(f.jobDir, out, f.document, 65_536)).rejects.toThrow('WORKER_PLANNING_CHECKSUM_MISMATCH')
  })

  it('rejects an unsafe aggregate before publishing the next checkpoint', async () => {
    const f = await buildSnapshotFixture(path.join(scratch, 'input'), { travels: [{ id: 31, title: 'Counter limit' }] })
    const out = path.join(scratch, 'plan')
    const first = await preparePlanningStep(f.jobDir, out, f.document, { renderer_content_hash: RENDERER, generation: 1, limits: { input_bytes: 17 } })
    const state = JSON.parse(await readFile(path.join(out, first.checkpoint.ref), 'utf8')) as PlanningCheckpoint
    state.index.summary.days = Number.MAX_SAFE_INTEGER
    const encoded = canonicalJson(state); const hash = sha256(encoded); const ref = `checkpoints/${hash}.json`
    await writeFile(path.join(out, ref), encoded, { mode: 0o600 })
    committed.get(out)!.set(ref, { ref, checksum: hash, size_bytes: Buffer.byteLength(encoded) })
    await expect(preparePlanningStep(f.jobDir, out, f.document, { renderer_content_hash: RENDERER, generation: 2,
      checkpoint: { ref, checksum: hash, size_bytes: Buffer.byteLength(encoded) } })).rejects.toThrow('WORKER_PLANNING_COUNTER_OVERFLOW')
  })

  it('rejects symlink destinations and a bounded output budget before publishing a checkpoint', async () => {
    const f = await buildSnapshotFixture(path.join(scratch, 'input'), { travels: [{ id: 29, title: 'Private' }] })
    const out = path.join(scratch, 'plan'); await mkdir(out, { mode: 0o700 })
    await mkdir(path.join(scratch, 'elsewhere'), { mode: 0o700 }); await symlink(path.join(scratch, 'elsewhere'), path.join(out, 'index'))
    await expect(preparePlanningStep(f.jobDir, out, f.document, { renderer_content_hash: RENDERER, generation: 1 })).rejects.toThrow('WORKER_PLANNING_DIRECTORY_INVALID')
    await expect(preparePlanningStep(f.jobDir, path.join(scratch, 'small'), f.document, { renderer_content_hash: RENDERER, generation: 1, limits: { output_bytes: 1 } })).rejects.toThrow('WORKER_PLANNING_OUTPUT_BUDGET_EXCEEDED')
  })
})
