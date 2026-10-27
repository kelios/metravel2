import { Platform } from 'react-native'
import { isChunkLoadError, importWithRetry } from '@/utils/chunkReload'
import { reloadOnceForStaleChunk } from '@/utils/chunkReloadGuard'
import { restoreWindowStubs, stubWindowProperty } from '../helpers/windowStubs'

describe('isChunkLoadError', () => {
  it('matches ChunkLoadError by name', () => {
    const err = new Error('boom')
    ;(err as any).name = 'ChunkLoadError'
    expect(isChunkLoadError(err)).toBe(true)
  })

  it('matches common dynamic-import failure messages', () => {
    expect(isChunkLoadError(new Error('Loading chunk 482 failed.'))).toBe(true)
    expect(isChunkLoadError(new Error('Failed to fetch dynamically imported module: https://x/_expo/abc.js'))).toBe(true)
    expect(isChunkLoadError(new Error('error loading dynamically imported module'))).toBe(true)
    expect(isChunkLoadError(new Error('Importing a module script failed.'))).toBe(true)
  })

  it('ignores unrelated errors and falsy values', () => {
    expect(isChunkLoadError(new Error('Network request failed'))).toBe(false)
    expect(isChunkLoadError(null)).toBe(false)
    expect(isChunkLoadError(undefined)).toBe(false)
  })
})

describe('importWithRetry', () => {
  const originalPlatform = Platform.OS

  afterEach(() => {
    ;(Platform.OS as any) = originalPlatform
    restoreWindowStubs()
    jest.useRealTimers()
  })

  it('returns the module on first success without retrying', async () => {
    const factory = jest.fn().mockResolvedValue({ default: 'ok' })
    const result = await importWithRetry(factory, { retries: 2, retryDelayMs: 0 })
    expect(result).toEqual({ default: 'ok' })
    expect(factory).toHaveBeenCalledTimes(1)
  })

  it('retries a transient failure then succeeds', async () => {
    const factory = jest
      .fn()
      .mockRejectedValueOnce(new Error('Loading chunk 1 failed.'))
      .mockResolvedValue({ default: 'recovered' })

    const result = await importWithRetry(factory, { retries: 2, retryDelayMs: 0 })
    expect(result).toEqual({ default: 'recovered' })
    expect(factory).toHaveBeenCalledTimes(2)
  })

  it('forces a single reload when a chunk stays missing after retries (web)', async () => {
    ;(Platform.OS as any) = 'web'
    const reload = jest.fn()
    const store: Record<string, string> = {}
    // jsdom 26: window.location.reload нельзя подменить, поэтому настоящий guard (sessionStorage + reload)
    // работает над изолированным окном-двойником, а на реальное окно ставится только его точка входа.
    const guardWindow: any = {
      location: { reload, href: 'https://metravel.by/travels/x' },
      sessionStorage: {
        getItem: (k: string) => (k in store ? store[k] : null),
        setItem: (k: string, v: string) => {
          store[k] = v
        },
      },
    }
    stubWindowProperty('__metravelReloadStaleChunk', () => reloadOnceForStaleChunk(guardWindow))

    const factory = jest.fn().mockRejectedValue(new Error('Loading chunk 9 failed.'))

    // The promise never resolves once it triggers a reload, so race it against a tick.
    let settled = false
    void importWithRetry(factory, { retries: 1, retryDelayMs: 0 }).then(() => {
      settled = true
    })

    await new Promise((r) => setTimeout(r, 20))

    expect(reload).toHaveBeenCalledTimes(1)
    expect(settled).toBe(false)
  })
})
