/**
 * @jest-environment jsdom
 */

import type React from 'react'

/**
 * #3489 / #3491: статический HTML собран в один день, а открыт в сезонный
 * (05.12). Раньше живая дата попадала в первый клиентский рендер, и логотип
 * получал рождественские шапку и ёлку, которых нет в HTML, — React #418 на
 * каждой странице с 01.12. Контракт: гидратация логотипа без расхождений, а
 * сезонные элементы появляются после неё. Настоящий серверный рендер
 * react-native-web и `hydrateRoot` с реальным `ThemeProvider`.
 */

jest.unmock('@/hooks/useTheme')

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }))

const BUILD_DAY = new Date(2026, 10, 20, 12)
const SEASON_DAY = new Date(2026, 11, 5, 12)

let createElement: typeof import('react').createElement
let act: typeof import('react').act
let hydrateRoot: typeof import('react-dom/client').hydrateRoot
let renderToString: typeof import('react-dom/server').renderToString
let App: React.ComponentType

beforeAll(() => {
  jest.resetModules()
  jest.doMock('react-native', () => jest.requireActual('react-native-web'))
  ;({ createElement, act } = require('react'))
  ;({ hydrateRoot } = require('react-dom/client'))
  // `.node`: браузерная сборка серверного рендера требует MessageChannel, которого нет в jsdom.
  ;({ renderToString } = require('react-dom/server.node'))
  const { ThemeProvider } = jest.requireActual('@/hooks/useTheme') as typeof import('@/hooks/useTheme')
  const Logo = require('@/components/layout/Logo').default as React.ComponentType
  App = function App() {
    return createElement(ThemeProvider, null, createElement(Logo))
  }
}, 60_000)

beforeEach(() => {
  localStorage.clear()
  document.documentElement.removeAttribute('data-season')
})

afterEach(() => {
  jest.useRealTimers()
})

// Таймеры настоящие: подменяется только дата.
const setDate = (date: Date) =>
  jest.useFakeTimers({
    now: date,
    doNotFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'setImmediate', 'clearImmediate', 'queueMicrotask', 'nextTick', 'requestAnimationFrame', 'cancelAnimationFrame', 'performance'],
  })

const isHydrationMessage = (args: unknown[]) =>
  /hydrat|did not match|server rendered|#418|#419|#423|#425/i.test(args.map(String).join(' '))

describe('Logo hydration in a seasonal day (#3491)', () => {
  it('hydrates the build-day HTML on 05.12 without mismatch, then shows the Christmas hat', async () => {
    setDate(BUILD_DAY)
    const serverHtml = renderToString(createElement(App))
    expect(serverHtml).not.toContain('data-christmas-logo-decoration')

    setDate(SEASON_DAY)
    const container = document.createElement('div')
    container.innerHTML = serverHtml
    document.body.appendChild(container)
    const recoverableErrors: string[] = []
    const consoleErrors = jest.spyOn(console, 'error')
    let root: ReturnType<typeof hydrateRoot> | null = null
    try {
      await act(async () => {
        root = hydrateRoot(container, createElement(App), {
          onRecoverableError: (error) => recoverableErrors.push(String((error as Error)?.message ?? error)),
        })
        await Promise.resolve()
      })
      // Ленивый чанк украшения грузится после гидратации.
      for (let i = 0; i < 20 && !container.querySelector('[data-christmas-logo-decoration="hat"]'); i += 1) {
        await act(async () => {
          await new Promise((resolve) => setTimeout(resolve, 10))
        })
      }
      const hydrationConsoleErrors = consoleErrors.mock.calls.filter(isHydrationMessage).map((args) => String(args[0]))

      expect({ recoverableErrors, hydrationConsoleErrors }).toEqual({ recoverableErrors: [], hydrationConsoleErrors: [] })
      expect(container.querySelector('[data-christmas-logo-decoration="hat"]')).not.toBeNull()
      expect(container.querySelector('[data-christmas-logo-decoration="tree"]')).not.toBeNull()
    } finally {
      consoleErrors.mockRestore()
      await act(async () => {
        root?.unmount()
      })
      container.remove()
    }
  }, 30_000)
})
