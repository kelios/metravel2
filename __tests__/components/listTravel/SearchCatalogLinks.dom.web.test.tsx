import type React from 'react'

// #3323/#3335: на клиенте каталог не читает loader. nginx не проксирует
// `/_expo/loaders/(tabs)/search`, и чтение loader'а без данных в HTML заменило бы
// каталог экраном ошибки. Указатель повторяется из серверного DOM при гидрации и
// отдаётся списку через контекст — видимым, а не sr-only.
let createElement: typeof import('react').createElement
let useContext: typeof import('react').useContext
let renderToStaticMarkup: typeof import('react-dom/server').renderToStaticMarkup
let Boundary: React.ComponentType<{ children: React.ReactNode }>
let Nav: React.ComponentType<{ data: unknown }>
let PageContext: typeof import('@/components/listTravel/searchCatalogPageContext').SearchCatalogPageContext
const useLoaderData = jest.fn(() => {
  throw new Error('loader must not be read on the client')
})
let routeParams: Record<string, string | string[]> = { page: '2' }

const SERVER = {
  page: 2,
  prevPath: '/search',
  nextPath: '/search?page=3',
  links: [
    { path: '/travels/belovezhskaya-pushcha', title: 'Беловежская пуща & Co' },
    { path: '/travels/bez-nazvaniya', title: 'bez-nazvaniya' },
  ],
}

beforeAll(() => {
  jest.resetModules()
  jest.doMock('react-native', () => jest.requireActual('react-native-web'))
  jest.doMock('expo-router', () => ({ useLoaderData, useLocalSearchParams: () => routeParams }))
  jest.doMock('@/hooks/useTheme', () => ({ useThemedColors: () => ({ primaryText: '#547769' }) }))
  ;({ createElement, useContext } = require('react'))
  ;({ renderToStaticMarkup } = require('react-dom/server.node'))
  const module = require('@/components/listTravel/SearchCatalogLinks.web')
  Boundary = module.default
  Nav = module.SearchCatalogLinksNav
  ;({ SearchCatalogPageContext: PageContext } = require('@/components/listTravel/searchCatalogPageContext'))
})

afterEach(() => {
  document.body.innerHTML = ''
  routeParams = { page: '2' }
  useLoaderData.mockClear()
})

// Список каталога: подвал берёт указатель из контекста, canonical — номер страницы.
function CatalogList() {
  const visible = useContext(PageContext)
  return createElement('main', { 'data-canonical-page': visible ? String(visible.page) : 'none' }, 'catalog', visible?.footer)
}

const serverHtml = (data: unknown = SERVER) => renderToStaticMarkup(createElement(Nav, { data }))
const render = () => renderToStaticMarkup(createElement(Boundary, null, createElement(CatalogList)))
const mount = (html: string) => {
  const host = document.createElement('div')
  host.innerHTML = html
  return host
}

it('renders only the catalogue when the HTML has no server block (static /search, in-app navigation)', () => {
  expect(render()).toBe('<main data-canonical-page="none">catalog</main>')
  expect(useLoaderData).not.toHaveBeenCalled()
})

it('repeats the server pointer byte for byte inside the list during hydration', () => {
  document.body.innerHTML = serverHtml()
  expect(render()).toBe(`<main data-canonical-page="2">catalog${serverHtml()}</main>`)
  expect(useLoaderData).not.toHaveBeenCalled()
})

it('shows the page number, article links of this page and both neighbour pages, without sr-only clipping', () => {
  const nav = mount(serverHtml()).querySelector('nav')!
  expect(nav.getAttribute('aria-label')).toBeTruthy()
  expect(nav.querySelector('h2')?.textContent).toMatch(/2/)
  expect(Array.from(nav.querySelectorAll('li > a'), (a) => [a.getAttribute('href'), a.textContent])).toEqual([
    ['/travels/belovezhskaya-pushcha', 'Беловежская пуща & Co'],
    ['/travels/bez-nazvaniya', 'bez-nazvaniya'],
  ])
  expect(nav.querySelector('a[rel="prev"]')?.getAttribute('href')).toBe('/search')
  expect(nav.querySelector('a[rel="next"]')?.getAttribute('href')).toBe('/search?page=3')
  const css = nav.querySelector('style')?.textContent ?? ''
  expect(css).not.toMatch(/clip|width:1px|position:absolute|:focus-within/)
})

it('has no previous link on page 1 and no next link on the last page', () => {
  const first = mount(serverHtml({ ...SERVER, page: 1, prevPath: null, nextPath: '/search?page=2' })).querySelector('nav')!
  expect(first.querySelector('a[rel="prev"]')).toBeNull()
  expect(first.querySelector('a[rel="next"]')?.getAttribute('href')).toBe('/search?page=2')

  const last = mount(serverHtml({ ...SERVER, page: 37, prevPath: '/search?page=36', nextPath: null })).querySelector('nav')!
  expect(last.querySelector('a[rel="next"]')).toBeNull()
  expect(last.querySelector('a[rel="prev"]')?.getAttribute('href')).toBe('/search?page=36')
})

it('drops the pointer and the page canonical once the address is no longer this catalogue page', () => {
  document.body.innerHTML = serverHtml()
  routeParams = { page: '3' }
  expect(render()).toBe('<main data-canonical-page="none">catalog</main>')
  routeParams = { page: '2', search: 'minsk' }
  expect(render()).toBe('<main data-canonical-page="none">catalog</main>')
  expect(useLoaderData).not.toHaveBeenCalled()
})
