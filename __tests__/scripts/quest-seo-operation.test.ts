/** @jest-environment node */
import fs from 'fs'
import path from 'path'
import { makeTempDir, removeDir, runCli } from './cli-test-utils'

const { checkReceipt, prepare, publish, recover, quote, overlay, captureOverlay, applyOverlay,
  readiness, baseline, checkInventory, publishCover, abortStage, inspect, pruneLocalArtifacts } = require('@/scripts/quest-seo-operation')
const { sha256, canonicalJson } = require('@/scripts/lib/questSeoContract')
const fixtureManifest = fs.readFileSync(path.resolve('__tests__/fixtures/questSeoV1/quest-seo-manifest.v1.json'), 'utf8')
const manifest = JSON.parse(fixtureManifest)
const candidate = { release_id: manifest.release_id, frontend_sha: manifest.frontend_sha, manifest_sha256: sha256(fixtureManifest) }
const prior = { schema_version: 1, release_id: 'previous', frontend_sha: 'b'.repeat(40), manifest_sha256: 'c'.repeat(64), tree_sha256: 'd'.repeat(64) }
const GATEWAY_MARKER = '# QUEST_SEO_GATEWAY_PROBE_V1'
const gatewayReceipt = { schema_version: 1, result: 'verified', probe_path: '/pl/quests/1/minsk-proof',
  canonical_sha256: 'e'.repeat(64), running_sha256: 'e'.repeat(64), status: 404,
  cache_control: 'no-store', pragma: 'no-cache', expires: '0' }
const receipt = (id = candidate, result = 'activated', previous: string | null = prior.release_id) => ({
  schema_version: 1, result, release_id: id.release_id, frontend_sha: id.frontend_sha,
  manifest_sha256: id.manifest_sha256, previous_release_id: previous,
  root_key: 'static/dist', relative_release_root: `quest-seo-releases/${id.release_id}/dist`,
})

describe('private activation receipt', () => {
  it('accepts activation and separate validation, including null previous on a first baseline', () => {
    expect(checkReceipt(JSON.stringify(receipt()), candidate, 'activated', 'previous').result).toBe('activated')
    expect(checkReceipt(JSON.stringify(receipt(candidate, 'validated', null)), candidate, 'validated', null).result).toBe('validated')
  })
  it.each([
    ['schema_version', 2], ['result', 'validated'], ['release_id', 'other'], ['frontend_sha', 'a'],
    ['manifest_sha256', 'e'.repeat(64)], ['root_key', '/app/static/dist'],
    ['relative_release_root', 'quest-seo-releases/other/dist'], ['previous_release_id', 'other'], ['extra', true],
  ])('refuses %s mismatch', (key, value) => {
    expect(() => checkReceipt(JSON.stringify({ ...receipt(), [key]: value }), candidate, 'activated', 'previous')).toThrow()
  })
  it('refuses duplicate keys, log banners, oversized and absent receipts', () => {
    for (const raw of ['', `log\n${JSON.stringify(receipt())}`, JSON.stringify(receipt()).replace('{', '{"result":"activated",'), ' '.repeat(4097)]) {
      expect(() => checkReceipt(raw, candidate, 'activated', 'previous')).toThrow()
    }
  })
  it('runs publisher operations at reduced CPU priority inside the app container', () => {
    const calls: { command: string, timeout: number }[] = []
    jest.isolateModules(() => {
      jest.doMock('child_process', () => ({ ...jest.requireActual('child_process'),
        spawnSync: (_bin: string, args: string[], options: { timeout: number }) => {
          calls.push({ command: args[args.length - 1], timeout: options.timeout })
          return { status: 0, stdout: '', stderr: '' }
        } }))
      const t = require('@/scripts/quest-seo-operation').transport({ PROD_SSH_TARGET: 'target', PROD_REMOTE_DIR: '/remote',
        QUEST_SEO_APP_CONTAINER: 'app', QUEST_SEO_NGINX_CONTAINER: 'nginx' })
      t.operation('inspect')
      t.operation('stage-v3', ['x'])
      t.operation('cover', ['x'], { timeout: 1234 })
    })
    jest.dontMock('child_process')
    expect(calls.map((call) => call.command.split(' python -c ')[0])).toEqual([
      "docker exec 'app' nice -n 10", "docker exec -i 'app' nice -n 10", "docker exec 'app'"])
    // Niced work gets its own bound; cover keeps the readiness deadline.
    expect(calls.map((call) => call.timeout)).toEqual([300000, 300000, 1234])
  })
  it('quotes transport arguments as literal shell data', () => {
    const value = "space ' $(touch unwanted) `command`"
    expect(runCli('sh', ['-c', `printf %s ${quote(value)}`]).stdout).toBe(value)
  })
})

function prepared(root: string, ruOnly = false) {
  const dist = path.join(root, 'dist')
  fs.mkdirSync(dist)
  const contents = JSON.parse(fixtureManifest)
  if (ruOnly) contents.clusters.forEach((cluster: any) => { cluster.members = { ru: cluster.members.ru } })
  fs.writeFileSync(path.join(dist, 'quest-seo-manifest.v1.json'), ruOnly ? JSON.stringify(contents) : fixtureManifest)
  fs.writeFileSync(path.join(dist, '.build-source.json'), JSON.stringify({ sha: candidate.frontend_sha }))
  fs.writeFileSync(path.join(dist, 'index.html'), 'whole export')
  const file = path.join(root, 'private', 'state.json')
  fs.mkdirSync(path.dirname(file))
  fs.writeFileSync(file, JSON.stringify({ schema_version: 1, phase: 'overlaid', base: { schema_version: 1, kind: 'managed', current: prior, previous: null } }))
  prepare(dist, file)
  return { dist, file }
}

