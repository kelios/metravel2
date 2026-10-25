import type { PropsWithChildren, ReactNode } from 'react'
import { act, cleanup, render, screen } from '@testing-library/react'
import { ExpoRoot } from 'expo-router/build/ExpoRoot'
import { getMockContext } from 'expo-router/build/testing-library/mock-config'
import { withLayoutContext } from 'expo-router/build/layouts/withLayoutContext'
// The package `exports` map resolves `build/*` to `build/*.js`, so directories need `/index`.
import { useNavigationBuilder, findFocusedRoute } from 'expo-router/build/react-navigation/core/index'
import type { NavigationState } from 'expo-router/build/react-navigation/routers/index'
import { StackRouter, TabRouter } from 'expo-router/build/react-navigation/routers/index'
import { navigationRef } from 'expo-router/build/global-state/navigationRef'
import { router } from 'expo-router/build/global-state/router'
import { getRouteInfoFromState } from 'expo-router/build/global-state/getRouteInfoFromState'
import { useLocalSearchParams } from 'expo-router/build/hooks/useLocalSearchParams'
import { goBackOrReplace } from '@/utils/backNavigation'

// Jest Expo resolves expo-router's internal `require('./useLinking')` to `.native.js`, while the
// package `exports` map resolves the bare specifier to `.js`: mock the `.native` module ids so
// the container uses the actual web modules of production: the URL seed, the browser history
// reducer and the popstate/pushState adapter.
jest.mock('expo-router/build/fork/useLinking.native', () =>
  jest.requireActual('expo-router/build/fork/useLinking.js'))
jest.mock('expo-router/build/fork/useBackButton.native', () =>
  jest.requireActual('expo-router/build/fork/useBackButton.js'))
jest.mock('expo-router/build/global-state/browserHistory.native', () =>
  jest.requireActual('expo-router/build/global-state/browserHistory.js'))
jest.mock('expo-router/build/global-state/browserHistoryAdapter.native', () =>
  jest.requireActual('expo-router/build/global-state/browserHistoryAdapter.js'))
// The `expo` package entry runs `expo-asset/Asset.fx`, which reads `Image.resolveAssetSource`;
// the RN 0.88 Jest preset's Image mock has no such static, so importing `expo` throws under jsdom.
// expo-router reads only these members: `Platform.OS` in getLinkingConfig, the splash module and
// native views that never render here.
jest.mock('expo', () => ({
  Platform: jest.requireActual('react-native').Platform,
  requireOptionalNativeModule: () => null,
  requireNativeView: () => null,
  registerRootComponent: () => undefined,
}))
// The splash screen plays no role in web history.
jest.mock('expo-router/build/utils/splash', () => ({
  _internal_maybeHideAsync: async () => false,
  _internal_preventAutoHideAsync: async () => false,
  cancelSplashScreenAnimationFrame: () => undefined,
  hide: () => undefined,
  hideAsync: async () => undefined,
  maybeHideSplashScreen: () => undefined,
  preventAutoHideAsync: async () => undefined,
}))
jest.mock('react-native/Libraries/Utilities/Platform', () => ({
  __esModule: true,
  default: {
    OS: 'web', isTesting: true,
    select: (values: Record<string, unknown>) => values.web ?? values.default,
  },
}))
jest.mock('react-native-safe-area-context', () => {
  const React = require('react')
  const children = ({ children }: PropsWithChildren) => React.createElement(React.Fragment, null, children)
  return {
    ...jest.requireActual('react-native-safe-area-context'),
    SafeAreaProvider: children, SafeAreaView: children,
  }
})

type NavigatorProps = { children: ReactNode; id?: string }

// Only navigator presentation is replaced: the production container, builders, reducers,
// browser history projection and Expo global router remain real.
function StackView({ children, id }: NavigatorProps) {
  const { state, descriptors, NavigationContent } = useNavigationBuilder(StackRouter, { children, id })
  return <NavigationContent>{descriptors[state.routes[state.index].key].render()}</NavigationContent>
}
function TabView({ children, id }: NavigatorProps) {
  const { state, descriptors, NavigationContent } = useNavigationBuilder(TabRouter, {
    children, id, backBehavior: 'fullHistory',
  })
  return <NavigationContent>{descriptors[state.routes[state.index].key].render()}</NavigationContent>
}
const Stack = withLayoutContext(StackView)
const Tabs = withLayoutContext(TabView)

function Article() {
  const { param } = useLocalSearchParams<{ param: string }>()
  return <h1>{param}</h1>
}
const context = getMockContext({
  _layout: () => <Stack />,
  '(tabs)/_layout': () => <Tabs />,
  '(tabs)/search': () => <h1>search</h1>,
  '(tabs)/travels/[param]': Article,
})

