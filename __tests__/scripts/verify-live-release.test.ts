/**
 * #2448: the final production check after a deploy retries a bounded number of
 * times and tells "the release is not published" (prod answers another sha)
 * apart from "the host did not answer" (no sha at all). The real script runs
 * against a curl stub on PATH; only the network is faked.
 */
import fs from 'fs'
import path from 'path'

import { makeTempDir, removeDir, runCli } from './cli-test-utils'

const SCRIPT = path.resolve(process.cwd(), 'scripts/verify-live-release.sh')
const SHA = 'a'.repeat(40)

// Attempts are counted by /.build-source.json requests. The first
// STUB_DOWN_ATTEMPTS attempts time out on every URL, like the ~25 s window
// right after a publication on the single-CPU host.
const CURL_STUB = [
  '#!/bin/bash',
  'url="${@: -1}"',
  'count_file="$STUB_DIR/attempts"',
  'if [[ "$url" == */.build-source.json ]]; then echo x >> "$count_file"; fi',
  'attempt=$(wc -l < "$count_file" 2>/dev/null || echo 0)',
  'if (( attempt <= ${STUB_DOWN_ATTEMPTS:-0} )); then',
  '  [[ "$*" == *http_code* ]] && printf 000',
  '  exit 28',
  'fi',
  // STUB_SCRIPT (#3314): ответ маркера по попыткам — `down`, `nosha` или `sha`, через запятую;
  // после списка действует обычное поведение заглушки.
  'IFS=, read -r -a script <<< "${STUB_SCRIPT:-}"',
  'step="${script[$((attempt - 1))]:-}"',
  'if [[ "$step" == down ]]; then [[ "$*" == *http_code* ]] && printf 000; exit 28; fi',
  'if [[ "$step" == nosha && "$url" == */.build-source.json ]]; then printf "{}"; exit 0; fi',
  // STUB_MARKER_BODY: хост отвечает на маркер 200, но телом без полного sha (#3305).
  'if [[ "$url" == */.build-source.json && -n "${STUB_MARKER_BODY:-}" ]]; then printf "%s" "$STUB_MARKER_BODY"; exit 0; fi',
  'if [[ "$url" == */.build-source.json ]]; then printf \'{"sha":"%s"}\' "$STUB_SHA"; exit 0; fi',
  'if [[ "$url" == */health ]]; then printf "%s" "${STUB_HEALTH:-200}"; exit 0; fi',
  'printf 200',
].join('\n')

function verify(env: Record<string, string>) {
  const root = makeTempDir('verify-live-release-')
  try {
    const bin = path.join(root, 'bin')
    fs.mkdirSync(bin)
    fs.writeFileSync(path.join(bin, 'curl'), CURL_STUB, { mode: 0o755 })
    const result = runCli('bash', [SCRIPT, SHA], {
      env: {
        PATH: `${bin}:${process.env.PATH}`,
        STUB_DIR: root,
        STUB_SHA: SHA,
        VERIFY_LIVE_ORIGIN: 'https://prod.test',
        VERIFY_LIVE_RETRY_DELAY: '0',
        ...env,
      },
    })
    const attempts = fs.existsSync(path.join(root, 'attempts'))
      ? fs.readFileSync(path.join(root, 'attempts'), 'utf8').trim().split('\n').length
      : 0
    return { ...result, attempts }
  } finally {
    removeDir(root)
  }
}

