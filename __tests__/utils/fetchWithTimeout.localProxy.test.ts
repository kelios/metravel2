/**
 * @jest-environment-options {"url": "http://localhost:8081/"}
 *
 * Локальный Metro-прокси: fetchWithTimeout повторяет 502 только когда origin окна — localhost:8081.
 * С jsdom 26 `window.location` нельзя подменить, поэтому origin задаётся адресом окружения (#2735).
 */
import { fetchWithTimeout } from '@/utils/fetchWithTimeout'

describe('fetchWithTimeout (local Metro proxy, origin localhost:8081)', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    jest.useRealTimers()
  })

  afterEach(() => {
    global.fetch = originalFetch as any
  })

  it('has the Metro origin from the jsdom url', () => {
    expect(window.location.origin).toBe('http://localhost:8081')
  })

  it('retries once on 502 from local Metro API proxy', async () => {
    const firstResponse = { status: 502 } as Response
    const secondResponse = { status: 200, ok: true } as Response
    const fetchMock = jest.fn()
      .mockResolvedValueOnce(firstResponse)
      .mockResolvedValueOnce(secondResponse)
    global.fetch = fetchMock as any

    const result = await fetchWithTimeout('http://localhost:8081/api/countries/', {}, 1000)

    expect(result).toBe(secondResponse)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('does not retry local proxy 502 after external signal was aborted', async () => {
    const externalController = new AbortController()
    const firstResponse = { status: 502 } as Response
    const fetchMock = jest.fn().mockImplementationOnce(() => {
      externalController.abort()
      return Promise.resolve(firstResponse)
    })
    global.fetch = fetchMock as any

    await expect(
      fetchWithTimeout(
        'http://localhost:8081/api/countries/',
        { signal: externalController.signal },
        1000
      )
    ).rejects.toMatchObject({ name: 'AbortError' })

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
