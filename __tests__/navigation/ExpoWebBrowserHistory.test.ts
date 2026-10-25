// Jest Expo prefers .native.js; explicitly exercise the web implementation used in production.
import {
  applyRouterHistoryAction, createBrowserHistory, restoreNavigationFromBrowser,
} from 'expo-router/build/global-state/browserHistory.js'
import { createBrowserHistoryAdapter } from 'expo-router/build/global-state/browserHistoryAdapter.js'
import type { BrowserHistory, BrowserHistoryConfig } from 'expo-router/build/global-state/browserHistory.types'
import type { NavigationState } from 'expo-router/build/react-navigation/routers/index'

const ROOT = '__root'
function snapshot(name: string): NavigationState {
  return {
    stale: false, type: 'stack', key: 'navigator:root', routeKeySeq: 1, index: 0,
    routeNames: [ROOT], routes: [{ key: `${ROOT}:0`, name: ROOT, params: { name } }],
  }
}
const nameOf = (state: NavigationState) => (state.routes[state.index].params as { name: string }).name
// The path codec is the only linking boundary: the retained snapshots are never re-parsed.
const config: BrowserHistoryConfig = {
  browserHistoryIdPrefix: 'session',
  linking: {
    getPathFromState: state => `/${nameOf(state as NavigationState)}`,
    getStateFromPath: path => ({ routes: [{ name: ROOT, params: { name: path.slice(1) } }] }),
  },
}
type Result = { state: NavigationState }
type Reduce = Parameters<typeof restoreNavigationFromBrowser<Result>>[4]

function seed(names = ['a', 'b', 'c', 'd']) {
  let { history } = createBrowserHistory(snapshot(names[0]), config)
  for (const name of names.slice(1)) {
    history = applyRouterHistoryAction(history, snapshot(name), config, { type: 'push' }).history!
  }
  return { history, entries: [...history.entries] }
}
// The reducer boundary: a restore applies the retained snapshot through RESET.
const applyReset = jest.fn<Result, Parameters<Reduce>>((result, intent) =>
  intent.type === 'ACTION' && intent.payload.action.type === 'RESET'
    ? { state: intent.payload.action.payload as NavigationState }
    : result)
function restore(history: BrowserHistory, current: NavigationState, change: { id: string | null; path: string }, reduce: Reduce = applyReset) {
  return restoreNavigationFromBrowser(history, { state: current }, change, config, reduce)
}

describe('Expo 58 web browser history keeps full snapshots per entry (#2703 / #2727)', () => {
  afterEach(() => { applyReset.mockClear() })

  it('restores the retained full B snapshot, not a re-parsed URL, after Back A and Forward B', () => {
    const { history, entries: [a, b] } = seed(['a', 'b'])
    expect(a.id).not.toBe(b.id)
    const back = restore(history, b.state, a)
    expect(applyReset).toHaveBeenLastCalledWith({ state: b.state }, expect.objectContaining({
      payload: { action: { type: 'RESET', payload: a.state, target: a.state.key } },
    }))
    expect(back.result.state).toBe(a.state)
    expect(back.history).toMatchObject({ index: 0 })
    expect(back.events).toEqual([])
    const forward = restore(back.history!, back.result.state, b)
    expect(forward.result.state).toBe(b.state)
    expect(forward.history).toMatchObject({ index: 1 })
    expect(forward.history!.entries).toEqual([a, b])
    expect(forward.events).toEqual([])
  })

  it('discards only the forward tail after an external Back to a nonzero cursor and a push', () => {
    const { history, entries: [a, b, c] } = seed()
    const back = restore(history, snapshot('d'), c)
    expect(back.history!.index).toBe(2)
    const pushed = applyRouterHistoryAction(back.history!, snapshot('e'), config, { type: 'push' })
    expect(pushed.history!.entries.slice(0, 3)).toEqual([a, b, c])
    expect(pushed.history!.entries[3]).toMatchObject({ path: '/e' })
    expect(pushed.history!.entries).toHaveLength(4)
    expect(pushed.history!.index).toBe(3)
    expect(pushed.events).toEqual([{ type: 'browser-history', op: 'push', entryId: pushed.history!.entries[3].id, path: '/e' }])
  })

  it('replaces only the selected nonzero entry and retains the forward entry id', () => {
    const { history, entries: [a, b, c, d] } = seed()
    const back = restore(history, snapshot('d'), c)
    const updated = snapshot('c-updated')
    const replaced = applyRouterHistoryAction(back.history!, updated, config)
    expect([replaced.history!.entries[0], replaced.history!.entries[1]]).toEqual([a, b])
    expect(replaced.history!.entries[2]).toEqual({ id: c.id, path: '/c-updated', state: updated })
    expect(replaced.history!.entries[3]).toEqual(d)
    expect(new Set(replaced.history!.entries.map(entry => entry.id)).size).toBe(4)
    expect(replaced.events).toEqual([{ type: 'browser-history', op: 'replace', entryId: c.id, path: '/c-updated' }])
  })

  it('moves the browser to the pop target before replacing it and clamps to the first entry', () => {
    const { history, entries: [a, , c] } = seed()
    const target = { navigatorKey: c.state.key, routeKey: c.state.routes[0].key }
    const popped = applyRouterHistoryAction(history, c.state, config, { type: 'pop', count: 1, target })
    expect(popped.history!.index).toBe(2)
    expect(popped.events).toEqual([
      { type: 'browser-history', op: 'go', delta: -1 },
      { type: 'browser-history', op: 'replace', entryId: c.id, path: '/c' },
    ])
    const clamped = applyRouterHistoryAction(history, a.state, config, { type: 'pop', count: 100 })
    expect(clamped.history!.index).toBe(0)
    expect(clamped.events[0]).toEqual({ type: 'browser-history', op: 'go', delta: -3 })
  })

  it('returns the browser to the entry matching the UI when a restore is prevented', () => {
    const { history, entries: [a] } = seed()
    const current = snapshot('d')
    const prevented = restore(history, current, a, result => result)
    expect(prevented.result.state).toBe(current)
    expect(prevented.history).toBe(history)
    expect(prevented.events).toEqual([{ type: 'browser-history', op: 'go', delta: 3 }])
  })

  it('starts a single direct entry for an unknown document id without inventing a predecessor', () => {
    const { history } = seed()
    const direct = restore(history, snapshot('d'), { id: 'another-document', path: '/direct' })
    expect(nameOf(direct.result.state)).toBe('direct')
    expect(direct.history!.entries).toEqual([{ id: 'another-document', path: '/direct', state: direct.result.state }])
    expect(direct.history!.index).toBe(0)
    expect(direct.events).toEqual([{ type: 'browser-history', op: 'replace', entryId: 'another-document', path: '/direct' }])
  })
})

