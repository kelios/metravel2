import fs from 'node:fs'
import path from 'node:path'
import { makeTempDir, removeDir } from './cli-test-utils'

const { appShellState, prepareNotFoundDocumentBoot, readNotFoundRegistrationBootChunks } = require('@/scripts/lib/expoStaticShell')
const WEB = '/_expo/static/js/web/'
const tag = (name: string) => `<script src="${WEB}${name}" defer></script>`
const page = (names: string[]) => `<html><head>${names.map(tag).join('')}</head><body><script>globalThis.__EXPO_ROUTER_HYDRATE__=true;</script><div id="root"><main id="static-not-found">404<!--$--><!--/$--></main></div></body></html>`
const ROOT = '_layout-aa.js', TABS = '_layout-bb.js', EDITOR = 'new-cc.js', DEP = '__shared-0-dd.js', NESTED = '__shared-1-ee.js'

describe('NotFound route registration boot (#2701)', () => {
  let dir: string, jsDir: string
  const write = (name: string, deps: string[] = []) => fs.writeFileSync(path.join(jsDir, name),
    `globalThis.__METRAVEL_CHUNK_DEPS__??={};globalThis.__METRAVEL_CHUNK_DEPS__["${WEB}${name}"]=${JSON.stringify(deps.map(dep => WEB + dep))};__d(function(){},1,[]);`)
  beforeEach(() => {
    dir = makeTempDir('not-found-boot-')
    jsDir = path.join(dir, '_expo/static/js/web')
    fs.mkdirSync(jsDir, { recursive: true })
    fs.mkdirSync(path.join(dir, 'travel'))
    write(DEP); write(NESTED, [DEP]); write(ROOT, [DEP]); write(TABS, [NESTED]); write(EDITOR)
    write('_layout-ff.js', ['unrelated-ff.js']) // retained generation, deliberately incomplete
    fs.writeFileSync(path.join(dir, 'travel/new.html'), page([DEP, ROOT, TABS, EDITOR, 'entry-ab.js']))
    for (const name of ['+not-found.html', '[...missing].html']) fs.writeFileSync(path.join(dir, name), page([DEP, ROOT, 'entry-ab.js']))
  })
  afterEach(() => removeDir(dir))

  it('selects only authoritative layout wrappers and the full dependency closure, never the editor leaf or retained chunks', () => {
    const html = fs.readFileSync(path.join(dir, 'travel/new.html'), 'utf8')
    expect(readNotFoundRegistrationBootChunks(jsDir, html)).toEqual([DEP, ROOT, NESTED, TABS].map(name => WEB + name))
  })

  it('ships cold layout/dependencies exactly once before entry while preserving hydration, root markup and Suspense', () => {
    const baseline = fs.readFileSync(path.join(dir, '+not-found.html'), 'utf8')
    const body = baseline.slice(baseline.indexOf('<body>'))
    prepareNotFoundDocumentBoot(dir)
    for (const name of ['+not-found.html', '[...missing].html']) {
      const html = fs.readFileSync(path.join(dir, name), 'utf8')
      const document = new DOMParser().parseFromString(html, 'text/html')
      expect([...document.head.querySelectorAll('script[src]')].map(node => node.getAttribute('src')))
        .toEqual([DEP, ROOT, NESTED, TABS, 'entry-ab.js'].map(chunk => WEB + chunk))
      expect(html.slice(html.indexOf('<body>'))).toBe(body)
      expect(appShellState(html)).toEqual({ hydrates: true, roots: 1, emptyRoots: 0 })
      expect(html).not.toContain(WEB + EDITOR)
      expect(html).not.toContain('_layout-ff.js')
      prepareNotFoundDocumentBoot(dir)
      expect(fs.readFileSync(path.join(dir, name), 'utf8')).toBe(html)
    }
  })

  it.each([ROOT, TABS, DEP, NESTED])('fails closed before changing any document when selected asset %s is absent', missing => {
    const baseline = fs.readFileSync(path.join(dir, '+not-found.html'), 'utf8')
    fs.unlinkSync(path.join(jsDir, missing))
    expect(() => prepareNotFoundDocumentBoot(dir)).toThrow()
    expect(fs.readFileSync(path.join(dir, '+not-found.html'), 'utf8')).toBe(baseline)
  })

  it('rejects a pending-layout delivery contract: no Tabs wrapper, a cycle, invalid path or a non-deferred layout', () => {
    expect(() => readNotFoundRegistrationBootChunks(jsDir, page([ROOT, 'entry-ab.js']))).toThrow(/root and Tabs/)
    write(NESTED, [TABS])
    expect(() => prepareNotFoundDocumentBoot(dir)).toThrow(/cyclic/)
    write(NESTED, ['../invalid.js'])
    expect(() => prepareNotFoundDocumentBoot(dir)).toThrow(/invalid boot chunk path/)
    expect(() => readNotFoundRegistrationBootChunks(jsDir, page([ROOT, TABS, 'entry-ab.js']).replace(' defer', ' async'))).toThrow(/classic defer/)
  })

  it('validates both canonical documents before writing and rejects dependencies after their layout', () => {
    const baseline = fs.readFileSync(path.join(dir, '+not-found.html'), 'utf8')
    fs.writeFileSync(path.join(dir, '[...missing].html'), page([ROOT, TABS, DEP, NESTED, 'entry-ab.js']))
    expect(() => prepareNotFoundDocumentBoot(dir)).toThrow(/must precede/)
    expect(fs.readFileSync(path.join(dir, '+not-found.html'), 'utf8')).toBe(baseline)
  })
})
