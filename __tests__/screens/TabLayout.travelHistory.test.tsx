import { renderToString } from 'react-dom/server.node'
import { Platform } from 'react-native'
import TabLayout from '@/app/(tabs)/_layout'
import { TabRouter, ensureStateHistory } from 'expo-router/build/react-navigation/routers/TabRouter'
import { isActionHandled } from 'expo-router/build/react-navigation/routers/utils'
import type { RouterActionResult } from 'expo-router/build/react-navigation/routers/types'

let mockBackBehavior: 'history' | 'fullHistory'
jest.mock('expo-router', () => {
  const Tabs = (props: { backBehavior: typeof mockBackBehavior }) => {
    mockBackBehavior = props.backBehavior
    return null
  }
  Tabs.Screen = () => null
  return { Tabs, usePathname: () => '/travels/article-a' }
})
jest.mock('@/components/layout/CustomHeader', () => () => null)
jest.mock('@/components/layout/useListFilterQuery', () => ({ useHasListFilterQuery: () => false }))

const TRAVEL = 'travels/[param]'
const routeNames = ['search', TRAVEL]
const routeOptions = { routeNames, routeParamList: {}, routeGetIdList: {} }
const KEY = { search: 'search:root-0-0', [TRAVEL]: `${TRAVEL}:root-0-1` }

type Router = ReturnType<typeof TabRouter>
type State = ReturnType<Router['getStateForRouteFocus']>
type Route = State['routes'][number]

// Expo Router 58 seeds the navigator state itself (`createSeededNavigationState`) and the
// URL-derived state reaches the reducer without `history`: `ensureStateHistory` fills it in the
// same way `getStateForAction` does on the first action.
function seed(routes: Route[], index: number, withHistory = true): State {
  const state = {
    stale: false as const, type: 'tab' as const, key: 'navigator:root-0', routeKeySeq: 2,
    routeNames, index, routes,
  }
  return withHistory ? ensureStateHistory(state, mockBackBehavior, 'search') : state
}

function createRouter(platform: typeof Platform.OS = 'web', initialTravel?: string) {
  Platform.OS = platform
  renderToString(<TabLayout />)
  const router = TabRouter({ backBehavior: mockBackBehavior, initialRouteName: 'search' })
  const state = initialTravel
    ? seed([{ key: KEY[TRAVEL], name: TRAVEL, params: { param: initialTravel } }], 0)
    : seed([{ key: KEY.search, name: 'search' }], 0)
  return { router, state }
}

type Action = Parameters<Router['getStateForAction']>[1]
function dispatch(router: Router, state: State, action: Action): RouterActionResult<State> | null {
  const result = router.getStateForAction(state, action, routeOptions)
  return isActionHandled(result) ? result : null
}
function handled(router: Router, state: State, action: Action) {
  const result = dispatch(router, state, action)
  expect(result).not.toBeNull()
  return result!
}
function navigate(router: Router, state: State, param: string) {
  // Expo converts a tab's router.push to NAVIGATE.
  return handled(router, state, { type: 'NAVIGATE', payload: { name: TRAVEL, params: { param } } })
}
function back(router: Router, state: State) {
  return handled(router, state, { type: 'GO_BACK' })
}
const focused = (state: State) => state.routes[state.index]

