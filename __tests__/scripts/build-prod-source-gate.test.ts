/**
 * Regression tests for the build-prod.sh source gate and .env lifecycle (#1881).
 *
 * `build-prod.sh` builds the physical content of the working directory. In this
 * checkout up to eight sessions work in parallel, so something is almost always
 * uncommitted: on 2026-09-08 a run from the shared tree pulled 29 product files
 * of somebody else's in_progress task into a production build, and it only
 * stopped because a human noticed before the rsync.
 *
 * The same run left the shared `.env` as a copy of `.env.prod`: the script
 * swapped the file in and never put it back, so every neighbouring session
 * silently inherited a production config.
 *
 * Both contracts are executed here against the real shell functions extracted
 * from `build-prod.sh` — a text assertion alone would not prove that the gate
 * stops, nor that the EXIT trap actually fires on SIGTERM.
 */

import fs from 'fs'
import path from 'path'

import { makeTempDir, removeDir, runCli } from './cli-test-utils'
import { readCanonicalDeploy } from './remote-deploy-test-utils'

// The globals, the restore/exit traps, the source gate and apply_env form one
// contiguous region between the deploy-target source and install_deps. Taking
// the region verbatim keeps the harness honest: the test runs the shipped code,
// not a paraphrase of it.
function extractGatePrelude(source = readCanonicalDeploy()): string {
  const start = source.indexOf("EXPORT_LOG=''")
  const end = source.indexOf('install_deps() {')

  if (start === -1 || end === -1 || end < start) {
    throw new Error('build-prod.sh source-gate prelude was not found')
  }

  return source.slice(start, end)
}

// Argument parsing plus the gate call itself. Without this region the suite
// would prove that `assert_deployable_source` works while saying nothing about
// whether the script still calls it, or whether `--allow-dirty` and `DEPLOY`
// still reach the parameters they are read from.
function extractEntryPoint(source = readCanonicalDeploy()): string {
  const start = source.indexOf("ENV=''\nALLOW_DIRTY=0")
  const end = source.indexOf('echo "🔁 Старт сборки..."')

  if (start === -1 || end === -1 || end < start) {
    throw new Error('build-prod.sh entry point was not found')
  }

  return source.slice(start, end)
}

const PRELUDE = extractGatePrelude()
const ENTRY_POINT = extractEntryPoint()

const GIT_ENV = {
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_SYSTEM: '/dev/null',
  GIT_AUTHOR_NAME: 'source gate test',
  GIT_AUTHOR_EMAIL: 'source-gate@test.local',
  GIT_COMMITTER_NAME: 'source gate test',
  GIT_COMMITTER_EMAIL: 'source-gate@test.local',
}

function runHarness(cwd: string, body: string, env: Record<string, string> = {}) {
  const script = ['set -Eeuo pipefail', "IFS=$'\\n\\t'", PRELUDE, body].join('\n')
  return runCli('bash', ['-c', script], { cwd, env: { ...GIT_ENV, ...env } })
}

// `bash -c script name args…` puts args into "$@" exactly as the shipped script
// receives them, so the real `for arg in "$@"` loop is what runs here.
function runEntryPoint(cwd: string, args: string[], env: Record<string, string> = {}) {
  const script = [
    'set -Eeuo pipefail',
    "IFS=$'\\n\\t'",
    PRELUDE,
    ENTRY_POINT,
    'echo "GATE-PASSED env=$ENV deploy=$DEPLOY"',
  ].join('\n')
  return runCli('bash', ['-c', script, 'build-prod.sh', ...args], {
    cwd,
    env: { DEPLOY: '1', ...GIT_ENV, ...env },
  })
}

