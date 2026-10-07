import type { Root } from 'react-dom/client'
import type { ReactNode } from 'react'

let createElement: typeof import('react').createElement
let act: typeof import('react').act
let useLayoutEffect: typeof import('react').useLayoutEffect
let useRuntimeSettle: typeof import('@/components/travel/details/TravelDetailsDeferredTransition').useDeferredSectionRuntimeSettle
let createRoot: typeof import('react-dom/client').createRoot
let Transition: typeof import('@/components/travel/details/TravelDetailsDeferredTransition').TravelDetailsDeferredTransition
let Platform: typeof import('react-native').Platform

class MeasuredResizeObserver {
  static instances: MeasuredResizeObserver[] = []
  targets = new Set<Element>()
  constructor(readonly callback: ResizeObserverCallback) { MeasuredResizeObserver.instances.push(this) }
  observe(target: Element) { this.targets.add(target) }
  unobserve(target: Element) { this.targets.delete(target) }
  disconnect() { this.targets.clear() }
}

beforeAll(() => {
  Object.defineProperty(window, 'ResizeObserver', { configurable: true, value: MeasuredResizeObserver })
  jest.resetModules()
  jest.doMock('react-native', () => jest.requireActual('react-native-web'))
  // Deferred content leaves only: the actual transition/layout effects render.
  jest.doMock('@/components/travel/TravelDetailSkeletons', () => ({
    AuthorSectionSkeleton: () => null, CommentsSkeleton: () => null,
    FooterSectionSkeleton: () => null, MapSectionSkeleton: () => null,
    RatingSectionSkeleton: () => null, SidebarSectionSkeleton: () => null,
  }))
  ;({ createElement, act, useLayoutEffect } = require('react'))
  ;({ createRoot } = require('react-dom/client'))
  ;({ Platform } = require('react-native'))
  Transition = require('@/components/travel/details/TravelDetailsDeferredTransition').TravelDetailsDeferredTransition
  useRuntimeSettle = require('@/components/travel/details/TravelDetailsDeferredTransition').useDeferredSectionRuntimeSettle
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 })
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 844 })
})

const rect = (top: number, height: number, width = 390) => ({
  top, bottom: top + height, left: 0, right: width, width, height, x: 0, y: top,
  toJSON: () => ({}),
}) as DOMRect

type FixtureOptions = {
  initialTop?: number
  anchorTop?: number
  anchorHeight?: number
  ownerTop?: number
  ownerHeight?: number
  naturalAnchor?: boolean
  disconnectedAfterRelease?: boolean
  noScrollOwner?: boolean
  differentOwner?: boolean
  precedingOverlay?: 'fixed' | 'absolute' | 'sticky'
  precedingOffscreenFlow?: boolean
  runtimeGrowth?: number
  optional?: boolean
}

