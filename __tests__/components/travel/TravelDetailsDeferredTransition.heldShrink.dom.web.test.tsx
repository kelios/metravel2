// #3430: Chrome scores a content move in a frame whose scroll steps also moved the
// owner by the size of the move, whatever compensation the same frame applies.
// On prod «Рядом» resolved empty (338 → 121 px) in such a frame while «Комментарии»
// were visible: the anchored shrink still counted 0.27 (Hexenstieg, 390×844).
// A shrink is published below the viewport, or under the anchor in a frame without
// an owner scroll; until then the occupied height is held.
import type { Root } from 'react-dom/client'

let createElement: typeof import('react').createElement
let act: typeof import('react').act
let createRoot: typeof import('react-dom/client').createRoot
let MeasuredFlow: typeof import('@/components/travel/details/TravelDetailsDeferredTransition').TravelDetailsMeasuredFlow

let observerCallback: (() => void) | null = null
class ControlledResizeObserver {
  constructor(callback: () => void) { observerCallback = callback }
  observe() {}
  unobserve() {}
  disconnect() {}
}

const OWNER_TOP = 54
const OWNER_HEIGHT = 790
const FULL = 1400
const EMPTY = FULL - 217

beforeAll(() => {
  Object.defineProperty(window, 'ResizeObserver', { configurable: true, value: ControlledResizeObserver })
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 })
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 844 })
  jest.resetModules()
  jest.doMock('react-native', () => jest.requireActual('react-native-web'))
  ;({ createElement, act } = require('react'))
  ;({ createRoot } = require('react-dom/client'))
  MeasuredFlow = require('@/components/travel/details/TravelDetailsDeferredTransition').TravelDetailsMeasuredFlow
})

const rect = (top: number, height: number) => ({
  top, bottom: top + height, left: 0, right: 390, width: 390, height, x: 0, y: top, toJSON: () => ({}),
}) as DOMRect

function nearAboveCommentsFixture(nearTop: number) {
  const host = document.createElement('div')
  const owner = document.createElement('div')
  const mount = document.createElement('div')
  const comments = document.createElement('div')
  owner.style.overflowY = 'auto'
  owner.append(mount, comments)
  host.append(owner)
  document.body.append(host)
  const initialTop = 44560
  let top = initialTop
  let runtimeHeight = FULL
  const writes: number[] = []
  const frames: FrameRequestCallback[] = []
  const transition = () => mount.querySelector<HTMLElement>('[data-testid="near-transition"]')!
  const transitionTop = () => nearTop - (top - initialTop)
  const flowHeight = () => Number.parseFloat(transition()?.style.height || '0')
  Object.defineProperties(owner, {
    clientHeight: { configurable: true, get: () => OWNER_HEIGHT },
    clientWidth: { configurable: true, get: () => 390 },
    scrollHeight: { configurable: true, get: () => 48000 + flowHeight() },
    scrollTop: { configurable: true, get: () => top, set: (value: number) => { top = value; writes.push(value) } },
  })
  owner.getBoundingClientRect = () => rect(OWNER_TOP, OWNER_HEIGHT)
  comments.getBoundingClientRect = () => rect(transitionTop() + flowHeight(), 844)
  const originalRect = HTMLElement.prototype.getBoundingClientRect
  HTMLElement.prototype.getBoundingClientRect = function () {
    if (this.dataset.testid === 'near-transition') return rect(transitionTop(), flowHeight())
    if (this.dataset.testid === 'near-transition-runtime') return rect(transitionTop(), runtimeHeight)
    return originalRect.call(this)
  }
  const originalFrame = window.requestAnimationFrame
  window.requestAnimationFrame = (callback: FrameRequestCallback) => frames.push(callback)
  let root: Root
  act(() => {
    root = createRoot(mount)
    root.render(createElement(MeasuredFlow, {
      isMobile: true, testID: 'near-transition', children: createElement('div', { style: { height: FULL } }),
    }))
  })
  // The reader stands at the step position after the first publication.
  top = initialTop
  writes.length = 0
  // The reader's step lands in this frame's scroll steps, before the resize.
  const resolveEmptyWhileScrolling = () => {
    Object.defineProperty(document, 'timeline', { configurable: true, value: { currentTime: performance.now() } })
    owner.dispatchEvent(new Event('scroll'))
    runtimeHeight = EMPTY
    act(() => observerCallback?.())
  }
  // The reader's step is written by a task earlier in this painted frame: its
  // scroll event comes only with the frame's scroll steps, after the resize.
  const resolveEmptyAfterPendingStep = () => {
    Object.defineProperty(document, 'timeline', { configurable: true, value: { currentTime: performance.now() } })
    top += 400
    runtimeHeight = EMPTY
    act(() => observerCallback?.())
  }
  // The shrink arrives with a React commit (a task) in a quiet frame: a later
  // task of the same frame may still scroll, so the commit cannot publish it.
  const resolveEmptyInCommit = () => {
    Object.defineProperty(document, 'timeline', { configurable: true, value: { currentTime: performance.now() } })
    runtimeHeight = EMPTY
    act(() => root.render(createElement(MeasuredFlow, {
      isMobile: true, testID: 'near-transition', children: createElement('div', { style: { height: EMPTY } }),
    })))
  }
  const quietFrame = () => act(() => {
    const pending = frames.splice(0)
    for (const callback of pending) callback(performance.now() + 1)
  })
  const cleanup = () => {
    act(() => root.unmount())
    host.remove()
    HTMLElement.prototype.getBoundingClientRect = originalRect
    window.requestAnimationFrame = originalFrame
    delete (document as { timeline?: unknown }).timeline
  }
  return { owner, comments, transition, writes, resolveEmptyWhileScrolling, resolveEmptyAfterPendingStep, resolveEmptyInCommit, quietFrame, cleanup, scrollTop: () => top }
}

