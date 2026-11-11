/**
 * #3207: a rollout must contain the revision production already serves.
 *
 * `scripts/deploy-prod.sh <sha>` accepted any commit reachable from
 * `origin/main`, including an ancestor of the live release. A session that had
 * waited on the deploy lock while another one published a descendant then put
 * production back on its own older commit, and both reports were green: the
 * final check compares production with what was asked for, not with what was
 * there before.
 *
 * The gate runs for real: its CLI, its curl read of `/.build-source.json`
 * (a `file://` origin stands in for production) and `git merge-base` over a
 * throwaway repository with a bare origin.
 */
import fs from 'fs'
import path from 'path'

import { makeTempDir, removeDir, runCli, runNodeCli } from './cli-test-utils'
import { liveOriginEnv } from './remote-deploy-test-utils'

const GATE = path.resolve(process.cwd(), 'scripts/assert-deployable-source.js')
const { EXIT_ALREADY_LIVE, EXIT_OVERTAKEN } = require('@/scripts/assert-deployable-source')

const GIT_ENV = {
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_SYSTEM: '/dev/null',
  GIT_AUTHOR_NAME: 'live revision gate test',
  GIT_AUTHOR_EMAIL: 'live-revision-gate@test.local',
  GIT_COMMITTER_NAME: 'live revision gate test',
  GIT_COMMITTER_EMAIL: 'live-revision-gate@test.local',
}

