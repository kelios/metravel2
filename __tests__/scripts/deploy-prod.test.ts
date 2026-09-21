/**
 * #2013: prod rollout in one command. `scripts/deploy-prod.sh` replaces the
 * isolated-worktree recipe an agent used to walk step by step (~6 minutes of
 * turns before the build even started), and `scripts/build-lock.js` now puts
 * the build lock where every worktree of the repository sees it.
 *
 * The wrapper runs for real against a throwaway repository with a bare origin;
 * only `build-prod.sh` and the lock runner are stubs, so fetch, worktree
 * handling, symlinks, logging and cleanup are the shipped code.
 */
import fs from 'fs'
import path from 'path'

import { makeTempDir, removeDir, runCli } from './cli-test-utils'

const { resolveLockRoot } = require('@/scripts/build-lock')

const DEPLOY_SCRIPT = path.resolve(process.cwd(), 'scripts/deploy-prod.sh')

const GIT_ENV = {
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_SYSTEM: '/dev/null',
  GIT_AUTHOR_NAME: 'deploy prod test',
  GIT_AUTHOR_EMAIL: 'deploy-prod@test.local',
  GIT_COMMITTER_NAME: 'deploy prod test',
  GIT_COMMITTER_EMAIL: 'deploy-prod@test.local',
}

const LOCK_RUNNER_STUB = [
  "const { spawnSync } = require('child_process')",
  "const index = process.argv.indexOf('--')",
  'const result = spawnSync(process.argv[index + 1], process.argv.slice(index + 2), {',
  "  stdio: 'inherit',",
  "  env: { ...process.env, MT_BUILD_LOCK_OWNED: '1' },",
  '})',
  'process.exit(result.status === null ? 1 : result.status)',
].join('\n')

const BUILD_STUB = [
  '#!/bin/bash',
  'set -euo pipefail',
  '{',
  '  echo "cwd=$(pwd -P)"',
  '  echo "deploy=${DEPLOY:-unset}"',
  '  echo "lock_owned=${MT_BUILD_LOCK_OWNED:-0}"',
  '  [[ -L node_modules ]] && echo "node_modules=symlink"',
  '  [[ -L .env.prod ]] && echo "env_prod=symlink"',
  '  echo "head=$(git rev-parse HEAD)"',
  '} > "$STUB_OUT"',
  'echo "▶ stub stage"',
  'echo "noise line"',
  'echo "⏱  stub stage: 0 с"',
  'echo "⏱  Время этапов:"',
  'echo "      0 с  stub stage"',
  'exit "${STUB_EXIT:-0}"',
].join('\n')

type Fixture = { root: string; repo: string; worktree: string; stubOut: string }

