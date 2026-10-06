/** @jest-environment jsdom */
import type React from 'react'
import type { Root } from 'react-dom/client'

let ReactActual: typeof import('react')
let hydrateRoot: typeof import('react-dom/client').hydrateRoot
let renderToString: typeof import('react-dom/server').renderToString
let CustomHeader: React.ComponentType
let mockLegacyConsumer = false
const mockFrames: number[] = []

beforeAll(() => {
  jest.resetModules()
  jest.doMock('react-native', () => jest.requireActual('react-native-web'))
  jest.doMock('expo-router', () => ({ usePathname: () => '/app', useRouter: () => ({ back() {}, replace() {}, push() {}, canGoBack: () => false }) }))
  jest.doMock('@/hooks/useTheme', () => ({ useThemedColors: () => require('@/constants/designSystem').getThemedColors(false) }))
  jest.doMock('@/components/seo/BreadcrumbsJsonLd', () => () => null)
  jest.doMock('@/components/layout/useListFilterQuery', () => ({ useHasListFilterQuery: () => false }))
  jest.doMock('@/components/layout/useHeaderContextBarFallbackVisibility', () => jest.requireActual('@/components/layout/useHeaderContextBarFallbackVisibility.ts'))
  jest.doMock('@/hooks/useBreadcrumbModel', () => ({ useBreadcrumbModel: () => ({ items: [{ label: 'Главная', path: '/' }, { label: 'Приложение', path: '/app' }], depth: 2, currentTitle: 'Приложение', pageContextTitle: 'Приложение', backToPath: '/', showBreadcrumbs: true }) }))
  jest.doMock('@expo/vector-icons/Feather', () => () => null)
  jest.doMock('@/components/layout/Logo', () => () => null)
  jest.doMock('@/components/layout/LanguageSwitcher', () => () => null)
  jest.doMock('@/components/layout/customHeaderLazy', () => ({
    HeaderContextBarLazy: require('react').lazy(async () => ({ default: require('@/components/layout/HeaderContextBar').default })),
    CustomHeaderNavSectionComp: () => null, CustomHeaderAccountSectionComp: () => null,
  }))
  jest.doMock('@/hooks/useResponsive', () => {
    const actual = jest.requireActual('@/hooks/useResponsive')
    return { ...actual, useResponsive: (options: unknown) => {
      const state = actual.useResponsive(mockLegacyConsumer ? undefined : options)
      require('react').useLayoutEffect(() => {
        const bar = document.querySelector('[data-testid="header-context-bar"]')
        if (!bar) return
        const style = getComputedStyle(bar)
        const control = bar.querySelector('[role="button"]')
        const floor = control ? parseFloat(getComputedStyle(control).minHeight) : 0
        const borders = parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth)
        mockFrames.push(Math.max(parseFloat(style.minHeight), floor + borders))
      })
      return state
    } }
  })
  ReactActual = require('react')
  ;({ hydrateRoot } = require('react-dom/client'))
  ;({ renderToString } = require('react-dom/server.node'))
  CustomHeader = require('@/components/layout/CustomHeader').default
})

it.each([1024, 1280, 1440])('late RNW header child keeps the 46px context row at width %s; legacy first commit grows to 52px', async (width) => {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width })
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 900 })
  window.dispatchEvent(new Event('resize'))
  for (const legacy of [true, false]) {
    mockLegacyConsumer = legacy
    mockFrames.length = 0
    const container = document.createElement('div')
    container.innerHTML = renderToString(ReactActual.createElement(CustomHeader))
    document.body.appendChild(container)
    const errors: unknown[] = []
    let root: Root | undefined
    await ReactActual.act(async () => {
      root = hydrateRoot(container, ReactActual.createElement(CustomHeader), { onRecoverableError: (error) => errors.push(error) })
      await Promise.resolve()
    })
    expect(errors).toEqual([])
    expect(mockFrames.length).toBeGreaterThan(0)
    expect(mockFrames.at(-1)).toBe(46)
    if (legacy) expect(mockFrames).toContain(52)
    else expect(mockFrames.every((height) => height === 46)).toBe(true)
    await ReactActual.act(async () => root?.unmount())
    container.remove()
  }
})
