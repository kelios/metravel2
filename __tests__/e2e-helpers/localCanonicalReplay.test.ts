import type { BrowserContext, Page, Route } from '@playwright/test'
import {
  beginLocalCanonicalReplayLifecycle,
  finishLocalCanonicalReplayBoundaries,
  installLocalCanonicalReplayBoundary,
  LOCAL_REPLAY_TRAVEL_ID,
  localCanonicalReplayContextOptions,
  mockLocalFixtureLoaderFallback,
} from '../../e2e/helpers/localCanonicalReplay'

type Handler = (route: Route) => Promise<void>
const origin = 'http://127.0.0.1:8085'
const view = `https://metravel.by/api/travels/${LOCAL_REPLAY_TRAVEL_ID}/view/`
const priorReplay = process.env.E2E_CANONICAL_CLIENT_REPLAY
let owner: ReturnType<typeof beginLocalCanonicalReplayLifecycle> | undefined

async function finishOwnedLifecycle() {
  const current = owner
  owner = undefined
  if (current) await finishLocalCanonicalReplayBoundaries(current)
}

beforeEach(() => {
  process.env.E2E_CANONICAL_CLIENT_REPLAY = '1'
  owner = beginLocalCanonicalReplayLifecycle()
})
afterEach(async () => {
  try { await finishOwnedLifecycle() } finally {
    if (priorReplay === undefined) delete process.env.E2E_CANONICAL_CLIENT_REPLAY
    else process.env.E2E_CANONICAL_CLIENT_REPLAY = priorReplay
  }
})

function request(method: string, url: string) {
  const fulfill = jest.fn(async () => undefined)
  const abort = jest.fn(async () => undefined)
  const continueRequest = jest.fn(async () => undefined)
  return { fulfill, abort, continueRequest, route: {
    request: () => ({ method: () => method, url: () => url }),
    fulfill, abort, continue: continueRequest,
  } as unknown as Route }
}

function context() {
  const handlers = new Map<string, Handler>()
  const close = jest.fn(async (): Promise<void> => undefined)
  const route = jest.fn(async (pattern: string, handler: Handler) => { handlers.set(pattern, handler) })
  const value = { route, close } as unknown as BrowserContext
  return { value, handlers, close, route }
}

it('keeps normal regression mode untouched without the explicit replay opt-in', async () => {
  delete process.env.E2E_CANONICAL_CLIENT_REPLAY
  const c = context()
  await installLocalCanonicalReplayBoundary(c.value, { baseURL: 'https://metravel.by', travelId: 1 })
  expect(c.route).not.toHaveBeenCalled()
  await finishOwnedLifecycle()
  expect(c.close).not.toHaveBeenCalled()
  expect(localCanonicalReplayContextOptions()).toEqual({})
})

it('requires service-worker blocking in default and cold replay context options', () => {
  expect(localCanonicalReplayContextOptions()).toEqual({ serviceWorkers: 'block' })
})

it.each(['https://metravel.by', 'http://other.test', `${origin}/?query=1`, `${origin}?`, 'http://u:p@127.0.0.1:8085', undefined])('refuses replay on untrusted origin %s before routing', async baseURL => {
  const c = context()
  await expect(installLocalCanonicalReplayBoundary(c.value, { baseURL, travelId: LOCAL_REPLAY_TRAVEL_ID })).rejects.toThrow(/loopback/)
  expect(c.route).not.toHaveBeenCalled()
})

it('refuses a real or different article identity before routing', async () => {
  const c = context()
  await expect(installLocalCanonicalReplayBoundary(c.value, { baseURL: origin, travelId: 544 })).rejects.toThrow(/synthetic/)
  expect(c.route).not.toHaveBeenCalled()
})

