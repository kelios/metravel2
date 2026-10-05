/**
 * Disk gate of the frontend deploy (board #2186).
 *
 * The prod disk is 15 GB and every class on it is bounded on its own, but
 * nobody owned the total: on 2026-10-04 it stood at 89 % with 1.7 GB free,
 * while one frontend upload takes ~400 MB of staging and a backend image
 * build refuses below 1536 MiB. The deploy never looked at free space, so the
 * upload itself could be what fills the disk.
 *
 * Two contracts:
 *   1. `preflight` refuses before the first byte is sent when the release
 *      plus a reserve does not fit — and counts the backend image build in
 *      while that build is running;
 *   2. `report` puts the disk line into the report of every deploy and warns
 *      once the backend can no longer build its image, without ever failing
 *      a published deploy.
 */

import fs from 'fs'
import path from 'path'

import { makeTempDir, removeDir, runCli } from './cli-test-utils'
import {
  extractRemoteDeploy,
  readCanonicalDeploy,
  stagingCleanupFailureContract,
} from './remote-deploy-test-utils'

const guardPath = path.resolve(process.cwd(), 'scripts/deploy-disk-guard.sh')

const MB = 1024
const RELEASE_KIB = 399 * MB
// The defaults of build-prod.sh: 5 % of the disk and the backend build floor.
const RESERVE_MB = 720
const BACKEND_BUILD_MB = 1536

type Sandbox = {
  root: string
  stubBin: string
  env: Record<string, string>
}

function writeExecutable(filePath: string, lines: string[]): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, `${lines.join('\n')}\n`)
  fs.chmodSync(filePath, 0o755)
}

// `df`, `du` and `pgrep` are answered from the environment: the guard is about
// the arithmetic and the wording, not about the machine running jest.
function makeSandbox(disk: {
  freeMb: number
  usedPercent?: number
  distMb?: number
  backendBuild?: boolean
}): Sandbox {
  const root = makeTempDir('metravel-disk-guard-')
  const stubBin = path.join(root, 'stub-bin')

  writeExecutable(path.join(stubBin, 'df'), [
    '#!/bin/bash',
    'echo "Filesystem 1024-blocks Used Available Capacity Mounted on"',
    'echo "/dev/sda1 15399940 $STUB_USED_KIB $STUB_FREE_KIB $STUB_USED_PCT% /"',
  ])
  writeExecutable(path.join(stubBin, 'du'), [
    '#!/bin/bash',
    'printf "%s\\t%s\\n" "$STUB_DIST_KIB" "${@: -1}"',
  ])
  writeExecutable(path.join(stubBin, 'pgrep'), [
    '#!/bin/bash',
    '[ "$STUB_BACKEND_BUILD" = 1 ]',
  ])
  fs.mkdirSync(path.join(root, 'static/dist'), { recursive: true })

  return {
    root,
    stubBin,
    env: {
      PATH: `${stubBin}:${process.env.PATH ?? ''}`,
      STUB_FREE_KIB: String(disk.freeMb * MB),
      STUB_USED_KIB: String(12_700 * MB),
      STUB_USED_PCT: String(disk.usedPercent ?? 89),
      STUB_DIST_KIB: String((disk.distMb ?? 656) * MB),
      STUB_BACKEND_BUILD: disk.backendBuild ? '1' : '0',
    },
  }
}

function preflight(sandbox: Sandbox, env = sandbox.env) {
  return runCli(
    'bash',
    [
      guardPath,
      'preflight',
      sandbox.root,
      String(RELEASE_KIB),
      String(RESERVE_MB),
      String(BACKEND_BUILD_MB),
    ],
    { env },
  )
}

function report(sandbox: Sandbox) {
  return runCli(
    'bash',
    [guardPath, 'report', sandbox.root, 'static/dist', String(BACKEND_BUILD_MB)],
    { env: sandbox.env, cwd: sandbox.root },
  )
}

