const fs = require('fs')
const path = require('path')
const { makeTempDir, removeDir } = require('./cli-test-utils')
const { bootChunkIssues, missingBootChunks, readQuestLocaleBootChunks, shipBootChunks } = require('@/scripts/lib/expoStaticShell')

const WEB = '/_expo/static/js/web/'
const tag = (name: string) => `<script src="${WEB}${name}" defer></script>`
const page = (names: string[]) => `<head>${names.map(tag).join('')}</head>`
const ROUTE = '[...missing]-abc123.js'
const OTHER_ROUTE = '[...missing]-def456.js'
const SHELL = page([ROUTE, 'entry-1.js'])

// #2465: a translated quest member ships its catch-all route and locale catalog.
describe('quest locale boot chunks', () => {
  let dir: string
  const write = (name: string, body = '__d(function(){},1,[]);') => fs.writeFileSync(path.join(dir, name), body)

  beforeEach(() => {
    dir = makeTempDir('boot-chunks-')
    write('[...missing]-abc123.js', `globalThis.__METRAVEL_CHUNK_DEPS__??={};globalThis.__METRAVEL_CHUNK_DEPS__["${WEB}[...missing]-abc123.js"]=["${WEB}__shared-0-aa.js","${WEB}__shared-3-bb.js",7];__d(function(){},2,[]);`)
    for (const name of ['__shared-0-aa.js', '__shared-3-bb.js', 'entry-1.js']) write(name)
    for (const locale of ['pl', 'en']) write(`locale-${locale}-ff00.js`)
    write('locale-plx-ff00.js')
  })
  afterEach(() => removeDir(dir))

  it('reads the catch-all with its path-named dependencies and the locale catalog', () => {
    expect(readQuestLocaleBootChunks(dir, ['pl', 'en'], SHELL).get('pl')).toEqual([
      `${WEB}__shared-0-aa.js`, `${WEB}__shared-3-bb.js`, `${WEB}[...missing]-abc123.js`, `${WEB}locale-pl-ff00.js`,
    ])
  })

  it('ignores another same-basename route generation when the authoritative page selects only one', () => {
    write(OTHER_ROUTE, 'x'.repeat(2500))
    expect(readQuestLocaleBootChunks(dir, ['pl'], SHELL).get('pl')).toEqual([
      `${WEB}__shared-0-aa.js`, `${WEB}__shared-3-bb.js`, `${WEB}${ROUTE}`, `${WEB}locale-pl-ff00.js`,
    ])
  })

  it('selects every route named by the page in page order, deduplicating dependencies and route references', () => {
    write(OTHER_ROUTE, `globalThis.__METRAVEL_CHUNK_DEPS__??={};globalThis.__METRAVEL_CHUNK_DEPS__["${WEB}${OTHER_ROUTE}"]=["${WEB}__shared-3-bb.js","${WEB}${ROUTE}"];__d(function(){},3,[]);`)
    expect(readQuestLocaleBootChunks(dir, ['pl'], page([OTHER_ROUTE, ROUTE, OTHER_ROUTE, 'entry-1.js'])).get('pl')).toEqual([
      `${WEB}__shared-3-bb.js`, `${WEB}__shared-0-aa.js`, `${WEB}${OTHER_ROUTE}`, `${WEB}${ROUTE}`, `${WEB}locale-pl-ff00.js`,
    ])
  })

  it('fails closed on an absent authoritative page, no selected route or absent locale catalog', () => {
    expect(() => readQuestLocaleBootChunks(dir, ['pl'])).toThrow(/exported catch-all HTML/)
    expect(() => readQuestLocaleBootChunks(dir, ['pl'], '')).toThrow(/exported catch-all HTML/)
    expect(() => readQuestLocaleBootChunks(dir, ['pl'], page(['entry-1.js']))).toThrow(/no \[\.\.\.missing\] route scripts/)
    expect(() => readQuestLocaleBootChunks(dir, ['be'], SHELL)).toThrow(/expected one locale-be web chunk, found 0/)
  })

  it.each([ROUTE, '__shared-3-bb.js', 'locale-pl-ff00.js'])('rejects a missing selected asset %s', (name) => {
    fs.unlinkSync(path.join(dir, name))
    expect(() => readQuestLocaleBootChunks(dir, ['pl'], SHELL)).toThrow()
  })

  it('checks a page against the chunks it names, not the directory', () => {
    const route = fs.readFileSync(path.join(dir, '[...missing]-abc123.js'), 'utf8')
    const read = (src: string) => (src.endsWith('[...missing]-abc123.js') ? route : '')
    expect(bootChunkIssues(page(['__shared-0-aa.js', '__shared-3-bb.js', '[...missing]-abc123.js', 'locale-pl-ff00.js', 'entry-1.js']), 'pl', read)).toEqual([])
    expect(bootChunkIssues(page(['__shared-0-aa.js', '[...missing]-abc123.js', 'entry-1.js']), 'pl', read)).toEqual([
      'does not ship the locale-pl chunk', `does not ship boot chunk ${WEB}__shared-3-bb.js`,
    ])
    expect(bootChunkIssues(page(['entry-1.js', '__shared-0-aa.js', '__shared-3-bb.js', '[...missing]-abc123.js', 'locale-pl-ff00.js']), 'pl', read))
      .toEqual(['__shared-0-aa.js', '__shared-3-bb.js', ROUTE, 'locale-pl-ff00.js'].map((name) => `loads boot chunk ${WEB}${name} after entry`))
    expect(bootChunkIssues(page(['entry-1.js']), 'pl', read)).toEqual(['does not ship the [...missing] route chunk'])
  })

  it('checks the dependencies of every route and all boot script positions, including duplicates', () => {
    write(OTHER_ROUTE, `globalThis.__METRAVEL_CHUNK_DEPS__??={};globalThis.__METRAVEL_CHUNK_DEPS__["${WEB}${OTHER_ROUTE}"]=["${WEB}__shared-4-cc.js"];__d(function(){},3,[]);`)
    write('__shared-4-cc.js')
    const read = (src: string) => fs.readFileSync(path.join(dir, src.slice(WEB.length)), 'utf8')
    const healthy = ['__shared-0-aa.js', '__shared-3-bb.js', '__shared-4-cc.js', ROUTE, OTHER_ROUTE, 'locale-pl-ff00.js', 'entry-1.js']
    expect(bootChunkIssues(page(healthy), 'pl', read)).toEqual([])
    expect(bootChunkIssues(page(healthy.filter((name) => name !== '__shared-4-cc.js')), 'pl', read)).toContain(`does not ship boot chunk ${WEB}__shared-4-cc.js`)
    expect(bootChunkIssues(page([...healthy, OTHER_ROUTE]), 'pl', read)).toContain(`duplicates boot chunk ${WEB}${OTHER_ROUTE}`)
    expect(bootChunkIssues(page([...healthy.filter((name) => name !== OTHER_ROUTE), OTHER_ROUTE]), 'pl', read)).toContain(`loads boot chunk ${WEB}${OTHER_ROUTE} after entry`)
    expect(bootChunkIssues(page([...healthy.filter((name) => name !== '__shared-4-cc.js'), '__shared-4-cc.js']), 'pl', read)).toContain(`loads boot chunk ${WEB}__shared-4-cc.js after entry`)
    expect(bootChunkIssues(page([...healthy.filter((name) => name !== 'locale-pl-ff00.js'), 'locale-pl-ff00.js']), 'pl', read)).toContain(`loads boot chunk ${WEB}locale-pl-ff00.js after entry`)
    fs.unlinkSync(path.join(dir, OTHER_ROUTE))
    expect(() => bootChunkIssues(page(healthy), 'pl', read)).toThrow()
  })

  it('inserts only the missing scripts, in order, right before entry', () => {
    const html = `<head><script src="${WEB}__shared-0-aa.js" defer></script><script src="${WEB}entry-1.js" defer></script></head>`
    const srcs = [`${WEB}__shared-0-aa.js`, `${WEB}__shared-3-bb.js`, `${WEB}locale-pl-ff00.js`]
    const shipped = shipBootChunks(html, srcs)
    expect(shipped).toBe(`<head><script src="${WEB}__shared-0-aa.js" defer></script>`
      + `<script src="${WEB}__shared-3-bb.js" defer></script><script src="${WEB}locale-pl-ff00.js" defer></script>`
      + `<script src="${WEB}entry-1.js" defer></script></head>`)
    expect(missingBootChunks(shipped, srcs)).toEqual([])
    expect(missingBootChunks(html, srcs)).toEqual(srcs.slice(1))
    expect(() => shipBootChunks('<head></head>', srcs)).toThrow(/no Expo entry script/)
  })
})
