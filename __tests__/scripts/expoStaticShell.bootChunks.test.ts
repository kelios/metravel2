const fs = require('fs')
const path = require('path')
const { makeTempDir, removeDir } = require('./cli-test-utils')
const { missingBootChunks, readQuestLocaleBootChunks, shipBootChunks } = require('@/scripts/lib/expoStaticShell')

const WEB = '/_expo/static/js/web/'

// #2465: a translated quest member ships its catch-all route and locale catalog.
describe('quest locale boot chunks', () => {
  let dir: string
  const write = (name: string, body = '__d(function(){},1,[]);') => fs.writeFileSync(path.join(dir, name), body)

  beforeEach(() => {
    dir = makeTempDir('boot-chunks-')
    write('[...missing]-abc123.js', `globalThis.__METRAVEL_CHUNK_DEPS__??={};globalThis.__METRAVEL_CHUNK_DEPS__["${WEB}[...missing]-abc123.js"]=["${WEB}__shared-0-aa.js","${WEB}__shared-3-bb.js",7];__d(function(){},2,[]);`)
    for (const locale of ['pl', 'en']) write(`locale-${locale}-ff00.js`)
    write('locale-plx-ff00.js')
  })
  afterEach(() => removeDir(dir))

  it('reads the catch-all with its path-named dependencies and the locale catalog', () => {
    expect(readQuestLocaleBootChunks(dir, ['pl', 'en']).get('pl')).toEqual([
      `${WEB}__shared-0-aa.js`, `${WEB}__shared-3-bb.js`, `${WEB}[...missing]-abc123.js`, `${WEB}locale-pl-ff00.js`,
    ])
  })

  it('fails the build on an ambiguous or absent chunk instead of shipping a partial page', () => {
    write('[...missing]-def456.js')
    expect(() => readQuestLocaleBootChunks(dir, ['pl'])).toThrow(/expected one \[\.\.\.missing\] web chunk, found 2/)
    fs.unlinkSync(path.join(dir, '[...missing]-def456.js'))
    expect(() => readQuestLocaleBootChunks(dir, ['be'])).toThrow(/expected one locale-be web chunk, found 0/)
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
