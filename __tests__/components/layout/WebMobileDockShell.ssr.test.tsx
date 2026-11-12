import type React from 'react'
import type { Root } from 'react-dom/client'

let mockPath = '/quests'
const mockNavigate = jest.fn()
let act: typeof import('react').act, createElement: typeof import('react').createElement
let createRoot: typeof import('react-dom/client').createRoot, hydrateRoot: typeof import('react-dom/client').hydrateRoot
let renderToString: typeof import('react-dom/server').renderToString
let Dock: React.ComponentType<any>, Footer: React.ComponentType<any>, More: React.ComponentType<any>

beforeAll(() => {
  jest.resetModules()
  jest.doMock('react-native', () => jest.requireActual('react-native-web'))
  jest.doMock('expo-router', () => {
    const React = require('react')
    return {
      usePathname: () => mockPath,
      useRouter: () => ({ navigate: mockNavigate, push: mockNavigate }),
      useFocusEffect: (effect: () => undefined | (() => void)) => {
        React.useEffect(() => effect(), [effect])
      },
      Link: ({ href, children, ...props }: any) => React.createElement('a', { href, ...props }, children),
    }
  })
  jest.doMock('@/hooks/useResponsive', () => ({ useResponsive: () => ({ isDesktop: false, width: 390 }) }))
  jest.doMock('@/hooks/useTheme', () => ({ useThemedColors: () => require('@/constants/designSystem').getThemedColors(false) }))
  jest.doMock('@/context/AuthContext', () => ({ useAuth: () => ({ isSuperuser: false, logout: jest.fn() }) }))
  jest.doMock('@/components/layout/BottomDockMoreList', () => ({ __esModule: true, default: () => null }))
  jest.doMock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }))
  jest.doMock('@/components/layout/ScreenHeaderContext', () => ({ useScreenHeader: () => {} }))
  ;({ act, createElement } = require('react'))
  ;({ createRoot, hydrateRoot } = require('react-dom/client'))
  ;({ renderToString } = require('react-dom/server.node'))
  Dock = require('@/components/layout/WebMobileDockShell').default
  More = require('@/app/(tabs)/more').default
  // Test the production lazy Footer path, NOT its JEST_WORKER_ID eager escape.
  const worker = process.env.JEST_WORKER_ID
  delete process.env.JEST_WORKER_ID
  // Expo's Jest native resolver would choose Footer.native.tsx; pin actual web source.
  try { Footer = require('@/components/layout/Footer.tsx').default } finally { process.env.JEST_WORKER_ID = worker }
})

describe('persistent real SSR dock (#2216)', () => {
  let container: HTMLDivElement, root: Root | undefined
  beforeEach(() => { mockPath = '/quests'; mockNavigate.mockClear(); container = document.createElement('div'); document.body.appendChild(container) })
  afterEach(async () => { if (root) await act(async () => root!.unmount()); root = undefined; container.remove() })
  it('prerenders exactly5 ordinary hrefs and the fallback route has real destinations', () => {
    const html = renderToString(createElement(Dock)), doc = new DOMParser().parseFromString(html, 'text/html')
    expect([...doc.querySelectorAll('[data-testid="footer-dock-row"] a')].map(a => a.getAttribute('href'))).toEqual(['/search', '/map', '/quests', '/profile', '/more'])
    expect(doc.querySelectorAll('[role="tablist"] [role="tab"]')).toHaveLength(5)
    expect(doc.querySelectorAll('[aria-selected="true"]')).toHaveLength(1)
    const more = new DOMParser().parseFromString(renderToString(createElement(More)), 'text/html')
    // #2779: страница `/more` без JS несёт тот же набор, что лист «Ещё»: пункты дока
    // и все переходы листа внутри сайта (действия и внешние ссылки требуют приложения).
    const { BOTTOM_DOCK_MORE_MENU_SECTIONS } = require('@/components/layout/bottomDockModel')
    const sheetRoutes = BOTTOM_DOCK_MORE_MENU_SECTIONS.flatMap((section: { items: { route?: string; external?: boolean }[] }) => section.items)
      .filter((item: { route?: string; external?: boolean }) => item.route && !item.external)
      .map((item: { route?: string }) => item.route)
      // #2866: «Адвент-календарь» в статический HTML не попадает — страница добавляет его после гидратации в окне кампании.
      .filter((route: string) => route !== '/advent')
    expect([...more.querySelectorAll('a')].map(a => a.getAttribute('href'))).toEqual(['/search', '/map', '/quests', '/profile', ...sheetRoutes])
    expect(sheetRoutes).toEqual(expect.arrayContaining(['/travelsby', '/places', '/trips', '/roulette', '/articles', '/history', '/privacy', '/contact']))
    expect([...more.querySelectorAll('a')].every(a => a.getAttribute('href')?.startsWith('/') && a.getAttribute('href') !== '/more' && a.textContent?.trim())).toBe(true)
  })
  it('hydrates the SAME row, preserves href/modified clicks and updates active state', async () => {
    container.innerHTML = renderToString(createElement(Dock))
    const row = container.querySelector('[data-testid="footer-dock-row"]'), errors: unknown[] = []
    await act(async () => { root = hydrateRoot(container, createElement(Dock), { onRecoverableError: e => errors.push(e) }) })
    expect(errors).toEqual([]); expect(container.querySelector('[data-testid="footer-dock-row"]')).toBe(row)
    const map = container.querySelector<HTMLAnchorElement>('[data-testid="footer-item-map"]')!
    await act(async () => { map.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, ctrlKey: true })) }); expect(mockNavigate).not.toHaveBeenCalled()
    await act(async () => { map.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })) }); expect(mockNavigate).toHaveBeenCalledWith('/map')
    mockPath = '/map'; await act(async () => root!.render(createElement(Dock)))
    expect(map.getAttribute('aria-current')).toBe('page'); expect(container.querySelectorAll('[aria-current="page"]')).toHaveLength(1)
  })
  it('real deferred Footer adds only its controller; ordinary More opens its actual sheet without duplicating row', async () => {
    expect(require('react-native').Platform.OS).toBe('web')
    root = createRoot(container)
    await act(async () => { root!.render(createElement(require('react').Fragment, null, createElement(Dock), createElement(Footer, { webDockManagedByRoot: true }))) })
    // The actual dynamic import/controller effects settle; no fake event handler.
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)) })
    expect(container.querySelectorAll('[data-testid="footer-dock-wrapper"]')).toHaveLength(1)
    const more = container.querySelector<HTMLAnchorElement>('[data-testid="footer-item-more"]')!
    await act(async () => { more.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })) })
    expect(container.querySelector('[data-testid="footer-more-sheet"]')).not.toBeNull()
    expect(mockNavigate).not.toHaveBeenCalledWith('/more')
    expect(container.querySelectorAll('[data-testid="footer-dock-row"]')).toHaveLength(1)
  })
})

