import type { PropsWithChildren } from 'react'
import { act, renderHook } from '@testing-library/react'
// The Jest Expo preset prefers .native.js; explicitly exercise the web fork.
import { useLinking } from 'expo-router/build/fork/useLinking.js'
import { StoreContext } from 'expo-router/build/global-state/storeContext'
import { getStateFromPath, getPathFromState } from 'expo-router/build/react-navigation/native'
import { StackRouter } from 'expo-router/build/react-navigation/routers/StackRouter'
import { TabRouter } from 'expo-router/build/react-navigation/routers/TabRouter'
import { useNavigationHelpers } from 'expo-router/build/react-navigation/core/useNavigationHelpers'
import { useEventEmitter } from 'expo-router/build/react-navigation/core/useEventEmitter'
import type { NavigationAction, NavigationState, NavigatorScreenParams, PartialState } from 'expo-router/build/react-navigation/core'
import type { LinkingOptions } from 'expo-router/build/react-navigation/native'
import { goBackOrReplace } from '@/utils/backNavigation'

const TRAVEL = 'travels/[param]'
type TabsParams = { search: undefined; [TRAVEL]: { param: string } }
type RootParams = { __root: NavigatorScreenParams<{ '(tabs)': NavigatorScreenParams<TabsParams> }> }
const CONFIG = {
  screens: { __root: { screens: { '(tabs)': { screens: {
    search: 'search', [TRAVEL]: 'travels/:param',
  } } } } },
} satisfies NonNullable<LinkingOptions<RootParams>['config']>
const options = (routeNames: string[]) => ({ routeNames, routeParamList: {}, routeGetIdList: {} })
const tabOptions = options(['search', TRAVEL])
const appOptions = options(['(tabs)'])
const rootOptions = options(['__root'])

type State = NavigationState
type Incoming = State | PartialState<State>
type Parsed = NonNullable<ReturnType<typeof getStateFromPath>>

