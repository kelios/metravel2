import type { ImmutableRequest } from 'expo-server'
import { loadSearchCatalogLinks } from '@/components/listTravel/searchCatalogLinksLoader'
import {
  parseSearchCatalogQuery,
  searchCatalogPagePath,
  searchParamsEntries,
} from '@/components/listTravel/searchCatalogPage'

// #3323: постраничные ссылки каталога /search?page=N из GET /api/travels/catalog-links/?page=N.
jest.mock('expo-server', () => ({ setResponseHeaders: jest.fn() }))

const request = (query = '') => ({
  url: `https://metravel.by/search${query}`,
  signal: new AbortController().signal,
} as ImmutableRequest)

// Форма ответа прода 11.11.2026 (сокращена до трёх статей).
const page = (number: number, pages = 37) => ({
  page: number,
  pages,
  count: 437,
  results: [
    { slug: `belovezhskaya-pushcha-${number}`, title: 'Беловежская пуща' },
    { slug: `bez-nazvaniya-${number}`, title: null },
    { slug: null, title: 'Без адреса' },
  ],
})

describe('search catalog query', () => {
  const parse = (query: string) => parseSearchCatalogQuery(new URLSearchParams(query))

  it.each([
    ['', { kind: 'catalog', page: 1 }],
    ['page=1', { kind: 'catalog', page: 1 }],
    ['page=12', { kind: 'catalog', page: 12 }],
    ['page=0', { kind: 'invalid' }],
    ['page=-2', { kind: 'invalid' }],
    ['page=02', { kind: 'invalid' }],
    ['page=2.5', { kind: 'invalid' }],
    ['page=abc', { kind: 'invalid' }],
    ['page=', { kind: 'invalid' }],
    ['page=2&page=3', { kind: 'invalid' }],
    ['search=minsk', { kind: 'filtered' }],
    ['page=2&categories=5', { kind: 'filtered' }],
    ['sort=new&page=abc', { kind: 'filtered' }],
  ])('?%s → %j', (query, expected) => expect(parse(query)).toEqual(expected))

  it('gives page 1 the bare /search address', () => {
    expect(searchCatalogPagePath(1)).toBe('/search')
    expect(searchCatalogPagePath(3)).toBe('/search?page=3')
  })

  it('flattens expo-router params into query pairs', () => {
    expect(searchParamsEntries({ page: '2', categories: ['1', '2'], empty: undefined }))
      .toEqual([['page', '2'], ['categories', '1'], ['categories', '2']])
  })
})

describe('search catalog links loader', () => {
  const oldEnv = { api: process.env.EXPO_PUBLIC_API_URL, ssr: process.env.EXPO_PUBLIC_WEB_RUNTIME_SSR }
  const oldFetch = global.fetch
  const fetchMock = jest.fn()
  const answer = (status: number, body: unknown) => ({ ok: status >= 200 && status < 300, status, json: async () => body })

  beforeEach(() => {
    process.env.EXPO_PUBLIC_API_URL = 'http://localhost:8000'
    process.env.EXPO_PUBLIC_WEB_RUNTIME_SSR = 'true'
    global.fetch = fetchMock
    fetchMock.mockReset().mockImplementation(async (url: string) => {
      const number = Number(new URL(url).searchParams.get('page'))
      return number > 37 ? answer(404, { detail: 'Invalid page.' }) : answer(200, page(number))
    })
  })
  afterAll(() => {
    global.fetch = oldFetch
    process.env.EXPO_PUBLIC_API_URL = oldEnv.api
    if (oldEnv.ssr === undefined) delete process.env.EXPO_PUBLIC_WEB_RUNTIME_SSR
    else process.env.EXPO_PUBLIC_WEB_RUNTIME_SSR = oldEnv.ssr
  })

  it('returns the article links of the page, a slug for a missing title, and both neighbours', async () => {
    await expect(loadSearchCatalogLinks(request('?page=2'))).resolves.toEqual({
      page: 2,
      prevPath: '/search',
      nextPath: '/search?page=3',
      links: [
        { path: '/travels/belovezhskaya-pushcha-2', title: 'Беловежская пуща' },
        { path: '/travels/bez-nazvaniya-2', title: 'bez-nazvaniya-2' },
      ],
    })
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8000/api/travels/catalog-links/?page=2',
      expect.objectContaining({ credentials: 'omit' }),
    )
  })

  it('has no previous page on /search and no next page on the last one', async () => {
    await expect(loadSearchCatalogLinks(request())).resolves.toMatchObject({ page: 1, prevPath: null, nextPath: '/search?page=2' })
    await expect(loadSearchCatalogLinks(request('?page=37'))).resolves.toMatchObject({ page: 37, prevPath: '/search?page=36', nextPath: null })
  })

  it('answers 404 for a page out of range and for an invalid page', async () => {
    await expect(loadSearchCatalogLinks(request('?page=999'))).rejects.toMatchObject({ httpStatus: 404 })
    fetchMock.mockResolvedValueOnce(answer(200, page(5, 4)))
    await expect(loadSearchCatalogLinks(request('?page=5'))).rejects.toMatchObject({ httpStatus: 404 })
    fetchMock.mockClear()
    for (const query of ['?page=0', '?page=-1', '?page=abc', '?page=1.5']) {
      await expect(loadSearchCatalogLinks(request(query))).rejects.toMatchObject({ httpStatus: 404 })
    }
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('answers 503 for an API failure on page N but keeps /search itself alive', async () => {
    fetchMock.mockResolvedValueOnce(answer(500, {}))
    await expect(loadSearchCatalogLinks(request('?page=3'))).rejects.toMatchObject({ httpStatus: 503 })
    fetchMock.mockResolvedValueOnce(answer(500, {}))
    await expect(loadSearchCatalogLinks(request())).resolves.toBeNull()
    fetchMock.mockResolvedValueOnce(answer(200, { unexpected: true }))
    await expect(loadSearchCatalogLinks(request('?page=1'))).resolves.toBeNull()
  })

  it('leaves a filtered catalogue alone, whatever its page parameter', async () => {
    await expect(loadSearchCatalogLinks(request('?search=minsk'))).resolves.toBeNull()
    await expect(loadSearchCatalogLinks(request('?page=abc&categories=2'))).resolves.toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('stays out of the way without the SSR runtime (static /search.html)', async () => {
    process.env.EXPO_PUBLIC_WEB_RUNTIME_SSR = 'false'
    await expect(loadSearchCatalogLinks(request('?page=2'))).resolves.toBeNull()
    process.env.EXPO_PUBLIC_WEB_RUNTIME_SSR = 'true'
    await expect(loadSearchCatalogLinks(undefined)).resolves.toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('asks the API once per request for the loader and the metadata', async () => {
    const shared = request('?page=4')
    await Promise.all([loadSearchCatalogLinks(shared), loadSearchCatalogLinks(shared)])
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
