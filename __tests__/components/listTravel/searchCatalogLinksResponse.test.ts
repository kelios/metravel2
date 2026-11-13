/** @jest-environment node */
import { AsyncLocalStorage } from 'node:async_hooks'
import type { ImmutableRequest } from 'expo-server'
import { createNodeRequestScope } from 'expo-server/adapter/environment/node'
import type { RequestAPI } from 'expo-server/runtime/scope'
import { loadSearchCatalogLinks } from '@/components/listTravel/searchCatalogLinksLoader'

// The same real request scope used by expo-server's Node HTTP adapter applies
// the loader's queued headers to the final Response. Only the API is mocked.
const store = new AsyncLocalStorage<RequestAPI>()
const run = createNodeRequestScope(store, { build: '', environment: 'production' })
const marker = 'X-Metravel-Search-Catalog-State'
const catalog = { pages: 3, results: [{ slug: 'minsk', title: 'Минск' }] }
const fetchMock = jest.fn()
const oldFetch = global.fetch
const oldEnv = {
  api: process.env.EXPO_PUBLIC_API_URL,
  transport: process.env.SSR_API_ORIGIN,
  ssr: process.env.EXPO_PUBLIC_WEB_RUNTIME_SSR,
}
const expoRuntime = (globalThis as typeof globalThis & Record<symbol, { current: unknown }>)[Symbol.for('expoServerRuntime')]
const oldScope = expoRuntime.current

const answer = (status: number, body: unknown = catalog) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

const render = (query = '') => run(async (request) => {
  // Loader and metadata share a signal and one API result in a real render.
  const [payload, metadataPayload] = await Promise.all([
    loadSearchCatalogLinks(request as unknown as ImmutableRequest),
    loadSearchCatalogLinks(request as unknown as ImmutableRequest),
  ])
  expect(metadataPayload).toBe(payload)
  return Response.json(payload)
}, new Request(`https://metravel.by/search${query}`))

beforeEach(() => {
  process.env.EXPO_PUBLIC_API_URL = 'http://localhost:8000'
  process.env.EXPO_PUBLIC_WEB_RUNTIME_SSR = 'true'
  delete process.env.SSR_API_ORIGIN
  global.fetch = fetchMock
  fetchMock.mockReset().mockImplementation(async () => answer(200))
})

afterAll(() => {
  global.fetch = oldFetch
  for (const [name, value] of Object.entries({
    EXPO_PUBLIC_API_URL: oldEnv.api,
    SSR_API_ORIGIN: oldEnv.transport,
    EXPO_PUBLIC_WEB_RUNTIME_SSR: oldEnv.ssr,
  })) {
    if (value === undefined) delete process.env[name]
    else process.env[name] = value
  }
  store.disable()
  expoRuntime.current = oldScope
})

describe('search catalog loader → renderer response', () => {
  it.each(['', '?page=1'])('marks the 200 first-page fallback for %s', async (query) => {
    fetchMock.mockResolvedValueOnce(answer(500, {}))
    const response = await render(query)
    expect(response.status).toBe(200)
    expect(response.headers.get(marker)).toBe('degraded')
    expect(await response.json()).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it.each(['invalid payload', 'invalid JSON', 'network failure'])('marks the fallback for %s', async (failure) => {
    if (failure === 'invalid payload') fetchMock.mockResolvedValueOnce(answer(200, {}))
    else if (failure === 'invalid JSON') fetchMock.mockResolvedValueOnce(new Response('{', { status: 200 }))
    else fetchMock.mockRejectedValueOnce(new Error('API unavailable'))
    const response = await render()
    expect(response.status).toBe(200)
    expect(response.headers.get(marker)).toBe('degraded')
    expect(await response.json()).toBeNull()
  })

  it.each(['', '?page=1', '?page=2'])('omits the marker for a complete catalog %s', async (query) => {
    const response = await render(query)
    expect(response.status).toBe(200)
    expect(response.headers.has(marker)).toBe(false)
    expect(await response.json()).toMatchObject({ links: [{ path: '/travels/minsk', title: 'Минск' }] })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('keeps later-page failures as 503 refusals without setting a degraded header', async () => {
    fetchMock.mockResolvedValueOnce(answer(500, {}))
    await expect(render('?page=2')).rejects.toMatchObject({ httpStatus: 503 })
    expect((await render()).headers.has(marker)).toBe(false)
  })

  it('preserves a missing-page 404 refusal', async () => {
    fetchMock.mockResolvedValueOnce(answer(404, {}))
    await expect(render('?page=4')).rejects.toMatchObject({ httpStatus: 404 })
  })

  it('does not mark a filtered request or an SSR-disabled request as degraded', async () => {
    expect((await render('?search=minsk')).headers.has(marker)).toBe(false)
    process.env.EXPO_PUBLIC_WEB_RUNTIME_SSR = 'false'
    expect((await render()).headers.has(marker)).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('isolates an interleaved healthy render and the next healthy render from a degraded render', async () => {
    let release!: (value: Response) => void
    fetchMock.mockImplementationOnce(() => new Promise<Response>((resolve) => { release = resolve }))
    const degraded = render()
    // The first memoized fetch starts in the next microtask.
    await Promise.resolve()
    const healthy = render()
    release(answer(500, {}))
    const [failedResponse, healthyResponse] = await Promise.all([degraded, healthy])
    expect(failedResponse.headers.get(marker)).toBe('degraded')
    expect(healthyResponse.headers.has(marker)).toBe(false)
    expect((await render()).headers.has(marker)).toBe(false)
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })
})
