/**
 * Regression tests for the build-prod.sh remote transport (board #1401).
 *
 * The remote program travels over `ssh ... bash -s` stdin, so bash reads it
 * lazily while executing. On 2026-08-11 `docker compose exec -T` inherited
 * that stdin (-T only disables the TTY) and swallowed the unread remainder
 * of the program: bash hit EOF, returned 0, and the deploy skipped public
 * readiness, rollback handling and staging cleanup while looking green.
 *
 * Two contracts prevent a relapse:
 *   1. every docker invocation inside the payload isolates stdin with
 *      </dev/null;
 *   2. the caller refuses success unless the payload echoes back a per-run
 *      nonce marker from its final line, so any truncated remote tail fails
 *      closed even if a future command starts reading stdin again.
 */

import fs from 'fs'
import path from 'path'

import { makeTempDir, removeDir, runCli } from './cli-test-utils'
import {
  extractRemoteDeploy,
  readCanonicalDeploy,
  stagingCleanupFailureContract,
} from './remote-deploy-test-utils'

const MARKER = 'MT_TEST_DEPLOY_MARKER:1401'
// printf with a leading newline: the marker must sit on its own line for the
// caller's whole-line grep even if earlier output lacked a trailing newline.
const MARKER_ECHO = `printf '\\n%s\\n' "$DEPLOY_SUCCESS_MARKER"`

const helperB64 = fs
  .readFileSync(path.resolve(process.cwd(), 'scripts/deploy-expo-overlay.sh'))
  .toString('base64')

// Резолв имени контейнера переехал из тела payload в общий дом
// (scripts/deploy-target.sh, #1636) и приезжает на прод base64-аргументом.
// Защита stdin обязана видеть его там, где код теперь живёт: иначе снятый в
// снипете `</dev/null` перестал бы замечаться этим тестом.
const containerSnippetResult = runCli(
  'bash',
  ['-c', 'source scripts/deploy-target.sh; metravel_container_remote_snippet'],
  { cwd: process.cwd() },
)
if (containerSnippetResult.status !== 0) {
  throw new Error(
    `failed to resolve container snippet: ${containerSnippetResult.stderr}`,
  )
}
const containerSnippet = containerSnippetResult.stdout

// Known stdin readers: docker keeps exec stdin open, the rest consume stdin
// outright. Any payload line running one of them without </dev/null could
// swallow the unread remainder of the program.
const stdinConsumerCommand =
  /(?:^|[^\w./-])(?:docker-compose|docker|cat|read|ssh|xargs|mysql|psql)(?:$|[^\w-])/

function stdinConsumerLines(remoteDeploy: string): string[] {
  return remoteDeploy
    .split('\n')
    .filter((line) => !/^\s*#/.test(line))
    .filter((line) => stdinConsumerCommand.test(line))
}

function writeExecutable(filePath: string, lines: string[]): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, `${lines.join('\n')}\n`)
  fs.chmodSync(filePath, 0o755)
}

