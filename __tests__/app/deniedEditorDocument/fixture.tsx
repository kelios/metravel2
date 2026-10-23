/** @jest-environment jsdom */
import type React from 'react'
import type { Root } from 'react-dom/client'
import fs from 'node:fs'
import path from 'node:path'

let ReactModule: typeof React
let hydrateRoot: typeof import('react-dom/client').hydrateRoot
let renderToString: typeof import('react-dom/server').renderToString
let ExpoRoot: React.ComponentType<any>
let HeadProvider: React.ComponentType<{ children: React.ReactNode; context: Record<string, unknown> }> & { canUseDOM: boolean }
let InnerRoot: React.ComponentType<{ children: React.ReactNode; loadedData: null }>
let serverRendering = false
let RootLayout: React.ComponentType
let AppTabsLayout: React.ComponentType
let CatchAllRoute: React.ComponentType
let makeContext: (routes: Record<string, unknown>) => unknown
let router: { push: (path: string) => void; replace: (path: string) => void; back: () => void }
const mockEditorMount = jest.fn()
const mockHeaderMount = jest.fn()
const mockQueryClient = jest.fn((_config: unknown, _options: { enableStaticPrefetch: boolean }) => ({}))

jest.mock('@/hooks/useTheme', () => {
  const React = require('react')
  const { getThemedColors } = require('@/constants/designSystem')
  return {
    ThemeContext: React.createContext({ isDark: false }),
    ThemeProvider: ({ children }: { children: React.ReactNode }) => children,
    useTheme: () => ({ isDark: false, themeReady: true }),
    useThemedColors: () => getThemedColors(false), getThemedColors,
  }
})
jest.mock('@/components/layout/AppProviders', () => ({
  __esModule: true,
  // Keep the actual boot-locale Suspense ancestor; API/auth/query runtimes are
  // outside this navigation/document source fixture.
  default: ({ children }: { children: React.ReactNode }) => require('react').createElement(require('@/i18n/LocaleProvider').LocaleProvider, null, children),
}))
jest.mock('@/components/layout/NativeAppRuntime', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/quests/QuestProgressQueueRuntime', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/profile/BlockedAuthorsRuntime', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/profile/ProfileLanguageSyncRuntime', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/ui/ConfirmDialogHost', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/auth/TermsReacceptGate', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/layout/rootRuntimeComponents', () => ({
  NativeFooterComponent: null, RootWebDeferredChromeComponent: null,
  RootWebFooterComponent: require('@/components/layout/RootWebFooter.web').default,
  ToastComponent: null, SyncIndicatorComponent: null, ReactQueryDevtoolsComponent: null,
}))
jest.mock('@/hooks/useLaunchSplash', () => ({ useLaunchSplash: () => false }))
jest.mock('@/hooks/useAriaHiddenFocusGuard', () => ({ useAriaHiddenFocusGuard: () => {} }))
jest.mock('@/hooks/useWebScrollDelegation', () => ({ useWebScrollDelegation: () => {} }))
jest.mock('@/utils/qaDebug', () => ({ installQaDebug: () => {} }))
jest.mock('@/utils/patchWebShadowStyles', () => ({ patchWebShadowStyles: () => {} }))
jest.mock('@/utils/chunkReload', () => ({ installChunkErrorReloadHandler: () => {} }))
jest.mock('@/utils/reactQueryConfig', () => ({ createOptimizedQueryClient: mockQueryClient }))
jest.mock('@/api/activeQueryClient', () => ({ setActiveQueryClient: () => {} }))
jest.mock('@expo/vector-icons/Feather', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/layout/CustomHeader', () => ({
  __esModule: true,
  default: () => {
    mockHeaderMount()
    return require('react').createElement('div', { 'data-testid': 'main-header' })
  },
}))
jest.mock('@/app/(tabs)/quests/[city]/[questId]', () => ({
  __esModule: true,
  default: ({ route }: { route: { path: string } }) => require('react').createElement('div', { 'data-testid': 'localized-quest' }, route.path),
}))

