import type React from 'react'
import type { Root } from 'react-dom/client'

let mockAppDark = false
let mockSystemScheme = 'light'
let mockPlatform = 'web'
let mockPath = '/quests'
const mockNavigate = jest.fn()
const mockThemeValues: any[] = []

jest.mock('@/hooks/useTheme', () => ({
  ThemeProvider: ({ children }: any) => children,
  useTheme: () => ({ isDark: mockAppDark }),
  useThemedColors: () => require('@/constants/designSystem').getThemedColors(mockAppDark),
}))
jest.mock('expo-router', () => {
  const React = require('react')
  const Stack = ({ children }: any) => children
  Stack.Screen = () => null
  return { usePathname: () => mockPath, useRouter: () => ({ navigate: mockNavigate }), Stack,
    SplashScreen: { preventAutoHideAsync: () => Promise.resolve() },
    DarkTheme: { dark: true, colors: { base: 'dark' } }, DefaultTheme: { dark: false, colors: { base: 'light' } },
    ThemeProvider: ({ value, children }: any) => { mockThemeValues.push(value); return React.createElement(React.Fragment, null, children) },
  }
})
jest.mock('@/components/layout/AppProviders', () => ({ __esModule: true, default: ({ children }: any) => children }))
jest.mock('@/components/layout/NativeAppRuntime', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/layout/LaunchCover', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/quests/QuestProgressQueueRuntime', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/profile/BlockedAuthorsRuntime', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/ui/ErrorBoundary', () => ({ __esModule: true, default: ({ children }: any) => children }))
jest.mock('@/components/ui/ConfirmDialogHost', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/auth/TermsReacceptGate', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/layout/rootRuntimeComponents', () => ({ NativeFooterComponent: null, RootWebDeferredChromeComponent: null, ToastComponent: null, SyncIndicatorComponent: null, ReactQueryDevtoolsComponent: null }))
jest.mock('@/components/layout/SkipLinks', () => ({ __esModule: true, default: () => null }))
jest.mock('@/hooks/useLaunchSplash', () => ({ useLaunchSplash: () => false }))
jest.mock('@/hooks/useAriaHiddenFocusGuard', () => ({ useAriaHiddenFocusGuard: () => {} }))
jest.mock('@/hooks/useWebScrollDelegation', () => ({ useWebScrollDelegation: () => {} }))
jest.mock('@/utils/qaDebug', () => ({ installQaDebug: () => {} }))
jest.mock('@/utils/patchWebShadowStyles', () => ({ patchWebShadowStyles: () => {} }))
jest.mock('@/utils/chunkReload', () => ({ installChunkErrorReloadHandler: () => {} }))
jest.mock('@/utils/reactQueryConfig', () => ({ createOptimizedQueryClient: () => ({}) }))
jest.mock('@/api/activeQueryClient', () => ({ setActiveQueryClient: () => {} }))
jest.mock('@/components/layout/bottomChromeInset', () => ({ BottomChromeInsetProvider: ({ children }: any) => children }))
jest.mock('expo-font', () => ({ useFonts: () => [true, null] }))
jest.mock('@expo/vector-icons/Feather', () => ({ __esModule: true, default: () => null }))

// RootLayout/ThemedContent, its barStyle/navigation decisions and actual eager dock are NOT mocked.
describe.each(['web', 'android', 'ios'])('actual root theme consumer on %s', platform => {
  let ReactModule: typeof React, act: typeof import('react').act, createRoot: typeof import('react-dom/client').createRoot
  let renderToString: typeof import('react-dom/server').renderToString
  let RootLayout: React.ComponentType, container: HTMLDivElement, root: Root
  beforeAll(() => {
    mockPlatform = platform
    jest.resetModules()
    jest.doMock('react-native', () => {
      const rn = jest.requireActual('react-native-web'), React = require('react')
      return { ...rn, Platform: { ...rn.Platform, OS: mockPlatform }, useWindowDimensions: () => ({ width: 390, height: 844, scale: 1, fontScale: 1 }), useColorScheme: () => mockSystemScheme,
        StatusBar: ({ barStyle }: any) => React.createElement('div', { 'data-testid': 'actual-root-native-status-bar', 'data-bar-style': barStyle }), LogBox: { ignoreLogs: () => {} } }
    })
    ReactModule = require('react'); act = ReactModule.act
    ;({ createRoot } = require('react-dom/client'))
    ;({ renderToString } = require('react-dom/server.node'))
    RootLayout = require('@/app/_layout').default
  })
  beforeEach(() => { mockAppDark = false; mockSystemScheme = 'light'; mockPath = '/quests'; mockThemeValues.length = 0; container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container) })
  afterEach(async () => { await act(async () => root.unmount()); container.remove() })
  const mount = () => act(async () => { root.render(ReactModule.createElement(RootLayout)) })
  it.each([[false, 'light'], [false, 'dark'], [true, 'light'], [true, 'dark']])('app dark=%s/system=%s uses the resolved app value', async (appDark, system) => {
    mockAppDark = appDark as boolean; mockSystemScheme = system as string; await mount()
    const bar = container.querySelector('[data-testid="actual-root-native-status-bar"]')
    if (platform === 'web') expect(bar).toBeNull()
    else expect(bar?.getAttribute('data-bar-style')).toBe(appDark ? 'light-content' : 'dark-content')
    expect(mockThemeValues.at(-1).dark).toBe(appDark)
    expect(mockThemeValues.at(-1).colors.base).toBe(appDark ? 'dark' : 'light')
  })
  it('changes the actual app theme in place, preserving manual-theme independence from system', async () => {
    await mount(); mockSystemScheme = 'dark'; await mount(); expect(mockThemeValues.at(-1).dark).toBe(false)
    mockAppDark = true; await mount(); expect(mockThemeValues.at(-1).dark).toBe(true)
    if (platform !== 'web') expect(container.querySelector('[data-testid="actual-root-native-status-bar"]')?.getAttribute('data-bar-style')).toBe('light-content')
  })
  if (platform === 'web') {
    it('actual root SSR already contains5 dock links without the deferred chrome/Jest Footer shortcut', () => {
      const html = renderToString(ReactModule.createElement(RootLayout)), doc = new DOMParser().parseFromString(html, 'text/html')
      expect([...doc.querySelectorAll('[data-testid="footer-dock-row"] a')].map(a => a.getAttribute('href'))).toEqual(['/search', '/map', '/quests', '/profile', '/more'])
      expect(doc.querySelectorAll('[data-testid="footer-dock-wrapper"]')).toHaveLength(1)
    })
    it.each(['/login', '/registration', '/register', '/messages', '/travel/new', '/travel/123'])('actual root SSR exclusion %s has no eager row', path => {
      mockPath = path
      const html = renderToString(ReactModule.createElement(RootLayout))
      expect(html).not.toContain('data-testid="footer-dock-wrapper"')
    })
  }
})
