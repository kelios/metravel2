import { renderToString } from 'react-dom/server.node'
import { Platform } from 'react-native'
import TabLayout from '@/app/(tabs)/_layout'
import { TabRouter } from 'expo-router/build/react-navigation/routers/TabRouter'

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
const routeOptions = {
  routeNames,
  routeParamList: { search: undefined, [TRAVEL]: undefined },
  routeGetIdList: {},
}

function createRouter(platform: typeof Platform.OS = 'web', initialTravel?: string) {
  Platform.OS = platform
  renderToString(<TabLayout />)
  const router = TabRouter({
    backBehavior: mockBackBehavior,
    initialRouteName: initialTravel ? TRAVEL : 'search',
  })
  const state = router.getInitialState({
    ...routeOptions,
    routeParamList: {
      search: undefined,
      [TRAVEL]: initialTravel ? { param: initialTravel } : undefined,
    },
  })
  return { router, state }
}

type Router = ReturnType<typeof createRouter>['router']
type State = ReturnType<typeof createRouter>['state']

function navigate(router: Router, state: State, param: string) {
  const next = router.getStateForAction(state, {
    type: 'NAVIGATE', // Expo converts a tab's router.push to NAVIGATE.
    payload: { name: TRAVEL, params: { param } },
  }, routeOptions)
  expect(next).not.toBeNull()
  return next!
}

function back(router: Router, state: State) {
  const next = router.getStateForAction(state, { type: 'GO_BACK' }, routeOptions)
  expect(next).not.toBeNull()
  return next!
}