function remote(options: { failure?: string; gateway?: Record<string, unknown>; gatewayRaw?: string; postRetain?: 'refuse'; generations?: string[] } = {}) {
  let current = prior
  const operations: string[] = []
  const t = {
    app: 'app', nginx: 'nginx', remote: '/remote', ssh: jest.fn((command: string, _transportOptions?: any) => {
      if (!command.startsWith(GATEWAY_MARKER)) return ''
      operations.push('gateway')
      if (options.failure === 'gateway-network') throw new Error('gateway network unavailable')
      return options.gatewayRaw ?? JSON.stringify({ ...gatewayReceipt, ...options.gateway })
    }),
    operation: (action: string, args: string[], transportOptions?: any) => {
      operations.push(action)
      if (action === 'inspect') return JSON.stringify({ schema_version: 1, kind: 'managed', current, previous: current === prior ? null : prior,
        ...(options.generations ? { generations: options.generations } : {}) })
      if (action === 'retain-v2') {
        const after = current.release_id === candidate.release_id
        if (after && options.postRetain === 'refuse') throw new Error('Protected generations exceed retention bounds')
        return JSON.stringify({ schema_version: 2, result: 'cleaned', active_release_id: current.release_id,
          preserved: after ? [current.release_id, prior.release_id] : [current.release_id], removed: [],
          remaining_bytes: 100, remaining_allocated_bytes: after ? 300 : 100 })
      }
      if (action === 'inventory-v2') return JSON.stringify({ schema_version: 2, release_count: 1, total_bytes: 3000000000,
        allocated_bytes: 100, budget_bytes: Number(args[0]) })
      if (action === 'transfer-plan-v3') {
        const index = JSON.parse(transportOptions.input.toString()), incremental = 100, directories = 4096, temporary = 4096, privateBytes = 8 * 1024 ** 2
        const peak = 100 + incremental + directories + temporary + privateBytes
        const plan: Record<string, any> = { schema_version: 2, expected_current: args[0] === 'none' ? null : args[0], index_sha256: sha256(transportOptions.input),
          budget_bytes: Number(args[1]), reserve_bytes: Number(args[2]), logical_bytes: index.files.reduce((sum: number, row: any) => sum + row.size, 0),
          physical_bytes: 100, incremental_bytes: incremental, directory_allowance_bytes: directories, temporary_bytes: temporary,
          private_index_bytes: privateBytes, peak_bytes: peak, required_free_bytes: peak - 100 + Number(args[2]), sources_sha256: 'e'.repeat(64) }
        plan.plan_sha256 = sha256(canonicalJson(plan))
        const first = new Map()
        for (const row of index.files.sort((a: any, b: any) => a.path < b.path ? -1 : 1)) {
          const key = canonicalJson([row.sha256, row.size, row.mode, row.mtime])
          if (!first.has(key)) first.set(key, row.path)
        }
        const transfer = { schema_version: 3, storage_plan: plan, required_paths: [...first.values()].sort() }
        return JSON.stringify({ ...transfer, transfer_plan_sha256: sha256(canonicalJson(transfer)) })
      }
      if (action === 'stage-v3') {
        const frame = fs.readFileSync(transportOptions.stdio[0]), indexLength = frame.readUInt32BE(0), planLength = frame.readUInt32BE(4)
        const transfer = JSON.parse(frame.subarray(8 + indexLength, 8 + indexLength + planLength).toString()), plan = transfer.storage_plan
        return JSON.stringify({ schema_version: 3, result: 'staged', release_id: args[0], index_sha256: plan.index_sha256,
          plan_sha256: plan.plan_sha256, transfer_plan_sha256: transfer.transfer_plan_sha256, allocated_bytes: 200, max_rss_bytes: 123456 })
      }
      if (action === 'abort-stage-v2') return JSON.stringify({ schema_version: 2, result: 'aborted', release_id: args[0],
        index_sha256: args[2], plan_sha256: args[3] })
      if (action === 'cover') {
        if (args[0] !== current.release_id) throw new Error('cover CAS refused')
        if (options.failure === 'cover' && current.release_id === candidate.release_id) throw new Error('cover publication failed')
        return JSON.stringify({ schema_version: 1, result: 'published', release_id: args[0], sha256: 'e'.repeat(64) })
      }
      if (action === 'activate') {
        if (args[2] !== current.release_id) throw new Error('CAS refused')
        // Activation validates the candidate in full before it swaps the pointer.
        if (options.failure === 'activation-validation' && args[0] === candidate.release_id) throw new Error('source drift')
        if (options.failure === 'before-rename') throw new Error('crash before rename')
        const replay = current.release_id === args[0]
        current = args[0] === prior.release_id ? prior : { schema_version: 1, ...candidate, tree_sha256: 'e'.repeat(64) }
        if (options.failure === 'after-rename' && !replay) throw new Error('lost stdout after rename')
        return JSON.stringify(receipt(args[0] === prior.release_id ? prior : candidate, 'activated', replay ? prior.release_id : args[2]))
      }
      throw new Error('unknown action')
    },
  }
  return { t, operations, current: () => current, replace: () => { current = { ...prior, release_id: 'newer-owner-release' } } }
}