it('simulates only the known compiled-production synthetic view and keeps API reads real', async () => {
  const c = context()
  await installLocalCanonicalReplayBoundary(c.value, { baseURL: origin, travelId: LOCAL_REPLAY_TRAVEL_ID })
  const post = request('POST', view)
  await c.handlers.get('**/api/**')!(post.route)
  expect(post.fulfill).toHaveBeenCalledWith({ status: 204 })
  expect(post.continueRequest).not.toHaveBeenCalled()
  const read = request('GET', 'https://metravel.by/api/travels/by-slug/e2e-stable-travel-details/')
  await c.handlers.get('**/api/**')!(read.route)
  expect(read.continueRequest).toHaveBeenCalledTimes(1)
  await finishOwnedLifecycle()
  expect(c.close).toHaveBeenCalledTimes(1)
})

it.each(['GET', 'HEAD', 'OPTIONS'])('keeps non-API %s reads outside the write fence', async method => {
  const c = context()
  await installLocalCanonicalReplayBoundary(c.value, { baseURL: origin, travelId: LOCAL_REPLAY_TRAVEL_ID })
  const q = request(method, 'https://assets.test/image.png')
  await c.handlers.get('**/*')!(q.route)
  expect(q.continueRequest).toHaveBeenCalledTimes(1)
  expect(q.abort).not.toHaveBeenCalled()
  await finishOwnedLifecycle()
})

it.each([
  ['POST', `${view}?extra=1`], ['POST', `${view}?`], ['POST', view.replace('metravel.by', 'other.test')],
  ['POST', view.replace(String(LOCAL_REPLAY_TRAVEL_ID), '544')], ['PUT', view],
  ['POST', 'https://metravel.by/api/travels/upsert/'],
])('blocks undeclared API write %s %s and fails validation after cleanup', async (method, url) => {
  const c = context()
  await installLocalCanonicalReplayBoundary(c.value, { baseURL: origin, travelId: LOCAL_REPLAY_TRAVEL_ID })
  const q = request(method, url)
  await c.handlers.get('**/api/**')!(q.route)
  expect(q.abort).toHaveBeenCalledWith('blockedbyclient')
  expect(q.continueRequest).not.toHaveBeenCalled()
  await expect(finishOwnedLifecycle()).rejects.toThrow(/rejected writes/)
  expect(c.close).toHaveBeenCalledTimes(1)
})

it('closes every cold/default context even when the first reports a late write', async () => {
  const a = context(), b = context()
  await installLocalCanonicalReplayBoundary(a.value, { baseURL: origin, travelId: LOCAL_REPLAY_TRAVEL_ID })
  await installLocalCanonicalReplayBoundary(b.value, { baseURL: origin, travelId: LOCAL_REPLAY_TRAVEL_ID })
  a.close.mockImplementation(async () => {
    await a.handlers.get('**/*')!(request('POST', 'https://tracker.test/collect').route)
  })
  await expect(finishOwnedLifecycle()).rejects.toThrow(/collect/)
  expect(a.close).toHaveBeenCalledTimes(1)
  expect(b.close).toHaveBeenCalledTimes(1)
})

it('reports failed cleanup after still attempting to close the other context', async () => {
  // This deliberately latched STOP belongs to its own module instance.
  let isolated!: typeof import('../../e2e/helpers/localCanonicalReplay')
  jest.isolateModules(() => { isolated = require('../../e2e/helpers/localCanonicalReplay') })
  const a = context(), b = context()
  const isolatedOwner = isolated.beginLocalCanonicalReplayLifecycle()
  await isolated.installLocalCanonicalReplayBoundary(a.value, { baseURL: origin, travelId: LOCAL_REPLAY_TRAVEL_ID })
  await isolated.installLocalCanonicalReplayBoundary(b.value, { baseURL: origin, travelId: LOCAL_REPLAY_TRAVEL_ID })
  a.close.mockRejectedValue(new Error('closed-state unavailable'))
  await expect(isolated.finishLocalCanonicalReplayBoundaries(isolatedOwner)).rejects.toThrow(/cleanup/)
  expect(b.close).toHaveBeenCalledTimes(1)
  const next = context()
  await expect(Promise.resolve().then(() => isolated.beginLocalCanonicalReplayLifecycle())).rejects.toThrow(/previous context cleanup/)
  await expect(isolated.installLocalCanonicalReplayBoundary(next.value, { baseURL: origin, travelId: LOCAL_REPLAY_TRAVEL_ID })).rejects.toThrow(/previous context cleanup/)
  expect(next.route).not.toHaveBeenCalled()
})

