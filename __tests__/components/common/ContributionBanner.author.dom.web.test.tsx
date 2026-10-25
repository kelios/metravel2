import type React from 'react'
import type { Root } from 'react-dom/client'
import type { NavigationState } from 'expo-router/build/react-navigation/routers/index'

type Variant = 'author-home' | 'author-catalog'

let act: typeof import('react').act
let createElement: typeof import('react').createElement
let createRoot: typeof import('react-dom/client').createRoot
let ExpoRoot: typeof import('expo-router/build/ExpoRoot').ExpoRoot
let getMockContext: typeof import('expo-router/build/testing-library/mock-config').getMockContext
let navigationRef: typeof import('expo-router/build/global-state/navigationRef').navigationRef
let getRouteInfoFromState: typeof import('expo-router/build/global-state/getRouteInfoFromState').getRouteInfoFromState
let findFocusedRoute: typeof import('expo-router/build/react-navigation/core/index').findFocusedRoute
let useNavigationBuilder: typeof import('expo-router/build/react-navigation/core/index').useNavigationBuilder
let StackRouter: typeof import('expo-router/build/react-navigation/routers/index').StackRouter
let withLayoutContext: typeof import('expo-router/build/layouts/withLayoutContext').withLayoutContext
let ContributionBanner: React.ComponentType<{ variant: Variant }>
const mockTrack = jest.fn()