describe('normal managed publication orchestration', () => {
  const originalBudget = process.env.QUEST_SEO_MANAGED_MAX_BYTES
  beforeAll(() => { process.env.QUEST_SEO_MANAGED_MAX_BYTES = '2147483648' })
  afterAll(() => {
    if (originalBudget === undefined) delete process.env.QUEST_SEO_MANAGED_MAX_BYTES
    else process.env.QUEST_SEO_MANAGED_MAX_BYTES = originalBudget
  })
  it('retains before planning physical storage, then activates without a separate validate-only pass or cleanup inside activation', () => {
    const root = makeTempDir('quest-e-publish-')
    try {
      const p = prepared(root), r = remote()
      publish(r.t, p.dist, p.file, jest.fn())
      const state = JSON.parse(fs.readFileSync(p.file, 'utf8'))
      expect(state.phase).toBe('ready')
      expect(r.operations).toEqual(['inspect', 'gateway', 'retain-v2', 'transfer-plan-v3', 'stage-v3', 'activate', 'cover', 'retain-v2'])
      expect(r.current().release_id).toBe(candidate.release_id)
      expect(fs.statSync(p.file).mode & 0o777).toBe(0o600)
      expect(fs.statSync(`${p.file}.package.tar.gz`).mode & 0o777).toBe(0o600)
      expect(fs.statSync(`${p.file}.files.v2.json`).mode & 0o777).toBe(0o600)
      expect(fs.existsSync(`${p.file}.stage-v3`)).toBe(false)
      expect(state.storage_plan.peak_bytes).toBeLessThan(Number(process.env.QUEST_SEO_MANAGED_MAX_BYTES))
      expect(state.storage_plan.reserve_bytes).toBe(1536 * 1024 ** 2)
      expect(state.staged.max_rss_bytes).toBe(123456)
      expect(state.gateway_probe_path).toBe(gatewayReceipt.probe_path)
      expect(state.gateway).toEqual(gatewayReceipt)
    } finally { removeDir(root) }
  })
  it.each([0, -1, 1.5, null, '123456'])('refuses malformed peak RSS %j before validation or activation', maxRss => {
    const root = makeTempDir('quest-e-rss-refusal-')
    try {
      const p = prepared(root), r = remote(), operation = r.t.operation
      r.t.operation = (action: string, args: string[], options?: any) => {
        const raw = operation(action, args, options)
        return action === 'stage-v3' ? JSON.stringify({ ...JSON.parse(raw), max_rss_bytes: maxRss }) : raw
      }
      expect(() => publish(r.t, p.dist, p.file, jest.fn())).toThrow('generations retained')
      expect(r.operations).not.toContain('activate')
      expect(r.current()).toEqual(prior)
    } finally { removeDir(root) }
  })
  it.each(['activation-validation', 'before-rename', 'after-rename'])('retains generations and actual-pointer evidence on %s failure', (failure) => {
    const root = makeTempDir('quest-e-crash-')
    try {
      const p = prepared(root), r = remote({ failure })
      expect(() => publish(r.t, p.dist, p.file, jest.fn())).toThrow('generations retained')
      const state = JSON.parse(fs.readFileSync(p.file, 'utf8'))
      expect(state.phase).toBe('inspect-required')
      expect(state.actual.current.release_id).toBe(failure === 'after-rename' ? candidate.release_id : prior.release_id)
      expect(fs.existsSync(`${p.file}.package.tar.gz`)).toBe(true)
      expect(r.operations.filter((x) => x === 'activate')).toHaveLength(1)
      if (failure === 'after-rename') {
        recover(r.t, p.file, jest.fn())
        const recovered = JSON.parse(fs.readFileSync(p.file, 'utf8'))
        expect(recovered.activated.previous_release_id).toBe(prior.release_id)
        expect(recovered.post_ready_retention.preserved).toEqual([candidate.release_id, prior.release_id])
      } else expect(() => recover(r.t, p.file, jest.fn())).toThrow('another release')
    } finally { removeDir(root) }
  })
  it('trims back to the new current and its rollback only after readiness, reporting the generation count', () => {
    const root = makeTempDir('quest-e-post-retain-')
    const log = jest.spyOn(console, 'log').mockImplementation(() => {})
    try {
      const p = prepared(root), r = remote()
      publish(r.t, p.dist, p.file, jest.fn())
      const state = JSON.parse(fs.readFileSync(p.file, 'utf8'))
      expect(state.phase).toBe('ready')
      expect(state.post_ready_retention.active_release_id).toBe(candidate.release_id)
      expect(state.post_ready_retention.preserved).toEqual([candidate.release_id, prior.release_id])
      expect(log).toHaveBeenCalledWith(expect.stringMatching(/^📊 Поколения quest v1 после выката: 2 \(снято 0\)/))
    } finally { log.mockRestore(); removeDir(root) }
  })
  it('skips the pre-staging cleanup when only the current and its rollback are on disk and reports per-operation time', () => {
    const root = makeTempDir('quest-e-skip-retain-')
    const log = jest.spyOn(console, 'log').mockImplementation(() => {})
    try {
      const p = prepared(root), r = remote({ generations: [prior.release_id] })
      publish(r.t, p.dist, p.file, jest.fn())
      const state = JSON.parse(fs.readFileSync(p.file, 'utf8'))
      expect(r.operations).toEqual(['inspect', 'gateway', 'transfer-plan-v3', 'stage-v3', 'activate', 'cover', 'retain-v2'])
      expect(state.retention).toBeUndefined()
      expect(Object.keys(state.timings)).toEqual(['hash', 'preflight', 'inspect', 'gateway', 'transfer-plan', 'disk-guard',
        'frame', 'stage', 'activate', 'cover', 'readiness', 'retain-after-ready', 'local-retention'])
      expect(Object.values(state.timings).every((seconds) => typeof seconds === 'number' && seconds >= 0)).toBe(true)
      expect(log).toHaveBeenCalledWith(expect.stringMatching(/^📊 quest v1 публикация по операциям: hash \d+ с · preflight \d+ с/))
    } finally { log.mockRestore(); removeDir(root) }
  })
  it('still runs the pre-staging cleanup when a third generation is left on disk', () => {
    const root = makeTempDir('quest-e-extra-generation-')
    try {
      const p = prepared(root), r = remote({ generations: ['leftover', prior.release_id] })
      publish(r.t, p.dist, p.file, jest.fn())
      expect(r.operations.slice(0, 4)).toEqual(['inspect', 'gateway', 'retain-v2', 'transfer-plan-v3'])
    } finally { removeDir(root) }
  })
  it('refuses a generation list that omits the active release', () => {
    const r = remote({ generations: ['other'] })
    expect(() => inspect(r.t)).toThrow('Invalid managed generation list')
  })
  it('reports the timings of a failed publication without hiding the failure', () => {
    const root = makeTempDir('quest-e-failed-timings-')
    const log = jest.spyOn(console, 'log').mockImplementation(() => {})
    try {
      const p = prepared(root), r = remote({ failure: 'activation-validation' })
      expect(() => publish(r.t, p.dist, p.file, jest.fn())).toThrow('source drift')
      expect(JSON.parse(fs.readFileSync(p.file, 'utf8')).timings.activate).toBeGreaterThanOrEqual(0)
      expect(log).toHaveBeenCalledWith(expect.stringContaining('activate'))
    } finally { log.mockRestore(); removeDir(root) }
  })
  it('keeps a ready publication when post-readiness retention is refused', () => {
    const root = makeTempDir('quest-e-post-retain-refused-')
    const log = jest.spyOn(console, 'log').mockImplementation(() => {})
    try {
      const p = prepared(root), r = remote({ postRetain: 'refuse' })
      expect(() => publish(r.t, p.dist, p.file, jest.fn())).not.toThrow()
      const state = JSON.parse(fs.readFileSync(p.file, 'utf8'))
      expect(state.phase).toBe('ready')
      expect(state.post_ready_retention).toBeUndefined()
      expect(r.current().release_id).toBe(candidate.release_id)
      expect(log).toHaveBeenCalledWith(expect.stringMatching(/^⚠️ {2}Ретеншен .*exceed retention bounds/))
    } finally { log.mockRestore(); removeDir(root) }
  })
  it('does not trim generations when readiness fails and the publication rolls back', () => {
    const root = makeTempDir('quest-e-post-retain-rollback-')
    try {
      const p = prepared(root), r = remote()
      const health = jest.fn().mockImplementationOnce(() => { throw new Error('readiness failed') })
      expect(() => publish(r.t, p.dist, p.file, health)).toThrow('readiness failed')
      expect(r.operations.filter((action) => action === 'retain-v2')).toHaveLength(1)
    } finally { removeDir(root) }
  })
  it('rolls back health failure through the same backend command and preserves archive evidence', () => {
    const root = makeTempDir('quest-e-rollback-')
    try {
      const p = prepared(root), r = remote()
      const health = jest.fn().mockImplementationOnce(() => { throw new Error('readiness failed') })
      expect(() => publish(r.t, p.dist, p.file, health)).toThrow('readiness failed')
      expect(r.current()).toEqual(prior)
      expect(JSON.parse(fs.readFileSync(p.file, 'utf8')).phase).toBe('rolled-back')
    } finally { removeDir(root) }
  })
  it('does not roll back over a newer publisher', () => {
    const root = makeTempDir('quest-e-newer-')
    try {
      const p = prepared(root), r = remote()
      expect(() => publish(r.t, p.dist, p.file, () => { r.replace(); throw new Error('health failed') }))
        .toThrow('health failed; rollback failed: CAS refused')
      expect(JSON.parse(fs.readFileSync(p.file, 'utf8')).failure).toBe('health failed')
      expect(r.current().release_id).toBe('newer-owner-release')
      expect(fs.existsSync(`${p.file}.package.tar.gz`)).toBe(true)
    } finally { removeDir(root) }
  })
  it('rolls back failed shared-cover publication before reporting readiness', () => {
    const root = makeTempDir('quest-e-cover-rollback-')
    try {
      const p = prepared(root), r = remote({ failure: 'cover' }), health = jest.fn()
      expect(() => publish(r.t, p.dist, p.file, health)).toThrow('cover publication failed')
      expect(r.current()).toEqual(prior)
      expect(health).toHaveBeenCalledTimes(1)
      expect(health.mock.calls[0].slice(0, 2)).toEqual([r.t, prior])
      expect(r.operations.slice(-3)).toEqual(['cover', 'activate', 'cover'])
      expect(JSON.parse(fs.readFileSync(p.file, 'utf8'))).toMatchObject({ phase: 'rolled-back', failure: 'cover publication failed' })
    } finally { removeDir(root) }
  })
  // Production full-tree validation inside activation took 41 s (17.10.2026);
  // a deadline anchored before the switch expired before the cover was tried.
  function slowActivation(r: ReturnType<typeof remote>, clock: { offset: number }) {
    const operation = r.t.operation, coverTimeouts: number[] = []
    r.t.operation = (action: string, args: string[], options?: any) => {
      if (action === 'cover') coverTimeouts.push(options.timeout)
      const output = operation(action, args, options)
      if (action === 'activate') clock.offset += 41000
      return output
    }
    return coverTimeouts
  }
  it('starts the readiness deadline when a slow activation has switched the pointer', () => {
    const root = makeTempDir('quest-e-slow-activation-'), clock = { offset: 0 }, realNow = Date.now
    const now = jest.spyOn(Date, 'now').mockImplementation(() => realNow() + clock.offset)
    try {
      const p = prepared(root), r = remote(), coverTimeouts = slowActivation(r, clock), health = jest.fn()
      publish(r.t, p.dist, p.file, health)
      const state = JSON.parse(fs.readFileSync(p.file, 'utf8'))
      expect(state.phase).toBe('ready')
      expect(state.activated_at - state.activation_started_at).toBeGreaterThanOrEqual(41000)
      expect(coverTimeouts[0]).toBeGreaterThan(25000)
      expect(health.mock.calls[0][2]).toBe(state.activated_at + 30000)
    } finally { now.mockRestore(); removeDir(root) }
  })
  it('gives rollback and recovery their own readiness budget after a slow activation', () => {
    const root = makeTempDir('quest-e-slow-recovery-'), replayRoot = makeTempDir('quest-e-slow-replay-')
    const clock = { offset: 0 }, realNow = Date.now
    const now = jest.spyOn(Date, 'now').mockImplementation(() => realNow() + clock.offset)
    try {
      const p = prepared(root), r = remote(), coverTimeouts = slowActivation(r, clock)
      const health = jest.fn().mockImplementationOnce(() => { throw new Error('readiness failed') })
      expect(() => publish(r.t, p.dist, p.file, health)).toThrow('readiness failed')
      expect(r.current()).toEqual(prior)
      expect(r.operations.slice(-3)).toEqual(['cover', 'activate', 'cover'])
      expect(coverTimeouts).toHaveLength(2)
      expect(coverTimeouts[1]).toBeGreaterThan(25000)
      expect(health.mock.calls[1][2]).toBeGreaterThan(Date.now() + 25000)

      const q = prepared(replayRoot), s = remote({ failure: 'after-rename' }), replayTimeouts = slowActivation(s, clock)
      expect(() => publish(s.t, q.dist, q.file, jest.fn())).toThrow('generations retained')
      const replayHealth = jest.fn()
      recover(s.t, q.file, replayHealth)
      expect(JSON.parse(fs.readFileSync(q.file, 'utf8')).phase).toBe('ready')
      expect(replayTimeouts[0]).toBeGreaterThan(25000)
      expect(replayHealth.mock.calls[0][2]).toBeGreaterThan(Date.now() + 25000)
    } finally { now.mockRestore(); removeDir(root); removeDir(replayRoot) }
  })
  it('refuses archive drift, stale CAS and normal legacy conversion before staging', () => {
    for (const condition of ['archive', 'index', 'current', 'legacy']) {
      const root = makeTempDir('quest-e-refusal-')
      try {
        const p = prepared(root), r = remote()
        if (condition === 'archive') fs.appendFileSync(`${p.file}.package.tar.gz`, 'changed')
        if (condition === 'index') fs.appendFileSync(`${p.file}.files.v2.json`, 'changed')
        if (condition === 'current') r.replace()
        if (condition === 'legacy') {
          const state = JSON.parse(fs.readFileSync(p.file, 'utf8')); state.base.kind = 'legacy'; state.base.current = null
          fs.writeFileSync(p.file, JSON.stringify(state))
        }
        expect(() => publish(r.t, p.dist, p.file, jest.fn())).toThrow()
        expect(r.operations).not.toContain('stage-v3')
        if (condition === 'archive' || condition === 'index') expect(r.operations).toEqual([])
      } finally { removeDir(root) }
    }
  })
  it('requires an explicit inventory budget and rejects inventory mismatch without writes', () => {
    const r = remote()
    delete process.env.QUEST_SEO_MANAGED_MAX_BYTES
    expect(() => checkInventory(r.t, 100)).toThrow('Owner-selected')
    expect(r.operations).toEqual([])
    process.env.QUEST_SEO_MANAGED_MAX_BYTES = '99'
    expect(() => checkInventory(r.t, 100)).toThrow('budget mismatch')
    process.env.QUEST_SEO_MANAGED_MAX_BYTES = '2147483648'
  })
  it('owner baseline refuses both missing maintenance scope and a still-present legacy root', () => {
    const root = makeTempDir('quest-e-baseline-'), original = process.env.QUEST_SEO_OWNER_MAINTENANCE
    try {
      const p = prepared(root), r = remote()
      delete process.env.QUEST_SEO_OWNER_MAINTENANCE
      expect(() => baseline(r.t, p.file, jest.fn())).toThrow('separately authorized')
      expect(r.operations).toEqual([])
      const state = JSON.parse(fs.readFileSync(p.file, 'utf8')); state.base.kind = 'legacy'; state.base.current = null; state.ru_only = true
      fs.writeFileSync(p.file, JSON.stringify(state))
      process.env.QUEST_SEO_OWNER_MAINTENANCE = '1'
      expect(() => baseline(r.t, p.file, jest.fn())).toThrow('quiesce and move')
      expect(r.operations).not.toContain('stage-v3')
    } finally {
      if (original === undefined) delete process.env.QUEST_SEO_OWNER_MAINTENANCE; else process.env.QUEST_SEO_OWNER_MAINTENANCE = original
      removeDir(root)
    }
  })
  it('aborts an interrupted candidate only from its saved private plan and never automatically on failure', () => {
    const root = makeTempDir('quest-e-abort-')
    try {
      const p = prepared(root), r = remote({ failure: 'activation-validation' })
      expect(() => abortStage(r.t, p.file)).toThrow('Saved private staging plan')
      expect(r.operations).toEqual([])
      expect(() => publish(r.t, p.dist, p.file, jest.fn())).toThrow('generations retained')
      expect(r.operations).not.toContain('abort-stage-v2')
      abortStage(r.t, p.file)
      expect(r.operations.at(-1)).toBe('abort-stage-v2')
      expect(JSON.parse(fs.readFileSync(p.file, 'utf8')).phase).toBe('aborted')
      expect(r.current()).toEqual(prior)
      expect(() => abortStage(r.t, p.file)).toThrow('Hash-bound interrupted staging state')
    } finally { removeDir(root) }
  })

  it.each([200, 404])('requires the live canonical locale gateway with exact no-cache headers, accepting status %s', (status) => {
    const root = makeTempDir('quest-e-gateway-')
    try {
      const p = prepared(root), r = remote({ gateway: { status } })
      publish(r.t, p.dist, p.file, jest.fn())
      const call = r.t.ssh.mock.calls.find(([command]: [string]) => command.startsWith(GATEWAY_MARKER))
      expect(call?.[1]).toEqual({ timeout: 20000, maxBuffer: 4096 })
      expect(r.operations.indexOf('gateway')).toBeLessThan(r.operations.indexOf('retain-v2'))
      expect(JSON.parse(fs.readFileSync(p.file, 'utf8')).gateway.status).toBe(status)
    } finally { removeDir(root) }
  })

  it('executes the emitted gateway program with mocked Docker/HTTP and bounded HEAD semantics', () => {
    const root = makeTempDir('quest-e-gateway-program-')
    try {
      const p = prepared(root), r = remote()
      publish(r.t, p.dist, p.file, jest.fn())
      const command = r.t.ssh.mock.calls.find(([value]: [string]) => value.startsWith(GATEWAY_MARKER))?.[0]
      const result = runCli('python3', ['-B', '-c', `
import email.message,hashlib,pathlib,shlex,subprocess,sys,types,urllib.request
command,root=sys.argv[1:]; code=shlex.split(command.partition(chr(10))[2])[2]
root=pathlib.Path(root); config=root/'deploy/prod/nginx/nginx.conf'; config.parent.mkdir(parents=True); config.write_bytes(b'canonical gateway')
digest=hashlib.sha256(config.read_bytes()).hexdigest()
def docker(args,**options):
 assert args==['docker','exec','nginx','sha256sum','/etc/nginx/conf/nginx.conf'] and options['timeout']==5 and options['check'] is True
 return types.SimpleNamespace(stdout=(digest+'  /etc/nginx/conf/nginx.conf\\n').encode())
subprocess.run=docker
class Response:
 status=404
 headers=email.message.Message()
 headers['Cache-Control']='no-store'; headers['Pragma']='no-cache'; headers['Expires']='0'
 def __enter__(self):return self
 def __exit__(self,*args):pass
class Opener:
 def open(self,request,timeout):
  assert request.get_method()=='HEAD' and request.full_url=='https://metravel.by/pl/quests/1/minsk-proof' and timeout==5
  return Response()
def opener(*handlers):
 assert handlers[-1].redirect_request(None,None,None,None,None,None) is None
 return Opener()
urllib.request.build_opener=opener
sys.argv=['gateway',str(root),'nginx','/pl/quests/1/minsk-proof']
exec(compile(code,'<emitted-gateway>','exec'))
`, command, root])
      expect(result.status).toBe(0)
      expect(JSON.parse(result.stdout)).toEqual({ ...gatewayReceipt,
        canonical_sha256: sha256('canonical gateway'), running_sha256: sha256('canonical gateway') })
    } finally { removeDir(root) }
  })

  it.each([
    ['legacy static headers', { cache_control: 'public, max-age=300', pragma: '', expires: '' }],
    ['missing no-store', { cache_control: 'no-cache' }], ['digest mismatch', { running_sha256: 'f'.repeat(64) }],
    ['stale caching pragma', { pragma: null }], ['expiry mismatch', { expires: '1' }],
    ['upstream failure', { status: 503 }], ['redirect', { status: 301 }],
    ['wrong probed path', { probe_path: '/en/quests/1/other' }], ['unexpected receipt field', { extra: true }],
  ])('refuses %s before retention or staging', (_label, gateway) => {
    const root = makeTempDir('quest-e-gateway-refuse-')
    try {
      const p = prepared(root), r = remote({ gateway })
      expect(() => publish(r.t, p.dist, p.file, jest.fn())).toThrow()
      expect(r.operations).toEqual(['inspect', 'gateway'])
      expect(JSON.parse(fs.readFileSync(p.file, 'utf8')).phase).toBe('prepared')
    } finally { removeDir(root) }
  })

  it.each(['network', 'oversized', 'duplicate'])('refuses %s gateway evidence before writes', (failure) => {
    const root = makeTempDir('quest-e-gateway-wire-')
    try {
      const p = prepared(root), r = remote(failure === 'network' ? { failure: 'gateway-network' }
        : { gatewayRaw: failure === 'oversized' ? ' '.repeat(4097) : JSON.stringify(gatewayReceipt).replace('{', '{"status":200,') })
      expect(() => publish(r.t, p.dist, p.file, jest.fn())).toThrow()
      expect(r.operations).toEqual(['inspect', 'gateway'])
    } finally { removeDir(root) }
  })

  it.each(['/pl/quests/1/other', '/pl/quests/01/minsk-proof', '/pl/quests/1/minsk-proof?x=1', 'https://foreign.test/', null])(
    'binds prepared probe %s to the checked manifest before contacting the server', (probe) => {
      const root = makeTempDir('quest-e-gateway-path-')
      try {
        const p = prepared(root), r = remote(), state = JSON.parse(fs.readFileSync(p.file, 'utf8'))
        state.gateway_probe_path = probe
        fs.writeFileSync(p.file, JSON.stringify(state))
        expect(() => publish(r.t, p.dist, p.file, jest.fn())).toThrow('Prepared publication mode or gateway probe path changed')
        expect(r.operations).toEqual([])
        expect(r.t.ssh).not.toHaveBeenCalled()
      } finally { removeDir(root) }
    })

  it('rejects a forged RU-only flag and bypasses gateway probing only for an actual RU-only manifest', () => {
    const root = makeTempDir('quest-e-gateway-mode-'), ruRoot = makeTempDir('quest-e-gateway-ru-')
    try {
      const p = prepared(root), r = remote(), state = JSON.parse(fs.readFileSync(p.file, 'utf8'))
      state.ru_only = true; delete state.gateway_probe_path
      fs.writeFileSync(p.file, JSON.stringify(state))
      expect(() => publish(r.t, p.dist, p.file, jest.fn())).toThrow('Prepared publication mode or gateway probe path changed')
      expect(r.operations).toEqual([])
      const ru = prepared(ruRoot, true)
      // Stop at validation: the fake remote's activation receipt is tied to the translated fixture.
      const ruRemote = remote({ failure: 'activation-validation' })
      expect(() => publish(ruRemote.t, ru.dist, ru.file, jest.fn())).toThrow('source drift')
      expect(ruRemote.operations).not.toContain('gateway')
      expect(ruRemote.operations).toContain('stage-v3')
      expect(JSON.parse(fs.readFileSync(ru.file, 'utf8')).gateway_probe_path).toBeUndefined()
    } finally { removeDir(root); removeDir(ruRoot) }
  })

  it('cannot activate a translated baseline by forging the private RU-only flag when the server refuses its actual members', () => {
    const root = makeTempDir('quest-e-baseline-members-'), original = process.env.QUEST_SEO_OWNER_MAINTENANCE
    try {
      const p = prepared(root), r = remote(), operation = r.t.operation
      const state = JSON.parse(fs.readFileSync(p.file, 'utf8'))
      state.base = { schema_version: 1, kind: 'legacy', current: null, previous: null }
      state.ru_only = true
      fs.writeFileSync(p.file, JSON.stringify(state))
      r.t.operation = (action: string, args: string[], options?: any) => {
        if (action === 'inspect') { r.operations.push(action); return JSON.stringify({ schema_version: 1, kind: 'absent', current: null, previous: null }) }
        // stage_v3 checks the received manifest's actual member set for a none-CAS baseline.
        if (action === 'stage-v3') { r.operations.push(action); throw new Error('First v1 generation must be RU-only') }
        return operation(action, args, options)
      }
      process.env.QUEST_SEO_OWNER_MAINTENANCE = '1'
      expect(() => baseline(r.t, p.file, jest.fn())).toThrow('First v1 generation must be RU-only')
      expect(r.operations).not.toContain('activate')
    } finally {
      if (original === undefined) delete process.env.QUEST_SEO_OWNER_MAINTENANCE; else process.env.QUEST_SEO_OWNER_MAINTENANCE = original
      removeDir(root)
    }
  })
})