function fixture(options: FixtureOptions = {}) {
  const initialTop = options.initialTop ?? 26400
  const anchorTop = options.anchorTop ?? 195.96875
  const ownerHeight = options.ownerHeight ?? 790
  const ownerTop = options.ownerTop ?? 54
  const host = document.createElement('div')
  const owner = document.createElement('div')
  const mount = document.createElement('div')
  const anchor = document.createElement('div')
  owner.style.overflowY = options.noScrollOwner ? 'hidden' : 'auto'
  anchor.dataset.testid = 'actual-following-footer-frame'
  owner.append(mount)
  if (options.differentOwner) host.append(owner, anchor)
  else { owner.append(anchor); host.append(owner) }
  if (options.precedingOverlay) {
    const overlay = document.createElement('div')
    overlay.style.position = options.precedingOverlay
    overlay.getBoundingClientRect = () => rect(100, 100)
    owner.insertBefore(overlay, anchor)
  }
  if (options.precedingOffscreenFlow) {
    const previous = document.createElement('div')
    previous.getBoundingClientRect = () => rect(-250, 100)
    owner.insertBefore(previous, anchor)
  }
  document.body.append(host)
  let runtimeWidth = 390
  let top = initialTop
  let root: Root
  const writes: number[] = []
  const transition = () => mount.querySelector<HTMLElement>('[data-testid="measured-transition"]')!
  const released = () => !!transition() && transition().style.minHeight !== '100vh'
  const runtimeLayer = () => mount.querySelector<HTMLElement>('[data-testid="measured-transition-runtime"]')
  const baselineHeight = options.optional ? 0 : options.runtimeGrowth == null ? 844 : 873
  // Browser flow model follows the actual committed container height and CSS.
  // Absolute child's intrinsic height does not affect its parent's flow height.
  const layoutDelta = () => {
    const declaredHeight = Number.parseFloat(transition()?.style.height || '0')
    const runtime = runtimeLayer()
    const intrinsicHeight = Number.parseFloat((runtime?.firstElementChild as HTMLElement | null)?.style.height || '0')
    const uncontrolledIntrinsic = runtime && getComputedStyle(runtime).position !== 'absolute' ? intrinsicHeight : 0
    const flowHeight = Math.max(declaredHeight, uncontrolledIntrinsic, released() ? 0 : baselineHeight)
    return flowHeight - baselineHeight
  }
  const originalRect = HTMLElement.prototype.getBoundingClientRect
  HTMLElement.prototype.getBoundingClientRect = function () {
    if (this.dataset.testid === 'measured-transition-runtime') {
      const leaf = this.firstElementChild as HTMLElement | null
      return rect(0, Number.parseFloat(leaf?.style.height || '0') + Number.parseFloat(leaf?.style.marginBottom || '0'), runtimeWidth)
    }
    return originalRect.call(this)
  }
  // Genuine DOM lifecycle + an independent browser geometry/clamp model.
  // React changes the real reserve style; measurements follow that style,
  // rather than injecting a fabricated ready callback into the product hook.
  Object.defineProperties(owner, {
    clientHeight: { configurable: true, get: () => ownerHeight },
    clientWidth: { configurable: true, get: () => runtimeWidth },
    scrollHeight: { configurable: true, get: () => 26848 + layoutDelta() + ownerHeight },
    scrollTop: {
      configurable: true,
      get: () => {
        const max = 26848 + layoutDelta()
        if (options.naturalAnchor) top = initialTop + layoutDelta()
        top = Math.max(0, Math.min(max, top))
        return top
      },
      set: value => { top = Math.max(0, Math.min(owner.scrollHeight - ownerHeight, value)); writes.push(top) },
    },
  })
  owner.getBoundingClientRect = () => rect(ownerTop, ownerHeight)
  anchor.getBoundingClientRect = () => rect(anchorTop + initialTop - owner.scrollTop + layoutDelta(), options.anchorHeight ?? 930)
  if (options.disconnectedAfterRelease) Object.defineProperty(anchor, 'isConnected', { configurable: true, get: () => !released() })
  const render = (ready: boolean, pending = false, child: ReactNode = options.optional ? null : createElement('div', { 'data-testid': 'actual-runtime-leaf', style: { height: options.runtimeGrowth == null ? 702 : ready ? 873 + options.runtimeGrowth : 873 } }), runtimeVisibilityReady?: boolean) => {
    act(() => {
      root ??= createRoot(mount)
      root.render(createElement(Transition, { isMobile: true, pending, placeholder: createElement('div', { 'data-testid': 'actual-placeholder-leaf' }), reserveHeight: options.optional ? undefined : '100vh', runtimeFrameReady: options.optional || ready, runtimeVisibilityReady, allowEmptyRuntime: options.optional, testID: 'measured-transition', children: child }))
    })
  }
  render(false)
  const currentCallbacks = () => MeasuredResizeObserver.instances.filter(observer => runtimeLayer() && observer.targets.has(runtimeLayer()!)).map(observer => observer.callback)
  const resizeRuntime = (height: number, width = runtimeWidth) => {
    const layer = runtimeLayer()!
    const leaf = layer.firstElementChild as HTMLElement
    const callbacks = currentCallbacks()
    act(() => {
      runtimeWidth = width
      owner.style.width = `${width}px`
      leaf.style.height = `${height}px`
      for (const callback of callbacks) callback([{ target: layer } as ResizeObserverEntry], {} as ResizeObserver)
    })
  }
  const renderTree = (tree: ReactNode) => { act(() => root.render(tree)) }
  const cleanup = () => { act(() => root.unmount()); host.remove(); HTMLElement.prototype.getBoundingClientRect = originalRect }
  return { owner, anchor, writes, render, renderTree, transition, resizeRuntime, currentCallbacks, cleanup }
}

it.each([
  ['near bottom', 26400, 26258, 1],
  ['partial bottom clamp', 26800, 26658, 1],
  ['exact bottom natural clamp', 26848, 26706, 0],
] as const)('preserves the genuine following frame before paint: %s', (_name, initialTop, expectedTop, writes) => {
  const f = fixture({ initialTop })
  const before = f.anchor.getBoundingClientRect().top
  expect(f.transition().style.minHeight).toBe('100vh')
  f.render(true)
  expect(f.owner.scrollTop).toBe(expectedTop)
  expect(f.writes).toHaveLength(writes)
  expect(f.anchor.getBoundingClientRect().top).toBe(before)
  expect(f.transition().dataset.reserveReleaseState).toBe('anchored')
  expect(f.transition().style.minHeight).toBe('')
  expect(f.transition().querySelector('[data-testid="actual-placeholder-leaf"]')).toBeNull()
  f.cleanup()
})

it.each(['fixed', 'absolute', 'sticky'] as const)('skips a pinned %s overlay and preserves the actual following flow frame', precedingOverlay => {
  const f = fixture({ precedingOverlay })
  const before = f.anchor.getBoundingClientRect().top
  f.render(true)
  expect(f.writes).toEqual([26258])
  expect(f.anchor.getBoundingClientRect().top).toBe(before)
  expect(f.transition().dataset.reserveReleaseState).toBe('anchored')
  f.cleanup()
})

it('does not double compensate genuine browser scroll anchoring', () => {
  const f = fixture({ naturalAnchor: true })
  const before = f.anchor.getBoundingClientRect().top
  f.render(true)
  expect(f.owner.scrollTop).toBe(26258)
  expect(f.writes).toHaveLength(0)
  expect(f.anchor.getBoundingClientRect().top).toBe(before)
  expect(f.transition().dataset.reserveReleaseState).toBe('anchored')
  f.cleanup()
})

it('preserves a visible following section when an intervening flow frame is already above the viewport', () => {
  const f = fixture({ precedingOffscreenFlow: true })
  try {
    const before = f.anchor.getBoundingClientRect().top
    f.render(true)
    expect(f.anchor.getBoundingClientRect().top).toBe(before)
    expect(f.writes).toEqual([26258])
  } finally { f.cleanup() }
})

