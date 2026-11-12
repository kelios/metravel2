import type React from 'react'

let createElement: typeof import('react').createElement
let act: typeof import('react').act
let createRoot: typeof import('react-dom/client').createRoot
let hydrateRoot: typeof import('react-dom/client').hydrateRoot
let renderToString: typeof import('react-dom/server').renderToString
let Platform: typeof import('react-native').Platform
let StyleSheet: { getSheet: () => { textContent: string } }
let ContributionBanner: React.ComponentType<{ density?: 'compact' | 'regular'; campaign?: { source: 'places' } }>
let Button: typeof import('@/components/ui/Button').default
let criticalCss: string

beforeAll(() => {
  jest.resetModules()
  jest.doMock('react-native', () => jest.requireActual('react-native-web'))
  jest.doMock('@expo/vector-icons/Feather', () => require('../../../metro-stubs/FeatherHydrationSafe.web'))
  jest.doMock('expo-router', () => ({
    useRouter: () => ({ push: jest.fn() }),
    router: { push: jest.fn() },
    Link: ({ children, href }: { children: React.ReactElement; href: string }) =>
      require('react').cloneElement(children, { href }),
  }))
  jest.doMock('@/stores/authStore', () => ({
    useAuthStore: (select: (state: { isAuthenticated: boolean; authReady: boolean }) => unknown) =>
      select({ isAuthenticated: false, authReady: true }),
  }))
  jest.doMock('@/hooks/useTrackedImpression', () => ({ useTrackedImpression: () => ({ ref: null, onLayout: undefined }) }))
  jest.doMock('@/hooks/useTheme', () => ({ useThemedColors: () => ({}) }))
  jest.doMock('@/utils/growthFunnelAnalytics', () => ({
    trackContentCreateCtaClicked: jest.fn(), trackContentCreateCtaImpression: jest.fn(), trackRegisterCtaClicked: jest.fn(),
  }))
  jest.doMock('@/utils/placeContributionAnalytics', () => ({ trackPlaceContribution: jest.fn() }))
  jest.doMock('@/utils/placeRequestsConfig', () => ({ isPlaceRequestsPilotEnabled: () => true }))
  jest.doMock('@/i18n', () => ({ translate: (key: string) => key }))
  jest.doMock('@/i18n/LocaleProvider', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
  // Keep the real container and responsive hooks; unrelated layout barrel exports
  // otherwise pull navigation into this geometry-only server-render test.
  jest.doMock('@/components/layout', () => ({
    ResponsiveContainer: require('@/components/layout/ResponsiveContainer').default,
  }))
  ;({ createElement, act } = require('react'))
  ;({ createRoot, hydrateRoot } = require('react-dom/client'))
  ;({ renderToString } = require('react-dom/server.node'))
  ;({ Platform, StyleSheet } = require('react-native'))
  ContributionBanner = require('@/components/common/ContributionBanner').default
  Button = require('@/components/ui/Button').default
  criticalCss = require('@/utils/criticalCSSBuilder').buildCriticalCSS()
})

function setViewport(width: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width })
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 900 })
  window.dispatchEvent(new Event('resize'))
}

function requiredBlock(host: HTMLElement, marker: string): HTMLElement {
  const node = host.querySelector<HTMLElement>(`[data-bp-layout="${marker}"]`)
  expect(node).not.toBeNull()
  return node!
}

/** Resolve only the actual node's RNW atoms, inline declarations and its emitted
 * min-width registry rules. JSDOM has no viewport layout/media engine; the
 * production CLS guard remains the pixel-level proof. */
function geometry(node: HTMLElement, width: number): CSSStyleDeclaration {
  const style = document.createElement('div').style
  const sheet = StyleSheet.getSheet().textContent
  for (const name of node.classList) {
    const declarations = sheet.match(new RegExp(`\\.${name}\\{([^}]*)\\}`))?.[1]
    if (declarations) style.cssText += declarations
  }
  style.cssText += node.getAttribute('style') ?? ''
  const selector = `[data-bp-layout="${node.getAttribute('data-bp-layout')}"]{`
  for (const media of criticalCss.matchAll(/@media \(min-width:(\d+)px\)\{\n([\s\S]*?)\n\}/g)) {
    if (width < Number(media[1])) continue
    const start = media[2].indexOf(selector)
    if (start >= 0) style.cssText += media[2].slice(start + selector.length).split('}')[0]
  }
  return style
}

