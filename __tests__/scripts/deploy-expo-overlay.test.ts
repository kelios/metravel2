import fs from 'fs'
import path from 'path'

import { makeTempDir, removeDir, runCli } from './cli-test-utils'

const helperPath = path.resolve(process.cwd(), 'scripts/deploy-expo-overlay.sh')
const canonicalDeployPath = path.resolve(process.cwd(), 'build-prod.sh')
const stagingCleanupFailureContract = [
  'if [ -e dist ]; then',
  '  echo "❌ Failed to remove upload staging directory: dist"',
  '  exit 1',
  'fi',
].join('\n')

function readCanonicalDeploy(): string {
  return fs.readFileSync(canonicalDeployPath, 'utf8')
}

function extractRemoteDeploy(source = readCanonicalDeploy()): string {
  const match = source.match(
    /<<'REMOTE_DEPLOY_SCRIPT'\n([\s\S]*?)\nREMOTE_DEPLOY_SCRIPT/,
  )

  if (!match) {
    throw new Error('canonical remote deploy payload was not found')
  }

  return match[1]
}

function deployContractViolations(remoteDeploy: string): string[] {
  const violations: string[] = []
  const appLifecycleCommand =
    /(?:docker(?:\s+compose)?|docker-compose)[^\n]*(?:restart|recreate|up\s+-d)[^\n]*\bapp\b/
  const proxyLifecycleCommand =
    /(?:docker(?:\s+compose)?|docker-compose)[^\n]*(?:restart|recreate|up\s+-d)[^\n]*\bnginx\b/
  const activationContract = [
    'activate_nginx() {',
    'nginx_validate && nginx_reload',
    '}',
  ].join('\n')
  const swapIndex = remoteDeploy.indexOf(
    'if ! mv static/dist.new static/dist; then',
  )
  const deadlineIndex = remoteDeploy.indexOf('readiness_deadline=')
  const activationIndex = remoteDeploy.indexOf(
    'if ! activate_nginx; then',
    remoteDeploy.indexOf('fail_after_swap() {'),
  )
  const readinessIndex = remoteDeploy.indexOf(
    'if ! wait_for_public_health; then',
  )
  const finalCleanupIndex = remoteDeploy.indexOf(
    "rroot '/app/static/dist.old'",
  )
  const stagingCleanupIndex = remoteDeploy.indexOf("rroot '/app/dist'")
  const stagingPostconditionIndex = remoteDeploy.indexOf(
    stagingCleanupFailureContract,
  )

  if (appLifecycleCommand.test(remoteDeploy)) {
    violations.push('frontend deploy changes the app lifecycle')
  }
  if (proxyLifecycleCommand.test(remoteDeploy)) {
    violations.push('frontend deploy hard-restarts the proxy')
  }
  if (!remoteDeploy.includes(activationContract)) {
    violations.push('Nginx validation does not precede graceful reload')
  }
  if (
    swapIndex === -1 ||
    deadlineIndex === -1 ||
    activationIndex === -1 ||
    readinessIndex === -1 ||
    !(
      swapIndex < deadlineIndex &&
      deadlineIndex < activationIndex &&
      activationIndex < readinessIndex
    )
  ) {
    violations.push('safe activation ordering is incomplete')
  }
  if (
    readinessIndex === -1 ||
    finalCleanupIndex === -1 ||
    readinessIndex >= finalCleanupIndex
  ) {
    violations.push('rollback tree is removed before public readiness')
  }
  if (
    finalCleanupIndex === -1 ||
    stagingCleanupIndex === -1 ||
    stagingPostconditionIndex === -1 ||
    !(
      finalCleanupIndex < stagingCleanupIndex &&
      stagingCleanupIndex < stagingPostconditionIndex
    )
  ) {
    violations.push('upload staging cleanup is not verified')
  }

  return violations
}

function makeFixture(): { root: string; fresh: string; previous: string } {
  const root = makeTempDir('metravel-expo-overlay-')
  const fresh = path.join(root, 'fresh')
  const previous = path.join(root, 'previous')
  fs.mkdirSync(fresh, { recursive: true })
  fs.mkdirSync(previous, { recursive: true })
  return { root, fresh, previous }
}

function writeFile(
  root: string,
  relativePath: string,
  content: string,
): string {
  const filePath = path.join(root, relativePath)
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, content)
  return filePath
}

function ageFile(filePath: string, days: number): void {
  const timestamp = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  fs.utimesSync(filePath, timestamp, timestamp)
}