beforeAll(async () => {
  jest.resetModules()
  process.env.EXPO_ROUTER_IMPORT_MODE = 'lazy'
  jest.doMock('react-native', () => ({ ...jest.requireActual('react-native-web'), LogBox: { ignoreLogs: () => {} } }))
  jest.unmock('expo-router')
  jest.unmock('expo-router/head')
  jest.doMock('react-native-safe-area-context', () => jest.requireActual('react-native-safe-area-context'))
  ReactModule = require('react')
  ;({ hydrateRoot } = require('react-dom/client'))
  const serverRender = require('react-dom/server.node').renderToString
  renderToString = element => {
    const canUseDOM = HeadProvider.canUseDOM
    // Actual static renderer runs in Node, unlike this jsdom hydration test.
    HeadProvider.canUseDOM = false
    serverRendering = true
    try { return serverRender(element) } finally { HeadProvider.canUseDOM = canUseDOM; serverRendering = false }
  }
  ;({ ExpoRoot } = require('expo-router/build/ExpoRoot'))
  HeadProvider = require('expo-router/head').default.Provider
  ;({ InnerRoot } = require('expo-router/build/static/html'))
  ;({ router } = require('expo-router'))
  ;({ inMemoryContext: makeContext } = require('expo-router/build/testing-library/context-stubs'))
  RootLayout = require('@/app/_layout').default
  AppTabsLayout = require('@/app/(tabs)/_layout').default
  // Existing locale exports pre-register their quest chunk. Let the real
  // adapter's own preload complete for those independent compatibility controls.
  window.history.replaceState(null, '', '/be/quests/4/minsk-cmok')
  CatchAllRoute = require('@/app/[...missing].web').default
  await Promise.resolve()
  await Promise.resolve()
  await Promise.all(['be', 'uk', 'pl', 'en'].map(locale => require('@/i18n/translate').loadWebLocale(locale)))
})

// Mirror qualified-entry on the client, and renderStaticContent's additional
// context-only InnerRoot on the server. ServerContainer must never mount.
function EntryRoot(props: Record<string, unknown>) {
  const content = ReactModule.createElement(ExpoRoot, props)
  return ReactModule.createElement(HeadProvider, { context: {}, children: serverRendering
    ? ReactModule.createElement(InnerRoot, { loadedData: null, children: content })
    : content })
}

function Editor() {
  mockEditorMount()
  return ReactModule.createElement('div', { 'data-testid': 'editor' }, 'editor')
}

function Home() {
  const [value, setValue] = ReactModule.useState(0)
  return ReactModule.createElement('button', { 'data-testid': 'home', onClick: () => setValue(value + 1) }, String(value))
}

function context(cold: boolean, pendingLayout = false) {
  const LazyEditor = ReactModule.lazy(() => new Promise<{ default: typeof Editor }>(() => {}))
  // Inventory only: keep the real app Tabs builder/options/layout, with inert
  // unrelated route modules. This avoids loading unrelated feature UIs.
  const tabNames = [...fs.readFileSync(path.resolve('app/(tabs)/_layout.tsx'), 'utf8').matchAll(/<Tabs\.Screen name="([^"]+)"/g)].map(match => match[1])
  return makeContext({
    ...Object.fromEntries(tabNames.map(name => [`(tabs)/${name}`, () => null])),
    _layout: RootLayout,
    // Metro returns the raw wrapper synchronously only after its boot chunk and
    // dependencies register. The shared implementation being imported above
    // does not make a pending route-wrapper load synchronous.
    '(tabs)/_layout': { _result: pendingLayout ? new Promise(() => {}) : { default: AppTabsLayout } },
    '(tabs)/travel/[id]': cold ? () => ReactModule.createElement(ReactModule.Suspense, {
      fallback: ReactModule.createElement('div', { 'data-testid': 'editor-spinner' }),
    }, ReactModule.createElement(LazyEditor)) : Editor,
    '(tabs)/index': Home,
    '[...missing]': CatchAllRoute,
  })
}

