/** @jest-environment node */
import fs from 'fs'
import path from 'path'
import { makeTempDir, removeDir, runCli } from './cli-test-utils'
const { writePairedPage, travelStaticPagePaths, assertTravelStaticPagesComplete } = require('@/scripts/generate-seo-pages')

const pair = (directory: string, family: string) => family === 'travels'
  ? travelStaticPagePaths(directory, 'example')
  : [path.join(directory, family, 'example.html'), path.join(directory, family, 'example/index.html')]
const sameAllocation = ([flat, index]: string[], expected: string) => {
  const a = fs.statSync(flat)
  const b = fs.statSync(index)
  expect(fs.readFileSync(flat, 'utf8')).toBe(expected)
  expect(fs.readFileSync(index, 'utf8')).toBe(expected)
  expect([a.dev, a.ino]).toEqual([b.dev, b.ino])
  expect(a.nlink).toBeGreaterThanOrEqual(2)
  return a
}

describe('paired static HTML storage', () => {
  it.each(['travels', 'quests/city', 'article'])('%s stores one allocation and atomically replaces both names on rerun', (family) => {
    const root = makeTempDir('seo-paired-page-')
    try {
      const paths = pair(root, family)
      writePairedPage(...paths, 'first page')
      const previous = sameAllocation(paths, 'first page')
      // Simulate a reused release holding another link to the old inode.
      const oldRelease = path.join(root, 'previous-release.html')
      fs.linkSync(paths[0], oldRelease)
      writePairedPage(...paths, 'new page')
      const next = sameAllocation(paths, 'new page')
      expect(next.ino).not.toBe(previous.ino)
      expect(fs.readFileSync(oldRelease, 'utf8')).toBe('first page')
      expect(fs.readdirSync(path.dirname(paths[1])).filter((name) => name.endsWith('.tmp'))).toEqual([])
      if (family === 'travels') expect(assertTravelStaticPagesComplete([{ id: 1, slug: 'example' }], root)).toEqual({ expected: 1, missing: 0 })
    } finally { removeDir(root) }
  })

  it('fails closed if linking fails, without publishing a changed canonical file or copy fallback', () => {
    const root = makeTempDir('seo-link-failure-')
    try {
      const paths = pair(root, 'travels')
      writePairedPage(...paths, 'old page')
      const link = jest.spyOn(fs, 'linkSync').mockImplementationOnce(() => { throw Object.assign(new Error('different filesystem'), { code: 'EXDEV' }) })
      try { expect(() => writePairedPage(...paths, 'new page')).toThrow('different filesystem') }
      finally { link.mockRestore() }
      sameAllocation(paths, 'old page')
      expect(fs.readdirSync(path.dirname(paths[0])).filter((name) => name.endsWith('.tmp'))).toEqual([])
    } finally { removeDir(root) }
  })

  it('real upload, normal rename and recovery rsync staging preserve shared inode/allocation', () => {
    const root = makeTempDir('seo-link-transport-')
    try {
      const original = path.join(root, 'original')
      const incoming = path.join(root, 'incoming')
      const liveBasis = path.join(root, 'live-basis')
      const normalStage = path.join(root, 'normal-stage')
      const staged = path.join(root, 'recovery-stage')
      const text = '<html>' + 'body'.repeat(65536) + '</html>'
      writePairedPage(...pair(original, 'travels'), text)
      const basisPaths = pair(liveBasis, 'travels')
      fs.mkdirSync(path.dirname(basisPaths[1]), { recursive: true })
      const sourceTime = fs.statSync(pair(original, 'travels')[0]).mtime
      for (const file of basisPaths) {
        fs.writeFileSync(file, text)
        fs.utimesSync(file, sourceTime, sourceTime)
      }
      fs.mkdirSync(incoming)
      const transfer = runCli('rsync', ['-aH', `--copy-dest=${liveBasis}`, `${original}/`, `${incoming}/`])
      expect(transfer.status).toBe(0)
      const received = sameAllocation(pair(incoming, 'travels'), text)
      expect(received.ino).not.toBe(fs.statSync(basisPaths[0]).ino)
      expect(runCli('mv', [incoming, normalStage]).status).toBe(0)
      sameAllocation(pair(normalStage, 'travels'), text)
      fs.mkdirSync(staged)
      expect(runCli('rsync', ['-aH', `${normalStage}/`, `${staged}/`]).status).toBe(0)
      const inode = sameAllocation(pair(staged, 'travels'), text)
      // Counting unique inodes gives one payload's blocks, while summing each
      // served name double-counts it. The OS reports the actual allocation.
      const paths = pair(staged, 'travels')
      const individualBlocks = paths.reduce((sum: number, file: string) => sum + fs.statSync(file).blocks, 0)
      expect(individualBlocks).toBe(inode.blocks * 2)
      expect(inode.blocks).toBeGreaterThan(0)
    } finally { removeDir(root) }
  })

  it('preserves SSG links through both publication transports', () => {
    expect(fs.readFileSync(path.resolve('build-prod.sh'), 'utf8')).toContain('rsync -azHhe "ssh"')
    expect(fs.readFileSync(path.resolve('scripts/fix-prod.sh'), 'utf8')).toContain('rsync -avzHhe "ssh"')
  })
})