it.each(['opacity', 'visibility', 'hidden-parent'] as const)('does not compensate an undrawn following frame: %s', hidden => {
  const f = fixture()
  try {
    if (hidden === 'opacity') f.anchor.style.opacity = '0'
    else if (hidden === 'visibility') f.anchor.style.visibility = 'hidden'
    else {
      const parent = document.createElement('div')
      parent.style.opacity = '0'
      parent.setAttribute('inert', '')
      f.anchor.before(parent)
      parent.append(f.anchor)
      parent.getBoundingClientRect = () => f.anchor.getBoundingClientRect()
    }
    f.render(true)
    expect(f.writes).toHaveLength(0)
  } finally { f.cleanup() }
})

it.each([
  ['below fold', { anchorTop: 900 }],
  ['above fold', { anchorTop: -1200, anchorHeight: 200 }],
  ['outside owner clipping but inside window', { anchorTop: 600, ownerTop: 200, ownerHeight: 300 }],
  ['no genuine scroll owner', { noScrollOwner: true }],
  ['following frame belongs to another owner', { differentOwner: true }],
  ['disconnected following frame', { disconnectedAfterRelease: true }],
] as const)('releases reserve without touching a non-visible/invalid anchor: %s', (_name, options) => {
  const f = fixture(options)
  f.render(true)
  expect(f.writes).toHaveLength(0)
  expect(f.transition().style.minHeight).toBe('')
  expect(f.transition().dataset.reserveReleaseState).toBe('released')
  f.cleanup()
})

it('reports an impossible top clamp explicitly instead of claiming preserved geometry', () => {
  const f = fixture({ initialTop: 10 })
  const before = f.anchor.getBoundingClientRect().top
  f.render(true)
  expect(f.owner.scrollTop).toBe(0)
  expect(Math.abs(f.anchor.getBoundingClientRect().top - before)).toBeGreaterThan(1)
  expect(f.transition().dataset.reserveReleaseState).toBe('clamped')
  expect(f.transition().style.minHeight).toBe('')
  f.cleanup()
})

it.each(['nonempty', 'empty', 'error'])('releases the measured %s frame without leaving permanent reserved space', state => {
  const f = fixture()
  f.render(true, false, createElement('div', { 'data-testid': `actual-${state}-frame`, style: { height: 702 } }))
  expect(f.transition().querySelector(`[data-testid="actual-${state}-frame"]`)).not.toBeNull()
  expect(f.transition().style.minHeight).toBe('')
  expect(f.transition().dataset.reserveReleaseState).toBe('anchored')
  f.cleanup()
})

it('clears capture/readiness when pending resets for a new travel, then measures anew', () => {
  const f = fixture()
  f.render(true)
  f.render(false, true)
  expect(f.transition().style.minHeight).toBe('100vh')
  expect(f.transition().dataset.reserveReleaseState).toBe('reserved')
  const writes = f.writes.length
  f.render(false, true)
  expect(f.writes).toHaveLength(writes)
  const newBefore = f.anchor.getBoundingClientRect().top
  f.render(true)
  expect(f.writes).toHaveLength(writes + 1)
  expect(f.anchor.getBoundingClientRect().top).toBe(newBefore)
  expect(f.transition().dataset.reserveReleaseState).toBe('anchored')
  f.cleanup()
})


it('keeps an unready tall runtime measurable at current width without changing following flow', () => {
  const f = fixture({ runtimeGrowth: 2600, initialTop: 22800 })
  const before = f.anchor.getBoundingClientRect().top
  const height = f.owner.scrollHeight
  const layer = f.transition().querySelector<HTMLElement>('[data-testid="measured-transition-runtime"]')!
  expect(getComputedStyle(layer).position).toBe('absolute')
  expect(getComputedStyle(layer).width).toBe('100%')
  expect(getComputedStyle(f.transition()).overflowX).toBe('hidden')
  expect(getComputedStyle(f.transition()).overflowY).toBe('hidden')
  expect(layer.hasAttribute('inert')).toBe(true)
  expect(layer.getAttribute('aria-hidden')).toBe('true')
  expect(f.transition().dataset.deferredTransitionState).toBe('measuring-runtime')
  f.render(false, false, createElement('div', { style: { height: 3473 }, 'data-testid': 'actual-tall-runtime' }))
  expect(f.owner.scrollHeight).toBe(height)
  expect(f.anchor.getBoundingClientRect().top).toBe(before)
  expect(f.writes).toHaveLength(0)
  f.render(true)
  expect(f.owner.scrollTop).toBe(25400)
  expect(f.writes).toEqual([25400])
  expect(f.anchor.getBoundingClientRect().top).toBe(before)
  expect(f.transition().dataset.reserveReleaseState).toBe('anchored')
  expect(f.transition().style.minHeight).toBe('')
  f.cleanup()
})

it('does not double compensate a naturally browser-anchored signed growth reveal', () => {
  const f = fixture({ runtimeGrowth: 2600, initialTop: 22800, naturalAnchor: true })
  const before = f.anchor.getBoundingClientRect().top
  f.render(true)
  expect(f.owner.scrollTop).toBe(25400)
  expect(f.writes).toHaveLength(0)
  expect(f.anchor.getBoundingClientRect().top).toBe(before)
  expect(f.transition().dataset.reserveReleaseState).toBe('anchored')
  f.cleanup()
})

