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
 *
 * #3334: the same host keeps the receipt of the code publication and its owner
 * by the contract of backend #3310: `--publication-id` binds the receipt, and
 * another publication's `finalize-code`/`rollback-code` (or `publish-code` over
 * an unfinished current pair) is answered with exit 4 and one stderr line,
 * `publication_mismatch … mutation=none`, nothing written.
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

const CAPABILITY_WITH_ID = CAPABILITY.replace(/}$/, ',"code_publication":{"expect_current":true,"publication_id":true}}')

// The host. `publish-code` compares the expected revision with the pointer
// before anything else and refuses without a write; `RACE_HELPER=old` is a
// helper that predates the argument. The receipt of the code publication is one
// line, `<state> <owner id|-> <previous sha>`; an owner other than the presented
// id (`-` without one) refuses an unfinished receipt without a write (#3310).
const HOST = [
  '#!/bin/bash',
  'cmd="$*"',
  'printf \'%s\\n\' "$cmd" >> "$RACE_SSH_CALLS"',
  "publish='web_ssr_release\\.py publish-code --sha ([a-f0-9]{40})'",
  "expect='--expect-current ([a-f0-9]{40}|none)'",
  "identity='--publication-id ([A-Za-z0-9_-]+)'",
  "settle='web_ssr_release\\.py (finalize-code|rollback-code) --receipt web-ssr/receipts/([a-f0-9]{40})\\.json'",
  'presented=-',
  'if [[ "$cmd" =~ $identity ]]; then presented="${BASH_REMATCH[1]}"; fi',
  'state=missing owner=- previous=none',
  'if [[ -f "$RACE_RECEIPT" ]]; then read -r state owner previous < "$RACE_RECEIPT"; fi',
  'not_ours() {',
  '  local binding=bound',
  '  if [[ "$state" == missing ]]; then binding=missing; elif [[ "$owner" == - ]]; then binding=unbound; fi',
  '  echo "web-ssr release refused: publication_mismatch sha=$1 state=${state/missing/none} receipt=$binding mutation=none" >&2',
  '  exit 4',
  '}',
  'if [[ "$cmd" =~ $settle ]]; then',
  '  action="${BASH_REMATCH[1]}" sha="${BASH_REMATCH[2]}"',
  "  echo 'bash: no job control in this shell' >&2",
  '  if [[ "$state" == missing ]]; then',
  '    if [[ "$presented" != - ]]; then not_ours "$sha"; fi',
  '    echo "web-ssr release refused: FileNotFoundError: receipt; inspect the candidate" >&2; exit 1',
  '  fi',
  '  if [[ "$state" != finalized && "$owner" != "$presented" ]]; then not_ours "$sha"; fi',
  '  if [[ "$action" == finalize-code ]]; then',
  '    if [[ "$(cat "$RACE_SERVER_CURRENT")" != "$sha" ]]; then',
  '      echo "web-ssr release refused: ValueError: only the current healthy activation can be finalized" >&2; exit 1',
  '    fi',
  '    printf \'finalized %s %s\\n\' "$owner" "$previous" > "$RACE_RECEIPT"',
  '  else',
  '    if [[ "$state" == finalized ]]; then',
  '      if [[ "$presented" != - && "$owner" != "$presented" ]]; then not_ours "$sha"; fi',
  '      echo "web-ssr release refused: ValueError: an accepted code release is rolled back only with --accepted" >&2; exit 1',
  '    fi',
  '    printf \'rolled_back %s %s\\n\' "$owner" "$previous" > "$RACE_RECEIPT"',
  '    printf \'%s\' "$previous" > "$RACE_SERVER_CURRENT"',
  '  fi',
  '  printf \'{"sha": "%s"}\\n\' "$sha"',
  '  exit 0',
  'fi',
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
  '  if [[ ( "$state" == prepared || "$state" == active ) && "$current" == "$sha" && "$owner" != "$presented" ]]; then not_ours "$sha"; fi',
  '  printf \'active %s %s\\n\' "$presented" "$current" > "$RACE_RECEIPT"',
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
  let serverReceipt: string
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
    serverReceipt = path.join(root, 'server-receipt')
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
          // RACE_DURING_CHECKS is what happens on the host while they run.
          'verify_deployment_runtime() { echo LIVE-CHECKS; eval "${RACE_DURING_CHECKS:-:}"; }',
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
          RACE_RECEIPT: serverReceipt, RACE_DURING_CHECKS: '',
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
      receipt: fs.existsSync(serverReceipt) ? fs.readFileSync(serverReceipt, 'utf8').trim() : '',
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
    // This host helper does not advertise the publication id (#3334).
    expect(run.helperCalls.join('\n')).not.toContain('--publication-id')
    expect(run.receipt).toBe(`finalized - ${first}`)
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

  // #3334: the receipt on the host is keyed by the sha. Before the publication
  // id a rollout could finalize or return another session's publication of the
  // same revision, and a refusal of that read as a failed return of its own.
  describe('publication identity (#3334)', () => {
    const FOREIGN = 'foreign-publication-0001'
    const withId = { RACE_CAPABILITY: CAPABILITY_WITH_ID }
    const idOf = (run: ReturnType<typeof rollout>, action: string) =>
      new RegExp(`web_ssr_release\\.py ${action} .*--publication-id ([a-f0-9]{32})$`)
        .exec(run.helperCalls.find((call) => call.startsWith(`web_ssr_release.py ${action} `)) ?? '')?.[1]
    // Another session takes the receipt of this revision while our live checks run.
    const takeover = (owner: string) => `printf 'active %s %s\\n' ${owner} ${first} > "$RACE_RECEIPT"`
    const expectNoAlarm = (run: ReturnType<typeof rollout>) => {
      expect(run.output).not.toContain('НУЖЕН РУЧНОЙ ВОЗВРАТ')
      expect(run.output).not.toContain('✅ Возврат выполнен')
      expect(run.output).not.toContain('PUBLISHED')
    }

    it('binds the receipt on the host to the rollout and accepts it under the same id', () => {
      const run = rollout(third, { live: first, current: first }, withId)

      expect(run.status).toBe(0)
      const id = idOf(run, 'publish-code')
      expect(id).toMatch(/^[a-f0-9]{32}$/)
      expect(run.helperCalls.slice(-2)).toEqual([
        `web_ssr_release.py publish-code --sha ${third} --receipt web-ssr/receipts/${third}.json --expect-current ${first} --publication-id ${id}`,
        `web_ssr_release.py finalize-code --receipt web-ssr/receipts/${third}.json --publication-id ${id}`,
      ])
      expect(run.receipt).toBe(`finalized ${id} ${first}`)
      expect(run.current).toBe(third)
      expect(run.output).toContain(`🔖 Публикация ${short(third)}: --publication-id ${id}`)
    })

    it('returns its own release under the same id when the live checks fail', () => {
      const run = rollout(third, { live: first, current: first }, { ...withId, RACE_DURING_CHECKS: 'false' })

      expect(run.status).toBe(1)
      const id = idOf(run, 'publish-code')
      expect(run.helperCalls.at(-1)).toBe(
        `web_ssr_release.py rollback-code --receipt web-ssr/receipts/${third}.json --publication-id ${id}`,
      )
      expect(run.receipt).toBe(`rolled_back ${id} ${first}`)
      expect(run.current).toBe(first)
      expect(run.output).toContain('✅ Возврат выполнен')
    })

    it.each([
      ['a rollout that passes an id', FOREIGN, 'bound', 'Receipt ведёт другая сессия выката'],
      ['a rollout that predates the id', '-', 'unbound', 'Receipt записан без идентификатора'],
    ])('does not accept a publication taken over by %s', (_name, owner, binding, hint) => {
      const run = rollout(third, { live: first, current: first }, { ...withId, RACE_DURING_CHECKS: takeover(owner) })

      expect(run.status).toBe(75)
      expect(run.actions.at(-1)).toBe('finalize-code')
      expect(run.actions).not.toContain('rollback-code')
      expect(run.receipt).toBe(`active ${owner} ${first}`)
      expect(run.current).toBe(third)
      expect(run.output).toContain(`web-ssr release refused: publication_mismatch sha=${third} state=active receipt=${binding} mutation=none`)
      expect(run.output).toContain(`❌ finalize-code ${short(third)}: это не наша публикация (state=active, receipt=${binding})`)
      expect(run.output).toContain(hint)
      expect(run.output).toContain(`Выкат ${short(third)} не принят: публикацию этой ревизии ведёт другая сессия`)
      expectNoAlarm(run)
    })

    // The case the id exists for: our checks fail while the receipt of this
    // revision already belongs to another session. Its pair stays in place.
    it('does not return another session\'s publication of the same revision when its own checks fail', () => {
      const run = rollout(third, { live: first, current: first }, { ...withId, RACE_DURING_CHECKS: `${takeover(FOREIGN)}; false` })

      expect(run.status).toBe(1)
      expect(run.actions.at(-1)).toBe('rollback-code')
      expect(run.helperCalls.at(-1)).toContain(`--publication-id ${idOf(run, 'publish-code')}`)
      expect(run.receipt).toBe(`active ${FOREIGN} ${first}`)
      expect(run.current).toBe(third)
      expect(run.output).toContain(`❌ rollback-code ${short(third)}: это не наша публикация (state=active, receipt=bound)`)
      expect(run.output).toContain(`Возврат не выполнялся: сервер отказал до записи — receipt ревизии ${short(third)} не принадлежит этой публикации`)
      expectNoAlarm(run)
    })

    // ALLOW_DOWNGRADE=1 with an unreadable production publishes without
    // --expect-current, so only the owner check stands between the two sessions.
    it('does not switch over another session\'s unfinished publication of the same revision', () => {
      fs.writeFileSync(serverReceipt, `active ${FOREIGN} ${first}\n`)
      const run = rollout(third, { live: '', current: third }, { ...withId, ALLOW_DOWNGRADE: '1' })

      expect(run.status).toBe(75)
      expect(run.helperCalls.at(-1)).toMatch(/publish-code --sha [a-f0-9]{40} --receipt \S+ --publication-id [a-f0-9]{32}$/)
      expectNothingReturned(run)
      expect(run.receipt).toBe(`active ${FOREIGN} ${first}`)
      expect(run.current).toBe(third)
      expect(run.output).toContain(`❌ publish-code ${short(third)}: это не наша публикация (state=active, receipt=bound)`)
      expect(run.output).toContain(`Выкат ${short(third)} остановлен на переключении: эту ревизию публикует другая сессия`)
    })

    // Fail closed: a return that failed for any other reason is still an alarm,
    // and the command to repeat carries the id the receipt is bound to.
    it('still asks for a manual return, with the id, when its own return fails', () => {
      const run = rollout(third, { live: first, current: first }, {
        ...withId, // The host already holds this publication as accepted; the helper refuses to return it.
        RACE_DURING_CHECKS: `printf 'finalized %s %s\\n' "$PUBLICATION_ID" ${first} > "$RACE_RECEIPT"; false`,
      })

      expect(run.status).toBe(1)
      const id = idOf(run, 'publish-code')
      expect(run.output).toContain('an accepted code release is rolled back only with --accepted')
      expect(run.output).toContain(`❌ НУЖЕН РУЧНОЙ ВОЗВРАТ: rollback-code ${third} не прошёл`)
      expect(run.output).toContain(`bash scripts/web-ssr-publication.sh rollback-code ${third} --publication-id ${id}`)
    })
  })
})
