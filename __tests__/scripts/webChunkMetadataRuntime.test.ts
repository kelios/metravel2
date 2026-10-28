import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { transformSync } from '@babel/core'

const { prelude, COMPLETION_KEY } = require('../../scripts/lib/webChunkMetadataCodec')
const runtimeHelpers = require('../../scripts/lib/webChunkMetadataRuntime')
const ROOT = path.resolve(__dirname, '../..')
const expoRoot = path.dirname(require.resolve('expo/package.json'))
const prefix = 'qa_'
const files = ['/_expo/static/js/web/shared.js?v=2', '/_expo/static/js/web/route.js?v=2']
const registry = { v: 'mc1', f: files, c: [[0, 1]], m: [{ 7: 0 }], p: prefix }

function harness(compact: boolean, { preload = false, unavailable = false } = {}) {
  const context = vm.createContext({
    __DEV__: false, __METRO_GLOBAL_PREFIX__: prefix, URL, console,
    process: { env: { EXPO_OS: 'web', NODE_ENV: 'production' } },
    document: { baseURI: 'https://example.test/base/', currentScript: null },
    sideEffects: 0,
  })
  context.global = context
  const globals = vm.runInContext('globalThis', context)
  vm.runInContext(fs.readFileSync(require.resolve('metro-runtime/src/polyfills/require'), 'utf8'), context)
  vm.runInContext(prelude(registry), context)
  const define = context[`${prefix}__d`]
  // Metro prefixes define, but its public require is always global.__r.
  const metroRequire = context.__r
  if (typeof define !== 'function' || typeof metroRequire?.importAll !== 'function') {
    throw new Error('Fixture must expose the actual Metro define and require.importAll')
  }
  const registered = new Set<number>()
  function register(file: string) {
    const id = file.includes('/shared.js') ? 8 : 7
    if (!registered.has(id)) {
      const source = id === 8 ? 'e.value=41;' : 'g.sideEffects++;e.value=r(d[0]).value+1;'
      const factory = vm.runInContext(`(function(g,r,i,a,m,e,d){${source}})`, context)
      define(factory, id, id === 8 ? [] : [8])
      registered.add(id)
    }
  }
  function complete(file: string) {
    context.document.currentScript = {
      namespaceURI: 'http://www.w3.org/1999/xhtml', tagName: 'SCRIPT',
      src: new URL(file, context.document.baseURI).href,
    } as any
    context[`${prefix}${COMPLETION_KEY}`]()
  }
  function evaluate(file: string, requireModule: any) {
    const source = fs.readFileSync(file, 'utf8')
    const code = file.endsWith('.ts') ? transformSync(source, {
      filename: file, configFile: false, babelrc: false,
      plugins: ['@babel/plugin-transform-typescript', '@babel/plugin-transform-modules-commonjs'],
    })!.code : source
    const module = { exports: {} as any }
    vm.runInContext(`(function(require,module,exports){${code}\n})`, context)(requireModule, module, module.exports)
    return module.exports
  }
  if (preload) for (const file of files) { register(file); complete(file) }
  const requests: string[] = []
  const flights: Promise<void>[] = []
  let failNext = false
  let omitCompletion = false
  const urlBuilder = evaluate(path.join(expoRoot, 'src/async-require/buildUrlForBundle.ts'), () =>
    () => ({ url: context.document.baseURI }))
  const { buildAsyncRequire } = evaluate(path.join(expoRoot, 'src/async-require/buildAsyncRequire.ts'), (name: string) => {
    if (name === './buildUrlForBundle') return urlBuilder
    if (name === './loadBundle') return {
      loadBundleAsync(file: string) {
        requests.push(file)
        const flight = (async () => {
          // Network delivery cannot register chunks in the caller's stack.
          // Keep concurrent imports in flight until the next microtask.
          await Promise.resolve()
          if (failNext) { failNext = false; throw new Error('transport failure') }
          register(file)
          if (!omitCompletion) complete(file)
        })()
        flights.push(flight)
        return flight
      },
    }
    throw new Error(`Unexpected loader dependency ${name}`)
  })
  if (!unavailable) context[`${prefix}__loadBundleAsync`] = buildAsyncRequire()
  const original = evaluate(path.join(expoRoot, 'src/async-require/asyncRequireModule.ts'), metroRequire)
  const originalReturns: any[] = []
  const observedOriginal = Object.assign((moduleID: number, paths: unknown, moduleName?: string) => {
    const result = original(moduleID, paths, moduleName)
    originalReturns.push(result)
    return result
  }, original)
  const adapter = evaluate(path.join(ROOT, 'metro-stubs/expoAsyncRequire.web.js'), (name: string) => {
    if (name === 'expo/internal/async-require-module') return observedOriginal
    if (name === '../scripts/lib/webChunkMetadataRuntime') return runtimeHelpers
    throw new Error(`Unexpected adapter dependency ${name}`)
  })
  return {
    context, globals, original, originalReturns, adapter, requests,
    paths: compact ? ['mc1', 0] : { 7: files },
    fail() { failNext = true },
    completion(value: boolean) { omitCompletion = !value },
    async drainTransport() { await Promise.allSettled(flights) },
  }
}

// Observe an unexpected promise before asserting the required synchronous failure.
// A regression must produce an ordinary Jest FAIL, never an unhandled rejection.
async function expectSyncFailure(call: () => unknown, message: string) {
  let thrown: unknown, value: unknown
  try { value = call() } catch (error) { thrown = error }
  const observed = Promise.allSettled([value])
  expect((thrown as Error | undefined)?.message).toContain(message)
  expect(await observed).toEqual([{ status: 'fulfilled', value: undefined }])
}

