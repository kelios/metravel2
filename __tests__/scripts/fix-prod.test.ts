/** @jest-environment node */
import fs from 'fs'
import path from 'path'
import { makeTempDir, removeDir, runCli } from './cli-test-utils'

const source = fs.readFileSync(path.resolve('scripts/fix-prod.sh'), 'utf8')
const helper = (name: string) => fs.readFileSync(path.resolve('scripts', name), 'utf8')
const encoded = (name: string) => Buffer.from(helper(name)).toString('base64')
const containerSnippet = helper('deploy-target.sh').split("cat <<'METRAVEL_CONTAINER_SNIPPET'\n")[1].split('\nMETRAVEL_CONTAINER_SNIPPET')[0]
const payload = source.split("<<'REMOTE_FIX_SCRIPT'\n")[1].split('\nREMOTE_FIX_SCRIPT')[0]
const realChown = fs.existsSync('/usr/sbin/chown') ? '/usr/sbin/chown' : '/usr/bin/chown'
const executable = (file: string, text: string) => {
  fs.writeFileSync(file, `#!/bin/bash\n${text}\n`, { mode: 0o755 })
}

function sandbox(root: string, previous = true) {
  const remote = path.join(root, 'remote')
  const bin = path.join(root, 'bin')
  fs.mkdirSync(bin, { recursive: true })
  for (const directory of ['dist/prod/_expo/static/js/web', 'static', 'icons', 'images']) {
    fs.mkdirSync(path.join(remote, directory), { recursive: true })
  }
  fs.writeFileSync(path.join(remote, 'dist/prod/index.html'), 'new release')
  fs.mkdirSync(path.join(remote, 'dist/prod/travels/example'), { recursive: true })
  fs.writeFileSync(path.join(remote, 'dist/prod/travels/example.html'), '<html>paired</html>')
  fs.linkSync(path.join(remote, 'dist/prod/travels/example.html'), path.join(remote, 'dist/prod/travels/example/index.html'))
  fs.writeFileSync(path.join(remote, 'dist/prod/_expo/static/js/web/fresh.js'), 'fresh')
  fs.writeFileSync(path.join(remote, 'icons/icon.svg'), 'icon')
  fs.writeFileSync(path.join(remote, 'images/image.svg'), 'image')
  if (previous) {
    fs.mkdirSync(path.join(remote, 'static/dist/_expo/static/js/web'), { recursive: true })
    fs.writeFileSync(path.join(remote, 'static/dist/index.html'), 'old release')
    fs.writeFileSync(path.join(remote, 'static/dist/_expo/static/js/web/previous.js'), 'previous')
    fs.writeFileSync(path.join(remote, 'static/dist/_expo/static/js/web/fresh.js'), 'old collision')
  }
  executable(path.join(bin, 'docker'), `
if [ "$1" = ps ]; then printf 'metravel-app-1\nmetravel-nginx-1\n'; exit 0; fi
[ "$1" = exec ] || exit 71
shift
if [ "$1" = -u ]; then shift 2; fi
ctr="$1"; shift
# Faithful stdin consumer: without isolation the outer program is truncated.
cat >/dev/null
if [ "$ctr" = metravel-nginx-1 ]; then printf '%s\n' "$*" >> "$REMOTE_ROOT/nginx-events"; exit 0; fi
[ "$1" = sh ] && [ "$2" = -c ] || exit 72
program="\${3//\\/app/$REMOTE_ROOT}"
shift 3
exec sh -c "$program" "$@"`)
  // The real fixture uid owns its tree. Retain top-dir normalization as a
  // recorded container-root operation; the stage gets the actual host uid/gid.
  executable(path.join(bin, 'chown'), `
printf '%s\n' "$*" >> "$REMOTE_ROOT/ownership-events"
if [ "$1" = 1984:1000 ]; then exit 0; fi
exec ${realChown} "$@"`)
  executable(path.join(bin, 'pgrep'), 'exit 1')
  return { remote, bin }
}