it('shows opt-in actual loading tree with honest state while reserve stays until settling', () => {
  const f = fixture({ runtimeGrowth: 2600, initialTop: 22800 })
  const before = f.anchor.getBoundingClientRect().top
  f.render(false, false, createElement('div', { 'data-testid': 'actual-loading-tree', style: { height: 3473 } }), true)
  const layer = f.transition().querySelector<HTMLElement>('[data-testid="measured-transition-runtime"]')!
  expect(layer.hasAttribute('inert')).toBe(false)
  expect(layer.getAttribute('aria-hidden')).toBeNull()
  expect(f.transition().querySelector('[data-testid="actual-placeholder-leaf"]')).toBeNull()
  expect(f.transition().querySelector('[data-testid="actual-loading-tree"]')).not.toBeNull()
  expect(f.transition().dataset.deferredTransitionState).toBe('shown-pending')
  expect(f.transition().dataset.reserveReleaseState).toBe('reserved')
  expect(f.transition().style.minHeight).toBe('100vh')
  expect(f.anchor.getBoundingClientRect().top).toBe(before)
  expect(f.writes).toEqual([25400])
  f.render(true, false, createElement('div', { 'data-testid': 'actual-loaded-tree', style: { height: 3473 } }), true)
  expect(f.transition().dataset.deferredTransitionState).toBe('runtime')
  expect(f.transition().style.minHeight).toBe('')
  expect(f.anchor.getBoundingClientRect().top).toBe(before)
  expect(f.writes).toEqual([25400])
  f.cleanup()
})

it.each([false, true])('commits actual opt-in visible growth and shrink before paint (browser anchoring=%s)', naturalAnchor => {
  const f = fixture({ initialTop: 22800, runtimeGrowth: 2600, naturalAnchor })
  f.render(false, false, createElement('div', { 'data-testid': 'actual-loading-tree', style: { height: 873 } }), true)
  const before = f.anchor.getBoundingClientRect().top
  expect(f.transition().style.height).toBe('873px')
  expect(f.transition().dataset.deferredTransitionState).toBe('shown-pending')
  f.resizeRuntime(3473)
  expect(f.transition().style.height).toBe('3473px')
  expect(f.transition().style.minHeight).toBe('100vh')
  expect(f.anchor.getBoundingClientRect().top).toBe(before)
  expect(f.owner.scrollTop).toBe(25400)
  expect(f.writes).toEqual(naturalAnchor ? [] : [25400])
  f.resizeRuntime(873)
  expect(f.transition().style.height).toBe('873px')
  expect(f.anchor.getBoundingClientRect().top).toBe(before)
  expect(f.owner.scrollTop).toBe(22800)
  expect(f.writes).toEqual(naturalAnchor ? [] : [25400, 22800])
  f.cleanup()
})

it('uses the current width frame and rejects nonpositive resize measurements', () => {
  const f = fixture({ initialTop: 22800, runtimeGrowth: 2600 })
  f.render(false, false, createElement('div', { style: { height: 873 } }), true)
  const before = f.anchor.getBoundingClientRect().top
  f.resizeRuntime(3473, 0)
  expect(f.transition().style.height).toBe('873px')
  expect(f.writes).toHaveLength(0)
  f.resizeRuntime(3473, 320)
  expect(f.transition().style.height).toBe('3473px')
  expect(f.transition().querySelector<HTMLElement>('[data-testid="measured-transition-runtime"]')!.getBoundingClientRect().width).toBe(320)
  expect(f.anchor.getBoundingClientRect().top).toBe(before)
  expect(f.writes).toEqual([25400])
  f.resizeRuntime(0, 320)
  expect(f.transition().style.height).toBe('3473px')
  expect(f.writes).toEqual([25400])
  f.cleanup()
})

it('reports opt-in visible shrink at an impossible owner top as clamped at settled release', () => {
  const f = fixture({ initialTop: 10 })
  f.render(false, false, createElement('div', { style: { height: 844 } }), true)
  const before = f.anchor.getBoundingClientRect().top
  f.resizeRuntime(702)
  expect(f.transition().style.minHeight).toBe('100vh')
  f.render(true, false, createElement('div', { style: { height: 702 } }), true)
  expect(f.owner.scrollTop).toBe(0)
  expect(Math.abs(f.anchor.getBoundingClientRect().top - before)).toBeGreaterThan(1)
  expect(f.transition().dataset.reserveReleaseState).toBe('clamped')
  f.cleanup()
})

it('rejects queued measured updates from the previous pending visit', () => {
  const f = fixture({ initialTop: 22800, runtimeGrowth: 2600 })
  f.render(false, false, createElement('div', { style: { height: 873 } }), true)
  const callbacks = f.currentCallbacks()
  expect(callbacks.length).toBeGreaterThan(0)
  const staleLayer = f.transition().querySelector('[data-testid="measured-transition-runtime"]')!
  f.render(false, true)
  const writes = f.writes.length
  act(() => { for (const callback of callbacks) callback([{ target: staleLayer } as ResizeObserverEntry], {} as ResizeObserver) })
  expect(f.transition().style.height).toBe('')
  expect(f.transition().dataset.deferredTransitionState).toBe('placeholder')
  expect(f.writes).toHaveLength(writes)
  f.render(false, false, createElement('div', { style: { height: 873 } }), true)
  const before = f.anchor.getBoundingClientRect().top
  f.resizeRuntime(3473)
  expect(f.transition().style.height).toBe('3473px')
  expect(f.anchor.getBoundingClientRect().top).toBe(before)
  f.cleanup()
})

it('fails closed for unsupported observation instead of exposing untracked opt-in growth', () => {
  const installed = window.ResizeObserver
  Object.defineProperty(window, 'ResizeObserver', { configurable: true, value: undefined })
  try {
    const f = fixture()
    f.render(false, false, createElement('div', { style: { height: 702 } }), true)
    expect(f.transition().dataset.deferredTransitionState).toBe('measuring-runtime')
    expect(f.transition().querySelector('[data-testid="actual-placeholder-leaf"]')).not.toBeNull()
    f.render(true)
    expect(f.transition().dataset.deferredTransitionState).toBe('runtime')
    expect(f.transition().style.minHeight).toBe('')
    f.cleanup()
  } finally { Object.defineProperty(window, 'ResizeObserver', { configurable: true, value: installed }) }
})

