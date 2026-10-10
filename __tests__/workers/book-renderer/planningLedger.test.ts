/** @jest-environment node */
import { mkdtemp, mkdir, rm, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { PlanningStorage } from '@/workers/book-renderer/planningStorage'
import { readGenerationLedger, sealGenerationLedger } from '@/workers/book-renderer/planningLedger'
import { canonicalJson, sha256 } from '@/workers/book-renderer/filesystem'

describe('immutable planning generation output ledger', () => {
  let root: string
  beforeEach(async () => { const base = path.resolve(__dirname, '../../../.codex-temp/tests'); await mkdir(base, { recursive: true }); root = await mkdtemp(path.join(base, 'planning-ledger-')) })
  afterEach(async () => { await rm(root, { recursive: true, force: true }) })
  const identity = 'a'.repeat(64)
  const limits = { input_bytes: 256, output_bytes: 1_048_576, output_records: 24, probes: 1 }

  it('deduplicates exact retry receipts and binds outputs to immutable generation lineage', async () => {
    const storage = new PlanningStorage(root, limits)
    const output = await storage.put('book/source.json', { text: '😀 complete' })
    expect(await storage.put(output.ref, { text: '😀 complete' })).toEqual(output)
    storage.recordExternalReceipt(output)
    expect(storage.outputs).toEqual([output])
    const head = await sealGenerationLedger(storage, identity, 1, null)
    expect(await readGenerationLedger(root, head, identity, 1)).toEqual({ version: 1, identity, generation: 1, previous: null, outputs: [output] })
    const retry = new PlanningStorage(root, limits)
    await retry.put(output.ref, { text: '😀 complete' })
    expect(await sealGenerationLedger(retry, identity, 1, null)).toEqual(head)
    const next = new PlanningStorage(root, limits)
    const output2 = await next.put('book/next.json', { value: 2 })
    const second = await sealGenerationLedger(next, identity, 2, head)
    expect(await readGenerationLedger(root, second, identity, 2)).toMatchObject({ previous: head, outputs: [output2] })
    await expect(readGenerationLedger(root, second, identity, 1)).rejects.toThrow('WORKER_PLANNING_LEDGER_INVALID')
    await expect(readGenerationLedger(root, second, 'b'.repeat(64), 2)).rejects.toThrow('WORKER_PLANNING_LEDGER_INVALID')
    await expect(storage.put(output.ref, { text: 'changed' })).rejects.toThrow('WORKER_PLANNING_IMMUTABLE_CONFLICT')
  })

  // Two hundred real fsynced writes: wall time follows host I/O load, not ledger logic.
  it('reads only the supplied ledger head even when its hundred-generation ancestry is unavailable', async () => {
    let previous = null as import('@/workers/book-renderer/planningTypes').PlanningFile | null
    for (let generation = 1; generation <= 100; generation++) {
      const storage = new PlanningStorage(root, limits)
      await storage.put(`book/g${generation}.json`, { generation })
      const next = await sealGenerationLedger(storage, identity, generation, previous)
      if (previous) await unlink(path.join(root, previous.ref))
      previous = next
    }
    const latest = await readGenerationLedger(root, previous!, identity, 100)
    expect(latest.outputs.map(file => file.ref)).toEqual(['book/g100.json'])
    expect(latest.previous).not.toBeNull()
    expect(latest.outputs.some(file => /^(checkpoints|ledgers)\//.test(file.ref))).toBe(false)
    expect(latest.outputs).toHaveLength(1)
  }, 30_000)

  it('refuses a tampered ledger checksum and forged output inventories even with matching file hashes', async () => {
    const storage = new PlanningStorage(root, limits)
    await storage.put('book/a.json', { value: 1 })
    const head = await sealGenerationLedger(storage, identity, 1, null)
    await writeFile(path.join(root, head.ref), '{}')
    await expect(readGenerationLedger(root, head, identity, 1)).rejects.toThrow('WORKER_PLANNING_CHECKSUM_MISMATCH')
    const output = storage.outputs[0]
    for (const outputs of [[output, output], [{ ...output, ref: '../escape' }], [{ ...output, ref: 'checkpoints/fake.json' }], [{ ...output, ref: 'ledgers/fake.json' }]]) {
      const text = canonicalJson({ version: 1, identity, generation: 1, previous: null, outputs }); const checksum = sha256(text)
      const ref = `ledgers/${checksum}.json`
      await writeFile(path.join(root, ref), text, { mode: 0o600 })
      await expect(readGenerationLedger(root, { ref, checksum, size_bytes: Buffer.byteLength(text) }, identity, 1)).rejects.toThrow('WORKER_PLANNING_LEDGER_INVALID')
    }
  })
})