describe('verify-live-release.sh', () => {
  it('passes on the first attempt when prod serves the sha and the smoke URLs answer 200', () => {
    const result = verify({})
    expect(result.status).toBe(0)
    expect(result.attempts).toBe(1)
    expect(result.stdout).toContain(`✅ Прод отдаёт /.build-source.json с sha ${SHA.slice(0, 9)}`)
    expect(result.stdout).toContain('✅ Смоук прода: /health, /, /api/travels/ — 200')
    expect(result.stdout).not.toContain('⚠️')
  })

  it('retries a host that is briefly silent right after the publication and reports the late answer', () => {
    const result = verify({ STUB_DOWN_ATTEMPTS: '1' })
    expect(result.status).toBe(0)
    expect(result.attempts).toBe(2)
    expect(result.stdout).toContain('⚠️ Попытка 1 из 3: sha не получен')
    expect(result.stdout).toContain('⚠️ Прод ответил только с попытки 2 из 3')
  })

  it('calls an unreachable host unavailable, not unpublished, after the bounded attempts', () => {
    const result = verify({ STUB_DOWN_ATTEMPTS: '9' })
    expect(result.status).toBe(1)
    expect(result.attempts).toBe(3)
    expect(result.stdout).toContain('❌ Хост не ответил на /.build-source.json за 3 попыток')
    expect(result.stdout).not.toContain('Релиз не опубликован')
  })

  it('fails at once without retrying when prod serves another sha', () => {
    const result = verify({ STUB_SHA: 'b'.repeat(40) })
    expect(result.status).toBe(1)
    expect(result.attempts).toBe(1)
    expect(result.stdout).toContain(`❌ Релиз не опубликован: прод отдаёт sha ${'b'.repeat(40)}, ожидался ${SHA}`)
  })

  // #3305: маркер без полного sha раньше попадал в «хост не ответил», хотя хост
  // ответил — и ответил не тем релизом. Повторы сохраняются: сразу после
  // публикации маркер может ещё не быть на месте.
  it.each([
    ['a short sha', `{"sha":"${SHA.slice(0, 9)}"}`],
    ['no sha field', '{"builtAt":"2026-11-11T12:00:00Z"}'],
    ['an HTML shell instead of the marker', '<!doctype html><html><body>MeTravel</body></html>'],
  ])('calls a marker with %s unpublished, not an unreachable host', (_label, body) => {
    const result = verify({ STUB_MARKER_BODY: body })
    expect(result.status).toBe(1)
    expect(result.attempts).toBe(3)
    expect(result.stdout).toContain('⚠️ Попытка 1 из 3: sha в маркере нет')
    expect(result.stdout).toContain(`❌ Релиз не опубликован: /.build-source.json прода отвечает без полного sha за 3 попыток, ожидался ${SHA}`)
    expect(result.stdout).not.toContain('Хост не ответил')
  })

  // #3314: итог считается по всем попыткам, а не по последней.
  describe('a verdict over every attempt', () => {
    it('keeps a sha read once as proof of the publication when the host goes silent afterwards', () => {
      const result = verify({ STUB_SCRIPT: 'sha,down,down', STUB_HEALTH: '502' })
      expect(result.status).toBe(1)
      expect(result.attempts).toBe(3)
      expect(result.stdout).toContain(`❌ Релиз ${SHA.slice(0, 9)} опубликован (sha прочитан в 1 из 3 попыток), но ни одна попытка не дала sha и смоук 200 вместе`)
      expect(result.stdout).not.toContain('Хост не ответил')
    })

    it.each([
      ['a silent last attempt', 'nosha,nosha,down', 2, 1],
      ['a marker without sha only on the last attempt', 'down,down,nosha', 1, 2],
    ])('does not claim «all attempts» for %s', (_label, script, noSha, silent) => {
      const result = verify({ STUB_SCRIPT: script })
      expect(result.status).toBe(1)
      expect(result.attempts).toBe(3)
      expect(result.stdout).toContain(`❌ Релиз ${SHA.slice(0, 9)} не подтверждён: /.build-source.json прода ответил без полного sha в ${noSha} из 3 попыток и не ответил в ${silent}, ожидался ${SHA}`)
      expect(result.stdout).not.toContain('за 3 попыток')
    })
  })

  it('reports a published release whose smoke keeps failing', () => {
    const result = verify({ STUB_HEALTH: '502' })
    expect(result.status).toBe(1)
    expect(result.attempts).toBe(3)
    expect(result.stdout).toContain('   502  https://prod.test/health')
    expect(result.stdout).toContain(`❌ Релиз ${SHA.slice(0, 9)} опубликован, но смоук прода не прошёл за 3 попыток`)
  })
})