describe('build-prod.sh source gate', () => {
  let root: string
  let work: string

  beforeEach(() => {
    root = makeTempDir('build-prod-source-gate-')
    work = path.join(root, 'work')
    const setup = runCli(
      'bash',
      [
        '-c',
        [
          'set -euo pipefail',
          'git init -q --bare origin',
          'git init -q work',
          'cd work',
          'git symbolic-ref HEAD refs/heads/main',
          'echo one > file.txt',
          'git add file.txt',
          'git commit -qm one',
          'git remote add origin ../origin',
          'git push -q origin main',
        ].join('\n'),
      ],
      { cwd: root, env: GIT_ENV },
    )
    expect(setup.status).toBe(0)
  })

  afterEach(() => {
    removeDir(root)
  })

  it('passes a clean tree whose HEAD is reachable from origin/main and prints the built sha', () => {
    const head = runCli('git', ['rev-parse', 'HEAD'], { cwd: work, env: GIT_ENV })
    const result = runHarness(work, 'assert_deployable_source prod 0 1')

    expect(result.status).toBe(0)
    expect(result.stdout).toContain(head.stdout.trim())
    expect(result.stdout).toContain('достижим из origin/main')
  })

  it('stops a dirty tree and names the uncommitted files', () => {
    fs.writeFileSync(path.join(work, 'file.txt'), 'local edit\n', 'utf8')
    fs.writeFileSync(path.join(work, 'stray.ts'), 'export {}\n', 'utf8')

    const result = runHarness(work, 'assert_deployable_source prod 0 1')

    expect(result.status).not.toBe(0)
    expect(result.stdout).toContain('Рабочее дерево грязное')
    expect(result.stdout).toContain('file.txt')
    expect(result.stdout).toContain('stray.ts')
    expect(result.stdout).toContain('--allow-dirty')
  })

  it('builds a dirty tree only under --allow-dirty and says so loudly', () => {
    fs.writeFileSync(path.join(work, 'file.txt'), 'local edit\n', 'utf8')

    const result = runHarness(work, 'assert_deployable_source prod 1 1')

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('ГРЯЗНОЕ дерево')
    expect(result.stdout).toContain('file.txt')
  })

  it('stops a clean tree whose HEAD is not reachable from origin/main', () => {
    const commit = runCli(
      'bash',
      ['-c', 'set -euo pipefail\necho two > file.txt\ngit commit -qam two'],
      { cwd: work, env: GIT_ENV },
    )
    expect(commit.status).toBe(0)

    const result = runHarness(work, 'assert_deployable_source prod 0 1')

    expect(result.status).not.toBe(0)
    expect(result.stdout).toContain('не достижим из origin/main')
  })

  it('still stops an unreachable HEAD when --allow-dirty is passed', () => {
    const commit = runCli(
      'bash',
      ['-c', 'set -euo pipefail\necho two > file.txt\ngit commit -qam two'],
      { cwd: work, env: GIT_ENV },
    )
    expect(commit.status).toBe(0)
    fs.writeFileSync(path.join(work, 'file.txt'), 'and dirty\n', 'utf8')

    const result = runHarness(work, 'assert_deployable_source prod 1 1')

    expect(result.status).not.toBe(0)
    expect(result.stdout).toContain('не достижим из origin/main')
  })

  // `DEPLOY=0 ./build-prod.sh prod` is the documented build-only preview
  // (docs/PRODUCTION_CHECKLIST.md, docs/RELEASE.md, docs/ARCHITECTURE.md). Its
  // whole point is inspecting an artifact built from work that is not committed
  // or pushed yet, and the origin/main check has no bypass flag — stopping that
  // run would delete the path instead of guarding it.
  it('warns instead of stopping a build-only run on a dirty, unpushed tree', () => {
    const commit = runCli(
      'bash',
      ['-c', 'set -euo pipefail\necho two > file.txt\ngit commit -qam two'],
      { cwd: work, env: GIT_ENV },
    )
    expect(commit.status).toBe(0)
    fs.writeFileSync(path.join(work, 'file.txt'), 'and dirty\n', 'utf8')

    const result = runHarness(work, 'assert_deployable_source prod 0 0')

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('build-only')
    expect(result.stdout).toContain('file.txt')
    expect(result.stdout).toContain('сверка с origin/main пропущена')
  })
})

describe('build-prod.sh entry point', () => {
  let root: string
  let work: string

  beforeEach(() => {
    root = makeTempDir('build-prod-entry-point-')
    work = path.join(root, 'work')
    const setup = runCli(
      'bash',
      [
        '-c',
        [
          'set -euo pipefail',
          'git init -q --bare origin',
          'git init -q work',
          'cd work',
          'git symbolic-ref HEAD refs/heads/main',
          'echo one > file.txt',
          'git add file.txt',
          'git commit -qm one',
          'git remote add origin ../origin',
          'git push -q origin main',
        ].join('\n'),
      ],
      { cwd: root, env: GIT_ENV },
    )
    expect(setup.status).toBe(0)
  })

  afterEach(() => {
    removeDir(root)
  })

  it('runs the gate before anything else and defaults to prod + deploy', () => {
    const result = runEntryPoint(work, [])

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('достижим из origin/main')
    expect(result.stdout).toContain('GATE-PASSED env=prod deploy=1')
  })

  it('stops a dirty tree before the build starts', () => {
    fs.writeFileSync(path.join(work, 'file.txt'), 'local edit\n', 'utf8')

    const result = runEntryPoint(work, ['prod'])

    expect(result.status).not.toBe(0)
    expect(result.stdout).toContain('Рабочее дерево грязное')
    expect(result.stdout).not.toContain('GATE-PASSED')
  })

  it('wires --allow-dirty through to the gate in any argument position', () => {
    fs.writeFileSync(path.join(work, 'file.txt'), 'local edit\n', 'utf8')

    for (const args of [['prod', '--allow-dirty'], ['--allow-dirty', 'prod'], ['--allow-dirty']]) {
      const result = runEntryPoint(work, args)

      expect(result.status).toBe(0)
      expect(result.stdout).toContain('ГРЯЗНОЕ дерево')
      expect(result.stdout).toContain('GATE-PASSED env=prod deploy=1')
    }
  })

  it('wires DEPLOY through to the gate', () => {
    fs.writeFileSync(path.join(work, 'file.txt'), 'local edit\n', 'utf8')

    const result = runEntryPoint(work, ['prod'], { DEPLOY: '0' })

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('build-only')
    expect(result.stdout).toContain('GATE-PASSED env=prod deploy=0')
  })

  it('rejects an unknown flag and a second environment name', () => {
    expect(runEntryPoint(work, ['--nope']).status).not.toBe(0)
    expect(runEntryPoint(work, ['prod', 'dev']).status).not.toBe(0)
  })
})

