/** @jest-environment node */
import fs from 'node:fs'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { buildSnapshotFixture } from '../../fixtures/pdfBook/buildSnapshotFixture'
import { createPlanningPorts } from '@/workers/book-renderer/planningPorts'
import { PlanningStorage } from '@/workers/book-renderer/planningStorage'
import type { PlanningFile } from '@/workers/book-renderer/planningTypes'
import { createDiskCheckpointStores } from '@/workers/book-renderer/htmlCheckpoint/diskStores'
import { SOURCE_BLOCK_CHARS } from '@/workers/book-renderer/htmlCheckpoint/sourceText'
import * as measurement from '@/workers/book-renderer/measurement'

const LIMITS = { input_bytes: 257, output_bytes: 4_194_304, output_records: 24, probes: 1 }
const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex')

describe('planning ports defer physical probes and verify committed parser receipts', () => {
  let root: string
  beforeEach(async () => {
    const base = path.resolve(__dirname, '../../../.codex-temp/tests'); await mkdir(base, { recursive: true })
    root = await mkdtemp(path.join(base, 'planning-ports-'))
  })
  afterEach(async () => { jest.restoreAllMocks(); await rm(root, { recursive: true, force: true }) })

  async function setup() {
    const fixture = await buildSnapshotFixture(path.join(root, 'input'), { travels: [{ id: 92, title: 'Ports' }] })
    const plan = path.join(root, 'plan'); await mkdir(plan, { mode: 0o700 })
    const committed = new Map<string, PlanningFile>()
    const storage = new PlanningStorage(plan, LIMITS, async ref => committed.get(ref) ?? null)
    const handle = await createPlanningPorts(fixture.jobDir, storage, fixture.document, measurement.DEFAULT_RENDERER_RESOURCE_PROFILE,
      undefined, ref => committed.get(ref) ?? null)
    return { ...fixture, plan, committed, storage, ...handle }
  }

  it('constructs storage/parser ports and closes without starting a browser when no page probe is requested', async () => {
    const physical = jest.spyOn(measurement, 'physicalMeasurer').mockRejectedValue(new Error('PHYSICAL_MUST_NOT_START'))
    const f = await setup()
    expect(f.ports.resource_profile).toEqual(measurement.DEFAULT_RENDERER_RESOURCE_PROFILE)
    const receipt = await f.ports.put('index/one.json', { value: 1 }, 100)
    expect(await f.ports.read(receipt, 100)).toEqual({ value: 1 })
    const parser = f.ports.parserStores('parser/one')
    parser.context.put({ value: false, next: null, count: 1 })
    await f.close()
    expect(physical).not.toHaveBeenCalled()
  })

  it('starts the pinned physical measurer only on an actual page probe', async () => {
    const physical = jest.spyOn(measurement, 'physicalMeasurer').mockRejectedValue(new Error('STOP_BEFORE_CHROME'))
    const f = await setup()
    expect(physical).not.toHaveBeenCalled()
    await expect(f.ports.probe({ page: { type: 'checklists' }, blocks: [], occurrences: [] }, { start_page: 1, folio_area_mm: 12 })).rejects.toThrow('STOP_BEFORE_CHROME')
    expect(physical).toHaveBeenCalledTimes(1)
    expect(physical.mock.calls[0].slice(0, 2)).toEqual([f.jobDir, f.plan])
    expect(physical.mock.calls[0].slice(3)).toEqual([measurement.DEFAULT_RENDERER_RESOURCE_PROFILE, 5])
    await f.close()
  })

  it('passes the frozen image/profile to the bounded image probe and accounts both original reads', async () => {
    const dimensions = jest.spyOn(measurement, 'probeFrozenImage').mockResolvedValue({ width: 10, height: 20, aspect: 0.5 })
    const physical = jest.spyOn(measurement, 'physicalMeasurer').mockRejectedValue(new Error('PHYSICAL_MUST_NOT_START'))
    const f = await setup(); const chunk = f.manifest.find(row => row.kind === 'media')!
    if (chunk.kind !== 'media') throw new Error('Missing media fixture')
    expect(await f.ports.imageDimensions(chunk)).toEqual({ width: 10, height: 20, aspect: 0.5, read_bytes: chunk.size_bytes * 2 })
    expect(dimensions).toHaveBeenCalledWith(f.jobDir, chunk, measurement.DEFAULT_RENDERER_RESOURCE_PROFILE, 5)
    expect(physical).not.toHaveBeenCalled()
    await f.close()
  })

  it('reads tag/context/text only after their exact receipt enters committed authority', async () => {
    const f = await setup(); const writable = f.ports.parserStores('parser/one')
    const tag = { name: 'foreign', next: null, count: 1 }; const context = { value: true, next: null, count: 1 }
    const tagHash = writable.tags.put(tag); const contextHash = writable.context.put(context)
    const block = '😀'.repeat(SOURCE_BLOCK_CHARS / 2); writable.text.put(0, block)
    const reader = f.ports.parserReadStores('parser/one')
    expect(() => reader.tags.get(tagHash)).toThrow('WORKER_PLANNING_COMMITTED_REFERENCE_INVALID')
    expect(() => reader.context.get(contextHash)).toThrow('WORKER_PLANNING_COMMITTED_REFERENCE_INVALID')
    expect(() => reader.text.get(0)).toThrow('WORKER_PLANNING_COMMITTED_REFERENCE_INVALID')
    for (const file of f.storage.outputs) f.committed.set(file.ref, { ...file })
    expect(reader.tags.get(tagHash)).toEqual(tag)
    expect(reader.context.get(contextHash)).toEqual(context)
    expect(reader.text.get(0)).toBe(block)
    await f.close()
  })

  it('rejects a named text block with a valid forged self-checksum against the original committed receipt', async () => {
    const f = await setup(); const writer = f.ports.parserStores('parser/one')
    writer.text.put(0, 'a'.repeat(SOURCE_BLOCK_CHARS))
    for (const file of f.storage.outputs) f.committed.set(file.ref, { ...file })
    const replacement = 'b'.repeat(SOURCE_BLOCK_CHARS)
    fs.writeFileSync(path.join(f.plan, 'parser/one/text/0.json'), JSON.stringify({ ordinal: 0, text: replacement,
      sha256: hash(Buffer.from(replacement, 'utf16le')) }))
    // The inner block hash is internally valid. Only committed provenance rejects it.
    expect(createDiskCheckpointStores(path.join(f.plan, 'parser/one'), { readonly: true }).text.get(0)).toBe(replacement)
    expect(() => f.ports.parserReadStores('parser/one').text.get(0)).toThrow('WORKER_PLANNING_COMMITTED_REFERENCE_INVALID')
    await f.close()
  })

  it.each(['ref', 'checksum', 'size_bytes'] as const)('rejects a committed lookup with a mismatched %s', async field => {
    const f = await setup(); const writer = f.ports.parserStores('parser/one')
    const tag = writer.tags.put({ name: 'p', next: null, count: 1 })
    const file = f.storage.outputs.find(receipt => receipt.ref.startsWith('parser/one/'))!
    const bad = field === 'ref' ? { ...file, ref: 'parser/other/wrong.json' }
      : field === 'checksum' ? { ...file, checksum: 'f'.repeat(64) } : { ...file, size_bytes: file.size_bytes + 1 }
    f.committed.set(file.ref, bad)
    expect(() => f.ports.parserReadStores('parser/one').tags.get(tag)).toThrow('WORKER_PLANNING_COMMITTED_REFERENCE_INVALID')
    await f.close()
  })

  it('keeps readonly parser reads free of publication, directory creation, fsync and duplicate record opens', async () => {
    const f = await setup(); f.ports.parserStores('parser/one').text.put(0, 'x'.repeat(SOURCE_BLOCK_CHARS))
    for (const file of f.storage.outputs) f.committed.set(file.ref, file)
    const mkdirSpy = jest.spyOn(fs, 'mkdirSync'); const writeSpy = jest.spyOn(fs, 'writeFileSync'); const syncSpy = jest.spyOn(fs, 'fsyncSync')
    const reader = f.ports.parserReadStores('parser/one'); const openSpy = jest.spyOn(fs, 'openSync')
    expect(reader.text.get(0)).toBe('x'.repeat(SOURCE_BLOCK_CHARS))
    expect(openSpy).toHaveBeenCalledTimes(1)
    for (const spy of [mkdirSpy, writeSpy, syncSpy]) expect(spy).not.toHaveBeenCalled()
    await f.close()
  })

  it('rejects a foreign parser scope and missing committed receipt port before any physical work', async () => {
    const physical = jest.spyOn(measurement, 'physicalMeasurer').mockRejectedValue(new Error('PHYSICAL_MUST_NOT_START'))
    const f = await setup()
    expect(() => f.ports.parserStores('../outside')).toThrow('WORKER_PLANNING_PATH_INVALID')
    await expect(createPlanningPorts(f.jobDir, f.storage, f.document, measurement.DEFAULT_RENDERER_RESOURCE_PROFILE, undefined,
      undefined as unknown as Parameters<typeof createPlanningPorts>[5])).rejects.toThrow('WORKER_PLANNING_COMMITTED_LOOKUP_REQUIRED')
    expect(physical).not.toHaveBeenCalled()
    await f.close()
  })
})
