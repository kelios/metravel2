import type React from 'react'
import type { Root } from 'react-dom/client'

let act: typeof import('react').act
let createElement: typeof import('react').createElement
let createRoot: typeof import('react-dom/client').createRoot
let hydrateRoot: typeof import('react-dom/client').hydrateRoot
let renderToString: typeof import('react-dom/server').renderToString
let LoadingFallback: React.ComponentType
let responsive: jest.Mock
let viewport = { width: 0, height: 0 }
const mounted: { root: Root; host: HTMLElement }[] = []

beforeAll(() => {
  jest.resetModules()
  jest.doMock('react-native', () => jest.requireActual('react-native-web'))
  jest.doMock('@/hooks/useTheme', () => ({
    useThemedColors: () => require('@/constants/designSystem').getThemedColors(false),
  }))
  responsive = jest.fn(() => viewport)
  jest.doMock('@/hooks/useResponsive', () => ({ useResponsive: responsive }))
  ;({ act, createElement } = require('react'))
  ;({ createRoot, hydrateRoot } = require('react-dom/client'))
  ;({ renderToString } = require('react-dom/server.node'))
  LoadingFallback = require('@/components/travel/details/TravelDetailsLoadingFallback').default
})

beforeEach(() => {
  viewport = { width: 0, height: 0 }
  responsive.mockClear()
})

afterEach(async () => {
  for (const { root, host } of mounted.splice(0)) {
    await act(async () => root.unmount())
    host.remove()
  }
})

function createHost(html = '') {
  const host = document.createElement('div')
  host.innerHTML = html
  document.body.appendChild(host)
  return host
}

function slots(host: HTMLElement) {
  return {
    root: host.querySelector('[data-testid="travel-details-loading"]'),
    content: host.querySelector('[data-travel-web-content="true"]'),
    sidebar: host.querySelector('[data-travel-web-sidebar="true"]'),
    column: host.querySelector('[data-travel-web-loading-column="true"]'),
    hero: host.querySelector('[data-testid="travel-details-hero-slider-container"]'),
    heading: host.querySelector('[data-travel-first-screen="heading"]'),
    title: host.querySelector('[data-travel-first-screen="title"]'),
    meta: host.querySelector('[data-travel-first-screen="meta"]'),
    favorite: host.querySelector('[data-travel-first-screen="favorite"]'),
  }
}

it('ships its common geometry and every responsive slot in pending SSR without claiming a travel payload', () => {
  const { TRAVEL_WEB_LAYOUT_STYLES } = require('@/components/travel/details/travelRouterSsrStyles')
  const { TRAVEL_FIRST_SCREEN_STYLES } = require('@/components/travel/details/travelFirstScreenLayout')
  const host = createHost(renderToString(createElement(LoadingFallback)))
  try {
    const nodes = slots(host)
    for (const node of Object.values(nodes)) expect(node).not.toBeNull()
    expect(nodes.root?.getAttribute('data-travel-web-layout')).toBe('true')
    expect(nodes.root?.getAttribute('role')).toBe('progressbar')
    expect(nodes.root?.getAttribute('aria-label')).toBeTruthy()
    expect(host.querySelector('[data-router-ssr], [data-router-travel-h1], h1')).toBeNull()
    expect(host.querySelectorAll('[data-travel-web-layout-styles="true"]')).toHaveLength(1)
    expect(host.querySelector('style')?.textContent).toBe(TRAVEL_WEB_LAYOUT_STYLES + TRAVEL_FIRST_SCREEN_STYLES)
    expect(nodes.sidebar?.nextElementSibling).toBe(nodes.column)
    expect(nodes.column?.firstElementChild).toBe(nodes.hero)
    expect(nodes.hero?.nextElementSibling).toBe(nodes.heading)
    expect(nodes.title?.nextElementSibling).toBe(nodes.meta)
    expect(nodes.meta?.nextElementSibling).toBe(nodes.favorite)
    expect(responsive).not.toHaveBeenCalled()
  } finally {
    host.remove()
  }
})

it('hydrates and resizes the same server slots from width0 through desktop/mobile without replacing nodes', async () => {
  const serverHtml = renderToString(createElement(LoadingFallback))
  const host = createHost(serverHtml)
  const original = slots(host)
  const errors: unknown[] = []
  let root: Root | undefined
  await act(async () => {
    root = hydrateRoot(host, createElement(LoadingFallback), { onRecoverableError: (error) => errors.push(error) })
  })
  mounted.push({ root: root!, host })
  for (const width of [1440, 390, 768, 1100, 1280, 1600, 0]) {
    viewport = { width, height: 900 }
    await act(async () => root!.render(createElement(LoadingFallback)))
    const current = slots(host)
    for (const name of Object.keys(original) as (keyof typeof original)[]) {
      expect(current[name]).toBe(original[name])
    }
    // No viewport-dependent attributes, styles or membership are introduced by
    // hydration; the first-frame media rules already own that choice.
    expect(host.innerHTML).toBe(serverHtml)
  }
  expect(errors).toEqual([])
  expect(responsive).not.toHaveBeenCalled()
})

it.each(['ios', 'android'])('retains the existing %s mobile fallback and its numeric hero sizing', async (platform) => {
  const { Platform } = require('react-native')
  const previous = Platform.OS
  const host = createHost()
  const root = createRoot(host)
  mounted.push({ root, host })
  viewport = { width: 390, height: 844 }
  try {
    Platform.OS = platform
    await act(async () => root.render(createElement(LoadingFallback)))
    const loading = host.querySelector('[data-testid="travel-details-loading"]')!
    expect(loading.getAttribute('role')).toBe('progressbar')
    expect((loading.firstElementChild as HTMLElement).style.height).toBe('420px')
    expect(host.querySelector('style, [data-travel-web-layout], [data-travel-first-screen]')).toBeNull()
    expect(responsive).toHaveBeenCalled()
  } finally {
    Platform.OS = previous
  }
})