it('holds a visible anchored shrink that arrives in a frame with an owner scroll', () => {
  const f = nearAboveCommentsFixture(400 - FULL)
  try {
    const before = f.comments.getBoundingClientRect().top
    f.resolveEmptyWhileScrolling()
    expect(f.transition().style.height).toBe(`${FULL}px`)
    expect(f.comments.getBoundingClientRect().top).toBe(before)
    expect(f.writes).toEqual([])
  } finally {
    f.cleanup()
  }
})

it('holds the shrink when a reader step is still pending in the painted frame', () => {
  const f = nearAboveCommentsFixture(400 - FULL + 400)
  try {
    f.resolveEmptyAfterPendingStep()
    expect(f.transition().style.height).toBe(`${FULL}px`)
    expect(f.writes).toEqual([])
  } finally {
    f.cleanup()
  }
})

it('defers an anchored shrink delivered by a React commit to the frame rendering steps', () => {
  const f = nearAboveCommentsFixture(400 - FULL)
  try {
    const before = f.comments.getBoundingClientRect().top
    f.resolveEmptyInCommit()
    expect(f.transition().style.height).toBe(`${FULL}px`)
    expect(f.writes).toEqual([])
    f.quietFrame()
    expect(f.transition().style.height).toBe(`${EMPTY}px`)
    expect(f.comments.getBoundingClientRect().top).toBe(before)
  } finally {
    f.cleanup()
  }
})

it('publishes the held shrink under the anchor in the next frame without an owner scroll', () => {
  const f = nearAboveCommentsFixture(400 - FULL)
  try {
    const before = f.comments.getBoundingClientRect().top
    f.resolveEmptyWhileScrolling()
    f.quietFrame()
    expect(f.transition().style.height).toBe(`${EMPTY}px`)
    expect(f.comments.getBoundingClientRect().top).toBe(before)
    expect(f.writes).toEqual([44560 - (FULL - EMPTY)])
  } finally {
    f.cleanup()
  }
})

it('publishes a shrink below the viewport at once: it moves nothing drawn', () => {
  const f = nearAboveCommentsFixture(OWNER_TOP + OWNER_HEIGHT - EMPTY + 100)
  try {
    f.resolveEmptyWhileScrolling()
    expect(f.transition().style.height).toBe(`${EMPTY}px`)
    expect(f.writes).toEqual([])
  } finally {
    f.cleanup()
  }
})

