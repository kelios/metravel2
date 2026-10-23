import type { PropsWithChildren, ReactNode } from 'react'
import { act, cleanup, render, screen } from '@testing-library/react'
import { ExpoRoot } from 'expo-router/build/ExpoRoot'
import { getMockContext } from 'expo-router/build/testing-library/mock-config'
import { withLayoutContext } from 'expo-router/build/layouts/withLayoutContext'
import { useNavigationBuilder, findFocusedRoute } from 'expo-router/build/react-navigation/core'
import type { InitialState } from 'expo-router/build/react-navigation/routers'
import { StackRouter, TabRouter } from 'expo-router/build/react-navigation/routers'
import { store } from 'expo-router/build/global-state/store'
import { router } from 'expo-router/build/global-state/router'
import { useLocalSearchParams } from 'expo-router/build/hooks/useLocalSearchParams'
import { goBackOrReplace } from '@/utils/backNavigation'

// Jest Expo prefers .native.js. Keep the actual web algorithm used in production.
jest.mock('expo-router/build/fork/useLinking', () =>
  jest.requireActual('expo-router/build/fork/useLinking.js'))
jest.mock('expo-router/build/fork/useDocumentTitle', () =>
  jest.requireActual('expo-router/build/fork/useDocumentTitle.js'))
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

// Only navigator presentation is replaced: the production container, builders,
// reducers, SceneView, qualified routes and Expo store callbacks remain real.
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
  return {
    url: window.location.pathname,
    heading: screen.getByRole('heading').textContent,
    container: store.navigationRef.getRootState(),
    store: store.state,
    routeInfo: store.getRouteInfo(),
  }
}
function articleParam(state: InitialState) {
  return (findFocusedRoute(state)?.params as { param?: string } | undefined)?.param
}
function expectArticle(param: string) {
  const current = snapshot()
  // One assertion reports all three boundaries when URL and rendered route split.
  expect({
    url: current.url,
    heading: current.heading,
    containerParam: articleParam(current.container),
    storeParam: current.store && articleParam(current.store),
    routeInfoParam: current.routeInfo.params.param,
  }).toEqual({
    url: `/travels/${param}`, heading: param,
    containerParam: param, storeParam: param, routeInfoParam: param,
  })
}
async function mount() {
  render(<ExpoRoot context={context} location={new URL(window.location.href)} />)
  await flush()
  expect(store.navigationRef.isReady()).toBe(true)
  expectArticle('article-a')
}

describe('real Expo web container restores retained browser states (#2703)', () => {
  let nativeGo: jest.SpyInstance
  beforeEach(() => {
    window.history.replaceState(null, '', '/travels/article-a')
    nativeGo = jest.spyOn(window.history, 'go').mockImplementation(() => undefined)
  })
  afterEach(() => { cleanup(); jest.restoreAllMocks() })

  it('renders B with matching container/store params after Back A and Forward B', async () => {
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
    expect(nativeGo).toHaveBeenLastCalledWith(-1)
    await visit(b)
    expectArticle('article-b')
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
    expect({
      url: window.location.pathname,
      heading: screen.getByRole('heading').textContent,
      container: findFocusedRoute(store.navigationRef.getRootState())?.name,
      store: store.state && findFocusedRoute(store.state)?.name,
      routeInfo: store.getRouteInfo().pathname,
    }).toEqual({ url: '/search', heading: 'search', container: 'search', store: 'search', routeInfo: '/search' })
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