const dockState = (container: Element) => [...container.querySelectorAll('[data-testid="footer-dock-row"] a')].map(a => ({
  href: a.getAttribute('href'), selected: a.getAttribute('aria-selected'), current: a.getAttribute('aria-current'), style: a.getAttribute('style'),
}))

const suspenseComments = (container: Element) => {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_COMMENT)
  const comments: string[] = []
  while (walker.nextNode()) comments.push(walker.currentNode.nodeValue ?? '')
  return comments
}

const navigationSnapshot = () => {
  const { store } = require('expo-router/build/global-state/router-store')
  return { url: window.location.href, routeInfo: store.getRouteInfo(), state: store.state }
}

describe('intentional404 uses the actual root Stack before route SceneView (#2701)', () => {
  let host: HTMLDivElement, root: Root | undefined
  let consoleError: jest.SpyInstance
  let consoleWarn: jest.SpyInstance
  beforeEach(async () => {
    await require('@/i18n/instance').default.changeLanguage('ru')
    document.documentElement.lang = 'ru'
    const { LOCALE_PREFERENCE_STORAGE_KEY } = require('@/i18n/localeStorage')
    window.localStorage.removeItem(LOCALE_PREFERENCE_STORAGE_KEY)
    await require('@react-native-async-storage/async-storage').removeItem(LOCALE_PREFERENCE_STORAGE_KEY)
    jest.useFakeTimers()
    mockEditorMount.mockClear(); mockHeaderMount.mockClear(); mockQueryClient.mockClear()
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => {})
    consoleWarn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    host = document.createElement('div'); document.body.appendChild(host)
  })
  afterEach(async () => {
    if (root) await ReactModule.act(async () => root!.unmount())
    root = undefined; host?.remove(); jest.useRealTimers()
    const errors = consoleError?.mock.calls ?? []
    const warnings = consoleWarn?.mock.calls ?? []
    consoleError?.mockRestore()
    consoleWarn?.mockRestore()
    expect(errors).toEqual([])
    expect(warnings).toEqual([])
  })

  it('uses the pinned exporter generated +not-found filename with the actual catch-all context', () => {
    const { getRoutes } = require('expo-router/build/getRoutes')
    const { getReactNavigationConfig } = require('expo-router/build/getReactNavigationConfig')
    const { getHtmlFiles } = require('@expo/cli/build/src/export/exportStaticAsync')
    const manifest = getReactNavigationConfig(getRoutes(context(false), { platform: 'web' }), false)
    const files = getHtmlFiles({ manifest, includeGroupVariations: false })
    expect(files).toContainEqual(expect.objectContaining({
      filePath: '+not-found.html', pathname: '+not-found',
      route: expect.objectContaining({ route: '+not-found', generated: true }),
    }))
  })

  it('detects the cold missing-layout boundary even when its shared implementation is already imported', () => {
    window.history.replaceState(null, '', '/+not-found')
    host.innerHTML = renderToString(ReactModule.createElement(EntryRoot, { context: context(false), location: new URL(window.location.href) }))
    window.history.replaceState(null, '', '/travel/42?returnTo=%2Fmetravel#owned')
    const cold = context(true, true)
    const { getRoutes } = require('expo-router/build/getRoutes')
    const tabs = getRoutes(cold, { platform: 'web', skipGenerated: true }).children.find((route: { route: string }) => route.route === '(tabs)')
    expect(tabs.loadRoute()).toBeInstanceOf(Promise)
    const unregistered = renderToString(ReactModule.createElement(EntryRoot, { context: cold, location: new URL(window.location.href) }))
    expect(unregistered).toContain('<!--$!-->')
    expect(unregistered).toContain('which does not support Suspense')
    expect(unregistered).not.toContain('data-testid="editor-spinner"')
    expect(mockEditorMount).not.toHaveBeenCalled()
    expect(mockHeaderMount).not.toHaveBeenCalled()
    const registered = getRoutes(context(true), { platform: 'web', skipGenerated: true }).children.find((route: { route: string }) => route.route === '(tabs)')
    expect(registered.loadRoute()).toEqual({ default: AppTabsLayout })
  })

  it.each([
    { cold: true, serverPath: '/+not-found', path: '/travel/42' },
    { cold: false, serverPath: '/+not-found', path: '/travel/42' },
    { cold: true, serverPath: '/+not-found', path: '/travel/0' },
    { cold: true, serverPath: '/ordinary-unknown-path', path: '/travel/000123' },
    { cold: false, serverPath: '/+not-found', path: '/travel/9007199254740993' },
  ])('hydrates generic SSR $serverPath at $path with cold=$cold and no editor/header', async ({ cold, serverPath, path }) => {
    const routes = context(cold)
    window.history.replaceState(null, '', serverPath)
    const server = ReactModule.createElement(EntryRoot, { context: routes, location: new URL(window.location.href) })
    const html = renderToString(server)
    expect(html).toContain('<!--$-->')
    expect(html).toContain('static-not-found')
    expect(html).toContain('data-testid="footer-desktop"')
    host.innerHTML = html
    const marker = host.querySelector('#static-not-found'), dock = host.querySelector('[data-testid="footer-dock-row"]')
    const baselineDock = dockState(host)
    const baselineSuspense = suspenseComments(host)
    const historyLength = window.history.length
    window.history.replaceState(null, '', `${path}?returnTo=%2Fmetravel#owned`)
    const errors: unknown[] = []
    await ReactModule.act(async () => {
      root = hydrateRoot(host, ReactModule.createElement(EntryRoot, { context: routes, location: new URL(window.location.href) }), {
        onRecoverableError: error => errors.push(error),
      })
    })
    expect(errors).toEqual([])
    expect(host.querySelector('#static-not-found')).toBe(marker)
    expect(host.querySelector('[data-testid="footer-dock-row"]')).toBe(dock)
    expect(dockState(host)).toEqual(baselineDock)
    expect(suspenseComments(host)).toEqual(baselineSuspense)
    expect(baselineDock).toHaveLength(5)
    expect(baselineDock.every(a => a.selected === 'false' && a.current === null)).toBe(true)
    expect(host.querySelector('[data-mt-dock="off"]')).toBeNull()
    expect(mockHeaderMount).not.toHaveBeenCalled()
    expect(mockEditorMount).not.toHaveBeenCalled()
    expect(host.querySelector('[data-testid="editor-spinner"]')).toBeNull()
    expect(window.location.pathname + window.location.search + window.location.hash).toBe(`${path}?returnTo=%2Fmetravel#owned`)
    expect(window.history.length).toBe(historyLength)
    expect(navigationSnapshot().routeInfo).toMatchObject({ pathname: path, params: { id: path.slice('/travel/'.length), returnTo: '/metravel' } })
    expect(mockQueryClient.mock.calls.every(call => (call[1] as { enableStaticPrefetch: boolean }).enableStaticPrefetch === false)).toBe(true)
    await ReactModule.act(async () => { jest.advanceTimersByTime(1000) })
    expect(host.querySelector('#static-not-found')).toBe(marker)
    expect(mockHeaderMount).not.toHaveBeenCalled()
    expect(mockEditorMount).not.toHaveBeenCalled()
  })

  it('hydrates the normal editor tree without treating an unmarked numeric document as denied', async () => {
    const routes = context(false)
    window.history.replaceState(null, '', '/travel/42')
    const tree = ReactModule.createElement(EntryRoot, { context: routes, location: new URL(window.location.href) })
    host.innerHTML = renderToString(tree)
    const editor = host.querySelector('[data-testid="editor"]')
    expect(editor).not.toBeNull()
    expect(host.querySelector('#static-not-found')).toBeNull()
    expect(host.querySelector('[data-testid="footer-dock-row"]')).toBeNull()
    const errors: unknown[] = []
    await ReactModule.act(async () => { root = hydrateRoot(host, tree, { onRecoverableError: error => errors.push(error) }) })
    expect(errors).toEqual([])
    expect(host.querySelector('[data-testid="editor"]')).toBe(editor)
    expect(mockQueryClient.mock.calls.every(call => call[1].enableStaticPrefetch)).toBe(true)
  })

  it.each(['be', 'uk', 'pl', 'en'])('lets the real catch-all SceneView own a supported %s quest path', async locale => {
    const routes = context(false)
    window.history.replaceState(null, '', `/${locale}/quests/4/minsk-cmok`)
    await require('@/i18n/instance').default.changeLanguage(locale)
    document.documentElement.lang = locale
    const tree = ReactModule.createElement(EntryRoot, { context: routes, location: new URL(window.location.href) })
    host.innerHTML = renderToString(tree)
    const quest = host.querySelector('[data-testid="localized-quest"]')
    expect(quest?.textContent).toBe(`/${locale}/quests/4/minsk-cmok`)
    expect(host.querySelector('#static-not-found')).toBeNull()
    const errors: unknown[] = []
    await ReactModule.act(async () => { root = hydrateRoot(host, tree, { onRecoverableError: error => errors.push(error) }) })
    expect(errors).toEqual([])
    expect(host.querySelector('[data-testid="localized-quest"]')).toBe(quest)
  })

  it('consumes a delivered denial after Home and an ordinary SPA editor revisit', async () => {
    const routes = context(false)
    window.history.replaceState(null, '', '/+not-found')
    host.innerHTML = renderToString(ReactModule.createElement(EntryRoot, { context: routes, location: new URL(window.location.href) }))
    window.history.replaceState(null, '', '/travel/42')
    const errors: unknown[] = []
    await ReactModule.act(async () => { root = hydrateRoot(host, ReactModule.createElement(EntryRoot, { context: routes, location: new URL(window.location.href) }), { onRecoverableError: error => errors.push(error) }) })
    expect(mockEditorMount).not.toHaveBeenCalled()
    const buttons = host.querySelectorAll('#static-not-found [role="button"]')
    expect(buttons).toHaveLength(2)
    await ReactModule.act(async () => { buttons[0].dispatchEvent(new MouseEvent('click', { bubbles: true })); jest.advanceTimersByTime(50) })
    expect({ home: host.querySelector('[data-testid="home"]') !== null, navigation: navigationSnapshot() }).toMatchObject({ home: true })
    await ReactModule.act(async () => { router.push('/travel/42'); jest.advanceTimersByTime(50) })
    expect(host.querySelector('[data-testid="editor"]')).not.toBeNull()
    expect(host.querySelector('#static-not-found')).toBeNull()
    expect(mockEditorMount).toHaveBeenCalled()
    await ReactModule.act(async () => { window.history.back(); await jest.advanceTimersByTimeAsync(100) })
    expect(host.querySelector('[data-testid="home"]')).not.toBeNull()
    expect(host.querySelector('#static-not-found')).toBeNull()
    await ReactModule.act(async () => { window.history.forward(); await jest.advanceTimersByTimeAsync(100) })
    expect(host.querySelector('[data-testid="editor"]')).not.toBeNull()
    expect(host.querySelector('#static-not-found')).toBeNull()
    expect(errors).toEqual([])
  })

  it('preserves a hidden root screen state across ordinary NotFound and Back', async () => {
    const routes = context(false)
    window.history.replaceState(null, '', '/')
    const tree = ReactModule.createElement(EntryRoot, { context: routes, location: new URL(window.location.href) })
    host.innerHTML = renderToString(tree)
    await ReactModule.act(async () => { root = hydrateRoot(host, tree) })
    const home = host.querySelector('[data-testid="home"]')!
    await ReactModule.act(async () => { home.dispatchEvent(new MouseEvent('click', { bubbles: true })); router.push('/unmatched') ; jest.advanceTimersByTime(50) })
    expect(host.querySelector('#static-not-found')).not.toBeNull()
    expect({ sameHome: host.querySelector('[data-testid="home"]') === home, navigation: navigationSnapshot() }).toMatchObject({ sameHome: true })
    await ReactModule.act(async () => { router.back(); jest.advanceTimersByTime(50) })
    expect({ sameHome: host.querySelector('[data-testid="home"]') === home, navigation: navigationSnapshot() }).toMatchObject({ sameHome: true })
    expect(home.textContent).toBe('1')
  })
})
