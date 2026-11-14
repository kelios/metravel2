/**
 * #2481: the client request limiter (`routeCache`) must defer a route build,
 * never end it. A finish replaced within MIN_REQUEST_INTERVAL of the previous
 * request used to leave a terminal straight line with `rate_limit` until the
 * user moved a point again.
 */
import { act, renderHook } from '@testing-library/react-native'
import { useRouting } from '@/components/MapPage/useRouting'
import { routeCache } from '@/utils/routeCache'

type LngLat = [number, number]
type RoutingSnapshot = ReturnType<typeof useRouting>

const START: LngLat = [27.56, 53.9]
const FINISH_A: LngLat = [27.565, 53.905]
const FINISH_B: LngLat = [27.57, 53.904]
const FINISH_C: LngLat = [27.572, 53.907]

const routedGeometry = (from: LngLat, to: LngLat): LngLat[] => [
  from,
  [from[0] + 0.001, to[1]],
  to,
]

const fetchMock = jest.fn()

const serverRouteResponse = (_url: unknown, init?: { body?: string }) => {
  const body = JSON.parse(String(init?.body ?? '{}'))
  const points: LngLat[] = body.points.map(
    (p: { lat: number; lng: number }) => [p.lng, p.lat],
  )
  return Promise.resolve({
    ok: true,
    json: async () => ({
      geometry: routedGeometry(points[0], points[points.length - 1]),
      distance_m: 850,
      duration_s: 610,
      provider: 'ors',
      is_optimal: true,
    }),
  })
}

const routeCalls = () =>
  fetchMock.mock.calls.filter(([url]) =>
    String(url).includes('/routing/route/'),
  )

const flush = async (ms: number) => {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(ms)
  })
}

const renderRouting = async (initialFinish: LngLat) => {
  const snapshots: RoutingSnapshot[] = []
  const hook = await renderHook(
    ({ finish }: { finish: LngLat }) => {
      const state = useRouting([START, finish], 'foot', undefined)
      snapshots.push(state)
      return state
    },
    { initialProps: { finish: initialFinish } },
  )
  return { ...hook, snapshots }
}

const routeKeyFor = (finish: LngLat) =>
  `foot-${START.join(',')}|${finish.join(',')}`

describe('useRouting — request limiter defers instead of terminating (#2481)', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    jest.useFakeTimers({ now: new Date('2026-11-14T10:00:00Z') })
    routeCache.clear()
    fetchMock.mockReset()
    fetchMock.mockImplementation(serverRouteResponse)
    global.fetch = fetchMock as unknown as typeof fetch
    jest.spyOn(routeCache, 'isRequestLimiterActive').mockReturnValue(true)
    jest.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    jest.restoreAllMocks()
    global.fetch = originalFetch
    routeCache.clear()
    jest.useRealTimers()
  })

  it('replacing the finish within MIN_REQUEST_INTERVAL still builds the road route, without a rate_limit flash', async () => {
    const hook = await renderRouting(FINISH_A)
    await flush(0)

    expect(routeCalls()).toHaveLength(1)
    expect(hook.result.current).toMatchObject({
      isOptimal: true,
      errorCode: null,
      routeKey: routeKeyFor(FINISH_A),
    })

    // Third tap 100 ms after the previous request was recorded.
    await flush(100)
    const firstSnapshotForB = hook.snapshots.length
    await hook.rerender({ finish: FINISH_B })
    await flush(100)
    expect(routeCalls()).toHaveLength(1)

    await flush(400)

    expect(routeCalls()).toHaveLength(2)
    expect(hook.result.current).toMatchObject({
      loading: false,
      error: false,
      errorCode: null,
      isOptimal: true,
      routeKey: routeKeyFor(FINISH_B),
      coords: routedGeometry(START, FINISH_B),
    })
    const shownForB = hook.snapshots
      .slice(firstSnapshotForB)
      .filter((state) => state.routeKey === routeKeyFor(FINISH_B))
    expect(
      shownForB.some(
        (state) => state.errorCode !== null || state.error !== false,
      ),
    ).toBe(false)

    await hook.unmount()
  })

  it('minute quota: honest rate_limit with a direct line, then an automatic retry after the window resets', async () => {
    for (let i = 0; i < 30; i += 1) routeCache.recordRequest()
    await flush(1_000)

    const hook = await renderRouting(FINISH_A)
    await flush(0)

    expect(routeCalls()).toHaveLength(0)
    expect(hook.result.current).toMatchObject({
      loading: false,
      errorCode: 'rate_limit',
      isOptimal: false,
      coords: [START, FINISH_A],
      routeKey: routeKeyFor(FINISH_A),
    })
    expect(hook.result.current.error).toEqual(expect.any(String))
    expect(routeCache.get([START, FINISH_A], 'foot')).toBeNull()

    // One scheduled retry at the window reset, no polling loop while waiting.
    const limiterChecks = jest.spyOn(routeCache, 'canMakeRequest')
    await flush(30_000)
    expect(routeCalls()).toHaveLength(0)
    expect(limiterChecks).not.toHaveBeenCalled()

    await flush(30_000)

    expect(routeCalls()).toHaveLength(1)
    expect(hook.result.current).toMatchObject({
      loading: false,
      error: false,
      errorCode: null,
      isOptimal: true,
      coords: routedGeometry(START, FINISH_A),
    })
    expect(limiterChecks).toHaveBeenCalledTimes(1)
    expect(routeCache.getStats().requestCount).toBe(1)

    await hook.unmount()
  })

  it('a deferred request is dropped on unmount', async () => {
    const hook = await renderRouting(FINISH_A)
    await flush(0)
    await flush(100)
    await hook.rerender({ finish: FINISH_B })
    await hook.unmount()

    await flush(2_000)

    expect(routeCalls()).toHaveLength(1)
  })

  it('a deferred request follows the latest routeKey and fires once', async () => {
    const hook = await renderRouting(FINISH_A)
    await flush(0)
    await flush(100)
    await hook.rerender({ finish: FINISH_B })
    await flush(100)
    await hook.rerender({ finish: FINISH_C })

    await flush(2_000)

    const calls = routeCalls()
    expect(calls).toHaveLength(2)
    expect(JSON.parse(String(calls[1][1]?.body)).points.at(-1)).toEqual({
      lat: FINISH_C[1],
      lng: FINISH_C[0],
    })
    expect(hook.result.current).toMatchObject({
      isOptimal: true,
      errorCode: null,
      routeKey: routeKeyFor(FINISH_C),
      coords: routedGeometry(START, FINISH_C),
    })
    expect(
      hook.snapshots.some(
        (state) => state.routeKey === routeKeyFor(FINISH_B) && state.isOptimal,
      ),
    ).toBe(false)

    await hook.unmount()
  })
})