describe('real private archive and operation lock', () => {
  it('executes the exact preflight shell for checkout safety and physical shared bind roots', () => {
    const root = makeTempDir('quest-e-preflight-')
    try {
      const repo = path.join(fs.realpathSync(root), "repo ' $literal"), bin = path.join(root, 'bin'), statusFile = path.join(root, 'status')
      fs.mkdirSync(path.join(repo, 'static'), { recursive: true }); fs.mkdirSync(bin)
      fs.writeFileSync(path.join(bin, 'git'), '#!/bin/sh\ncase "$1" in status) cat "$QUEST_TEST_STATUS_FILE";; ls-files) printf %s "$QUEST_TEST_TRACKED";; *) exit 2;; esac\n', { mode: 0o755 })
      fs.writeFileSync(path.join(bin, 'docker'), `#!/usr/bin/env python3
import os, sys
if sys.argv[1] == 'inspect':
    print(os.environ['QUEST_TEST_APP_MOUNTS' if sys.argv[-1] == 'app' else 'QUEST_TEST_NGINX_MOUNTS'])
elif sys.argv[1] == 'exec':
    if os.environ.get('QUEST_TEST_EXEC_FAIL') == sys.argv[2]: sys.exit(1)
    assert sys.argv[3:5] == ['sh', '-c']
    assert 'test ! -L' in sys.argv[5] and 'readlink -f' in sys.argv[5]
    assert 'stat -c "%d:%i:%u"' in sys.argv[5]
    if sys.argv[2] == 'app':
        assert 'test -w' in sys.argv[5] and 'test -x' in sys.argv[5] and 'id -u' in sys.argv[5]
    print(os.environ.get('QUEST_TEST_BAD_IDENTITY') or os.environ['QUEST_TEST_IDENTITY'])
else: sys.exit(2)
`, { mode: 0o755 })
      let command = ''
      const t = { ...remote().t, remote: repo, ssh: (value: string) => { command = value; throw new Error('captured locally') } }
      expect(() => overlay(t, path.join(root, 'dist'), path.join(root, 'state.json'))).toThrow('captured locally')
      expect(command).toContain('static/quests/quest-default-cover.svg')
      const staticPath = path.join(repo, 'static'), info = fs.statSync(staticPath)
      const bind = (source: string, destination = '/app/static', rw = true) => ({ Type: 'bind', Source: source, Destination: destination, RW: rw })
      const app = [bind(staticPath)], nginx = [bind(staticPath, '/usr/local/metravel/static', false)]
      const linkedSource = path.join(repo, 'static-link')
      fs.symlinkSync(staticPath, linkedSource)
      for (const fixture of [
        { pass: true },
        { app: [bind(repo, '/app')], pass: true },
        { app: [bind(repo, '/app'), ...app], pass: true },
        { nginx: [bind(repo, '/usr/local/metravel', false)], pass: true },
        { status: '?? dump.sql\n?? deploy/prod/nginx/ssl/\n?? dist/\n', pass: true },
        { status: ' M quests/views.py\n', pass: false },
        { status: '?? unknown/\n', pass: false },
        { tracked: 'static/dist/index.html\n', pass: false },
        { app: [bind(repo)], pass: false },
        { nginx: [bind(repo, '/usr/local/metravel/static')], pass: false },
        { app: [bind(staticPath, '/app/static-other')], pass: false },
        { app: [bind(staticPath, '/app/static', false)], pass: false },
        { app: [{ ...app[0], Type: 'volume' }], pass: false },
        { app: [bind(repo, '/app'), { ...app[0], Type: 'tmpfs' }], pass: false },
        { app: [...app, bind(staticPath, '/app/static/dist')], pass: false },
        { nginx: [...nginx, bind(staticPath, '/usr/local/metravel/static/quest-seo-releases')], pass: false },
        { app: [...app, ...app], pass: false },
        { app: [bind(linkedSource)], pass: false },
        { app: [bind(`${repo}/../${path.basename(repo)}/static`)], pass: false },
        { app: [bind(staticPath, '/app//static')], pass: false },
        { badIdentity: `${info.dev}:${info.ino + 1}:${info.uid}`, pass: false },
        { badIdentity: `${info.dev}:${info.ino}:${info.uid + 1}`, pass: false },
        { execFail: 'app', pass: false },
        { execFail: 'nginx', pass: false },
        { appJson: '{}', pass: false },
        { appJson: '{', pass: false },
      ]) {
        fs.writeFileSync(statusFile, fixture.status || '')
        const result = runCli('bash', ['-c', command], { env: {
          PATH: `${bin}:${process.env.PATH}`, QUEST_TEST_STATUS_FILE: statusFile,
          QUEST_TEST_TRACKED: fixture.tracked || '',
          QUEST_TEST_APP_MOUNTS: fixture.appJson || JSON.stringify(fixture.app || app),
          QUEST_TEST_NGINX_MOUNTS: JSON.stringify(fixture.nginx || nginx),
          QUEST_TEST_IDENTITY: `${info.dev}:${info.ino}:${info.uid}`,
          QUEST_TEST_BAD_IDENTITY: fixture.badIdentity || '', QUEST_TEST_EXEC_FAIL: fixture.execFail || '',
        } })
        expect({ fixture, pass: result.status === 0 }).toEqual({ fixture, pass: fixture.pass })
      }
    } finally { removeDir(root) }
  })

  it('publishes only the active sealed cover under the operation lock without mutating the package', () => {
    const root = makeTempDir('quest-e-cover-transport-')
    try {
      const result = runCli('python3', ['-B', '-c', `
import contextlib, fcntl, hashlib, importlib.util, os, pathlib, sys
spec=importlib.util.spec_from_file_location('m',sys.argv[1]); m=importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
root=pathlib.Path(sys.argv[2]).resolve(); static=root/'static'; releases=static/'quest-seo-releases'; release=releases/'candidate'; source=release/'dist/static/quests/quest-default-cover.svg'; source.parent.mkdir(parents=True); source.write_bytes(b'<svg>candidate</svg>'); active=static/'dist'; active.symlink_to('quest-seo-releases/candidate/dist')
@contextlib.contextmanager
def lock():
 with (static/'.quest-seo-operation.lock').open('a+b') as fd:
  fcntl.flock(fd,fcntl.LOCK_EX); yield
class Package:
 SLUG=None
 operation_lock=staticmethod(lock)
 @staticmethod
 def _match(pattern,value):assert value=='candidate'
 @staticmethod
 def regular_file(root,name,maximum):
  target=root
  for part in name.split('/'):
   target=target/part
   assert not target.is_symlink()
  value=target.read_bytes(); assert len(value)<=maximum; return value
class Activation:
 current='candidate'
 def current_release(self):return self.current
 def sealed_identity(self,release):return {'frontend_sha':'a'*40,'manifest_sha256':'b'*64}
a=Activation(); arguments=['candidate','a'*40,'b'*64]; replace=m.os.replace
def checked_replace(source,target):
 fd=os.open(static/'.quest-seo-operation.lock',os.O_RDWR)
 try:
  try:fcntl.flock(fd,fcntl.LOCK_EX|fcntl.LOCK_NB); raise AssertionError('cover write escaped operation lock')
  except BlockingIOError:pass
 finally:os.close(fd)
 return replace(source,target)
m.os.replace=checked_replace
receipt=m.publish_cover(Package(),a,active,releases,arguments); target=static/'quests/quest-default-cover.svg'
assert receipt['sha256']==hashlib.sha256(source.read_bytes()).hexdigest() and target.read_bytes()==source.read_bytes()
source_bytes=source.read_bytes(); target.unlink(); target.symlink_to(source)
try:m.publish_cover(Package(),a,active,releases,arguments); raise AssertionError('cover symlink accepted')
except ValueError:pass
target.unlink(); (static/'quests').rmdir(); (static/'quests').symlink_to(source.parent)
try:m.publish_cover(Package(),a,active,releases,arguments); raise AssertionError('directory symlink accepted')
except ValueError:pass
(static/'quests').unlink(); a.current='newer'
try:m.publish_cover(Package(),a,active,releases,arguments); raise AssertionError('stale cover accepted')
except ValueError:pass
assert source.read_bytes()==source_bytes and not (static/'quests').exists()
print('sealed cover/lock/CAS PASS')
`, path.resolve('scripts/quest-seo-transport.py'), root])
      expect(result.status).toBe(0)
      expect(result.stdout).toContain('cover/lock/CAS PASS')
    } finally { removeDir(root) }
  })

  it('normalizes a symlinked TMPDIR before extracting pinned overlay assets', () => {
    const root = fs.realpathSync(makeTempDir('quest-e-overlay-'))
    const previousTmp = process.env.TMPDIR, previousBudget = process.env.QUEST_SEO_MANAGED_MAX_BYTES
    try {
      const old = path.join(root, 'old'), dist = path.join(root, 'dist'), archive = path.join(root, 'old.gz')
      fs.mkdirSync(old); fs.mkdirSync(path.join(dist, '_expo/static'), { recursive: true })
      fs.writeFileSync(path.join(old, 'previous.js'), 'previous runtime')
      fs.symlinkSync(root, path.join(root, 'tmp-link'))
      process.env.TMPDIR = path.join(root, 'tmp-link')
      process.env.QUEST_SEO_MANAGED_MAX_BYTES = '2147483648'
      const packed = runCli('python3', ['-B', '-c', 'import subprocess,sys\nwith open(sys.argv[3],"wb") as f: subprocess.run([sys.executable,sys.argv[1],"pack",sys.argv[2]],stdout=f,check=True)', path.resolve('scripts/quest-seo-transport.py'), old, archive])
      expect(packed.status).toBe(0)
      const r = remote(), operation = r.t.operation
      r.t.operation = (action: string, args: string[], options?: any) => {
        if (action === 'overlay') { fs.writeSync(options.stdio[1], fs.readFileSync(archive)); return '' }
        return operation(action, args)
      }
      overlay(r.t, dist, path.join(root, 'state.json'))
      expect(fs.readFileSync(path.join(dist, '_expo/static/previous.js'), 'utf8')).toBe('previous runtime')
    } finally {
      if (previousTmp === undefined) delete process.env.TMPDIR; else process.env.TMPDIR = previousTmp
      if (previousBudget === undefined) delete process.env.QUEST_SEO_MANAGED_MAX_BYTES; else process.env.QUEST_SEO_MANAGED_MAX_BYTES = previousBudget
      removeDir(root)
    }
  })

  it('keeps exact-200 readiness and a single deadline, with no network in the fixture', () => {
    const root = makeTempDir('quest-e-health-'), originalPath = process.env.PATH
    try {
      const executable = path.join(root, 'curl')
      fs.writeFileSync(executable, '#!/bin/sh\nprintf 301\n', { mode: 0o755 })
      process.env.PATH = `${root}:${originalPath}`
      const t = { nginx: 'nginx', ssh: jest.fn() }
      expect(() => readiness(t, candidate)).toThrow('exact HTTP 200')
      t.ssh.mockClear()
      expect(() => readiness(t, candidate, Date.now() - 1)).toThrow('30-second deadline')
      expect(t.ssh).not.toHaveBeenCalled()
    } finally { process.env.PATH = originalPath; removeDir(root) }
  })

  it('bounds the cover transport by the same readiness deadline and refuses expiration before SSH', () => {
    const t = { operation: jest.fn((_action: string, _args: string[], _options: { timeout: number }) => JSON.stringify({ schema_version: 1, result: 'published', release_id: candidate.release_id, sha256: 'e'.repeat(64) })) }
    publishCover(t, candidate, Date.now() + 1000)
    expect(t.operation.mock.calls[0][2].timeout).toBeLessThanOrEqual(1000)
    expect(t.operation.mock.calls[0][2].timeout).toBeGreaterThan(0)
    t.operation.mockClear()
    expect(() => publishCover(t, candidate, Date.now() - 1)).toThrow('deadline')
    expect(t.operation).not.toHaveBeenCalled()
  })

  it('writer death between legacy renames releases the same lock and cannot mutate a subsequent managed pointer', () => {
    const root = makeTempDir('quest-e-writer-death-')
    try {
      const result = runCli('python3', ['-B', '-c', `
import fcntl, importlib.util, os, pathlib, subprocess, sys
root=pathlib.Path(sys.argv[2]).resolve(); static=root/'static'; static.mkdir(); (static/'dist').mkdir(); (static/'dist.new').mkdir(); (static/'dist'/'old').write_text('retained'); (static/'dist.new'/'new').write_text('candidate')
child="""
import importlib.util, os, pathlib, signal, sys
spec=importlib.util.spec_from_file_location('m',sys.argv[1]); m=importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
static=pathlib.Path(sys.argv[2])/'static'; original=m.Path; m.Path=lambda p:static if p=='/app/static' else original(p)
rename=os.rename
def pause_after_first(a,b):
 result=rename(a,b)
 if str(b).endswith('dist.old'): print('first rename',flush=True); signal.pause()
 return result
os.rename=pause_after_first
m.legacy_operation('legacy-commit',[m.legacy_identity(static)])
"""
p=subprocess.Popen([sys.executable,'-B','-c',child,sys.argv[1],str(root)],stdout=subprocess.PIPE,text=True)
try:
 assert p.stdout.readline().strip()=='first rename'
 fd=os.open(static/'.quest-seo-operation.lock',os.O_RDWR)
 try:
  try:fcntl.flock(fd,fcntl.LOCK_EX|fcntl.LOCK_NB); raise AssertionError('writer failed to own lock')
  except BlockingIOError:pass
  p.kill(); p.wait(timeout=5); fcntl.flock(fd,fcntl.LOCK_EX|fcntl.LOCK_NB)
  (static/'dist').symlink_to('quest-seo-releases/new-owner/dist')
 finally:os.close(fd)
 spec=importlib.util.spec_from_file_location('m',sys.argv[1]); m=importlib.util.module_from_spec(spec); spec.loader.exec_module(m); original=m.Path; m.Path=lambda p:static if p=='/app/static' else original(p)
 try:m.legacy_operation('legacy-commit',['none']); raise AssertionError('managed pointer mutated')
 except ValueError:pass
 assert os.readlink(static/'dist')=='quest-seo-releases/new-owner/dist' and (static/'dist.old'/'old').read_text()=='retained'
 print('writer death and managed CAS PASS')
finally:
 if p.poll() is None:p.kill(); p.wait(timeout=5)
`, path.resolve('scripts/quest-seo-transport.py'), root])
      expect(result.status).toBe(0)
      expect(result.stdout).toContain('managed CAS PASS')
    } finally { removeDir(root) }
  })

  it('preserves bytes/mtime, rejects archive links/traversal and tree links, and holds flock through legacy mutation', () => {
    const root = makeTempDir('quest-e-transport-')
    try {
      const result = runCli('python3', ['-B', '-c', `
import importlib.util, io, os, pathlib, stat, sys, tarfile, fcntl
spec=importlib.util.spec_from_file_location('transport',sys.argv[1]); m=importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
root=pathlib.Path(sys.argv[2]).resolve(); source=root/'source'; source.mkdir(); (source/'empty').mkdir(); (source/'a.js').write_bytes(b'asset'); os.utime(source/'a.js',(12345,12345))
buffer=io.BytesIO(); original=sys.stdout; sys.stdout=type('Output',(),{'buffer':buffer})(); m.pack(source); sys.stdout=original
target=root/'target'; target.mkdir(); sys.stdin=type('Input',(),{'buffer':io.BytesIO(buffer.getvalue())})(); m.unpack(target)
assert (target/'a.js').read_bytes()==b'asset' and (target/'a.js').stat().st_mtime==12345
assert (target/'empty').is_dir()
for name,kind in [('../escape',tarfile.REGTYPE),('/absolute',tarfile.REGTYPE),('linked',tarfile.SYMTYPE),('hardlink',tarfile.LNKTYPE)]:
 out=io.BytesIO()
 with tarfile.open(fileobj=out,mode='w:gz') as t:
  info=tarfile.TarInfo(name); info.type=kind; info.linkname='a.js'; t.addfile(info)
 sys.stdin=type('Input',(),{'buffer':io.BytesIO(out.getvalue())})()
 try:m.unpack(target); raise AssertionError('unsafe archive accepted')
 except ValueError:pass
(source/'link').symlink_to('a.js')
try:list(m.regular_tree(source)); raise AssertionError('tree link accepted')
except ValueError:pass
walk=m.os.walk
def unreadable(*args,**kwargs):
 kwargs['onerror'](PermissionError('unreadable subtree')); yield None
m.os.walk=unreadable
try:list(m.regular_tree(source)); raise AssertionError('unreadable tree accepted')
except PermissionError:pass
m.os.walk=walk
release=root/'releases'; release.mkdir(); (release/'unfinished').mkdir()
class Package:
 def _match(self,*args):pass
 SLUG=None
class Activation:
 def sealed_identity(self,p):return (p/'.identity.json').read_text()
try:m.inventory(Package(),Activation(),release,10000); raise AssertionError('unknown generation accepted')
except FileNotFoundError:pass
assert list(release.iterdir())==[release/'unfinished']
static=root/'static'; static.mkdir(); (static/'dist').mkdir()
with m.legacy_lock(static):
 fd=os.open(static/'.quest-seo-operation.lock',os.O_RDWR)
 try:
  try:fcntl.flock(fd,fcntl.LOCK_EX|fcntl.LOCK_NB); raise AssertionError('nested fd bypassed operation lock')
  except BlockingIOError:pass
 finally:os.close(fd)
fd=os.open(static/'.quest-seo-operation.lock',os.O_RDWR); fcntl.flock(fd,fcntl.LOCK_EX|fcntl.LOCK_NB); os.close(fd)
(static/'dist').rmdir(); (static/'dist').symlink_to('quest-seo-releases/x/dist')
try:
 with m.legacy_lock(static):raise AssertionError('managed mutation accepted')
except ValueError:pass
assert stat.S_IMODE((static/'.quest-seo-operation.lock').stat().st_mode)==0o600
print('archive and real flock PASS')
`, path.resolve('scripts/quest-seo-transport.py'), root])
      expect(result.status).toBe(0)
      expect(result.stdout).toContain('real flock PASS')
    } finally { removeDir(root) }
  })
})

