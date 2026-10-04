// #2165: гео-выдача (поиск по карте, кластеры, near-route, материалы места) и
// каталог мест читаются с сессией — иначе бэковый фильтр блокировок
// (#2164) не знает, кто спрашивает, и вошедший видит заблокированного автора.
import fs from 'fs'
import path from 'path'
import { Platform } from 'react-native'

jest.mock('@/utils/logger', () => ({ devError: jest.fn(), devWarn: jest.fn(), devLog: jest.fn() }))
jest.mock('@/utils/fetchWithTimeout', () => ({ fetchWithTimeout: jest.fn() }))
jest.mock('@/utils/secureStorage', () => ({ getSecureItem: jest.fn(() => Promise.resolve('tok-1')) }))

const { fetchWithTimeout } = require('@/utils/fetchWithTimeout') as { fetchWithTimeout: jest.Mock }
const { getSecureItem } = require('@/utils/secureStorage') as { getSecureItem: jest.Mock }
const { fetchMapClusters, fetchTravelsNearRoute, fetchMapPlaceSources } = require('@/api/map')
const { fetchPlacesCatalog } = require('@/api/places')

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

const BBOX = { south: 53, west: 27, north: 54, east: 28 }
const ROUTE: [number, number][] = [[27.5, 53.9], [27.6, 53.95]]

const originalOS = Platform.OS
const setOS = (os: string) => Object.defineProperty(Platform, 'OS', { value: os, configurable: true })
const originalCookie = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie')

afterEach(() => {
  setOS(originalOS)
  if (originalCookie) Object.defineProperty(document, 'cookie', originalCookie)
  jest.clearAllMocks()
})

const lastInit = () => fetchWithTimeout.mock.calls[fetchWithTimeout.mock.calls.length - 1][1]

const READS: Array<[string, () => Promise<unknown>, unknown]> = [
  ['map clusters', () => fetchMapClusters(BBOX, 8), { clusters: [], points: [] }],
  ['place sources', () => fetchMapPlaceSources(7), { results: [], next: null }],
  ['places catalog', () => fetchPlacesCatalog({ page: 1, perPage: 10 }), { results: [], count: 0 }],
]

describe('geo reads carry the session (#2165)', () => {
  it.each(READS)('native %s sends the stored token', async (_name, read, body) => {
    setOS('ios')
    fetchWithTimeout.mockResolvedValue(okJson(body))
    await read().catch(() => undefined)
    const init = lastInit()
    expect(init.headers).toEqual(expect.objectContaining({ Authorization: 'Token tok-1' }))
  })

  it.each(READS)('web %s relies on the cookie and sends no token', async (_name, read, body) => {
    setOS('web')
    fetchWithTimeout.mockResolvedValue(okJson(body))
    await read().catch(() => undefined)
    const init = lastInit()
    expect(init.credentials).toBe('include')
    expect(init.headers?.Authorization).toBeUndefined()
    expect(getSecureItem).not.toHaveBeenCalled()
  })

  it('web near-route POST carries the CSRF token with the cookie session', async () => {
    setOS('web')
    Object.defineProperty(document, 'cookie', { configurable: true, get: () => 'csrftoken=abc123; other=1' })
    fetchWithTimeout.mockResolvedValue(okJson([]))
    await fetchTravelsNearRoute(ROUTE, 2)
    const init = lastInit()
    expect(init.method).toBe('POST')
    expect(init.credentials).toBe('include')
    expect(init.headers).toEqual({ 'Content-Type': 'application/json', 'X-CSRFToken': 'abc123' })
  })

  it('native near-route POST sends the token and keeps the body', async () => {
    setOS('android')
    fetchWithTimeout.mockResolvedValue(okJson([]))
    await fetchTravelsNearRoute(ROUTE, 2)
    const init = lastInit()
    expect(init.headers).toEqual({ 'Content-Type': 'application/json', Authorization: 'Token tok-1' })
    expect(JSON.parse(init.body)).toEqual({ route: { type: 'LineString', coordinates: ROUTE }, tolerance: 2000 })
  })

  it('a guest gets no new headers', async () => {
    setOS('ios')
    getSecureItem.mockResolvedValueOnce(null)
    fetchWithTimeout.mockResolvedValue(okJson({ results: [], count: 0 }))
    await fetchPlacesCatalog({ page: 1, perPage: 10 })
    expect(lastInit().headers).toBeUndefined()
  })

  it('retries a 401 read once without the session and keeps the token', async () => {
    setOS('ios')
    fetchWithTimeout
      .mockResolvedValueOnce({ ok: false, status: 401, statusText: 'Unauthorized' })
      .mockResolvedValueOnce(okJson({ results: [], count: 0 }))
    await fetchPlacesCatalog({ page: 1, perPage: 10 })
    expect(fetchWithTimeout).toHaveBeenCalledTimes(2)
    const retry = lastInit()
    expect(retry.headers).toBeUndefined()
    expect(retry.credentials).toBe('omit')
  })
})

describe('geo modules never read anonymously by accident', () => {
  // Регресс-контроль карточки: прямой `fetchWithTimeout` в этих модулях снова
  // отправил бы вошедшего как гостя. Исключения поимённо: справочник фильтров
  // карты и офлайн-точки (публичный пакет офлайн-региона, см. api/mapOffline.ts).
  const ALLOWED_RAW = {
    'api/map.ts': ['GET_FILTER_FOR_MAP'],
    'api/mapOffline.ts': ['url'],
  } as Record<string, string[]>

  it.each(['api/map.ts', 'api/places.ts', 'api/mapOffline.ts', 'api/articles.ts'])('%s', (file) => {
    const source = fs.readFileSync(path.join(process.cwd(), file), 'utf8')
    const rawCalls = [...source.matchAll(/fetchWithTimeout\(\s*([A-Za-z_`$]+)/g)].map((m) => m[1])
    expect(rawCalls).toEqual(ALLOWED_RAW[file] ?? [])
  })
})
