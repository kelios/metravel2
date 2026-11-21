/**
 * #3467: объявленные `Tabs.Screen` группы `(tabs)` должны совпадать с порядком,
 * в котором expo-router сортирует файлы группы. Иначе `useNavigationBuilder`
 * видит расхождение `routeNames` с начальным состоянием и на каждой загрузке
 * синхронно ставит `ROUTE_NAMES_CHANGED`: состояние навигации меняется над
 * ещё не гидратированными Suspense-границами, и React догидратирует всю
 * страницу одной задачей, в том числе внутри первого тапа (INP на mobile).
 * Полнота — #2727: необъявленный маршрут становится пустым placeholder-табом.
 *
 * Порядок считается функциями самого expo-router по реальному дереву `app/`,
 * а не копией списка, поэтому новый файл-маршрут без объявления или не на
 * своём месте роняет тест.
 */
import fs from 'fs'
import path from 'path'

const { getRoutes } = require('expo-router/build/getRoutes')
const { sortRoutesWithInitial } = require('expo-router/build/sortRoutes')
const { getValidInitialRouteName } = require('expo-router/build/routeNode')

type RouteNode = { route: string; children?: RouteNode[] }

const APP_DIR = path.resolve(__dirname, '../../app')
const LAYOUT = path.join(APP_DIR, '(tabs)', '_layout.tsx')

const listRouteFiles = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return listRouteFiles(full)
    return /\.(tsx?|jsx?)$/.test(entry.name) ? [`./${path.relative(APP_DIR, full)}`] : []
  })

const findRoute = (node: RouteNode, route: string): RouteNode | undefined =>
  node.route === route ? node : (node.children ?? []).map((child) => findRoute(child, route)).find(Boolean)

function routerOrderOfTabsGroup(): string[] {
  // Metro отдаёт ключи require.context отсортированными (contextModuleTemplates: files.sort()),
  // а порядок ключей решает равные по длине маршруты; порядок readdir от ФС не гарантирован.
  const keys = listRouteFiles(APP_DIR).sort()
  // Модули маршрутов не исполняются: для дерева и сортировки нужны только имена файлов.
  const context = Object.assign(() => ({ default: () => null }), {
    keys: () => keys,
    resolve: (key: string) => key,
    id: 'app',
  })
  const tree = getRoutes(context, { importMode: 'lazy', platform: 'web', ignoreEntryPoints: true }) as RouteNode
  const tabs = findRoute(tree, '(tabs)')
  if (!tabs?.children?.length) throw new Error('route group (tabs) not found in app/')
  return [...tabs.children]
    .sort(sortRoutesWithInitial(getValidInitialRouteName(tabs)))
    .map((child) => child.route)
}

function declaredScreens(): string[] {
  const source = fs.readFileSync(LAYOUT, 'utf8')
  return [...source.matchAll(/<Tabs\.Screen\s+name="([^"]+)"/g)].map((match) => match[1])
}

describe('(tabs)/_layout screen declarations (#3467, #2727)', () => {
  it('declares every route of the group exactly in expo-router order', () => {
    // Модули маршрутов здесь не грузятся, поэтому unstable_settings.anchor/initialRouteName
    // группы тест не видит, а в рантайме они ставят свой маршрут первым. Появились — тест надо учить.
    expect(fs.readFileSync(LAYOUT, 'utf8')).not.toMatch(/\b(anchor|initialRouteName)\b/)
    const expected = routerOrderOfTabsGroup()
    expect(expected.length).toBeGreaterThan(10)
    expect(declaredScreens()).toEqual(expected)
  })
})