describe('frontend deploy disk guard: preflight before the upload', () => {
  it('lets the upload start when the release and the reserve fit', () => {
    const sandbox = makeSandbox({ freeMb: 1677 })

    try {
      const result = preflight(sandbox)

      expect(result.status).toBe(0)
      expect(result.stdout).toContain(
        '📊 Диск прода перед заливкой: занято 89 %, свободно 1677 МБ; релиз 399 МБ, резерв 720 МБ',
      )
      // The state of 2026-10-04: the upload fits, a backend build next to it
      // does not — the report has to say so before the upload starts.
      expect(result.stdout).toContain(
        '⚠️ На время заливки останется 1278 МБ — меньше 1536 МБ',
      )
    } finally {
      removeDir(sandbox.root)
    }
  })

  it('stays silent about the backend build when the upload leaves room for it', () => {
    const sandbox = makeSandbox({ freeMb: 4096, usedPercent: 71 })

    try {
      const result = preflight(sandbox)

      expect(result.status).toBe(0)
      expect(result.stdout).toContain('свободно 4096 МБ')
      expect(result.stdout).not.toContain('⚠️')
    } finally {
      removeDir(sandbox.root)
    }
  })

  it('refuses before the upload when the release does not fit with the reserve', () => {
    const sandbox = makeSandbox({ freeMb: 1118 })

    try {
      const result = preflight(sandbox)

      expect(result.status).toBe(1)
      expect(result.stdout).toContain(
        '❌ На диске прода свободно 1118 МБ, а заливке релиза нужно 399 МБ и 720 МБ резерва',
      )
      expect(result.stdout).toContain('❌ Заливка не начата')
      expect(result.stdout).toContain('docs/ops/prod-disk-growth.md')
      expect(result.stdout).not.toContain('📊')
      // No interrupted deploy left anything behind: nothing to blame on it.
      expect(result.stdout).not.toContain('прерванного выката')
    } finally {
      removeDir(sandbox.root)
    }
  })

  it('accepts the exact fit of release plus reserve', () => {
    const sandbox = makeSandbox({ freeMb: 1119 })

    try {
      expect(preflight(sandbox).status).toBe(0)
    } finally {
      removeDir(sandbox.root)
    }
  })

  // The deploy removes its own leftovers only after the upload, so a refusal
  // caused by them must name them: otherwise the operator looks for space in
  // the wrong place while the deploy keeps refusing itself.
  it('names the trees of an interrupted deploy when it refuses', () => {
    const sandbox = makeSandbox({ freeMb: 1118, distMb: 400 })

    try {
      fs.mkdirSync(path.join(sandbox.root, 'dist/prod'), { recursive: true })
      fs.mkdirSync(path.join(sandbox.root, 'static/dist.failed.4242'))

      const result = preflight(sandbox)

      expect(result.status).toBe(1)
      expect(result.stdout).toContain(
        '❌ 800 МБ на диске занимают каталоги прерванного выката',
      )
    } finally {
      removeDir(sandbox.root)
    }
  })

  // The state the upload must not walk into: the backend passed its own
  // preflight with 1.7 GB free and is building, and the frontend takes 400 MB
  // out from under the build.
  it('counts the backend image build in while that build is running', () => {
    const sandbox = makeSandbox({ freeMb: 1677, backendBuild: true })

    try {
      const result = preflight(sandbox)

      expect(result.status).toBe(1)
      expect(result.stdout).toContain(
        '❌ Идёт сборка образа бэкенда: ей нужно до 1536 МБ, заливке релиза — 399 МБ и 720 МБ резерва, а свободно 1677 МБ',
      )
      expect(result.stdout).toContain('❌ Заливка не начата')
      expect(result.stdout).not.toContain('📊')
    } finally {
      removeDir(sandbox.root)
    }
  })

  it('uploads during a backend image build when both fit', () => {
    const sandbox = makeSandbox({
      freeMb: 2655,
      usedPercent: 82,
      backendBuild: true,
    })

    try {
      expect(preflight(sandbox).status).toBe(0)
    } finally {
      removeDir(sandbox.root)
    }
  })

  // The backend builds outside any lock, so the build is recognised by its
  // client process; the pattern is the whole detector and is pinned here.
  it('recognises an image build by its command line and nothing else', () => {
    const pattern = fs
      .readFileSync(guardPath, 'utf8')
      .match(/pgrep -f '([^']+)'/)?.[1]
    expect(pattern).toBeDefined()
    const build = new RegExp(pattern as string)

    expect(
      [
        'docker compose -f docker-compose-prod.app.yaml build app',
        '/usr/libexec/docker/cli-plugins/docker-compose compose -f docker-compose-prod.app.yaml build app',
        'docker-compose -f docker-compose-prod.app.yaml build app',
        'docker build -t metravel_app .',
        'docker buildx build .',
        'docker compose -f docker-compose-prod.app.yaml up -d --build',
      ].filter((commandLine) => !build.test(commandLine)),
    ).toEqual([])
    expect(
      [
        'docker compose -f docker-compose-prod.app.yaml exec -T app python manage.py send_moderation_reminders',
        'docker compose -f docker-compose-prod.app.yaml run --rm --no-deps app collect-static',
        'docker compose -f docker-compose-prod.app.yaml up -d --no-deps --no-build nginx',
        'docker logs metravel-nginx-1',
        '/usr/bin/dockerd -H fd:// --containerd=/run/containerd/containerd.sock',
        'bash -s -- preflight /home/sx3/metravel 408576 720 1536',
      ].filter((commandLine) => build.test(commandLine)),
    ).toEqual([])
  })

  // The overlay step selects with perl and links with cpio — after the upload
  // and the staging move. A host without them is refused while it is still
  // untouched.
  it('refuses when the host lacks a tool the overlay step needs', () => {
    const sandbox = makeSandbox({ freeMb: 4096 })
    const toolBin = path.join(sandbox.root, 'tool-bin')

    try {
      fs.mkdirSync(toolBin)
      for (const tool of ['bash', 'awk', 'cpio']) {
        const resolved = runCli('bash', ['-c', `command -v ${tool}`]).stdout.trim()
        fs.symlinkSync(resolved, path.join(toolBin, tool))
      }

      const result = preflight(sandbox, {
        ...sandbox.env,
        PATH: `${sandbox.stubBin}:${toolBin}`,
      })

      expect(result.status).toBe(1)
      expect(result.stdout).toContain('❌ На проде нет `perl`')
      expect(result.stdout).toContain('Заливка не начата')
    } finally {
      removeDir(sandbox.root)
    }
  })

  it('rejects arguments that are not whole numbers', () => {
    const sandbox = makeSandbox({ freeMb: 1677 })

    try {
      const result = runCli(
        'bash',
        [guardPath, 'preflight', sandbox.root, '399M', '720', '1536'],
        { env: sandbox.env },
      )

      expect(result.status).toBe(2)
      expect(result.stderr).toContain('payload-kib must be a non-negative integer')
      expect(runCli('bash', [guardPath, 'cleanup'], { env: sandbox.env }).status).toBe(2)
    } finally {
      removeDir(sandbox.root)
    }
  })

  // Production shape: `ssh … bash -s -- preflight … < helper`. A stdin reader
  // inside the helper would swallow the rest of it and exit 0 without a verdict.
  it('gives the same verdict when the helper itself arrives on stdin', () => {
    const sandbox = makeSandbox({ freeMb: 1118 })

    try {
      const result = runCli(
        'bash',
        ['-s', '--', 'preflight', sandbox.root, String(RELEASE_KIB), '720', '1536'],
        { env: sandbox.env, input: fs.readFileSync(guardPath, 'utf8') },
      )

      expect(result.status).toBe(1)
      expect(result.stdout).toContain('❌ Заливка не начата')
    } finally {
      removeDir(sandbox.root)
    }
  })
})