function git(cwd: string, args: string[]): string {
  const result = runCli('git', args, { cwd, env: GIT_ENV })
  if (result.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed: ${result.stderr || result.stdout}`)
  }
  return result.stdout.trim()
}

function writeFile(filePath: string, content: string, mode?: number): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, `${content}\n`)
  if (mode) fs.chmodSync(filePath, mode)
}

function makeFixture(): Fixture {
  const root = fs.realpathSync(makeTempDir('metravel-deploy-prod-'))
  const origin = path.join(root, 'origin.git')
  const repo = path.join(root, 'repo')

  git(root, ['init', '--bare', '-q', origin])
  git(root, ['init', '-q', repo])
  git(repo, ['checkout', '-q', '-b', 'main'])
  fs.mkdirSync(path.join(repo, 'scripts'), { recursive: true })
  fs.copyFileSync(DEPLOY_SCRIPT, path.join(repo, 'scripts/deploy-prod.sh'))
  fs.chmodSync(path.join(repo, 'scripts/deploy-prod.sh'), 0o755)
  writeFile(path.join(repo, 'scripts/run-with-build-lock.js'), LOCK_RUNNER_STUB)
  writeFile(path.join(repo, 'build-prod.sh'), BUILD_STUB, 0o755)
  writeFile(path.join(repo, '.gitignore'), 'node_modules\n.env.*\n.codex-temp/')
  fs.mkdirSync(path.join(repo, 'node_modules'))
  writeFile(path.join(repo, '.env.prod'), 'APP_ENV=production')
  writeFile(path.join(repo, '.env.deploy'), 'PROD_SSH_USER=stub')
  git(repo, ['add', '-A'])
  git(repo, ['commit', '-q', '-m', 'initial'])
  git(repo, ['remote', 'add', 'origin', origin])
  git(repo, ['push', '-q', 'origin', 'main'])

  return {
    root,
    repo,
    worktree: path.join(root, 'worktrees', 'deploy-prod'),
    stubOut: path.join(root, 'stub-out.txt'),
  }
}

function runDeploy(fixture: Fixture, args: string[], env: Record<string, string> = {}) {
  return runCli('bash', [path.join(fixture.repo, 'scripts/deploy-prod.sh'), ...args], {
    cwd: fixture.repo,
    env: { ...GIT_ENV, DEPLOY: '0', STUB_OUT: fixture.stubOut, ...env },
  })
}

function readStubOut(fixture: Fixture): Record<string, string> {
  return Object.fromEntries(
    fs
      .readFileSync(fixture.stubOut, 'utf8')
      .trim()
      .split('\n')
      .map((line) => line.split('=') as [string, string]),
  )
}

function worktreeCount(fixture: Fixture): number {
  return git(fixture.repo, ['worktree', 'list', '--porcelain'])
    .split('\n')
    .filter((line) => line.startsWith('worktree ')).length
}

describe('build lock root', () => {
  it('resolves to the main checkout from any of its worktrees', () => {
    const fixture = makeFixture()
    try {
      const worktree = path.join(fixture.root, 'side')
      git(fixture.repo, ['worktree', 'add', '--detach', '-q', worktree, 'HEAD'])

      expect(fs.realpathSync(resolveLockRoot(worktree))).toBe(fixture.repo)
      expect(fs.realpathSync(resolveLockRoot(fixture.repo))).toBe(fixture.repo)
      expect(resolveLockRoot(fixture.root)).toBe(fixture.root)
    } finally {
      removeDir(fixture.root)
    }
  })
})

describe('scripts/deploy-prod.sh', () => {
  it('builds the named commit in the fixed isolated worktree and removes it afterwards', () => {
    const fixture = makeFixture()
    try {
      const first = git(fixture.repo, ['rev-parse', 'HEAD'])
      writeFile(path.join(fixture.repo, 'later.txt'), 'later')
      git(fixture.repo, ['add', 'later.txt'])
      git(fixture.repo, ['commit', '-q', '-m', 'later'])
      git(fixture.repo, ['push', '-q', 'origin', 'main'])

      const result = runDeploy(fixture, [first])

      expect(result.status).toBe(0)
      expect(readStubOut(fixture)).toEqual({
        cwd: fixture.worktree,
        deploy: '0',
        lock_owned: '1',
        node_modules: 'symlink',
        env_prod: 'symlink',
        head: first,
      })
      expect(result.stdout).toContain(`🚀 Прод-выкат ${first.slice(0, 9)}`)
      expect(result.stdout).toContain('noise line')
      expect(result.stdout).toMatch(/⏱ {2}Выкат целиком: \d+ с \(полный лог: \.codex-temp\/deploy\/prod-/)
      expect(fs.existsSync(fixture.worktree)).toBe(false)
      expect(worktreeCount(fixture)).toBe(1)

      const logs = fs.readdirSync(path.join(fixture.repo, '.codex-temp/deploy'))
      expect(logs).toHaveLength(1)
      expect(fs.readFileSync(path.join(fixture.repo, '.codex-temp/deploy', logs[0]), 'utf8'))
        .toContain('noise line')
    } finally {
      removeDir(fixture.root)
    }
  })

  it('defaults to origin/main and replaces a worktree left by an interrupted rollout', () => {
    const fixture = makeFixture()
    try {
      git(fixture.repo, ['worktree', 'add', '--detach', '-q', fixture.worktree, 'HEAD'])
      writeFile(path.join(fixture.worktree, 'stale-marker.txt'), 'left behind')

      const result = runDeploy(fixture, [])

      expect(result.status).toBe(0)
      expect(readStubOut(fixture).head).toBe(git(fixture.repo, ['rev-parse', 'origin/main']))
      expect(fs.existsSync(fixture.worktree)).toBe(false)
      expect(worktreeCount(fixture)).toBe(1)
    } finally {
      removeDir(fixture.root)
    }
  })

  it('passes the build failure through, shows only the log tail in quiet mode and still cleans up', () => {
    const fixture = makeFixture()
    try {
      const result = runDeploy(fixture, [], { DEPLOY_QUIET: '1', STUB_EXIT: '3' })
      const tailStart = result.stdout.indexOf('❌ build-prod.sh завершился с кодом 3')

      expect(result.status).toBe(3)
      expect(tailStart).toBeGreaterThan(-1)
      expect(result.stdout.slice(0, tailStart)).toContain('▶ stub stage')
      // The stage table rows start with spaces and must survive the filter.
      expect(result.stdout.slice(0, tailStart)).toContain('      0 с  stub stage')
      expect(result.stdout.slice(0, tailStart)).not.toContain('noise line')
      expect(result.stdout.slice(tailStart)).toContain('noise line')
      expect(fs.existsSync(fixture.worktree)).toBe(false)
      expect(worktreeCount(fixture)).toBe(1)
    } finally {
      removeDir(fixture.root)
    }
  })
})
