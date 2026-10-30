import fs from 'fs'
import path from 'path'

import { makeTempDir, removeDir, writeTextFile } from './cli-test-utils'

const { processDirectory } = require('@/scripts/add-cache-bust-meta')

describe('add-cache-bust-meta', () => {
  let distDir: string

  beforeEach(() => {
    distDir = makeTempDir('add-cache-bust-meta-')
  })

  afterEach(() => {
    jest.restoreAllMocks()
    removeDir(distDir)
  })

  function writePair(html: string) {
    const flat = path.join(distDir, 'quest.html')
    const index = path.join(distDir, 'quest', 'index.html')
    writeTextFile(flat, html)
    fs.mkdirSync(path.dirname(index))
    fs.linkSync(flat, index)
    return { flat, index }
  }

  it('preserves immutable book document hashes while app shells get build metadata', () => {
    const guide = path.join(distDir, 'travel-books', 'belarus-memory', 'revision-one', 'album-a5', 'instructions.html')
    const html = '<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>Печать</title><meta name="robots" content="noindex,nofollow"><style>body{max-width:72ch}</style></head><body>Инструкция</body></html>'
    writeTextFile(guide, html)
    const app = path.join(distDir, 'books', 'index.html')
    writeTextFile(app, '<html><head><meta charset="utf-8"><title>Книги</title><meta name="description" content="Книги"></head><body></body></html>')
    const before = fs.readFileSync(guide)
    expect(processDirectory(distDir)).toEqual([app])
    const {externalizeDist} = require('@/scripts/externalize-head-styles')
    externalizeDist(distDir)
    expect(fs.readFileSync(guide)).toEqual(before)
    expect(fs.readFileSync(app, 'utf8')).toContain('name="build-version"')
    expect(require('@/scripts/guard-html-meta-description').checkDist(distDir).ok).toBe(true)
  })

  it('normalizes shared HTML bytes once and still reports both routes and a separate identical file', () => {
    const html = '<html><head><title>Квест</title><meta charset="utf-8"/></head><body>Путь</body></html>'
    const { flat, index } = writePair(html)
    const independent = path.join(distDir, 'independent.html')
    writeTextFile(independent, html)
    const read = jest.spyOn(fs, 'readFileSync')
    const write = jest.spyOn(fs, 'writeFileSync')

    expect(processDirectory(distDir).sort()).toEqual([flat, index, independent].sort())
    expect(read).toHaveBeenCalledTimes(2)
    expect(read.mock.results.reduce((sum, result) => sum + Buffer.byteLength(String(result.value)), 0)).toBe(2 * Buffer.byteLength(html))
    expect(write).toHaveBeenCalledTimes(2)
    const output = fs.readFileSync(flat, 'utf8')
    const version = /<meta name="build-version" content="(v\d+)">/.exec(output)?.[1]
    expect(version).toBeDefined()
    expect(output).toBe('<html><head><meta charset="utf-8"/><title>Квест</title>\n' +
      '  <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">\n' +
      '  <meta http-equiv="Pragma" content="no-cache">\n' +
      '  <meta http-equiv="Expires" content="0">\n' +
      `  <meta name="build-version" content="${version}">\n</head><body>Путь</body></html>`)
    expect((output.match(/charset=/g) || []).length).toBe(1)
    expect(fs.readFileSync(index, 'utf8')).toBe(output)
    expect(fs.readFileSync(independent, 'utf8')).toBe(output)
    expect(fs.statSync(flat).ino).toBe(fs.statSync(index).ino)
    expect(fs.statSync(flat).ino).not.toBe(fs.statSync(independent).ino)
  })

  it('keeps the existing build version and only applies the prior charset normalization', () => {
    const { flat, index } = writePair('<html><head><title>Уже собрано</title><meta charset="utf-8"/><meta name="build-version" content="v123"></head><body></body></html>')
    const expected = '<html><head><meta charset="utf-8"/><title>Уже собрано</title><meta name="build-version" content="v123"></head><body></body></html>'
    const write = jest.spyOn(fs, 'writeFileSync')

    expect(processDirectory(distDir).sort()).toEqual([flat, index].sort())
    expect(write).toHaveBeenCalledTimes(1)
    expect(fs.readFileSync(flat, 'utf8')).toBe(expected)
    expect(fs.readFileSync(index, 'utf8')).toBe(expected)
  })

  it('allows another alias to retry after a failed write', () => {
    const { flat, index } = writePair('<html><head><meta charset="utf-8"/></head></html>')
    const write = jest.spyOn(fs, 'writeFileSync').mockImplementationOnce(() => { throw new Error('write failed') })
    const error = jest.spyOn(console, 'error').mockImplementation(() => undefined)

    const processed = processDirectory(distDir)
    expect(processed).toHaveLength(1)
    expect([flat, index]).toContain(processed[0])
    expect(write).toHaveBeenCalledTimes(2)
    expect(error).toHaveBeenCalledTimes(1)
    expect(fs.readFileSync(flat, 'utf8')).toContain('name="build-version"')
    expect(fs.readFileSync(index, 'utf8')).toBe(fs.readFileSync(flat, 'utf8'))
  })

  it('keeps symlink aliases and unreadable-entry warnings without changing headless files', () => {
    const file = path.join(distDir, 'index.html')
    const alias = path.join(distDir, 'alias.html')
    writeTextFile(file, '<html><head><meta charset="utf-8"/></head></html>')
    fs.symlinkSync(file, alias)
    fs.symlinkSync(path.join(distDir, 'missing'), path.join(distDir, 'dangling.html'))
    const headless = path.join(distDir, 'headless.html')
    writeTextFile(headless, '<body>Содержимое</body>')
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined)

    expect(processDirectory(distDir).sort()).toEqual([file, alias].sort())
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('dangling.html'))
    expect(fs.readFileSync(headless, 'utf8')).toBe('<body>Содержимое</body>')
  })
})
