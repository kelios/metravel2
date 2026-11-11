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
import { liveOriginEnv } from './remote-deploy-test-utils'

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

// The stub is the source of a separate node process, not a call from this test.
// `cli-runner-policy.test.ts` greps test sources for the call text, so the stub
// calls child_process through an alias instead of widening the policy allowlist.
const LOCK_RUNNER_STUB = [
  "const { spawnSync: run } = require('child_process')",
  "const index = process.argv.indexOf('--')",
  'const result = run(process.argv[index + 1], process.argv.slice(index + 2), {',
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
  '  echo "web_output=${METRAVEL_WEB_OUTPUT:-unset}"',
  '  echo "metro_cache=${METRAVEL_METRO_CACHE_DIR:-unset}"',
  '} > "$STUB_OUT"',
  'echo "▶ stub stage"',
  'echo "noise line"',
  'echo "🧊 Metro: холодный экспорт (-c)"',
  'echo "🧹 Metro: lockfile сменился — чищу кэш выката"',
  'echo "♨️  Metro: тёплый кэш выката (32 МБ)"',
  'echo "📊 Диск прода после выката: занято 84 %, свободно 2300 МБ; static/dist — 655 МБ"',
  'echo "⚠️ На диске прода свободно 1400 МБ — меньше 1536 МБ"',
  'echo "⏱  stub stage: 0 с"',
  'echo "⏱  Время этапов:"',
  'echo "      0 с  stub stage"',
  'if [[ "${STUB_BUNDLE_GUARD:-0}" == "1" ]]; then',
  '  mkdir -p .codex-temp/bundle-fixture/js',
  '  printf "a%.0s" {1..200} > .codex-temp/bundle-fixture/js/entry-abcdef.js',
  '  printf \'{"tolerancePct":0,"chunks":{"entry":{"maxRawKB":%s}}}\' "${STUB_BUNDLE_MAX:-1}" > .codex-temp/bundle-fixture/budget.json',
  '  BUNDLE_BUDGET_JS_DIR="$PWD/.codex-temp/bundle-fixture/js" BUNDLE_BUDGET_CONFIG="$PWD/.codex-temp/bundle-fixture/budget.json" node scripts/guard-bundle-budget.js --fail --report',
  'fi',
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
  // assert-deployable-source.js is the shipped live-revision gate (#3207).
  for (const script of ['assert-deployable-source.js', 'lib/buildStamp.js', 'lib/live-build-source.js', 'guard-bundle-budget.js', 'build-lock.js', 'lib/bundleBudgetReport.js', 'lib/compressedSizes.js',
    'lib/webChunkMetadataArtifact.js', 'lib/webChunkMetadataCodec.js', 'lib/webChunkMetadataRuntime.js']) {
    const target = path.join(repo, 'scripts', script)
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.copyFileSync(path.join(process.cwd(), 'scripts', script), target)
  }
  fs.chmodSync(path.join(repo, 'scripts/deploy-prod.sh'), 0o755)
  writeFile(path.join(repo, 'scripts/run-with-build-lock.js'), LOCK_RUNNER_STUB)
  writeFile(path.join(repo, 'build-prod.sh'), BUILD_STUB, 0o755)
  writeFile(path.join(repo, '.gitignore'), 'node_modules\n.env.*\n.codex-temp/')
  fs.symlinkSync(path.join(process.cwd(), 'node_modules'), path.join(repo, 'node_modules'), 'dir')
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
    // runCli inherits process.env: an empty output keeps an operator's exported
    // value out of the default assertions (empty means unset to the wrapper).
    env: {
      ...GIT_ENV,
      DEPLOY: '0',
      STUB_OUT: fixture.stubOut,
      METRAVEL_WEB_OUTPUT: '',
      ...env,
    },
  })
}

// What a real rollout touches besides the build: the production checkout over
// ssh, the backend SSR capability and the final live check. Committed and
// pushed, so the deployed commit is a descendant of the fixture's first one.
const SSR_CAPABILITY = '{"schema_version":2,"available":true,"enabled":true,"quest_web":{"schema_version":2,"builder_schema":2,"refresh_max_age_seconds":10}}'

