/** @jest-environment node */
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { beginAnchorFragment, advanceAnchorTarget, initialAnchorLedger, sealAnchorLedger, sealedAnchorResolver } from '@/workers/book-renderer/planningAnchors'
import type { AnchorLedgerState } from '@/workers/book-renderer/planningAnchors'
import { PlanningStorage } from '@/workers/book-renderer/planningStorage'
import { canonicalJson, sha256 } from '@/workers/book-renderer/filesystem'
import type { PlanningFile } from '@/workers/book-renderer/planningTypes'

const LIMITS = { input_bytes: 65_536, output_bytes: 2_097_152, output_records: 24, probes: 1 }
describe('durable numbered forward anchors', () => {
  let scratch: string
  beforeEach(async () => {
    const root = path.resolve(__dirname, '../../../.codex-temp/tests')
    await mkdir(root, { recursive: true }); scratch = await mkdtemp(path.join(root, 'book-planning-anchors-'))
  })
  afterEach(async () => { jest.restoreAllMocks(); await rm(scratch, { recursive: true, force: true }) })
  const store = () => new PlanningStorage(scratch, LIMITS)
  const restore = (state: AnchorLedgerState): AnchorLedgerState => JSON.parse(JSON.stringify(state)) as AnchorLedgerState

  async function finish(state: AnchorLedgerState) {
    while (state.pending) {
      const storage = store()
      state = restore(await advanceAnchorTarget(storage, state))
      expect(storage.outputs.length).toBeLessThanOrEqual(2)
    }
    return state
  }

  it('preserves original first-seen link order and entity decoding across fragmented forward links', async () => {
    let state = await beginAnchorFragment(store(), initialAnchorLedger(51, 'description'), { index: 0,
      html: '<a href="#last">Later</a><a href="https://example.com/#outside">Outside</a><a href="#a&amp;b">Entity</a><a href="#last">Repeat</a><a href="#bad?query">Ignore</a>' })
    state = await finish(restore(state))
    state = await beginAnchorFragment(store(), state, { index: 1, html: '<a href="#a&amp;b">Repeat entity</a><a href="#last">Repeat later</a><a href="#new">New</a>' })
    state = await finish(restore(state))
    const sealed = await sealAnchorLedger(store(), state, { parser_done: true, produced_fragments: 2 })
    const resolver = await sealedAnchorResolver(scratch, sealed)
    expect(state).toMatchObject({ fragments: 2, anchors: 3 })
    expect([1, 2, 3, 4].map(resolver.resolve)).toEqual(['last', 'a&b', 'new', undefined])
    expect(resolver.policy).toBe(sealed.checksum)
  })

  it('resumes a crash between dedup marker and numbered target without incrementing twice', async () => {
    const initial = await beginAnchorFragment(store(), initialAnchorLedger(53, 'plus'), { index: 0, html: '<a href="#x">X</a><a href="#y">Y</a>' })
    const put = PlanningStorage.prototype.put
    jest.spyOn(PlanningStorage.prototype, 'put').mockImplementation(async function (this: PlanningStorage, ref, value, maximum) {
      if (ref.includes('/values/')) throw new Error('SIMULATED_TARGET_CRASH')
      return put.call(this, ref, value, maximum)
    })
    await expect(advanceAnchorTarget(store(), restore(initial))).rejects.toThrow('SIMULATED_TARGET_CRASH')
    const marker = path.join(scratch, initial.scope, 'seen', `${sha256('x')}.json`)
    const original = await readFile(marker)
    jest.restoreAllMocks()
    const complete = await finish(restore(initial))
    expect(complete).toMatchObject({ anchors: 2, fragments: 1 })
    expect(await readFile(marker)).toEqual(original)
    const sealed = await sealAnchorLedger(store(), complete, { parser_done: true, produced_fragments: 1 })
    expect((await sealedAnchorResolver(scratch, sealed)).resolve(1)).toBe('x')
  })

  it('rejects premature seals, changed fragment order and huge target names', async () => {
    const start = initialAnchorLedger(55, 'minus')
    const pending = await beginAnchorFragment(store(), start, { index: 0, html: '<a href="#pending">P</a>' })
    await expect(sealAnchorLedger(store(), pending, { parser_done: true, produced_fragments: 1 })).rejects.toThrow('WORKER_ANCHOR_SEAL_PREMATURE')
    await expect(sealAnchorLedger(store(), start, { parser_done: false, produced_fragments: 0 })).rejects.toThrow('WORKER_ANCHOR_SEAL_PREMATURE')
    await expect(sealAnchorLedger(store(), start, { parser_done: true, produced_fragments: 1 })).rejects.toThrow('WORKER_ANCHOR_SEAL_PREMATURE')
    await expect(beginAnchorFragment(store(), start, { index: 1, html: '<p>Skip</p>' })).rejects.toThrow('WORKER_ANCHOR_FRAGMENT_INVALID')
    await expect(beginAnchorFragment(store(), start, { index: 0, html: `<a href="#${'x'.repeat(4097)}">Long</a>` })).rejects.toThrow('WORKER_ANCHOR_BUDGET_EXCEEDED')
  })

  it('rejects future dedup markers and checksums changed after discovery', async () => {
    const state = await beginAnchorFragment(store(), initialAnchorLedger(57, 'recommendation'), { index: 0, html: '<a href="#future">F</a>' })
    await store().put(`${state.scope}/seen/${sha256('future')}.json`, { target: 'future', ordinal: 2, first_fragment: 0 })
    await expect(advanceAnchorTarget(store(), state)).rejects.toThrow('WORKER_ANCHOR_MEMBERSHIP_CONFLICT')
    await writeFile(path.join(scratch, state.pending!.file.ref), canonicalJson({ fragment: 0, targets: ['changed'] }), { mode: 0o600 })
    await expect(advanceAnchorTarget(store(), state)).rejects.toThrow('WORKER_PLANNING_CHECKSUM_MISMATCH')
  })

  it('fails closed on a missing or changed committed numbered target', async () => {
    const initial = await beginAnchorFragment(store(), initialAnchorLedger(59, 'description'), { index: 0, html: '<a href="#safe">S</a>' })
    const state = await finish(initial)
    const sealed = await sealAnchorLedger(store(), state, { parser_done: true, produced_fragments: 1 })
    const resolver = await sealedAnchorResolver(scratch, sealed)
    const numbered = path.join(scratch, state.scope, 'values', '1.json')
    await writeFile(numbered, canonicalJson({ target: 'modified', ordinal: 1, first_fragment: 0 }), { mode: 0o600 })
    expect(() => resolver.resolve(1)).toThrow()
    await rm(numbered)
    expect(() => resolver.resolve(1)).toThrow()
  })

  it('rejects a self-consistent replacement of numbered and seen targets against committed authority', async () => {
    const receipts = new Map<string, PlanningFile>()
    const storage = store()
    let state = await beginAnchorFragment(storage, initialAnchorLedger(61, 'description'), { index: 0, html: '<a href="#safe">S</a>' })
    state = await advanceAnchorTarget(storage, state)
    const seal = await sealAnchorLedger(storage, state, { parser_done: true, produced_fragments: 1 })
    for (const file of storage.outputs) receipts.set(file.ref, file)
    const trusted = new PlanningStorage(scratch, LIMITS, async ref => receipts.get(ref) ?? null)
    const resolver = await sealedAnchorResolver(trusted, seal, ref => receipts.get(ref) ?? null)
    expect(resolver.resolve(1)).toBe('safe')
    const forged = canonicalJson({ target: 'forged', ordinal: 1, first_fragment: 0 })
    await writeFile(path.join(scratch, state.scope, 'values/1.json'), forged, { mode: 0o600 })
    await writeFile(path.join(scratch, state.scope, 'seen', `${sha256('forged')}.json`), forged, { mode: 0o600 })
    expect(() => resolver.resolve(1)).toThrow('WORKER_PLANNING_COMMITTED_REFERENCE_INVALID')
  })
})
