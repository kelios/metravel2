import fs from 'fs'
import path from 'path'

import { makeTempDir, removeDir, runCli } from './cli-test-utils'

const helperPath = path.resolve(process.cwd(), 'scripts/deploy-expo-overlay.sh')

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
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'build-prod.sh'),
      'utf8',
    )

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
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'build-prod.sh'),
      'utf8',
    )
    const match = source.match(
      /<<'REMOTE_DEPLOY_SCRIPT'\n([\s\S]*?)\nREMOTE_DEPLOY_SCRIPT/,
    )

    expect(match).not.toBeNull()

    const fixture = makeTempDir('metravel-remote-deploy-script-')
    const remoteScriptPath = path.join(fixture, 'remote-deploy.sh')

    try {
      fs.writeFileSync(remoteScriptPath, match?.[1] ?? '', 'utf8')
      const result = runCli('bash', ['-n', remoteScriptPath])

      expect(result.status).toBe(0)
      expect(result.stderr).toBe('')
    } finally {
      removeDir(fixture)
    }
  })
})
