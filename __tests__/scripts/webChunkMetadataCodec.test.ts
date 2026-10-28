import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'

const { createCodec, prepareWebChunkMetadata, prelude, COMPLETION_KEY } = require('../../scripts/lib/webChunkMetadataCodec')
const { expandPaths, VERSION } = require('../../scripts/lib/webChunkMetadataRuntime')
const { readChunkMetadataRegistry, registryFromSources, stripCompactChunkMetadata } = require('../../scripts/lib/webChunkMetadataArtifact')
const { parseChunk, createChunkDependencyIndex } = require('../../scripts/lib/webChunkGraph')
const expoRoot = path.dirname(require.resolve('@expo/metro-config/package.json'))
const { createGranularChunkingStrategy } = require(path.join(expoRoot, 'build/serializer/chunking/createGranularChunkingStrategy'))
const CountingSet = require('@expo/metro/metro/lib/CountingSet').default

const definition = (id: number, paths: unknown) => `__d(function(g,r,i,a,m,e,d){},${id},{"0":7,"paths":${JSON.stringify(paths)}});`

describe('compact web chunk metadata', () => {
  it('interns exact caller maps, retaining order and different closures for one module ID', () => {
    const a = { name: 'a' }, b = { name: 'b' }
    const records = [{ paths: { 7: [a, b] } }, { paths: { 7: [b] } }, { paths: { 9: [a, b] } }, { paths: { 7: [a, b] } }]
    const codec = createCodec(records, (file: any) => file.name)
    expect(codec.stable.f).toEqual(['a', 'b'])
    expect(codec.stable.c).toHaveLength(2)
    expect(codec.stable.m).toHaveLength(3)
    const table = codec.table((file: any) => `/${file.name}.js?revision=1`)
    expect(expandPaths([VERSION, codec.recordIds.get(records[0])], table)).toEqual({ 7: ['/a.js?revision=1', '/b.js?revision=1'] })
    expect(expandPaths([VERSION, codec.recordIds.get(records[1])], table)).toEqual({ 7: ['/b.js?revision=1'] })
    expect(codec.recordIds.get(records[0])).toBe(codec.recordIds.get(records[3]))
    expect(createCodec(records.slice().reverse(), (file: any) => file.name).stable).toEqual(codec.stable)
  })

  it.each([null, undefined, {}, { 4: '/worker.js' }, { 4: null }, { 4: [] }])('keeps the legacy shape and identity: %j', (paths) => {
    expect(expandPaths(paths)).toBe(paths)
  })

  it.each([
    ['descriptor version', ['mc2', 0], { v: 'mc1', f: ['/a'], c: [[0]], m: [{ 7: 0 }], p: '' }],
    ['missing registry', ['mc1', 0], undefined],
    ['map reference', ['mc1', 9], { v: 'mc1', f: ['/a'], c: [[0]], m: [{ 7: 0 }], p: '' }],
    ['file reference', ['mc1', 0], { v: 'mc1', f: ['/a'], c: [[1]], m: [{ 7: 0 }], p: '' }],
    ['closure reference', ['mc1', 0], { v: 'mc1', f: ['/a'], c: [[0]], m: [{ 7: 1 }], p: '' }],
    ['duplicate file', ['mc1', 0], { v: 'mc1', f: ['/a', '/a'], c: [[0]], m: [{ 7: 0 }], p: '' }],
    ['duplicate closure file', ['mc1', 0], { v: 'mc1', f: ['/a'], c: [[0, 0]], m: [{ 7: 0 }], p: '' }],
    ['duplicate closure', ['mc1', 0], { v: 'mc1', f: ['/a'], c: [[0], [0]], m: [{ 7: 0 }], p: '' }],
    ['duplicate map', ['mc1', 0], { v: 'mc1', f: ['/a'], c: [[0]], m: [{ 7: 0 }, { 7: 0 }], p: '' }],
  ])('fails closed for %s', (_label, descriptor, registry) => {
    expect(() => expandPaths(descriptor, registry)).toThrow('Invalid web chunk metadata')
  })

  it('reads only actual assignments/factories and strips only validated service data', () => {
    const table = { v: 'mc1', f: ['/a.js'], c: [[0]], m: [{ 7: 0 }], p: '' }
    const runtime = prelude(table)
    expect(readChunkMetadataRegistry(runtime)).toEqual(table)
    const misleading = `var text=${JSON.stringify(runtime + definition(999, ['mc1', 0]))};`
    expect(readChunkMetadataRegistry(misleading)).toBeNull()
    expect(parseChunk(misleading).size).toBe(0)
    const source = definition(1, ['mc1', 0]) + `globalThis[${JSON.stringify(COMPLETION_KEY)}]();` + misleading
    const stripped = stripCompactChunkMetadata(source, table)
    expect(stripped).toBe('__d(function(g,r,i,a,m,e,d){},1,{"0":7});' + misleading)
    expect(parseChunk(source, table).get(1)).toEqual({ deps: [], paths: new Map([[7, ['/a.js']]]) })
    expect(() => parseChunk(source)).toThrow('missing registry')
    expect(() => stripCompactChunkMetadata(source)).toThrow('missing registry')
    expect(() => registryFromSources([runtime, runtime])).toThrow('Duplicate')
    expect(() => readChunkMetadataRegistry(runtime.replace('"v":"mc1"', '"v":"mc2"'))).toThrow('registry version')
  })

  it('builds page dependency indexes from the emitted runtime registry', () => {
    const table = { v: 'mc1', f: ['/shared.js', '/route.js'], c: [[0, 1]], m: [{ 7: 0 }], p: '' }
    const files: Record<string, string> = {
      '/runtime.js': prelude(table), '/entry.js': definition(1, ['mc1', 0]),
      '/shared.js': '__d(function(){},8,[]);', '/route.js': '__d(function(){},7,[8]);',
    }
    const dependencies = createChunkDependencyIndex(['/runtime.js', '/entry.js'], (file: string) => files[file])
    expect(dependencies('/route.js')).toEqual(['/shared.js'])
  })
})

