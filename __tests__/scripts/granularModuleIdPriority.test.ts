/** @jest-environment node */
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'

const { createSerializerFromSerialProcessors } = require('@expo/metro-config/build/serializer/withExpoSerializers')
const { mergeGranularChunkPlan } = require('../../scripts/lib/granularChunkMerge')
const { createScopedNumericModuleIdFactory } = require('../../scripts/lib/scopedModuleIdFactory')
const { prepareWebChunkMetadata } = require('../../scripts/lib/webChunkMetadataCodec')
const { registryFromSources, moduleDependencyMaps } = require('../../scripts/lib/webChunkMetadataArtifact')
const { parseChunk } = require('../../scripts/lib/webChunkGraph')
const CountingSet = require('@expo/metro/metro/lib/CountingSet').default
const getPreludeCode = require('metro/private/lib/getPreludeCode').default

const ROOT = '/priority-fixture'
const at = (name: string) => path.join(ROOT, name)
const LOCALES = ['be', 'en', 'pl', 'uk'].map((locale) => `i18n/locales/${locale}/index.ts`)
type Edge = [string, string | null]
type PriorityHook = (plan: any, context: any) => unknown
const selectPriorities: PriorityHook = (plan, context) => require('../../scripts/lib/granularModuleIdPriority').getGranularModuleIdPriorities(plan, context)

function moduleFixture(name: string, body = '', edges: Edge[] = []) {
  const code = `__d(function(g,r,i,a,m,e,d){${body}});`
  return {
    path: at(name), inverseDependencies: new CountingSet(), getSource: () => Buffer.from(code),
    dependencies: new Map(edges.map(([target, asyncType], index) => [String(index), {
      absolutePath: at(target), data: { key: String(index), name: target, data: { asyncType } },
    }])),
    output: [{ type: 'js/module', data: { code, lineCount: 1, map: [] } }],
  }
}

function fixture(extra = false, worker?: 'sync' | 'async', localeValue = 'deferred locale') {
  const modules = [
    moduleFixture('entry.js', 'g.execution.push("entry");e.value=r(d[0]).value;', [
      ['z-startup.js', null], ['app/_layout.tsx', 'async'], ['app/_layout.web.tsx', 'async'],
      ['app/(tabs)/_layout.tsx', 'async'], ['app/(tabs)/index.tsx', 'async'],
      ['app/(tabs)/index.web.tsx', 'async'], ['app/(tabs)/map.web.tsx', 'async'],
      ['app/(tabs)/other.tsx', 'async'], ...LOCALES.map((file): Edge => [file, 'async']),
      ['weak-only.js', 'weak'], ...(worker ? [['worker.js', 'worker']] as Edge[] : []),
    ]),
    moduleFixture('z-startup.js', 'g.execution.push("startup");e.value="startup";'),
    moduleFixture('app/_layout.tsx', 'e.value="shadowed-layout";', [['components/shadowed-layout-only.js', null]]),
    moduleFixture('app/_layout.web.tsx', 'e.value="layout";', [['components/layout.js', null]]),
    moduleFixture('app/(tabs)/_layout.tsx', 'e.value="tabs";'),
    moduleFixture('app/(tabs)/index.tsx', 'e.value="shadowed-home";', [['components/shadowed-home-only.js', null]]),
    moduleFixture('app/(tabs)/index.web.tsx', 'g.execution.push("home");e.value=r(d[0]).value;', [
      ['components/home.js', null], ['components/shared-hm.js', null], ['z-startup.js', null],
    ]),
    moduleFixture('app/(tabs)/map.web.tsx', 'e.value="map";', [
      ['components/shared-hm.js', null], ['components/shared-mo.js', null],
      ...(extra ? [['aaa-lazy.js', null], ['middle-lazy.js', null]] as Edge[] : []),
    ]),
    moduleFixture('app/(tabs)/other.tsx', 'e.value="other";', [['components/shared-mo.js', null]]),
    moduleFixture('components/layout.js', 'e.value="layout";'),
    moduleFixture('components/home.js', 'g.execution.push("home-dependency");e.value="home";'),
    moduleFixture('components/shared-hm.js', `e.value="hm";/*${'.'.repeat(3000)}*/`),
    moduleFixture('components/shared-mo.js', `e.value="mo";/*${'.'.repeat(3000)}*/`, [['components/foreign-dep.js', null]]),
    moduleFixture('components/foreign-dep.js', 'e.value="foreign";'),
    moduleFixture('components/shadowed-home-only.js'), moduleFixture('components/shadowed-layout-only.js'),
    moduleFixture('weak-only.js', 'e.value="weak identity, not an emitted granular factory";'),
    ...LOCALES.map((file) => moduleFixture(file, `e.value=${JSON.stringify(localeValue)};`)),
    ...(worker ? [
      moduleFixture('worker.js', 'e.value=r(d[0]).value;', [['z-startup.js', null], ['worker-private.js', worker === 'async' ? 'async' : null]]),
      moduleFixture('worker-private.js', 'e.value="worker only";'),
    ] : []),
    ...(extra ? [moduleFixture('aaa-lazy.js'), moduleFixture('middle-lazy.js')] : []),
  ]
  for (const module of modules) for (const dependency of module.dependencies.values()) {
    modules.find((target) => target.path === dependency.absolutePath)?.inverseDependencies.add(module.path)
  }
  const runtime = fs.readFileSync(require.resolve('metro-runtime/src/polyfills/require'), 'utf8')
  const script = (name: string, code: string) => ({ ...moduleFixture(name), output: [{ type: 'js/script', data: { code, lineCount: code.split('\n').length, map: [] } }] })
  const virtualPrelude = { ...script('unused', getPreludeCode({ isDev: false, globalPrefix: '' })), path: '__prelude__' }
  virtualPrelude.output[0].type = 'js/script/virtual'
  const preModules = [virtualPrelude, script('prelude-z.js', 'globalThis.preludes.push("first");'), script('runtime.js', runtime), script('prelude-a.js', 'globalThis.preludes.push("last");')]
  return { modules, preModules }
}

