import type React from 'react'

let createElement: typeof import('react').createElement
let act: typeof import('react').act
let renderToString: typeof import('react-dom/server').renderToString
let hydrateRoot: typeof import('react-dom/client').hydrateRoot
let Description: React.ComponentType<{ htmlContent: string; serverSanitized: boolean; noBox: boolean }>
let Provider: React.Provider<unknown>
let rendererImports = 0
let renderDeferredBody: () => React.ReactElement | null = () => null

beforeAll(() => {
  jest.resetModules()
  jest.doMock('react-native', () => jest.requireActual('react-native-web'))
  jest.doMock('@/hooks/useTheme', () => ({ useThemedColors: () => ({ text: 'black', textMuted: 'gray', surface: 'white' }) }))
  jest.doMock('@/components/travel/DeferredStableContent', () =>
    jest.requireActual('@/components/travel/DeferredStableContent.web'))
  jest.doMock('@/components/travel/StableContent', () => {
    rendererImports += 1
    return { __esModule: true, default: () => renderDeferredBody() }
  })
  jest.doMock('@/components/travel/TravelDescriptionHtml', () =>
    jest.requireActual('@/components/travel/TravelDescriptionHtml.web'))
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
  expect(island?.classList.contains('travel-rich-text')).toBe(true)
  expect(island?.classList.contains('travel-rich-text--full-width')).toBe(true)
  const styles = container.querySelector('style[data-travel-description-styles]')?.textContent
  expect(styles).toContain('.travel-rich-text img')
  expect(styles).toContain('object-fit: contain')
  expect(styles).toContain('max-height: 70vh')
  expect(island?.textContent).toContain('Канонический текст статьи.')
  expect(island?.querySelector('script')).toBeNull()
  expect(island?.querySelector('img')?.hasAttribute('onerror')).toBe(false)
  // #3316: серверное тело не запрашивает картинки до LCP-фото первого экрана.
  expect(island?.querySelector('img')?.getAttribute('src')).toMatch(/^data:image\/svg\+xml,/)
  expect(island?.querySelector('img')?.getAttribute('data-deferred-src')).toBe('/photo.jpg')
  expect(island?.querySelectorAll('noscript')).toHaveLength(1)
  expect(island?.querySelector('noscript')?.textContent).toBe('<img src="/photo.jpg" alt="" loading="lazy">')
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
    expect(island?.querySelector('img')?.getAttribute('src')).toBe('/photo.jpg')
    expect(island?.querySelectorAll('img')).toHaveLength(1)
    expect(island?.querySelectorAll('noscript')).toHaveLength(1)
  } finally {
    await act(async () => root?.unmount())
    container.remove()
    window.IntersectionObserver = originalObserver
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: originalWidth })
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: originalHeight })
  }
})

it('loads the renderer at the readable server body and keeps its links while loading', async () => {
  const originalObserver = window.IntersectionObserver
  let intersect: ((entries: Array<{ isIntersecting: boolean; intersectionRatio: number }>) => void) | undefined
  const observeOptions = jest.fn()
  window.IntersectionObserver = class {
    constructor(callback: typeof intersect, options: IntersectionObserverInit) {
      intersect = callback
      observeOptions(options)
    }
    observe() {}
    disconnect() {}
  } as unknown as typeof IntersectionObserver

  let finishLoading!: () => void
  let loading = true
  const rendererReady = new Promise<void>((resolve) => { finishLoading = resolve })
  renderDeferredBody = () => {
    if (loading) throw rendererReady
    return createElement('div', { 'data-test-renderer': 'loaded' })
  }

  const html = '<p><a href="/travels/example#route">Открыть маршрут</a></p>'
    + '<p>Канонический текст статьи.</p>'.repeat(400)
  const tree = createElement(Provider, { value: { travel: { id: 42 } } },
    createElement(Description, { htmlContent: html, serverSanitized: true, noBox: true }))
  const container = document.createElement('div')
  container.innerHTML = renderToString(tree)
  document.body.appendChild(container)

  let root: ReturnType<typeof hydrateRoot> | undefined
  try {
    await act(async () => { root = hydrateRoot(container, tree) })
    expect(observeOptions).toHaveBeenCalledWith({ rootMargin: '0px', threshold: 0 })
    expect(rendererImports).toBe(0)

    await act(async () => {
      intersect?.([{ isIntersecting: true, intersectionRatio: 0.05 }])
      await new Promise<void>((resolve) => setTimeout(resolve, 0))
    })
    expect(rendererImports).toBe(1)
    expect(container.querySelector('[data-ssr-html-island="description"] a')?.getAttribute('href'))
      .toBe('/travels/example#route')
    expect(container.querySelector('[data-testid="travel-description-fallback"]')).toBeNull()

    await act(async () => {
      loading = false
      finishLoading()
    })
    expect(container.querySelector('[data-test-renderer="loaded"]')).not.toBeNull()
  } finally {
    await act(async () => root?.unmount())
    container.remove()
    window.IntersectionObserver = originalObserver
  }
})
