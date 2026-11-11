/**
 * #3210: two places where `build-prod.sh` bypassed a failure instead of
 * stopping.
 *
 * 1. `yarn install --frozen-lockfile || yarn install`: with `package.json` out
 *    of sync with `yarn.lock`, or a network failure, the versions were resolved
 *    again — after the source gate, into the shared `node_modules` — and code
 *    that exists in no commit went to production under a clean build marker.
 * 2. The previous release was restored only in the branch where the switch or
 *    the live checks returned an error. A SIGTERM between `publish-code` and
 *    the end of the checks (the wrapper's timeout, a stopped session) left the
 *    unverified release live.
 *
 * Both run against the shell functions taken verbatim from `build-prod.sh`;
 * only `yarn` and the backend publication helper are stubs that record calls.
 *
 * #3307: the switch is preceded by a second live-revision check, and a server
 * refusal before any write is not a failed release. `rollback-code` finds its
 * receipt by the sha, so after such a refusal it would return another session's
 * active publication of the same revision: it must run neither from the failure
 * branch nor from the EXIT handler. Here the gate and the publisher are stubs
 * (their exit codes are the contract); the real ones run in
 * `deploy-publish-race.test.ts`.
 */
import fs from 'fs'
import path from 'path'

import { makeTempDir, removeDir, runCli } from './cli-test-utils'
import { readCanonicalDeploy } from './remote-deploy-test-utils'

function region(start: string, end: string): string {
  const source = readCanonicalDeploy()
  const from = source.indexOf(start)
  const to = source.indexOf(end, from)
  if (from === -1 || to === -1) throw new Error(`build-prod.sh region ${start} … ${end} was not found`)
  return source.slice(from, to)
}

// Globals, stage timers, the rollback helper and the single EXIT trap.
const PRELUDE = region("EXPORT_LOG=''", 'assert_deployable_source() {')
const INSTALL_DEPS = region('install_deps() {', 'create_export_log() {')
const PUBLICATION = region('verify_deployment_runtime() {', "ENV=''\nALLOW_DIRTY=0")

const SHA = 'c0ffee0000000000000000000000000000000001'
const LIVE_SHA = 'beef000000000000000000000000000000000002'
const CAPABILITY = '{"schema_version":2,"available":true,"enabled":true,"quest_web":{"schema_version":2,"builder_schema":2,"refresh_max_age_seconds":10}}'

function writeExecutable(filePath: string, lines: string[]): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, `${lines.join('\n')}\n`)
  fs.chmodSync(filePath, 0o755)
}

describe('build-prod.sh dependency install (#3210)', () => {
  let work: string
  let calls: string

  beforeEach(() => {
    work = makeTempDir('build-prod-install-')
    calls = path.join(work, 'yarn-calls.txt')
    writeExecutable(path.join(work, 'bin/yarn'), [
      '#!/bin/bash',
      'echo "$*" >> "$YARN_CALLS"',
      'if [[ " $* " == *" --frozen-lockfile "* ]]; then exit "${STUB_FROZEN_EXIT:-0}"; fi',
      'exit 0',
    ])
  })

  afterEach(() => {
    removeDir(work)
  })

  const install = (env: Record<string, string>) =>
    runCli('bash', ['-c', ['set -Eeuo pipefail', INSTALL_DEPS, 'install_deps', 'echo INSTALLED'].join('\n')], {
      cwd: work,
      env: { PATH: `${path.join(work, 'bin')}:${process.env.PATH}`, YARN_CALLS: calls, CLEAN: '0', ...env },
    })
  const yarnCalls = () => fs.readFileSync(calls, 'utf8').trim().split('\n')

  it('stops a deploy when the strict install fails and never installs past yarn.lock', () => {
    const result = install({ DEPLOY: '1', STUB_FROZEN_EXIT: '1' })

    expect(result.status).not.toBe(0)
    expect(yarnCalls()).toEqual(['install --frozen-lockfile'])
    expect(result.stdout).toContain('выкат остановлен, прод не менялся')
    expect(result.stdout).not.toContain('INSTALLED')
  })

  it('keeps the soft install only for a build without a deploy, and says the artifact is not deployable', () => {
    const result = install({ DEPLOY: '0', STUB_FROZEN_EXIT: '1' })

    expect(result.status).toBe(0)
    expect(yarnCalls()).toEqual(['install --frozen-lockfile', 'install'])
    expect(result.stdout).toContain('деплоить такой артефакт нельзя')
    expect(result.stdout).toContain('INSTALLED')
  })

  it('installs once when the lockfile is honoured', () => {
    const result = install({ DEPLOY: '1' })

    expect(result.status).toBe(0)
    expect(yarnCalls()).toEqual(['install --frozen-lockfile'])
  })

  it('has no unconditional fallback past the lockfile left in the script', () => {
    expect(readCanonicalDeploy()).not.toMatch(/--frozen-lockfile\s*\|\|/)
  })
})