it('owns exactly the LOCAL synthetic Quest loader, not other quest IDs, methods, queries or origins', async () => {
  let handle: Handler | undefined
  const page = {
    url: () => `${origin}/quests/zurich/perf-budget-quest`,
    route: async (_pattern: string, handler: Handler) => { handle = handler },
  } as unknown as Page
  const path = '/_expo/loaders/(tabs)/quests/zurich/perf-budget-quest'
  await mockLocalFixtureLoaderFallback(page, '/(tabs)/quests/zurich/perf-budget-quest')
  const invoke = async (method: string, url: string) => {
    const q = request(method, url), fallback = jest.fn(async () => undefined)
    await handle!({ ...q.route, fallback } as Route)
    return { ...q, fallback }
  }
  expect((await invoke('GET', origin + path)).fulfill).toHaveBeenCalledWith({ status: 200, contentType: 'application/json', body: 'null' })
  for (const [method, url] of [['POST', origin + path], ['GET', origin + path + '?x=1'], ['GET', origin + path.replace('perf-budget-quest', '4')], ['GET', 'https://metravel.by' + path]]) {
    const result = await invoke(method, url)
    expect(result.fallback).toHaveBeenCalledTimes(1)
    expect(result.fulfill).not.toHaveBeenCalled()
  }
})

it('rejects unsupported cold-context registration before installing any route', async () => {
  await finishOwnedLifecycle()
  const cold = context()
  await expect(installLocalCanonicalReplayBoundary(cold.value, { baseURL: origin, travelId: LOCAL_REPLAY_TRAVEL_ID })).rejects.toThrow(/active fixture lifecycle owner/)
  expect(cold.route).not.toHaveBeenCalled()
  expect(cold.close).not.toHaveBeenCalled()
})

it('admits default and cold contexts under one owner and rejects registration after its teardown', async () => {
  const normal = context(), cold = context(), late = context()
  await installLocalCanonicalReplayBoundary(normal.value, { baseURL: origin, travelId: LOCAL_REPLAY_TRAVEL_ID })
  await installLocalCanonicalReplayBoundary(cold.value, { baseURL: origin, travelId: LOCAL_REPLAY_TRAVEL_ID })
  await installLocalCanonicalReplayBoundary(normal.value, { baseURL: origin, travelId: LOCAL_REPLAY_TRAVEL_ID })
  expect(normal.route).toHaveBeenCalledTimes(2)
  expect(cold.route).toHaveBeenCalledTimes(2)
  await finishOwnedLifecycle()
  expect(normal.close).toHaveBeenCalledTimes(1)
  expect(cold.close).toHaveBeenCalledTimes(1)
  await expect(installLocalCanonicalReplayBoundary(late.value, { baseURL: origin, travelId: LOCAL_REPLAY_TRAVEL_ID })).rejects.toThrow(/active fixture lifecycle owner/)
  expect(late.route).not.toHaveBeenCalled()
})

it('rejects a second owner or foreign cleanup without disturbing the actual owner', async () => {
  const normal = context()
  await installLocalCanonicalReplayBoundary(normal.value, { baseURL: origin, travelId: LOCAL_REPLAY_TRAVEL_ID })
  expect(() => beginLocalCanonicalReplayLifecycle()).toThrow(/already has an active/)
  await expect(finishLocalCanonicalReplayBoundaries({ token: Symbol('not the owner') })).rejects.toThrow(/active fixture lifecycle owner/)
  expect(normal.close).not.toHaveBeenCalled()
  await finishOwnedLifecycle()
  expect(normal.close).toHaveBeenCalledTimes(1)
})

