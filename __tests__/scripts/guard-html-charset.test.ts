import fs from 'fs'
import path from 'path'

import { makeTempDir, removeDir, runCli, writeTextFile } from './cli-test-utils'

const { checkDist, PRESCAN_BYTES } = require('@/scripts/guard-html-charset')

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

  afterEach(() => removeDir(distDir))

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
