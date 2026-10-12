/**
 * #2389: on web, metro.config.js resolves sanitize-html's own `postcss` import
 * to metro-stubs/sanitize-html-postcss.js, which throws if called. That is safe
 * only while no sanitize-html call reaches postcss: a caller that allows the
 * `style` attribute must pass `parseStyleAttributes: false` and filter style
 * itself (utils/richTextStyleFilter.ts). The known callers are listed here, so
 * a new one fails this test and gets the same check instead of silently losing
 * styles on web.
 */

import fs from 'fs'
import path from 'path'

const ROOT = path.resolve(__dirname, '..', '..')
const STUB_REL = 'metro-stubs/sanitize-html-postcss.js'
const SOURCE_DIRS = ['api', 'app', 'components', 'context', 'hooks', 'screens', 'services', 'stores', 'utils']
const SANITIZE_HTML_IMPORT_RE = /from\s+['"]sanitize-html['"]|require\(\s*['"]sanitize-html['"]\s*\)/

const listSourceFiles = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return listSourceFiles(full)
    return /\.(ts|tsx|js|jsx)$/.test(entry.name) ? [full] : []
  })

describe('sanitize-html postcss web stub (#2389)', () => {
  let resolveRequest: (ctx: any, name: string, platform: string) => any

  beforeAll(() => {
    jest.resetModules()
    resolveRequest = require(path.join(ROOT, 'metro.config.js'))?.resolver?.resolveRequest
  })

  const ctxFrom = (originModulePath: string) => ({
    originModulePath,
    customResolverOptions: { environment: 'client' },
    resolveRequest: (_c: any, name: string) => ({ filePath: `ORIG:${name}`, type: 'sourceFile' }),
  })
  const sanitizeHtmlOrigin = path.join(ROOT, 'node_modules', 'sanitize-html', 'index.js')

  it('routes only sanitize-html’s own web postcss import to the stub', () => {
    const stubbed = resolveRequest(ctxFrom(sanitizeHtmlOrigin), 'postcss', 'web')
    expect(stubbed.filePath.replace(/\\/g, '/').endsWith(STUB_REL)).toBe(true)

    expect(resolveRequest(ctxFrom(path.join(ROOT, 'utils', 'any.ts')), 'postcss', 'web').filePath).toBe('ORIG:postcss')
    expect(resolveRequest(ctxFrom(sanitizeHtmlOrigin), 'postcss', 'ios').filePath).toBe('ORIG:postcss')
    expect(resolveRequest(ctxFrom(sanitizeHtmlOrigin), 'htmlparser2', 'web').filePath).toBe('ORIG:htmlparser2')
  })

  it('stub stays the only thing sanitize-html takes from postcss', () => {
    const source = fs.readFileSync(path.join(ROOT, 'node_modules', 'sanitize-html', 'index.js'), 'utf8')
    expect(source.match(/require\(['"]postcss['"]\)/g)).toEqual(["require('postcss')"])
    expect(source).toContain("const { parse: postcssParse } = require('postcss')")
    expect(() => require(path.join(ROOT, STUB_REL)).parse('p {color:red}')).toThrow()
  })

  it('lists every sanitize-html caller in app source', () => {
    const callers = SOURCE_DIRS.flatMap((dir) => listSourceFiles(path.join(ROOT, dir)))
      .filter((file) => SANITIZE_HTML_IMPORT_RE.test(fs.readFileSync(file, 'utf8')))
      .map((file) => path.relative(ROOT, file).replace(/\\/g, '/'))
      .sort()
    expect(callers).toEqual(['utils/articleEditorSanitize.ts', 'utils/sanitizeRichText.ts'])
  })

  describe('with postcss replaced by the web stub', () => {
    let sanitizeRichText: (html: string) => string
    let sanitizeArticleEditorHtml: (html: string) => string
    let warn: jest.SpyInstance

    beforeAll(() => {
      jest.resetModules()
      jest.doMock('postcss', () => require(path.join(ROOT, STUB_REL)))
      sanitizeRichText = require('@/utils/sanitizeRichText').sanitizeRichText
      sanitizeArticleEditorHtml = require('@/utils/articleEditorSanitize').sanitizeArticleEditorHtml
    })
    afterAll(() => {
      jest.dontMock('postcss')
      jest.resetModules()
    })
    beforeEach(() => {
      warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    })
    afterEach(() => {
      // sanitize-html warns exactly when it reaches postcss and the stub throws.
      expect(warn).not.toHaveBeenCalled()
      warn.mockRestore()
    })

    it('sanitizeRichText keeps allowed styles without postcss', () => {
      expect(sanitizeRichText('<p style="text-align: center; position: fixed; color: #333 !important">t</p>')).toBe(
        '<p style="text-align:center;color:#333 !important">t</p>',
      )
    })

    it('sanitizeArticleEditorHtml never allows style, so never reaches postcss', () => {
      expect(sanitizeArticleEditorHtml('<p>a<span style="color:#000">b</span></p>')).not.toContain('style')
    })
  })
})