beforeAll(() => {
  jest.resetModules()
  jest.doMock('react-native', () => jest.requireActual('react-native-web'))
  // Expo Router 58 has no module-level navigation: `Link` enqueues its intent into the routing
  // queue context of `ExpoRoot`, so the banner is mounted as a real route and the click is
  // observed on the container state and the browser URL. Jest Expo resolves the container's
  // `./useLinking` etc. to `.native.js`; alias those ids to the web modules of production.
  jest.doMock('expo-router/build/fork/useLinking.native', () =>
    jest.requireActual('expo-router/build/fork/useLinking.js'))
  jest.doMock('expo-router/build/fork/useBackButton.native', () =>
    jest.requireActual('expo-router/build/fork/useBackButton.js'))
  jest.doMock('expo-router/build/global-state/browserHistory.native', () =>
    jest.requireActual('expo-router/build/global-state/browserHistory.js'))
  jest.doMock('expo-router/build/global-state/browserHistoryAdapter.native', () =>
    jest.requireActual('expo-router/build/global-state/browserHistoryAdapter.js'))
  // Metro picks `.web.js` for the browser bundle; Jest Expo picks the `.ios`/default modules,
  // which read `NativeComponentRegistry` and `UIManager.getViewManagerConfig` that React
  // Native Web lacks. Alias them to the web modules of production.
  jest.doMock('expo-router/build/views/ActivityContents', () =>
    jest.requireActual('expo-router/build/views/ActivityContents.web.js'))
  jest.doMock('expo-router/build/react-navigation/core/usePreventBeforeUnload', () =>
    jest.requireActual('expo-router/build/react-navigation/core/usePreventBeforeUnload.web.js'))
  jest.doMock('expo-router/build/react-navigation/elements/MaskedView.ios', () =>
    jest.requireActual('expo-router/build/react-navigation/elements/MaskedView.js'))
  // `react-native-screens` loads its TurboModule on import; the test navigator below renders
  // plain React Native Web views, so only the flag objects expo-router mutates on import matter.
  jest.doMock('react-native-screens', () => {
    const { View } = jest.requireActual('react-native-web') as typeof import('react-native-web')
    return new Proxy({
      featureFlags: { experiment: {} }, compatibilityFlags: {},
      enableScreens: () => undefined, enableFreeze: () => undefined,
      screensEnabled: () => false, freezeEnabled: () => false,
      isSearchBarAvailableForCurrentPlatform: false,
    } as Record<string, unknown>, {
      get: (target, key: string) => (key in target ? target[key] : View),
    })
  })
  // The `expo` entry runs `expo-asset/Asset.fx`, which needs `Image.resolveAssetSource`.
  jest.doMock('expo', () => ({
    Platform: jest.requireActual('react-native-web').Platform,
    requireOptionalNativeModule: () => null,
    requireNativeView: () => null,
    registerRootComponent: () => undefined,
  }))
  jest.doMock('expo-router/build/utils/splash', () => ({
    _internal_maybeHideAsync: async () => false,
    _internal_preventAutoHideAsync: async () => false,
    cancelSplashScreenAnimationFrame: () => undefined,
    hide: () => undefined,
    hideAsync: async () => undefined,
    maybeHideSplashScreen: () => undefined,
    preventAutoHideAsync: async () => undefined,
  }))
  // `__tests__/setup.ts` replaces `expo-router` with a TouchableOpacity stub; this test is about
  // the production `Link` and router. The package index also loads the native stack (glass
  // effect, screens), so only the two members the banner imports come from the real modules.
  jest.doMock('expo-router', () => ({
    Link: jest.requireActual('expo-router/build/link/Link').Link,
    useRouter: jest.requireActual('expo-router/build/hooks/index').useRouter,
  }))
  jest.doMock('@/stores/authStore', () => ({
    useAuthStore: (select: (state: { isAuthenticated: boolean }) => unknown) => select({ isAuthenticated: false }),
  }))
  jest.doMock('@/utils/growthFunnelAnalytics', () => ({
    trackContentCreateCtaClicked: mockTrack,
    trackRegisterCtaClicked: jest.fn(),
  }))
  jest.doMock('@/hooks/useResponsive', () => ({ useResponsive: () => ({ isMobile: true }) }))
  jest.doMock('@/hooks/useTheme', () => ({ useThemedColors: () => ({}) }))
  jest.doMock('@/components/layout', () => ({
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => children,
  }))
  jest.doMock('@/i18n', () => ({ translate: (key: string) => key }))
  jest.doMock('@/i18n/LocaleProvider', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
  jest.doMock('@expo/vector-icons/Feather', () => () => null)
  ;({ act, createElement } = require('react'))
  ;({ createRoot } = require('react-dom/client'))
  ;({ ExpoRoot } = require('expo-router/build/ExpoRoot'))
  ;({ getMockContext } = require('expo-router/build/testing-library/mock-config'))
  ;({ navigationRef } = require('expo-router/build/global-state/navigationRef'))
  ;({ getRouteInfoFromState } = require('expo-router/build/global-state/getRouteInfoFromState'))
  ;({ findFocusedRoute, useNavigationBuilder } = require('expo-router/build/react-navigation/core/index'))
  ;({ StackRouter } = require('expo-router/build/react-navigation/routers/index'))
  ;({ withLayoutContext } = require('expo-router/build/layouts/withLayoutContext'))
  ContributionBanner = require('@/components/common/ContributionBanner').default
})

// Only navigator presentation is replaced (the native stack needs `react-native-screens`): the
// production container, routing queue, reducers, browser history projection and Link stay real.
function StackView({ children }: { children: React.ReactNode }) {
  const { state, descriptors, NavigationContent } = useNavigationBuilder(StackRouter, { children })
  return createElement(NavigationContent, null, descriptors[state.routes[state.index].key].render())
}

function focusedRoute() {
  const state = navigationRef.getRootState() as NavigationState
  return { name: findFocusedRoute(state)?.name, pathname: getRouteInfoFromState(state).pathname }
}
// The container wraps the app in a `__root` route; the stack of `_layout` is its nested state.
function stackRouteNames() {
  const root = navigationRef.getRootState() as NavigationState
  const stack = root.routes[root.index].state as NavigationState | undefined
  return stack?.routes.map((route) => route.name)
}

describe('author promotion with the real Expo Link and React Native Web', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    mockTrack.mockClear()
    window.history.replaceState(null, '', '/')
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    container.remove()
  })

  it.each([
    ['author-home', 'home', 1],
    ['author-catalog', 'travelsby', 0],
  ] as const)('navigates %s in the app and records one activation', async (variant, source, detail) => {
    const Stack = withLayoutContext(StackView)
    const context = getMockContext({
      _layout: () => createElement(Stack),
      index: () => createElement(ContributionBanner, { variant }),
      'become-author': () => createElement('h1', null, 'become-author'),
    })
    await act(async () => {
      root.render(createElement(ExpoRoot, { context, location: new URL(window.location.href) }))
    })
    expect(navigationRef.isReady()).toBe(true)
    expect(focusedRoute()).toEqual({ name: 'index', pathname: '/' })

    const link = container.querySelector<HTMLAnchorElement>('a[href="/become-author"]')
    expect(link).not.toBeNull()
    expect(link?.getAttribute('role')).toBe('link')
    expect(link?.getAttribute('tabindex')).toBe('0')
    expect(container.querySelector('[role="button"]')).toBeNull()

    // Browsers dispatch detail=0 clicks when an anchor is activated by keyboard.
    const click = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, detail })
    await act(async () => { link!.dispatchEvent(click) })
    // The intent is drained by `RoutingQueueDrainer` in an effect; the reducer runs on the next render.
    await act(async () => { await Promise.resolve() })
    expect(click.defaultPrevented).toBe(true)
    expect(focusedRoute()).toEqual({ name: 'become-author', pathname: '/become-author' })
    expect(window.location.pathname).toBe('/become-author')
    // One click = one pushed route: the stack holds the banner screen and the destination only.
    expect(stackRouteNames()).toEqual(['index', 'become-author'])
    expect(container.querySelector('h1')?.textContent).toBe('become-author')
    expect(mockTrack).toHaveBeenCalledTimes(1)
    expect(mockTrack).toHaveBeenCalledWith({
      contentType: 'route', source, authState: 'guest', intent: 'create-travel', action: 'learn_more', variant,
    })
  })
})
