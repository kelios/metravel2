import { memoizePublicRouteData } from '@/utils/ssr/publicRouteData'

describe('public route request data', () => {
  it('shares one promise across loader and metadata module copies using the original signal', async () => {
    const signal = new AbortController().signal
    const load = jest.fn().mockResolvedValue({ title: 'First revision' })
    const first = memoizePublicRouteData({ signal }, 'travel:demo', load)
    let second: Promise<unknown> | undefined
    jest.isolateModules(() => {
      const otherBundle = require('@/utils/ssr/publicRouteData') as typeof import('@/utils/ssr/publicRouteData')
      second = otherBundle.memoizePublicRouteData({ signal }, 'travel:demo', load)
    })
    expect(second).toBe(first)
    await expect(first).resolves.toEqual({ title: 'First revision' })
    expect(load).toHaveBeenCalledTimes(1)
  })

  it('isolates concurrent requests and route keys, with no process cache of an old revision', async () => {
    const signal = new AbortController().signal
    const load = jest.fn().mockResolvedValueOnce('old').mockResolvedValueOnce('other route').mockResolvedValueOnce('new')
    await expect(memoizePublicRouteData({ signal }, 'travel:a', load)).resolves.toBe('old')
    await expect(memoizePublicRouteData({ signal }, 'travel:b', load)).resolves.toBe('other route')
    await expect(memoizePublicRouteData({ signal: new AbortController().signal }, 'travel:a', load)).resolves.toBe('new')
    expect(load).toHaveBeenCalledTimes(3)
  })
})