function runRecovery(root: string, { previous = true, failure = '', cached = false } = {}) {
  const fixture = sandbox(root, previous)
  if (cached) {
    const js = path.join(fixture.remote, 'dist/prod/_expo/static/js/web/fresh.js')
    const css = path.join(fixture.remote, 'dist/prod/_expo/static/js/web/fresh.css')
    fs.writeFileSync(css, 'fresh css')
    for (const [file, days] of [[js, 40], [css, 80]] as const) {
      const old = new Date(Date.now() - days * 86400000)
      fs.utimesSync(file, old, old)
    }
  }
  if (failure === 'copy') executable(path.join(fixture.bin, 'rsync'), 'echo "injected ENOSPC" >&2; exit 28')
  if (failure === 'assets') executable(path.join(fixture.bin, 'cp'), 'case "$*" in *assets/icons*) exit 28;; esac\nexec /bin/cp "$@"')
  if (failure === 'rename') executable(path.join(fixture.bin, 'mv'), 'if [ "$1" = static/dist.new ]; then exit 28; fi\nexec /bin/mv "$@"')
  if (failure === 'overlay') executable(path.join(fixture.bin, 'cpio'), 'echo "injected overlay write failure" >&2; exit 28')
  return {
    ...fixture,
    ...runCli('bash', ['-s', '--', 'prod', fixture.remote, Buffer.from(containerSnippet).toString('base64'),
      encoded('deploy-expo-overlay.sh'), '14', '256', encoded('deploy-disk-guard.sh'), '1536', 'FIX-TEST-DONE'], {
      input: payload,
      env: { PATH: `${fixture.bin}:${process.env.PATH}`, REMOTE_ROOT: fixture.remote },
    }),
  }
}

