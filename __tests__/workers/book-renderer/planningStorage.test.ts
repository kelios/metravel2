/** @jest-environment node */
import { mkdir, mkdtemp, open, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { PlanningStorage, readPlanningFile } from '@/workers/book-renderer/planningStorage'
import type { PlanningFile } from '@/workers/book-renderer/planningTypes'

const LIMITS = { input_bytes: 256, output_bytes: 1_048_576, output_records: 24, probes: 1 }
describe('bounded candidate storage and committed read authority', () => {
  let root: string
  beforeEach(async () => {
    const base = path.resolve(__dirname, '../../../.codex-temp/tests')
    await mkdir(base, { recursive: true }); root = await mkdtemp(path.join(base, 'planning-storage-'))
  })
  afterEach(async () => { await rm(root, { recursive: true, force: true }) })

  it('ignores uncommitted disk records, then verifies the exact committed receipt on a fresh restart', async () => {
    const receipt = await new PlanningStorage(root, LIMITS).put('index/country.json', { value: 1 })
    const committed = new Map<string, PlanningFile>()
    const reader = () => new PlanningStorage(root, LIMITS, async ref => committed.get(ref) ?? null)
    expect(await reader().readIndex(receipt.ref)).toBeUndefined()
    committed.set(receipt.ref, receipt)
    expect(await reader().readIndex(receipt.ref)).toEqual({ value: 1 })
    await writeFile(path.join(root, receipt.ref), '{"value":2}')
    await expect(reader().readIndex(receipt.ref)).rejects.toThrow('WORKER_PLANNING_CHECKSUM_MISMATCH')
  })

  it('reads current-candidate outputs without prematurely committing them', async () => {
    const committed = new Map<string, PlanningFile>()
    const storage = new PlanningStorage(root, LIMITS, async ref => committed.get(ref) ?? null)
    const receipt = await storage.put('index/current.json', { current: true })
    expect(await storage.readIndex(receipt.ref)).toEqual({ current: true })
    expect(committed.size).toBe(0)
    expect(await new PlanningStorage(root, LIMITS, async () => null).readIndex(receipt.ref)).toBeUndefined()
  })

  it('rejects a self-consistent nested pointer absent from the committed closure', async () => {
    const file = await new PlanningStorage(root, LIMITS).put('book/uncommitted.json', { authenticHash: true })
    const committed = new Map<string, PlanningFile>()
    const reader = new PlanningStorage(root, LIMITS, async ref => committed.get(ref) ?? null)
    await expect(reader.read(file, LIMITS.output_bytes)).rejects.toThrow('WORKER_PLANNING_COMMITTED_REFERENCE_INVALID')
    committed.set(file.ref, file)
    expect(JSON.parse((await reader.read(file, LIMITS.output_bytes)).toString('utf8'))).toEqual({ authenticHash: true })
    await expect(reader.read({ ...file, checksum: 'e'.repeat(64) }, LIMITS.output_bytes)).rejects.toThrow('WORKER_PLANNING_COMMITTED_REFERENCE_INVALID')
  })

  it('resolves a by-ref resource read with one committed lookup and still verifies its bytes', async () => {
    const receipt = await new PlanningStorage(root, LIMITS).put('print-cache/key.json', { value: 1 })
    const lookup = jest.fn(async (ref: string) => ref === receipt.ref ? receipt : null)
    const storage = new PlanningStorage(root, LIMITS, lookup)
    expect(JSON.parse((await storage.readByRef(receipt.ref, receipt.checksum, LIMITS.output_bytes)).toString('utf8'))).toEqual({ value: 1 })
    expect(lookup).toHaveBeenCalledTimes(1)
    await expect(storage.readByRef(receipt.ref, 'e'.repeat(64), LIMITS.output_bytes)).rejects.toThrow('WORKER_PLANNING_COMMITTED_REFERENCE_INVALID')
    await writeFile(path.join(root, receipt.ref), '{"value":2}')
    await expect(storage.readByRef(receipt.ref, receipt.checksum, LIMITS.output_bytes)).rejects.toThrow('WORKER_PLANNING_CHECKSUM_MISMATCH')
  })

  it('rejects a lookup resolving a different job/ref rather than using its valid hash', async () => {
    const receipt = await new PlanningStorage(root, LIMITS).put('index/other.json', { value: 1 })
    const storage = new PlanningStorage(root, LIMITS, async () => receipt)
    await expect(storage.readIndex('index/wanted.json')).rejects.toThrow('WORKER_PLANNING_COMMITTED_REFERENCE_INVALID')
  })

  it('charges exact bytes only once and preserves ledger/checkpoint room across parser receipts', () => {
    const storage = new PlanningStorage(root, { ...LIMITS, output_records: 3, output_bytes: 100 })
    storage.reserve(2, 80)
    const receipt = { ref: 'parser/text/0.json', checksum: 'b'.repeat(64), size_bytes: 20 }
    storage.recordExternalReceipt(receipt); storage.recordExternalReceipt({ ...receipt })
    expect([storage.remainingRecords, storage.remainingBytes]).toEqual([0, 0])
    expect(() => storage.admit(0, 1)).toThrow('WORKER_PLANNING_OUTPUT_BUDGET_EXCEEDED')
    expect(() => storage.recordExternalReceipt({ ...receipt, checksum: 'c'.repeat(64) })).toThrow('WORKER_PLANNING_IMMUTABLE_CONFLICT')
    expect(() => storage.recordExternalReceipt({ ...receipt, size_bytes: 19 })).toThrow('WORKER_PLANNING_IMMUTABLE_CONFLICT')
    expect(storage.outputs).toEqual([receipt])
    storage.releaseReservation()
    expect([storage.remainingRecords, storage.remainingBytes]).toEqual([2, 80])
  })

  it('rejects output admission before creating a directory or publishing candidate bytes', async () => {
    const storage = new PlanningStorage(root, { ...LIMITS, output_records: 2 })
    storage.reserve(2, 100)
    await expect(storage.put('new/path.json', { value: 1 })).rejects.toThrow('WORKER_PLANNING_OUTPUT_BUDGET_EXCEEDED')
    expect(storage.outputs).toEqual([])
    expect(await readdir(root)).toEqual([])
  })

  it('retries immutable bytes once and never overwrites a conflicting crash-written candidate', async () => {
    const first = new PlanningStorage(root, LIMITS)
    const receipt = await first.put('book/source.json', { text: 'Original 😀' })
    const before = await readFile(path.join(root, receipt.ref))
    const retry = new PlanningStorage(root, LIMITS)
    expect(await retry.put(receipt.ref, { text: 'Original 😀' })).toEqual(receipt)
    expect(await retry.put(receipt.ref, { text: 'Original 😀' })).toEqual(receipt)
    expect(retry.outputs).toEqual([receipt])
    const conflicting = new PlanningStorage(root, LIMITS)
    // The existing leaf fails verification against the new value's receipt.
    await expect(conflicting.put(receipt.ref, { text: 'Changed' })).rejects.toThrow('WORKER_PLANNING_CHECKSUM_MISMATCH')
    expect(conflicting.outputs).toEqual([])
    expect(await readFile(path.join(root, receipt.ref))).toEqual(before)
    expect((await readdir(path.join(root, 'book'))).filter(name => name.startsWith('.pending-'))).toEqual([])
  })

  it('leaves no pending temporary behind when replacing an uncommitted leaf fails mid-write', async () => {
    const storage = new PlanningStorage(root, LIMITS, async () => null, { deferred_durability: true })
    const handle = await open(__filename, 'r'); const proto = Object.getPrototypeOf(handle) as { writeFile: (data: unknown) => Promise<void> }; await handle.close()
    jest.spyOn(proto, 'writeFile').mockRejectedValueOnce(Object.assign(new Error('ENOSPC: no space left on device'), { code: 'ENOSPC' }))
    await expect(storage.put('book/full.json', { value: 1 })).rejects.toThrow('ENOSPC')
    expect(await readdir(path.join(root, 'book'))).toEqual([])
    expect(storage.outputs).toEqual([])
  })

  it('enforces checksum, size and private receipt paths on every restored read', async () => {
    const receipt = await new PlanningStorage(root, LIMITS).put('book/a.json', { value: 1 })
    await expect(readPlanningFile(root, { ...receipt, size_bytes: receipt.size_bytes + 1 }, LIMITS.output_bytes)).rejects.toThrow('WORKER_PLANNING_CHECKSUM_MISMATCH')
    await expect(readPlanningFile(root, { ...receipt, checksum: 'd'.repeat(64) }, LIMITS.output_bytes)).rejects.toThrow('WORKER_PLANNING_CHECKSUM_MISMATCH')
    expect(() => new PlanningStorage(root, LIMITS).recordExternalReceipt({ ...receipt, ref: '../escape' })).toThrow('WORKER_PLANNING_REFERENCE_INVALID')
  })
})

describe('generation durability barrier (#2384)', () => {
  let root: string
  beforeEach(async () => {
    const base = path.resolve(__dirname, '../../../.codex-temp/tests')
    await mkdir(base, { recursive: true }); root = await mkdtemp(path.join(base, 'planning-barrier-'))
  })
  afterEach(async () => { jest.restoreAllMocks(); await rm(root, { recursive: true, force: true }) })
  async function countSyncs(): Promise<{ calls: () => number }> {
    const handle = await open(__filename, 'r'); const proto = Object.getPrototypeOf(handle) as { sync: () => Promise<void> }; await handle.close()
    const spy = jest.spyOn(proto, 'sync')
    return { calls: () => spy.mock.calls.length }
  }

  it('requires committed authority for deferred durability', () => {
    expect(() => new PlanningStorage(root, LIMITS, undefined, { deferred_durability: true })).toThrow('WORKER_PLANNING_COMMITTED_LOOKUP_REQUIRED')
  })

  it('writes without per-file fsync, then syncs every output and its directories once at the commit point', async () => {
    const storage = new PlanningStorage(root, LIMITS, async () => null, { deferred_durability: true })
    const syncs = await countSyncs()
    await storage.put('book/a.json', { value: 1 })
    await storage.put('book/b.json', { value: 2 })
    await storage.put('book/deep/c.json', { value: 3 })
    expect(syncs.calls()).toBe(0)
    await storage.flush()
    // Three files, then book/deep, book and the plan root, each exactly once.
    expect(syncs.calls()).toBe(6)
  })

  it('replaces uncommitted crash debris (a torn leaf) atomically instead of reporting a conflict', async () => {
    await mkdir(path.join(root, 'book'), { mode: 0o700 })
    await writeFile(path.join(root, 'book/source.json'), '', { mode: 0o600 })
    const storage = new PlanningStorage(root, LIMITS, async () => null, { deferred_durability: true })
    const receipt = await storage.put('book/source.json', { text: 'Original 😀' })
    expect(await readPlanningFile(root, receipt, LIMITS.output_bytes)).toEqual(Buffer.from('{"text":"Original 😀"}'))
    expect(storage.outputs).toEqual([receipt])
    expect((await readdir(path.join(root, 'book'))).filter(name => name.startsWith('.pending-'))).toEqual([])
  })

  it('verifies a committed leaf in place and never rewrites or contradicts it', async () => {
    const receipt = await new PlanningStorage(root, LIMITS).put('index/summary.json', { value: 1 })
    const committed = new Map<string, PlanningFile>([[receipt.ref, receipt]])
    const before = (await stat(path.join(root, receipt.ref))).ino
    const storage = () => new PlanningStorage(root, LIMITS, async ref => committed.get(ref) ?? null, { deferred_durability: true })
    expect(await storage().put(receipt.ref, { value: 1 })).toEqual(receipt)
    expect((await stat(path.join(root, receipt.ref))).ino).toBe(before)
    await expect(storage().put(receipt.ref, { value: 2 })).rejects.toThrow('WORKER_PLANNING_IMMUTABLE_CONFLICT')
    await writeFile(path.join(root, receipt.ref), '{"value":3}')
    await expect(storage().put(receipt.ref, { value: 1 })).rejects.toThrow('WORKER_PLANNING_CHECKSUM_MISMATCH')
  })

  it('rolls one transition back out of the candidate without touching earlier receipts', async () => {
    const storage = new PlanningStorage(root, LIMITS, async () => null, { deferred_durability: true })
    const kept = await storage.put('book/kept.json', { value: 1 })
    const mark = storage.mark(); const remaining = storage.remainingBytes
    await storage.put('book/dropped.json', { value: 2 })
    storage.recordExternalReceipt({ ref: 'parser/x/text/0.json', checksum: 'e'.repeat(64), size_bytes: 10 })
    storage.rollback(mark)
    expect(storage.outputs).toEqual([kept])
    expect(storage.remainingBytes).toBe(remaining)
    expect(storage.admittedReceipt('book/dropped.json')).toBeUndefined()
    expect(await storage.readIndex('book/dropped.json')).toBeUndefined()
    expect(() => storage.rollback({ outputs: 5, bytes: 0 })).toThrow('WORKER_PLANNING_OUTPUT_BUDGET_INVALID')
  })
})