describe('build-prod.sh .env lifecycle', () => {
  let work: string

  const ORIGINAL = 'APP_ENV=dev\nEXPO_PUBLIC_API_URL=http://localhost:8000\n'
  const PROD = 'APP_ENV=production\nEXPO_PUBLIC_API_URL=https://metravel.by\n'

  const seed = (withEnv: boolean) => {
    if (withEnv) fs.writeFileSync(path.join(work, '.env'), ORIGINAL, 'utf8')
    fs.writeFileSync(path.join(work, '.env.prod'), PROD, 'utf8')
  }

  const applyThen = (tail: string) =>
    runHarness(work, ['apply_env prod', 'cp .env applied.txt', tail].join('\n'))

  const applied = () => fs.readFileSync(path.join(work, 'applied.txt'), 'utf8')
  const envFile = () => path.join(work, '.env')

  beforeEach(() => {
    work = makeTempDir('build-prod-env-lifecycle-')
  })

  afterEach(() => {
    removeDir(work)
  })

  it('restores the original .env after a successful run', () => {
    seed(true)

    const result = applyThen('exit 0')

    expect(result.status).toBe(0)
    expect(applied()).toBe(PROD)
    expect(fs.readFileSync(envFile(), 'utf8')).toBe(ORIGINAL)
  })

  it('restores the original .env when the build fails', () => {
    seed(true)

    const result = applyThen('exit 7')

    expect(result.status).toBe(7)
    expect(applied()).toBe(PROD)
    expect(fs.readFileSync(envFile(), 'utf8')).toBe(ORIGINAL)
  })

  it('restores the original .env when the run is killed with SIGTERM', () => {
    seed(true)

    const result = applyThen('kill -TERM $$\nsleep 10')

    expect(result.status).toBe(143)
    expect(applied()).toBe(PROD)
    expect(fs.readFileSync(envFile(), 'utf8')).toBe(ORIGINAL)
  })

  it('restores the original .env when the run is interrupted with SIGINT', () => {
    seed(true)

    const result = applyThen('kill -INT $$\nsleep 10')

    expect(result.status).toBe(130)
    expect(applied()).toBe(PROD)
    expect(fs.readFileSync(envFile(), 'utf8')).toBe(ORIGINAL)
  })

  it('removes .env again when the tree had none before the build', () => {
    seed(false)

    const result = applyThen('exit 0')

    expect(result.status).toBe(0)
    expect(applied()).toBe(PROD)
    expect(fs.existsSync(envFile())).toBe(false)
  })

  // The restore decision is made from two globals, and `ENV_BACKUP_PRESENT`
  // defaults to 0. If the backup path is published before the snapshot is
  // taken, a signal caught in between makes the EXIT handler take the
  // "there was no .env" branch and DELETE the shared file it was written to
  // protect. A slow mktemp stub puts the signal exactly in that window.
  it('never deletes an existing .env when the run dies while taking the snapshot', () => {
    seed(true)

    const stubDir = path.join(work, 'stub-bin')
    fs.mkdirSync(stubDir, { recursive: true })
    const stub = path.join(stubDir, 'mktemp')
    fs.writeFileSync(
      stub,
      [
        '#!/bin/bash',
        'sleep 0.5',
        'for real in /usr/bin/mktemp /bin/mktemp; do',
        '  [ -x "$real" ] && exec "$real" "$@"',
        'done',
        'exit 1',
        '',
      ].join('\n'),
      'utf8',
    )
    fs.chmodSync(stub, 0o755)

    const result = runHarness(
      work,
      ['( sleep 0.2; kill -TERM $$ ) &', 'apply_env prod', 'echo NOT-REACHED'].join('\n'),
      { PATH: `${stubDir}:${process.env.PATH ?? ''}` },
    )

    expect(result.status).toBe(143)
    expect(result.stdout).not.toContain('NOT-REACHED')
    expect(fs.readFileSync(envFile(), 'utf8')).toBe(ORIGINAL)
  })

  // The original bug class: build_env and deploy_prod each installed their own
  // EXIT trap, and every later `trap ... EXIT` silently replaced the previous
  // one. A second installed handler would drop the .env restore again.
  it('keeps a single installed EXIT trap so no later handler can drop the .env restore', () => {
    const source = readCanonicalDeploy()
    const installed = (source.match(/^\s*trap\s+.*\bEXIT\b.*$/gm) ?? [])
      .map((line) => line.trim())
      .filter((line) => !/^trap\s+-\s+EXIT$/.test(line))

    expect(installed).toEqual(['trap on_exit EXIT'])
  })
})
