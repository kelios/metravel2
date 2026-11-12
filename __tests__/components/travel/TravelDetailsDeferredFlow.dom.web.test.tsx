import type { Root } from 'react-dom/client'

let React: typeof import('react')
let createRoot: typeof import('react-dom/client').createRoot
let Transition: typeof import('@/components/travel/details/TravelDetailsDeferredTransition').TravelDetailsDeferredTransition
let MeasuredFlow: typeof import('@/components/travel/details/TravelDetailsDeferredTransition').TravelDetailsMeasuredFlow
let Platform: typeof import('react-native').Platform

class FrameObserver {
  static instances: FrameObserver[] = []
  targets = new Set<Element>()
  constructor(readonly callback: ResizeObserverCallback) { FrameObserver.instances.push(this) }
  observe(target: Element) { this.targets.add(target) }
  unobserve(target: Element) { this.targets.delete(target) }
  disconnect() { this.targets.clear() }
}

beforeAll(() => {
  jest.resetModules()
  jest.doMock('react-native', () => jest.requireActual('react-native-web'))
  React = require('react')
  ;({ createRoot } = require('react-dom/client'))
  ;({ TravelDetailsDeferredTransition: Transition, TravelDetailsMeasuredFlow: MeasuredFlow } = require('@/components/travel/details/TravelDetailsDeferredTransition'))
  ;({ Platform } = require('react-native'))
  Object.defineProperty(window, 'ResizeObserver', { configurable: true, value: FrameObserver })
})

const bounds = (top: number, height: number) => ({ top, bottom: top + height, left: 0, right: 390, width: 390, height, x: 0, y: top, toJSON: () => ({}) }) as DOMRect

// DOM lifecycle + independent flow model: intrinsic child changes cannot move a
// sibling until the measured leaf commits its normal-flow height. Both absolute
// ancestor and leaf must commit before the single scroll correction.
function measuredFlow(initialHeight: number, natural: boolean, initialTop = 1000) {
  const host = document.createElement('div')
  const owner = document.createElement('div')
  const mount = document.createElement('div')
  owner.style.overflowY = 'auto'
  owner.append(mount)
  host.append(owner)
  document.body.append(host)
  let raw = initialHeight, top = initialTop, root: Root
  let pending: boolean | undefined
  const writes: number[] = []
  const node = (id: string) => mount.querySelector<HTMLElement>(`[data-testid="flow-${id}"]`)!
  const height = (id: string) => Number.parseFloat(node(id)?.style.height || '0')
  Object.defineProperties(owner, {
    clientHeight: { value: 790 }, clientWidth: { value: 390 },
    scrollHeight: { get: () => 10000 + height('outer') },
    scrollTop: {
      get: () => natural && initialTop > 0 ? initialTop + height('leaf') - initialHeight : top,
      set: value => { top = value; writes.push(value) },
    },
  })
  owner.getBoundingClientRect = () => bounds(54, 790)
  const originalRect = HTMLElement.prototype.getBoundingClientRect
  HTMLElement.prototype.getBoundingClientRect = function () {
    switch (this.dataset.testid) {
      case 'flow-leaf-runtime': return bounds(0, raw)
      case 'flow-outer-runtime': return bounds(0, height('leaf') + 900)
      case 'flow-following': return bounds(200 + height('leaf') - initialHeight - (owner.scrollTop - initialTop), 900)
      default: return originalRect.call(this)
    }
  }
  const tree = () => React.createElement(Transition, {
    testID: 'flow-outer', isMobile: true, pending: false, placeholder: null, runtimeFrameReady: true,
    children: React.createElement('div', null,
      React.createElement(MeasuredFlow, {
        testID: 'flow-leaf', isMobile: true, pending,
        placeholder: React.createElement('div', { 'data-testid': 'flow-placeholder' }),
        children: React.createElement('div', { style: { height: raw } }),
      }),
      React.createElement('section', { 'data-testid': 'flow-following' }),
    ),
  })
  React.act(() => { root = createRoot(mount); root.render(tree()) })
  top = initialTop
  writes.length = 0
  const resize = (id: string) => {
    const runtime = node(`${id}-runtime`)
    for (const observer of FrameObserver.instances.filter(candidate => candidate.targets.has(runtime))) {
      observer.callback([{ target: runtime } as ResizeObserverEntry], observer as unknown as ResizeObserver)
    }
  }
  return {
    node, height, owner, writes,
    resize: (next: number) => React.act(() => { raw = next; resize('leaf'); resize('outer') }),
    pending: (next: boolean) => React.act(() => { pending = next; root.render(tree()) }),
    cleanup: () => { React.act(() => root.unmount()); host.remove(); HTMLElement.prototype.getBoundingClientRect = originalRect },
  }
}

