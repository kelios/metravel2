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
      'echo "$*" >> "$PUBLICATION_CALLS.args"',
      // `capability` as a signal point is the read of the live checks, after the
      // switch; `capability-before-switch` is the read that precedes it (#3334).
      'point="$action"',
      'if [[ "$action" == capability && ! -f "$PUBLICATION_CALLS.publish" ]]; then point=capability-before-switch; fi',
      'if [[ "$action" == publish-code ]]; then echo "$*" > "$PUBLICATION_CALLS.publish"; fi',
      'if [[ "$point" == "${STUB_SIGNAL_ON:-}" ]]; then kill -TERM "$HARNESS_PID"; sleep 0.3; fi',
      'if [[ "$action" == publish-code && -n "${STUB_PUBLISH_EXIT:-}" ]]; then exit "$STUB_PUBLISH_EXIT"; fi',
      'if [[ "$action" == finalize-code && -n "${STUB_FINALIZE_EXIT:-}" ]]; then exit "$STUB_FINALIZE_EXIT"; fi',
      'if [[ "$action" == rollback-code && -n "${STUB_ROLLBACK_EXIT:-}" ]]; then exit "$STUB_ROLLBACK_EXIT"; fi',
      'if [[ " ${STUB_FAIL:-} " == *" $point "* ]]; then exit 1; fi',
      'if [[ "$action" == capability ]]; then printf \'%s\\n\' "$STUB_CAPABILITY"; fi',
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
          STUB_EXPECT_CURRENT: LIVE_SHA, STUB_GUARD_EXIT: '', STUB_PUBLISH_EXIT: '', STUB_FINALIZE_EXIT: '',
          STUB_ROLLBACK_EXIT: '', ...env,
        },
      },
    )
  const actions = () => fs.readFileSync(calls, 'utf8').trim().split('\n').map((line) => line.trim())
  const publishCall = () => fs.readFileSync(`${calls}.publish`, 'utf8').trim()
  const calledWith = (action: string) => fs.readFileSync(`${calls}.args`, 'utf8').trim().split('\n')
    .filter((line) => line.startsWith(`${action} `))

  it('publishes, verifies and finalizes without a rollback on the ordinary path', () => {
    const result = publish()

    expect(result.status).toBe(0)
    expect(actions()).toEqual([`stage ${SHA}`, 'capability', `publish-code ${SHA}`, 'capability', `finalize-code ${SHA}`])
    expect(result.stdout).toContain('PUBLISHED')
    expect(result.stdout).not.toContain('не подтверждён')
  })

  // The audited hole: the signal lands after the switch, while the live checks
  // run. `trap 'exit 143' TERM` used to leave through an EXIT handler that knew
  // nothing about the publication.
  it('restores the previous release when SIGTERM arrives after the switch', () => {
    const result = publish({ STUB_SIGNAL_ON: 'capability' })

    expect(result.status).toBe(143)
    expect(actions()).toEqual([`stage ${SHA}`, 'capability', `publish-code ${SHA}`, 'capability', `rollback-code ${SHA}`])
    expect(result.stdout).toContain(`Релиз ${SHA.slice(0, 9)} переключён, но не подтверждён`)
    expect(result.stdout).toContain('✅ Возврат выполнен')
    expect(result.stdout).not.toContain('PUBLISHED')
  })

  it('restores the previous release when the signal interrupts the switch itself', () => {
    const result = publish({ STUB_SIGNAL_ON: 'publish-code' })

    expect(result.status).toBe(143)
    expect(actions()).toEqual([`stage ${SHA}`, 'capability', `publish-code ${SHA}`, `rollback-code ${SHA}`])
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
    expect(actions()).toEqual([`stage ${SHA}`, 'capability', `publish-code ${SHA}`, 'capability', `finalize-code ${SHA}`])
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
      expect(actions()).toEqual([`stage ${SHA}`, 'capability'])
      expect(result.stdout).toContain(`Выкат ${SHA.slice(0, 9)} остановлен до переключения: нас обогнали`)
      expect(result.stdout).toContain('ничего не возвращалось')
      expect(result.stdout).not.toContain('НУЖЕН РУЧНОЙ ВОЗВРАТ')
      expect(result.stdout).not.toContain('PUBLISHED')
    })

    it('does not publish when the live revision could not be compared', () => {
      const result = publish({ STUB_GUARD_EXIT: '1' })

      expect(result.status).toBe(1)
      expect(actions()).toEqual([`stage ${SHA}`, 'capability'])
      expect(result.stdout).toContain('Живая ревизия перед публикацией не сверена')
    })

    // The server refused under its lock, before any write. No rollback-code —
    // neither from the failure branch nor from the EXIT handler — and no
    // finalize-code of a release this rollout did not switch.
    it('leaves with the overtaken code and returns nothing when the server refuses the switch', () => {
      const result = publish({ STUB_PUBLISH_EXIT: '75' })

      expect(result.status).toBe(75)
      expect(actions()).toEqual([`stage ${SHA}`, 'capability', `publish-code ${SHA}`])
      expect(result.stdout).toContain(`Выкат ${SHA.slice(0, 9)} остановлен на переключении: нас обогнали`)
      expect(result.stdout).not.toContain('НУЖЕН РУЧНОЙ ВОЗВРАТ')
      expect(result.stdout).not.toContain('переключён, но не подтверждён')
      expect(result.stdout).not.toContain('Рендер не прошёл проверку')
    })

    it('does not return a refused release from the EXIT handler when a signal lands during the refusal', () => {
      const result = publish({ STUB_PUBLISH_EXIT: '75', STUB_SIGNAL_ON: 'publish-code' })

      expect(result.status).toBe(143)
      expect(actions()).toEqual([`stage ${SHA}`, 'capability', `publish-code ${SHA}`])
      expect(result.stdout).not.toContain('НУЖЕН РУЧНОЙ ВОЗВРАТ')
      expect(result.stdout).not.toContain('переключён, но не подтверждён')
    })

    // The backend is rolled out before this code; a host helper that does not
    // know the argument answers before its lock.
    it('reports a helper that rejected --expect-current as an error, not as a release to return', () => {
      const result = publish({ STUB_PUBLISH_EXIT: '78' })

      expect(result.status).toBe(1)
      expect(actions()).toEqual([`stage ${SHA}`, 'capability', `publish-code ${SHA}`])
      expect(result.stdout).toContain('помощник хоста не принял --expect-current')
      expect(result.stdout).not.toContain('НУЖЕН РУЧНОЙ ВОЗВРАТ')
    })

    // Any other failure of the switch may have written the receipt: fail closed.
    it.each(['1', '3', '255'])('still returns the release after an unrecognised failure of the switch (exit %s)', (code) => {
      const result = publish({ STUB_PUBLISH_EXIT: code })

      expect(result.status).toBe(1)
      expect(actions()).toEqual([`stage ${SHA}`, 'capability', `publish-code ${SHA}`, `rollback-code ${SHA}`])
    })
  })

  // #3334 (backend #3310): the receipt on the host is keyed by the sha, so the
  // helper binds it to the publication that wrote it. One id per rollout goes to
  // publish-code, finalize-code and rollback-code; `publication_mismatch` (the
  // publisher's exit 77) means "not our publication, nothing was changed". Here
  // the publisher is a stub; the real one answers a host stand-in in
  // `deploy-publish-race.test.ts`.
  describe('publication identity (#3334)', () => {
    const WITH_ID = CAPABILITY.replace(/}$/, ',"code_publication":{"expect_current":true,"publication_id":true}}')
    const idOf = (call: string) => /--publication-id ([A-Za-z0-9_-]+)$/.exec(call)?.[1]

    it('gives the switch and the acceptance of one rollout the same publication id', () => {
      const result = publish({ STUB_CAPABILITY: WITH_ID })

      expect(result.status).toBe(0)
      const id = idOf(publishCall())
      expect(id).toMatch(/^[a-f0-9]{32}$/)
      expect(publishCall()).toBe(`publish-code ${SHA} --expect-current ${LIVE_SHA} --publication-id ${id}`)
      expect(calledWith('finalize-code')).toEqual([`finalize-code ${SHA} --publication-id ${id}`])
      expect(calledWith('rollback-code')).toEqual([])
      expect(result.stdout).toContain(`🔖 Публикация ${SHA.slice(0, 9)}: --publication-id ${id}`)
    })

    it('returns a release that failed its live checks under the id it was switched with', () => {
      const result = publish({ STUB_CAPABILITY: WITH_ID, STUB_LIVE_EXIT: '1' })

      expect(result.status).toBe(1)
      const id = idOf(publishCall())
      expect(id).toMatch(/^[a-f0-9]{32}$/)
      expect(calledWith('rollback-code')).toEqual([`rollback-code ${SHA} --publication-id ${id}`])
      expect(calledWith('finalize-code')).toEqual([])
    })

    it('returns it under the same id from the EXIT handler too', () => {
      const result = publish({ STUB_CAPABILITY: WITH_ID, STUB_SIGNAL_ON: 'capability' })

      expect(result.status).toBe(143)
      expect(calledWith('rollback-code')).toEqual([`rollback-code ${SHA} --publication-id ${idOf(publishCall())}`])
    })

    it('generates a new id for every rollout', () => {
      publish({ STUB_CAPABILITY: WITH_ID })
      const first = idOf(publishCall())
      publish({ STUB_CAPABILITY: WITH_ID })

      expect(first).toMatch(/^[a-f0-9]{32}$/)
      expect(idOf(publishCall())).toMatch(/^[a-f0-9]{32}$/)
      expect(idOf(publishCall())).not.toBe(first)
    })

    // The frontend ships before the backend too: a helper that does not
    // advertise the protocol gets the former calls and says so in the report.
    it('keeps the former calls for a host helper that does not advertise the protocol', () => {
      const result = publish({ STUB_LIVE_EXIT: '1' })

      expect(publishCall()).toBe(`publish-code ${SHA} --expect-current ${LIVE_SHA}`)
      expect(calledWith('rollback-code')).toEqual([`rollback-code ${SHA}`])
      expect(result.stdout).toContain('Помощник хоста не объявил publication_id')
      expect(result.stdout).not.toContain('🔖 Публикация')
    })

    it('does not publish when the capability cannot be read right before the switch', () => {
      const result = publish({ STUB_FAIL: 'capability-before-switch' })

      expect(result.status).toBe(1)
      expect(actions()).toEqual([`stage ${SHA}`, 'capability'])
      expect(result.stdout).toContain(`релиз ${SHA.slice(0, 9)} не опубликован, прод не менялся`)
      expect(result.stdout).not.toContain('переключён, но не подтверждён')
    })

    it('has nothing to return when a signal lands before the switch', () => {
      const result = publish({ STUB_CAPABILITY: WITH_ID, STUB_SIGNAL_ON: 'capability-before-switch' })

      expect(result.status).toBe(143)
      expect(actions()).toEqual([`stage ${SHA}`, 'capability'])
      expect(result.stdout).not.toContain('переключён, но не подтверждён')
    })

    // Another session is publishing this very revision: refused before a write.
    it('leaves with the overtaken code and returns nothing when the switch answers "not our publication"', () => {
      const result = publish({ STUB_CAPABILITY: WITH_ID, STUB_PUBLISH_EXIT: '77' })

      expect(result.status).toBe(75)
      expect(actions()).toEqual([`stage ${SHA}`, 'capability', `publish-code ${SHA}`])
      expect(result.stdout).toContain(`Выкат ${SHA.slice(0, 9)} остановлен на переключении: эту ревизию публикует другая сессия`)
      expect(result.stdout).toContain('ничего не возвращалось')
      expect(result.stdout).not.toContain('НУЖЕН РУЧНОЙ ВОЗВРАТ')
      expect(result.stdout).not.toContain('переключён, но не подтверждён')
    })

    // The receipt passed to another publication between our switch and our
    // acceptance. A rollback-code would be refused the same way; before #3334 it
    // ran without an id and could return that session's pair.
    it('neither returns nor alarms when the acceptance answers "not our publication"', () => {
      const result = publish({ STUB_CAPABILITY: WITH_ID, STUB_FINALIZE_EXIT: '77' })

      expect(result.status).toBe(75)
      expect(actions().at(-1)).toBe(`finalize-code ${SHA}`)
      expect(calledWith('rollback-code')).toEqual([])
      expect(result.stdout).toContain(`Выкат ${SHA.slice(0, 9)} не принят: публикацию этой ревизии ведёт другая сессия`)
      expect(result.stdout).not.toContain('НУЖЕН РУЧНОЙ ВОЗВРАТ')
      expect(result.stdout).not.toContain('переключён, но не подтверждён')
      expect(result.stdout).not.toContain('PUBLISHED')
    })

    it('does not ask for a manual return when the automatic one answers "not our publication"', () => {
      const result = publish({ STUB_CAPABILITY: WITH_ID, STUB_LIVE_EXIT: '1', STUB_ROLLBACK_EXIT: '77' })

      expect(result.status).toBe(1)
      expect(calledWith('rollback-code')).toHaveLength(1)
      expect(result.stdout).toContain(`Возврат не выполнялся: сервер отказал до записи — receipt ревизии ${SHA.slice(0, 9)} не принадлежит этой публикации`)
      expect(result.stdout).toContain('Ручной возврат не нужен')
      expect(result.stdout).not.toContain('НУЖЕН РУЧНОЙ ВОЗВРАТ')
      expect(result.stdout).not.toContain('✅ Возврат выполнен')
    })

    it('prints the manual return with the publication id when the automatic one really failed', () => {
      const result = publish({ STUB_CAPABILITY: WITH_ID, STUB_LIVE_EXIT: '1', STUB_ROLLBACK_EXIT: '1' })

      expect(result.status).toBe(1)
      expect(result.stdout).toContain(`❌ НУЖЕН РУЧНОЙ ВОЗВРАТ: rollback-code ${SHA} не прошёл`)
      expect(result.stdout).toContain(
        `повтори: bash scripts/web-ssr-publication.sh rollback-code ${SHA} --publication-id ${idOf(publishCall())}\n`,
      )
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