type SerializeOptions = {
  extra?: boolean; shuffle?: boolean; hook?: boolean; priority?: PriorityHook
  prior?: string[]; worker?: 'sync' | 'async'; platform?: string; environment?: string
  dev?: boolean; lazy?: boolean; dom?: boolean; granular?: boolean; exporting?: boolean
  allocate?: ReturnType<typeof createScopedNumericModuleIdFactory>; loader?: boolean
  localeValue?: string
}
async function serialize({
  extra = false, shuffle = false, hook = true, priority = selectPriorities, prior = [], worker,
  platform = 'web', environment = 'client', dev = false, lazy = false, dom,
  granular = true, exporting = true, allocate = createScopedNumericModuleIdFactory(), loader = false,
  localeValue,
}: SerializeOptions = {}) {
  const { modules, preModules } = fixture(extra, worker, localeValue)
  if (loader) (modules[0].output[0].data as any).loaderReference = 'entry-loader'
  const graph = {
    dependencies: new Map((shuffle ? [...modules].reverse() : modules).map((module) => [module.path, module])),
    entryPoints: new Set([at('entry.js')]),
    transformOptions: { platform, dev, customTransformOptions: { environment, dom, ...(loader ? { isLoaderBundle: 'true' } : {}) } },
  }
  const ids = new Map<string, number>()
  const calls: string[] = []
  for (const file of prior) allocate(file, { platform, environment })
  const priorityHook = jest.fn(priority)
  const config = {
    transformer: { assetPlugins: [] },
    serializer: {
      unstable_granularWebExport: granular, unstable_mergeGranularChunkPlan: mergeGranularChunkPlan,
      unstable_prepareWebChunkMetadata: prepareWebChunkMetadata,
      ...(hook ? { unstable_getGranularModuleIdPriorities: priorityHook } : {}),
    },
  }
  const options = {
    projectRoot: ROOT, serverRoot: ROOT, dev, modulesOnly: false, runModule: true,
    globalPrefix: '', includeAsyncPaths: lazy,
    createModuleId: (file: string, context: unknown) => {
      calls.push(file)
      const id = allocate(file, context)
      ids.set(file, id)
      return id
    },
    processModuleFilter: () => true, getRunModuleStatement: (id: number) => `__r(${id});`,
    serializerOptions: { output: 'static', exporting, splitChunks: true, includeSourceMaps: false },
  }
  // Use Expo's actual export dispatcher so context/eligibility are constructed
  // exactly as graphToSerialAssetsAsync sees them, rather than inventing a hook context.
  const result = await createSerializerFromSerialProcessors(config, [])(at('entry.js'), preModules, graph, options)
  return { assets: result.artifacts, ids, calls, priorityHook, modules, preModules, graph, options }
}

