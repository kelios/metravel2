const path = require('path')
const {
  ROOT,
  GIT_DIR,
  HOOKS_DIR,
  ensureGitRepository,
  ensureHooksDir,
} = require('@/scripts/install-git-hooks')

describe('install-git-hooks', () => {
  it('resolves paths from repository root', () => {
    expect(ROOT).toBe(process.cwd())
    expect(GIT_DIR).toBe(path.join(process.cwd(), '.git'))
    expect(HOOKS_DIR).toBe(path.join(process.cwd(), 'githooks'))
  })

  it('validates repository and tracked hooks directory presence', () => {
    expect(() => ensureGitRepository()).not.toThrow()
    expect(() => ensureHooksDir()).not.toThrow()
  })
})

it('pre-push runs checks in the linked checkout without leaking its Git directory into fixtures', () => {
  const fs = require('node:fs')
  const os = require('node:os')
  const { execFileSync } = require('node:child_process')
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'pre-push fixture '))
  const repo = path.join(scratch, 'repo')
  const linked = path.join(scratch, 'linked')
  const remote = path.join(scratch, 'origin.git')
  const bin = path.join(scratch, 'bin')
  const env = { HOME: scratch, PATH: bin + path.delimiter + process.env.PATH, GIT_CONFIG_NOSYSTEM: '1' }
  const git = (...args: string[]) => execFileSync('git', args, { env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
  try {
    fs.mkdirSync(bin)
    fs.writeFileSync(path.join(bin, 'npm'), [
      '#!/bin/sh', 'set -eu', 'test -z "${GIT_DIR+x}${GIT_WORK_TREE+x}${GIT_INDEX_FILE+x}"',
      'git rev-parse --show-toplevel > "$HOME/observed-root"',
      'printf "%s\\n" "$@" > "$HOME/observed-args"',
      'git init --bare -q "$HOME/test-origin.git"',
    ].join('\n') + '\n', { mode: 0o755 })
    git('init', '--bare', '-q', remote)
    git('init', '-q', '-b', 'main', repo)
    git('-C', repo, '-c', 'user.name=Fixture', '-c', 'user.email=test@example.invalid', 'commit', '--allow-empty', '-qm', 'fixture')
    git('-C', repo, 'remote', 'add', 'origin', remote)
    git('-C', repo, 'push', '-qu', 'origin', 'main')
    git('-C', repo, 'worktree', 'add', '-q', '--track', '-b', 'delivery', linked, 'origin/main')
    git('-C', linked, 'config', 'core.hooksPath', HOOKS_DIR)
    git('-C', linked, 'push', '-q', 'origin', 'HEAD:refs/heads/delivery')
    expect(fs.readFileSync(path.join(scratch, 'observed-root'), 'utf8').trim()).toBe(fs.realpathSync(linked))
    expect(fs.readFileSync(path.join(scratch, 'observed-args'), 'utf8').trim().split('\n'))
      .toEqual(['run', 'check:preflight', '--', '--base-ref', 'origin/main'])
    expect(git('-C', linked, 'rev-parse', '--is-inside-work-tree')).toBe('true')
    expect(git('-C', path.join(scratch, 'test-origin.git'), 'rev-parse', '--is-bare-repository')).toBe('true')
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true })
  }
})