describe('public travel history on the Expo 58 tab router (#2703 / #2727)', () => {
  const originalPlatform = Platform.OS
  afterEach(() => { Platform.OS = originalPlatform })

  it('preserves A/B/C params, stable route keys and a browser push per visit', () => {
    const { router, state: search } = createRouter()
    expect(mockBackBehavior).toBe('fullHistory')
    const a = navigate(router, search, 'article-a')
    const b = navigate(router, a.state, 'article-b')
    const c = navigate(router, b.state, 'article-c')
    expect([search, a.state, b.state, c.state].map(s => s.history!.length)).toEqual([1, 2, 3, 4])
    // Same tab key, different params: the router still asks the browser for a new entry.
    expect([a, b, c].map(result => result.browserHistory)).toEqual([
      { type: 'push' }, { type: 'push' }, { type: 'push' },
    ])
    const key = focused(a.state).key
    expect([b, c].map(result => focused(result.state).key)).toEqual([key, key])
    expect(c.state.history!.slice(1).map(entry => entry.params)).toEqual([
      { param: 'article-a' }, { param: 'article-b' }, { param: 'article-c' },
    ])
    const backB = back(router, c.state)
    expect(backB.browserHistory).toEqual({ type: 'pop', count: 1, target: { navigatorKey: 'navigator:root-0', routeKey: key } })
    const backA = back(router, backB.state)
    expect(focused(backB.state).params).toEqual({ param: 'article-b' })
    expect(focused(backA.state).params).toEqual({ param: 'article-a' })
    const backSearch = back(router, backA.state)
    expect(focused(backSearch.state).name).toBe('search')
    // Earlier browser snapshots must not be mutated by later navigation.
    expect(focused(a.state).params).toEqual({ param: 'article-a' })
    expect(focused(b.state).params).toEqual({ param: 'article-b' })
  })

  it('does not append the current article, including on an initial direct entry', () => {
    const { router, state } = createRouter('web', 'article-a')
    expect(state.history).toHaveLength(1)
    const same = navigate(router, state, 'article-a')
    expect(same.state.history).toHaveLength(1)
    expect(same.browserHistory).toBeUndefined()
    expect(dispatch(router, same.state, { type: 'GO_BACK' })).toBeNull()
    const b = navigate(router, same.state, 'article-b')
    expect(navigate(router, b.state, 'article-b').state.history).toHaveLength(2)
  })

  it('does not treat empty and absent params as distinct visits to the same tab', () => {
    const { router, state } = createRouter()
    const same = handled(router, state, { type: 'NAVIGATE', payload: { name: 'search', params: {} } })
    expect(same.state.history).toHaveLength(1)
    expect(same.browserHistory).toBeUndefined()
  })

  it('seeds a direct URL with its params and no fabricated predecessor', () => {
    const { router } = createRouter()
    const direct = seed([{ key: KEY[TRAVEL], name: TRAVEL, params: { param: 'article-a' } }], 0, false)
    expect(direct.history).toBeUndefined()
    const navigated = navigate(router, direct, 'article-a')
    expect(focused(navigated.state).params).toEqual({ param: 'article-a' })
    expect(navigated.state.history).toEqual([{ type: 'route', key: KEY[TRAVEL], params: { param: 'article-a' } }])
    expect(navigated.browserHistory).toBeUndefined()
    expect(dispatch(router, direct, { type: 'GO_BACK' })).toBeNull()
  })

  it('restores an A/B/C browser snapshot via RESET without appending another C or losing app Back params', () => {
    const { router, state } = createRouter()
    const a = navigate(router, state, 'article-a')
    const b = navigate(router, a.state, 'article-b')
    const c = navigate(router, b.state, 'article-c')
    // Browser Back/Forward in Expo 58 replays the retained snapshot through RESET.
    const restored = handled(router, a.state, { type: 'RESET', payload: c.state })
    expect(restored.state.history).toEqual(c.state.history)
    expect(restored.browserHistory).toBeUndefined()
    const backB = back(router, restored.state)
    expect(focused(backB.state).params).toEqual({ param: 'article-b' })
    const backA = back(router, backB.state)
    expect(focused(backA.state).params).toEqual({ param: 'article-a' })
  })

  it('retains repeated cross-tab visits and updates only the current history params', () => {
    const { router, state } = createRouter()
    const a = navigate(router, state, 'article-a')
    const search = handled(router, a.state, { type: 'NAVIGATE', payload: { name: 'search' } })
    expect(search.browserHistory).toEqual({ type: 'push' })
    const b = navigate(router, search.state, 'article-b')
    expect(b.state.history).toHaveLength(4)
    expect(back(router, b.state).state.index).toBe(0)
    expect(back(router, back(router, b.state).state).state.routes[1].params).toEqual({ param: 'article-a' })
    const updated = handled(router, b.state, { type: 'SET_PARAMS', payload: { params: { anchor: 'photos' } } })
    expect(updated.state.history).toHaveLength(4)
    expect(updated.browserHistory).toBeUndefined()
    expect(updated.state.history!.at(-1)?.params).toEqual({ param: 'article-b', anchor: 'photos' })
    expect(updated.state.history![1].params).toEqual({ param: 'article-a' })
  })

  it('replaces the current params without appending a visit or changing previous article params', () => {
    const { router, state } = createRouter()
    const a = navigate(router, state, 'article-a')
    const b = navigate(router, a.state, 'article-b')
    const updated = handled(router, b.state, {
      type: 'REPLACE_PARAMS', payload: { params: { param: 'article-b', anchor: 'photos' } },
    })
    expect(updated.state.history).toHaveLength(b.state.history!.length)
    expect(updated.state.history!.at(-1)?.params).toEqual({ param: 'article-b', anchor: 'photos' })
    expect(updated.state.history!.slice(0, -1)).toEqual(b.state.history!.slice(0, -1))
    const backA = back(router, updated.state)
    expect(focused(backA.state).params).toEqual({ param: 'article-a' })
    expect(focused(b.state).params).toEqual({ param: 'article-b' })
  })

  it.each([TRAVEL, 'search'])('replaces only the current visit when the target is %s', name => {
    const { router, state } = createRouter()
    const a = navigate(router, state, 'article-a')
    const b = navigate(router, a.state, 'article-b')
    const c = navigate(router, b.state, 'article-c')
    const replaced = handled(router, c.state, {
      type: 'REPLACE', payload: { name, params: name === TRAVEL ? { param: 'article-d' } : undefined },
    })
    expect(replaced.state.history).toHaveLength(c.state.history!.length)
    // No browser instruction = the container replaces the current browser entry, not push/go.
    expect(replaced.browserHistory).toBeUndefined()
    expect(replaced.state.history!.slice(0, -1)).toEqual(c.state.history!.slice(0, -1))
    expect(focused(replaced.state).name).toBe(name)
    const backB = back(router, replaced.state)
    expect(focused(backB.state).params).toEqual({ param: 'article-b' })
    expect(focused(c.state).params).toEqual({ param: 'article-c' })
    expect(c.state.history).toHaveLength(4)
  })

  it('preserves a single direct entry when replacing the current article', () => {
    const { router, state } = createRouter('web', 'article-a')
    for (const param of ['article-a', 'article-b']) {
      const replaced = handled(router, state, { type: 'REPLACE', payload: { name: TRAVEL, params: { param } } })
      expect(replaced.state.history).toHaveLength(1)
      expect(replaced.browserHistory).toBeUndefined()
      expect(focused(replaced.state).params).toEqual({ param })
      expect(dispatch(router, replaced.state, { type: 'GO_BACK' })).toBeNull()
    }
  })

  it.each(['android', 'ios'] as const)('keeps the existing native tab history on %s', platform => {
    const { router, state } = createRouter(platform)
    expect(mockBackBehavior).toBe('history')
    const a = navigate(router, state, 'article-a')
    const b = navigate(router, a.state, 'article-b')
    expect(b.state.history).toHaveLength(2)
    // `history` keeps one entry per tab and no params; only `fullHistory` records visits.
    expect(b.state.history!.at(-1)).toEqual({ type: 'route', key: focused(b.state).key, params: undefined })
    expect(back(router, b.state).state.index).toBe(0)
  })
})
