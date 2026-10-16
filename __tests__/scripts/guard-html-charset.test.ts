import fs from 'fs'
import path from 'path'

import { makeTempDir, removeDir, runCli, writeTextFile } from './cli-test-utils'

const { checkDist, hasCharsetWithinPrescan, PRESCAN_BYTES } = require('@/scripts/guard-html-charset')

const repoRoot = process.cwd()
const scriptPath = path.join(repoRoot, 'scripts/guard-html-charset.js')

// #2088: dist/prod is guarded so a build cannot ship a page whose
// <meta charset> declaration sits past the 1024-byte window the browser
// scans to sniff encoding.
describe('guard-html-charset', () => {
  let distDir: string

  beforeEach(() => {
    distDir = makeTempDir('guard-html-charset-')
  })

  afterEach(() => {
    jest.restoreAllMocks()
    removeDir(distDir)
  })

  it('passes when every HTML file declares charset within the prescan window', () => {
    writeTextFile(path.join(distDir, 'index.html'), '<html><head><meta charset="utf-8"/><title>x</title></head><body></body></html>')
    writeTextFile(
      path.join(distDir, 'travels', 'terms', 'index.html'),
      '<html><head><meta charset="utf-8"/><title>Условия</title></head><body></body></html>',
    )
    const result = checkDist(distDir)
    expect(result.ok).toBe(true)
    expect(result.violations).toEqual([])
    expect(result.total).toBe(2)
  })

  it('fails and names the file when charset sits past byte 1024 (Helmet tags first)', () => {
    const filler = 'Очень длинное описание для проверки позиции кодировки в первой тысяче байт. '.repeat(15)
    const bad = `<html><head><title data-rh="true">x</title><meta data-rh="true" name="description" content="${filler}"/><meta charset="utf-8"/></head><body></body></html>`
    expect(Buffer.byteLength(bad.slice(0, bad.search(/charset/i)), 'utf8')).toBeGreaterThan(PRESCAN_BYTES)

    writeTextFile(path.join(distDir, 'terms.html'), bad)
    writeTextFile(path.join(distDir, 'index.html'), '<html><head><meta charset="utf-8"/></head><body></body></html>')

    const result = checkDist(distDir)
    expect(result.ok).toBe(false)
    expect(result.violations).toEqual(['terms.html'])

    const cli = runCli(process.execPath, [scriptPath, '--dist', distDir])
    expect(cli.status).toBe(1)
    expect(cli.stderr).toContain('terms.html')
    expect(cli.stderr).toContain('1024')
  })

  it('fails a file with no charset meta at all', () => {
    writeTextFile(path.join(distDir, 'no-charset.html'), '<html><head><title>x</title></head><body></body></html>')
    expect(checkDist(distDir).violations).toEqual(['no-charset.html'])
  })

  it('does not false-pass a page with no charset meta just because "charset=" appears in an unrelated URL/script early in the file', () => {
    // A stylesheet/font link query string containing "charset=" (or GTM/JSON-LD
    // text doing the same) must not be mistaken for a real <meta charset> —
    // the check has to stay scoped to inside a <meta ...> tag.
    const html =
      '<html><head><title>x</title>' +
      '<link rel="stylesheet" href="https://fonts.example.com/css?family=Roboto&charset=UTF-8">' +
      '</head><body></body></html>'
    writeTextFile(path.join(distDir, 'no-real-charset.html'), html)
    expect(checkDist(distDir).violations).toEqual(['no-real-charset.html'])
  })

  it('recognizes the legacy http-equiv Content-Type form as a valid early charset declaration', () => {
    const html = '<html><head><meta http-equiv="Content-Type" content="text/html; charset=utf-8"><title>x</title></head><body></body></html>'
    writeTextFile(path.join(distDir, 'legacy-content-type.html'), html)
    expect(checkDist(distDir).violations).toEqual([])
  })

  it('checks each hardlinked inode once while reporting every route and violation', () => {
    const flat = path.join(distDir, 'quest.html')
    const index = path.join(distDir, 'quest', 'index.html')
    const independent = path.join(distDir, 'other.html')
    const html = '<html><head><title>Квест</title></head>' + 'x'.repeat(4096)
    writeTextFile(flat, html)
    fs.mkdirSync(path.dirname(index))
    fs.linkSync(flat, index)
    writeTextFile(independent, html)
    const read = jest.spyOn(fs, 'readSync')

    expect(checkDist(distDir)).toEqual({
      ok: false,
      total: 3,
      violations: ['other.html', 'quest/index.html', 'quest.html'],
    })
    expect(read).toHaveBeenCalledTimes(2)
    expect(read.mock.results.reduce((sum, result) => sum + Number(result.value), 0)).toBe(2 * PRESCAN_BYTES)
    expect(fs.statSync(flat).ino).toBe(fs.statSync(index).ino)
    expect(fs.statSync(flat).ino).not.toBe(fs.statSync(independent).ino)
  })

  it('keeps the byte boundary with a multibyte UTF-8 prefix and a clipped declaration', () => {
    const marker = '<meta charset='
    const prefixBytes = PRESCAN_BYTES - Buffer.byteLength(marker)
    const prefix = 'я'.repeat(Math.floor(prefixBytes / 2)) + 'x'.repeat(prefixBytes % 2)
    writeTextFile(path.join(distDir, 'boundary.html'), `${prefix}${marker}"utf-8">`)
    writeTextFile(path.join(distDir, 'clipped.html'), `${prefix}x${marker}"utf-8">`)

    expect(checkDist(distDir)).toEqual({ ok: false, total: 2, violations: ['clipped.html'] })
  })

  it('completes short reads without requesting bytes past the prescan window', () => {
    const file = path.join(distDir, 'short-reads.html')
    writeTextFile(file, 'x'.repeat(1000) + '<meta charset="utf-8">' + 'y'.repeat(5000))
    const read = fs.readSync
    const requests: Array<{ position: number; length: number; bytes: number }> = []
    jest.spyOn(fs, 'readSync').mockImplementation(((fd: number, buffer: Buffer, offset: number, length: number, position: number) => {
      const bytes = read(fd, buffer, offset, Math.min(length, 7), position)
      requests.push({ position, length, bytes })
      return bytes
    }) as never)
    const close = jest.spyOn(fs, 'closeSync')

    expect(hasCharsetWithinPrescan(file)).toBe(true)
    expect(requests.reduce((sum, request) => sum + request.bytes, 0)).toBe(PRESCAN_BYTES)
    expect(requests.every((request) => request.position + request.length <= PRESCAN_BYTES)).toBe(true)
    expect(requests.length).toBeGreaterThan(1)
    expect(close).toHaveBeenCalledTimes(1)
  })

  it('closes the descriptor and propagates a read failure', () => {
    const file = path.join(distDir, 'read-error.html')
    writeTextFile(file, '<meta charset="utf-8">')
    const failure = new Error('read failed')
    const read = jest.spyOn(fs, 'readSync').mockImplementationOnce(() => { throw failure })
    const close = jest.spyOn(fs, 'closeSync')

    expect(() => hasCharsetWithinPrescan(file)).toThrow(failure)
    expect(close).toHaveBeenCalledWith(read.mock.calls[0][0])
  })

  it('propagates a close failure instead of reporting a successful check', () => {
    const file = path.join(distDir, 'close-error.html')
    writeTextFile(file, '<meta charset="utf-8">')
    const close = fs.closeSync
    const failure = new Error('close failed')
    jest.spyOn(fs, 'closeSync').mockImplementationOnce((fd) => {
      close(fd)
      throw failure
    })

    expect(() => checkDist(distDir)).toThrow(failure)
  })

  it('fails on a dist without HTML instead of passing vacuously', () => {
    expect(() => checkDist(distDir)).toThrow(/no HTML files/)
  })

  it('is wired into both prod build pipelines right after the charset fix runs', () => {
    const buildWebProd = fs.readFileSync(path.join(repoRoot, 'scripts/build-web-prod.js'), 'utf8')
    const addIdx = buildWebProd.indexOf("'scripts/add-cache-bust-meta.js'")
    const guardIdx = buildWebProd.indexOf("'scripts/guard-html-charset.js'")
    expect(addIdx).toBeGreaterThan(-1)
    expect(guardIdx).toBeGreaterThan(addIdx)

    const buildProdSh = fs.readFileSync(path.join(repoRoot, 'build-prod.sh'), 'utf8')
    const addShIdx = buildProdSh.indexOf('scripts/add-cache-bust-meta.js')
    const guardShIdx = buildProdSh.indexOf('scripts/guard-html-charset.js')
    expect(addShIdx).toBeGreaterThan(-1)
    expect(guardShIdx).toBeGreaterThan(addShIdx)

    const { scripts } = require('../../package.json')
    expect(scripts['guard:html-charset']).toBe('node scripts/guard-html-charset.js')
  })
})
