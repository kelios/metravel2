const fs = require('fs')
const path = require('path')

const {
  createIsolatedExpoTempDir,
  hasClearFlag,
} = require('@/scripts/build-web-safe')

describe('build-web-safe helpers', () => {
  const projectRoot = process.cwd()

  afterEach(() => {
    const tempRoot = path.join(projectRoot, '.tmp', 'expo-export')
    fs.rmSync(tempRoot, { recursive: true, force: true })
  })

  it('detects Expo clear-cache flags', () => {
    expect(hasClearFlag(['-p', 'web'])).toBe(false)
    expect(hasClearFlag(['-p', 'web', '-c'])).toBe(true)
    expect(hasClearFlag(['-p', 'web', '--clear'])).toBe(true)
  })

  it('creates a deterministic isolated temp dir inside the repo', () => {
    const tempDir = createIsolatedExpoTempDir(projectRoot, 123, 456)

    expect(tempDir).toBe(path.join(projectRoot, '.tmp', 'expo-export', 'run-123-456'))
    expect(fs.existsSync(tempDir)).toBe(true)
  })
})
