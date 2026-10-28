// #2822: patches/expo-router+58.0.28.patch — a failing loader path is refetched only after an
// exponential backoff, and after two automatic retries its error stays readable for the error
// boundary. Without it readLoaderData's cleared error made every retry render fetch again
// (1660 requests in 15 s for one visitor on a 503).
import { LoaderClient } from 'expo-router/build/loaders/LoaderClient.js'
import { LoaderSuspenseStore } from 'expo-router/build/loaders/LoaderSuspenseStore.js'
import { readLoaderData } from 'expo-router/build/loaders/readLoaderData.js'

const PATH = '/(tabs)/quests/3/barkovshchina-spirits'

type Result = { data?: unknown; error?: Error }

function readOnce(client: LoaderClient, fetcher: (path: string, init: RequestInit) => Promise<unknown>) {
  return new Promise<Result>((resolve) => {
    const unsubscribe = client.subscribeLoader(PATH, (result: Result) => {
      unsubscribe()
      resolve(result)
    })
    client.execute(PATH, fetcher)
  })
}

describe('expo-router LoaderClient retry backoff (#2822)', () => {
  beforeEach(() => {
    jest.useFakeTimers({ doNotFake: ['queueMicrotask'] })
    jest.setSystemTime(new Date('2026-10-27T14:13:33Z'))
  })
  afterEach(() => jest.useRealTimers())

  it('waits 1 s, 2 s, 4 s before refetching a path that keeps failing', async () => {
    const client = new LoaderClient()
    const fetcher = jest.fn(async () => { throw new Error('Failed to fetch loader data: 503') })

    expect((await readOnce(client, fetcher)).error?.message).toContain(PATH)
    expect(fetcher).toHaveBeenCalledTimes(1)

    for (const waitMs of [1000, 2000, 4000]) {
      const calls = fetcher.mock.calls.length
      const pending = readOnce(client, fetcher)
      await jest.advanceTimersByTimeAsync(waitMs - 1)
      expect(fetcher).toHaveBeenCalledTimes(calls)
      await jest.advanceTimersByTimeAsync(1)
      expect(fetcher).toHaveBeenCalledTimes(calls + 1)
      expect((await pending).error).toBeInstanceOf(Error)
    }
  })

  it('caps the wait at 30 s and forgets the failures after a success', async () => {
    const client = new LoaderClient()
    let failing = true
    const fetcher = jest.fn(async () => {
      if (failing) throw new Error('Failed to fetch loader data: 503')
      return { ok: true }
    })

    for (let attempt = 0; attempt < 8; attempt += 1) {
      await jest.advanceTimersByTimeAsync(30_000)
      await readOnce(client, fetcher)
    }
    const calls = fetcher.mock.calls.length
    const capped = readOnce(client, fetcher)
    await jest.advanceTimersByTimeAsync(29_999)
    expect(fetcher).toHaveBeenCalledTimes(calls)
    failing = false
    await jest.advanceTimersByTimeAsync(1)
    expect((await capped).data).toEqual({ ok: true })

    const afterSuccess = readOnce(client, fetcher)
    expect(fetcher).toHaveBeenCalledTimes(calls + 2)
    await afterSuccess
  })

  it('keeps the third consecutive error readable until its backoff ends', async () => {
    const client = new LoaderClient()
    const store = new LoaderSuspenseStore()
    const fetcher = jest.fn(async () => { throw new Error('Failed to fetch loader data: 503') })
    const failed = { error: new Error('Failed to load loader data for route: ' + PATH) }

    for (const [attempt, autoRetry] of [[1, true], [2, true], [3, false]] as const) {
      await jest.advanceTimersByTimeAsync(4000)
      await readOnce(client, fetcher)
      expect(fetcher).toHaveBeenCalledTimes(attempt)
      store.set(PATH, failed)
      expect(() => readLoaderData({ client, store }, PATH, fetcher)).toThrow(failed.error)
      await Promise.resolve()
      expect(store.get(PATH) === failed).toBe(!autoRetry)
    }

    // The third failure backs off for 4 s: React's retry render rethrows instead of refetching.
    await jest.advanceTimersByTimeAsync(3999)
    expect(() => readLoaderData({ client, store }, PATH, fetcher)).toThrow(failed.error)
    expect(fetcher).toHaveBeenCalledTimes(3)
    await jest.advanceTimersByTimeAsync(1)
    expect(store.get(PATH)).toBeUndefined()
  })

  it('does not fetch a backed-off request once its source is aborted', async () => {
    const client = new LoaderClient()
    const fetcher = jest.fn(async () => { throw new Error('Failed to fetch loader data: 503') })
    await readOnce(client, fetcher)

    client.subscribeLoader(PATH)
    client.execute(PATH, fetcher)
    expect(client.abort(PATH)).toBe(true)
    await jest.advanceTimersByTimeAsync(60_000)
    expect(fetcher).toHaveBeenCalledTimes(1)
  })
})