describe('Expo 58 web browser history adapter (#2703 / #2702)', () => {
  let nativeGo: jest.SpyInstance
  let listener: jest.Mock
  let unlisten: () => void

  beforeEach(() => {
    jest.useFakeTimers()
    window.history.replaceState({ id: 'session:0' }, '', '/a')
    nativeGo = jest.spyOn(window.history, 'go').mockImplementation(() => undefined)
    listener = jest.fn()
  })
  afterEach(() => {
    unlisten?.()
    jest.clearAllTimers()
    jest.useRealTimers()
    jest.restoreAllMocks()
  })

  function present(id: string, path: string) {
    window.history.replaceState({ id }, '', path)
    window.dispatchEvent(new PopStateEvent('popstate', { state: { id } }))
  }
  // `apply` chains commands on a promise queue; drain it between steps.
  const drain = async () => { for (let i = 0; i < 4; i += 1) await Promise.resolve() }

  it('ignores the popstate of its own go, settles once and still reports the next external change', async () => {
    const adapter = createBrowserHistoryAdapter()
    unlisten = adapter.listen(listener)
    adapter.apply({ type: 'browser-history', op: 'go', delta: -1 })
    await drain()
    expect(nativeGo).toHaveBeenCalledTimes(1)
    expect(nativeGo).toHaveBeenLastCalledWith(-1)
    present('session:0', '/a')
    expect(listener).not.toHaveBeenCalled()
    adapter.apply({ type: 'browser-history', op: 'replace', entryId: 'session:0', path: '/a?restored' })
    await drain()
    expect(window.location.search).toBe('?restored')
    present('session:1', '/b')
    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener).toHaveBeenLastCalledWith({ id: 'session:1', path: '/b' })
  })

  it('settles a go without popstate after the 100ms timeout and keeps applying queued commands', async () => {
    const adapter = createBrowserHistoryAdapter()
    unlisten = adapter.listen(listener)
    adapter.apply({ type: 'browser-history', op: 'go', delta: -1 })
    adapter.apply({ type: 'browser-history', op: 'push', entryId: 'session:1', path: '/b' })
    await drain()
    expect(window.location.pathname).toBe('/a') // Browser never left A.
    jest.advanceTimersByTime(99)
    await drain()
    expect(window.location.pathname).toBe('/a')
    jest.advanceTimersByTime(1)
    await drain()
    expect(window.location.pathname).toBe('/b')
    expect(window.history.state).toEqual({ id: 'session:1' })
    expect(nativeGo).toHaveBeenCalledTimes(1)
    present('session:0', '/a')
    expect(listener).toHaveBeenCalledWith({ id: 'session:0', path: '/a' })
  })

  it('replaces the URL of the entry the browser already shows instead of pushing a duplicate', async () => {
    const adapter = createBrowserHistoryAdapter()
    const length = window.history.length
    adapter.apply({ type: 'browser-history', op: 'push', entryId: 'session:0', path: '/a?view=photos' })
    await drain()
    expect(window.history.length).toBe(length)
    expect(window.location.search).toBe('?view=photos')
    adapter.apply({ type: 'browser-history', op: 'push', entryId: 'session:1', path: '/b' })
    await drain()
    expect(window.history.length).toBe(length + 1)
    expect(window.history.state).toEqual({ id: 'session:1' })
  })
})
