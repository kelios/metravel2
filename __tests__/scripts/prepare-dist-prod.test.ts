const fs = require('fs')
const path = require('path')

const { copyDistToProd } = require('@/scripts/prepare-dist-prod')
const { makeTempDir } = require('./cli-test-utils')

describe('prepare-dist-prod', () => {
  let tempRoot

  beforeEach(() => {
    tempRoot = makeTempDir('metravel-prepare-dist-')
  })

  afterEach(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true })
  })

  it('copies dist into dist/prod without nesting the existing prod snapshot', () => {
    const srcDir = path.join(tempRoot, 'dist')
    const destDir = path.join(srcDir, 'prod')

    fs.mkdirSync(path.join(srcDir, 'travels', 'demo-route'), { recursive: true })
    fs.mkdirSync(destDir, { recursive: true })
    fs.writeFileSync(path.join(srcDir, 'index.html'), 'root', 'utf8')
    fs.writeFileSync(path.join(srcDir, 'travels', 'demo-route', 'index.html'), 'travel', 'utf8')
    fs.writeFileSync(path.join(destDir, 'stale.txt'), 'stale', 'utf8')

    copyDistToProd({ srcDir, destDir })

    expect(fs.readFileSync(path.join(destDir, 'index.html'), 'utf8')).toBe('root')
    expect(fs.readFileSync(path.join(destDir, 'travels', 'demo-route', 'index.html'), 'utf8')).toBe('travel')
    expect(fs.existsSync(path.join(destDir, 'prod'))).toBe(false)
    expect(fs.existsSync(path.join(destDir, 'stale.txt'))).toBe(false)
  })

  it('falls back to copying when Windows cannot rename the prepared snapshot', () => {
    const srcDir = path.join(tempRoot, 'dist')
    const destDir = path.join(srcDir, 'prod')
    const originalRenameSync = fs.renameSync

    fs.mkdirSync(srcDir, { recursive: true })
    fs.writeFileSync(path.join(srcDir, 'index.html'), 'root', 'utf8')

    try {
      fs.renameSync = jest.fn(() => {
        throw Object.assign(new Error('locked'), { code: 'EPERM' })
      })

      copyDistToProd({ srcDir, destDir })

      expect(fs.readFileSync(path.join(destDir, 'index.html'), 'utf8')).toBe('root')
    } finally {
      fs.renameSync = originalRenameSync
    }
  })
})
