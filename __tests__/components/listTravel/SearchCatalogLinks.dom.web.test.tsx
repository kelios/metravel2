import type React from 'react'

// #3323: на клиенте каталог не читает loader. nginx не проксирует
// `/_expo/loaders/(tabs)/search`, и чтение loader'а без данных в HTML заменило бы
// каталог экраном ошибки. Блок ссылок повторяется из серверного DOM при гидрации.
let createElement: typeof import('react').createElement
let renderToStaticMarkup: typeof import('react-dom/server').renderToStaticMarkup
let Boundary: React.ComponentType<{ children: React.ReactNode }>
let Nav: React.ComponentType<{ data: unknown }>
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
  jest.doMock('expo-router', () => ({ useLoaderData, useLocalSearchParams: () => routeParams }))
  ;({ createElement } = require('react'))
  ;({ renderToStaticMarkup } = require('react-dom/server.node'))
  const module = require('@/components/listTravel/SearchCatalogLinks.web')
  Boundary = module.default
  Nav = module.SearchCatalogLinksNav
})

afterEach(() => {
  document.body.innerHTML = ''
  routeParams = { page: '2' }
  useLoaderData.mockClear()
})

const serverHtml = () => renderToStaticMarkup(createElement(Nav, { data: SERVER }))
const render = () => renderToStaticMarkup(createElement(Boundary, null, createElement('main', null, 'catalog')))

it('renders only the catalogue when the HTML has no server block (static /search, in-app navigation)', () => {
  expect(render()).toBe('<main>catalog</main>')
  expect(useLoaderData).not.toHaveBeenCalled()
})

it('repeats the server block byte for byte during hydration', () => {
  document.body.innerHTML = serverHtml()
  expect(render()).toBe(`<main>catalog</main>${serverHtml()}`)
  expect(useLoaderData).not.toHaveBeenCalled()
})

it('drops the block once the address is no longer this catalogue page', () => {
  document.body.innerHTML = serverHtml()
  routeParams = { page: '3' }
  expect(render()).toBe('<main>catalog</main>')
  routeParams = { page: '2', search: 'minsk' }
  expect(render()).toBe('<main>catalog</main>')
  expect(useLoaderData).not.toHaveBeenCalled()
})
