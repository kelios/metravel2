import type { Page, Route } from '@playwright/test'
import { FALLBACK_TRAVEL_ID, FALLBACK_TRAVEL_SLUG, mockFallbackTravelDetails } from '../../e2e/helpers/navigation'

jest.mock('@playwright/test', () => ({ expect: jest.fn() }))

async function requestThroughDetailOwner(pattern: string, pathname: string, method = 'GET', origin = 'https://example.test', pageOrigin = 'https://example.test') {
  const handlers = new Map<string, (route: Route) => Promise<unknown>>()
  const page = {
    route: async (matcher: string, handler: (route: Route) => Promise<unknown>) => { handlers.set(matcher, handler) },
    url: () => `${pageOrigin}/travels/${FALLBACK_TRAVEL_SLUG}`,
  } as unknown as Page
  const unexpected: string[] = []
  // This lower-priority owner represents a scenario's read/mutation sentinel.
  await page.route('**/api/**', async route => {
    unexpected.push(`${route.request().method()} ${new URL(route.request().url()).pathname}`)
    await route.fulfill({ status: 500, contentType: 'application/json', body: '{"detail":"Unclaimed fixture request"}' })
  })
  await mockFallbackTravelDetails(page, { name: 'Scenario article' })
  const owner = handlers.get(pattern)!
  const priorOwner = handlers.get('**/api/**')!
  const continueRequest = jest.fn()
  const fulfill = jest.fn()
  const route = {
    request: () => ({ method: () => method, url: () => `${origin}${pathname}` }),
    fallback: () => priorOwner(route), continue: continueRequest, fulfill,
  } as unknown as Route
  await owner(route)
  return { unexpected, continueRequest, fulfill }
}

it.each(['by-slug', 'resolve-slug'])('keeps an unknown %s read inside the prior fixture sentinel', async kind => {
  const pathname = `/api/travels/${kind}/not-the-scenario-article/`
  const result = await requestThroughDetailOwner(`**/api/travels/${kind}/**`, `${pathname}?lang=ru`)
  expect(result.unexpected).toEqual([`GET ${pathname}`])
  expect(result.fulfill).toHaveBeenCalledWith(expect.objectContaining({ status: 500 }))
  expect(result.continueRequest).not.toHaveBeenCalled()
})

it('leaves non-GET details to the prior mutation owner', async () => {
  const pathname = `/api/travels/by-slug/${FALLBACK_TRAVEL_SLUG}/`
  const result = await requestThroughDetailOwner('**/api/travels/by-slug/**', pathname, 'POST')
  expect(result.unexpected).toEqual([`POST ${pathname}`])
  expect(result.fulfill).toHaveBeenCalledWith(expect.objectContaining({ status: 500 }))
  expect(result.continueRequest).not.toHaveBeenCalled()
})

it('still owns the exact scenario details without reaching the sentinel', async () => {
  const result = await requestThroughDetailOwner('**/api/travels/by-slug/**', `/api/travels/by-slug/${FALLBACK_TRAVEL_SLUG}/?lang=ru`)
  expect(result.fulfill).toHaveBeenCalledWith(expect.objectContaining({ status: 200, contentType: 'application/json' }))
  expect(JSON.parse(result.fulfill.mock.calls[0][0].body).name).toBe('Scenario article')
  expect(result.unexpected).toEqual([])
  expect(result.continueRequest).not.toHaveBeenCalled()
})

const viewPath = `/api/travels/${FALLBACK_TRAVEL_ID}/view/`
const viewOwner = `**/api/travels/${FALLBACK_TRAVEL_ID}/view/**`

it('owns the declared synthetic article view without sending a write to the server', async () => {
  const result = await requestThroughDetailOwner(viewOwner, viewPath, 'POST')
  expect(result.fulfill).toHaveBeenCalledTimes(1)
  expect(result.fulfill).toHaveBeenCalledWith({ status: 204 })
  expect(result.unexpected).toEqual([])
  expect(result.continueRequest).not.toHaveBeenCalled()
})