type Entry = { id: string; path: string }
function entry(): Entry {
  return { id: window.history.state.id, path: window.location.pathname + window.location.search + window.location.hash }
}
async function flush(action: () => void = () => undefined) {
  await act(async () => { action(); await Promise.resolve() })
}
async function visit(saved: Entry) {
  await flush(() => {
    window.history.replaceState({ id: saved.id }, '', saved.path)
    window.dispatchEvent(new PopStateEvent('popstate', { state: { id: saved.id } }))
  })
}
function snapshot() {
  const container = navigationRef.getRootState()
  return {
    url: window.location.pathname,
    heading: screen.getByRole('heading').textContent,
    container,
    routeInfo: getRouteInfoFromState(container),
  }
}
function articleParam(state: NavigationState) {
  return (findFocusedRoute(state)?.params as { param?: string } | undefined)?.param
}
function expectArticle(param: string) {
  const current = snapshot()
  // One assertion reports all boundaries when URL and rendered route split.
  expect({
    url: current.url,
    heading: current.heading,
    containerParam: articleParam(current.container),
    routeInfoParam: current.routeInfo.params.param,
  }).toEqual({
    url: `/travels/${param}`, heading: param,
    containerParam: param, routeInfoParam: param,
  })
}
async function mount() {
  render(<ExpoRoot context={context} location={new URL(window.location.href)} />)
  await flush()
  expect(navigationRef.isReady()).toBe(true)
  expectArticle('article-a')
}

describe('real Expo 58 web container restores retained browser states (#2703 / #2727)', () => {
  let nativeGo: jest.SpyInstance
  beforeEach(() => {
    window.history.replaceState(null, '', '/travels/article-a')
    nativeGo = jest.spyOn(window.history, 'go').mockImplementation(() => undefined)
  })
  afterEach(() => { cleanup(); jest.restoreAllMocks() })

  it('renders B with matching container params after Back A and Forward B', async () => {
    await mount()
    const checkpoints = [{ step: 'initial A', ...snapshot() }]
    const a = entry()
    await flush(() => router.push('/travels/article-b'))
    expectArticle('article-b')
    const b = entry()
    checkpoints.push({ step: 'push B', ...snapshot() })
    expect(b.id).not.toBe(a.id)
    await visit(a)
    checkpoints.push({ step: 'Back A', ...snapshot() })
    expectArticle('article-a')
    await visit(b)
    checkpoints.push({ step: 'Forward B', ...snapshot() })
    try {
      expectArticle('article-b')
    } catch (error) {
      console.error('Expo retained-state checkpoints:', JSON.stringify(checkpoints))
      throw error
    }
    expect(entry()).toEqual(b)
    expect(nativeGo).not.toHaveBeenCalled()
  })

  it('retains full A/B/C browser history and real app Back after browser replay', async () => {
    await mount()
    const a = entry()
    await flush(() => router.push('/travels/article-b'))
    expectArticle('article-b')
    const b = entry()
    await visit(a)
    expectArticle('article-a')
    await visit(b)
    expectArticle('article-b')
    await flush(() => router.push('/travels/article-c'))
    expectArticle('article-c')
    const c = entry()
    expect(new Set([a.id, b.id, c.id]).size).toBe(3)
    for (const [saved, param] of [[b, 'article-b'], [a, 'article-a'], [b, 'article-b'], [c, 'article-c']] as const) {
      await visit(saved)
      expectArticle(param)
    }
    expect(router.canGoBack()).toBe(true)
    const fallback = jest.fn()
    await flush(() => goBackOrReplace({
      canGoBack: router.canGoBack, back: router.back, replace: fallback,
    }))
    expect(fallback).not.toHaveBeenCalled()
    expect(nativeGo).toHaveBeenCalledTimes(1)
    expect(nativeGo).toHaveBeenLastCalledWith(-1)
    // The navigator already shows B; the adapter replaces the URL only after the browser finishes
    // the `go(-1)` traversal (popstate or the 100ms timeout), so the URL still reads C here.
    const afterBack = snapshot()
    expect({ heading: afterBack.heading, containerParam: articleParam(afterBack.container), url: afterBack.url })
      .toEqual({ heading: 'article-b', containerParam: 'article-b', url: '/travels/article-c' })
    await visit(b) // Complete the app-origin pending native traversal.
    expectArticle('article-b')
    expect(entry()).toEqual(b)
  })

  it('renders the retained catalog tab after Back to an article and Forward to search', async () => {
    await mount()
    const a = entry()
    await flush(() => router.push('/search'))
    const search = entry()
    expect(search.id).not.toBe(a.id)
    expect(screen.getByRole('heading').textContent).toBe('search')
    await visit(a)
    expectArticle('article-a')
    await visit(search)
    const container = navigationRef.getRootState()
    expect({
      url: window.location.pathname,
      heading: screen.getByRole('heading').textContent,
      container: findFocusedRoute(container)?.name,
      routeInfo: getRouteInfoFromState(container).pathname,
    }).toEqual({ url: '/search', heading: 'search', container: 'search', routeInfo: '/search' })
    expect(nativeGo).not.toHaveBeenCalled()
  })

  it('uses the fallback for direct entry without inventing app history', async () => {
    await mount()
    expect(router.canGoBack()).toBe(false)
    const fallback = jest.fn()
    await flush(() => goBackOrReplace({
      canGoBack: router.canGoBack, back: router.back, replace: fallback,
    }))
    expect(fallback).toHaveBeenCalledWith('/')
    expect(nativeGo).not.toHaveBeenCalled()
    expectArticle('article-a')
  })
})