describe('frontend deploy disk guard: report after the deploy', () => {
  it('reports disk usage and the size of the published tree', () => {
    const sandbox = makeSandbox({ freeMb: 2340, usedPercent: 84, distMb: 656 })

    try {
      const result = report(sandbox)

      // 84 % is where this disk sits with every class inside its own bound: a
      // percentage threshold would warn on each of twenty deploys a day.
      expect(result.status).toBe(0)
      expect(result.stdout).toBe(
        '📊 Диск прода после выката: занято 84 %, свободно 2340 МБ; static/dist — 656 МБ\n',
      )
    } finally {
      removeDir(sandbox.root)
    }
  })

  it('warns once the backend can no longer build its image', () => {
    const sandbox = makeSandbox({ freeMb: 1535, usedPercent: 90 })

    try {
      const result = report(sandbox)

      expect(result.status).toBe(0)
      expect(result.stdout).toContain('📊 Диск прода после выката: занято 90 %')
      expect(result.stdout).toContain(
        '⚠️ На диске прода свободно 1535 МБ — меньше 1536 МБ, нужных сборке образа бэкенда: выкат бэкенда сейчас невозможен. Состав диска и порядок действий — docs/ops/prod-disk-growth.md',
      )
    } finally {
      removeDir(sandbox.root)
    }
  })
})