const ROOT = '/codec-fixture'
function moduleFixture(name: string, body: string, dependencies: Array<[string, string | null]>) {
  const code = `__d(function(g,r,i,a,m,e,d){${body}});`
  return {
    path: path.join(ROOT, name), inverseDependencies: new CountingSet(), getSource: () => Buffer.from(code),
    dependencies: new Map(dependencies.map(([name, asyncType], key) => [String(key), {
      absolutePath: path.join(ROOT, name), data: { key: String(key), name, data: { asyncType } },
    }])),
    output: [{ type: 'js/module', data: { code, lineCount: 1, map: [] } }],
  }
}
async function serialize({ codec = true, value = 'one', extra = false, cycle = false, worker = false } = {}) {
  const entry = moduleFixture('entry.js', 'e.value="entry";', [['a.js', 'async'], ['b.js', 'async'], ...(extra ? [['extra.js', 'async'] as [string, string]] : []), ...(worker ? [['worker.js', 'worker'] as [string, string]] : [])])
  const a = moduleFixture('a.js', `e.value=${JSON.stringify(value)};`, [['shared.js', null], ...(cycle ? [['b.js', 'async'] as [string, string]] : [])])
  const b = moduleFixture('b.js', 'e.value="b";', [['shared.js', null], ...(cycle ? [['a.js', 'async'] as [string, string]] : [])])
  const shared = moduleFixture('shared.js', 'e.value="shared";', [])
  const modules = [entry, a, b, shared, ...(extra ? [moduleFixture('extra.js', 'e.value="extra";', [])] : []), ...(worker ? [moduleFixture('worker.js', 'e.value="worker";', [])] : [])]
  for (const module of modules) for (const dependency of module.dependencies.values()) {
    modules.find((target) => target.path === dependency.absolutePath)?.inverseDependencies.add(module.path)
  }
  const ids = new Map<string, number>()
  const options = {
    projectRoot: ROOT, serverRoot: ROOT, dev: false, modulesOnly: false, runModule: true, globalPrefix: '',
    createModuleId: (file: string) => { if (!ids.has(file)) ids.set(file, ids.size); return ids.get(file) },
    processModuleFilter: () => true, getRunModuleStatement: (id: number) => `__r(${id});`,
    serializerOptions: { exporting: true, splitChunks: true, includeSourceMaps: false },
  }
  const graph = { dependencies: new Map(modules.map((module) => [module.path, module])), entryPoints: new Set([entry.path]), transformOptions: { platform: 'web', customTransformOptions: { environment: 'client' } } }
  const runtime = fs.readFileSync(require.resolve('metro-runtime/src/polyfills/require'), 'utf8')
  const preModule = { ...moduleFixture('runtime.js', '', []), output: [{ type: 'js/script', data: { code: runtime, lineCount: runtime.split('\n').length, map: [] } }] }
  const context = {
    entryFile: entry.path, graph, options, preModules: [preModule],
    serializeChunkOptions: { chunkingStrategy: 'granular', includeSourceMaps: false },
    serializerConfig: codec ? { unstable_prepareWebChunkMetadata: prepareWebChunkMetadata } : {},
  }
  return { assets: await createGranularChunkingStrategy(context).serializeAsync(), ids }
}

