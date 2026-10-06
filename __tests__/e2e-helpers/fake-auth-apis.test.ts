import type { Page, Route } from '@playwright/test'
import { ensureAuthedStorageFallback, mockFakeAuthApis } from '../../e2e/helpers/auth'

type Matcher = string | ((url: URL) => boolean)
type Handler = (route: Route) => unknown

function fixture() {
  const routes: Array<{ matcher: Matcher; handler: Handler }> = []
  const page = {
    route: async (matcher: Matcher, handler: Handler) => { routes.push({ matcher, handler }) },
    evaluate: async (fn: () => unknown) => fn(),
    addInitScript: async (fn: (metadata: unknown) => unknown, metadata: unknown) => fn(metadata),
  } as unknown as Page
  const matches = (matcher: Matcher, url: URL) => typeof matcher === 'function' ? matcher(url) :
    new RegExp('^' + matcher.split('**').map((part) => part.split('*').map((value) => value.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('[^/]*')).join('.*') + '$').test(url.href)
  const request = async (pathname: string, method = 'GET', omitExactEndpoint = false) => {
    const url = new URL(pathname, 'https://example.test')
    const candidates = routes.filter(({ matcher }) => matches(matcher, url) && !(omitExactEndpoint && typeof matcher === 'function')).reverse()
    const fulfill = jest.fn()
    const continueRequest = jest.fn()
    const run = async (index: number): Promise<unknown> => {
      if (!candidates[index]) return continueRequest()
      return candidates[index].handler({
        request: () => ({ method: () => method }), fulfill,
        fallback: () => run(index + 1), continue: continueRequest,
      } as unknown as Route)
    }
    await run(0)
    return { fulfill, continueRequest, response: fulfill.mock.calls[0]?.[0] }
  }
  return { page, request }
}

beforeEach(() => window.localStorage.clear())

it.each(['1', '27'])('common fake hydration endpoints agree with seeded fixture %s', async (userId) => {
  const { page, request } = fixture()
  await ensureAuthedStorageFallback(page, { userId })
  await mockFakeAuthApis(page)
  const me = await request('/api/user/me/?probe=1')
  expect(me.response).toMatchObject({ status: 200, contentType: 'application/json' })
  expect(JSON.parse(me.response.body)).toEqual({ id: Number(userId), terms_accepted_current: true })
  const blocked = await request('/api/user/blocked/?page=1')
  expect(blocked.response).toMatchObject({ status: 200, contentType: 'application/json' })
  expect(JSON.parse(blocked.response.body)).toEqual([])
  const profile = await request(`/api/user/${userId}/profile/`)
  expect(JSON.parse(profile.response.body)).toMatchObject({ id: Number(userId), user: Number(userId) })
})

it('keeps the specific verification owner and does not shadow neighboring user paths', async () => {
  const { page, request } = fixture()
  await mockFakeAuthApis(page)
  expect(JSON.parse((await request('/api/user/me/verifications/')).response.body)).toEqual({})
  for (const pathname of ['/api/user/me/other/', '/api/user/blocked/27/', '/api/user/me-other/']) {
    const result = await request(pathname)
    expect(result.fulfill).not.toHaveBeenCalled()
    expect(result.continueRequest).toHaveBeenCalledTimes(1)
  }
})

it.each(['POST', 'PATCH', 'DELETE'])('new exact mocks preserve %s request fallthrough', async (method) => {
  const { page, request } = fixture()
  await mockFakeAuthApis(page)
  for (const pathname of ['/api/user/me/', '/api/user/blocked/']) {
    const result = await request(pathname, method)
    expect(result.fulfill).not.toHaveBeenCalled()
    expect(result.continueRequest).toHaveBeenCalledTimes(1)
  }
})

it('negative control: missing common exact owner reaches the unmocked request', async () => {
  const { page, request } = fixture()
  await mockFakeAuthApis(page)
  for (const pathname of ['/api/user/me/', '/api/user/blocked/']) {
    const without = await request(pathname, 'GET', true)
    expect(without.fulfill).not.toHaveBeenCalled()
    expect(without.continueRequest).toHaveBeenCalledTimes(1)
    const restored = await request(pathname)
    expect(restored.response.status).toBe(200)
    expect(restored.continueRequest).not.toHaveBeenCalled()
  }
})

it.each([null, '', 'bad', '-1', '1.5'])('defaults invalid fixture identity %s consistently', async (userId) => {
  const { page, request } = fixture()
  if (userId !== null) localStorage.setItem('userId', userId)
  await mockFakeAuthApis(page)
  expect(JSON.parse((await request('/api/user/me/')).response.body).id).toBe(1)
  expect(JSON.parse((await request('/api/user/1/profile/')).response.body)).toMatchObject({ id: 1, user: 1 })
})