it.each([undefined, false])('keeps default/non-opt-in runtime hidden until settling (%s)', runtimeVisibilityReady => {
  const f = fixture()
  f.render(false, false, createElement('div', { 'data-testid': 'actual-default-loading', style: { height: 702 } }), runtimeVisibilityReady)
  expect(f.transition().dataset.deferredTransitionState).toBe('measuring-runtime')
  expect(f.transition().querySelector('[data-testid="actual-placeholder-leaf"]')).not.toBeNull()
  expect(f.transition().querySelector('[data-testid="measured-transition-runtime"]')?.getAttribute('aria-hidden')).toBe('true')
  expect(f.transition().style.minHeight).toBe('100vh')
  expect(f.writes).toHaveLength(0)
  f.cleanup()
})

it('pending/reset wins over opt-in, then current mounted tree can reveal again', () => {
  const f = fixture()
  f.render(false, false, createElement('div', { style: { height: 702 } }), true)
  expect(f.transition().dataset.deferredTransitionState).toBe('shown-pending')
  f.render(false, true, createElement('div', { style: { height: 702 } }), true)
  expect(f.transition().dataset.deferredTransitionState).toBe('placeholder')
  expect(f.transition().querySelector('[data-testid="measured-transition-runtime"]')).toBeNull()
  expect(f.transition().style.minHeight).toBe('100vh')
  const before = f.anchor.getBoundingClientRect().top
  f.render(false, false, createElement('div', { style: { height: 702 } }), true)
  expect(f.transition().dataset.deferredTransitionState).toBe('shown-pending')
  expect(f.anchor.getBoundingClientRect().top).toBe(before)
  f.cleanup()
})

it.each(['new resetKey', 'inactive then same key'] as const)('fences FIRST commit readiness and stale callbacks for %s', boundary => {
  jest.useFakeTimers()
  const timers = jest.spyOn(global, 'setTimeout')
  const f = fixture()
  const commits: Array<{ key: string; active: boolean; settled: boolean; transitionState: string | undefined; reserve: string }> = []
  let currentLayout: ReturnType<typeof useRuntimeSettle>['onRuntimeFrameLayout']
  function RealSettleConsumer({ visitKey, active }: { visitKey: string; active: boolean }) {
    const result = useRuntimeSettle({ resetKey: visitKey, active })
    currentLayout = result.onRuntimeFrameLayout
    // This runs in the FIRST layout commit, before passive reset/timeout effects.
    // Retain every commit so later act/effects cannot conceal transient TRUE.
    useLayoutEffect(() => {
      commits.push({ key: visitKey, active, settled: result.settled, transitionState: f.transition().dataset.deferredTransitionState, reserve: f.transition().style.minHeight })
    })
    return createElement(Transition, {
      isMobile: true, pending: !active, placeholder: createElement('div', { 'data-testid': 'actual-placeholder-leaf' }),
      reserveHeight: '100vh', runtimeFrameReady: result.settled, runtimeVisibilityReady: false,
      testID: 'measured-transition', children: createElement('div', { style: { height: 702 } }),
    })
  }
  const layout = (height: number) => ({ nativeEvent: { layout: { x: 0, y: 0, width: 390, height } } }) as Parameters<typeof currentLayout>[0]
  try {
    f.renderTree(createElement(RealSettleConsumer, { visitKey: 'old', active: true }))
    const oldLayout = currentLayout!
    const oldTimeout = timers.mock.calls.find(([, ms]) => ms === 6000)![0] as () => void
    act(() => { oldLayout(layout(702)); jest.advanceTimersByTime(320) })
    expect(commits.some(commit => commit.key === 'old' && commit.settled)).toBe(true)
    expect(f.transition().dataset.deferredTransitionState).toBe('runtime')
    act(() => oldLayout(layout(704)))
    const oldQuiet = timers.mock.calls.filter(([, ms]) => ms === 320).at(-1)![0] as () => void
    if (boundary === 'inactive then same key') {
      const start = commits.length
      f.renderTree(createElement(RealSettleConsumer, { visitKey: 'old', active: false }))
      expect(commits[start].settled).toBe(false)
      expect(commits[start].transitionState).toBe('placeholder')
    }
    const nextKey = boundary === 'new resetKey' ? 'new' : 'old'
    const first = commits.length
    f.renderTree(createElement(RealSettleConsumer, { visitKey: nextKey, active: true }))
    expect(commits[first]).toMatchObject({ key: nextKey, active: true, settled: false, transitionState: 'measuring-runtime', reserve: '100vh' })
    const newLayout = currentLayout!
    act(() => { newLayout(layout(702)); oldLayout(layout(999)); oldQuiet(); oldTimeout(); jest.advanceTimersByTime(319) })
    expect(f.transition().dataset.deferredTransitionState).toBe('measuring-runtime')
    expect(commits.slice(first).every(commit => !commit.settled)).toBe(true)
    act(() => jest.advanceTimersByTime(1))
    expect(f.transition().dataset.deferredTransitionState).toBe('runtime')
    expect(commits.at(-1)!.settled).toBe(true)
    // Stale delivery AFTER new readiness must not revoke or replace it either.
    act(() => { oldLayout(layout(1200)); oldQuiet(); oldTimeout(); jest.advanceTimersByTime(320) })
    expect(f.transition().dataset.deferredTransitionState).toBe('runtime')
    expect(commits.at(-1)!.settled).toBe(true)
  } finally {
    f.cleanup()
    timers.mockRestore()
    jest.useRealTimers()
  }
})

