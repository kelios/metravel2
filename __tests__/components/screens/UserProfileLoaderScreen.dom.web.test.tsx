import type React from 'react'

// #3237: на клиенте экран профиля не читает loader. Прод отдаёт /user/<id>
// статическим шаблоном, `/_expo/loaders/(tabs)/user/<id>` отвечает 404, и чтение
// loader'а заменило бы профиль экраном ошибки.
let createElement: typeof import('react').createElement
let renderToStaticMarkup: typeof import('react-dom/server').renderToStaticMarkup
let Screen: React.ComponentType<{ children: React.ReactNode }>
const useLoaderData = jest.fn(() => {
  throw new Error('loader must not be read on the client')
})
let routeParams: { id?: string } = { id: '1' }

beforeAll(() => {
  jest.resetModules()
  jest.doMock('expo-router', () => ({ useLoaderData, useLocalSearchParams: () => routeParams }))
  ;({ createElement } = require('react'))
  ;({ renderToStaticMarkup } = require('react-dom/server.node'))
  Screen = require('@/components/screens/profile/UserProfileLoaderScreen.web').default
})

afterEach(() => {
  document.head.innerHTML = ''
  routeParams = { id: '1' }
  useLoaderData.mockClear()
})

const render = () => {
  const host = document.createElement('div')
  host.innerHTML = renderToStaticMarkup(createElement(Screen, null, createElement('main', null, 'profile')))
  return host
}

const serverTag = (text: string) => {
  const script = document.createElement('script')
  script.type = 'application/ld+json'
  script.setAttribute('data-seo-jsonld', 'user-profile')
  script.textContent = text
  document.head.appendChild(script)
}

it('renders the profile without asking the loader when the HTML has no server tag', () => {
  const host = render()
  expect(host.querySelector('main')?.textContent).toBe('profile')
  expect(host.querySelector('script')).toBeNull()
  expect(useLoaderData).not.toHaveBeenCalled()
})

it('repeats the server tag as is during hydration', () => {
  const text = '{"@context":"https://schema.org","@type":"ProfilePage","url":"https://metravel.by/user/1"}'
  serverTag(text)
  const script = render().querySelector('script[data-seo-jsonld="user-profile"]')
  expect(script?.textContent).toBe(text)
  expect(script?.getAttribute('type')).toBe('application/ld+json')
  expect(useLoaderData).not.toHaveBeenCalled()
})

it('drops a server tag that describes another profile', () => {
  serverTag('{"@context":"https://schema.org","@type":"ProfilePage","url":"https://metravel.by/user/12"}')
  expect(render().querySelector('script')).toBeNull()
  routeParams = { id: '2' }
  expect(render().querySelector('script')).toBeNull()
})