describe('deploy gate: live revision (#3207)', () => {
  let root: string
  let work: string

  const sh = (script: string, cwd = work): string => {
    const result = runCli('bash', ['-c', `set -euo pipefail\n${script}`], { cwd, env: GIT_ENV })
    if (result.status !== 0) throw new Error(`${script}\n${result.stderr || result.stdout}`)
    return result.stdout.trim()
  }
  const commit = (name: string): string =>
    sh(`echo ${name} > ${name}.txt\ngit add ${name}.txt\ngit commit -qm ${name}\ngit rev-parse HEAD`)
  const checkOnly = (target: string, live: string | undefined, env: Record<string, string> = {}) =>
    runNodeCli([GATE, '--live-check-only', target, '--cwd', work], { ...GIT_ENV, ...liveOriginEnv(root, live), ...env })
  const gate = (live: string | undefined, env: Record<string, string> = {}, allowDirty = '0') =>
    runNodeCli(
      [GATE, '--deploy', '1', '--allow-dirty', allowDirty, '--live-check', '1', '--cwd', work],
      { ...GIT_ENV, ...liveOriginEnv(root, live), ...env },
    )

  let first: string
  let second: string

  beforeEach(() => {
    root = makeTempDir('deploy-live-revision-gate-')
    work = path.join(root, 'work')
    sh('git init -q --bare origin\ngit init -q work', root)
    // The gate leaves its marker in .codex-temp/, ignored in the real checkout.
    sh("git symbolic-ref HEAD refs/heads/main\ngit remote add origin ../origin\necho '.codex-temp/' >> .git/info/exclude")
    first = commit('first')
    second = commit('second')
    sh('git push -q origin main')
  })

  afterEach(() => {
    removeDir(root)
  })

  it('refuses a target that is an ancestor of the live revision', () => {
    const result = checkOnly(first, second)

    expect(result.status).toBe(1)
    expect(result.stdout).toContain(`Ревизия ${first.slice(0, 9)} старше живой ${second.slice(0, 9)}`)
    expect(result.stdout).toContain('ALLOW_DOWNGRADE=1')
  })

  it('passes a target that contains the live revision', () => {
    const result = checkOnly(second, first)

    expect(result.status).toBe(0)
    expect(result.stdout).toContain(`Живая ревизия прода ${first.slice(0, 9)} — предок выкатываемой ${second.slice(0, 9)}`)
  })

  it('reports the live revision itself as already deployed with its own exit code', () => {
    const result = checkOnly(second, second)

    expect(EXIT_ALREADY_LIVE).toBe(3)
    expect(result.status).toBe(EXIT_ALREADY_LIVE)
    expect(result.stdout).toContain(`Ревизия ${second.slice(0, 9)} уже выкачена`)
  })

  it('lets an explicit rollback through and says so in the report', () => {
    const result = checkOnly(first, second, { ALLOW_DOWNGRADE: '1' })

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('⚠️  ALLOW_DOWNGRADE=1')
    expect(result.stdout).toContain('явный откат')
    expect(result.stdout).not.toContain('❌')
  })

  // Two sides of a merge are both reachable from origin/main, and neither is an
  // ancestor of the other: publishing one drops the other's commits just as an
  // ancestor would.
  it('refuses a target that diverged from the live revision', () => {
    sh('git checkout -q -b side HEAD~1')
    const side = commit('side')
    sh('git checkout -q main\ngit merge -q --no-edit side\ngit push -q origin main')

    const result = checkOnly(side, second)

    expect(result.status).toBe(1)
    expect(result.stdout).toContain(`Ревизия ${side.slice(0, 9)} не содержит живую ${second.slice(0, 9)}`)
    expect(checkOnly('main', second).status).toBe(0)
  })

  it('fetches origin/main before deciding that the live revision is unknown', () => {
    const clone = path.join(root, 'clone')
    sh('git clone -q -b main origin clone', root)
    const third = sh(
      'echo third > third.txt\ngit add third.txt\ngit commit -qm third\ngit push -q origin HEAD:main\ngit rev-parse HEAD',
      clone,
    )

    // `work` has not seen `third` yet: only the fetch makes the relation visible.
    const behind = checkOnly(second, third)
    expect(behind.status).toBe(1)
    expect(behind.stdout).toContain(`старше живой ${third.slice(0, 9)}`)

    const unknown = checkOnly(second, 'a'.repeat(40))
    expect(unknown.status).toBe(1)
    expect(unknown.stdout).toContain('нет в локальной истории даже после git fetch origin main')
  })

  it('refuses instead of continuing when production does not return a revision', () => {
    const missing = checkOnly(second, undefined)
    expect(missing.status).toBe(1)
    expect(missing.stdout).toContain('Живая ревизия прода не прочитана')

    const env = liveOriginEnv(root, undefined)
    fs.writeFileSync(path.join(env.VERIFY_LIVE_ORIGIN.slice('file://'.length), '.build-source.json'), '{"sha":"main"}\n')
    const malformed = runNodeCli([GATE, '--live-check-only', second, '--cwd', work], { ...GIT_ENV, ...env })
    expect(malformed.status).toBe(1)
    expect(malformed.stdout).toContain('в ответе нет поля sha')

    const bypass = checkOnly(second, undefined, { ALLOW_DOWNGRADE: '1' })
    expect(bypass.status).toBe(0)
    expect(bypass.stdout).toContain('⚠️  ALLOW_DOWNGRADE=1')
  })

  it('applies the same check inside the full source gate and only when asked', () => {
    sh('git checkout -q --detach HEAD~1')

    const behind = gate(second)
    expect(behind.status).toBe(1)
    expect(behind.stdout).toContain('достижим из origin/main')
    expect(behind.stdout).toContain('старше живой')

    sh('git checkout -q main')
    expect(gate(first).status).toBe(0)
    expect(gate(second).status).toBe(EXIT_ALREADY_LIVE)

    // scripts/build-web-prod.js builds a local artifact and publishes nothing:
    // without --live-check the gate does not ask production at all.
    const local = runNodeCli(
      [GATE, '--deploy', '1', '--allow-dirty', '0', '--cwd', work],
      { ...GIT_ENV, ...liveOriginEnv(root, undefined) },
    )
    expect(local.status).toBe(0)
    expect(local.stdout).not.toContain('Живая ревизия')
  })

  it('builds --allow-dirty work on top of the live commit instead of calling it deployed', () => {
    fs.writeFileSync(path.join(work, 'second.txt'), 'hotfix\n')

    const result = gate(second, {}, '1')

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('собирается поверх живой ревизии')
  })

  // #3307: the check before the build is minutes old when the release is
  // staged. 11.11.2026: rollout A (the child) and rollout B (its parent) ran
  // from different checkouts, both passed the check, and B switched production
  // 21 s after A. `--publish-check` is the same comparison right before
  // `publish-code`; its stdout is the value for the server's `--expect-current`.
  describe('at the moment of publication (#3307)', () => {
    const publishCheck = (target: string, live: string | undefined, env: Record<string, string> = {}) =>
      runNodeCli([GATE, '--publish-check', target, '--cwd', work], { ...GIT_ENV, ...liveOriginEnv(root, live), ...env })

    let third: string

    beforeEach(() => {
      third = commit('third')
      sh('git push -q origin main')
    })

    it('returns the live revision the target was compared with, and the report on stderr', () => {
      const result = publishCheck(third, first)

      expect(result.status).toBe(0)
      expect(result.stdout).toBe(`${first}\n`)
      expect(result.stderr).toContain(`Живая ревизия прода ${first.slice(0, 9)} — предок выкатываемой ${third.slice(0, 9)}`)
    })

    it('refuses B, which started earlier and publishes later than A', () => {
      // B starts: production serves `first`, B's target `second` contains it.
      expect(checkOnly(second, first).status).toBe(0)

      // A publishes `third`, the child of B's target, while B is still building.
      const result = publishCheck(second, third)

      expect(EXIT_OVERTAKEN).toBe(75)
      expect(result.status).toBe(EXIT_OVERTAKEN)
      expect(result.stdout).toBe('')
      expect(result.stderr).toContain(`Ревизия ${second.slice(0, 9)} старше живой ${third.slice(0, 9)}`)
    })

    it('refuses a target that diverged from what production serves by now', () => {
      sh('git checkout -q -b side HEAD~1')
      const side = commit('side')
      sh('git checkout -q main\ngit merge -q --no-edit side\ngit push -q origin main')

      const result = publishCheck(side, third)

      expect(result.status).toBe(EXIT_OVERTAKEN)
      expect(result.stdout).toBe('')
      expect(result.stderr).toContain(`Ревизия ${side.slice(0, 9)} не содержит живую ${third.slice(0, 9)}`)
    })

    // Another session switched production to this very sha and is still
    // verifying it: neither a republication nor "already deployed, all green".
    it('does not publish over the same revision switched by another session', () => {
      const result = publishCheck(third, third)

      expect(result.status).toBe(EXIT_OVERTAKEN)
      expect(result.stdout).toBe('')
      expect(result.stderr).toContain(`Ревизия ${third.slice(0, 9)} уже публикуется или опубликована другой сессией`)
      expect(result.stderr).not.toContain('уже выкачена')
    })

    // The explicit rollback is a decision about the revision the operator saw:
    // the server still compares the current pair with it.
    it('lets an explicit rollback through and still names the revision it replaces', () => {
      const result = publishCheck(second, third, { ALLOW_DOWNGRADE: '1' })

      expect(result.status).toBe(0)
      expect(result.stdout).toBe(`${third}\n`)
      expect(result.stderr).toContain('⚠️  ALLOW_DOWNGRADE=1')
    })

    it('does not publish blind: an unreadable production stops the switch unless the rollback is explicit', () => {
      const refused = publishCheck(third, undefined)
      expect(refused.status).toBe(1)
      expect(refused.stdout).toBe('')
      expect(refused.stderr).toContain('Живая ревизия прода не прочитана')

      const forced = publishCheck(third, undefined, { ALLOW_DOWNGRADE: '1' })
      expect(forced.status).toBe(0)
      expect(forced.stdout).toBe('')
      expect(forced.stderr).toContain('публикация идёт без --expect-current')
    })

    it('keeps one exit code for "overtaken" in the gate, the publisher and build-prod.sh', () => {
      const read = (file: string) => fs.readFileSync(path.resolve(process.cwd(), file), 'utf8')

      expect(read('scripts/web-ssr-publication.sh')).toContain(`EXIT_OVERTAKEN=${EXIT_OVERTAKEN}\n`)
      expect(read('build-prod.sh')).toContain(`local overtaken_exit=${EXIT_OVERTAKEN} `)
    })
  })
})