it.each([false, true])('preserves a visible following frame for map-slot growth/shrink with one transaction (natural=%s)', natural => {
  const f = measuredFlow(692, natural)
  try {
    const before = f.node('following').getBoundingClientRect().top
    for (const next of [1402, 1203.3125]) {
      f.writes.length = 0
      f.resize(next)
      expect(f.node('following').getBoundingClientRect().top).toBe(before)
      expect(f.height('outer')).toBe(next + 900)
      expect(f.writes).toHaveLength(natural ? 0 : 1)
      expect(f.owner.scrollTop).toBe(1000 + next - 692)
      f.resize(next)
      expect(f.writes).toHaveLength(natural ? 0 : 1)
    }
  } finally { f.cleanup() }
})

it('releases Nearby loading height for compact empty and zero frames without a blank reserve', () => {
  const f = measuredFlow(402, false)
  try {
    const before = f.node('following').getBoundingClientRect().top
    for (const next of [185, 0, 402]) {
      f.writes.length = 0
      f.resize(next)
      expect(f.node('following').getBoundingClientRect().top).toBe(before)
      expect(f.height('leaf')).toBe(next)
      expect(f.node('leaf').dataset.deferredTransitionState).toBe('runtime')
      expect(f.node('leaf').style.minHeight).toBe('')
      expect(f.writes).toHaveLength(1)
    }
  } finally { f.cleanup() }
})

it('keeps the article start at zero while an upstream child grows', () => {
  const f = measuredFlow(692, false, 0)
  try {
    f.resize(1402)
    expect(f.owner.scrollTop).toBe(0)
    expect(f.writes).toEqual([])
  } finally { f.cleanup() }
})

it('forwards a pending placeholder and resolves a zero frame without caller readiness flags', () => {
  const f = measuredFlow(0, false)
  try {
    f.pending(true)
    expect(f.node('leaf').dataset.deferredTransitionState).toBe('placeholder')
    expect(f.node('leaf-runtime')).toBeNull()
    expect(f.node('leaf').querySelector('[data-testid="flow-placeholder"]')).not.toBeNull()
    f.pending(false)
    expect(f.node('leaf').dataset.deferredTransitionState).toBe('runtime')
    expect(f.height('leaf')).toBe(0)
    expect(f.node('leaf').querySelector('[data-testid="flow-placeholder"]')).toBeNull()
  } finally { f.cleanup() }
})

it.each(['ios', 'android'] as const)('keeps the configured flow transparent on %s', platform => {
  const previous = Platform.OS
  Object.defineProperty(Platform, 'OS', { configurable: true, value: platform })
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  try {
    React.act(() => root.render(React.createElement(MeasuredFlow, {
      testID: 'native-flow', isMobile: true,
      children: React.createElement('span', { 'data-testid': 'native-content' }),
    })))
    expect(host.childElementCount).toBe(1)
    expect(host.firstElementChild?.getAttribute('data-testid')).toBe('native-content')
    expect(host.querySelector('[data-testid="native-flow"]')).toBeNull()
  } finally {
    React.act(() => root.unmount())
    host.remove()
    Object.defineProperty(Platform, 'OS', { configurable: true, value: previous })
  }
})
