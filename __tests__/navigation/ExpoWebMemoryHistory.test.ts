import { createMemoryHistory } from 'expo-router/build/fork/createMemoryHistory'
import type { NavigationState } from 'expo-router/build/react-navigation/core'

type Memory = ReturnType<typeof createMemoryHistory>
type Entry = NonNullable<ReturnType<Memory['get']>>

function snapshot(name: string): NavigationState {
  return {
    stale: false, type: 'stack', key: 'stack', index: 0,
    routeNames: ['article'], routes: [{ key: name, name: 'article', params: { name } }],
  }
}

// jsdom has no synchronous native traversal driver. Only the browser boundary is
// controlled: the pinned memory implementation and its listeners stay real.
function present(entry: Entry, dispatch = true) {
  window.history.replaceState({ id: entry.id }, '', entry.path)
  if (dispatch) window.dispatchEvent(new PopStateEvent('popstate', { state: { id: entry.id } }))
}

function seed(paths = ['/a', '/b', '/c', '/d']) {
  const history = createMemoryHistory()
  paths.forEach((path, index) => history[index ? 'push' : 'replace']({ path, state: snapshot(path) }))
  return { history, entries: paths.map((_, index) => history.get(index)!) }
}

describe('pinned Expo web memory history (#2703 / #2702)', () => {
  let listeners: EventListenerOrEventListenerObject[]
  let nativeGo: jest.SpyInstance

  beforeEach(() => {
    jest.useFakeTimers()
    window.history.replaceState(null, '', '/')
    document.title = 'Travel history'
    listeners = []
    const add = window.addEventListener.bind(window)
    jest.spyOn(window, 'addEventListener').mockImplementation((type, listener, options) => {
      if (type === 'popstate') listeners.push(listener)
      add(type, listener, options)
    })
    nativeGo = jest.spyOn(window.history, 'go').mockImplementation(() => undefined)
  })

  afterEach(() => {
    listeners.forEach(listener => window.removeEventListener('popstate', listener))
    jest.clearAllTimers()
    jest.useRealTimers()
    jest.restoreAllMocks()
  })

  it('keeps B and its full snapshot when external Back A triggers the linking replace', () => {
    const { history, entries: [a, b] } = seed(['/a', '/b'])
    history.listen(() => {
      const restored = history.get(history.index)!
      history.replace({ path: restored.path, state: restored.state })
    })
    present(a)
    expect(history.get(0)).toEqual(a)
    expect(history.get(1)).toEqual(b)
    expect(history.get(1)?.state).toBe(b.state)
    present(b)
    expect(history.index).toBe(1)
    expect(history.get(history.index)).toEqual(b)
    expect(nativeGo).not.toHaveBeenCalled()
  })

  it('cuts only the forward tail after an external Back to a nonzero cursor and push', () => {
    const { history, entries: [a, b, c] } = seed()
    history.listen(() => undefined)
    present(c)
    history.push({ path: '/e', state: snapshot('e') })
    expect([0, 1, 2].map(index => history.get(index))).toEqual([a, b, c])
    expect(history.get(3)?.path).toBe('/e')
    expect(history.get(4)).toBeUndefined()
    expect(history.index).toBe(3)
  })

  it('replaces only the selected nonzero entry and retains the forward entry id', () => {
    const { history, entries: [a, b, c, d] } = seed()
    history.listen(() => undefined)
    present(c)
    const updated = snapshot('c updated')
    history.replace({ path: '/c?view=photos', state: updated })
    expect([history.get(0), history.get(1)]).toEqual([a, b])
    expect(history.get(2)).toEqual({ id: c.id, path: '/c?view=photos', state: updated })
    expect(history.get(3)).toEqual(d)
    expect(new Set([0, 1, 2, 3].map(index => history.get(index)?.id)).size).toBe(4)
  })

  it('searches backIndex strictly before the current external cursor', () => {
    const { history, entries: [, , c] } = seed(['/a', '/b', '/c', '/b'])
    history.listen(() => undefined)
    present(c)
    expect(history.backIndex({ path: '/c' })).toBe(-1)
    expect(history.backIndex({ path: '/b' })).toBe(1)
    expect(history.backIndex({ path: '/a' })).toBe(0)
  })

  it('suppresses internal popstate once, settles once and keeps the actual cursor for the next push', async () => {
    const { history, entries: [a, b, c] } = seed()
    const external = jest.fn()
    history.listen(external)
    const settled = jest.fn()
    const pending = history.go(-1)!.then(settled)
    expect(nativeGo).toHaveBeenCalledTimes(1)
    expect(nativeGo).toHaveBeenLastCalledWith(-1)
    present(c)
    await pending
    jest.advanceTimersByTime(100)
    expect(settled).toHaveBeenCalledTimes(1)
    expect(external).not.toHaveBeenCalled()
    expect(document.title).toBe('Travel history')
    history.push({ path: '/e', state: snapshot('e') })
    expect([0, 1, 2].map(index => history.get(index))).toEqual([a, b, c])
    expect(history.get(3)?.path).toBe('/e')
    present(b)
    expect(external).toHaveBeenCalledTimes(1)
    expect(history.index).toBe(1)
  })

  it('resynchronizes after the 100ms no-pop timeout instead of dropping the actual current visit', async () => {
    const { history, entries: [a, b, c, d] } = seed()
    const settled = jest.fn()
    const pending = history.go(-1)!.then(settled)
    jest.advanceTimersByTime(99)
    await Promise.resolve()
    expect(settled).not.toHaveBeenCalled()
    jest.advanceTimersByTime(1)
    await pending
    expect(settled).toHaveBeenCalledTimes(1)
    expect(history.index).toBe(3) // Browser never left D.
    history.push({ path: '/e', state: snapshot('e') })
    expect([0, 1, 2, 3].map(index => history.get(index))).toEqual([a, b, c, d])
    expect(history.get(4)?.path).toBe('/e')
    expect(nativeGo).toHaveBeenCalledTimes(1)
  })

  it.each(['push', 'replace'] as const)('rejects an interrupted go once without a stale continuation after %s', async operation => {
    const { history, entries: [a] } = seed(['/a', '/b'])
    const rejected = jest.fn()
    const continued = jest.fn(() => history.replace({ path: '/stale', state: snapshot('stale') }))
    const pending = history.go(-1)!.then(continued, rejected)
    // Native location has changed; its popstate is queued behind the new action.
    present(a, false)
    history[operation]({ path: '/new', state: snapshot('new') })
    const current = history.get(history.index)!
    present(current)
    await pending
    jest.advanceTimersByTime(100)
    expect(rejected).toHaveBeenCalledTimes(1)
    expect(rejected.mock.calls[0][0]).toEqual(new Error('History was changed during navigation.'))
    expect(continued).not.toHaveBeenCalled()
    expect(history.get(history.index)).toEqual(current)
    expect(window.location.pathname).toBe('/new')
    expect(nativeGo).toHaveBeenCalledTimes(1)
  })

  it('clamps programmatic traversal to known entries in both directions', async () => {
    const { history, entries: [a, , , d] } = seed()
    const back = history.go(-100)
    expect(nativeGo).toHaveBeenLastCalledWith(-3)
    present(a)
    await back
    const forward = history.go(100)
    expect(nativeGo).toHaveBeenLastCalledWith(3)
    present(d)
    await forward
    expect(history.index).toBe(3)
    expect(nativeGo).toHaveBeenCalledTimes(2)
  })

  it('starts a single direct entry for an unknown document id without inventing a predecessor', () => {
    const { history } = seed()
    window.history.replaceState({ id: 'another-document' }, '', '/direct#photos')
    history.replace({ path: '/direct', state: snapshot('direct') })
    expect(history.index).toBe(0)
    expect(history.get(0)).toEqual({
      id: 'another-document', path: '/direct#photos', state: snapshot('direct'),
    })
    expect(history.get(1)).toBeUndefined()
    expect(history.backIndex({ path: '/a' })).toBe(-1)
    expect(history.go(-100)).toBeUndefined()
    expect(history.go(100)).toBeUndefined()
    expect(nativeGo).not.toHaveBeenCalled()
  })
})
