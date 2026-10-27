import fs from 'fs'
import path from 'path'

import { makeTempDir, removeDir, runCli, writeTextFile } from './cli-test-utils'

const { checkDist } = require('@/scripts/guard-html-meta-description')
const { countMetaDescriptions, normalizeMetaDescription } = require('@/scripts/lib/htmlMetaDescription')
const { processDirectory } = require('@/scripts/add-cache-bust-meta')

const repoRoot = process.cwd()
const scriptPath = path.join(repoRoot, 'scripts/guard-html-meta-description.js')

const PAGE_DESCRIPTION = '<meta data-rh="true" name="description" content="Скачайте мобильное приложение MeTravel"/>'
const SHELL_DESCRIPTION = '<meta name="description" content="Маршруты, заметки и фото путешествий по Беларуси"/>'

// Shape of the Expo static export for /app on prod (#2689): Helmet tags first,
// then the app/+html.tsx shell with its site-wide default description.
function exportedPage(...descriptions: string[]) {
  return `<html><head><title data-rh="true">Приложение</title>${descriptions[0] ?? ''}<meta charset="utf-8"/>${descriptions.slice(1).join('')}<meta name="robots" content="index"/></head><body></body></html>`
}

// #2689: /app shipped two descriptions because only routes owned by the SEO
// generator (now scripts/postprocess-route-shells.js) had the shell default replaced.
describe('htmlMetaDescription', () => {
  it('keeps the page-owned Helmet description and drops the shell default', () => {
    const html = normalizeMetaDescription(exportedPage(PAGE_DESCRIPTION, SHELL_DESCRIPTION))
    expect(countMetaDescriptions(html)).toBe(1)
    expect(html).toContain(PAGE_DESCRIPTION)
    expect(html).not.toContain(SHELL_DESCRIPTION)
    expect(html).toContain('<meta charset="utf-8"/>')
    expect(html).toContain('<meta name="robots" content="index"/>')
  })

  it('keeps the page-owned description when it comes after the default', () => {
    const html = normalizeMetaDescription(exportedPage(SHELL_DESCRIPTION, PAGE_DESCRIPTION))
    expect(countMetaDescriptions(html)).toBe(1)
    expect(html).toContain(PAGE_DESCRIPTION)
  })

  it('keeps the shell default on a route without its own description', () => {
    const html = exportedPage(SHELL_DESCRIPTION)
    expect(normalizeMetaDescription(html)).toBe(html)
  })

  it('keeps the first of several descriptions when no page owns one', () => {
    const second = '<meta name="description" content="второй"/>'
    const html = normalizeMetaDescription(exportedPage(SHELL_DESCRIPTION, second))
    expect(countMetaDescriptions(html)).toBe(1)
    expect(html).toContain(SHELL_DESCRIPTION)
  })

  it('matches single-quoted and differently cased name attributes', () => {
    const shell = "<meta NAME='Description' content='default'>"
    const html = normalizeMetaDescription(exportedPage(shell, PAGE_DESCRIPTION))
    expect(countMetaDescriptions(html)).toBe(1)
    expect(html).toContain(PAGE_DESCRIPTION)
    expect(html).not.toContain(shell)
  })

  it('does not touch og:description, twitter:description or similarly named metas', () => {
    const others =
      '<meta data-rh="true" property="og:description" content="og"/>' +
      '<meta data-rh="true" name="twitter:description" content="tw"/>' +
      '<meta name="description-extra" content="x"/>'
    const html = normalizeMetaDescription(exportedPage(PAGE_DESCRIPTION, SHELL_DESCRIPTION, others))
    expect(html).toContain(others)
    expect(countMetaDescriptions(html)).toBe(1)
  })
})

