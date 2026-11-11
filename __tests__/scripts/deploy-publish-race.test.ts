/**
 * #3307: two rollouts from different checkouts, the older revision published
 * over the newer one.
 *
 * 11.11.2026: rollout A published `f55bd5851`; rollout B, started earlier from
 * another checkout, published its parent `9dc4bc921` 21 s later. Production
 * went back silently and B reported success. The live-revision check ran once,
 * before the build; the local build lock is per checkout; the host lock
 * serialises operations but not their order in history.
 *
 * Everything on the client side runs for real: `deploy_prod` and its EXIT
 * handler taken verbatim from `build-prod.sh`, the gate
 * (`scripts/assert-deployable-source.js`) with its curl read and
 * `git merge-base` over a throwaway repository, and the publisher
 * (`scripts/web-ssr-publication.sh`). Only the host is a stand-in: `ssh` keeps
 * a `current` pointer and answers `publish-code --expect-current` by the
 * contract of the backend helper (#3308) — exit 3 and one stderr line, nothing
 * written. A `file://` origin is what `/.build-source.json` answered.
 */
import fs from 'fs'
import path from 'path'

import { makeTempDir, removeDir, runCli } from './cli-test-utils'
import { liveOriginEnv, readCanonicalDeploy } from './remote-deploy-test-utils'

function region(start: string, end: string): string {
  const source = readCanonicalDeploy()
  const from = source.indexOf(start)
  const to = source.indexOf(end, from)
  if (from === -1 || to === -1) throw new Error(`build-prod.sh region ${start} … ${end} was not found`)
  return source.slice(from, to)
}

const PRELUDE = region("EXPORT_LOG=''", 'assert_deployable_source() {')
const PUBLICATION = region('verify_deployment_runtime() {', "ENV=''\nALLOW_DIRTY=0")

const GIT_ENV = {
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_SYSTEM: '/dev/null',
  GIT_AUTHOR_NAME: 'publish race test',
  GIT_AUTHOR_EMAIL: 'publish-race@test.local',
  GIT_COMMITTER_NAME: 'publish race test',
  GIT_COMMITTER_EMAIL: 'publish-race@test.local',
}
const CAPABILITY = '{"schema_version":2,"available":true,"enabled":true,"quest_web":{"schema_version":2,"builder_schema":2,"refresh_max_age_seconds":10}}'

// The host. `publish-code` compares the expected revision with the pointer
// before anything else and refuses without a write; `RACE_HELPER=old` is a
// helper that predates the argument.
const HOST = [
  '#!/bin/bash',
  'cmd="$*"',
  'printf \'%s\\n\' "$cmd" >> "$RACE_SSH_CALLS"',
  "publish='web_ssr_release\\.py publish-code --sha ([a-f0-9]{40})'",
  "expect='--expect-current ([a-f0-9]{40}|none)'",
  'if [[ "$cmd" =~ $publish ]]; then',
  '  sha="${BASH_REMATCH[1]}"',
  '  current="$(cat "$RACE_SERVER_CURRENT")"',
  "  echo 'bash: no job control in this shell' >&2",
  '  if [[ "$cmd" =~ $expect ]]; then',
  '    if [[ "${RACE_HELPER:-}" == old ]]; then',
  '      echo "usage: web_ssr_release.py [-h] [--sha SHA] [--receipt RECEIPT] action" >&2',
  '      echo "web_ssr_release.py: error: unrecognized arguments: --expect-current ${BASH_REMATCH[1]}" >&2',
  '      exit 2',
  '    fi',
  '    if [[ "${BASH_REMATCH[1]}" != "$current" ]]; then',
  '      echo "web-ssr release refused: current_changed expected=${BASH_REMATCH[1]} actual=$current mutation=none" >&2',
  '      exit 3',
  '    fi',
  '  fi',
  '  printf \'%s\' "$sha" > "$RACE_SERVER_CURRENT"',
  '  printf \'{"receipt": "web-ssr/receipts/%s.json", "sha": "%s"}\\n\' "$sha" "$sha"',
  '  exit 0',
  'fi',
  'if [[ "$cmd" == *"web_ssr_release.py capability"* ]]; then printf \'%s\\n\' "$RACE_CAPABILITY"; fi',
  'exit 0',
]