describe('public travel history on the pinned Expo tab router (#2703)', () => {
  const originalPlatform = Platform.OS
  afterEach(() => { Platform.OS = originalPlatform })

  it('preserves A/B/C params and stable route keys for both browser snapshots and app Back', () => {
    const { router, state: search } = createRouter()
    expect(mockBackBehavior).toBe('fullHistory')
    const a = navigate(router, search, 'article-a')
    const b = navigate(router, a, 'article-b')
    const c = navigate(router, b, 'article-c')
    expect([search, a, b, c].map(s => s.history.length)).toEqual([1, 2, 3, 4])
    const key = a.routes[a.index].key
    expect([b, c].map(s => s.routes[s.index].key)).toEqual([key, key])
    expect(c.history.slice(1).map(entry => entry.params)).toEqual([
      { param: 'article-a' }, { param: 'article-b' }, { param: 'article-c' },
    ])
    const backB = back(router, c)
    const backA = back(router, backB)
    expect(backB.routes[backB.index].params).toEqual({ param: 'article-b' })
    expect(backA.routes[backA.index].params).toEqual({ param: 'article-a' })
    const backSearch = back(router, backA)
    expect(backSearch.routes[backSearch.index].name).toBe('search')
    // Earlier browser snapshots must not be mutated by later navigation.
    expect(a.routes[a.index].params).toEqual({ param: 'article-a' })
    expect(b.routes[b.index].params).toEqual({ param: 'article-b' })
  })

  it('does not append the current article, including on an initial direct entry', () => {
    const { router, state } = createRouter('web', 'article-a')
    expect(state.history).toHaveLength(1)
    const same = navigate(router, state, 'article-a')
    expect(same.history).toHaveLength(1)
    expect(router.getStateForAction(same, { type: 'GO_BACK' }, routeOptions)).toBeNull()
    const b = navigate(router, same, 'article-b')
    expect(navigate(router, b, 'article-b').history).toHaveLength(2)
  })

  it('does not treat empty and absent params as distinct visits to the same tab', () => {
    const { router, state } = createRouter()
    const same = router.getStateForAction(state, {
      type: 'NAVIGATE', payload: { name: 'search', params: {} },
    }, routeOptions)
    expect(same?.history).toHaveLength(1)
  })

  it('rehydrates a direct URL with its params and no fabricated predecessor', () => {
    const { router } = createRouter()
    const direct = router.getRehydratedState({
      routes: [{ name: TRAVEL, params: { param: 'article-a' } }],
    }, routeOptions)
    expect(direct.routes[direct.index].params).toEqual({ param: 'article-a' })
    expect(direct.history).toHaveLength(1)
    expect(direct.history[0].params).toEqual({ param: 'article-a' })
    expect(router.getStateForAction(direct, { type: 'GO_BACK' }, routeOptions)).toBeNull()
    expect(navigate(router, direct, 'article-a').history).toHaveLength(1)
  })

  it('rehydrates existing A/B/C visits without appending another C or losing app Back params', () => {
    const { router, state } = createRouter()
    const a = navigate(router, state, 'article-a')
    const b = navigate(router, a, 'article-b')
    const c = navigate(router, b, 'article-c')
    const hydrated = router.getRehydratedState({ ...c, stale: true }, routeOptions)
    expect(hydrated.history).toEqual(c.history)
    const backB = back(router, hydrated)
    expect(backB.routes[backB.index].params).toEqual({ param: 'article-b' })
    const backA = back(router, backB)
    expect(backA.routes[backA.index].params).toEqual({ param: 'article-a' })
  })

  it('retains repeated cross-tab visits and updates only the current history params', () => {
    const { router, state } = createRouter()
    const a = navigate(router, state, 'article-a')
    const search = router.getStateForAction(a, {
      type: 'NAVIGATE', payload: { name: 'search' },
    }, routeOptions)!
    const b = navigate(router, search, 'article-b')
    expect(b.history).toHaveLength(4)
    expect(back(router, b).index).toBe(0)
    expect(back(router, back(router, b)).routes[1].params).toEqual({ param: 'article-a' })
    const updated = router.getStateForAction(b, {
      type: 'SET_PARAMS', payload: { params: { anchor: 'photos' } },
    }, routeOptions)!
    expect(updated.history).toHaveLength(4)
    expect(updated.history.at(-1)?.params).toEqual({ param: 'article-b', anchor: 'photos' })
    expect(updated.history[1].params).toEqual({ param: 'article-a' })
  })

  it('replaces the current params without appending a visit or changing previous article params', () => {
    const { router, state } = createRouter()
    const a = navigate(router, state, 'article-a')
    const b = navigate(router, a, 'article-b')
    const updated = router.getStateForAction(b, {
      type: 'REPLACE_PARAMS', payload: { params: { param: 'article-b', anchor: 'photos' } },
    }, routeOptions)!
    expect(updated.history).toHaveLength(b.history.length)
    expect(updated.history.at(-1)?.params).toEqual({ param: 'article-b', anchor: 'photos' })
    expect(updated.history.slice(0, -1)).toEqual(b.history.slice(0, -1))
    const backA = back(router, updated)
    expect(backA.routes[backA.index].params).toEqual({ param: 'article-a' })
    expect(b.routes[b.index].params).toEqual({ param: 'article-b' })
  })

  it.each([TRAVEL, 'search'])('replaces only the current visit when the target is %s', name => {
    const { router, state } = createRouter()
    const a = navigate(router, state, 'article-a')
    const b = navigate(router, a, 'article-b')
    const c = navigate(router, b, 'article-c')
    const replaced = router.getStateForAction(c, {
      type: 'REPLACE', payload: { name, params: name === TRAVEL ? { param: 'article-d' } : undefined },
    }, routeOptions)!
    expect(replaced.history).toHaveLength(c.history.length)
    expect(replaced.key).not.toBe(c.key) // Linking must replace, not push/traverse.
    expect(replaced.history.slice(0, -1)).toEqual(c.history.slice(0, -1))
    const backB = back(router, replaced)
    expect(backB.routes[backB.index].params).toEqual({ param: 'article-b' })
    expect(c.routes[c.index].params).toEqual({ param: 'article-c' })
    expect(c.history).toHaveLength(4)
  })

  it('preserves a single direct entry when replacing the current article', () => {
    const { router, state } = createRouter('web', 'article-a')
    for (const param of ['article-a', 'article-b']) {
      const replaced = router.getStateForAction(state, {
        type: 'REPLACE', payload: { name: TRAVEL, params: { param } },
      }, routeOptions)!
      expect(replaced.history).toHaveLength(1)
      expect(replaced.routes[replaced.index].params).toEqual({ param })
      expect(router.getStateForAction(replaced, { type: 'GO_BACK' }, routeOptions)).toBeNull()
    }
  })

  it.each(['android', 'ios'] as const)('keeps the existing native tab history on %s', platform => {
    const { router, state } = createRouter(platform)
    expect(mockBackBehavior).toBe('history')
    const a = navigate(router, state, 'article-a')
    const b = navigate(router, a, 'article-b')
    expect(b.history).toHaveLength(2)
    expect(back(router, b).index).toBe(0)
  })
})
