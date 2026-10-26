const fs = require('fs')
const path = require('path')
const { makeTempDir, removeDir } = require('./cli-test-utils')
const { bootChunkIssues, missingBootChunks, readQuestLocaleBootChunks, shipBootChunks, translationHashes, writeQuestLocaleBootCatalogs } = require('@/scripts/lib/expoStaticShell')

const WEB = '/_expo/static/js/web/'
const tag = (name: string) => `<script src="${WEB}${name}" defer></script>`
const page = (names: string[]) => `<head>${names.map(tag).join('')}</head>`
const ROUTE = '[...missing]-abc123.js'
const OTHER_ROUTE = '[...missing]-def456.js'
const SHELL = page([ROUTE, 'entry-1.js'])
// #2484: the head ships a boot subset of the catalogue, never the full one.
const BOOT = 'locale-pl-boot-ee11.js'
const bootCatalog = (entries: unknown[]) => `(globalThis.__METRAVEL_BOOT_CATALOGS__??={}).pl=${JSON.stringify(entries)};`

// #2465: a translated quest member ships its catch-all route and locale catalog.
describe('quest locale boot chunks', () => {
  let dir: string
  const write = (name: string, body = '__d(function(){},1,[]);') => fs.writeFileSync(path.join(dir, name), body)
  // #2741: granular chunks — a route file defines its module; the router context
  // in `entry` lists every file each route needs (Expo `paths` arrays).
  const routerContext = (sets: Record<number, string[]>) => `__d(function(){},1,${JSON.stringify({
    paths: Object.fromEntries(Object.entries(sets).map(([id, names]) => [id, names.map((name) => WEB + name)])),
  })});__r(1);`
  const ROUTE_SET = { 2: [ROUTE, '__shared-0-aa.js', '__shared-3-bb.js'] }

  beforeEach(() => {
    dir = makeTempDir('boot-chunks-')
    write('[...missing]-abc123.js', '__d(function(){},2,[]);')
    for (const name of ['__shared-0-aa.js', '__shared-3-bb.js']) write(name)
    write('entry-1.js', routerContext(ROUTE_SET))
    for (const locale of ['pl', 'en']) write(`locale-${locale}-ff00.js`)
    write('locale-plx-ff00.js')
    write(BOOT, bootCatalog([]))
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
    write(OTHER_ROUTE, '__d(function(){},3,[]);')
    write('entry-1.js', routerContext({ ...ROUTE_SET, 3: [OTHER_ROUTE, '__shared-3-bb.js', ROUTE] }))
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
    const read = (src: string) => (src.endsWith('[...missing]-abc123.js') ? route : src.endsWith(BOOT) ? bootCatalog([])
      : src.endsWith('entry-1.js') ? routerContext(ROUTE_SET) : '')
    expect(bootChunkIssues(page(['__shared-0-aa.js', '__shared-3-bb.js', '[...missing]-abc123.js', BOOT, 'entry-1.js']), 'pl', read)).toEqual([])
    expect(bootChunkIssues(page(['__shared-0-aa.js', '[...missing]-abc123.js', 'entry-1.js']), 'pl', read)).toEqual([
      'does not ship the locale-pl boot catalog', `does not ship boot chunk ${WEB}__shared-3-bb.js`,
    ])
    expect(bootChunkIssues(page(['entry-1.js', '__shared-0-aa.js', '__shared-3-bb.js', '[...missing]-abc123.js', BOOT]), 'pl', read))
      .toEqual(['__shared-0-aa.js', '__shared-3-bb.js', ROUTE, BOOT].map((name) => `loads boot chunk ${WEB}${name} after entry`))
    expect(bootChunkIssues(page(['entry-1.js']), 'pl', read)).toEqual(['does not ship the [...missing] route chunk'])
  })

  it('checks the dependencies of every route and all boot script positions, including duplicates', () => {
    write(OTHER_ROUTE, '__d(function(){},3,[]);')
    write('__shared-4-cc.js')
    write('entry-1.js', routerContext({ ...ROUTE_SET, 3: [OTHER_ROUTE, '__shared-4-cc.js'] }))
    const read = (src: string) => fs.readFileSync(path.join(dir, src.slice(WEB.length)), 'utf8')
    const healthy = ['__shared-0-aa.js', '__shared-3-bb.js', '__shared-4-cc.js', ROUTE, OTHER_ROUTE, BOOT, 'entry-1.js']
    expect(bootChunkIssues(page(healthy), 'pl', read)).toEqual([])
    expect(bootChunkIssues(page(healthy.filter((name) => name !== '__shared-4-cc.js')), 'pl', read)).toContain(`does not ship boot chunk ${WEB}__shared-4-cc.js`)
    expect(bootChunkIssues(page([...healthy, OTHER_ROUTE]), 'pl', read)).toContain(`duplicates boot chunk ${WEB}${OTHER_ROUTE}`)
    expect(bootChunkIssues(page([...healthy.filter((name) => name !== OTHER_ROUTE), OTHER_ROUTE]), 'pl', read)).toContain(`loads boot chunk ${WEB}${OTHER_ROUTE} after entry`)
    expect(bootChunkIssues(page([...healthy.filter((name) => name !== '__shared-4-cc.js'), '__shared-4-cc.js']), 'pl', read)).toContain(`loads boot chunk ${WEB}__shared-4-cc.js after entry`)
    expect(bootChunkIssues(page([...healthy.filter((name) => name !== BOOT), BOOT]), 'pl', read)).toContain(`loads boot chunk ${WEB}${BOOT} after entry`)
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

  it('moves the full BODY-export defer set into head, preserving tags, runtime order and inert content', () => {
    const runtime = `<script nonce="keep" src="${WEB}__expo-metro-runtime-00aa.js" defer data-note="a > b"></script>`
    const shared = `<script defer="defer" crossorigin="anonymous" src="${WEB}__shared-0-aa.js"></script>`
    const entry = `<script type="text/javascript" src="${WEB}entry-1.js" integrity="keep" defer></script>`
    const inline = `<script>globalThis.note='<head><script src="${WEB}${ROUTE}">';</script>`
    const json = '<script type="application/json" id="quest-serving-v1">{"text":"keep unchanged"}</script>'
    const ldJson = '<script type="application/ld+json">{"@type":"WebPage"}</script>'
    const foreign = '<script src="https://example.org/keep.js" async></script>'
    const source = `<html><head><title>Fixture</title>${ldJson}</head><body><main>Readable body</main>${inline}${runtime}${shared}${json}${foreign}${entry}</body></html>`
    const srcs = [`${WEB}__shared-0-aa.js`, `${WEB}__shared-3-bb.js`, `${WEB}${ROUTE}`, `${WEB}locale-pl-ff00.js`]
    const result = shipBootChunks(source, srcs)
    const parsed = new DOMParser().parseFromString(result, 'text/html')
    expect([...parsed.head.querySelectorAll('script[src]')].map((node) => node.getAttribute('src'))).toEqual([
      `${WEB}__expo-metro-runtime-00aa.js`, ...srcs, `${WEB}entry-1.js`,
    ])
    expect(parsed.body.querySelectorAll(`script[src^="${WEB}"]`)).toHaveLength(0)
    for (const unchanged of [runtime, shared, entry, inline, json, ldJson, foreign]) expect(result).toContain(unchanged)
    expect(result.indexOf(inline)).toBeGreaterThan(result.indexOf('</head>'))
    expect(result.indexOf(json)).toBeGreaterThan(result.indexOf('</head>'))
    expect(shipBootChunks(result, srcs)).toBe(result)
    expect(missingBootChunks(source, srcs)).toContain(`${WEB}${ROUTE}`)
  })

  it.each(['template', 'noscript'])('keeps inert %s scripts unchanged and never counts them as shipped', (container) => {
    const inert = `<${container}>${tag(ROUTE)}${tag('entry-2.js')}</${container}>`
    const source = `<head></head><body>${inert}${tag('entry-1.js')}</body>`
    const srcs = [`${WEB}__shared-0-aa.js`, `${WEB}__shared-3-bb.js`, `${WEB}${ROUTE}`, `${WEB}${BOOT}`]
    expect(missingBootChunks(source, srcs)).toEqual(srcs)
    expect(() => readQuestLocaleBootChunks(dir, ['pl'], source)).toThrow(/no \[\.\.\.missing\] route scripts/)
    const result = shipBootChunks(source, srcs)
    expect(result).toBe(`<head>${srcs.map((src) => `<script src="${src}" defer></script>`).join('')}${tag('entry-1.js')}</head><body>${inert}</body>`)
    const read = (src: string) => fs.readFileSync(path.join(dir, src.slice(WEB.length)), 'utf8')
    expect(bootChunkIssues(source, 'pl', read)).toContain('does not ship the [...missing] route chunk')
    expect(bootChunkIssues(result, 'pl', read)).toEqual([])
    expect(shipBootChunks(result, srcs)).toBe(result)
  })

  it('normalizes a mixed head/body export without changing its execution order', () => {
    const runtime = tag('__expo-metro-runtime-00aa.js')
    const shared = tag('__shared-0-aa.js')
    const source = `<head>${runtime}<meta name="keep" content="yes"></head><body>${shared}${tag('entry-1.js')}</body>`
    const result = shipBootChunks(source, [`${WEB}__shared-3-bb.js`, `${WEB}${ROUTE}`, `${WEB}locale-pl-ff00.js`])
    expect(result).toBe(`<head><meta name="keep" content="yes">${runtime}${shared}${tag('__shared-3-bb.js')}${tag(ROUTE)}${tag('locale-pl-ff00.js')}${tag('entry-1.js')}</head><body></body>`)
  })

  it.each([
    `<body>${tag('entry-1.js')}</body>`,
    `<head></head><head></head><body>${tag('entry-1.js')}</body>`,
    `<head><body>${tag('entry-1.js')}</body>`,
    '<head></head><body></body>',
    `<head></head><body>${tag('entry-1.js')}${tag('entry-2.js')}</body>`,
    `<head>${tag('__shared-0-aa.js')}</head><body>${tag('__shared-0-aa.js')}${tag('entry-1.js')}</body>`,
    `<head></head><body>${tag('entry-1.js')}${tag('__shared-0-aa.js')}</body>`,
  ])('fails closed for an ambiguous or unsafe document shell', (source) => {
    expect(() => shipBootChunks(source, [])).toThrow()
  })

  it.each(['', 'async defer', 'type="module" defer', 'type="application/json" defer', 'nomodule defer'])('rejects an Expo script with unsafe attributes %s', (attrs) => {
    const source = `<head></head><body><script ${attrs} src="${WEB}entry-1.js"></script></body>`
    expect(() => shipBootChunks(source, [])).toThrow(/classic defer/)
  })

  it('rejects body-only and preload-only boot assets in the stored verifier', () => {
    const names = ['__shared-0-aa.js', '__shared-3-bb.js', ROUTE, BOOT, 'entry-1.js']
    const read = (src: string) => fs.readFileSync(path.join(dir, src.slice(WEB.length)), 'utf8')
    const bodyOnly = `<head></head><body>${names.map(tag).join('')}</body>`
    expect(bootChunkIssues(bodyOnly, 'pl', read)).toContain(`loads Expo script outside head: ${WEB}${ROUTE}`)
    expect(bootChunkIssues(bodyOnly, 'pl', read)).toContain(`loads Expo script outside head: ${WEB}entry-1.js`)
    const preloadOnly = `<head>${names.map((name) => `<link rel="preload" as="script" href="${WEB}${name}">`).join('')}</head><body></body>`
    expect(bootChunkIssues(preloadOnly, 'pl', read)).toContain('does not ship the [...missing] route chunk')
    const healthy = shipBootChunks(bodyOnly, [])
    expect(bootChunkIssues(healthy, 'pl', read)).toEqual([])
    expect(bootChunkIssues(healthy.replace(' defer', ' async'), 'pl', read).some((issue: string) => issue.includes('classic defer'))).toBe(true)
  })

  it('writes a boot subset with exactly the keys of the shipped chunks, in place of the full catalogue', () => {
    write('__shared-0-aa.js', '__d(function(){var x={h:11,v:"a"},y={h:3174359e3,v:"b",p:{one:"b1"}}},1,[]);')
    write('entry-1.js', '__d(function(){t({h:11,v:"a"})},9,[]);')
    write('locale-pl-ff00.js', '__d(function(g,r,i,a,m,e,d){Object.defineProperty(e,"__esModule",{value:!0}),e.plCatalog=void 0;'
      + 'e.plCatalog=new Map([[11,{value:"A"}],[3174359000,{value:"B",plurals:{one:"B1"}}],[99,{value:"unused"}]])},5,[]);')
    const chunks = readQuestLocaleBootChunks(dir, ['pl'], SHELL)
    const result = writeQuestLocaleBootCatalogs(dir, chunks, page(['__shared-0-aa.js', ROUTE, 'entry-1.js']))
    const srcs = result.get('pl')
    const boot = srcs[srcs.length - 1].slice(WEB.length)
    expect(srcs.slice(0, -1)).toEqual(chunks.get('pl').slice(0, -1))
    expect(boot).toMatch(/^locale-pl-boot-[0-9a-f]{32}\.js$/)
    const sandbox: Record<string, any> = {}
    require('vm').runInNewContext(fs.readFileSync(path.join(dir, boot), 'utf8'), sandbox)
    expect(sandbox.__METRAVEL_BOOT_CATALOGS__.pl).toEqual([[11, { value: 'A' }], [3174359000, { value: 'B', plurals: { one: 'B1' } }]])
    const read = (src: string) => fs.readFileSync(path.join(dir, src.slice(WEB.length)), 'utf8')
    const shipped = shipBootChunks(page(['__shared-0-aa.js', ROUTE, 'entry-1.js']), srcs)
    expect(bootChunkIssues(shipped, 'pl', read)).toEqual([])
    write('__shared-0-aa.js', '__d(function(){var x={h:11,v:"a"},z={h:12,v:"c"}},1,[]);')
    expect(bootChunkIssues(shipped, 'pl', read)).toEqual([`boot catalog ${WEB}${boot} misses 1 keys of the shipped chunks`])
    expect(bootChunkIssues(shipBootChunks(shipped, [`${WEB}locale-pl-ff00.js`]), 'pl', read))
      .toContain(`ships the full catalogue ${WEB}locale-pl-ff00.js before entry`)
  })

  it('fails closed on a key the catalogue lacks or a hash literal it cannot read', () => {
    write('locale-pl-ff00.js', '__d(function(g,r,i,a,m,e,d){e.plCatalog=new Map([[11,{value:"A"}]])},5,[]);')
    write('entry-1.js', '__d(function(){t({h:12,v:"c"})},9,[]);')
    expect(() => writeQuestLocaleBootCatalogs(dir, readQuestLocaleBootChunks(dir, ['pl'], SHELL), SHELL)).toThrow(/lacks 1 shipped keys/)
    expect(() => translationHashes('t({h:0x1f,v:"c"})', 'x.js')).toThrow(/unrecognized translation hash 0x1f/)
    expect([...translationHashes('a={h:5,v:"x"},b={sh:6,v:"y"},c={h:7e2,v:"z"}', 'x.js')]).toEqual([5, 700])
  })
})