it.each([
  ['GET', viewPath, 'https://example.test'],
  ['HEAD', viewPath, 'https://example.test'],
  ['OPTIONS', viewPath, 'https://example.test'],
  ['PATCH', viewPath, 'https://example.test'],
  ['DELETE', viewPath, 'https://example.test'],
  ['POST', '/api/travels/1/view/', 'https://example.test'],
  ['POST', `${viewPath}?extra=1`, 'https://example.test'],
  ['POST', `${viewPath}alias`, 'https://example.test'],
  ['POST', viewPath, 'https://other.test'],
])('leaves undeclared fixture-view request %s %s at %s with the prior sentinel', async (method, pathname, origin) => {
  const result = await requestThroughDetailOwner(viewOwner, pathname, method, origin)
  expect(result.unexpected).toEqual([`${method} ${new URL(pathname, origin).pathname}`])
  expect(result.fulfill).toHaveBeenCalledWith(expect.objectContaining({ status: 500 }))
  expect(result.continueRequest).not.toHaveBeenCalled()
})

const loaderOwner = '**/_expo/loaders/**'
const loaderPath = `/_expo/loaders/(tabs)/travels/${FALLBACK_TRAVEL_SLUG}`
const localOrigin = 'http://127.0.0.1:8085'

it('gives only the exact LOCAL synthetic SSR loader the supported null/client fallback', async () => {
  const result = await requestThroughDetailOwner(loaderOwner, loaderPath, 'GET', localOrigin, localOrigin)
  expect(result.fulfill).toHaveBeenCalledWith({ status: 200, contentType: 'application/json', body: 'null' })
  expect(result.unexpected).toEqual([])
  expect(result.continueRequest).not.toHaveBeenCalled()
})

it.each([
  ['POST', loaderPath, localOrigin, localOrigin],
  ['HEAD', loaderPath, localOrigin, localOrigin],
  ['OPTIONS', loaderPath, localOrigin, localOrigin],
  ['GET', `${loaderPath}?extra=1`, localOrigin, localOrigin],
  ['GET', `${loaderPath}?`, localOrigin, localOrigin],
  ['GET', `${loaderPath}/`, localOrigin, localOrigin],
  ['GET', '/_expo/loaders/(tabs)/travels/470', localOrigin, localOrigin],
  ['GET', loaderPath, 'http://localhost:8085', localOrigin],
  ['GET', loaderPath, 'https://metravel.by', 'https://metravel.by'],
])('does not fake undeclared SSR data for %s %s from %s with page %s', async (method, pathname, origin, pageOrigin) => {
  const result = await requestThroughDetailOwner(loaderOwner, pathname, method, origin, pageOrigin)
  expect(result.unexpected).toEqual([`${method} ${new URL(pathname, origin).pathname}`])
  expect(result.fulfill).toHaveBeenCalledWith(expect.objectContaining({ status: 500 }))
  expect(result.continueRequest).not.toHaveBeenCalled()
})

it('rejects a shared-navigation consumer without the replay fixture owner before routing or navigation', async () => {
  const previous = process.env.E2E_CANONICAL_CLIENT_REPLAY
  process.env.E2E_CANONICAL_CLIENT_REPLAY = '1'
  const contextRoute = jest.fn(), pageRoute = jest.fn(), pageUrl = jest.fn(), goto = jest.fn()
  const page = {
    context: () => ({ route: contextRoute }), route: pageRoute, url: pageUrl, goto,
  } as unknown as Page
  try {
    await expect(mockFallbackTravelDetails(page)).rejects.toThrow(/active fixture lifecycle owner/)
    expect(contextRoute).not.toHaveBeenCalled()
    expect(pageRoute).not.toHaveBeenCalled()
    expect(pageUrl).not.toHaveBeenCalled()
    expect(goto).not.toHaveBeenCalled()
  } finally {
    if (previous === undefined) delete process.env.E2E_CANONICAL_CLIENT_REPLAY
    else process.env.E2E_CANONICAL_CLIENT_REPLAY = previous
  }
})