describe('installed granular serialization and hashing', () => {
  it('roundtrips every emitted descriptor to the independent expanded asset metadata', async () => {
    const { assets } = await serialize({ cycle: true, worker: true })
    const table = registryFromSources(assets.map((asset: any) => asset.source))
    expect(table).not.toBeNull()
    let descriptors = 0
    for (const asset of assets) {
      const definitions = parseChunk(asset.source, table)
      for (const [id, paths] of Object.entries(asset.metadata.paths)) {
        const actual = definitions.get(Number(id))?.paths
        for (const [target, files] of Object.entries(paths as object)) {
          expect(actual.get(Number(target))).toEqual(typeof files === 'string' ? [files] : files)
          descriptors += 1
        }
      }
      if (asset.originFilename === 'worker.js') {
        expect(asset.source).not.toContain('"paths":["mc1"')
        expect(asset.source).not.toContain(COMPLETION_KEY)
      }
    }
    expect(descriptors).toBeGreaterThan(2)
    const legacy = await serialize({ codec: false, cycle: true, worker: true })
    const delivery = (items: any[]) => items.map((asset) => ({
      origin: asset.originFilename, modules: asset.metadata.modulePaths,
      requires: asset.metadata.requires.map((file: string) => path.basename(file).replace(/-[a-f0-9]{32}\.js$/, '.js')),
    }))
    expect(delivery(assets)).toEqual(delivery(legacy.assets))
  })

  it('changes runtime filename for target body/allocation mutations and is deterministic for cycles', async () => {
    const first = await serialize({ cycle: true })
    const repeat = await serialize({ cycle: true })
    expect(repeat.assets).toEqual(first.assets)
    const runtime = (result: any) => result.assets.find((asset: any) => asset.filename.includes('__expo-metro-runtime-')).filename
    expect(runtime(await serialize({ cycle: true, value: 'two' }))).not.toBe(runtime(first))
    expect(runtime(await serialize({ cycle: true, extra: true }))).not.toBe(runtime(first))
    expect(runtime(await serialize({ cycle: false }))).not.toBe(runtime(first))
  })

  it('keeps the same completion signal when runtime precedes shared and entry', async () => {
    const { assets } = await serialize()
    const context = vm.createContext({ __DEV__: false, __METRO_GLOBAL_PREFIX__: '', document: { currentScript: null } })
    context.global = context
    const runtime = assets.find((asset: any) => asset.filename.includes('__expo-metro-runtime-'))
    vm.runInContext(runtime.source, context)
    for (const asset of assets.filter((asset: any) => asset !== runtime && asset.metadata.isAsync)) {
      const url = `https://example.test/${asset.filename}`
      context.document.currentScript = { namespaceURI: 'http://www.w3.org/1999/xhtml', tagName: 'SCRIPT', src: url } as any
      vm.runInContext(asset.source, context)
      expect(context.__expo_chunk_completion__.has(url)).toBe(true)
    }
  })
})