// Recreates the server checkout right after rsync (upload staging in dist/,
// previous release live in static/dist) plus PATH stubs for every binary the
// payload touches. The docker stub is faithful to the incident: "compose
// exec" drains any stdin it is handed before exiting 0.
function makeRemoteSandbox(root: string): { sandbox: string; stubBin: string } {
  const sandbox = path.join(root, 'remote')
  const stubBin = path.join(root, 'stub-bin')

  fs.mkdirSync(path.join(sandbox, 'dist/prod/static/quests'), {
    recursive: true,
  })
  fs.writeFileSync(path.join(sandbox, 'dist/prod/index.html'), 'next release')
  fs.writeFileSync(
    path.join(sandbox, 'dist/prod/static/quests/quest-default-cover.svg'),
    '<svg xmlns="http://www.w3.org/2000/svg"/>',
  )
  fs.mkdirSync(path.join(sandbox, 'static/dist/_expo/static/js'), {
    recursive: true,
  })
  fs.writeFileSync(
    path.join(sandbox, 'static/dist/index.html'),
    'previous release',
  )
  fs.writeFileSync(
    path.join(sandbox, 'static/dist/_expo/static/js/previous-chunk.js'),
    'previous chunk',
  )

  writeExecutable(path.join(stubBin, 'docker'), [
    '#!/bin/bash',
    '# "compose exec" drains attached stdin exactly like docker compose',
    '# exec -T does; "exec -u 0 ... sh -c" maps /app onto the sandbox.',
    'case "$1" in',
    '  ps)',
    '    echo "metravel-app-1"',
    '    ;;',
    '  exec)',
    '    shift 4',
    '    cmd="$3"',
    '    sh -c "${cmd//\\/app/$SANDBOX_ROOT}"',
    '    ;;',
    '  compose)',
    '    for arg in "$@"; do',
    '      if [ "$arg" = version ]; then exit 0; fi',
    '    done',
    '    cat >/dev/null',
    '    exit 0',
    '    ;;',
    '  *)',
    '    exit 0',
    '    ;;',
    'esac',
  ])
  writeExecutable(path.join(stubBin, 'docker-compose'), [
    '#!/bin/bash',
    'for arg in "$@"; do',
    '  if [ "$arg" = version ]; then exit 0; fi',
    'done',
    'cat >/dev/null',
    'exit 0',
  ])
  writeExecutable(path.join(stubBin, 'curl'), [
    '#!/bin/bash',
    '# The payload only reads the http_code write-out.',
    "printf '200'",
  ])
  writeExecutable(path.join(stubBin, 'git'), [
    '#!/bin/bash',
    '# Not a git checkout: the quest fallback path is untracked.',
    'exit 1',
  ])

  return { sandbox, stubBin }
}

// Runs a payload over the production transport shape: the program arrives on
// bash stdin, positional args follow `bash -s --`.
function runPayload(
  root: string,
  payload: string,
): { status: number; stdout: string; stderr: string } {
  const { sandbox, stubBin } = makeRemoteSandbox(root)
  const payloadPath = path.join(root, 'payload.sh')
  fs.writeFileSync(payloadPath, payload)
  const harnessPath = path.join(root, 'harness.sh')
  writeExecutable(harnessPath, [
    '#!/bin/bash',
    'exec bash -s -- prod 14 "$HELPER_B64" "$SANDBOX_ROOT" "$MARKER" "$CONTAINER_B64" < "$PAYLOAD"',
  ])

  return runCli('bash', [harnessPath], {
    env: {
      PATH: `${stubBin}:${process.env.PATH ?? ''}`,
      SANDBOX_ROOT: sandbox,
      HELPER_B64: helperB64,
      CONTAINER_B64: Buffer.from(containerSnippet, 'utf8').toString('base64'),
      MARKER,
      PAYLOAD: payloadPath,
    },
  })
}

function extractDeployProdFunction(source: string): string {
  const start = source.indexOf('deploy_prod() {')
  const terminator = source.indexOf('\nREMOTE_DEPLOY_SCRIPT\n', start)
  const end = source.indexOf('\n}\n', terminator)

  if (start === -1 || terminator === -1 || end === -1) {
    throw new Error('deploy_prod function was not found in build-prod.sh')
  }

  return source.slice(start, end + 2)
}

