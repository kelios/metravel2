/**
 * @jest-environment jsdom
 */

import type React from 'react'

import { SECRET_LINK_ROUTES } from '@/utils/secretLinkRoutes'

/**
 * #2178: заранее собранная разметка (SSG) страницы из письма строится без query
 * и без хранилища вкладки, а браузер приходит с секретом в адресе — или, после
 * посадки и F5, с секретом в sessionStorage (#2145). Первая клиентская отрисовка
 * обязана совпасть с этой разметкой, иначе React #418 выбрасывает её и рисует
 * экран заново. Здесь — настоящий серверный рендер react-native-web и
 * `hydrateRoot` реального экрана каждого маршрута из `SECRET_LINK_ROUTES`:
 * новый секретный маршрут попадает в проверку сам.
 */

let createElement: typeof import('react').createElement
let act: typeof import('react').act
let hydrateRoot: typeof import('react-dom/client').hydrateRoot
let renderToString: typeof import('react-dom/server').renderToString

let mockParams: Record<string, string | undefined> = {}
const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), setParams: jest.fn() }

jest.mock('expo-router', () => ({
  router: mockRouter,
  useRouter: () => mockRouter,
  useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn(), canGoBack: () => false }),
  useLocalSearchParams: () => mockParams,
  useIsFocused: () => true,
}))

const ROUTE_CASES = SECRET_LINK_ROUTES.flatMap(({ route, secretParams }) =>
  secretParams.map((param) => ({ route, param, key: `metravel:secret-link:${route}:${param}` })),
)

const SCENARIOS = {
  query: 'заход по ссылке: секрет в query',
  stored: 'перезагрузка после посадки: секрет в хранилище вкладки',
  none: 'без секрета',
} as const

const screens = new Map<string, React.ComponentType>()

// Загрузка экранов — самая долгая часть; один раз на файл, а не в каждом тесте.
beforeAll(() => {
  jest.resetModules()
  jest.doMock('react-native', () => jest.requireActual('react-native-web'))
  ;({ createElement, act } = require('react'))
  ;({ hydrateRoot } = require('react-dom/client'))
  // `.node`: браузерная сборка серверного рендера требует MessageChannel, которого нет в jsdom.
  ;({ renderToString } = require('react-dom/server.node'))
  const { AuthContext } = require('@/context/authContextBase') as { AuthContext: React.Context<unknown> }
  for (const { route } of ROUTE_CASES) {
    const screen = require(`../../app/(tabs)${route}.tsx`).default as React.ComponentType
    screens.set(route, function Screen() {
      return createElement(AuthContext.Provider, { value: {} }, createElement(screen))
    })
  }
}, 120_000)

const isHydrationMessage = (args: unknown[]) =>
  /hydrat|did not match|server rendered|#418|#419|#423|#425/i.test(args.map(String).join(' '))

async function hydrateAfterSsg(
  Screen: React.ComponentType,
  client: { params: Record<string, string>; stored?: [string, string] },
) {
  // Сервер: ни query, ни хранилища вкладки — ровно как при сборке SSG.
  mockParams = {}
  window.sessionStorage.clear()
  const serverHtml = renderToString(createElement(Screen))

  mockParams = client.params
  if (client.stored) window.sessionStorage.setItem(client.stored[0], client.stored[1])

  const container = document.createElement('div')
  container.innerHTML = serverHtml
  document.body.appendChild(container)
  const recoverableErrors: string[] = []
  const consoleErrors = jest.spyOn(console, 'error')
  let root: ReturnType<typeof hydrateRoot> | null = null
  try {
    await act(async () => {
      root = hydrateRoot(container, createElement(Screen), {
        onRecoverableError: (error) => recoverableErrors.push(String((error as Error)?.message ?? error)),
      })
      await Promise.resolve()
    })
    const hydrationConsoleErrors = consoleErrors.mock.calls.filter(isHydrationMessage).map((args) => String(args[0]))
    return { recoverableErrors, hydrationConsoleErrors }
  } finally {
    consoleErrors.mockRestore()
    await act(async () => {
      root?.unmount()
    })
    container.remove()
  }
}

describe('секретные маршруты из писем гидратируются без расхождения с SSG (#2178)', () => {
  it('список маршрутов не пуст', () => {
    expect(ROUTE_CASES.length).toBeGreaterThan(0)
  })

  it.each(
    ROUTE_CASES.flatMap((routeCase) =>
      (Object.keys(SCENARIOS) as Array<keyof typeof SCENARIOS>).map(
        (scenario) => [`${routeCase.route} — ${SCENARIOS[scenario]}`, routeCase, scenario] as const,
      ),
    ),
  )(
    '%s',
    async (_name, { route, param, key }, scenario) => {
      const client =
        scenario === 'query'
          ? { params: { [param]: 'invalid-secret' } }
          : scenario === 'stored'
            ? { params: {}, stored: [key, 'stored-secret'] as [string, string] }
            : { params: {} }
      const result = await hydrateAfterSsg(screens.get(route)!, client)
      expect(result).toEqual({ recoverableErrors: [], hydrationConsoleErrors: [] })
    },
    30_000,
  )
})
