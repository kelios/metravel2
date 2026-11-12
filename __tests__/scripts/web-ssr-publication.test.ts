/** @jest-environment node */

import fs from 'node:fs'
import path from 'node:path'
import { makeTempDir, runCli } from './cli-test-utils'

describe('SSR publication pre-transfer checkout gate', () => {
  let fixture: string

  beforeEach(() => {
    const parent = path.resolve('.codex-temp', 'ssr-publication-tests')
    fs.mkdirSync(parent, { recursive: true })
    fixture = makeTempDir('run-', { root: parent })
    fs.mkdirSync(path.join(fixture, 'candidate', 'runtime'), { recursive: true })
    fs.writeFileSync(path.join(fixture, 'candidate', '.ssr-build.json'), '{}')
    fs.writeFileSync(path.join(fixture, 'ssh'), '#!/bin/sh\nprintf "%s\\n" "$*" >> "$SSR_TEST_CALLS"\nif [ "$SSR_TEST_CAPABILITY" = error ]; then exit 1; fi\nprintf "%s\\n" "$SSR_TEST_CAPABILITY"\n', { mode: 0o755 })
    fs.writeFileSync(path.join(fixture, 'rsync'), '#!/bin/sh\nprintf "rsync %s\\n" "$*" >> "$SSR_TEST_CALLS"\n', { mode: 0o755 })
  })

  afterEach(() => fs.rmSync(fixture, { recursive: true, force: true }))

  it.each(['error', '{"schema_version":1,"available":true,"enabled":false}', 'invalid JSON'])(
    'does not upload after a refused or invalid backend capability: %s', (capability) => {
      const calls = path.join(fixture, 'calls.txt')
      const result = runCli('bash', ['scripts/web-ssr-publication.sh', 'stage', 'a'.repeat(40), path.join(fixture, 'candidate')], {
        cwd: process.cwd(),
        env: {
          ...process.env, PATH: `${fixture}${path.delimiter}${process.env.PATH}`,
          DEPLOY_ENV_FILE: path.join(fixture, 'missing-env'),
          PROD_SSH_USER: 'test', PROD_SSH_HOST: 'invalid.example', PROD_REMOTE_DIR: '/owned/repository',
          SSR_TEST_CALLS: calls, SSR_TEST_CAPABILITY: capability,
        },
      })
      expect(result.status).not.toBe(0)
      const commands = fs.readFileSync(calls, 'utf8')
      expect(commands).toContain('web_ssr_release.py capability')
      expect(commands).not.toContain('rsync')
      expect(commands).not.toContain('preflight')
    },
  )

  // The explicit chunk limit is read on the host only after the stage has
  // sealed the release; a typo must not cost an upload and a seal.
  it('refuses a malformed explicit chunk limit before any transfer', () => {
    const calls = path.join(fixture, 'calls.txt')
    const result = runCli('bash', ['scripts/web-ssr-publication.sh', 'stage', 'a'.repeat(40), path.join(fixture, 'candidate')], {
      cwd: process.cwd(), env: {
        ...process.env, PATH: `${fixture}${path.delimiter}${process.env.PATH}`,
        DEPLOY_ENV_FILE: path.join(fixture, 'missing-env'),
        PROD_SSH_USER: 'test', PROD_SSH_HOST: 'invalid.example', PROD_REMOTE_DIR: '/owned/repository',
        SSR_RELEASE_JS_MAX_MB: '700MB',
        SSR_TEST_CALLS: calls, SSR_TEST_CAPABILITY: '{"schema_version":1,"available":true,"enabled":true}',
      },
    })
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('SSR_RELEASE_JS_MAX_MB must be a whole number')
    const commands = fs.readFileSync(calls, 'utf8')
    expect(commands).not.toContain('rsync')
    expect(commands).not.toContain('preflight')
  })

  it('preserves hardlinks in the remote transfer after the unchanged disk preflight', () => {
    const calls = path.join(fixture, 'calls.txt')
    const result = runCli('bash', ['scripts/web-ssr-publication.sh', 'stage', 'a'.repeat(40), path.join(fixture, 'candidate')], {
      cwd: process.cwd(), env: {
        ...process.env, PATH: `${fixture}${path.delimiter}${process.env.PATH}`,
        DEPLOY_ENV_FILE: path.join(fixture, 'missing-env'),
        PROD_SSH_USER: 'test', PROD_SSH_HOST: 'invalid.example', PROD_REMOTE_DIR: '/owned/repository',
        EXPO_PUBLIC_QUEST_WEB_RUNTIME_SSR: 'false', DEPLOY_DISK_RESERVE_MB: '720', DEPLOY_BACKEND_BUILD_MB: '1536',
        SSR_TEST_CALLS: calls, SSR_TEST_CAPABILITY: '{"schema_version":1,"available":true,"enabled":true}',
      },
    })
    expect(result.status).toBe(0)
    const commands = fs.readFileSync(calls, 'utf8').trim().split('\n')
    const transfer = commands.findIndex(command => command.startsWith('rsync '))
    const preflight = commands.findIndex(command => command.includes('bash -s -- preflight'))
    expect(preflight).toBeGreaterThan(0)
    expect(transfer).toBeGreaterThan(preflight)
    expect(commands[preflight]).toContain('720 1536')
    expect(commands[transfer]).toContain('rsync -azHhe ssh --delete --mkpath --protect-args ')
    expect(commands[transfer]).not.toContain('--exclude')
    expect(commands[transfer]).toContain('/web-ssr/incoming/'+'a'.repeat(40)+'/')
    // One transfer (book files live in S3, #2971); the sealed release is audited afterwards.
    expect(commands.filter(command => command.startsWith('rsync '))).toHaveLength(1)
    const audits = commands.filter(command => command.includes('bash -s -- books ') || command.includes('bash -s -- chunks '))
    expect(audits).toHaveLength(2)
    expect(audits[0]).toContain('bash -s -- books /owned/repository/web-ssr/releases/'+'a'.repeat(40)+'/client /owned/repository/web-ssr/shared/travel-books')
    expect(audits[1]).toMatch(/bash -s -- chunks \/owned\/repository\/web-ssr\/releases\/a{40}\/client \d+ 256$/)
    expect(commands.indexOf(audits[0])).toBeGreaterThan(commands.findIndex(command => command.includes('stage --sha')))
  })

  // Ready-book files live in S3 (#2971): the release carries only the
  // pointer `client/travel-books/manifest.json`, which travels with the rest of
  // the candidate in the one transfer the disk preflight sizes.
  it('carries the book pointer with the candidate and sizes the preflight by the whole candidate', () => {
    const calls = path.join(fixture, 'calls.txt')
    fs.mkdirSync(path.join(fixture, 'candidate/client/travel-books'), { recursive: true })
    fs.writeFileSync(path.join(fixture, 'candidate/client/travel-books/manifest.json'), '{}'.padEnd(8 * 1024, ' '))
    fs.mkdirSync(path.join(fixture, 'candidate/client/_expo/static/js/web'), { recursive: true })
    fs.writeFileSync(path.join(fixture, 'candidate/client/_expo/static/js/web/entry-a.js'), 'x'.repeat(4096))
    const candidateKib = Number(runCli('du', ['-sk', path.join(fixture, 'candidate')]).stdout.split(/\s+/)[0])
    const result = runCli('bash', ['scripts/web-ssr-publication.sh', 'stage', 'b'.repeat(40), path.join(fixture, 'candidate')], {
      cwd: process.cwd(), env: {
        ...process.env, PATH: `${fixture}${path.delimiter}${process.env.PATH}`,
        DEPLOY_ENV_FILE: path.join(fixture, 'missing-env'),
        PROD_SSH_USER: 'test', PROD_SSH_HOST: 'invalid.example', PROD_REMOTE_DIR: '/owned/repository',
        EXPO_PUBLIC_QUEST_WEB_RUNTIME_SSR: 'true', SSR_RELEASE_JS_MAX_MB: '700',
        SSR_TEST_CALLS: calls,
        SSR_TEST_CAPABILITY: '{"schema_version":2,"available":true,"enabled":true,"quest_web":{"schema_version":2,"refresh_max_age_seconds":30,"builder_schema":2}}',
      },
    })
    expect(result.status).toBe(0)
    const commands = fs.readFileSync(calls, 'utf8').trim().split('\n')
    const incoming = '/owned/repository/web-ssr/incoming/'+'b'.repeat(40)
    const store = '/owned/repository/web-ssr/shared/travel-books'
    expect(commands.some(command => command.includes(`mkdir -p '${store}'`) || command.includes('--link-dest') || command.includes(' --dry-run '))).toBe(false)
    const preflight = commands.findIndex(command => command.includes('bash -s -- preflight'))
    expect(commands[preflight]).toContain(`/owned/repository ${candidateKib} 720 1536`)
    const transfers = commands.map((command, index) => ({ command, index })).filter(({ command }) => command.startsWith('rsync '))
    expect(transfers).toHaveLength(1)
    expect(transfers[0].index).toBeGreaterThan(preflight)
    expect(transfers[0].command).toBe(`rsync -azHhe ssh --delete --mkpath --protect-args ${path.join(fixture, 'candidate')}/ test@invalid.example:${incoming}/`)
    const stage = commands.findIndex(command => command.includes('stage --sha '+'b'.repeat(40)+' --overlay-retention-days 14 --overlay-max-mb 256'))
    expect(stage).toBeGreaterThan(transfers[0].index)
    const books = commands.findIndex(command => command.includes(`bash -s -- books /owned/repository/web-ssr/releases/${'b'.repeat(40)}/client ${store}`))
    expect(books).toBeGreaterThan(stage)
    const chunks = commands.findIndex(command => command.includes('bash -s -- chunks '))
    expect(chunks).toBeGreaterThan(books)
    expect(commands[chunks]).toContain(`bash -s -- chunks /owned/repository/web-ssr/releases/${'b'.repeat(40)}/client 4 256 700`)
  })

  // #2980: the disk line of the deploy report lived in the static publisher and
  // was lost with it; the SSR publication prints it after finalize, when the
  // release retention has already freed the previous generation.
  function publication(action: string, extraEnv: Record<string, string> = {}, extraArgs: string[] = []) {
    const calls = path.join(fixture, `calls-${action}.txt`)
    const result = runCli('bash', ['scripts/web-ssr-publication.sh', action, 'c'.repeat(40), ...extraArgs], {
      cwd: process.cwd(), env: {
        ...process.env, PATH: `${fixture}${path.delimiter}${process.env.PATH}`,
        DEPLOY_ENV_FILE: path.join(fixture, 'missing-env'),
        PROD_SSH_USER: 'test', PROD_SSH_HOST: 'invalid.example', PROD_REMOTE_DIR: '/owned/repository',
        SSR_TEST_CALLS: calls, SSR_TEST_CAPABILITY: '{}', ...extraEnv,
      },
    })
    return { result, commands: fs.existsSync(calls) ? fs.readFileSync(calls, 'utf8').trim().split('\n') : [] }
  }

  it('reports the production disk after finalize, sizing the release store', () => {
    const { result, commands } = publication('finalize-code', { DEPLOY_BACKEND_BUILD_MB: '1536' })
    expect(result.status).toBe(0)
    const final = commands.findIndex(command => command.includes('web_ssr_release.py finalize-code'))
    const report = commands.findIndex(command => command.includes('bash -s -- report '))
    expect(final).toBeGreaterThanOrEqual(0)
    expect(report).toBeGreaterThan(final)
    expect(commands[report]).toContain('bash -s -- report /owned/repository /owned/repository/web-ssr/releases 1536')
  })

  it('does not fail a finalized deploy when the disk report cannot be read', () => {
    fs.writeFileSync(path.join(fixture, 'ssh'), '#!/bin/sh\nprintf "%s\\n" "$*" >> "$SSR_TEST_CALLS"\ncase "$*" in *"-- report "*) exit 255;; esac\nprintf "%s\\n" "$SSR_TEST_CAPABILITY"\n', { mode: 0o755 })
    const { result, commands } = publication('finalize-code')
    expect(result.status).toBe(0)
    expect(commands.some(command => command.includes('bash -s -- report '))).toBe(true)
    expect(result.stdout).toContain('⚠️ Отчёт о диске прода не получен')
  })

  it('does not report the disk after the publish or the rollback', () => {
    for (const action of ['publish-code', 'rollback-code']) {
      const { result, commands } = publication(action)
      expect(result.status).toBe(0)
      expect(commands.some(command => command.includes('-- report '))).toBe(false)
    }
  })

  // #3307/#3308: `publish-code --expect-current` is a compare-and-swap on the
  // host. A refusal before any write is told from a failed switch by the
  // helper's stderr line, not by the exit status that came through ssh and
  // `bash -ic`: after it the caller must not run rollback-code, whose receipt is
  // keyed by the sha and may belong to another session's publication.
  describe('publish-code --expect-current (#3307)', () => {
    const target = 'c'.repeat(40)
    const expected = 'd'.repeat(40)
    const other = 'e'.repeat(40)
    const NOISE = 'bash: cannot set terminal process group (-1): Inappropriate ioctl for device\nbash: no job control in this shell'
    const refusalLine = (actual: string, expectedValue = expected) =>
      `web-ssr release refused: current_changed expected=${expectedValue} actual=${actual} mutation=none`

    // The host helper: what it wrote to stderr and the status ssh returned.
    const publish = (stderr: string, status: string, args = ['--expect-current', expected]) => {
      fs.writeFileSync(path.join(fixture, 'ssh'), [
        '#!/bin/sh',
        'printf "%s\\n" "$*" >> "$SSR_TEST_CALLS"',
        'case "$*" in *publish-code*) printf "%s\\n" "$SSR_TEST_STDERR" >&2; exit "$SSR_TEST_EXIT";; esac',
        'printf "%s\\n" "$SSR_TEST_CAPABILITY"',
        '',
      ].join('\n'), { mode: 0o755 })
      return publication('publish-code', { SSR_TEST_STDERR: stderr, SSR_TEST_EXIT: status }, args)
    }

    it('hands the expected current revision to the host helper', () => {
      const { result, commands } = publish(NOISE, '0')

      expect(result.status).toBe(0)
      expect(commands).toHaveLength(1)
      expect(commands[0]).toContain(
        `web_ssr_release.py publish-code --sha ${target} --receipt web-ssr/receipts/${target}.json --expect-current ${expected}`,
      )
    })

    it('keeps the former call when no expectation is given', () => {
      const { result, commands } = publish(NOISE, '0', [])

      expect(result.status).toBe(0)
      expect(commands[0]).toContain(`web_ssr_release.py publish-code --sha ${target} --receipt web-ssr/receipts/${target}.json'`)
      expect(commands[0]).not.toContain('--expect-current')
    })

    it.each(['3', '255', '1'])('reports "overtaken" by the refusal line with both revisions, whatever status came through ssh (%s)', (status) => {
      const { result } = publish(`${NOISE}\n${refusalLine(other)}`, status)

      expect(result.status).toBe(75)
      expect(result.stdout).toBe('')
      expect(result.stderr).toContain(refusalLine(other))
      expect(result.stderr).toContain(`❌ Нас обогнали: прод уже ушёл на ${other.slice(0, 9)}; наш ${target.slice(0, 9)} не опубликован — ничего не возвращалось`)
    })

    // Remote shell output without a trailing newline lands on the helper's line.
    it('finds the refusal line behind output of the remote shell on the same line', () => {
      const { result } = publish(`${NOISE}\nbash: warning: setlocale: LC_ALL: cannot change locale${refusalLine(target)}`, '3')

      expect(result.status).toBe(75)
      expect(result.stderr).toContain(`❌ Ревизия ${target.slice(0, 9)} уже публикуется или опубликована другой сессией`)
    })

    it('tells apart the same revision already switched by another session', () => {
      const { result } = publish(refusalLine(target), '3')

      expect(result.status).toBe(75)
      expect(result.stderr).toContain(`❌ Ревизия ${target.slice(0, 9)} уже публикуется или опубликована другой сессией`)
      expect(result.stderr).not.toContain('Нас обогнали')
    })

    it('accepts a host without a current pair as the actual revision', () => {
      const { result } = publish(refusalLine('none', 'none'), '3', ['--expect-current', 'none'])

      expect(result.status).toBe(75)
    })

    // Fail closed: without the exact line the switch may have written its receipt.
    it.each([
      ['the refusal status without the line', NOISE, '3', 3],
      ['a refusal that answers another expectation', refusalLine(other, other), '3', 3],
      ['a refusal that reports a mutation', `${refusalLine(other)}`.replace('mutation=none', 'mutation=receipt'), '3', 3],
      ['an ordinary refused release', 'web-ssr release refused: ValueError: an unfinished activation receipt already exists', '1', 1],
      ['a foreign failure with the reserved status 75', NOISE, '75', 1],
      ['a foreign failure with the reserved status 78', NOISE, '78', 1],
    ])('does not report "overtaken" for %s', (_name, stderr, status, exit) => {
      const { result } = publish(stderr, status)

      expect(result.status).toBe(exit)
      expect(result.stderr).not.toContain('Нас обогнали')
    })

    it.each([
      ['a helper older than the contract', `usage: web_ssr_release.py [-h] [--sha SHA] action\nweb_ssr_release.py: error: unrecognized arguments: --expect-current ${expected}`],
      ['a value the helper rejected', 'web_ssr_release.py: error: --expect-current must be a full lowercase SHA or none'],
      ['a rejection behind output of the remote shell on the same line', 'bashrc-noise web_ssr_release.py: error: --expect-current must be a full lowercase SHA or none'],
    ])('names %s instead of a failed switch', (_name, stderr) => {
      const { result } = publish(`${NOISE}\n${stderr}`, '2')

      expect(result.status).toBe(78)
      expect(result.stderr).toContain('Помощник публикации на хосте не принял --expect-current')
      expect(result.stderr).toContain('выкатите бэкенд и повторите выкат фронта')
    })

    it.each([
      ['--expect-current', 'ABCDEF'],
      ['--expect-current', 'c'.repeat(39)],
      ['--expect-current', 'C'.repeat(40)],
      ['--expect-current'],
      ['--force', expected],
    ])('refuses a malformed expectation before reaching the host: %s %s', (...args) => {
      const { result, commands } = publish(NOISE, '0', args.filter(Boolean) as string[])

      expect(result.status).toBe(1)
      expect(result.stderr).toContain('Expected: publish-code <sha> [--expect-current <full lowercase sha|none>]')
      expect(commands).toEqual([])
    })
  })

  // #3334 (backend #3310): the receipt is keyed by the sha, so the rollout
  // passes one publication id to the switch, the acceptance and the return. A
  // helper that finds the receipt under another publication refuses without a
  // write: exit 4 and one stderr line. The publisher leaves with its own code
  // 77 for all three actions, recognised by that line as for `current_changed`.
  describe('--publication-id (#3334)', () => {
    const target = 'c'.repeat(40)
    const expected = 'd'.repeat(40)
    const id = '0123456789abcdef0123456789abcdef'
    const receipt = `web-ssr/receipts/${target}.json`
    const NOISE = 'bash: cannot set terminal process group (-1): Inappropriate ioctl for device\nbash: no job control in this shell'
    const mismatch = (state: string, binding: string, sha = target) =>
      `web-ssr release refused: publication_mismatch sha=${sha} state=${state} receipt=${binding} mutation=none`
    const ACTIONS = ['publish-code', 'finalize-code', 'rollback-code']

    // The host helper: what it wrote to stderr and the status ssh returned.
    const act = (action: string, stderr: string, status: string, args = ['--publication-id', id]) => {
      fs.writeFileSync(path.join(fixture, 'ssh'), [
        '#!/bin/sh',
        'printf "%s\\n" "$*" >> "$SSR_TEST_CALLS"',
        'case "$*" in *"-- report "*) exit 0;; esac',
        'printf "%s\\n" "$SSR_TEST_STDERR" >&2',
        'exit "$SSR_TEST_EXIT"',
        '',
      ].join('\n'), { mode: 0o755 })
      return publication(action, { SSR_TEST_STDERR: stderr, SSR_TEST_EXIT: status }, args)
    }

    it('hands one publication id to the switch, the acceptance and the return', () => {
      expect(act('publish-code', NOISE, '0', ['--expect-current', expected, '--publication-id', id]).commands[0]).toContain(
        `web_ssr_release.py publish-code --sha ${target} --receipt ${receipt} --expect-current ${expected} --publication-id ${id}'`,
      )
      expect(act('finalize-code', NOISE, '0').commands[0]).toContain(`web_ssr_release.py finalize-code --receipt ${receipt} --publication-id ${id}'`)
      expect(act('rollback-code', NOISE, '0').commands[0]).toContain(`web_ssr_release.py rollback-code --receipt ${receipt} --publication-id ${id}'`)
    })

    it.each(ACTIONS)('keeps the former %s call when no id is given', (action) => {
      const { result, commands } = act(action, NOISE, '0', [])

      expect(result.status).toBe(0)
      expect(commands[0]).toContain(`--receipt ${receipt}'`)
      expect(commands[0]).not.toContain('--publication-id')
    })

    it.each(ACTIONS.flatMap((action) => ['4', '255', '1'].map((status) => [action, status])))(
      'reports "not our publication" for %s by the refusal line, whatever status came through ssh (%s)', (action, status) => {
        const { result, commands } = act(action, `${NOISE}\nbash: warning: setlocale: LC_ALL${mismatch('active', 'bound')}`, status)

        expect(result.status).toBe(77)
        expect(result.stdout).toBe('')
        expect(result.stderr).toContain(mismatch('active', 'bound'))
        expect(result.stderr).toContain(`❌ ${action} ${target.slice(0, 9)}: это не наша публикация (state=active, receipt=bound) — сервер отказал до записи, прод этим вызовом не менялся`)
        expect(result.stderr).toContain('Receipt ведёт другая сессия выката')
        // A refused acceptance is not a finalized release: no disk report.
        expect(commands).toHaveLength(1)
      },
    )

    it.each([
      ['a receipt this publication never wrote', mismatch('none', 'missing'), ['--publication-id', id], 'Receipt этой публикации на хосте нет'],
      ['a receipt without a revision name', mismatch('none', 'missing', 'none'), ['--publication-id', id], 'Receipt этой публикации на хосте нет'],
      ['an already accepted release', mismatch('finalized', 'bound'), ['--publication-id', id], `Релиз ${target.slice(0, 9)} уже принят`],
      ['a bound receipt returned by hand without the id', mismatch('active', 'bound'), [], 'повторите с --publication-id <id> из лога того выката'],
      ['a receipt written by a rollout that predates the id', mismatch('active', 'unbound'), ['--publication-id', id], 'Receipt записан без идентификатора'],
    ])('explains %s', (_name, stderr, args, hint) => {
      const { result } = act('rollback-code', stderr, '4', args)

      expect(result.status).toBe(77)
      expect(result.stderr).toContain(hint)
    })

    // Fail closed: without the exact line the helper may have written.
    it.each([
      ['the refusal status without the line', NOISE, '4', 4],
      ['a refusal that names another revision', mismatch('active', 'bound', 'e'.repeat(40)), '4', 4],
      ['a refusal that reports a mutation', mismatch('active', 'bound').replace('mutation=none', 'mutation=receipt'), '4', 4],
      ['an ordinary refused return', 'web-ssr release refused: ValueError: stale code receipt cannot replace the active pair', '1', 1],
      ['a foreign failure with the reserved status 77', NOISE, '77', 1],
    ])('does not report "not our publication" for %s', (_name, stderr, status, exit) => {
      for (const action of ['rollback-code', 'finalize-code']) {
        const { result } = act(action, stderr, status)

        expect(result.status).toBe(exit)
        expect(result.stderr).not.toContain('не наша публикация')
      }
    })

    it('names a host helper that predates the argument instead of a failed return', () => {
      const { result } = act('rollback-code',
        `${NOISE}\nusage: web_ssr_release.py [-h] action\nweb_ssr_release.py: error: unrecognized arguments: --publication-id ${id}`, '2')

      expect(result.status).toBe(78)
      expect(result.stderr).toContain(`Помощник публикации на хосте не принял --publication-id ${id}`)
      expect(result.stderr).toContain('старее контракта #3310')
    })

    it.each([
      ['rollback-code', ['--publication-id', 'too-short']],
      ['rollback-code', ['--publication-id', `${id}!`]],
      ['rollback-code', ['--publication-id']],
      ['rollback-code', ['--publication-id', id, '--publication-id', id]],
      ['finalize-code', ['--expect-current', expected]],
      ['finalize-code', [id]],
    ])('refuses malformed options of %s before reaching the host: %j', (action, args) => {
      const { result, commands } = act(action, NOISE, '0', args)

      expect(result.status).toBe(1)
      expect(result.stderr).toContain(`Expected: ${action} <sha> [--publication-id <16-64 of A-Za-z0-9_->]`)
      expect(commands).toEqual([])
    })
  })

  it('real final client packaging preserves linked publication inodes in a separate fresh candidate', () => {
    const source = fs.readFileSync(path.resolve('build-prod.sh'), 'utf8')
    const start = source.indexOf('if [[ "$SSR_CODE_RELEASE" == "1" ]]; then\n  # Publish the finished shell metadata')
    const end = source.indexOf('\nfi', start)
    if(start < 0 || end < 0)throw new Error('Final SSR client packaging block missing')
    const original = path.join(fixture, 'dist/prod/travel-books')
    const first = path.join(original, 'book/r1/read.pdf')
    const duplicate = path.join(original, 'book/r2/read.pdf')
    const distinct = path.join(original, 'book/r2/other.pdf')
    const bytes = Buffer.from('%PDF-'+'body'.repeat(65536))
    fs.mkdirSync(path.dirname(first), {recursive:true})
    fs.mkdirSync(path.dirname(duplicate), {recursive:true})
    fs.writeFileSync(first, bytes)
    fs.linkSync(first, duplicate)
    fs.writeFileSync(distinct, 'other bytes')
    const target = path.join(fixture, 'candidate/client')
    fs.mkdirSync(target)
    fs.writeFileSync(path.join(target, 'stale.html'), 'old candidate')
    const result = runCli('/bin/bash', ['-c', 'set -euo pipefail\n'+source.slice(start,end+3)], {
      cwd: fixture, env: {ENV:'prod',SSR_CODE_RELEASE:'1',SSR_RELEASE_DIR:path.join(fixture,'candidate')},
    })
    expect(result.status).toBe(0)
    expect(fs.existsSync(path.join(target,'stale.html'))).toBe(false)
    const copiedFirst = path.join(target,'travel-books/book/r1/read.pdf')
    const copiedDuplicate = path.join(target,'travel-books/book/r2/read.pdf')
    const a = fs.statSync(copiedFirst), b = fs.statSync(copiedDuplicate)
    expect([a.dev,a.ino]).toEqual([b.dev,b.ino])
    expect(a.nlink).toBe(2)
    expect(a.ino).not.toBe(fs.statSync(first).ino)
    expect(fs.statSync(path.join(target,'travel-books/book/r2/other.pdf')).ino).not.toBe(a.ino)
    expect(fs.readFileSync(copiedFirst)).toEqual(bytes)
    expect(fs.readFileSync(copiedDuplicate)).toEqual(bytes)
    expect(a.blocks).toBeGreaterThan(0)
  })
})