describe('early immutable asset capture and late apply', () => {
  const nonce = 'a'.repeat(48)
  let root: string, dist: string, file: string, r: ReturnType<typeof remote>, packed: Buffer
  const originalBudget = process.env.QUEST_SEO_MANAGED_MAX_BYTES
  beforeEach(() => {
    root = fs.realpathSync(makeTempDir('quest-e-capture-'))
    dist = path.join(root, 'dist'); file = path.join(root, 'state.json')
    fs.mkdirSync(path.join(dist, '_expo/static'), { recursive: true })
    const old = path.join(root, 'old'), archive = path.join(root, 'old.gz')
    fs.mkdirSync(old); fs.writeFileSync(path.join(old, 'previous.js'), 'previous runtime')
    const result = runCli('python3', ['-B', '-c', 'import subprocess,sys\nwith open(sys.argv[3],"wb") as f: subprocess.run([sys.executable,sys.argv[1],"pack",sys.argv[2]],stdout=f,check=True)', path.resolve('scripts/quest-seo-transport.py'), old, archive])
    expect(result.status).toBe(0); packed = fs.readFileSync(archive)
    r = remote()
    const operation = r.t.operation
    r.t.operation = (action: string, args: string[], options?: any) => {
      if (action === 'overlay') { fs.writeSync(options.stdio[1], packed); return '' }
      return operation(action, args, options)
    }
    process.env.QUEST_SEO_MANAGED_MAX_BYTES = '2147483648'
  })
  afterEach(() => {
    if (originalBudget === undefined) delete process.env.QUEST_SEO_MANAGED_MAX_BYTES
    else process.env.QUEST_SEO_MANAGED_MAX_BYTES = originalBudget
    removeDir(root)
  })
  const state = () => JSON.parse(fs.readFileSync(file, 'utf8'))

  it('closes and hashes the adjacent private archive without touching the future export, then applies it once', () => {
    fs.rmSync(dist, { recursive: true })
    captureOverlay(r.t, dist, file, nonce)
    const captured = state()
    expect(captured.phase).toBe('captured'); expect(fs.existsSync(dist)).toBe(false)
    expect(captured.capture).toMatchObject({ nonce, state_file: file, dist, bytes: packed.length, sha256: sha256(packed) })
    expect(captured.base.current).toEqual(prior)
    expect(fs.statSync(captured.capture.archive).mode & 0o777).toBe(0o600)
    fs.mkdirSync(path.join(dist, '_expo/static'), { recursive: true })
    applyOverlay(r.t, dist, file, nonce)
    expect(state().phase).toBe('overlaid')
    expect(fs.readFileSync(path.join(dist, '_expo/static/previous.js'), 'utf8')).toBe('previous runtime')
    expect(fs.existsSync(captured.capture.archive)).toBe(false)
    expect(() => applyOverlay(r.t, dist, file, nonce)).toThrow('Fresh build-bound')
  })

  it('rejects failed and changed-base captures without publishing partial state or archive', () => {
    const operation = r.t.operation
    r.t.operation = (action: string, args: string[], options?: any) => {
      if (action === 'overlay') { fs.writeSync(options.stdio[1], 'partial'); throw new Error('download failed') }
      return operation(action, args, options)
    }
    expect(() => captureOverlay(r.t, dist, file, nonce)).toThrow('download failed')
    expect(fs.existsSync(file)).toBe(false)
    expect(fs.existsSync(`${file}.overlay-${nonce}.tar.gz`)).toBe(false)
    r.t.operation = (action: string, args: string[], options?: any) => {
      if (action === 'overlay') { fs.writeSync(options.stdio[1], packed); r.replace(); return '' }
      return operation(action, args, options)
    }
    expect(() => captureOverlay(r.t, dist, file, nonce)).toThrow('changed during capture')
    expect(fs.existsSync(file)).toBe(false)
    expect(fs.existsSync(`${file}.overlay-${nonce}.tar.gz`)).toBe(false)
  })

  it.each(['release', 'tree'])('rechecks the complete current %s identity before touching the finished export', (field) => {
    captureOverlay(r.t, dist, file, nonce)
    if (field === 'release') r.replace()
    else {
      const operation = r.t.operation
      r.t.operation = (action: string, args: string[], options?: any) => action === 'inspect'
        ? JSON.stringify({ schema_version: 1, kind: 'managed', current: { ...prior, tree_sha256: 'e'.repeat(64) }, previous: null })
        : operation(action, args, options)
    }
    expect(() => applyOverlay(r.t, dist, file, nonce)).toThrow('changed since capture')
    expect(fs.existsSync(path.join(dist, '_expo/static/previous.js'))).toBe(false)
  })

  it.each(['digest', 'size', 'symlink', 'public-mode', 'nonce', 'dist', 'state-path'])('rejects a changed capture %s', (field) => {
    captureOverlay(r.t, dist, file, nonce)
    const captured = state(), archive = captured.capture.archive
    if (field === 'digest') { const bytes = fs.readFileSync(archive); bytes[0] ^= 1; fs.writeFileSync(archive, bytes) }
    if (field === 'size') fs.appendFileSync(archive, 'tampered')
    if (field === 'symlink') { fs.renameSync(archive, `${archive}.original`); fs.symlinkSync(`${archive}.original`, archive) }
    if (field === 'public-mode') fs.chmodSync(archive, 0o644)
    if (field === 'nonce') captured.capture.nonce = 'b'.repeat(48)
    if (field === 'dist') captured.capture.dist = `${dist}-old`
    if (field === 'state-path') captured.capture.state_file = `${file}-old`
    fs.writeFileSync(file, JSON.stringify(captured))
    expect(() => applyOverlay(r.t, dist, file, nonce)).toThrow()
    expect(fs.existsSync(path.join(dist, '_expo/static/previous.js'))).toBe(false)
  })

  it('checks the physical host legacy root before/after download and before late application', () => {
    let inode = 10
    const operation = r.t.operation
    r.t.ssh = jest.fn((command: string) => command.startsWith('python3 -c') ? JSON.stringify({ device: 1, inode }) : '')
    r.t.operation = (action: string, args: string[], options?: any) => action === 'inspect'
      ? JSON.stringify({ schema_version: 1, kind: 'legacy', current: null, previous: null })
      : operation(action, args, options)
    captureOverlay(r.t, dist, file, nonce)
    expect(state().capture.legacy_root).toEqual({ device: 1, inode: 10 })
    inode = 11
    expect(() => applyOverlay(r.t, dist, file, nonce)).toThrow('changed since capture')
    fs.rmSync(file); fs.rmSync(`${file}.overlay-${nonce}.tar.gz`)
    r.t.operation = (action: string, args: string[], options?: any) => {
      if (action === 'overlay') { fs.writeSync(options.stdio[1], packed); inode += 1; return '' }
      return action === 'inspect' ? JSON.stringify({ schema_version: 1, kind: 'legacy', current: null, previous: null }) : operation(action, args, options)
    }
    expect(() => captureOverlay(r.t, dist, file, nonce)).toThrow('changed during capture')
  })
})

