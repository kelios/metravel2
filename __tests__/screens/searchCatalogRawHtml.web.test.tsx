/**
 * @jest-environment node
 */
import path from 'path'
import type React from 'react'

/**
 * #3323: в сыром HTML каталога /search и /search?page=N — обычные ссылки
 * `<a href>` на статьи этой страницы и на соседние страницы. Серверная разметка
 * собирается тем же `renderToString`, что и SSR (окружение node: `window` нет).
 */
let createElement: typeof import('react').createElement
let renderToString: typeof import('react-dom/server').renderToString
let loaderData: unknown = null
// Сетап jest-expo кладёт `window` и в node-окружение; на SSR его нет, а модуль
// блока выбирает серверную ветку по `typeof window` при загрузке.
const testGlobal = globalThis as { window?: unknown }
const presetWindow = testGlobal.window

const hrefsOf = (html: string) => [...html.matchAll(/<a\b[^>]*\bhref="([^"]+)"/g)].map((match) => match[1])
const PAGE_2 = {
  page: 2,
  prevPath: '/search',
  nextPath: '/search?page=3',
  links: Array.from({ length: 12 }, (_, index) => ({
    path: `/travels/statya-${index + 13}`,
    title: index === 1 ? 'statya-14' : `Статья «${index + 13}» & Co`,
  })),
}

beforeAll(() => {
  delete testGlobal.window
  jest.resetModules()
  jest.doMock('expo-router', () => ({
    useLoaderData: () => loaderData,
    useLocalSearchParams: () => {
      throw new Error('the server reads the request, not the router params')
    },
  }))
  jest.doMock(path.resolve(__dirname, '../../app/(tabs)/search.tsx'), () => ({
    __esModule: true,
    default: () => require('react').createElement('main', null, 'catalog'),
  }))
  ;({ createElement } = require('react'))
  ;({ renderToString } = require('react-dom/server.node'))
})

afterAll(() => {
  testGlobal.window = presetWindow
})

afterEach(() => {
  loaderData = null
  delete process.env.EXPO_PUBLIC_WEB_RUNTIME_SSR
})

const renderBoundary = () => {
  const Boundary = require('@/components/listTravel/SearchCatalogLinks.web').default as React.ComponentType<{ children: React.ReactNode }>
  return renderToString(createElement(Boundary, null, createElement('main', null, 'catalog')))
}

describe('/search?page=N: server HTML', () => {
  it('links the twelve articles of exactly this page and both neighbour pages', () => {
    loaderData = PAGE_2
    const html = renderBoundary()

    expect(hrefsOf(html)).toEqual([...PAGE_2.links.map((link) => link.path), '/search', '/search?page=3'])
    expect(html).toContain('<main>catalog</main>')
    expect(html).toMatch(/<nav[^>]*data-search-catalog-links="2"/)
    expect(html).toMatch(/<a href="\/search" rel="prev">/)
    expect(html).toMatch(/<a href="\/search\?page=3" rel="next">/)
    // Подпись экранирована, а slug без названия выходит как есть.
    expect(html).toContain('Статья «13» &amp; Co')
    expect(html).toContain('>statya-14</a>')
  })

  it('has no previous link on page 1 and renders nothing without loader data', () => {
    loaderData = { ...PAGE_2, page: 1, prevPath: null, nextPath: '/search?page=2' }
    expect(hrefsOf(renderBoundary()).filter((href) => href.startsWith('/search'))).toEqual(['/search?page=2'])

    loaderData = null
    expect(renderBoundary()).toBe('<main>catalog</main>')
  })

  it('wraps the screen only with the SSR runtime and declares the page canonical', async () => {
    const route = require('../../app/(tabs)/search.web')
    expect(renderToString(createElement(route.default))).toBe('<main>catalog</main>')

    process.env.EXPO_PUBLIC_WEB_RUNTIME_SSR = 'true'
    loaderData = PAGE_2
    expect(hrefsOf(renderToString(createElement(route.default)))).toHaveLength(14)

    const oldFetch = global.fetch
    const oldApi = process.env.EXPO_PUBLIC_API_URL
    process.env.EXPO_PUBLIC_API_URL = 'http://localhost:8000'
    global.fetch = jest.fn(async () => ({
      ok: true, status: 200,
      json: async () => ({ page: 2, pages: 37, count: 437, results: [{ slug: 'statya-13', title: 'Статья' }] }),
    })) as unknown as typeof fetch
    const request = (query: string) => ({ url: `https://metravel.by/search${query}`, signal: new AbortController().signal })
    const canonicalsOf = async (req: unknown) =>
      JSON.stringify(await route.generateMetadata(req)).match(/https:\/\/metravel\.by\/search[^"]*/g) ?? []
    try {
      expect(await canonicalsOf(request('?page=2'))).toContain('https://metravel.by/search?page=2')
      for (const req of [request('?page=2&search=minsk'), undefined]) {
        const urls = await canonicalsOf(req)
        expect(urls.length).toBeGreaterThan(0)
        expect(urls.every((url) => url === 'https://metravel.by/search')).toBe(true)
      }
      await expect(route.generateMetadata(request('?page=abc'))).rejects.toMatchObject({ httpStatus: 404 })
    } finally {
      global.fetch = oldFetch
      process.env.EXPO_PUBLIC_API_URL = oldApi
    }
  })
})