describe('rollout overtaken between its start and its publication (#3307)', () => {
  let root: string
  let work: string
  let calls: string
  let serverCurrent: string
  let first: string
  let second: string
  let third: string

  const sh = (script: string, cwd = work): string => {
    const result = runCli('bash', ['-c', `set -euo pipefail\n${script}`], { cwd, env: GIT_ENV })
    if (result.status !== 0) throw new Error(`${script}\n${result.stderr || result.stdout}`)
    return result.stdout.trim()
  }
  const commit = (name: string): string =>
    sh(`echo ${name} > ${name}.txt\ngit add ${name}.txt\ngit commit -qm ${name}\ngit rev-parse HEAD`)

  beforeEach(() => {
    root = fs.realpathSync(makeTempDir('deploy-publish-race-'))
    work = path.join(root, 'work')
    calls = path.join(root, 'ssh-calls.txt')
    serverCurrent = path.join(root, 'server-current')
    sh('git init -q --bare origin\ngit init -q work', root)
    sh("git symbolic-ref HEAD refs/heads/main\ngit remote add origin ../origin\nprintf '%s\\n' .codex-temp/ scripts candidate >> .git/info/exclude")
    first = commit('first')
    second = commit('second')
    third = commit('third')
    sh('git push -q origin main')

    // The shipped scripts; the release candidate the stage uploads.
    fs.symlinkSync(path.resolve(process.cwd(), 'scripts'), path.join(work, 'scripts'), 'dir')
    const candidate = path.join(work, '.codex-temp/deploy/ssr-release')
    fs.mkdirSync(path.join(candidate, 'runtime'), { recursive: true })
    fs.writeFileSync(path.join(candidate, '.ssr-build.json'), '{}')

    const bin = path.join(root, 'bin')
    fs.mkdirSync(bin)
    fs.writeFileSync(path.join(bin, 'ssh'), `${HOST.join('\n')}\n`, { mode: 0o755 })
    fs.writeFileSync(path.join(bin, 'rsync'), '#!/bin/sh\nexit 0\n', { mode: 0o755 })
  })

  afterEach(() => {
    removeDir(root)
  })

  // `live` — what /.build-source.json answers when the rollout re-reads it;
  // `current` — the pointer on the host when `publish-code` arrives.
  const rollout = (target: string, state: { live: string; current: string }, env: Record<string, string> = {}) => {
    fs.writeFileSync(serverCurrent, state.current)
    const result = runCli(
      'bash',
      [
        '-c',
        [
          'set -Eeuo pipefail',
          "IFS=$'\\n\\t'",
          PRELUDE,
          PUBLICATION,
          // The live SSR checks read the real site; they are not the subject.
          'verify_deployment_runtime() { echo LIVE-CHECKS; }',
          `BUILD_SOURCE_SHA=${target}`,
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
          ...GIT_ENV,
          ...liveOriginEnv(root, state.live),
          PATH: `${path.join(root, 'bin')}:${process.env.PATH}`,
          DEPLOY_ENV_FILE: path.join(root, 'missing-env'),
          PROD_SSH_USER: 'test', PROD_SSH_HOST: 'invalid.example', PROD_REMOTE_DIR: '/owned/repository',
          EXPO_PUBLIC_QUEST_WEB_RUNTIME_SSR: 'true',
          RACE_SSH_CALLS: calls, RACE_SERVER_CURRENT: serverCurrent, RACE_CAPABILITY: CAPABILITY, RACE_HELPER: '',
          ...env,
        },
      },
    )
    const helperCalls = fs.readFileSync(calls, 'utf8').trim().split('\n')
      .map((line) => /web_ssr_release\.py ([a-z-]+)[^']*/.exec(line)?.[0] ?? '')
      .filter(Boolean)
    return {
      status: result.status,
      output: `${result.stdout}\n${result.stderr}`,
      helperCalls,
      actions: helperCalls.map((call) => call.split(' ')[1]),
      current: fs.readFileSync(serverCurrent, 'utf8'),
    }
  }
  const short = (sha: string) => sha.slice(0, 9)
  const expectNothingReturned = (run: ReturnType<typeof rollout>) => {
    expect(run.actions).not.toContain('rollback-code')
    expect(run.actions).not.toContain('finalize-code')
    expect(run.output).not.toContain('НУЖЕН РУЧНОЙ ВОЗВРАТ')
    expect(run.output).not.toContain('переключён, но не подтверждён')
    expect(run.output).not.toContain('PUBLISHED')
    expect(run.output).not.toContain('LIVE-CHECKS')
  }

  it('publishes a descendant and names the revision it replaces to the server', () => {
    const run = rollout(third, { live: first, current: first })

    expect(run.status).toBe(0)
    expect(run.helperCalls).toContain(
      `web_ssr_release.py publish-code --sha ${third} --receipt web-ssr/receipts/${third}.json --expect-current ${first}`,
    )
    expect(run.actions.slice(-2)).toEqual(['publish-code', 'finalize-code'])
    expect(run.current).toBe(third)
    expect(run.output).toContain('PUBLISHED')
  })

  // The incident. B's target `second` contained the live `first` when B
  // started; A published `third`, the child of `second`, while B was building.
  it('refuses B before the switch when A published during B\'s build', () => {
    const run = rollout(second, { live: third, current: third })

    expect(run.status).toBe(75)
    expect(run.actions).not.toContain('publish-code')
    expectNothingReturned(run)
    expect(run.current).toBe(third)
    expect(run.output).toContain(`Ревизия ${short(second)} старше живой ${short(third)}`)
    expect(run.output).toContain(`Выкат ${short(second)} остановлен до переключения: нас обогнали`)
  })

  // The window the client cannot close: A switches after B has re-read the
  // live revision. The host refuses under its own lock; B must not answer with
  // rollback-code — neither from the failure branch nor from the EXIT handler.
  it('refuses B on the host when A switched between B\'s check and B\'s switch', () => {
    const run = rollout(second, { live: first, current: third })

    expect(run.status).toBe(75)
    expect(run.helperCalls.filter((call) => call.includes('publish-code'))).toEqual([
      `web_ssr_release.py publish-code --sha ${second} --receipt web-ssr/receipts/${second}.json --expect-current ${first}`,
    ])
    expect(run.actions.at(-1)).toBe('publish-code')
    expectNothingReturned(run)
    expect(run.current).toBe(third)
    expect(run.output).toContain(`Нас обогнали: прод уже ушёл на ${short(third)}; наш ${short(second)} не опубликован — ничего не возвращалось`)
    expect(run.output).toContain(`Выкат ${short(second)} остановлен на переключении: нас обогнали`)
  })

  // The newer rollout loses the same race: it is told so and repeats.
  it('refuses A the same way when B switched first, without touching B\'s release', () => {
    const run = rollout(third, { live: first, current: second })

    expect(run.status).toBe(75)
    expectNothingReturned(run)
    expect(run.current).toBe(second)
    expect(run.output).toContain(`Нас обогнали: прод уже ушёл на ${short(second)}; наш ${short(third)} не опубликован`)
  })

  // Another session switched production to this very sha and is still
  // verifying it. Its receipt is keyed by the same sha: a rollback-code or a
  // finalize-code from here would act on a publication this rollout never made.
  it.each([
    ['seen in /.build-source.json before the switch', (sha: string) => ({ live: sha, current: sha }), false],
    ['reported by the host after the check', (sha: string, before: string) => ({ live: before, current: sha }), true],
  ])('neither returns nor finalizes the same revision published by another session: %s', (_name, state, reachedHost) => {
    const run = rollout(third, state(third, first))

    expect(run.status).toBe(75)
    expect(run.actions.includes('publish-code')).toBe(reachedHost)
    expectNothingReturned(run)
    expect(run.current).toBe(third)
    expect(run.output).toContain(`Ревизия ${short(third)} уже публикуется или опубликована другой сессией`)
  })

  it('keeps the explicit rollback working, against the revision the operator saw', () => {
    const run = rollout(second, { live: third, current: third }, { ALLOW_DOWNGRADE: '1' })

    expect(run.status).toBe(0)
    expect(run.output).toContain('⚠️  ALLOW_DOWNGRADE=1')
    expect(run.helperCalls).toContain(
      `web_ssr_release.py publish-code --sha ${second} --receipt web-ssr/receipts/${second}.json --expect-current ${third}`,
    )
    expect(run.current).toBe(second)

    // The flag is a decision about `third`; production moved elsewhere meanwhile.
    fs.rmSync(calls)
    const stale = rollout(second, { live: third, current: first }, { ALLOW_DOWNGRADE: '1' })
    expect(stale.status).toBe(75)
    expectNothingReturned(stale)
    expect(stale.current).toBe(first)
  })

  // The backend is rolled out before this code. A host helper that predates
  // the argument rejects it before its lock: an error with a hint, no rollback.
  it('stops on a host helper that does not know --expect-current', () => {
    const run = rollout(third, { live: first, current: first }, { RACE_HELPER: 'old' })

    expect(run.status).toBe(1)
    expectNothingReturned(run)
    expect(run.current).toBe(first)
    expect(run.output).toContain('Помощник публикации на хосте не принял --expect-current')
    expect(run.output).toContain('выкатите бэкенд и повторите выкат фронта')
  })
})