it('stops cold-context admission while its owner is closing', async () => {
  const normal = context(), late = context()
  await installLocalCanonicalReplayBoundary(normal.value, { baseURL: origin, travelId: LOCAL_REPLAY_TRAVEL_ID })
  normal.close.mockImplementation(async () => {
    await expect(installLocalCanonicalReplayBoundary(late.value, { baseURL: origin, travelId: LOCAL_REPLAY_TRAVEL_ID })).rejects.toThrow(/active fixture lifecycle owner/)
  })
  await finishOwnedLifecycle()
  expect(late.route).not.toHaveBeenCalled()
})

// Exercise actual Playwright collection/fixture inheritance, not just an options object.
// Each child runs two cached consumers; their context fixture fails before browser admission.
it.each([
  ['1', 'allow', 'block'],
  [undefined, 'allow', 'allow'],
  [undefined, 'block', 'block'],
])('carries cached shared-fixture SW policy to both consumers (replay=%s inherited=%s)', (replay, inherited, expected) => {
  const fs: typeof import('node:fs') = require('node:fs')
  const path: typeof import('node:path') = require('node:path')
  const childProcess: typeof import('node:child_process') = require('node:child_process')
  const root = path.resolve(__dirname, '../..')
  const scratchRoot = path.join(root, '.codex-temp')
  fs.mkdirSync(scratchRoot, { recursive: true })
  const scratch = fs.mkdtempSync(path.join(scratchRoot, 'local-replay-policy-'))
  const fixture = path.join(root, 'e2e/fixtures/localCanonicalReplay.ts')
  const key = 'local-replay-two-consumer-contract'
  try {
    for (const name of ['a', 'b']) {
      const consumer = `const { test: shared, expect } = require(${JSON.stringify(fixture)});
const key=Symbol.for(${JSON.stringify(key)});
const cache=globalThis[key]??={test:shared,consumers:[]};
if(cache.test!==shared)throw new Error('Shared fixture identity changed across consumers');
cache.consumers.push(${JSON.stringify(name)});
const test=shared.extend({
  localCanonicalReplayBoundary:[async ({},use)=>{await use();},{auto:true}],
  context:async ({},use)=>{throw new Error('Browser/context forbidden in offline fixture policy control');},
  page:async ({},use)=>{throw new Error('Page forbidden in offline fixture policy control');},
});
test('cached consumer ${name}',async ({serviceWorkers})=>{
  expect(serviceWorkers).toBe(${JSON.stringify(expected)});
  expect(require.cache[require.resolve(${JSON.stringify(fixture)})].exports.test).toBe(shared);
  ${name === 'b' ? "expect(cache.consumers).toEqual(['a','b']);" : "expect(cache.consumers).toContain('a');"}
});
`
      fs.writeFileSync(path.join(scratch, `${name}.spec.cjs`), consumer)
    }
    const config = path.join(scratch, 'playwright.config.cjs')
    fs.writeFileSync(config, `module.exports={testDir:${JSON.stringify(scratch)},testMatch:'*.spec.cjs',workers:1,fullyParallel:false,retries:0,timeout:5000,reporter:'json',use:{serviceWorkers:${JSON.stringify(inherited)}}};`)
    const env = { ...process.env }
    delete env.JEST_WORKER_ID
    if (replay === undefined) delete env.E2E_CANONICAL_CLIENT_REPLAY
    else env.E2E_CANONICAL_CLIENT_REPLAY = replay
    const playwrightPackagePath = require.resolve('playwright/package.json')
    const playwrightPackage = JSON.parse(fs.readFileSync(playwrightPackagePath, 'utf8'))
    const playwrightCLI = path.resolve(path.dirname(playwrightPackagePath), playwrightPackage.bin.playwright)
    const result = childProcess.spawnSync(process.execPath, [playwrightCLI, 'test', '--config', config, '--workers=1', '--retries=0'], { cwd: root, env, encoding: 'utf8', timeout: 20000 })
    if (result.status !== 0) throw new Error(`Offline fixture control failed: ${result.stderr}\n${result.stdout}`)
    expect(result.error).toBeUndefined()
    const report = JSON.parse(result.stdout)
    expect(report.stats).toEqual(expect.objectContaining({ expected: 2, unexpected: 0, skipped: 0, flaky: 0 }))
    expect(report.errors).toEqual([])
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true })
  }
}, 25000)