describe('ContributionBanner first-frame geometry (#3386)', () => {
  it.each([
    ['compact', 390, true], ['compact', 1280, true],
    ['regular', 390, false], ['regular', 1280, false],
  ] as const)('keeps %s geometry at %i through real SSR and hydration (campaign=%s)', async (density, width, campaign) => {
    setViewport(width)
    const tree = () => createElement(ContributionBanner, { density, ...(campaign ? { campaign: { source: 'places' as const } } : null) })
    const host = document.createElement('div')
    host.innerHTML = renderToString(tree())
    document.body.append(host)
    const beforeCopy = host.textContent
    const beforeActions = [...host.querySelectorAll('[role="button"],[role="link"]')].map(node => node.textContent)
    const wide = width >= 768
    const marker = `contribution-${density}`
    const readFrame = () => {
      const card = geometry(requiredBlock(host, `${marker}-card`), width)
      const container = geometry(requiredBlock(host, 'contribution-container-frame'), width)
      const wrapper = geometry(requiredBlock(host, `${marker}-wrapper`), width)
      const buttons = geometry(requiredBlock(host, `${marker}-buttons`), width)
      expect(card.flexDirection).toBe(wide ? 'row' : 'column')
      expect(card.paddingLeft).toBe(`${density === 'compact' ? wide ? 18 : 14 : wide ? 28 : 16}px`)
      expect(wrapper.paddingTop).toBe(`${density === 'compact' ? wide ? 10 : 8 : wide ? 20 : 12}px`)
      expect(container.paddingLeft).toBe(wide ? '40px' : '16px')
      expect(container.paddingTop).toBe(wide ? '32px' : '8px')
      expect(buttons.flexDirection).toBe(wide ? 'row' : 'column')
      if (!campaign) {
        const actions = host.querySelectorAll<HTMLElement>(`[data-bp-layout="${marker}-action"]`)
        expect(actions).toHaveLength(2)
        for (const action of actions) {
          expect(action.getAttribute('role')).toBe('button')
          expect(geometry(action, width).width).toBe(wide ? 'auto' : '100%')
        }
      }
      return [card.cssText, container.cssText, wrapper.cssText, buttons.cssText]
    }
    const before = readFrame()
    const errors: unknown[] = []
    let root: import('react-dom/client').Root | undefined
    try {
      await act(async () => { root = hydrateRoot(host, tree(), { onRecoverableError: error => errors.push(error) }) })
      expect(errors).toEqual([])
      expect(host.textContent).toBe(beforeCopy)
      expect([...host.querySelectorAll('[role="button"],[role="link"]')].map(node => node.textContent)).toEqual(beforeActions)
      const after = readFrame()
      // Geometry properties are stable even though RNW replaces the width-zero
      // atoms with the real viewport atoms after this consumer commits.
      for (let index = 0; index < before.length; index++) {
        const first = document.createElement('div').style
        const second = document.createElement('div').style
        first.cssText = before[index]
        second.cssText = after[index]
        for (const key of ['flex-direction', 'padding-left', 'padding-top', 'width', 'max-width']) {
          expect(second.getPropertyValue(key)).toBe(first.getPropertyValue(key))
        }
      }
    } finally {
      await act(async () => root?.unmount())
      host.remove()
    }
  })

  it('forwards optional Button web data to its existing Pressable without changing disabled/click behavior', async () => {
    const host = document.createElement('div')
    document.body.append(host)
    const onPress = jest.fn()
    const root = createRoot(host)
    try {
      await act(async () => root.render(createElement(Button, { label: 'Action', dataSet: { bpLayout: 'button-probe' }, onPress })))
      const button = requiredBlock(host, 'button-probe')
      expect(button.getAttribute('role')).toBe('button')
      await act(async () => button.click())
      expect(onPress).toHaveBeenCalledTimes(1)
      await act(async () => root.render(createElement(Button, { label: 'Action', dataSet: { bpLayout: 'button-probe' }, onPress, disabled: true })))
      expect(requiredBlock(host, 'button-probe').getAttribute('aria-disabled')).toBe('true')
      await act(async () => requiredBlock(host, 'button-probe').click())
      expect(onPress).toHaveBeenCalledTimes(1)
    } finally {
      await act(async () => root.unmount())
      host.remove()
    }
  })

  it('does not forward web layout data from a native banner or Button', async () => {
    const previous = Platform.OS
    const host = document.createElement('div')
    const root = createRoot(host)
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' })
    try {
      await act(async () => root.render(createElement('div', null,
        createElement(ContributionBanner, { density: 'compact', campaign: { source: 'places' } }),
        createElement(Button, { label: 'Native control', dataSet: { bpLayout: 'native-probe' } }),
      )))
      expect(host.querySelector('[data-bp-layout]')).toBeNull()
      expect(host.textContent).toContain('Native control')
    } finally {
      await act(async () => root.unmount())
      Object.defineProperty(Platform, 'OS', { configurable: true, value: previous })
    }
  })
})
