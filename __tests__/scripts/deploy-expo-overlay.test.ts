import fs from 'fs'
import os from 'os'
import path from 'path'
import { spawnSync } from 'child_process'

const repoRoot = process.cwd()
const helperPath = path.join(repoRoot, 'scripts/deploy-expo-overlay.sh')

const writeFile = (filePath: string, content: string, ageDays = 0) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, content)
  const timestamp = new Date(Date.now() - ageDays * 24 * 60 * 60 * 1000)
  fs.utimesSync(filePath, timestamp, timestamp)
}

describe('deploy-expo-overlay', () => {
  let tempRoot: string

  beforeEach(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'metravel-expo-overlay-'))
  })

  afterEach(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true })
  })

  it('retains recent JS/CSS without clobbering the fresh payload', () => {
    const previous = path.join(tempRoot, 'previous')
    const fresh = path.join(tempRoot, 'fresh')
    const recentJs = '_expo/static/js/web/nested/with spaces/[draft] #1.js'
    const recentCss = '_expo/static/css/web/theme (legacy).css'
    const expiredJs = '_expo/static/js/web/expired.js'
    const expiredCss = '_expo/static/css/web/expired.css'
    const collision = '_expo/static/js/web/current.js'
    const staleFresh = '_expo/static/css/web/current-stale-mtime.css'

    writeFile(path.join(previous, recentJs), 'recent-js', 2)
    writeFile(path.join(previous, recentCss), 'recent-css', 13)
    writeFile(path.join(previous, expiredJs), 'expired-js', 20)
    writeFile(path.join(previous, expiredCss), 'expired-css', 20)
    writeFile(path.join(previous, collision), 'old-collision', 1)
    writeFile(path.join(previous, '_expo/static/fonts/ignored.woff2'), 'font', 1)
    fs.mkdirSync(path.join(previous, '_expo/static/js/web/empty generation'), {
      recursive: true,
    })

    writeFile(path.join(fresh, collision), 'fresh-collision', 30)
    writeFile(path.join(fresh, staleFresh), 'fresh-stale-mtime', 30)

    const result = spawnSync('bash', [helperPath, previous, fresh, '14'], {
      cwd: repoRoot,
      encoding: 'utf8',
    })

    expect(result.status).toBe(0)
    expect(fs.readFileSync(path.join(fresh, recentJs), 'utf8')).toBe('recent-js')
    expect(fs.readFileSync(path.join(fresh, recentCss), 'utf8')).toBe('recent-css')
    expect(fs.existsSync(path.join(fresh, expiredJs))).toBe(false)
    expect(fs.existsSync(path.join(fresh, expiredCss))).toBe(false)
    expect(fs.readFileSync(path.join(fresh, collision), 'utf8')).toBe('fresh-collision')
    expect(fs.readFileSync(path.join(fresh, staleFresh), 'utf8')).toBe(
      'fresh-stale-mtime',
    )
    expect(fs.existsSync(path.join(fresh, '_expo/static/fonts/ignored.woff2'))).toBe(
      false,
    )
    expect(
      fs.existsSync(path.join(fresh, '_expo/static/js/web/empty generation')),
    ).toBe(false)
  })

  it('rejects an invalid retention window', () => {
    const result = spawnSync('bash', [helperPath, tempRoot, tempRoot, '0'], {
      cwd: repoRoot,
      encoding: 'utf8',
    })

    expect(result.status).toBe(2)
    expect(result.stderr).toContain(
      'EXPO_OVERLAY_RETENTION_DAYS must be a positive integer',
    )
  })

  it('wires the helper into the canonical deploy before the atomic swap', () => {
    const source = fs.readFileSync(path.join(repoRoot, 'build-prod.sh'), 'utf8')

    expect(source).toContain('EXPO_OVERLAY_RETENTION_DAYS="${EXPO_OVERLAY_RETENTION_DAYS:-14}"')
    expect(source).toContain('scripts/deploy-expo-overlay.sh')
    expect(source).toContain("base64 -d | bash -s -- static/dist static/dist.new")
    expect(source.indexOf('base64 -d | bash -s -- static/dist static/dist.new')).toBeLessThan(
      source.indexOf('rollback_dir=static/dist.old'),
    )
  })
})