describe('guard-html-meta-description', () => {
  let distDir: string

  beforeEach(() => {
    distDir = makeTempDir('guard-html-meta-description-')
  })

  afterEach(() => {
    jest.restoreAllMocks()
    removeDir(distDir)
  })

  it('passes when every HTML file has exactly one description', () => {
    writeTextFile(path.join(distDir, 'index.html'), exportedPage(PAGE_DESCRIPTION))
    writeTextFile(path.join(distDir, 'quests', 'index.html'), exportedPage(SHELL_DESCRIPTION))
    expect(checkDist(distDir)).toEqual({ ok: true, total: 2, violations: [] })
  })

  it('fails and names the file that ships a duplicate or no description', () => {
    writeTextFile(path.join(distDir, 'index.html'), exportedPage(PAGE_DESCRIPTION))
    writeTextFile(path.join(distDir, 'app.html'), exportedPage(PAGE_DESCRIPTION, SHELL_DESCRIPTION))
    writeTextFile(path.join(distDir, 'empty.html'), exportedPage())

    expect(checkDist(distDir)).toEqual({
      ok: false,
      total: 3,
      violations: [
        { file: 'app.html', count: 2, titles: 1 },
        { file: 'empty.html', count: 0, titles: 1 },
      ],
    })

    const cli = runCli(process.execPath, [scriptPath, '--dist', distDir])
    expect(cli.status).toBe(1)
    expect(cli.stderr).toContain('app.html: description=2, title=1')
    expect(cli.stderr).toContain('empty.html: description=0, title=1')
  })

  // #2740: the exported <title> comes from each route's generateMetadata; the
  // router-server bridge patch that re-inserted helmet output is gone.
  it('fails an indexable page that ships no, an empty or two <title> tags', () => {
    writeTextFile(path.join(distDir, 'no-title.html'), `<html><head>${PAGE_DESCRIPTION}</head><body></body></html>`)
    writeTextFile(path.join(distDir, 'empty-title.html'), `<html><head><title> </title>${PAGE_DESCRIPTION}</head><body></body></html>`)
    writeTextFile(path.join(distDir, 'two-titles.html'), `<html><head><title>A</title><title data-rh="true">B</title>${PAGE_DESCRIPTION}</head><body></body></html>`)
    writeTextFile(path.join(distDir, 'ok.html'), exportedPage(PAGE_DESCRIPTION))
    writeTextFile(
      path.join(distDir, 'noindex-stub.html'),
      '<html><head><meta name="robots" content="noindex, follow"/><meta http-equiv="refresh" content="0; url=/x"/></head><body></body></html>',
    )

    expect(checkDist(distDir).violations).toEqual([
      { file: 'empty-title.html', count: 1, titles: 1 },
      { file: 'no-title.html', count: 1, titles: 0 },
      { file: 'two-titles.html', count: 1, titles: 2 },
    ])
  })

  it('passes the exported duplicate after the last full dist pass normalizes it', () => {
    writeTextFile(path.join(distDir, 'app.html'), exportedPage(PAGE_DESCRIPTION, SHELL_DESCRIPTION))
    jest.spyOn(console, 'error').mockImplementation(() => {})
    processDirectory(distDir)

    expect(checkDist(distDir).ok).toBe(true)
    expect(fs.readFileSync(path.join(distDir, 'app.html'), 'utf8')).toContain(PAGE_DESCRIPTION)
    expect(runCli(process.execPath, [scriptPath, '--dist', distDir]).status).toBe(0)
  })

  // Prod build 500bbac26: 531 files with zero descriptions — redirect stubs of
  // old travel slugs and quest-seo-errors/* — all noindex by contract.
  it('allows a noindex page without a description but never a duplicate on it', () => {
    writeTextFile(
      path.join(distDir, 'travels', 'old-slug.html'),
      '<html><head><meta charset="utf-8"/><meta name="robots" content="noindex, follow"/><meta http-equiv="refresh" content="0; url=/travels/new"/></head><body></body></html>',
    )
    writeTextFile(
      path.join(distDir, 'quest-seo-errors', 'ru', 'unavailable.html'),
      `<html><head><meta content='NOINDEX' name='robots'/></head><body></body></html>`,
    )
    writeTextFile(
      path.join(distDir, 'travels', 'missing.html'),
      `<html><head><meta data-rh="true" name="robots" content="noindex, follow"/>${PAGE_DESCRIPTION}${SHELL_DESCRIPTION}</head><body></body></html>`,
    )
    writeTextFile(
      path.join(distDir, 'indexable.html'),
      '<html><head><meta name="robots" content="index, follow"/></head><body></body></html>',
    )

    expect(checkDist(distDir).violations).toEqual([
      { file: 'indexable.html', count: 0, titles: 0 },
      { file: 'travels/missing.html', count: 2, titles: 0 },
    ])
  })

  it('fails on a dist without HTML instead of passing vacuously', () => {
    expect(() => checkDist(distDir)).toThrow(/no HTML files/)
  })

  it('is wired into both prod build pipelines after the normalizing pass', () => {
    const buildWebProd = fs.readFileSync(path.join(repoRoot, 'scripts/build-web-prod.js'), 'utf8')
    const addIdx = buildWebProd.indexOf("'scripts/add-cache-bust-meta.js'")
    expect(addIdx).toBeGreaterThan(-1)
    expect(buildWebProd.indexOf("'scripts/guard-html-meta-description.js'")).toBeGreaterThan(addIdx)

    const buildProdSh = fs.readFileSync(path.join(repoRoot, 'build-prod.sh'), 'utf8')
    const addShIdx = buildProdSh.indexOf('scripts/add-cache-bust-meta.js')
    expect(addShIdx).toBeGreaterThan(-1)
    expect(buildProdSh.indexOf('scripts/guard-html-meta-description.js')).toBeGreaterThan(addShIdx)
  })
})
