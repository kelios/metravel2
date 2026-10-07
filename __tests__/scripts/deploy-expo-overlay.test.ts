import fs from 'fs'
import path from 'path'

import { makeTempDir, removeDir, runCli } from './cli-test-utils'
import { findFrontendDeployLifecycleViolations } from './frontend-deploy-lifecycle-contract'
import {
  extractRemoteDeploy,
  readCanonicalDeploy,
  stagingCleanupFailureContract,
} from './remote-deploy-test-utils'

const helperPath = path.resolve(process.cwd(), 'scripts/deploy-expo-overlay.sh')

function deployContractViolations(remoteDeploy: string): string[] {
  const violations: string[] = []
  const activationContract = [
    'activate_nginx() {',
    '  nginx_validate && nginx_reload',
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

  if (findFrontendDeployLifecycleViolations(remoteDeploy).length > 0) {
    violations.push('frontend deploy changes container lifecycle')
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

// One deploy stamps its whole payload within a single touch pass, so
// `secondsAgo` places a file into the generation of the deploy that ran then.
function writeGenerationFile(
  root: string,
  relativePath: string,
  sizeKib: number,
  secondsAgo: number,
): string {
  const filePath = writeFile(root, relativePath, 'x'.repeat(sizeKib * 1024))
  const timestamp = new Date(Date.now() - secondsAgo * 1000)
  fs.utimesSync(filePath, timestamp, timestamp)
  return filePath
}

function listFiles(root: string, prefix = ''): string[] {
  return fs
    .readdirSync(path.join(root, prefix), { withFileTypes: true })
    .flatMap((entry) => {
      const relativePath = path.join(prefix, entry.name)
      return entry.isDirectory() ? listFiles(root, relativePath) : [relativePath]
    })
    .sort()
}

function runOverlay(
  fresh: string,
  previous: string,
  days = 14,
  budgetMb: number | '' = '',
): string {
  const result = runCli(
    'bash',
    [helperPath, fresh, previous, String(days), String(budgetMb)],
  )

  if (result.status !== 0) {
    throw new Error(
      `overlay helper failed (${result.status}): ${result.stderr || result.stdout}`,
    )
  }

  return result.stdout
}

// The live tree as the next deploy finds it: `shared.js` survives into the
// fresh payload, `replaced.js` is what the release being replaced leaves
// behind, and three older generations sit under it.
function makeGenerationFixture(): ReturnType<typeof makeFixture> {
  const fixture = makeFixture()
  writeGenerationFile(fixture.previous, 'js/web/shared.js', 1, 120)
  writeFile(fixture.fresh, 'js/web/shared.js', 'current release')
  writeGenerationFile(fixture.previous, 'js/web/replaced.js', 10, 120)
  writeGenerationFile(fixture.previous, 'js/web/hour-a.js', 300, 3600)
  writeGenerationFile(fixture.previous, 'css/hour-b.css', 300, 3605)
  writeGenerationFile(fixture.previous, 'js/web/two-hours.js', 600, 7200)
  writeGenerationFile(fixture.previous, 'js/web/three-hours.js', 10, 10800)
  return fixture
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

    const defaults = fs.readFileSync(path.resolve('scripts/deploy-target.sh'), 'utf8')
    expect(source).toContain('metravel_deploy_defaults')
    expect(defaults).toContain(
      'EXPO_OVERLAY_RETENTION_DAYS="${EXPO_OVERLAY_RETENTION_DAYS:-14}"',
    )
    expect(source).toContain(
      'EXPO_OVERLAY_HELPER="scripts/deploy-expo-overlay.sh"',
    )
    // `:-`, not `-`: .env.deploy is exported wholesale, and an empty line in
    // it must fall back to the default instead of lifting the bound.
    expect(defaults).toContain(
      'EXPO_OVERLAY_MAX_MB="${EXPO_OVERLAY_MAX_MB:-256}"',
    )
    expect(extractRemoteDeploy(source)).toContain(
      '  "$EXPO_OVERLAY_RETENTION_DAYS" \\\n  "$EXPO_OVERLAY_MAX_MB"',
    )
    // Only dist/$ENV travels, so build-root dot paths never reach the server,
    // and the live release is the delta basis for the upload (#2013).
    expect(source).toContain('rsync -azHhe "ssh" --delete --mkpath --stats')
    expect(source).toContain('--copy-dest="$PROD_REMOTE_DIR/static/dist"')
    expect(source).toContain(
      '"./dist/$ENV/" \\\n    "$PROD_SSH_TARGET:$PROD_REMOTE_DIR/dist/$ENV/"',
    )
    expect(source).not.toContain('scripts/fix-prod.sh')
    expect(
      source.indexOf("printf '%s' \"$EXPO_OVERLAY_HELPER_B64\""),
    ).toBeLessThan(source.indexOf('mv static/dist.new static/dist'))
  })

  // Web builds inline RU catalog text into the calling modules at transform
  // time (i18n/babel-inline-plugin.js), while Metro keys a transform on the
  // module itself and babel.config.js only: a warm cache would ship stale text
  // after a catalog-only commit (#2013). The prod export stays cold.
  it('keeps the prod export on a cold Metro cache', () => {
    expect(readCanonicalDeploy()).toContain(
      'node scripts/build-web-safe.js -p web -c 2>&1 | tee "$EXPORT_LOG"',
    )
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
    // Prod media checks read the API and media routes, not the released HTML,
    // so they run in the background during the export (#2013); SEO generation
    // waits for them so paced walks of the prod API never overlap (#1966).
    const mediaStart = source.indexOf('\n  start_prod_media_checks\n')
    expect(mediaStart).toBeGreaterThan(-1)
    expect(mediaStart).toBeLessThan(source.indexOf('\nbuild_env "$ENV"\n'))
    expect(source.indexOf('\n  finish_prod_media_checks\n')).toBeLessThan(
      source.indexOf('\nnode scripts/generate-seo-pages.js'),
    )
    expect(source).not.toContain('Жду перезапуск app/nginx')
  })

  it('rejects a reintroduced app restart', () => {
    const unsafeDeploy = `${extractRemoteDeploy()}\n` +
      'docker compose -f docker-compose-prod.app.yaml restart app nginx'

    expect(deployContractViolations(unsafeDeploy)).toContain(
      'frontend deploy changes container lifecycle',
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

// The age window bounds the overlay in days, while its size follows the number
// of deploys inside the window: 97 deploys left 943 MB on a 15 GB disk (#2186).
describe('normal deploy Expo overlay byte budget', () => {
  it('carries whole generations newest first and stops at the first that does not fit', () => {
    const fixture = makeGenerationFixture()

    try {
      const report = runOverlay(fixture.fresh, fixture.previous, 14, 1)

      // 10 KiB + 600 KiB fit into 1 MB; the two-hour generation does not, and
      // the three-hour one stays out although it would fit on its own: a tab
      // of that release also needs the generation that was just refused.
      expect(listFiles(fixture.fresh)).toEqual([
        'css/hour-b.css',
        'js/web/hour-a.js',
        'js/web/replaced.js',
        'js/web/shared.js',
      ])
      expect(
        fs.readFileSync(path.join(fixture.fresh, 'js/web/shared.js'), 'utf8'),
      ).toBe('current release')
      expect(report).toContain('перенесено — поколений 2, файлов 3, 1 МБ')
      expect(report).toContain('отброшено — поколений 2, файлов 2, 1 МБ')
      expect(report).toContain('(предел 1 МБ, срок 14 дн.)')
    } finally {
      removeDir(fixture.root)
    }
  })

  it('always carries the release being replaced, even with a zero budget', () => {
    const fixture = makeGenerationFixture()

    try {
      const report = runOverlay(fixture.fresh, fixture.previous, 14, 0)

      expect(listFiles(fixture.fresh)).toEqual([
        'js/web/replaced.js',
        'js/web/shared.js',
      ])
      expect(report).toContain('перенесено — поколений 1, файлов 1, 0 МБ')
      expect(report).toContain('отброшено — поколений 3, файлов 4, 1 МБ')
    } finally {
      removeDir(fixture.root)
    }
  })

  it('never splits a generation across the budget', () => {
    const fixture = makeFixture()

    try {
      writeGenerationFile(fixture.previous, 'js/web/shared.js', 1, 120)
      writeFile(fixture.fresh, 'js/web/shared.js', 'current release')
      writeGenerationFile(fixture.previous, 'js/web/half-a.js', 600, 3600)
      writeGenerationFile(fixture.previous, 'js/web/half-b.js', 600, 3630)

      const report = runOverlay(fixture.fresh, fixture.previous, 14, 1)

      expect(listFiles(fixture.fresh)).toEqual(['js/web/shared.js'])
      expect(report).toContain('отброшено — поколений 1, файлов 2, 1 МБ')
    } finally {
      removeDir(fixture.root)
    }
  })

  it('keeps the age bound when the budget has room', () => {
    const fixture = makeFixture()

    try {
      writeFile(fixture.previous, 'js/web/recent.js', 'recent')
      ageFile(writeFile(fixture.previous, 'js/web/expired.js', 'expired'), 16)

      runOverlay(fixture.fresh, fixture.previous, 14, 512)

      expect(listFiles(fixture.fresh)).toEqual(['js/web/recent.js'])
    } finally {
      removeDir(fixture.root)
    }
  })

  // A release that stayed live for longer than the age window is still the
  // one open tabs run on until the swap; only what lay under it has expired.
  it('carries the release being replaced even when it is older than the age window', () => {
    const fixture = makeFixture()
    const day = 24 * 60 * 60

    try {
      writeGenerationFile(fixture.previous, 'js/web/live.js', 10, 20 * day)
      writeGenerationFile(fixture.previous, 'js/web/under.js', 10, 30 * day)

      const report = runOverlay(fixture.fresh, fixture.previous, 14, 256)

      expect(listFiles(fixture.fresh)).toEqual(['js/web/live.js'])
      expect(report).toContain('перенесено — поколений 1, файлов 1')
      expect(report).toContain('отброшено — поколений 1, файлов 1')
    } finally {
      removeDir(fixture.root)
    }
  })

  it('keeps every generation of the age window when no budget is given', () => {
    const fixture = makeGenerationFixture()

    try {
      const report = runOverlay(fixture.fresh, fixture.previous)

      expect(listFiles(fixture.fresh)).toEqual([
        'css/hour-b.css',
        'js/web/hour-a.js',
        'js/web/replaced.js',
        'js/web/shared.js',
        'js/web/three-hours.js',
        'js/web/two-hours.js',
      ])
      expect(report).toContain('перенесено — поколений 4, файлов 5, 1 МБ')
      expect(report).toContain('(предел не задан, срок 14 дн.)')
    } finally {
      removeDir(fixture.root)
    }
  })

  // Both bounds are counted from the mtime a chunk got when its release was
  // published. A carried chunk that came out with a fresh mtime would join the
  // generation of the release being replaced and escape both bounds for good.
  it('keeps the deploy stamp and inode of carried chunks', () => {
    const fixture = makeFixture()
    const second = path.join(fixture.root, 'second')
    const third = path.join(fixture.root, 'third')

    try {
      const old = writeGenerationFile(fixture.previous, 'js/web/old.js', 10, 3600)
      const oldStat = fs.statSync(old)
      writeGenerationFile(fixture.previous, 'js/web/live.js', 10, 120)

      writeFile(second, 'js/web/second.js', 'second release')
      runOverlay(second, fixture.previous, 14, 256)
      const carried = fs.statSync(path.join(second, 'js/web/old.js'))
      expect(carried.ino).toBe(oldStat.ino)
      expect(Math.floor(carried.mtimeMs / 1000)).toBe(
        Math.floor(oldStat.mtimeMs / 1000),
      )

      // Next deploy, nothing but the replaced release allowed: `old.js` and
      // `live.js` kept their stamps, so they are recognised as older and go.
      writeFile(third, 'js/web/third.js', 'third release')
      runOverlay(third, second, 14, 0)
      expect(listFiles(third)).toEqual(['js/web/second.js', 'js/web/third.js'])
    } finally {
      removeDir(fixture.root)
    }
  })

  // The selection cannot run without perl. Carrying everything instead would
  // bring the unbounded growth back silently, so the helper stops the deploy.
  it('fails closed without perl', () => {
    const fixture = makeFixture()
    const toolBin = path.join(fixture.root, 'tool-bin')

    try {
      writeFile(fixture.previous, 'js/web/legacy.js', 'legacy')
      fs.mkdirSync(toolBin)
      for (const tool of ['bash', 'find', 'touch', 'mkdir', 'mktemp', 'rm', 'cat', 'cpio']) {
        const resolved = runCli('bash', ['-c', `command -v ${tool}`]).stdout.trim()
        fs.symlinkSync(resolved, path.join(toolBin, tool))
      }

      const result = runCli(
        'bash',
        [helperPath, fixture.fresh, fixture.previous, '14', '256'],
        { env: { PATH: toolBin } },
      )

      expect(result.status).toBe(1)
      expect(result.stderr).toContain('perl is required')
      expect(listFiles(fixture.fresh)).toEqual([])
    } finally {
      removeDir(fixture.root)
    }
  })

  it('rejects a budget that is not a whole number', () => {
    const fixture = makeFixture()

    try {
      const result = runCli('bash', [
        helperPath,
        fixture.fresh,
        fixture.previous,
        '14',
        '1.5',
      ])

      expect(result.status).toBe(2)
      expect(result.stderr).toContain('budget-mb must be a non-negative integer')
    } finally {
      removeDir(fixture.root)
    }
  })

  // Production shape: the helper arrives on bash stdin, so its own stdin
  // readers would swallow the rest of the program. The selection must take its
  // list from the pipe and still publish the summary line.
  it('applies the budget when the helper itself arrives on stdin', () => {
    const fixture = makeGenerationFixture()

    try {
      const result = runCli(
        'bash',
        ['-s', '--', fixture.fresh, fixture.previous, '14', '0'],
        { input: fs.readFileSync(helperPath, 'utf8') },
      )

      expect(result.status).toBe(0)
      expect(listFiles(fixture.fresh)).toEqual([
        'js/web/replaced.js',
        'js/web/shared.js',
      ])
      expect(result.stdout).toContain('📊 Overlay старых чанков: перенесено')
    } finally {
      removeDir(fixture.root)
    }
  })
})