describe.each([false, true])('actual Expo loader parity, compact=%s', (compact) => {
  it('preserves concurrent loading, exact _result promises and one module execution', async () => {
    const h = harness(compact)
    const a = h.adapter(7, h.paths), b = h.adapter(7, h.paths)
    const observed = Promise.allSettled([a, b])
    expect(a).toBe(h.originalReturns[0])
    expect(b).toBe(h.originalReturns[1])
    expect(a._result).toBe(a)
    expect(b._result).toBe(b)
    expect(h.context.sideEffects).toBe(0)
    expect(h.context[`${prefix}__loadBundleAsync`].isReady(files)).toBe(false)
    const results = await observed
    expect(results).toEqual([
      expect.objectContaining({ status: 'fulfilled', value: expect.objectContaining({ value: 42 }) }),
      expect.objectContaining({ status: 'fulfilled', value: expect.objectContaining({ value: 42 }) }),
    ])
    expect(h.requests).toEqual(files)
    expect(h.context.sideEffects).toBe(1)
    const settled = h.adapter(7, h.paths)
    const settledObserved = Promise.allSettled([settled])
    expect(settled._result.value).toBe(42)
    expect(await settledObserved).toEqual([{ status: 'fulfilled', value: settled._result }])
    expect(h.requests).toEqual(files)
  })

  it('uses completions recorded before installing the loader and imports synchronously', async () => {
    const h = harness(compact, { preload: true })
    const result = h.adapter.unstable_importMaybeSync(7, h.paths)
    const observed = Promise.allSettled([result])
    expect(result.value).toBe(42)
    expect(await observed).toEqual([{ status: 'fulfilled', value: result }])
    expect(h.requests).toEqual([])
    expect(h.context.sideEffects).toBe(1)
  })

  it('rejects before initial loader availability instead of falsely declaring readiness', async () => {
    const h = harness(compact, { unavailable: true })
    await expectSyncFailure(() => h.adapter.unstable_importMaybeSync(7, h.paths), 'async bundle loader is unavailable')
    expect(h.requests).toEqual([])
  })

  it('preserves failure cleanup and retry', async () => {
    const h = harness(compact)
    h.fail()
    await expect(h.adapter(7, h.paths)).rejects.toThrow('transport failure')
    expect((await h.adapter(7, h.paths)).value).toBe(42)
    expect(h.requests.filter((file) => file === files[0])).toHaveLength(2)
  })

  it('does not accept a load event without a completed registration, and can retry', async () => {
    const h = harness(compact)
    h.completion(false)
    await expect(h.adapter(7, h.paths)).rejects.toThrow('did not finish registering')
    h.completion(true)
    expect((await h.adapter(7, h.paths)).value).toBe(42)
    expect(h.requests.filter((file) => file === files[0])).toHaveLength(2)
  })

  it('keeps prefetch swallowing, retry and scalar worker resolution', async () => {
    const h = harness(compact)
    h.fail()
    const result = h.adapter.prefetch(7, h.paths)
    const observed = Promise.allSettled([result])
    expect(result).toBeUndefined()
    await h.drainTransport()
    expect(await observed).toEqual([{ status: 'fulfilled', value: undefined }])
    expect((await h.adapter(7, h.paths)).value).toBe(42)
    expect(h.adapter.unstable_resolve(9, { 9: '/worker.js?base=one' })).toBe('/worker.js?base=one')
    expect(h.adapter.unstable_createWorker).toBe(h.original.unstable_createWorker)
    expect(Object.keys(h.adapter).sort()).toEqual(Object.keys(h.original).sort())
  })
})

it('fails closed for a registry absent from the actual VM global before any transport', async () => {
  const h = harness(true)
  const key = `${prefix}__METRAVEL_CHUNK_METADATA__`
  // Node's context object is a sandbox, not the realm's global object. Deleting
  // only its property can leave the VM-global property visible to the adapter.
  const before = { sandbox: h.context[key], realm: h.globals[key] }
  expect(before.sandbox).toBe(before.realm)
  expect(before.realm).toEqual(registry)
  expect(vm.runInContext(`delete globalThis[${JSON.stringify(key)}]`, h.context)).toBe(true)
  expect(h.context[key]).toBeUndefined()
  expect(vm.runInContext(`globalThis[${JSON.stringify(key)}]`, h.context)).toBeUndefined()
  await expectSyncFailure(() => h.adapter(7, h.paths), 'missing registry')
  expect(h.requests).toEqual([])
})

it('fails closed for an unknown descriptor version with a present registry', async () => {
  const h = harness(true)
  expect(h.globals[`${prefix}__METRAVEL_CHUNK_METADATA__`]).toEqual(registry)
  await expectSyncFailure(() => h.adapter(7, ['mc2', 0]), 'descriptor version')
  await expectSyncFailure(() => h.adapter.unstable_importMaybeSync(7, ['mc2', 0]), 'descriptor version')
  expect(h.requests).toEqual([])
})

it('rejects a registry from a different Metro global prefix', async () => {
  const h = harness(true)
  h.context[`${prefix}__METRAVEL_CHUNK_METADATA__`] = { ...registry, p: 'other_' }
  await expectSyncFailure(() => h.adapter(7, h.paths), 'registry global prefix')
  expect(h.requests).toEqual([])
})
