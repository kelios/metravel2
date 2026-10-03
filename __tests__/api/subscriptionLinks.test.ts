// #2121: хелперы ссылок подтверждения/отписки рассылки. Сбой сети, таймаут, 429
// и 5xx — `error`, а не `invalid`; 404 — `invalid`; ретраев нет.

const mockFetchWithTimeout = jest.fn()

jest.mock('@/utils/fetchWithTimeout', () => ({
  fetchWithTimeout: (...args: unknown[]) => mockFetchWithTimeout(...args),
}))

jest.mock('@/api/apiConfig', () => ({
  API_BASE_URL: 'https://api.test/api',
  DEFAULT_TIMEOUT: 10000,
}))

import {
  confirmEmailSubscription,
  unsubscribeEmailSubscription,
} from '@/api/subscriptionLinks'

const jsonResponse = (status: number, body: unknown) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => 'application/json' },
    text: async () => JSON.stringify(body),
    json: async () => body,
    clone() {
      return this
    },
  }) as unknown as Response

describe('subscription link API helpers', () => {
  beforeEach(() => mockFetchWithTimeout.mockReset())

  it('confirm: 200 ok → confirmed, GET with encoded token, JSON accept, no cookies', async () => {
    mockFetchWithTimeout.mockResolvedValueOnce(jsonResponse(200, { ok: true, status: 'confirmed' }))

    await expect(confirmEmailSubscription(' a/b c ')).resolves.toBe('confirmed')

    expect(mockFetchWithTimeout).toHaveBeenCalledTimes(1)
    const [url, init] = mockFetchWithTimeout.mock.calls[0]
    expect(url).toBe('https://api.test/api/subscribe/confirm/a%2Fb%20c/')
    expect(init).toEqual(
      expect.objectContaining({
        method: 'GET',
        credentials: 'omit',
        headers: { Accept: 'application/json' },
      }),
    )
  })

  it('unsubscribe: 200 ok → unsubscribed', async () => {
    mockFetchWithTimeout.mockResolvedValueOnce(jsonResponse(200, { ok: true, status: 'unsubscribed' }))
    await expect(unsubscribeEmailSubscription('tok')).resolves.toBe('unsubscribed')
    expect(mockFetchWithTimeout.mock.calls[0][0]).toBe('https://api.test/api/subscribe/unsubscribe/tok/')
  })

  it('404 → invalid', async () => {
    mockFetchWithTimeout.mockResolvedValueOnce(jsonResponse(404, { detail: 'Not found.' }))
    await expect(confirmEmailSubscription('used')).resolves.toBe('invalid')
  })

  it.each([429, 500, 502])('%i → error, not invalid, and no retry', async (status) => {
    mockFetchWithTimeout.mockResolvedValueOnce(jsonResponse(status, { detail: 'x' }))
    await expect(confirmEmailSubscription('tok')).resolves.toBe('error')
    expect(mockFetchWithTimeout).toHaveBeenCalledTimes(1)
  })

  it('network failure or timeout → error', async () => {
    mockFetchWithTimeout.mockRejectedValueOnce(new TypeError('Network request failed'))
    await expect(unsubscribeEmailSubscription('tok')).resolves.toBe('error')
    const timeout = new Error('timeout')
    timeout.name = 'TimeoutError'
    mockFetchWithTimeout.mockRejectedValueOnce(timeout)
    await expect(confirmEmailSubscription('tok')).resolves.toBe('error')
  })

  it('200 without ok:true → error (never a false success)', async () => {
    mockFetchWithTimeout.mockResolvedValueOnce(jsonResponse(200, { ok: false }))
    await expect(confirmEmailSubscription('tok')).resolves.toBe('error')
  })

  it('empty token → invalid without a request', async () => {
    await expect(confirmEmailSubscription('   ')).resolves.toBe('invalid')
    expect(mockFetchWithTimeout).not.toHaveBeenCalled()
  })
})