// These are the pinned production algorithms, not a second implementation of
// memory history/linking. The harness supplies the container/store event boundary
// and hydrates each navigator using its real router, as a container would.
function createNavigation() {
  const tab = TabRouter({ backBehavior: 'fullHistory' })
  const app = StackRouter({})
  const root = StackRouter({})
  function hydrate(incoming: Incoming): State {
    // Router partial-state types only permit partial children. During this
    // bottom-up hydration the child is already complete while its parent may
    // still be partial; the real router accepts this intermediate shape.
    return root.getRehydratedState({
      ...incoming,
      routes: incoming.routes.map(route => ({
        ...route,
        state: app.getRehydratedState({
          ...route.state!,
          routes: route.state!.routes.map(child => ({
            ...child, state: tab.getRehydratedState(child.state! as Parameters<typeof tab.getRehydratedState>[0], tabOptions),
          })),
        } as unknown as Parameters<typeof app.getRehydratedState>[0], appOptions),
      })),
    } as unknown as Parameters<typeof root.getRehydratedState>[0], rootOptions)
  }
  let state = hydrate(getStateFromPath<RootParams>('/travels/article-a', CONFIG) as Parsed)
  const listeners = new Set<() => void>()
  const store = { get state() { return state } }
  const tabs = () => state.routes[state.index].state!.routes[0].state! as ReturnType<typeof tab.getInitialState>
  function commit(next: State) {
    state = next
    listeners.forEach(listener => listener())
  }
  const changeTabs = (next: ReturnType<typeof tabs>) => {
    const rootRoute = state.routes[state.index]
    const appState = rootRoute.state! as State
    commit({
      ...state,
      routes: [{
        ...rootRoute,
        state: { ...appState, routes: [{ ...appState.routes[0], state: next }] },
      }],
    })
  }
  const resetRoot = jest.fn((incoming: Incoming) => {
    const hydrated = hydrate(incoming)
    commit(hydrate(root.getStateForAction(state as ReturnType<typeof root.getInitialState>, {
      type: 'RESET', payload: hydrated,
    }, rootOptions)!))
  })
  const onAction = (action: NavigationAction) => {
    const next = tab.getStateForAction(tabs(), action as Parameters<typeof tab.getStateForAction>[1], tabOptions)
    if (!next) return false
    changeTabs(tab.getRehydratedState(next, tabOptions))
    return true
  }
  const navigation = {
    getRootState: () => state,
    resetRoot,
    dispatch: jest.fn(onAction),
    addListener: (_type: string, listener: () => void) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
  const ref = { current: navigation }
  const pathParser = jest.fn(getStateFromPath)
  function wrapper({ children }: PropsWithChildren) {
    return <StoreContext.Provider value={store as React.ContextType<typeof StoreContext>}>{children}</StoreContext.Provider>
  }
  const hooked = renderHook(() => {
    useLinking(ref as unknown as Parameters<typeof useLinking>[0], {
      // useLinking erases the navigator's nested parameter-list type.
      prefixes: [], config: CONFIG as unknown as Parameters<typeof useLinking>[1]['config'],
      getStateFromPath: pathParser, getPathFromState,
    }, () => undefined)
    return useNavigationHelpers({
      id: undefined, router: tab, getState: tabs, onAction,
      onUnhandledAction: () => undefined,
      emitter: useEventEmitter(), stateRef: { current: null },
    })
  }, { wrapper })
  return {
    state: () => state, tabs, resetRoot, pathParser, hooked,
    navigate: (param: string) => onAction({ type: 'NAVIGATE', payload: { name: TRAVEL, params: { param } } }),
  }
}

type Entry = { id: string; path: string }
function entry(): Entry {
  return { id: window.history.state.id, path: window.location.pathname + window.location.search + window.location.hash }
}
async function flush(action: () => void) {
  await act(async () => { action(); await Promise.resolve() })
}
async function external(entry: Entry) {
  await flush(() => {
    window.history.replaceState({ id: entry.id }, '', entry.path)
    window.dispatchEvent(new PopStateEvent('popstate', { state: { id: entry.id } }))
  })
}

describe('pinned Expo useLinking restores complete browser history snapshots (#2703)', () => {
  let nativeGo: jest.SpyInstance
  beforeEach(() => {
    window.history.replaceState(null, '', '/travels/article-a')
    nativeGo = jest.spyOn(window.history, 'go').mockImplementation(() => undefined)
  })
  afterEach(() => { jest.restoreAllMocks() })

  it('restores the saved full B state, rather than a URL-only B, after Back A and Forward B', async () => {
    const nav = createNavigation()
    try {
      const a = entry()
      const stateA = nav.state()
      await flush(() => { nav.navigate('article-b') })
      const b = entry()
      const stateB = nav.state()
      expect(b.id).not.toBe(a.id)
      expect(nav.tabs().history).toHaveLength(2)
      await external(a)
      expect(nav.resetRoot).toHaveBeenLastCalledWith(stateA)
      await external(b)
      expect(nav.resetRoot).toHaveBeenLastCalledWith(stateB)
      expect(nav.tabs().history.map(visit => visit.params)).toEqual([{ param: 'article-a' }, { param: 'article-b' }])
      expect(entry()).toEqual(b)
      expect(nativeGo).not.toHaveBeenCalled()
    } finally { nav.hooked.unmount() }
  })

  it('keeps real canGoBack and app Back to B after the complete A/B/C browser replay', async () => {
    const nav = createNavigation()
    try {
      const a = entry()
      await flush(() => { nav.navigate('article-b') })
      const b = entry()
      await external(a)
      await external(b)
      await flush(() => { nav.navigate('article-c') })
      const c = entry()
      for (const visit of [b, a, b, c]) await external(visit)
      expect(entry()).toEqual(c)
      // Actual pinned useNavigationHelpers asks the actual TabRouter GO_BACK.
      expect(nav.hooked.result.current.canGoBack()).toBe(true)
      const fallback = jest.fn()
      await flush(() => goBackOrReplace({
        canGoBack: nav.hooked.result.current.canGoBack,
        back: nav.hooked.result.current.goBack,
        replace: fallback,
      }))
      expect(fallback).not.toHaveBeenCalled()
      expect(nav.tabs().routes[nav.tabs().index].params).toEqual({ param: 'article-b' })
      expect(nativeGo).toHaveBeenCalledTimes(1)
      expect(nativeGo).toHaveBeenLastCalledWith(-1)
      await external(b) // Complete the app-origin pending native traversal.
      expect(entry()).toEqual(b)
      expect(nav.tabs().history.map(visit => visit.params)).toEqual([{ param: 'article-a' }, { param: 'article-b' }])
    } finally { nav.hooked.unmount() }
  })

  it('uses the configured fallback for a real direct entry without fabricating browser history', async () => {
    const nav = createNavigation()
    try {
      expect(nav.hooked.result.current.canGoBack()).toBe(false)
      const fallback = jest.fn()
      const back = jest.fn(nav.hooked.result.current.goBack)
      await flush(() => goBackOrReplace({
        canGoBack: nav.hooked.result.current.canGoBack, back, replace: fallback,
      }))
      expect(fallback).toHaveBeenCalledWith('/')
      expect(back).not.toHaveBeenCalled()
      expect(nativeGo).not.toHaveBeenCalled()
      expect(nav.tabs().history).toHaveLength(1)
    } finally { nav.hooked.unmount() }
  })
})
