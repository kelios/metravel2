/** @jest-environment node */
const fs = require('node:fs')
const path = require('node:path')
const { makeTempDir } = require('./cli-test-utils')
const { spawnSyncWithStdin } = require('../../scripts/lib/runSyncWithStdin')
const { DAY_MS, CACHE_NAMES, parseOptions, createPlan, applyPlan, cleanTemp } = require('../../scripts/clean-temp')

describe('safe temporary cache cleanup', () => {
  let scratch: string
  let root: string
  let manager: string
  let now: number
  let log: jest.Mock
  let unavailableGit: jest.Mock

  const write = (relative: string, content = 'fixture') => {
    const file = path.join(root, relative)
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, content)
    return file
  }
  const cache = (relative = 'old/node_modules') => path.dirname(write(`${relative}/payload`))
  const options = (extra = {}) => ({ root, repoRoot: manager, currentCheckout: manager, now, log, git: unavailableGit, ...extra })
  const recent = (file: string, days = 1) => fs.utimesSync(file, new Date(now - days * DAY_MS), new Date(now - days * DAY_MS))
  const git = (cwd: string, args: string[]) => spawnSyncWithStdin('git', args, {
    cwd, encoding: 'utf8', timeout: 10_000, env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' },
  })
  const command = (cwd: string, args: string[]) => {
    const result = git(cwd, args)
    if (result.status !== 0) throw new Error(String(result.stderr))
    return String(result.stdout).trim()
  }

  beforeEach(() => {
    scratch = fs.realpathSync(makeTempDir('clean-temp-', { root: path.resolve(__dirname, '../../.codex-temp/tests') }))
    root = path.join(scratch, 'storage')
    manager = path.join(scratch, 'manager')
    fs.mkdirSync(root)
    fs.mkdirSync(manager)
    // ctime cannot be backdated. Advancing only the injected clock makes the
    // fixtures stale without weakening the real command's conservative clock.
    now = Date.now() + 30 * DAY_MS
    log = jest.fn()
    unavailableGit = jest.fn(() => ({ status: 1, stdout: '', stderr: '' }))
  })

  afterEach(() => fs.rmSync(scratch, { recursive: true, force: true }))

  it('defaults to a read-only inventory with paths and total estimated bytes', () => {
    const target = cache()
    const result = cleanTemp(options())
    expect(result.plan.candidates.map((item: { path: string }) => item.path)).toEqual([target])
    expect(result.bytes).toBe(Buffer.byteLength('fixture'))
    expect(result.removed).toEqual([])
    expect(fs.existsSync(target)).toBe(true)
    expect(log.mock.calls.flat().join('\n')).toContain(`TOTAL 1 candidates, ${result.bytes} bytes`)
    expect(log.mock.calls.flat().join('\n')).toContain(JSON.stringify(target))
  })

  it('parses only explicit supported flags and never accepts an arbitrary CLI root', () => {
    expect(parseOptions([])).toEqual({ apply: false })
    expect(parseOptions(['--dry-run'])).toEqual({ apply: false })
    expect(parseOptions(['--apply'])).toEqual({ apply: true })
    for (const tokens of [['--aply'], ['--root', root], ['--apply=false'], ['--apply', '--dry-run'], ['--apply', '--apply']]) {
      expect(() => parseOptions(tokens)).toThrow()
    }
  })

  it('reports zero safely for a missing or empty root', () => {
    expect(cleanTemp(options()).plan.candidates).toEqual([])
    expect(cleanTemp(options({ root: path.join(scratch, 'absent') })).bytes).toBe(0)
  })

  it('removes only allowlisted real caches and keeps source and unrecognized data', () => {
    const targets = [...CACHE_NAMES, 'metro-tmp-123'].map((name) => cache(`old/build/${name}`))
    const source = write('old/repo/source.ts')
    const unknown = write('old/build/cache/not-reconstructible')
    const result = cleanTemp(options({ apply: true }))
    expect(result.removed.sort()).toEqual(targets.sort())
    expect(targets.every((target) => !fs.existsSync(target))).toBe(true)
    expect(fs.existsSync(source)).toBe(true)
    expect(fs.existsSync(unknown)).toBe(true)
  })

  it('keeps all caches in an entry with recent descendant activity despite an old parent', () => {
    const target = cache()
    const sibling = write('old/repo/active.txt')
    recent(sibling)
    fs.utimesSync(path.join(root, 'old'), new Date(0), new Date(0))
    expect(cleanTemp(options({ apply: true })).removed).toEqual([])
    expect(fs.existsSync(target)).toBe(true)
  })

  it('uses the latest ctime too, preserving freshly copied entries with old mtimes', () => {
    const target = cache()
    fs.utimesSync(path.join(target, 'payload'), new Date(0), new Date(0))
    fs.utimesSync(target, new Date(0), new Date(0))
    fs.utimesSync(path.join(root, 'old'), new Date(0), new Date(0))
    expect(createPlan(options({ now: Date.now() + DAY_MS })).candidates).toEqual([])
  })

  it('accepts the three-day boundary and rejects anything newer', () => {
    cache('stale/Pods')
    const fresh = cache('fresh/Pods')
    recent(path.join(fresh, 'payload'), 3 - 1 / DAY_MS)
    const stale = path.join(root, 'stale', 'Pods')
    recent(path.join(stale, 'payload'), 3)
    expect(createPlan(options()).candidates.map((item: { path: string }) => item.path)).toEqual([stale])
  })

  it.each(['venv', '.venv'])('preserves a nested virtual environment %s and its entire containing cache', (name: string) => {
    const target = cache()
    const protectedFile = write(`old/node_modules/deep/${name}/evidence`)
    expect(cleanTemp(options({ apply: true })).removed).toEqual([])
    expect(fs.existsSync(target)).toBe(true)
    expect(fs.existsSync(protectedFile)).toBe(true)
  })

  // The project's own dependency tree ships onnxruntime-web/.../ops and
  // @huggingface/transformers/src/ops: a store name inside a cache is package
  // content, otherwise no real node_modules would ever be a candidate.
  it.each(['instagram', 'instagram-2026', 'quests-plan', 'books-summer', 'ops', 'ops-3309', 'ops.snapshot', 'handoff', 'handoff-3309', 'review-gate', 'task-claim'])('treats a package directory named %s inside a cache as cache content', (name: string) => {
    const target = cache()
    write(`old/node_modules/onnxruntime-web/lib/${name}/index.js`)
    write(`old/node_modules/pkg/deploy/build.log`)
    expect(cleanTemp(options({ apply: true })).removed).toEqual([target])
    expect(fs.existsSync(target)).toBe(false)
  })

  it.each(['instagram', 'instagram-2026', 'quests-plan', 'books-summer', 'ops', 'ops-3309', 'ops.snapshot', 'handoff', 'handoff-3309', 'review-gate', 'task-claim', 'venv', '.venv'])('never discovers caches below a protected ancestor %s', (name: string) => {
    cache(`old/deep/${name}/node_modules`)
    cache(`${name}/nested/Pods`)
    expect(createPlan(options()).candidates).toEqual([])
  })

  it('never selects or follows symlinked caches and vetoes a parent containing linked node_modules', () => {
    const outside = path.join(scratch, 'outside')
    fs.mkdirSync(outside)
    fs.writeFileSync(path.join(outside, 'sentinel'), 'preserve')
    fs.mkdirSync(path.join(root, 'old'))
    fs.symlinkSync(outside, path.join(root, 'old/node_modules'), 'dir')
    const parent = cache('other/DerivedData')
    fs.symlinkSync(outside, path.join(parent, 'node_modules'), 'dir')
    expect(cleanTemp(options({ apply: true })).removed).toEqual([])
    expect(fs.lstatSync(path.join(root, 'old/node_modules')).isSymbolicLink()).toBe(true)
    expect(fs.existsSync(path.join(outside, 'sentinel'))).toBe(true)
    expect(fs.existsSync(parent)).toBe(true)
  })

  it('unlinks ordinary children of a real cache without touching their external targets', () => {
    const target = cache()
    const outside = path.join(scratch, 'outside')
    fs.writeFileSync(outside, 'preserve')
    fs.mkdirSync(path.join(target, '.bin'))
    fs.symlinkSync(outside, path.join(target, '.bin/tool'))
    expect(cleanTemp(options({ apply: true })).removed).toEqual([target])
    expect(fs.readFileSync(outside, 'utf8')).toBe('preserve')
  })

  it('rejects symlink roots and symlink ancestors before scanning or deleting', () => {
    cache()
    const link = path.join(scratch, 'alias')
    fs.symlinkSync(root, link, 'dir')
    expect(() => cleanTemp(options({ root: link, apply: true }))).toThrow(/Symbolic ancestor/)
    expect(() => cleanTemp(options({ root: path.join(link, 'old'), apply: true }))).toThrow(/Symbolic ancestor/)
    expect(fs.existsSync(path.join(root, 'old/node_modules'))).toBe(true)
  })

  it('applies the independent fourteen-day archive retention and preserves logs, manifests and links', () => {
    const old = write('deploy/old.package.tar.gz')
    const boundary = write('deploy/boundary.package.tar.gz')
    recent(boundary, 14)
    const young = write('deploy/young.package.tar.gz')
    recent(young, 13)
    const deploymentLog = write('deploy/prod-old.log')
    const manifest = write('deploy/manifest.json')
    const nested = write('deploy/nested/old.package.tar.gz')
    const protectedArchive = write('deploy/handoff.package.tar.gz')
    fs.symlinkSync(old, path.join(root, 'deploy/link.package.tar.gz'))
    const result = cleanTemp(options({ apply: true }))
    expect(result.removed.sort()).toEqual([old, boundary].sort())
    for (const kept of [young, deploymentLog, manifest, nested, protectedArchive]) expect(fs.existsSync(kept)).toBe(true)
    expect(fs.lstatSync(path.join(root, 'deploy/link.package.tar.gz')).isSymbolicLink()).toBe(true)
  })

  it('preserves the current checkout, its ancestors and every cache within it', () => {
    const target = cache('old/active-repo/node_modules')
    const checkout = path.dirname(target)
    expect(createPlan(options({ currentCheckout: checkout })).candidates).toEqual([])
  })

  it('never removes an independent repository wholesale and permits its stale reconstructible caches', () => {
    const target = cache('old/repo/node_modules')
    const marker = write('old/repo/.git/HEAD', 'unmerged dirty fixture')
    const source = write('old/repo/source.ts')
    expect(cleanTemp(options({ apply: true })).removed).toEqual([target])
    expect(fs.existsSync(marker)).toBe(true)
    expect(fs.existsSync(source)).toBe(true)
  })

  it.each(['recent sibling', 'protected child', 'replacement symlink'])('revalidates and skips a candidate after a %s appears', (change: string) => {
    const target = cache()
    const plan = createPlan(options())
    if (change === 'recent sibling') recent(write('old/new-activity'))
    if (change === 'protected child') write('old/node_modules/deep/venv/keep')
    if (change === 'replacement symlink') {
      fs.rmSync(target, { recursive: true })
      fs.symlinkSync(manager, target, 'dir')
    }
    expect(applyPlan(plan, log).removed).toEqual([])
    expect(log.mock.calls.flat().join('\n')).toContain('SKIP')
    expect(fs.lstatSync(target)).toBeDefined()
  })

  describe('registered Git worktrees', () => {
    let worktree: string
    let recordingGit: jest.Mock

    beforeEach(() => {
      command(manager, ['init', '--initial-branch=main'])
      command(manager, ['config', 'user.name', 'Cleanup Fixture'])
      command(manager, ['config', 'user.email', 'fixture@example.invalid'])
      command(manager, ['remote', 'add', 'origin', 'git@github.com:kelios/metravel2.git'])
      fs.writeFileSync(path.join(manager, 'tracked.txt'), 'source')
      command(manager, ['add', 'tracked.txt'])
      command(manager, ['commit', '-m', 'fixture'])
      command(manager, ['update-ref', 'refs/remotes/origin/main', 'HEAD'])
      worktree = path.join(root, 'old/checkout')
      command(manager, ['worktree', 'add', '--detach', worktree, 'HEAD'])
      recordingGit = jest.fn(git)
    })

    const gitOptions = (extra = {}) => options({ git: recordingGit, ...extra })

    it('removes only a clean merged non-current worktree through Git without force', () => {
      expect(cleanTemp(gitOptions({ apply: true })).removed).toEqual([worktree])
      expect(fs.existsSync(worktree)).toBe(false)
      const removes = recordingGit.mock.calls.filter(([, args]: [string, string[]]) => args[0] === 'worktree' && args[1] === 'remove')
      expect(removes).toEqual([[manager, ['worktree', 'remove', worktree]]])
    })

    it.each(['dirty', 'untracked', 'unmerged', 'locked', 'current', 'missing origin/main'])('preserves a %s worktree', (state: string) => {
      if (state === 'dirty') fs.appendFileSync(path.join(worktree, 'tracked.txt'), 'changed')
      if (state === 'untracked') fs.writeFileSync(path.join(worktree, 'untracked.txt'), 'keep')
      if (state === 'unmerged') {
        fs.appendFileSync(path.join(worktree, 'tracked.txt'), 'unmerged')
        command(worktree, ['commit', '-am', 'unmerged fixture'])
      }
      if (state === 'locked') command(manager, ['worktree', 'lock', worktree])
      if (state === 'missing origin/main') command(manager, ['update-ref', '-d', 'refs/remotes/origin/main'])
      expect(cleanTemp(gitOptions({ apply: true, ...(state === 'current' ? { currentCheckout: worktree } : {}) })).removed).toEqual([])
      expect(fs.existsSync(worktree)).toBe(true)
    })

    it('rechecks Git cleanliness between inventory and apply', () => {
      const plan = createPlan(gitOptions())
      fs.appendFileSync(path.join(worktree, 'tracked.txt'), 'keep changes')
      expect(applyPlan(plan, log).removed).toEqual([])
      expect(fs.existsSync(worktree)).toBe(true)
    })

    // Every project checkout tracks .claude/agents/instagram-*.md and
    // books-*.test.ts. Tracked files come back from Git, so their names must
    // not veto the removal of a clean merged worktree.
    it('removes a clean merged worktree whose tracked files reuse working-store names', () => {
      for (const file of ['.claude/agents/instagram-creator.md', '__tests__/books-export.test.ts', 'scripts/ops/run.sh']) {
        fs.mkdirSync(path.dirname(path.join(worktree, file)), { recursive: true })
        fs.writeFileSync(path.join(worktree, file), 'tracked')
      }
      command(worktree, ['add', '.'])
      command(worktree, ['commit', '-m', 'store-named tracked fixture'])
      command(manager, ['update-ref', 'refs/remotes/origin/main', command(worktree, ['rev-parse', 'HEAD'])])
      expect(cleanTemp(gitOptions({ apply: true })).removed).toEqual([worktree])
      expect(fs.existsSync(worktree)).toBe(false)
    })

    it('preserves a worktree with untracked data under a working-store name', () => {
      fs.mkdirSync(path.join(worktree, 'ops'))
      fs.writeFileSync(path.join(worktree, 'ops/evidence'), 'keep')
      expect(cleanTemp(gitOptions({ apply: true })).removed).toEqual([])
      expect(fs.existsSync(path.join(worktree, 'ops/evidence'))).toBe(true)
    })

    it('preserves a worktree registered below a protected ancestor', () => {
      const nested = path.join(root, 'ops/checkout')
      fs.mkdirSync(path.dirname(nested), { recursive: true })
      command(manager, ['worktree', 'add', '--detach', nested, 'HEAD'])
      const plan = createPlan(gitOptions())
      expect(plan.candidates.map((item: { path: string }) => item.path)).toEqual([worktree])
    })

    it('keeps working-store names protected once a registered path stops being a worktree', () => {
      fs.rmSync(worktree, { recursive: true })
      cache('old/checkout/ops/node_modules')
      expect(createPlan(gitOptions()).candidates).toEqual([])
    })

    it('preserves a worktree containing a symlinked node_modules even when Git ignores it', () => {
      fs.writeFileSync(path.join(worktree, '.gitignore'), 'node_modules\n')
      command(worktree, ['add', '.gitignore'])
      command(worktree, ['commit', '-m', 'ignored dependency fixture'])
      command(manager, ['update-ref', 'refs/remotes/origin/main', command(worktree, ['rev-parse', 'HEAD'])])
      fs.symlinkSync(manager, path.join(worktree, 'node_modules'), 'dir')
      expect(cleanTemp(gitOptions({ apply: true })).removed).toEqual([])
      expect(fs.lstatSync(path.join(worktree, 'node_modules')).isSymbolicLink()).toBe(true)
    })

    it('preserves a worktree with ignored non-reconstructible files and removes one with only ignored caches', () => {
      fs.writeFileSync(path.join(worktree, '.gitignore'), 'node_modules/\n.env*\n.DS_Store\n')
      command(worktree, ['add', '.gitignore'])
      command(worktree, ['commit', '-m', 'ignore fixture'])
      command(manager, ['update-ref', 'refs/remotes/origin/main', command(worktree, ['rev-parse', 'HEAD'])])
      fs.mkdirSync(path.join(worktree, 'node_modules/pkg'), { recursive: true })
      fs.writeFileSync(path.join(worktree, 'node_modules/pkg/index.js'), 'cache')
      fs.writeFileSync(path.join(worktree, '.DS_Store'), 'finder')
      fs.writeFileSync(path.join(worktree, '.env.local'), 'keep')
      expect(cleanTemp(gitOptions()).plan.candidates.map((item: { path: string }) => item.path))
        .toEqual([path.join(worktree, 'node_modules')])
      expect(fs.existsSync(path.join(worktree, '.env.local'))).toBe(true)
      fs.rmSync(path.join(worktree, '.env.local'))
      expect(cleanTemp(gitOptions({ apply: true })).removed).toEqual([worktree])
    })

    it('never falls back to recursive deletion when Git refuses removal', () => {
      const refusedGit = (cwd: string, args: string[]) => args[0] === 'worktree' && args[1] === 'remove'
        ? { status: 1, stdout: '', stderr: 'fixture refusal' }
        : recordingGit(cwd, args)
      expect(() => cleanTemp(gitOptions({ git: refusedGit, apply: true }))).toThrow(/Git safety check failed/)
      expect(fs.existsSync(path.join(worktree, 'tracked.txt'))).toBe(true)
    })

    it('refuses ambiguous quoted paths in the old Git porcelain fallback', () => {
      const quotedGit = (cwd: string, args: string[]) => args[0] === 'worktree' && args[1] === 'list'
        ? args.includes('-z')
          ? { status: 129, stdout: '', stderr: 'old git fixture' }
          : { status: 0, stdout: `worktree "${worktree}"\nHEAD fixture\ndetached\n\n`, stderr: '' }
        : recordingGit(cwd, args)
      expect(createPlan(gitOptions({ git: quotedGit })).candidates).toEqual([])
    })

    it('fails closed on Git metadata errors without affecting an unrelated safe cache', () => {
      const target = cache('other/Pods')
      const failedGit = (cwd: string, args: string[]) => args[0] === 'worktree' && args[1] === 'list'
        ? { status: 1, stdout: '', stderr: 'fixture failure' }
        : recordingGit(cwd, args)
      expect(cleanTemp(gitOptions({ git: failedGit, apply: true })).removed).toEqual([target])
      expect(fs.existsSync(worktree)).toBe(true)
    })
  })
})