function addDeployStubs(fixture: Fixture): Record<string, string> {
  const bin = path.join(fixture.root, 'bin')
  writeFile(path.join(bin, 'ssh'), '#!/bin/bash\nprintf \'%s\' "$STUB_SSH_STATUS"', 0o755)
  writeFile(path.join(fixture.repo, 'scripts/deploy-target.sh'),
    'PROD_SSH_TARGET=stub@host\nPROD_REMOTE_DIR=/srv/stub\nrequire_deploy_target() { :; }')
  writeFile(path.join(fixture.repo, 'scripts/web-ssr-publication.sh'), 'printf \'%s\\n\' "$STUB_CAPABILITY"')
  writeFile(path.join(fixture.repo, 'scripts/verify-live-release.sh'), 'echo "✅ stub live check $1"')
  fs.copyFileSync(path.join(process.cwd(), 'scripts/lib/webOutput.js'), path.join(fixture.repo, 'scripts/lib/webOutput.js'))
  git(fixture.repo, ['add', 'scripts'])
  git(fixture.repo, ['commit', '-q', '-m', 'deploy guards'])
  git(fixture.repo, ['push', '-q', 'origin', 'main'])
  return { DEPLOY: '1', PATH: `${bin}:${process.env.PATH}`, STUB_SSH_STATUS: '', STUB_CAPABILITY: SSR_CAPABILITY }
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
        // A build-only preview never asks the backend capability (#2766).
        web_output: 'unset',
        // The Metro transform cache outlives the removed worktree (#2982).
        metro_cache: path.join(fixture.root, 'worktrees', 'deploy-prod-metro-cache'),
      })
      expect(result.stdout).toContain(`🚀 Прод-выкат ${first.slice(0, 9)}`)
      expect(result.stdout).toContain('noise line')
      expect(result.stdout).toMatch(/⏱ {2}Выкат целиком: \d+ с, код выхода 0 \(полный лог: \.codex-temp\/deploy\/prod-/)
      expect(fs.existsSync(fixture.worktree)).toBe(false)
      expect(worktreeCount(fixture)).toBe(1)

      const logs = fs.readdirSync(path.join(fixture.repo, '.codex-temp/deploy'))
      expect(logs).toHaveLength(1)
      const log = fs.readFileSync(path.join(fixture.repo, '.codex-temp/deploy', logs[0]), 'utf8')
      expect(log).toContain('noise line')
      // The log holds the whole rollout, not only build-prod.sh (#2942).
      expect(log.startsWith(`🚀 Прод-выкат ${first.slice(0, 9)}`)).toBe(true)
      expect(log.trimEnd().split('\n').at(-1)).toMatch(/^⏱ {2}Выкат целиком: \d+ с, код выхода 0$/)
    } finally {
      removeDir(fixture.root)
    }
  })

  it('reminds about a stale similar-articles snapshot without stopping the rollout (#3292)', () => {
    const fixture = makeFixture()
    try {
      fs.copyFileSync(path.join(process.cwd(), 'scripts/ai-similar-age-warning.js'), path.join(fixture.repo, 'scripts/ai-similar-age-warning.js'))
      writeFile(path.join(fixture.repo, 'public/assets/data/ai-similar.json'), JSON.stringify({ version: 1, index_built_at: '2020-01-01T00:00:00.000Z' }))
      git(fixture.repo, ['add', 'scripts', 'public'])
      git(fixture.repo, ['commit', '-q', '-m', 'similar snapshot'])
      git(fixture.repo, ['push', '-q', 'origin', 'main'])

      const result = runDeploy(fixture, [], { DEPLOY_QUIET: '1' })

      expect(result.status).toBe(0)
      // The reminder survives quiet mode and lands in the rollout log.
      expect(result.stdout).toMatch(/⚠️ {2}Слепок «похожих» собран \d+ дн\. назад \(порог 14\)/)
      const logs = fs.readdirSync(path.join(fixture.repo, '.codex-temp/deploy'))
      expect(fs.readFileSync(path.join(fixture.repo, '.codex-temp/deploy', logs[0]), 'utf8')).toContain('Слепок «похожих» собран')
      expect(readStubOut(fixture).head).toBe(git(fixture.repo, ['rev-parse', 'origin/main']))
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
      // The disk lines of the deploy report are what the owner reads in quiet
      // mode (#2186): the filter must let both the line and the warning through.
      expect(result.stdout.slice(0, tailStart)).toContain('📊 Диск прода после выката')
      expect(result.stdout.slice(0, tailStart)).toContain('⚠️ На диске прода свободно')
      expect(result.stdout.slice(0, tailStart)).toContain('🧊 Metro: холодный экспорт')
      expect(result.stdout.slice(0, tailStart)).toContain('🧹 Metro: lockfile сменился')
      expect(result.stdout.slice(0, tailStart)).toContain('♨️  Metro: тёплый кэш выката (32 МБ)')
      expect(result.stdout.slice(0, tailStart)).not.toContain('noise line')
      expect(result.stdout.slice(tailStart)).toContain('noise line')
      const [log] = fs.readdirSync(path.join(fixture.repo, '.codex-temp/deploy'))
      expect(fs.readFileSync(path.join(fixture.repo, '.codex-temp/deploy', log), 'utf8').trimEnd().split('\n').at(-1))
        .toMatch(/^⏱ {2}Выкат целиком: \d+ с, код выхода 3$/)
      expect(fs.existsSync(fixture.worktree)).toBe(false)
      expect(worktreeCount(fixture)).toBe(1)
    } finally {
      removeDir(fixture.root)
    }
  })

  // The pre-build guards now run inside `| tee -a "$LOG"` pipelines (#2942):
  // pipefail, not the guard's own exit, is what still stops the rollout.
  it.each([
    { guard: 'dirty prod checkout', sshStatus: ' M app/models.py', capability: SSR_CAPABILITY, reason: '❌ Прод-чекаут бэкенда грязный' },
    { guard: 'capability without quest SSR', sshStatus: '', capability: '{"schema_version":1,"available":true,"enabled":true}', reason: 'Production deploy publishes only SSR' },
  ])('refuses a $guard before the build and keeps the refusal in the log', ({ sshStatus, capability, reason }) => {
    const fixture = makeFixture()
    try {
      const live = git(fixture.repo, ['rev-parse', 'HEAD'])
      const result = runDeploy(fixture, [], {
        ...addDeployStubs(fixture),
        ...liveOriginEnv(fixture.root, live),
        STUB_SSH_STATUS: sshStatus,
        STUB_CAPABILITY: capability,
      })

      expect(result.status).toBe(1)
      expect(fs.existsSync(fixture.stubOut)).toBe(false)
      const [log] = fs.readdirSync(path.join(fixture.repo, '.codex-temp/deploy'))
      const content = fs.readFileSync(path.join(fixture.repo, '.codex-temp/deploy', log), 'utf8')
      expect(content).toContain(reason)
      expect(content).not.toContain('✅ Backend SSR готов')
      expect(content.trimEnd().split('\n').at(-1)).toMatch(/^⏱ {2}Выкат целиком: \d+ с, код выхода 1$/)
      expect(fs.existsSync(fixture.worktree)).toBe(false)
    } finally {
      removeDir(fixture.root)
    }
  })

  // #3207: a session that waited on the lock while another one published a
  // descendant used to put production back on its own older commit.
  describe('live revision', () => {
    const lastLogLine = (fixture: Fixture): string => {
      const [log] = fs.readdirSync(path.join(fixture.repo, '.codex-temp/deploy')).filter((name) => name.endsWith('.log'))
      return fs.readFileSync(path.join(fixture.repo, '.codex-temp/deploy', log), 'utf8').trimEnd().split('\n').at(-1)!
    }

    it('refuses a commit older than the live one before the worktree, ssh and the build', () => {
      const fixture = makeFixture()
      try {
        const older = git(fixture.repo, ['rev-parse', 'HEAD'])
        const env = addDeployStubs(fixture)
        const live = git(fixture.repo, ['rev-parse', 'HEAD'])

        const result = runDeploy(fixture, [older], { ...env, ...liveOriginEnv(fixture.root, live), STUB_SSH_STATUS: ' M never-read' })

        expect(result.status).toBe(1)
        expect(result.stdout).toContain(`Ревизия ${older.slice(0, 9)} старше живой ${live.slice(0, 9)}`)
        expect(result.stdout).toContain(`❌ Выкат ${older.slice(0, 9)} отклонён до сборки — прод не менялся`)
        expect(result.stdout).not.toContain('Прод-чекаут бэкенда')
        expect(fs.existsSync(fixture.stubOut)).toBe(false)
        expect(fs.existsSync(fixture.worktree)).toBe(false)
        expect(lastLogLine(fixture)).toMatch(/^⏱ {2}Выкат целиком: \d+ с, код выхода 1$/)
      } finally {
        removeDir(fixture.root)
      }
    })

    it('reports the live commit as already deployed and builds nothing', () => {
      const fixture = makeFixture()
      try {
        const env = addDeployStubs(fixture)
        const live = git(fixture.repo, ['rev-parse', 'HEAD'])

        const result = runDeploy(fixture, [], { ...env, ...liveOriginEnv(fixture.root, live) })

        expect(result.status).toBe(0)
        expect(result.stdout).toContain(`Ревизия ${live.slice(0, 9)} уже выкачена`)
        expect(fs.existsSync(fixture.stubOut)).toBe(false)
        expect(lastLogLine(fixture)).toMatch(/^⏱ {2}Выкат целиком: \d+ с, код выхода 0$/)
      } finally {
        removeDir(fixture.root)
      }
    })

    // #3307: build-prod.sh leaves with 75 when production moved on between the
    // check above and the publication. The wrapper passes the code out as it is
    // and does not run the final check against a release it did not publish.
    it('passes "overtaken at publication" out with its own exit code', () => {
      const fixture = makeFixture()
      try {
        const env = addDeployStubs(fixture)
        const base = git(fixture.repo, ['rev-parse', 'HEAD~1'])

        const result = runDeploy(fixture, [], { ...env, ...liveOriginEnv(fixture.root, base), STUB_EXIT: '75', DEPLOY_QUIET: '1' })

        expect(result.status).toBe(75)
        expect(readStubOut(fixture).deploy).toBe('1')
        expect(result.stdout).not.toContain('stub live check')
        expect(result.stdout).toContain('❌ build-prod.sh завершился с кодом 75')
        expect(lastLogLine(fixture)).toMatch(/^⏱ {2}Выкат целиком: \d+ с, код выхода 75$/)
        expect(fs.existsSync(fixture.worktree)).toBe(false)
      } finally {
        removeDir(fixture.root)
      }
    })

    it('rolls out a newer commit as before, and an older one only with ALLOW_DOWNGRADE=1', () => {
      const fixture = makeFixture()
      try {
        const env = addDeployStubs(fixture)
        const base = git(fixture.repo, ['rev-parse', 'HEAD'])
        writeFile(path.join(fixture.repo, 'later.txt'), 'later')
        git(fixture.repo, ['add', 'later.txt'])
        git(fixture.repo, ['commit', '-q', '-m', 'later'])
        git(fixture.repo, ['push', '-q', 'origin', 'main'])
        const later = git(fixture.repo, ['rev-parse', 'HEAD'])

        const forward = runDeploy(fixture, [], { ...env, ...liveOriginEnv(fixture.root, base) })
        expect(forward.status).toBe(0)
        expect(forward.stdout).toContain(`Живая ревизия прода ${base.slice(0, 9)} — предок выкатываемой ${later.slice(0, 9)}`)
        expect(readStubOut(fixture)).toMatchObject({ head: later, deploy: '1', web_output: 'server' })

        fs.rmSync(fixture.stubOut)
        const rollback = runDeploy(fixture, [base], { ...env, ...liveOriginEnv(fixture.root, later), ALLOW_DOWNGRADE: '1', DEPLOY_QUIET: '1' })
        expect(rollback.status).toBe(0)
        // The explicit rollback is named in the report even in quiet mode.
        expect(rollback.stdout).toContain('⚠️  ALLOW_DOWNGRADE=1')
        expect(readStubOut(fixture).head).toBe(base)
      } finally {
        removeDir(fixture.root)
      }
    })
  })

  it.each([{ max: '1', status: 0, verdict: 'pass' }, { max: '0.1', status: 1, verdict: 'fail' }])(
    'retains the real $verdict guard report outside its cleaned worktree',
    ({ max, status, verdict }) => {
      const fixture = makeFixture()
      try {
        const sha = git(fixture.repo, ['rev-parse', 'HEAD'])
        const result = runDeploy(fixture, [], { STUB_BUNDLE_GUARD: '1', STUB_BUNDLE_MAX: max, DEPLOY_QUIET: '1' })
        expect(result.status).toBe(status)
        expect(fs.existsSync(fixture.worktree)).toBe(false)
        const archive = path.join(fixture.repo, '.codex-temp/deploy')
        const files = fs.readdirSync(archive)
        const reportName = files.find((name) => name.endsWith('.json'))
        expect(reportName).toBeDefined()
        const reportPath = path.join(archive, reportName!)
        const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'))
        expect(report).toMatchObject({ sha, dirty: false, verdict, measurements: { total: { raw: 200 } } })
        expect(result.stdout).toContain(reportPath)
        const log = files.find((name) => name.endsWith('.log'))!
        expect(fs.readFileSync(path.join(archive, log), 'utf8')).toContain(reportPath)
      } finally { removeDir(fixture.root) }
    },
  )
})