describe('local retention of private package artifacts', () => {
  const DAY = 24 * 3600 * 1000
  function artifacts(directory: string, name: string, state: Record<string, unknown> | null, ageDays = 0) {
    const stateFile = path.join(directory, name)
    if (state) fs.writeFileSync(stateFile, JSON.stringify({ schema_version: 1, ...state }))
    const files = ['.package.tar.gz', '.files.v2.json', '.plan.v3.json'].map((suffix) => `${stateFile}${suffix}`)
    const time = new Date(Date.now() - ageDays * DAY)
    for (const file of files) { fs.writeFileSync(file, 'x'.repeat(10)); fs.utimesSync(file, time, time) }
    return { stateFile, files }
  }
  it('keeps the current run, the server generations and young unfinished states, and removes the rest', () => {
    const root = makeTempDir('quest-local-retention-')
    try {
      const current = artifacts(root, 'current.json', { phase: 'ready', identity: { release_id: 'new' } })
      const rollback = artifacts(root, 'rollback.json', { phase: 'ready', identity: { release_id: 'old' } }, 30)
      const retired = artifacts(root, 'retired.json', { phase: 'ready', identity: { release_id: 'retired' } })
      const rolledBack = artifacts(root, 'rolled-back.json', { phase: 'rolled-back', identity: { release_id: 'failed' } })
      const unfinished = artifacts(root, 'unfinished.json', { phase: 'inspect-required', identity: { release_id: 'stuck' } }, 1)
      const stale = artifacts(root, 'stale.json', { phase: 'prepared', identity: { release_id: 'abandoned' } }, 8)
      const orphan = artifacts(root, 'orphan.json', null, 8)
      const youngOrphan = artifacts(root, 'young-orphan.json', null, 1)
      const result = pruneLocalArtifacts(current.stateFile, ['new', 'old'])
      const exists = (set: { files: string[] }) => set.files.map((file) => fs.existsSync(file))
      for (const kept of [current, rollback, unfinished, youngOrphan]) expect(exists(kept)).toEqual([true, true, true])
      for (const removed of [retired, rolledBack, stale, orphan]) expect(exists(removed)).toEqual([false, false, false])
      for (const state of [retired, rolledBack, stale]) expect(fs.existsSync(state.stateFile)).toBe(true)
      expect(result).toEqual({ kept: 12, removed: 12, removed_bytes: 120 })
    } finally { removeDir(root) }
  })
})