it('retains current-visit fail-open at6000ms without premature readiness from an old timeout', () => {
  jest.useFakeTimers()
  const timers = jest.spyOn(global, 'setTimeout')
  const f = fixture()
  const commits: Array<{ key: string; settled: boolean }> = []
  function RealSettleConsumer({ visitKey }: { visitKey: string }) {
    const result = useRuntimeSettle({ resetKey: visitKey, active: true })
    useLayoutEffect(() => { commits.push({ key: visitKey, settled: result.settled }) })
    return createElement(Transition, {
      isMobile: true, pending: false, placeholder: createElement('div'), reserveHeight: '100vh',
      runtimeFrameReady: result.settled, testID: 'measured-transition', children: createElement('div', { style: { height: 702 } }),
    })
  }
  try {
    f.renderTree(createElement(RealSettleConsumer, { visitKey: 'old' }))
    const oldTimeout = timers.mock.calls.find(([, ms]) => ms === 6000)![0] as () => void
    act(() => jest.advanceTimersByTime(6000))
    expect(commits.at(-1)).toEqual({ key: 'old', settled: true })
    const first = commits.length
    f.renderTree(createElement(RealSettleConsumer, { visitKey: 'new' }))
    expect(commits[first]).toEqual({ key: 'new', settled: false })
    act(() => { oldTimeout(); jest.advanceTimersByTime(5999) })
    expect(commits.slice(first).every(commit => !commit.settled)).toBe(true)
    act(() => jest.advanceTimersByTime(1))
    expect(commits.at(-1)).toEqual({ key: 'new', settled: true })
    act(() => oldTimeout())
    expect(commits.at(-1)).toEqual({ key: 'new', settled: true })
    expect(f.transition().dataset.deferredTransitionState).toBe('runtime')
  } finally {
    f.cleanup()
    timers.mockRestore()
    jest.useRealTimers()
  }
})

it.each(['native-handle', 'detached-DOM'] as const)('keeps actual renderer%s refs unmeasured without mutating style or observing them', kind => {
  const renderer = require('react-test-renderer') as typeof import('react-test-renderer')
  const ref = kind === 'native-handle' ? { nativeTag: 11 } : document.createElement('div')
  if (ref instanceof HTMLElement) ref.style.height = '41px'
  let tree: ReturnType<typeof renderer.create> | undefined
  const element = (ready: boolean) => createElement(Transition, {
    isMobile: true, pending: false, placeholder: createElement('div'), reserveHeight: '100vh',
    runtimeFrameReady: ready, runtimeVisibilityReady: true, testID: 'non-DOM-ref-boundary', children: createElement('div'),
  })
  try {
    act(() => { tree = renderer.create(element(false), { createNodeMock: () => ref }) })
    expect(tree!.root.findByProps({ 'data-testid': 'non-DOM-ref-boundary' }).props['data-deferred-transition-state']).toBe('measuring-runtime')
    act(() => { tree!.update(element(true)) })
    expect(tree!.root.findByProps({ 'data-testid': 'non-DOM-ref-boundary' }).props['data-deferred-transition-state']).toBe('measuring-runtime')
    expect(tree!.root.findByProps({ 'data-testid': 'non-DOM-ref-boundary' }).props['data-reserve-release-state']).toBe('reserved')
    expect(MeasuredResizeObserver.instances.some(observer => observer.targets.has(ref as Element))).toBe(false)
    if (ref instanceof HTMLElement) expect(ref.style.height).toBe('41px')
    else expect(ref).not.toHaveProperty('style')
  } finally { act(() => tree?.unmount()) }
})

it.each([false, true])('keeps native placeholder/children parity without DOM reserve/scroll correction (optional=%s)', optional => {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' })
  try {
    const f = fixture({ optional })
    f.render(false, true)
    expect(f.transition()).toBeNull()
    expect(f.owner.querySelector('[data-testid="actual-placeholder-leaf"]')).not.toBeNull()
    f.render(true, false, createElement('div', { 'data-testid': 'actual-runtime-leaf', style: { height: 702 } }), true)
    expect(f.transition()).toBeNull()
    expect(f.owner.querySelector('[data-testid="actual-runtime-leaf"]')).not.toBeNull()
    expect(f.owner.querySelector('[data-testid="actual-placeholder-leaf"]')).toBeNull()
    expect(f.writes).toHaveLength(0)
    f.cleanup()
  } finally {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' })
  }
})

it.each([
  ['description', 224, 379],
  ['popular', 125, 505],
] as const)('preserves the visible %s across an actual optional insertion and removal before paint', (section, height, anchorTop) => {
  const f = fixture({ optional: true, initialTop: 600, anchorTop })
  f.anchor.dataset.testid = `actual-${section}-frame`
  expect(f.transition().style.height).toBe('0px')
  expect(f.transition().dataset.deferredTransitionState).toBe('runtime')
  f.owner.scrollTop = 650
  f.writes.length = 0
  const before = f.anchor.getBoundingClientRect().top
  f.render(true, false, createElement('div', { style: { height, marginBottom: 32 } }))
  expect(f.transition().style.height).toBe(`${height + 32}px`)
  expect(f.anchor.getBoundingClientRect().top).toBe(before)
  expect(f.owner.scrollTop).toBe(650 + height + 32)
  f.render(true, false, null)
  expect(f.transition().style.height).toBe('0px')
  expect(f.anchor.getBoundingClientRect().top).toBe(before)
  expect(f.writes).toEqual([650 + height + 32, 650])
  f.cleanup()
})