function runOverlay(fresh: string, previous: string, days = 14): void {
  const result = runCli(
    'bash',
    [helperPath, fresh, previous, String(days)],
  )

  if (result.status !== 0) {
    throw new Error(
      `overlay helper failed (${result.status}): ${result.stderr || result.stdout}`,
    )
  }
}

describe('normal deploy Expo overlay retention', () => {
  it('backfills recent JS/CSS but excludes expired and unrelated files', () => {
    const fixture = makeFixture()

    try {
      writeFile(fixture.previous, 'js/web/legacy.js', 'legacy js')
      writeFile(fixture.previous, 'css/legacy.css', 'legacy css')
      const expiredJs = writeFile(
        fixture.previous,
        'js/web/expired.js',
        'expired js',
      )
      const expiredCss = writeFile(
        fixture.previous,
        'css/expired.css',
        'expired css',
      )
      writeFile(fixture.previous, 'js/web/legacy.js.map', 'source map')
      const freshButOld = writeFile(
        fixture.fresh,
        'js/web/current-stale-mtime.js',
        'fresh payload',
      )
      ageFile(expiredJs, 16)
      ageFile(expiredCss, 16)
      ageFile(freshButOld, 16)

      runOverlay(fixture.fresh, fixture.previous)

      expect(
        fs.readFileSync(path.join(fixture.fresh, 'js/web/legacy.js'), 'utf8'),
      ).toBe('legacy js')
      expect(
        fs.readFileSync(path.join(fixture.fresh, 'css/legacy.css'), 'utf8'),
      ).toBe('legacy css')
      expect(fs.existsSync(path.join(fixture.fresh, 'js/web/expired.js'))).toBe(
        false,
      )
      expect(fs.existsSync(path.join(fixture.fresh, 'css/expired.css'))).toBe(
        false,
      )
      expect(
        fs.existsSync(path.join(fixture.fresh, 'js/web/legacy.js.map')),
      ).toBe(false)
      expect(fs.readFileSync(freshButOld, 'utf8')).toBe('fresh payload')
    } finally {
      removeDir(fixture.root)
    }
  })

  it('preserves nested paths with spaces and special characters', () => {
    const fixture = makeFixture()
    const jsPath = "js/web/nested dir/legacy [chunk] $value; #1's.js"
    const cssPath = 'css/themes/(old) theme + contrast & print.css'

    try {
      writeFile(fixture.previous, jsPath, 'nested js')
      writeFile(fixture.previous, cssPath, 'nested css')

      runOverlay(fixture.fresh, fixture.previous)

      expect(fs.readFileSync(path.join(fixture.fresh, jsPath), 'utf8')).toBe(
        'nested js',
      )
      expect(fs.readFileSync(path.join(fixture.fresh, cssPath), 'utf8')).toBe(
        'nested css',
      )
    } finally {
      removeDir(fixture.root)
    }
  })

  it('does not import empty previous-release directories', () => {
    const fixture = makeFixture()
    const oldEmptyDir = path.join(fixture.previous, 'js/web/empty old dir')
    const freshEmptyDir = path.join(fixture.fresh, 'css/empty fresh dir')

    try {
      fs.mkdirSync(oldEmptyDir, { recursive: true })
      fs.mkdirSync(freshEmptyDir, { recursive: true })

      runOverlay(fixture.fresh, fixture.previous)

      expect(
        fs.existsSync(path.join(fixture.fresh, 'js/web/empty old dir')),
      ).toBe(false)
      expect(fs.existsSync(freshEmptyDir)).toBe(true)
    } finally {
      removeDir(fixture.root)
    }
  })

  it('keeps the fresh payload on a path collision', () => {
    const fixture = makeFixture()
    const relativePath = 'js/web/index-collision.js'
    const freshFile = writeFile(fixture.fresh, relativePath, 'current release')

    try {
      writeFile(fixture.previous, relativePath, 'previous release')
      ageFile(freshFile, 16)

      runOverlay(fixture.fresh, fixture.previous)

      expect(fs.readFileSync(freshFile, 'utf8')).toBe('current release')
    } finally {
      removeDir(fixture.root)
    }
  })

  it('uses deployment time for fresh assets so the next deploy retains them', () => {
    const fixture = makeFixture()
    const firstRelease = path.join(fixture.root, 'first-release')
    const secondRelease = path.join(fixture.root, 'second-release')
    const cachedChunk = writeFile(
      firstRelease,
      'js/web/current-cached.js',
      'cached current release',
    )

    try {
      ageFile(cachedChunk, 16)

      runOverlay(firstRelease, fixture.previous)

      expect(fs.statSync(cachedChunk).mtimeMs).toBeGreaterThan(
        Date.now() - 60_000,
      )

      writeFile(secondRelease, 'js/web/next-release.js', 'next release')
      runOverlay(secondRelease, firstRelease)

      expect(
        fs.readFileSync(
          path.join(secondRelease, 'js/web/current-cached.js'),
          'utf8',
        ),
      ).toBe('cached current release')
    } finally {
      removeDir(fixture.root)
    }
  })

  it('wires the tested helper into the canonical deploy before the static swap', () => {
    const source = readCanonicalDeploy()

    expect(source).toContain(
      'EXPO_OVERLAY_RETENTION_DAYS="${EXPO_OVERLAY_RETENTION_DAYS:-14}"',
    )
    expect(source).toContain(
      'EXPO_OVERLAY_HELPER="scripts/deploy-expo-overlay.sh"',
    )
    expect(source).not.toContain('scripts/fix-prod.sh')
    expect(
      source.indexOf("printf '%s' \"$EXPO_OVERLAY_HELPER_B64\""),
    ).toBeLessThan(source.indexOf('mv static/dist.new static/dist'))
  })

  it('keeps the canonical remote deploy payload valid bash', () => {
    const remoteDeploy = extractRemoteDeploy()

    const fixture = makeTempDir('metravel-remote-deploy-script-')
    const remoteScriptPath = path.join(fixture, 'remote-deploy.sh')

    try {
      fs.writeFileSync(remoteScriptPath, remoteDeploy, 'utf8')
      const result = runCli('bash', ['-n', remoteScriptPath])

      expect(result.status).toBe(0)
      expect(result.stderr).toBe('')
    } finally {
      removeDir(fixture)
    }
  })

  it('preserves app availability and safe activation ordering', () => {
    const source = readCanonicalDeploy()
    const remoteDeploy = extractRemoteDeploy(source)
    const readinessIndex = source.indexOf(
      'if ! wait_for_public_health; then',
    )

    expect(deployContractViolations(remoteDeploy)).toEqual([])
    expect(readinessIndex).toBeGreaterThan(-1)
    expect(readinessIndex).toBeLessThan(
      source.indexOf('node scripts/post-deploy-seo-check.js'),
    )
    expect(readinessIndex).toBeLessThan(
      source.indexOf('node scripts/post-deploy-media-check.js'),
    )
    expect(source).not.toContain('Жду перезапуск app/nginx')
  })

  it('rejects a reintroduced app restart', () => {
    const unsafeDeploy = `${extractRemoteDeploy()}\n` +
      'docker compose -f docker-compose-prod.app.yaml restart app nginx'

    expect(deployContractViolations(unsafeDeploy)).toContain(
      'frontend deploy changes the app lifecycle',
    )
  })

  it('rejects rollback cleanup before public readiness', () => {
    const remoteDeploy = extractRemoteDeploy()
    const unsafeDeploy = remoteDeploy.replace(
      'if ! wait_for_public_health; then',
      "rroot '/app/static/dist.old'\nif ! wait_for_public_health; then",
    )

    expect(deployContractViolations(unsafeDeploy)).toContain(
      'rollback tree is removed before public readiness',
    )
  })

  it('rejects readiness before graceful Nginx activation', () => {
    const remoteDeploy = extractRemoteDeploy()
    const unsafeDeploy = remoteDeploy.replace(
      'if ! activate_nginx; then\n  fail_after_swap "Nginx validation or graceful reload failed"',
      'if ! wait_for_public_health; then\n  exit 1\nfi\nif ! activate_nginx; then\n  fail_after_swap "Nginx validation or graceful reload failed"',
    )

    expect(deployContractViolations(unsafeDeploy)).toContain(
      'safe activation ordering is incomplete',
    )
  })

  it('rejects upload staging cleanup without a verified postcondition', () => {
    const unsafeDeploy = extractRemoteDeploy().replace(
      stagingCleanupFailureContract,
      [
        'if [ -e dist ]; then',
        '  echo "❌ Failed to remove upload staging directory: dist"',
        '  echo "warning only"',
        'fi',
      ].join('\n'),
    )

    expect(deployContractViolations(unsafeDeploy)).toContain(
      'upload staging cleanup is not verified',
    )
  })
})
