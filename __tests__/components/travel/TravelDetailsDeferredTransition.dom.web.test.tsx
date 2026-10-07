import type { Root } from 'react-dom/client'
import type { ReactNode } from 'react'

let createElement: typeof import('react').createElement
let act: typeof import('react').act
let createRoot: typeof import('react-dom/client').createRoot
let Transition: typeof import('@/components/travel/details/TravelDetailsDeferredTransition').TravelDetailsDeferredTransition
let Platform: typeof import('react-native').Platform

beforeAll(() => {
  jest.resetModules()
  jest.doMock('react-native', () => jest.requireActual('react-native-web'))
  // Deferred content leaves only: the actual transition/layout effects render.
  jest.doMock('@/components/travel/TravelDetailSkeletons', () => ({
    AuthorSectionSkeleton: () => null, CommentsSkeleton: () => null,
    FooterSectionSkeleton: () => null, MapSectionSkeleton: () => null,
    RatingSectionSkeleton: () => null, SidebarSectionSkeleton: () => null,
  }))
  ;({ createElement, act } = require('react'))
  ;({ createRoot } = require('react-dom/client'))
  ;({ Platform } = require('react-native'))
  Transition = require('@/components/travel/details/TravelDetailsDeferredTransition').TravelDetailsDeferredTransition
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
  document.body.append(host)
  let top = initialTop
  let root: Root
  const writes: number[] = []
  const transition = () => mount.querySelector<HTMLElement>('[data-testid="measured-transition"]')!
  const released = () => !!transition() && transition().style.minHeight !== '100vh'
  // Genuine DOM lifecycle + an independent browser geometry/clamp model.
  // React changes the real reserve style; measurements follow that style,
  // rather than injecting a fabricated ready callback into the product hook.
  Object.defineProperties(owner, {
    clientHeight: { configurable: true, get: () => ownerHeight },
    clientWidth: { configurable: true, get: () => 390 },
    scrollHeight: { configurable: true, get: () => (released() ? 26706 : 26848) + ownerHeight },
    scrollTop: {
      configurable: true,
      get: () => {
        const max = released() ? 26706 : 26848
        if (released() && options.naturalAnchor) top = Math.min(top, initialTop - 142)
        top = Math.max(0, Math.min(max, top))
        return top
      },
      set: value => { top = Math.max(0, Math.min(owner.scrollHeight - ownerHeight, value)); writes.push(top) },
    },
  })
  owner.getBoundingClientRect = () => rect(ownerTop, ownerHeight)
  anchor.getBoundingClientRect = () => rect(anchorTop + initialTop - owner.scrollTop - (released() ? 142 : 0), options.anchorHeight ?? 930)
  if (options.disconnectedAfterRelease) Object.defineProperty(anchor, 'isConnected', { configurable: true, get: () => !released() })
  const render = (ready: boolean, pending = false, child: ReactNode = createElement('div', { 'data-testid': 'actual-runtime-leaf' })) => {
    act(() => {
      root ??= createRoot(mount)
      root.render(createElement(Transition, { isMobile: true, pending, placeholder: createElement('div', { 'data-testid': 'actual-placeholder-leaf' }), reserveHeight: '100vh', runtimeFrameReady: ready, testID: 'measured-transition', children: child }))
    })
  }
  render(false)
  return { owner, anchor, writes, render, transition, cleanup: () => { act(() => root.unmount()); host.remove() } }
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
  f.render(true, false, createElement('div', { 'data-testid': `actual-${state}-frame` }))
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

it('keeps native placeholder/children parity without DOM reserve/scroll correction', () => {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' })
  try {
    const f = fixture()
    f.render(false, true)
    expect(f.transition()).toBeNull()
    expect(f.owner.querySelector('[data-testid="actual-placeholder-leaf"]')).not.toBeNull()
    f.render(true)
    expect(f.transition()).toBeNull()
    expect(f.owner.querySelector('[data-testid="actual-runtime-leaf"]')).not.toBeNull()
    expect(f.owner.querySelector('[data-testid="actual-placeholder-leaf"]')).toBeNull()
    expect(f.writes).toHaveLength(0)
    f.cleanup()
  } finally {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' })
  }
})