it.each([false, true])('uses the existing real owner correction for optional growth/shrink (natural anchoring=%s)', naturalAnchor => {
  const f = fixture({ optional: true, initialTop: 600, naturalAnchor })
  const before = f.anchor.getBoundingClientRect().top
  f.render(true, false, createElement('div', { style: { height: 256 } }))
  expect(f.anchor.getBoundingClientRect().top).toBe(before)
  f.render(true, false, null)
  expect(f.anchor.getBoundingClientRect().top).toBe(before)
  expect(f.writes).toEqual(naturalAnchor ? [] : [856, 600])
  f.cleanup()
})

it.each([{ anchorTop: 900 }, { differentOwner: true }, { noScrollOwner: true }])('does not scroll for an optional frame without a visible same-owner anchor: %j', options => {
  const f = fixture({ optional: true, initialTop: 600, ...options })
  f.render(true, false, createElement('div', { style: { height: 256 } }))
  expect(f.transition().style.height).toBe('256px')
  expect(f.writes).toHaveLength(0)
  f.cleanup()
})

it('exposes an impossible optional shrink as clamped instead of claiming it was anchored', () => {
  const f = fixture({ optional: true, initialTop: 10 })
  f.render(true, false, createElement('div', { style: { height: 256 } }))
  f.owner.scrollTop = 10
  f.writes.length = 0
  const before = f.anchor.getBoundingClientRect().top
  f.render(true, false, null)
  expect(f.owner.scrollTop).toBe(0)
  expect(f.anchor.getBoundingClientRect().top).not.toBe(before)
  expect(f.transition().dataset.reserveReleaseState).toBe('clamped')
  f.cleanup()
})

it('fences optional resize callbacks from a previous pending visit', () => {
  const f = fixture({ optional: true, initialTop: 600 })
  const callbacks = f.currentCallbacks()
  const previousLayer = f.transition().querySelector('[data-testid="measured-transition-runtime"]')!
  f.render(false, true)
  act(() => { for (const callback of callbacks) callback([{ target: previousLayer } as ResizeObserverEntry], {} as ResizeObserver) })
  expect(f.transition().style.height).toBe('')
  expect(f.writes).toHaveLength(0)
  f.render(true, false, null)
  expect(f.transition().style.height).toBe('0px')
  f.cleanup()
})

it('renders optional content in ordinary flow when pre-paint resize observation is unavailable', () => {
  Object.defineProperty(window, 'ResizeObserver', { configurable: true, value: undefined })
  const f = fixture({ optional: true })
  try {
    f.render(true, false, createElement('div', { 'data-testid': 'actual-optional-content', style: { height: 256 } }))
    expect(f.transition().querySelector('[data-testid="actual-optional-content"]')).not.toBeNull()
    expect(f.transition().querySelector('[data-testid="measured-transition-runtime"]')).toBeNull()
    expect(f.transition().style.height).toBe('')
    expect(f.writes).toHaveLength(0)
    f.render(true, false, null)
    expect(f.transition().childElementCount).toBe(0)
  } finally {
    f.cleanup()
    Object.defineProperty(window, 'ResizeObserver', { configurable: true, value: MeasuredResizeObserver })
  }
})

it('clears a previous measured optional height when resize observation becomes unavailable', () => {
  const f = fixture({ optional: true })
  try {
    f.render(true, false, createElement('div', { style: { height: 256 } }))
    expect(f.transition().style.height).toBe('256px')
    const callbacks = f.currentCallbacks()
    const staleLayer = f.transition().querySelector('[data-testid="measured-transition-runtime"]')!
    Object.defineProperty(window, 'ResizeObserver', { configurable: true, value: undefined })
    f.render(true, false, createElement('div', { 'data-testid': 'fallback-optional-content', style: { height: 335 } }))
    act(() => { for (const callback of callbacks) callback([{ target: staleLayer } as ResizeObserverEntry], {} as ResizeObserver) })
    expect(f.transition().style.height).toBe('')
    expect(f.transition().querySelector('[data-testid="fallback-optional-content"]')).not.toBeNull()
    expect(f.transition().querySelector('[data-testid="measured-transition-runtime"]')).toBeNull()
  } finally {
    f.cleanup()
    Object.defineProperty(window, 'ResizeObserver', { configurable: true, value: MeasuredResizeObserver })
  }
})

it('reconciles a signed preceding-frame height change while its following map is visible', () => {
  const f = fixture({ optional: true, initialTop: 20400, anchorTop: 201.96875 })
  f.anchor.dataset.testid = 'actual-map-flow-frame'
  f.render(true, false, createElement('div', { style: { height: 480 } }))
  const before = f.anchor.getBoundingClientRect().top
  f.render(true, false, createElement('div', { style: { height: 335 } }))
  expect(f.anchor.getBoundingClientRect().top).toBe(before)
  expect(f.writes).toEqual([20880, 20735])
  f.cleanup()
})

it('keeps the optional server markup stable with and without browser resize observation', () => {
  const { renderToString } = require('react-dom/server.node') as typeof import('react-dom/server')
  const element = createElement(Transition, {
    isMobile: true, pending: false, placeholder: null, runtimeFrameReady: true,
    allowEmptyRuntime: true, testID: 'optional-server-boundary', children: null,
  })
  const withObserver = renderToString(element)
  Object.defineProperty(window, 'ResizeObserver', { configurable: true, value: undefined })
  try {
    expect(renderToString(element)).toBe(withObserver)
  } finally {
    Object.defineProperty(window, 'ResizeObserver', { configurable: true, value: MeasuredResizeObserver })
  }
})