// #3217: the dock «Quests» item goes through the same nav helper as the header —
// the locale hub on web with published hubs, `/quests` otherwise and on native.
describe('dock «Quests» href follows the interface locale (#3217)', () => {
  const originalFlag = process.env.EXPO_PUBLIC_QUEST_LOCALE_HUBS
  let i18n: typeof import('@/i18n/instance').default, Platform: typeof import('react-native').Platform, originalOs: string
  beforeAll(() => {
    i18n = require('@/i18n/instance').default
    ;({ Platform } = require('react-native'))
    originalOs = Platform.OS
  })
  afterEach(async () => {
    if (originalFlag === undefined) delete process.env.EXPO_PUBLIC_QUEST_LOCALE_HUBS
    else process.env.EXPO_PUBLIC_QUEST_LOCALE_HUBS = originalFlag
    Object.defineProperty(Platform, 'OS', { configurable: true, value: originalOs })
    await i18n.changeLanguage('ru')
  })
  const renderDock = async (opts: { os: string; flag: string; locale: string; path: string }) => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: opts.os })
    process.env.EXPO_PUBLIC_QUEST_LOCALE_HUBS = opts.flag
    await i18n.changeLanguage(opts.locale)
    mockPath = opts.path
    const doc = new DOMParser().parseFromString(renderToString(createElement(Dock)), 'text/html')
    const quests = doc.querySelector('[data-testid="footer-item-quests"]')!
    const more = new DOMParser().parseFromString(renderToString(createElement(More)), 'text/html')
    return { href: quests.getAttribute('href'), active: quests.getAttribute('aria-current'), moreHrefs: [...more.querySelectorAll('a')].map(a => a.getAttribute('href')) }
  }

  it.each(['pl', 'en'])('web + published hubs + %s → /%s/quests, active on the hub', async (locale) => {
    const dock = await renderDock({ os: 'web', flag: 'true', locale, path: `/${locale}/quests` })
    expect(dock.href).toBe(`/${locale}/quests`)
    expect(dock.active).toBe('page')
    expect(dock.moreHrefs).toContain(`/${locale}/quests`)
    expect(dock.moreHrefs).not.toContain('/quests')
  })

  it.each([
    ['ru on web with published hubs', { os: 'web', flag: 'true', locale: 'ru' }],
    ['pl on web with hubs unpublished', { os: 'web', flag: 'false', locale: 'pl' }],
    ['pl on native', { os: 'ios', flag: 'true', locale: 'pl' }],
  ])('%s → /quests', async (_name, opts) => {
    const dock = await renderDock({ ...opts, path: '/quests' })
    expect(dock.href).toBe('/quests')
    expect(dock.active).toBe('page')
  })

  // The dock row rendered by `BottomDock` itself (web without the root shell, native):
  // activity is computed from the canonical route, not from the localized href.
  it('BottomDock row keeps «Quests» active on the locale hub', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' })
    process.env.EXPO_PUBLIC_QUEST_LOCALE_HUBS = 'true'
    await i18n.changeLanguage('pl')
    mockPath = '/pl/quests/12/some-quest'
    const BottomDock = require('@/components/layout/BottomDock').default
    const doc = new DOMParser().parseFromString(renderToString(createElement(BottomDock)), 'text/html')
    expect([...doc.querySelectorAll('[aria-selected="true"]')].map(el => el.getAttribute('data-testid'))).toEqual(['footer-item-quests'])
  })
})