// Exercises the local deploy_prod wrapper with rsync/ssh stubbed out. The ssh
// stub consumes the heredoc like a remote shell would and answers exit 0, so
// only the marker contract separates success from a swallowed tail.
function runDeployProdHarness(
  root: string,
  sshStubLines: string[],
): { cwd: string; status: number; stdout: string; stderr: string } {
  const cwd = path.join(root, 'caller')
  fs.mkdirSync(path.join(cwd, 'dist/prod'), { recursive: true })
  fs.writeFileSync(path.join(cwd, 'dist/prod/index.html'), 'payload')
  fs.mkdirSync(path.join(cwd, 'scripts'), { recursive: true })
  fs.copyFileSync(
    path.resolve(process.cwd(), 'scripts/deploy-expo-overlay.sh'),
    path.join(cwd, 'scripts/deploy-expo-overlay.sh'),
  )

  const harnessPath = path.join(cwd, 'harness.sh')
  writeExecutable(harnessPath, [
    '#!/bin/bash',
    'set -Eeuo pipefail',
    "IFS=$'\\n\\t'",
    'PROD_SSH_TARGET="stub@host"',
    'PROD_REMOTE_DIR="/srv/metravel"',
    'require_deploy_target() { return 0; }',
    'rsync() { return 0; }',
    // deploy_prod резолвит снипет через общий scripts/deploy-target.sh —
    // подкладываем настоящий, а не заглушку, чтобы транспорт проверялся на том
    // же теле, которое уезжает на прод.
    `metravel_container_remote_snippet() { cat <<'MT_TEST_SNIPPET'\n${containerSnippet.trimEnd()}\nMT_TEST_SNIPPET\n}`,
    ...sshStubLines,
    extractDeployProdFunction(readCanonicalDeploy()),
    'if deploy_prod prod; then',
    '  echo "HARNESS:SUCCESS"',
    'else',
    '  echo "HARNESS:FAILURE"',
    'fi',
  ])

  const result = runCli('bash', [harnessPath], { cwd })
  return { cwd, ...result }
}