it.each([
  [false, false, true], [true, false, true],
  [false, true, true], [true, true, true],
  [false, false, false], [true, false, false],
] as const)('preserves the original inner Popular anchor through nested measured parents (outer=%s, natural=%s, settled=%s)', (outer, natural, settled) => {
  const host = document.createElement('div')
  const owner = document.createElement('div')
  const mount = document.createElement('div')
  const comments = document.createElement('div')
  owner.style.overflowY = 'auto'
  owner.append(mount, comments)
  host.append(owner)
  document.body.append(host)
  let top = 600
  const writes: number[] = []
  const node = (id: string) => mount.querySelector<HTMLElement>(`[data-testid="${id}"]`)!
  const height = (id: string) => Math.max(Number.parseFloat(node(id)?.style.height || '0'), Number.parseFloat(node(id)?.style.minHeight || '0'))
  const flowHeight = () => height(outer ? 'nested-outer' : 'nested-sidebar')
  Object.defineProperties(owner, {
    clientHeight: { configurable: true, value: 790 },
    clientWidth: { configurable: true, value: 390 },
    scrollHeight: { configurable: true, get: () => 4000 + flowHeight() },
    scrollTop: { configurable: true, get: () => natural ? 600 + height('nested-navigation') : top, set: value => { top = value; writes.push(top) } },
  })
  owner.getBoundingClientRect = () => rect(54, 790)
  // Popular is inside the absolute sidebar runtime; Comments follows the
  // sidebar's independent normal-flow height. Each reads actual DOM styles.
  const originalRect = HTMLElement.prototype.getBoundingClientRect
  HTMLElement.prototype.getBoundingClientRect = function () {
    const shift = owner.scrollTop - 600
    switch (this.dataset.testid) {
      case 'nested-navigation-runtime': {
        const leaf = this.firstElementChild as HTMLElement
        return rect(0, Number.parseFloat(leaf.style.height) + Number.parseFloat(leaf.style.marginBottom || '0'))
      }
      case 'nested-sidebar-runtime': return rect(0, 822 + height('nested-navigation'))
      case 'nested-outer-runtime': return rect(0, height('nested-sidebar'))
      case 'nested-popular': return rect(505 + height('nested-navigation') - shift, 317)
      default: return originalRect.call(this)
    }
  }
  comments.getBoundingClientRect = () => rect(50 + flowHeight() - (owner.scrollTop - 600), 930)
  const root = createRoot(mount)
  const navigation = createElement(Transition, {
    isMobile: true, pending: false, placeholder: null, runtimeFrameReady: true,
    allowEmptyRuntime: true, testID: 'nested-navigation',
    children: createElement('div', { 'data-testid': 'nested-navigation-content', style: { height: 0 } }),
  })
  const sidebar = createElement(Transition, {
    isMobile: true, pending: false, placeholder: null, runtimeFrameReady: settled, runtimeVisibilityReady: true,
    reserveHeight: 822, testID: 'nested-sidebar',
    children: createElement('div', null, navigation, createElement('div', { 'data-testid': 'nested-popular' })),
  })
  const resize = (id: string) => {
    const layer = node(`${id}-runtime`)
    for (const observer of MeasuredResizeObserver.instances.filter(candidate => candidate.targets.has(layer))) {
      observer.callback([{ target: layer } as ResizeObserverEntry], observer as unknown as ResizeObserver)
    }
  }
  try {
    act(() => root.render(outer ? createElement(Transition, {
      isMobile: true, pending: false, placeholder: null, runtimeFrameReady: settled, runtimeVisibilityReady: true,
      reserveHeight: 822, testID: 'nested-outer', children: sidebar,
    }) : sidebar))
    writes.length = 0
    const before = node('nested-popular').getBoundingClientRect().top
    expect(before).toBe(505)
    expect(comments.getBoundingClientRect().top).toBe(872)
    act(() => {
      node('nested-navigation-content').style.height = '125px'
      node('nested-navigation-content').style.marginBottom = '32px'
      resize('nested-navigation')
    })
    // Ancestor flow must already be current before another ResizeObserver
    // delivery; otherwise Comments enters view and is compensated a second time.
    const immediateSidebarHeight = height('nested-sidebar')
    const immediateOuterHeight = outer ? height('nested-outer') : 979
    act(() => { resize('nested-sidebar'); if (outer) resize('nested-outer') })
    expect(node('nested-popular').getBoundingClientRect().top).toBe(before)
    expect(writes).toEqual(natural ? [] : [757])
    expect(immediateSidebarHeight).toBe(979)
    expect(immediateOuterHeight).toBe(979)
    act(() => {
      node('nested-navigation-content').style.height = '0px'
      node('nested-navigation-content').style.marginBottom = '0px'
      resize('nested-navigation')
    })
    expect(height('nested-sidebar')).toBe(822)
    if (outer) expect(height('nested-outer')).toBe(822)
    act(() => { resize('nested-sidebar'); if (outer) resize('nested-outer') })
    expect(node('nested-popular').getBoundingClientRect().top).toBe(before)
    expect(writes).toEqual(natural ? [] : [757, 600])
  } finally {
    act(() => root.unmount())
    host.remove()
    HTMLElement.prototype.getBoundingClientRect = originalRect
  }
})