describe('build-prod.sh unconfirmed release (#3210)', () => {
  let work: string
  let calls: string

  beforeEach(() => {
    work = makeTempDir('build-prod-unconfirmed-')
    calls = path.join(work, 'publication-calls.txt')
    // The backend helper: records the action and fails or signals on demand.
    writeExecutable(path.join(work, 'scripts/web-ssr-publication.sh'), [
      '#!/bin/bash',
      'action="$1"',
      'echo "$action ${2:-}" >> "$PUBLICATION_CALLS"',
      'if [[ "$action" == publish-code ]]; then echo "$*" > "$PUBLICATION_CALLS.publish"; fi',
      'if [[ "$action" == "${STUB_SIGNAL_ON:-}" ]]; then kill -TERM "$HARNESS_PID"; sleep 0.3; fi',
      'if [[ "$action" == publish-code && -n "${STUB_PUBLISH_EXIT:-}" ]]; then exit "$STUB_PUBLISH_EXIT"; fi',
      'if [[ "$action" == capability ]]; then printf \'%s\\n\' "$STUB_CAPABILITY"; fi',
      'if [[ " ${STUB_FAIL:-} " == *" $action "* ]]; then exit 1; fi',
      'exit 0',
    ])
    fs.mkdirSync(path.join(work, 'scripts/lib'), { recursive: true })
    fs.copyFileSync(path.resolve(process.cwd(), 'scripts/lib/webOutput.js'), path.join(work, 'scripts/lib/webOutput.js'))
    fs.writeFileSync(
      path.join(work, 'scripts/verify-live-deployment-ssr.js'),
      'process.exit(Number(process.env.STUB_LIVE_EXIT || 0))\n',
    )
    // The live-revision check before the switch (#3307): stdout is the value
    // for `--expect-current`, the exit code is the verdict.
    fs.writeFileSync(
      path.join(work, 'scripts/assert-deployable-source.js'),
      [
        "if (process.env.STUB_EXPECT_CURRENT) process.stdout.write(process.env.STUB_EXPECT_CURRENT + '\\n')",
        'process.exit(Number(process.env.STUB_GUARD_EXIT || 0))',
        '',
      ].join('\n'),
    )
  })

  afterEach(() => {
    removeDir(work)
  })

  const publish = (env: Record<string, string> = {}) =>
    runCli(
      'bash',
      [
        '-c',
        [
          'set -Eeuo pipefail',
          "IFS=$'\\n\\t'",
          PRELUDE,
          PUBLICATION,
          'export HARNESS_PID=$$',
          `BUILD_SOURCE_SHA=${SHA}`,
          'SSR_CODE_RELEASE=1',
          'ENV=prod',
          'DEPLOY=1',
          'deploy_prod prod',
          'echo PUBLISHED',
        ].join('\n'),
      ],
      {
        cwd: work,
        env: {
          PUBLICATION_CALLS: calls, STUB_CAPABILITY: CAPABILITY, STUB_SIGNAL_ON: '', STUB_FAIL: '',
          STUB_EXPECT_CURRENT: LIVE_SHA, STUB_GUARD_EXIT: '', STUB_PUBLISH_EXIT: '', ...env,
        },
      },
    )
  const actions = () => fs.readFileSync(calls, 'utf8').trim().split('\n').map((line) => line.trim())
  const publishCall = () => fs.readFileSync(`${calls}.publish`, 'utf8').trim()

  it('publishes, verifies and finalizes without a rollback on the ordinary path', () => {
    const result = publish()

    expect(result.status).toBe(0)
    expect(actions()).toEqual([`stage ${SHA}`, `publish-code ${SHA}`, 'capability', `finalize-code ${SHA}`])
    expect(result.stdout).toContain('PUBLISHED')
    expect(result.stdout).not.toContain('не подтверждён')
  })

  // The audited hole: the signal lands after the switch, while the live checks
  // run. `trap 'exit 143' TERM` used to leave through an EXIT handler that knew
  // nothing about the publication.
  it('restores the previous release when SIGTERM arrives after the switch', () => {
    const result = publish({ STUB_SIGNAL_ON: 'capability' })

    expect(result.status).toBe(143)
    expect(actions()).toEqual([`stage ${SHA}`, `publish-code ${SHA}`, 'capability', `rollback-code ${SHA}`])
    expect(result.stdout).toContain(`Релиз ${SHA.slice(0, 9)} переключён, но не подтверждён`)
    expect(result.stdout).toContain('✅ Возврат выполнен')
    expect(result.stdout).not.toContain('PUBLISHED')
  })

  it('restores the previous release when the signal interrupts the switch itself', () => {
    const result = publish({ STUB_SIGNAL_ON: 'publish-code' })

    expect(result.status).toBe(143)
    expect(actions()).toEqual([`stage ${SHA}`, `publish-code ${SHA}`, `rollback-code ${SHA}`])
  })

  it('rolls a failed live check back exactly once', () => {
    const result = publish({ STUB_LIVE_EXIT: '1' })

    expect(result.status).toBe(1)
    expect(actions().filter((action) => action.startsWith('rollback-code'))).toEqual([`rollback-code ${SHA}`])
    expect(actions()).not.toContain(`finalize-code ${SHA}`)
    expect(result.stdout).toContain('❌ Рендер не прошёл проверку')
  })

  it('treats a release whose finalization failed as unconfirmed', () => {
    const result = publish({ STUB_FAIL: 'finalize-code' })

    expect(result.status).not.toBe(0)
    expect(actions().slice(-2)).toEqual([`finalize-code ${SHA}`, `rollback-code ${SHA}`])
  })

  // #3272: the signal lands while a successful `finalize-code` is still running.
  // The release is accepted; a rollback would be refused by the backend and the
  // report would ask for a manual return of an intact production.
  it('does not roll an accepted release back when the signal arrives during finalization', () => {
    const result = publish({ STUB_SIGNAL_ON: 'finalize-code' })

    expect(result.status).toBe(143)
    expect(actions()).toEqual([`stage ${SHA}`, `publish-code ${SHA}`, 'capability', `finalize-code ${SHA}`])
    expect(result.stdout).toContain(`релиз ${SHA.slice(0, 9)} уже принят, прод не возвращается`)
    expect(result.stdout).not.toContain('НУЖЕН РУЧНОЙ ВОЗВРАТ')
    expect(result.stdout).not.toContain('переключён, но не подтверждён')
  })

  it('still returns the release when the interrupted finalization itself failed', () => {
    const result = publish({ STUB_SIGNAL_ON: 'finalize-code', STUB_FAIL: 'finalize-code' })

    expect(result.status).toBe(143)
    expect(actions().slice(-2)).toEqual([`finalize-code ${SHA}`, `rollback-code ${SHA}`])
    expect(result.stdout).toContain('✅ Возврат выполнен')
  })

  it('asks for a manual rollback, loudly and with a failing code, when the automatic one fails', () => {
    const result = publish({ STUB_SIGNAL_ON: 'capability', STUB_FAIL: 'rollback-code' })

    expect(result.status).toBe(143)
    expect(result.stdout).toContain(`❌ НУЖЕН РУЧНОЙ ВОЗВРАТ: rollback-code ${SHA} не прошёл`)
    expect(result.stdout).toContain(`bash scripts/web-ssr-publication.sh rollback-code ${SHA}`)
  })

  it('does not touch the release when the server refuses the stage', () => {
    const result = publish({ STUB_FAIL: 'stage' })

    expect(result.status).not.toBe(0)
    expect(actions()).toEqual([`stage ${SHA}`])
    expect(result.stdout).toContain('прод не менялся')
  })

  describe('live revision at the moment of publication (#3307)', () => {
    it('hands the live revision it was checked against to the server', () => {
      const result = publish()

      expect(result.status).toBe(0)
      expect(publishCall()).toBe(`publish-code ${SHA} --expect-current ${LIVE_SHA}`)
    })

    // ALLOW_DOWNGRADE=1 with an unreadable production: nothing to compare with.
    it('publishes without the comparison only when the gate returned no revision', () => {
      const result = publish({ STUB_EXPECT_CURRENT: '' })

      expect(result.status).toBe(0)
      expect(publishCall()).toBe(`publish-code ${SHA}`)
    })

    it('stops before the switch with its own exit code when production moved on during the build', () => {
      const result = publish({ STUB_GUARD_EXIT: '75' })

      expect(result.status).toBe(75)
      expect(actions()).toEqual([`stage ${SHA}`])
      expect(result.stdout).toContain(`Выкат ${SHA.slice(0, 9)} остановлен до переключения: нас обогнали`)
      expect(result.stdout).toContain('ничего не возвращалось')
      expect(result.stdout).not.toContain('НУЖЕН РУЧНОЙ ВОЗВРАТ')
      expect(result.stdout).not.toContain('PUBLISHED')
    })

    it('does not publish when the live revision could not be compared', () => {
      const result = publish({ STUB_GUARD_EXIT: '1' })

      expect(result.status).toBe(1)
      expect(actions()).toEqual([`stage ${SHA}`])
      expect(result.stdout).toContain('Живая ревизия перед публикацией не сверена')
    })

    // The server refused under its lock, before any write. No rollback-code —
    // neither from the failure branch nor from the EXIT handler — and no
    // finalize-code of a release this rollout did not switch.
    it('leaves with the overtaken code and returns nothing when the server refuses the switch', () => {
      const result = publish({ STUB_PUBLISH_EXIT: '75' })

      expect(result.status).toBe(75)
      expect(actions()).toEqual([`stage ${SHA}`, `publish-code ${SHA}`])
      expect(result.stdout).toContain(`Выкат ${SHA.slice(0, 9)} остановлен на переключении: нас обогнали`)
      expect(result.stdout).not.toContain('НУЖЕН РУЧНОЙ ВОЗВРАТ')
      expect(result.stdout).not.toContain('переключён, но не подтверждён')
      expect(result.stdout).not.toContain('Рендер не прошёл проверку')
    })

    it('does not return a refused release from the EXIT handler when a signal lands during the refusal', () => {
      const result = publish({ STUB_PUBLISH_EXIT: '75', STUB_SIGNAL_ON: 'publish-code' })

      expect(result.status).toBe(143)
      expect(actions()).toEqual([`stage ${SHA}`, `publish-code ${SHA}`])
      expect(result.stdout).not.toContain('НУЖЕН РУЧНОЙ ВОЗВРАТ')
      expect(result.stdout).not.toContain('переключён, но не подтверждён')
    })

    // The backend is rolled out before this code; a host helper that does not
    // know the argument answers before its lock.
    it('reports a helper that rejected --expect-current as an error, not as a release to return', () => {
      const result = publish({ STUB_PUBLISH_EXIT: '78' })

      expect(result.status).toBe(1)
      expect(actions()).toEqual([`stage ${SHA}`, `publish-code ${SHA}`])
      expect(result.stdout).toContain('помощник хоста не принял --expect-current')
      expect(result.stdout).not.toContain('НУЖЕН РУЧНОЙ ВОЗВРАТ')
    })

    // Any other failure of the switch may have written the receipt: fail closed.
    it.each(['1', '3', '255'])('still returns the release after an unrecognised failure of the switch (exit %s)', (code) => {
      const result = publish({ STUB_PUBLISH_EXIT: code })

      expect(result.status).toBe(1)
      expect(actions()).toEqual([`stage ${SHA}`, `publish-code ${SHA}`, `rollback-code ${SHA}`])
    })
  })

  // The marker must be visible to the single EXIT trap: a rollback wired into a
  // second handler would be dropped the way the .env restore once was (#1881).
  it('keeps the rollback in the one installed EXIT handler', () => {
    const onExit = region('on_exit() {', 'trap on_exit EXIT')
    expect(onExit).toContain('rollback_unconfirmed_release')
    expect(onExit.indexOf('rollback_unconfirmed_release')).toBeLessThan(onExit.lastIndexOf('restore_env_file'))
  })
})