// Another section's release owns this painted frame: the held shrink waits for
// the claim to lapse, then lands under the anchor — not starved, not doubled.
it('retries a held shrink after another transition owned the release frame', () => {
  const f = nearAboveCommentsFixture(400 - FULL)
  try {
    const { claimOwnerRelease } = require('@/components/travel/details/travelDetailsDeferredGeometry')
    const before = f.comments.getBoundingClientRect().top
    expect(claimOwnerRelease(f.owner, document.createElement('div'))).toBe(true)
    f.resolveEmptyWhileScrolling()
    f.quietFrame()
    expect(f.transition().style.height).toBe(`${FULL}px`)
    f.quietFrame()
    expect(f.transition().style.height).toBe(`${FULL}px`)
    f.quietFrame()
    expect(f.transition().style.height).toBe(`${EMPTY}px`)
    expect(f.comments.getBoundingClientRect().top).toBe(before)
    expect(f.writes).toEqual([44560 - (FULL - EMPTY)])
  } finally {
    f.cleanup()
  }
})

// #3430: sidebar (−1365 px) and comments (−163 px) released in one painted frame
// at the page end; the browser clamped the scroll by their sum and Chrome scored
// the comments by the difference (0.148 on 390). One transition per frame.
it('lets one transition own the releases of a painted frame', async () => {
  const { claimOwnerRelease } = require('@/components/travel/details/travelDetailsDeferredGeometry')
  const owner = document.createElement('div')
  const sidebar = document.createElement('div')
  const comments = document.createElement('div')
  expect(claimOwnerRelease(owner, sidebar)).toBe(true)
  expect(claimOwnerRelease(owner, sidebar)).toBe(true)
  expect(claimOwnerRelease(owner, comments)).toBe(false)
  await new Promise((resolve) => setTimeout(resolve, 80))
  expect(claimOwnerRelease(owner, comments)).toBe(true)
})

// #3430: the sidebar placeholder (2368 px, «Похожие» included) is held while the
// early runtime is short (981 px). That held part is occupied height, not
// reserve slack: once «Похожие» arrive (runtime 2368) the flow stayed 2368 +
// 1387 = 3755 px and pushed the footer out of view on 390 (CLS 0.90).
it('does not count a held placeholder as conserved reserve slack', () => {
  const { TravelDetailsDeferredTransition: Transition } = require('@/components/travel/details/TravelDetailsDeferredTransition')
  const PLACEHOLDER = 2368
  const host = document.createElement('div')
  const owner = document.createElement('div')
  const mount = document.createElement('div')
  const following = document.createElement('div')
  owner.style.overflowY = 'auto'
  owner.append(mount, following)
  host.append(owner)
  document.body.append(host)
  let runtimeHeight = 981
  const transition = () => mount.querySelector<HTMLElement>('[data-testid="sidebar-transition"]')!
  const flowHeight = () => Number.parseFloat(transition()?.style.height || '0') || PLACEHOLDER
  Object.defineProperties(owner, {
    clientHeight: { configurable: true, get: () => OWNER_HEIGHT },
    clientWidth: { configurable: true, get: () => 390 },
    scrollHeight: { configurable: true, get: () => 50000 },
    scrollTop: { configurable: true, get: () => 45987, set: () => {} },
  })
  owner.getBoundingClientRect = () => rect(OWNER_TOP, OWNER_HEIGHT)
  following.getBoundingClientRect = () => rect(-2123 + flowHeight(), 844)
  const originalRect = HTMLElement.prototype.getBoundingClientRect
  HTMLElement.prototype.getBoundingClientRect = function () {
    if (this.dataset.testid === 'sidebar-transition') return rect(-2123, flowHeight())
    if (this.dataset.testid === 'sidebar-transition-runtime') return rect(-2123, runtimeHeight)
    if (this.dataset.testid === 'sidebar-transition-placeholder') return rect(-2123, PLACEHOLDER)
    return originalRect.call(this)
  }
  let root: Root
  const render = () => act(() => {
    root ??= createRoot(mount)
    root.render(createElement(Transition, {
      isMobile: true, pending: false, placeholder: createElement('div', { style: { height: PLACEHOLDER } }),
      reserveHeight: '100vh', runtimeFrameReady: false, runtimeVisibilityReady: true,
      testID: 'sidebar-transition', children: createElement('div', { style: { height: runtimeHeight } }),
    }))
  })
  try {
    render()
    expect(transition().style.height).toBe(`${PLACEHOLDER}px`)
    runtimeHeight = PLACEHOLDER
    act(() => observerCallback?.())
    expect(transition().style.height).toBe(`${PLACEHOLDER}px`)
  } finally {
    act(() => root.unmount())
    host.remove()
    HTMLElement.prototype.getBoundingClientRect = originalRect
  }
})
