/** @jest-environment node */
import { fetchPublicRouteJson } from '@/utils/ssr/fetchPublicRouteJson'

describe('guest server route transport', () => {
  const originalFetch = global.fetch
  const originalPublicOrigin = process.env.EXPO_PUBLIC_API_URL
  const originalInternalOrigin = process.env.SSR_API_ORIGIN
  const fetchMock = jest.fn()

  beforeEach(() => {
    jest.useFakeTimers()
    process.env.EXPO_PUBLIC_API_URL = 'https://metravel.by'
    process.env.SSR_API_ORIGIN = 'http://app:8000'
    global.fetch = fetchMock
    fetchMock.mockReset().mockResolvedValue({ ok: true, status: 200, json: async () => ({ schema_version: 2 }) })
  })

  afterEach(() => {
    global.fetch = originalFetch
    if (originalPublicOrigin === undefined) delete process.env.EXPO_PUBLIC_API_URL
    else process.env.EXPO_PUBLIC_API_URL = originalPublicOrigin
    if (originalInternalOrigin === undefined) delete process.env.SSR_API_ORIGIN
    else process.env.SSR_API_ORIGIN = originalInternalOrigin
    jest.useRealTimers()
  })

  it('uses configured Django host, no visitor authentication, and releases resources', async () => {
    await expect(fetchPublicRouteJson({ signal: new AbortController().signal }, 'quests/web/detail/17/demo/?lang=pl'))
      .resolves.toEqual({ schema_version: 2 })
    expect(fetchMock).toHaveBeenCalledWith('http://app:8000/api/quests/web/detail/17/demo/?lang=pl', expect.objectContaining({
      credentials: 'omit', headers: { Accept: 'application/json', Host: 'metravel.by', 'X-Forwarded-Proto': 'https' },
    }))
    expect(jest.getTimerCount()).toBe(0)
  })

  it.each(['https://other.example/api/', '//other.example/api/', '../private', '%2e%2e/private', 'quests/%2e%2e%2f%2e%2e/private', 'quests\\private'])(
    'rejects an endpoint that escapes its configured API boundary: %s', async (endpoint) => {
      await expect(fetchPublicRouteJson({ signal: new AbortController().signal }, endpoint)).rejects.toMatchObject({ httpStatus: 503 })
      expect(fetchMock).not.toHaveBeenCalled()
    },
  )

  it('cancels transport when the document request is aborted and clears its timer', async () => {
    fetchMock.mockImplementationOnce((_url, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true })
    }))
    const controller = new AbortController()
    const pending = fetchPublicRouteJson({ signal: controller.signal }, 'travels/by-slug/demo/')
    controller.abort()
    await expect(pending).rejects.toMatchObject({ httpStatus: 503 })
    expect(jest.getTimerCount()).toBe(0)
  })

  it('retains unavailable/not-found status instead of exposing an upstream error body', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 404 })
    await expect(fetchPublicRouteJson({ signal: new AbortController().signal }, 'travels/by-slug/missing/'))
      .rejects.toMatchObject({ httpStatus: 404 })
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500 })
    await expect(fetchPublicRouteJson({ signal: new AbortController().signal }, 'travels/by-slug/demo/'))
      .rejects.toMatchObject({ httpStatus: 503 })
    expect(jest.getTimerCount()).toBe(0)
  })
})
