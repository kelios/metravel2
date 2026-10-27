import type React from 'react'

let createElement: typeof import('react').createElement
let act: typeof import('react').act
let renderToString: typeof import('react-dom/server').renderToString
let hydrateRoot: typeof import('react-dom/client').hydrateRoot
let Description: React.ComponentType<{ htmlContent: string; serverSanitized: boolean; noBox: boolean }>
let Provider: React.Provider<unknown>

beforeAll(() => {
  jest.resetModules()
  jest.doMock('react-native', () => jest.requireActual('react-native-web'))
  jest.doMock('@/hooks/useTheme', () => ({ useThemedColors: () => ({ text: 'black', textMuted: 'gray', surface: 'white' }) }))
  jest.doMock('@/components/travel/DeferredStableContent', () => () => null)
  ;({ createElement, act } = require('react'))
  ;({ renderToString } = require('react-dom/server.node'))
  ;({ hydrateRoot } = require('react-dom/client'))
  Description = require('@/components/travel/TravelDescription').default
  Provider = require('@/components/travel/details/travelLoaderData').TravelLoaderDataContext.Provider
})

it.each([390, 768, 1440])('hydrates the actual RNW description island at width %s without replacing its body', async (width) => {
  const originalObserver = window.IntersectionObserver
  const originalWidth = window.innerWidth
  const originalHeight = window.innerHeight
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width })
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 900 })
  window.IntersectionObserver = class {
    observe() {}
    disconnect() {}
  } as unknown as typeof IntersectionObserver
  const html = '<h1 id="authored-heading">Раздел статьи</h1>'
    + '<p>Канонический текст статьи.</p>'.repeat(400) + '<script>bad()</script><img src="/photo.jpg" onerror="bad()">'
  const tree = createElement(Provider, { value: { travel: { id: 42 } } },
    createElement(Description, { htmlContent: html, serverSanitized: true, noBox: true }))
  const container = document.createElement('div')
  container.innerHTML = renderToString(tree)
  document.body.appendChild(container)
  const island = container.querySelector('[data-ssr-html-island="description"]')
  expect(island?.textContent).toContain('Канонический текст статьи.')
  expect(island?.querySelector('script')).toBeNull()
  expect(island?.querySelector('img')?.hasAttribute('onerror')).toBe(false)
  expect(island?.querySelector('h1')).toBeNull()
  expect(island?.querySelector('h2#authored-heading')?.textContent).toBe('Раздел статьи')
  const errors: unknown[] = []
  let root: ReturnType<typeof hydrateRoot> | undefined
  try {
    await act(async () => {
      root = hydrateRoot(container, tree, { onRecoverableError: (error) => errors.push(error) })
    })
    expect(errors).toEqual([])
    expect(container.querySelector('[data-ssr-html-island="description"]')).toBe(island)
  } finally {
    await act(async () => root?.unmount())
    container.remove()
    window.IntersectionObserver = originalObserver
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: originalWidth })
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: originalHeight })
  }
})
