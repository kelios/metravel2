// #2130/#2134: статьи читаются с сессией, чтобы бэк применил фильтр блокировок;
// 401 (устаревший токен) повторяется без сессии, токен не трогается.
import { Platform } from 'react-native'

jest.mock('@/utils/logger', () => ({ devError: jest.fn(), devWarn: jest.fn() }))
jest.mock('@/utils/fetchWithTimeout', () => ({ fetchWithTimeout: jest.fn() }))
jest.mock('@/utils/secureStorage', () => ({ getSecureItem: jest.fn(() => Promise.resolve('tok-1')) }))
jest.mock('@/services/offline/articleOfflineAdapter', () => ({
  readArticleOffline: jest.fn(() => Promise.resolve(null)),
  saveArticleOffline: jest.fn(() => Promise.resolve(null)),
}))

const { fetchWithTimeout } = require('@/utils/fetchWithTimeout') as { fetchWithTimeout: jest.Mock }
const { getSecureItem } = require('@/utils/secureStorage') as { getSecureItem: jest.Mock }
const { fetchArticle, fetchArticles } = require('@/api/articles')

const okJson = (body: unknown) => ({
  ok: true,
  status: 200,
  statusText: 'OK',
  headers: { get: () => 'application/json' },
  json: () => Promise.resolve(body),
  text: () => Promise.resolve(JSON.stringify(body)),
  clone() {
    return okJson(body)
  },
})

const originalOS = Platform.OS
const setOS = (os: string) => Object.defineProperty(Platform, 'OS', { value: os, configurable: true })

afterEach(() => {
  setOS(originalOS)
  jest.clearAllMocks()
})

describe('article reads carry the session', () => {
  it('native sends the stored token in the Authorization header', async () => {
    setOS('ios')
    fetchWithTimeout.mockResolvedValue(okJson({ results: [], count: 0 }))
    await fetchArticles(0, 10, {})
    const [, init] = fetchWithTimeout.mock.calls[0]
    expect(init.headers).toEqual({ Authorization: 'Token tok-1' })
    expect(init.credentials).toBe('omit')
  })

  it('web relies on the cookie session and never reads the token store', async () => {
    setOS('web')
    fetchWithTimeout.mockResolvedValue(okJson({ results: [], count: 0 }))
    await fetchArticles(0, 10, {})
    const [, init] = fetchWithTimeout.mock.calls[0]
    expect(init.credentials).toBe('include')
    expect(init.headers).toBeUndefined()
    expect(getSecureItem).not.toHaveBeenCalled()
  })

  it('retries a 401 detail read without the session', async () => {
    setOS('ios')
    fetchWithTimeout
      .mockResolvedValueOnce({ ok: false, status: 401, statusText: 'Unauthorized' })
      .mockResolvedValueOnce(okJson({ id: 5, name: 'Статья' }))
    const article = await fetchArticle(5)
    expect(article).toEqual(expect.objectContaining({ id: 5 }))
    expect(fetchWithTimeout).toHaveBeenCalledTimes(2)
    const [, retryInit] = fetchWithTimeout.mock.calls[1]
    expect(retryInit.headers).toBeUndefined()
    expect(retryInit.credentials).toBe('omit')
  })
})