describe('frontend deploy disk guard: wiring in build-prod.sh', () => {
  const source = readCanonicalDeploy()
  const remoteDeploy = extractRemoteDeploy(source)

  it('asks the server for room before the first byte is uploaded', () => {
    const preflightIndex = source.indexOf(
      'if ! ssh "$PROD_SSH_TARGET" bash -s -- preflight \\',
    )

    expect(source).toContain('DISK_GUARD_HELPER="scripts/deploy-disk-guard.sh"')
    expect(source).toContain(
      'local DEPLOY_DISK_RESERVE_MB="${DEPLOY_DISK_RESERVE_MB:-720}"',
    )
    expect(source).toContain('PAYLOAD_KIB="$(du -sk "./dist/$ENV" | awk \'{ print $1 }\')"')
    expect(preflightIndex).toBeGreaterThan(-1)
    expect(preflightIndex).toBeLessThan(
      source.indexOf('rsync -azhe "ssh" --delete --mkpath --stats'),
    )
    // The helper is the program on ssh stdin; a refusal stops the deploy.
    const preflightCall = source.slice(
      preflightIndex,
      source.indexOf('local rsync_started=$SECONDS'),
    )
    expect(preflightCall).toContain('"$DEPLOY_BACKEND_BUILD_MB" < "$DISK_GUARD_HELPER"; then')
    expect(preflightCall).toContain('return 1')
    // Same floor as the backend's own build preflight
    // (METRAVEL_BUILD_MIN_FREE_MIB in deploy/prod/app_image_retention.sh).
    expect(source).toContain('local DEPLOY_BACKEND_BUILD_MB=1536')
  })

  it('keeps the success marker in place and appends the new arguments after it', () => {
    const sshCall = source.slice(
      source.indexOf('ssh "$PROD_SSH_TARGET" bash -s -- \\\n    "$ENV"'),
      source.indexOf("<<'REMOTE_DEPLOY_SCRIPT'"),
    )

    // ssh re-splits the command line on the server, so an empty argument
    // would vanish and shift the rest: all three are validated numbers or
    // base64 before the call.
    expect(sshCall).toContain(
      [
        '    "$REMOTE_DONE_MARKER" \\',
        '    "$CONTAINER_HELPER_B64" \\',
        '    "$EXPO_OVERLAY_MAX_MB" \\',
        '    "$DISK_GUARD_HELPER_B64" \\',
        '    "$DEPLOY_BACKEND_BUILD_MB" ',
      ].join('\n'),
    )
    expect(remoteDeploy).toContain('EXPO_OVERLAY_MAX_MB="$7"')
    expect(remoteDeploy).toContain('DISK_GUARD_HELPER_B64="$8"')
    expect(remoteDeploy).toContain('DEPLOY_BACKEND_BUILD_MB="$9"')
  })

  it('reports the disk after the verified cleanup and cannot fail a published deploy', () => {
    const reportIndex = remoteDeploy.indexOf(
      'report "$REMOTE_DIR" static/dist "$DEPLOY_BACKEND_BUILD_MB" ||',
    )

    expect(reportIndex).toBeGreaterThan(
      remoteDeploy.indexOf(stagingCleanupFailureContract),
    )
    expect(reportIndex).toBeLessThan(
      remoteDeploy.lastIndexOf('printf \'\\n%s\\n\' "$DEPLOY_SUCCESS_MARKER"'),
    )
  })
})