describe('granular web module ID priorities', () => {
  it('retains protected IDs when only two lazy static leaves are inserted', async () => {
    const before = await serialize()
    const after = await serialize({ extra: true })
    const protectedPaths = before.priorityHook.mock.results[0].value as string[]
    expect(after.priorityHook.mock.results[0].value).toEqual(protectedPaths)
    expect(protectedPaths.map((file) => [file, after.ids.get(file)])).toEqual(protectedPaths.map((file) => [file, before.ids.get(file)]))
    expect(protectedPaths).not.toContain(at('aaa-lazy.js'))
    expect(protectedPaths).not.toContain(at('middle-lazy.js'))
    expect(after.ids.get(at('aaa-lazy.js'))).toBeGreaterThanOrEqual(protectedPaths.length)
    expect(after.ids.get(at('middle-lazy.js'))).toBeGreaterThanOrEqual(protectedPaths.length)
  })

  it('primes the four-tier universe exactly once before metadata/hash requests', async () => {
    const result = await serialize({ extra: true })
    const priorities = result.priorityHook.mock.results[0].value as string[]
    expect(result.priorityHook).toHaveBeenCalledTimes(1)
    expect(result.calls.slice(0, priorities.length)).toEqual(priorities)
    expect(priorities.map((file) => result.ids.get(file))).toEqual(priorities.map((_, index) => index))
    const initial = [at('entry.js'), at('z-startup.js'), ...result.preModules.map((module) => module.path)].sort()
    expect(priorities.slice(0, initial.length)).toEqual(initial)
    expect(priorities).toContain('__prelude__')
    expect(priorities).toContain(at('weak-only.js'))
    expect(priorities).toContain(at('components/shared-mo.js')) // Foreign shared factory delivered to home.
    expect(priorities).toContain(at('components/foreign-dep.js'))
    expect(priorities).not.toContain(at('components/shadowed-home-only.js'))
    expect(priorities).not.toContain(at('components/shadowed-layout-only.js'))
    expect(result.assets.some((asset: any) => asset.metadata.modulePaths.includes(at('weak-only.js')))).toBe(false)
    for (const file of LOCALES) expect(priorities.indexOf(at(file))).toBeGreaterThanOrEqual(initial.length)
    expect(priorities.indexOf(at('components/home.js'))).toBeGreaterThan(priorities.indexOf(at(LOCALES[3])))
    const universe = [...result.modules, ...result.preModules].flatMap((module) => [module.path, ...[...module.dependencies.values()].map((dependency) => dependency.absolutePath)])
    expect([...result.ids.keys()].sort()).toEqual([...new Set(universe)].sort())
    expect(new Set(result.ids.values()).size).toBe(result.ids.size)
  })

  it('is deterministic for shuffled graph/plan map insertion and repeated serialization', async () => {
    const first = await serialize({ extra: true })
    const shuffled = await serialize({ extra: true, shuffle: true, priority: (plan, context) => selectPriorities({
      ...plan, chunks: [...plan.chunks].reverse(),
      dependentEntriesByModule: new Map([...plan.dependentEntriesByModule].reverse()),
      requiredChunksByEntryPath: new Map([...plan.requiredChunksByEntryPath].reverse()),
    }, context) })
    expect(shuffled.assets).toEqual(first.assets)
    expect([...shuffled.ids]).toEqual([...first.ids])
    const allocate = createScopedNumericModuleIdFactory()
    const repeated = await serialize({ allocate })
    expect((await serialize({ allocate })).assets).toEqual(repeated.assets)
  })

  it('accepts an identical prior prefix and rejects incompatible earlier allocation', async () => {
    const before = await serialize()
    const priorities = before.priorityHook.mock.results[0].value as string[]
    expect((await serialize({ prior: priorities.slice(0, 3) })).assets).toEqual(before.assets)
    await expect(serialize({ prior: [at('middle-lazy.js')] })).rejects.toThrow('conflicts with earlier allocation')
  })

  it.each([
    ['not an array', () => null, 'must be an array'],
    ['unknown identity', () => ['/unknown'], 'Invalid granular module ID priority'],
    ['empty identity', () => [''], 'Invalid granular module ID priority'],
    ['duplicate identity', () => [at('entry.js'), at('entry.js')], 'Invalid granular module ID priority'],
  ])('fails closed for %s', async (_name, priority, error) => {
    await expect(serialize({ priority: priority as PriorityHook })).rejects.toThrow(error as string)
  })

  it('fails closed for missing home requirements or a protected sync dependency', async () => {
    await expect(serialize({ priority: (plan, context) => selectPriorities({ ...plan, requiredChunksByEntryPath: new Map() }, context) })).rejects.toThrow('home requirements missing')
    await expect(serialize({ priority: (plan, context) => selectPriorities({ ...plan, entryPoints: plan.entryPoints.filter(({ module }: any) => !module.path.includes('/index.')) }, context) })).rejects.toThrow('require the home route')
    await expect(serialize({ priority: (plan, context) => {
      context.graph.dependencies.delete(at('components/foreign-dep.js'))
      return selectPriorities(plan, context)
    } })).rejects.toThrow('priority dependency missing')
  })

  it('preserves dependency slots and actual Metro root execution with premodule order', async () => {
    const result = await serialize()
    const registry = registryFromSources(result.assets.map((asset: any) => asset.source))
    const entry = result.assets.find((asset: any) => asset.originFilename === 'entry.js')
    const byFilename = new Map(result.assets.map((asset: any) => [asset.filename, asset]))
    const loaded = new Set()
    const context = vm.createContext({ execution: [], preludes: [], document: { currentScript: null } })
    context.global = context
    const load = (filename: string) => {
      if (loaded.has(filename)) return
      const asset: any = byFilename.get(filename)
      for (const required of asset.metadata.requires) load(required)
      loaded.add(filename)
      vm.runInContext(asset.source, context)
    }
    load(entry.filename)
    expect(context.preludes).toEqual(['first', 'last'])
    expect(context.execution).toEqual(['entry', 'startup'])
    expect(context.__r(result.ids.get(at('entry.js'))).value).toBe('startup')
    for (const filename of entry.metadata.entryChunks[at('app/(tabs)/index.web.tsx')]) load(filename)
    expect(context.__r(result.ids.get(at('app/(tabs)/index.web.tsx'))).value).toBe('home')
    expect(context.execution).toEqual(['entry', 'startup', 'home', 'home-dependency'])
    const loadedDefinitions = new Map([...loaded].flatMap((filename) => [...parseChunk((byFilename.get(filename) as any).source, registry)]))
    expect(loadedDefinitions.has(result.ids.get(at('components/shared-mo.js')))).toBe(true)
    for (const file of LOCALES) expect(loadedDefinitions.has(result.ids.get(at(file)))).toBe(false)
    const unEmitted = result.modules.filter((module) => !result.assets.some((item: any) => item.metadata.modulePaths.includes(module.path)))
    expect(unEmitted.map((module) => module.path)).toEqual([at('weak-only.js')])
    for (const module of result.modules) {
      if (module.path === at('weak-only.js')) continue // The numeric weak identity intentionally has no emitted factory.
      const asset = result.assets.find((item: any) => item.metadata.modulePaths.includes(module.path))
      const definition = moduleDependencyMaps(asset.source).find((item: any) => item.id === result.ids.get(module.path))
      for (const [slot, dependency] of module.dependencies) expect(definition.map[slot]).toBe(result.ids.get(dependency.absolutePath))
    }
  })

  it('keeps sealed worker copies/registry separate and worker URLs scalar', async () => {
    const result = await serialize({ worker: 'sync' })
    const worker = result.assets.find((asset: any) => asset.originFilename === 'worker.js')
    const entry = result.assets.find((asset: any) => asset.originFilename === 'entry.js')
    expect(worker.metadata.modulePaths).toEqual(expect.arrayContaining([at('worker.js'), at('z-startup.js'), at('worker-private.js')]))
    expect(worker.metadata.requires).toEqual([])
    expect(worker.source).not.toContain('"paths":["mc1"')
    expect(typeof entry.metadata.paths[result.ids.get(at('entry.js'))][result.ids.get(at('worker.js'))]).toBe('string')
    const context = vm.createContext({ execution: [], preludes: [] })
    context.global = context
    vm.runInContext(worker.source, context)
    expect(context.__r(result.ids.get(at('worker.js'))).value).toBe('startup')
    expect(context.execution).toEqual(['startup'])
    expect(result.priorityHook.mock.results[0].value).toContain(at('worker.js'))
    expect(result.priorityHook.mock.results[0].value).not.toContain(at('worker-private.js'))
  })

  it('roundtrips changed-ID async maps and still hashes real deferred target filenames', async () => {
    const result = await serialize({ worker: 'sync' })
    const registry = registryFromSources(result.assets.map((asset: any) => asset.source))
    for (const asset of result.assets) {
      const definitions = parseChunk(asset.source, registry)
      for (const [id, paths] of Object.entries(asset.metadata.paths)) {
        for (const [target, files] of Object.entries(paths as object)) {
          expect(definitions.get(Number(id)).paths.get(Number(target))).toEqual(typeof files === 'string' ? [files] : files)
        }
      }
    }
    // Mixed worker/scalar callers retain legacy metadata. Exercise the codec's
    // runtime URL hash edge on its ordinary array-only caller instead.
    const withCodec = await serialize()
    expect(registryFromSources(withCodec.assets.map((asset: any) => asset.source))).not.toBeNull()
    const changed = await serialize({ localeValue: 'new deferred catalog body' })
    expect(changed.priorityHook.mock.results[0].value).toEqual(withCodec.priorityHook.mock.results[0].value)
    expect([...changed.ids]).toEqual([...withCodec.ids])
    const runtime = (items: any[]) => items.find((asset) => asset.filename.includes('__expo-metro-runtime-')).filename
    expect(runtime(changed.assets)).not.toBe(runtime(withCodec.assets))
  })

  it('retains the exact absent/undefined-hook global allocation default', async () => {
    const absent = await serialize({ hook: false })
    expect((await serialize({ priority: () => undefined })).assets).toEqual(absent.assets)
    const identities = [...absent.ids.keys()].sort()
    expect(identities.map((file) => absent.ids.get(file))).toEqual(identities.map((_, index) => index))
  })

  it.each([
    ['Android', { platform: 'android' }], ['iOS', { platform: 'ios' }],
    ['SSR', { environment: 'node' }], ['react-server', { environment: 'react-server' }],
    ['dev', { dev: true }], ['DOM', { dom: true }], ['lazy', { lazy: true }],
    ['legacy', { granular: false }], ['not exporting', { exporting: false }],
    ['async worker fallback', { worker: 'async' }],
  ] as [string, SerializeOptions][])('does not enter the priority hook for %s and preserves existing output', async (_name, options) => {
    const hooked = await serialize(options)
    expect(hooked.priorityHook).not.toHaveBeenCalled()
    expect(hooked.assets).toEqual((await serialize({ ...options, hook: false })).assets)
  })

  it('retains client-platform/server isolation and distinct Expo loader identities', async () => {
    const allocate = createScopedNumericModuleIdFactory()
    const web = await serialize({ allocate })
    const server = await serialize({ allocate, environment: 'node' })
    const loader = await serialize({ allocate, environment: 'node', loader: true })
    const ios = await serialize({ allocate, platform: 'ios' })
    expect((await serialize({ allocate })).assets).toEqual(web.assets)
    expect(loader.ids.get(at('entry.js') + '+loader')).not.toBe(server.ids.get(at('entry.js')))
    expect(ios.ids.get(at('entry.js'))).toBeDefined()
    expect((await serialize({ allocate, environment: 'react-server' })).ids.get(at('entry.js'))).toBe(server.ids.get(at('entry.js')))
  })
})