describe('emergency publication uses the shared disk and overlay policy', () => {
  it('runs the real disk guard before any upload and counts the extra staging copy', () => {
    const root = makeTempDir('fix-prod-preflight-')
    try {
      const { remote, bin } = sandbox(root)
      fs.mkdirSync(path.join(remote, 'assets/icons'), { recursive: true })
      fs.mkdirSync(path.join(remote, 'assets/images'), { recursive: true })
      fs.writeFileSync(path.join(remote, 'dist/prod/payload.bin'), Buffer.alloc(8 * 1024 * 1024, 1))
      fs.mkdirSync(path.join(remote, 'scripts'))
      fs.writeFileSync(path.join(remote, 'scripts/deploy-disk-guard.sh'), helper('deploy-disk-guard.sh'))
      // 12 MiB fits one 8 MiB upload, but not its second staging allocation.
      executable(path.join(bin, 'df'), 'printf "Filesystem 1024-blocks Used Available Capacity Mounted\nfixture 50000 37000 12288 75%% /\n"')
      const upload = source.slice(source.indexOf('# Recovery uploads'), source.indexOf('EXPO_OVERLAY_HELPER_B64='))
      const result = runCli('bash', ['-s'], { cwd: remote, env: { PATH: `${bin}:${process.env.PATH}` }, input: `
set -euo pipefail
ENV=prod
SERVER=stub
REMOTE_DIR="$PWD"
DEPLOY_DISK_RESERVE_MB=0
DEPLOY_BACKEND_BUILD_MB=1536
DISK_GUARD_HELPER=scripts/deploy-disk-guard.sh
ssh() { shift; "$@"; }
rsync() { touch upload-started; }
${upload}
rsync
` })
      expect(result.status).not.toBe(0)
      expect(result.stdout).toContain('upload has not started')
      expect(fs.existsSync(path.join(remote, 'upload-started'))).toBe(false)
      expect(fs.readFileSync(path.join(remote, 'static/dist/index.html'), 'utf8')).toBe('old release')
      expect(fs.existsSync(path.join(remote, 'static/dist.new'))).toBe(false)
    } finally { removeDir(root) }
  })

  it.each(['copy', 'assets', 'overlay', 'rename'])('%s write failure preserves the actual active tree before swap', (failure) => {
    const root = makeTempDir(`fix-prod-${failure}-`)
    try {
      const result = runRecovery(root, { failure })
      expect(result.status).not.toBe(0)
      expect(fs.readFileSync(path.join(result.remote, 'static/dist/index.html'), 'utf8')).toBe('old release')
      expect(fs.existsSync(path.join(result.remote, 'nginx-events'))).toBe(false)
      expect(result.stdout).not.toContain('FIX-TEST-DONE')
    } finally { removeDir(root) }
  })

  it.each([true, false])('publishes with previous release=%s using real filesystem writes', (previous) => {
    const root = makeTempDir('fix-prod-success-')
    try {
      const result = runRecovery(root, { previous })
      expect(result.status).toBe(0)
      expect(result.stdout).toContain('FIX-TEST-DONE')
      expect(result.stdout).toContain('Диск прода после выката')
      expect(fs.readFileSync(path.join(result.remote, 'static/dist/index.html'), 'utf8')).toBe('new release')
      expect(fs.readFileSync(path.join(result.remote, 'static/dist/_expo/static/js/web/fresh.js'), 'utf8')).toBe('fresh')
      expect(fs.existsSync(path.join(result.remote, 'static/dist/_expo/static/js/web/previous.js'))).toBe(previous)
      expect(fs.readFileSync(path.join(result.remote, 'static/dist/assets/icons/icon.svg'), 'utf8')).toBe('icon')
      const flat = fs.statSync(path.join(result.remote, 'static/dist/travels/example.html'))
      const index = fs.statSync(path.join(result.remote, 'static/dist/travels/example/index.html'))
      expect([flat.dev, flat.ino]).toEqual([index.dev, index.ino])
      expect(flat.nlink).toBe(2)
      expect(fs.statSync(path.join(result.remote, 'static/dist')).uid).toBe(process.getuid!())
      expect(fs.readFileSync(path.join(result.remote, 'ownership-events'), 'utf8')).toContain(`${process.getuid!()}:${process.getgid!()}`)
      const events = fs.readFileSync(path.join(result.remote, 'nginx-events'), 'utf8')
      expect(events.indexOf(' -t ')).toBeLessThan(events.indexOf(' -s reload '))
      expect(fs.existsSync(path.join(result.remote, 'static/dist.old'))).toBe(false)
      expect(fs.existsSync(path.join(result.remote, 'dist'))).toBe(false)
    } finally { removeDir(root) }
  })

  it('stamps cached chunks on the first recovery so the next release retains the complete generation', () => {
    const root = makeTempDir('fix-prod-first-cached-')
    try {
      const publishedAt = Date.now()
      const result = runRecovery(root, { previous: false, cached: true })
      expect(result.status).toBe(0)
      const current = path.join(result.remote, 'static/dist/_expo/static')
      for (const chunk of ['fresh.js', 'fresh.css']) {
        expect(fs.statSync(path.join(current, 'js/web', chunk)).mtimeMs).toBeGreaterThanOrEqual(publishedAt - 1000)
      }
      // Even a zero window/budget carries the whole just-replaced generation.
      const next = path.join(root, 'next-static')
      expect(runCli('bash', [path.resolve('scripts/deploy-expo-overlay.sh'), next, current, '0', '0']).status).toBe(0)
      expect(fs.readFileSync(path.join(next, 'js/web/fresh.js'), 'utf8')).toBe('fresh')
      expect(fs.readFileSync(path.join(next, 'js/web/fresh.css'), 'utf8')).toBe('fresh css')
    } finally { removeDir(root) }
  })

  it('shares exact defaults, accepts overrides and refuses an invalid limit', () => {
    const defaults = helper('deploy-target.sh').split('metravel_deploy_defaults() {')[1].split('\n}\n')[0]
    const run = (env: Record<string, string> = {}) => runCli('bash', ['-s'], { env, input: `
set -euo pipefail
metravel_deploy_defaults() {${defaults}
}
metravel_deploy_defaults
printf '%s/%s/%s/%s' "$EXPO_OVERLAY_RETENTION_DAYS" "$EXPO_OVERLAY_MAX_MB" "$DEPLOY_DISK_RESERVE_MB" "$DEPLOY_BACKEND_BUILD_MB"
` })
    expect(run({ EXPO_OVERLAY_RETENTION_DAYS: '', EXPO_OVERLAY_MAX_MB: '', DEPLOY_DISK_RESERVE_MB: '', DEPLOY_BACKEND_BUILD_MB: '' }).stdout).toBe('14/256/720/1536')
    expect(run({ EXPO_OVERLAY_RETENTION_DAYS: '0', EXPO_OVERLAY_MAX_MB: '32', DEPLOY_DISK_RESERVE_MB: '900', DEPLOY_BACKEND_BUILD_MB: '1800' }).stdout).toBe('0/32/900/1536')
    expect(run({ EXPO_OVERLAY_MAX_MB: 'oops' }).status).not.toBe(0)
    expect(source).toContain('metravel_deploy_defaults')
    expect(fs.readFileSync(path.resolve('build-prod.sh'), 'utf8')).toContain('metravel_deploy_defaults')
  })

  it('has no duplicate/unbounded overlay and isolates every container stdin', () => {
    expect(source).not.toContain('cp -an static/dist/_expo/static')
    expect(payload).not.toContain('|| true')
    expect(payload).not.toContain('disk_pct')
    const dockerLines = payload.split('\n').filter((line) => /^docker exec/.test(line))
    expect(dockerLines).toHaveLength(5)
    expect(payload.match(/<\/dev\/null/g)).toHaveLength(5)
    expect(payload.trim().endsWith('printf \'\\n%s\\n\' "$DEPLOY_SUCCESS_MARKER"')).toBe(true)
    expect(source).toContain('grep -qxF -- "$REMOTE_DONE_MARKER"')
  })
})
