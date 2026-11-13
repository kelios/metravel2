import { Platform } from 'react-native'
import { recordTravelView } from '@/api/travelViews'
import { fetchPublicWithSession } from '@/api/publicFetchWithSession'
import { API_BASE_URL, DEFAULT_TIMEOUT } from '@/api/apiConfig'

const mockSecureRead = jest.fn()
jest.mock('expo-secure-store', () => ({ getItemAsync: (...args: unknown[]) => mockSecureRead(...args) }))

const response = (status = 204) => ({ status, ok: status >= 200 && status < 300, json: jest.fn() }) as unknown as Response

describe('human travel view transport', () => {
  const originalFetch = global.fetch
  const originalOS = Platform.OS
  const fetchMock = jest.fn()

  beforeEach(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' })
    document.cookie = 'csrftoken=; Max-Age=0; path=/'
    global.fetch = fetchMock
    fetchMock.mockReset().mockResolvedValue(response())
    mockSecureRead.mockReset().mockResolvedValue('native-viewer-token')
  })

  afterEach(() => {
    global.fetch = originalFetch
    Object.defineProperty(Platform, 'OS', { configurable: true, value: originalOS })
    document.cookie = 'csrftoken=; Max-Age=0; path=/'
    jest.useRealTimers()
  })

  it('sends bodyless cookie-web POST with the real CSRF helper and never parses the 204 body', async () => {
    document.cookie = 'csrftoken=reader%2Dcsrf; path=/'
    const result = response()
    fetchMock.mockResolvedValue(result)

    await expect(recordTravelView(17)).resolves.toBeUndefined()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith(`${API_BASE_URL}/travels/17/view/`, expect.objectContaining({
      method: 'POST', credentials: 'include', headers: { 'X-CSRFToken': 'reader-csrf' },
    }))
    expect(fetchMock.mock.calls[0][1].body).toBeUndefined()
    expect(result.json).not.toHaveBeenCalled()
    expect(mockSecureRead).not.toHaveBeenCalled()
  })

  it.each(['android', 'ios'])('uses the existing secure Token path, omitted cookies and no CSRF on %s', async platform => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: platform })
    document.cookie = 'csrftoken=web-only; path=/'

    await recordTravelView(18)

    expect(mockSecureRead).toHaveBeenCalledWith('userToken')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][1]).toEqual(expect.objectContaining({
      method: 'POST', credentials: 'omit', headers: { Authorization: 'Token native-viewer-token' },
    }))
    expect(fetchMock.mock.calls[0][1].body).toBeUndefined()
  })

  it.each(['web', 'android', 'ios'])('allows a guest event without fabricated auth or CSRF on %s', async platform => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: platform })
    mockSecureRead.mockResolvedValue(null)

    await expect(recordTravelView(19)).resolves.toBeUndefined()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][1]).toEqual(expect.objectContaining({
      method: 'POST', credentials: platform === 'web' ? 'include' : 'omit',
    }))
    expect(Object.keys(fetchMock.mock.calls[0][1].headers ?? {})).toEqual([])
  })

  it.each([0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])('rejects invalid numeric article ID %s before fetching', async id => {
    await expect(recordTravelView(id)).resolves.toBeUndefined()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it.each([401, 403, 404, 429, 500, 502])('silently settles HTTP%s without an anonymous retry or body parsing', async status => {
    const result = response(status)
    fetchMock.mockResolvedValue(result)

    await expect(recordTravelView(17)).resolves.toBeUndefined()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(result.json).not.toHaveBeenCalled()
  })

  it('silently resolves a network rejection without a retry or unhandled rejection', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(recordTravelView(17)).resolves.toBeUndefined()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('aborts a slow request at the existing deadline and silently resolves without retry', async () => {
    jest.useFakeTimers()
    let signal: AbortSignal | undefined
    fetchMock.mockImplementation((_url, init: RequestInit) => new Promise((_resolve, reject) => {
      signal = init.signal ?? undefined
      signal?.addEventListener('abort', () => reject(Object.assign(new Error('Aborted'), { name: 'AbortError' })))
    }))

    const pending = recordTravelView(17)
    const settled = expect(pending).resolves.toBeUndefined()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    await jest.advanceTimersByTimeAsync(DEFAULT_TIMEOUT)
    await settled
    expect(signal?.aborted).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(jest.getTimerCount()).toBe(0)
  })

  it('preserves the existing public-read 401 anonymous fallback by default', async () => {
    const accepted = response(200)
    fetchMock.mockResolvedValueOnce(response(401)).mockResolvedValueOnce(accepted)

    await expect(fetchPublicWithSession(`${API_BASE_URL}/travels/`, { method: 'GET' }, 1000)).resolves.toBe(accepted)

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[0][1].credentials).toBe('include')
    expect(fetchMock.mock.calls[1][1].credentials).toBe('omit')
  })
})