describe('build-prod.sh remote stdin transport', () => {
  it('isolates stdin on every stdin-consuming command in the remote payload', () => {
    // Payload плюс инжектируемый снипет резолва: вместе это ровно та
    // программа, которая исполняется на проде по stdin.
    const payloadLines = stdinConsumerLines(extractRemoteDeploy())
    const snippetLines = stdinConsumerLines(containerSnippet)
    const lines = [...payloadLines, ...snippetLines]

    // Пороги разведены по источникам: общий счёт скрыл бы пропажу строк в
    // payload за счётом снипета и наоборот. rroot exec, compose detection и оба
    // compose_nginx варианта — в payload; четыре docker ps резолва — в снипете.
    expect(payloadLines.length).toBeGreaterThanOrEqual(4)
    expect(snippetLines.length).toBeGreaterThanOrEqual(4)
    expect(lines.filter((line) => !line.includes('</dev/null'))).toEqual([])
  })

  it('feeds the success marker as an argument and requires it for local success', () => {
    const source = readCanonicalDeploy()
    const remoteDeploy = extractRemoteDeploy(source)

    // The nonce is generated per run and travels as an ssh argument; the
    // quoted heredoc must never contain the literal, otherwise a command
    // that echoes the swallowed tail could fake success.
    expect(source).toContain('REMOTE_DONE_MARKER="MT_REMOTE_DEPLOY_OK:')
    expect(remoteDeploy).not.toContain('MT_REMOTE_DEPLOY_OK')
    expect(remoteDeploy).toContain('DEPLOY_SUCCESS_MARKER="$5"')

    const sshCall = source.slice(
      source.indexOf('ssh "$PROD_SSH_TARGET" bash -s --'),
      source.indexOf("<<'REMOTE_DEPLOY_SCRIPT'"),
    )
    expect(sshCall).toContain('"$REMOTE_DONE_MARKER"')

    expect(source).toContain('<<\'REMOTE_DEPLOY_SCRIPT\' | tee "$REMOTE_LOG"')
    expect(source).toContain('grep -qxF -- "$REMOTE_DONE_MARKER" "$REMOTE_LOG"')

    // The marker echo is the payload's final command, after the verified
    // staging-cleanup postcondition — nothing may run behind its back.
    const markerIndex = remoteDeploy.lastIndexOf(MARKER_ECHO)
    expect(markerIndex).toBeGreaterThan(
      remoteDeploy.indexOf(stagingCleanupFailureContract),
    )
    const tail = remoteDeploy
      .slice(markerIndex + MARKER_ECHO.length)
      .split('\n')
      .filter((line) => line.trim() !== '' && !line.trim().startsWith('#'))
    expect(tail).toEqual([])
  })

  it('executes readiness and cleanup even when a command drains stdin', () => {
    const root = makeTempDir('metravel-remote-stdin-')

    try {
      const result = runPayload(root, extractRemoteDeploy())
      const sandbox = path.join(root, 'remote')

      expect(result.status).toBe(0)
      expect(result.stdout).toContain('Public readiness confirmed')
      expect(result.stdout).toContain(MARKER)
      expect(fs.existsSync(path.join(sandbox, 'dist'))).toBe(false)
      expect(fs.existsSync(path.join(sandbox, 'static/dist.old'))).toBe(false)
      expect(
        fs.readFileSync(path.join(sandbox, 'static/dist/index.html'), 'utf8'),
      ).toBe('next release')
      expect(
        fs.existsSync(
          path.join(sandbox, 'static/dist/_expo/static/js/previous-chunk.js'),
        ),
      ).toBe(true)
    } finally {
      removeDir(root)
    }
  })

  it('reproduces the truncated tail once stdin isolation is stripped', () => {
    const root = makeTempDir('metravel-remote-stdin-unsafe-')

    try {
      const remoteDeploy = extractRemoteDeploy()
      const unsafeDeploy = remoteDeploy.replace(/ <\/dev\/null/g, '')
      expect(unsafeDeploy).not.toBe(remoteDeploy)

      const result = runPayload(root, unsafeDeploy)
      const sandbox = path.join(root, 'remote')

      // The incident shape: bash exits 0 at EOF while readiness, the marker
      // and both cleanups never ran. This is what the marker contract and
      // the isolation guard above must keep impossible on the real script.
      expect(result.status).toBe(0)
      expect(result.stdout).not.toContain('Public readiness confirmed')
      expect(result.stdout).not.toContain(MARKER)
      expect(fs.existsSync(path.join(sandbox, 'dist'))).toBe(true)
      expect(fs.existsSync(path.join(sandbox, 'static/dist.old'))).toBe(true)
    } finally {
      removeDir(root)
    }
  })

  it('fails the local deploy when the remote output lacks the marker', () => {
    const root = makeTempDir('metravel-deploy-marker-missing-')

    try {
      const harness = runDeployProdHarness(root, [
        'ssh() {',
        '  cat >/dev/null',
        '  echo "remote output without the marker"',
        '}',
      ])

      expect(harness.status).toBe(0)
      expect(harness.stdout).toContain('HARNESS:FAILURE')
      expect(harness.stdout).toContain('missing the success marker')
      // Local staging is kept when the deploy is not accepted.
      expect(fs.existsSync(path.join(harness.cwd, 'dist'))).toBe(true)
    } finally {
      removeDir(root)
    }
  })

  it('accepts the deploy when the remote program echoes the marker back', () => {
    const root = makeTempDir('metravel-deploy-marker-present-')

    try {
      const harness = runDeployProdHarness(root, [
        'ssh() {',
        '  cat >/dev/null',
        '  # Маркер — пятый аргумент ПРОГРАММЫ (DEPLOY_SUCCESS_MARKER="$5"), а',
        '  # внутри ssh() ему предшествуют "<target> bash -s --", то есть это $9.',
        '  # Шестым за маркером едет base64 общего резолва имени контейнера',
        '  # (#1636), поэтому «последний аргумент» здесь брать уже нельзя.',
        '  printf \'%s\\n\' "${9}"',
        '}',
      ])

      expect(harness.status).toBe(0)
      expect(harness.stdout).toContain('HARNESS:SUCCESS')
      expect(fs.existsSync(path.join(harness.cwd, 'dist'))).toBe(false)
    } finally {
      removeDir(root)
    }
  })
})
