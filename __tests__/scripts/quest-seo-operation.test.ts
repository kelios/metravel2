/** @jest-environment node */
import fs from 'fs'
import path from 'path'
import { makeTempDir, removeDir, runCli } from './cli-test-utils'

const { checkReceipt, prepare, publish, recover, quote, overlay, readiness, baseline, checkInventory, publishCover } = require('@/scripts/quest-seo-operation')
const { sha256 } = require('@/scripts/lib/questSeoContract')
const fixtureManifest = fs.readFileSync(path.resolve('__tests__/fixtures/questSeoV1/quest-seo-manifest.v1.json'), 'utf8')
const manifest = JSON.parse(fixtureManifest)
const candidate = { release_id: manifest.release_id, frontend_sha: manifest.frontend_sha, manifest_sha256: sha256(fixtureManifest) }
const prior = { schema_version: 1, release_id: 'previous', frontend_sha: 'b'.repeat(40), manifest_sha256: 'c'.repeat(64), tree_sha256: 'd'.repeat(64) }
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
  it('quotes transport arguments as literal shell data', () => {
    const value = "space ' $(touch unwanted) `command`"
    expect(runCli('sh', ['-c', `printf %s ${quote(value)}`]).stdout).toBe(value)
  })
})

function prepared(root: string) {
  const dist = path.join(root, 'dist')
  fs.mkdirSync(dist)
  fs.writeFileSync(path.join(dist, 'quest-seo-manifest.v1.json'), fixtureManifest)
  fs.writeFileSync(path.join(dist, '.build-source.json'), JSON.stringify({ sha: candidate.frontend_sha }))
  fs.writeFileSync(path.join(dist, 'index.html'), 'whole export')
  const file = path.join(root, 'private', 'state.json')
  fs.mkdirSync(path.dirname(file))
  fs.writeFileSync(file, JSON.stringify({ schema_version: 1, phase: 'overlaid', base: { schema_version: 1, kind: 'managed', current: prior, previous: null } }))
  prepare(dist, file)
  return { dist, file }
}

function remote(options: { failure?: string } = {}) {
  let current = prior
  const operations: string[] = []
  const t = {
    app: 'app', nginx: 'nginx', remote: '/remote', ssh: jest.fn(() => ''),
    operation: (action: string, args: string[]) => {
      operations.push(action)
      if (action === 'inspect') return JSON.stringify({ schema_version: 1, kind: 'managed', current, previous: current === prior ? null : prior })
      if (action === 'inventory') return JSON.stringify({ schema_version: 1, release_count: 1, total_bytes: 100 })
      if (action === 'stage') return JSON.stringify({ schema_version: 1, result: 'staged', release_id: args[0] })
      if (action === 'cover') {
        if (args[0] !== current.release_id) throw new Error('cover CAS refused')
        if (options.failure === 'cover' && current.release_id === candidate.release_id) throw new Error('cover publication failed')
        return JSON.stringify({ schema_version: 1, result: 'published', release_id: args[0], sha256: 'e'.repeat(64) })
      }
      if (action === 'validate') {
        if (options.failure === 'validate') throw new Error('source drift')
        return JSON.stringify(receipt(candidate, 'validated'))
      }
      if (action === 'activate') {
        if (args[2] !== current.release_id) throw new Error('CAS refused')
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
  it('persists exact archive/identity privately, validates then activates without an outer lock or cleanup', () => {
    const root = makeTempDir('quest-e-publish-')
    try {
      const p = prepared(root), r = remote()
      publish(r.t, p.dist, p.file, jest.fn())
      const state = JSON.parse(fs.readFileSync(p.file, 'utf8'))
      expect(state.phase).toBe('ready')
      expect(r.operations).toEqual(['inspect', 'inventory', 'stage', 'validate', 'activate', 'cover'])
      expect(r.current().release_id).toBe(candidate.release_id)
      expect(fs.statSync(p.file).mode & 0o777).toBe(0o600)
      expect(fs.statSync(`${p.file}.package.tar.gz`).mode & 0o777).toBe(0o600)
    } finally { removeDir(root) }
  })
  it.each(['validate', 'before-rename', 'after-rename'])('retains generations and actual-pointer evidence on %s failure', (failure) => {
    const root = makeTempDir('quest-e-crash-')
    try {
      const p = prepared(root), r = remote({ failure })
      expect(() => publish(r.t, p.dist, p.file, jest.fn())).toThrow('generations retained')
      const state = JSON.parse(fs.readFileSync(p.file, 'utf8'))
      expect(state.phase).toBe('inspect-required')
      expect(state.actual.current.release_id).toBe(failure === 'after-rename' ? candidate.release_id : prior.release_id)
      expect(fs.existsSync(`${p.file}.package.tar.gz`)).toBe(true)
      expect(r.operations.filter((x) => x === 'activate')).toHaveLength(failure === 'validate' ? 0 : 1)
      if (failure === 'after-rename') {
        recover(r.t, p.file, jest.fn())
        expect(JSON.parse(fs.readFileSync(p.file, 'utf8')).activated.previous_release_id).toBe(prior.release_id)
      } else expect(() => recover(r.t, p.file, jest.fn())).toThrow('another release')
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
      expect(() => publish(r.t, p.dist, p.file, () => { r.replace(); throw new Error('health failed') })).toThrow('CAS refused')
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
    } finally { removeDir(root) }
  })
  it('refuses archive drift, stale CAS and normal legacy conversion before staging', () => {
    for (const condition of ['archive', 'current', 'legacy']) {
      const root = makeTempDir('quest-e-refusal-')
      try {
        const p = prepared(root), r = remote()
        if (condition === 'archive') fs.appendFileSync(`${p.file}.package.tar.gz`, 'changed')
        if (condition === 'current') r.replace()
        if (condition === 'legacy') {
          const state = JSON.parse(fs.readFileSync(p.file, 'utf8')); state.base.kind = 'legacy'; state.base.current = null
          fs.writeFileSync(p.file, JSON.stringify(state))
        }
        expect(() => publish(r.t, p.dist, p.file, jest.fn())).toThrow()
        expect(r.operations).not.toContain('stage')
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
      expect(r.operations).not.toContain('stage')
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
