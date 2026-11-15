// #3430: на desktop видимая часть владельца прокрутки (620 px между шапкой и
// нижней панелью) короче резерва `100vh` (800 px). Комментарии в резерве
// закрывают её целиком, футер стоит сразу под ней, и якоря для компенсации нет.
// Снятие резерва в этот момент втягивало футер в экран на величину пустого
// хвоста (прод, Tour du Mont Blanc 1280×800: CLS 0.078, источник
// travel-details-footer-resolved-frame y0→368). Геометрия — с прода.
import type { Root } from 'react-dom/client'

let createElement: typeof import('react').createElement
let act: typeof import('react').act
let createRoot: typeof import('react-dom/client').createRoot
let Transition: typeof import('@/components/travel/details/TravelDetailsDeferredTransition').TravelDetailsDeferredTransition

class NoopResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

const OWNER_TOP = 78
const OWNER_HEIGHT = 620
const RESERVE = 800
const RUNTIME = 459
const COMMENTS_TOP = -91
const FOOTER_HEIGHT = 987

beforeAll(() => {
  Object.defineProperty(window, 'ResizeObserver', { configurable: true, value: NoopResizeObserver })
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1280 })
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 })
  jest.resetModules()
  jest.doMock('react-native', () => jest.requireActual('react-native-web'))
  ;({ createElement, act } = require('react'))
  ;({ createRoot } = require('react-dom/client'))
  Transition = require('@/components/travel/details/TravelDetailsDeferredTransition').TravelDetailsDeferredTransition
})

const rect = (top: number, height: number) => ({
  top, bottom: top + height, left: 0, right: 900, width: 900, height, x: 0, y: top, toJSON: () => ({}),
}) as DOMRect

function commentsAboveFooterFixture() {
  const host = document.createElement('div')
  const owner = document.createElement('div')
  const mount = document.createElement('div')
  const footer = document.createElement('div')
  owner.style.overflowY = 'auto'
  owner.append(mount, footer)
  host.append(owner)
  document.body.append(host)
  const initialTop = 86222
  let top = initialTop
  const writes: number[] = []
  const transition = () => mount.querySelector<HTMLElement>('[data-testid="comments-transition"]')!
  const reserved = () => transition().style.minHeight === '100vh'
  const transitionTop = () => COMMENTS_TOP - (top - initialTop)
  const transitionHeight = () => (reserved() ? RESERVE : RUNTIME)
  Object.defineProperties(owner, {
    clientHeight: { configurable: true, get: () => OWNER_HEIGHT },
    clientWidth: { configurable: true, get: () => 900 },
    scrollHeight: { configurable: true, get: () => 88052 - (reserved() ? 0 : RESERVE - RUNTIME) },
    scrollTop: { configurable: true, get: () => top, set: (value: number) => { top = value; writes.push(value) } },
  })
  owner.getBoundingClientRect = () => rect(OWNER_TOP, OWNER_HEIGHT)
  footer.getBoundingClientRect = () => rect(transitionTop() + transitionHeight(), FOOTER_HEIGHT)
  const originalRect = HTMLElement.prototype.getBoundingClientRect
  HTMLElement.prototype.getBoundingClientRect = function () {
    if (this.dataset.testid === 'comments-transition') return rect(transitionTop(), transitionHeight())
    if (this.dataset.testid === 'comments-transition-runtime') return rect(transitionTop(), RUNTIME)
    return originalRect.call(this)
  }
  let root: Root
  const render = (ready: boolean) => act(() => {
    root ??= createRoot(mount)
    root.render(createElement(Transition, {
      isMobile: false, pending: false, placeholder: null, reserveHeight: '100vh', runtimeFrameReady: ready,
      testID: 'comments-transition', children: createElement('div', { style: { height: RUNTIME } }),
    }))
  })
  // The reader scrolls, then pauses longer than the release scroll-quiet window.
  const scrollBy = async (delta: number) => {
    top += delta
    await act(async () => {
      owner.dispatchEvent(new Event('scroll'))
      await new Promise((resolve) => setTimeout(resolve, 200))
    })
  }
  const cleanup = () => {
    act(() => root.unmount())
    host.remove()
    HTMLElement.prototype.getBoundingClientRect = originalRect
  }
  return { owner, footer, transition, writes, render, scrollBy, cleanup }
}

it('не втягивает футер в экран, пока пустой хвост резерва виден и якоря нет', async () => {
  const f = commentsAboveFooterFixture()
  try {
    f.render(false)
    const footerTop = f.footer.getBoundingClientRect().top
    expect(footerTop).toBeGreaterThan(OWNER_TOP + OWNER_HEIGHT)

    f.render(true)

    expect(f.transition().dataset.deferredTransitionState).toBe('runtime')
    expect(f.transition().style.minHeight).toBe('100vh')
    expect(f.transition().dataset.reserveReleaseState).toBe('reserved')
    expect(f.footer.getBoundingClientRect().top).toBe(footerTop)
    expect(f.writes).toEqual([])
  } finally {
    f.cleanup()
  }
})

it('снимает резерв, когда прокрутка показала футер, и держит его на месте', async () => {
  const f = commentsAboveFooterFixture()
  try {
    f.render(false)
    f.render(true)
    await f.scrollBy(RESERVE)
    // Прокрутка унесла хвост резерва выше экрана, футер виден и стал якорем.
    expect(f.transition().style.minHeight).toBe('')
    expect(f.transition().dataset.reserveReleaseState).toBe('anchored')
    expect(f.footer.getBoundingClientRect().top).toBe(COMMENTS_TOP - RESERVE + RESERVE)
    expect(f.writes).toEqual([86222 + RESERVE - (RESERVE - RUNTIME)])
  } finally {
    f.cleanup()
  }
})

// #3430: the release was a React commit — a task — and a later task of the same
// frame could still scroll (TMB 1280: a probe step after the comments release,
// CLS 0.117). Where frames are known, it lands in a quiet animation frame.
it('releases the reserve in an animation frame, not in the commit that decided it', async () => {
  const frames: FrameRequestCallback[] = []
  const originalFrame = window.requestAnimationFrame
  window.requestAnimationFrame = (callback: FrameRequestCallback) => frames.push(callback)
  Object.defineProperty(document, 'timeline', { configurable: true, value: { currentTime: performance.now() } })
  const f = commentsAboveFooterFixture()
  const flushFrame = () => act(() => {
    const pending = frames.splice(0)
    for (const callback of pending) callback(performance.now() + 1)
  })
  try {
    f.render(false)
    f.render(true)
    await f.scrollBy(RESERVE)
    flushFrame()
    expect(f.writes).toEqual([])
    expect(f.transition().dataset.reserveReleaseState).toBe('reserved')
    flushFrame()
    expect(f.transition().dataset.reserveReleaseState).toBe('anchored')
    expect(f.footer.getBoundingClientRect().top).toBe(COMMENTS_TOP)
    expect(f.writes).toEqual([86222 + RESERVE - (RESERVE - RUNTIME)])
  } finally {
    f.cleanup()
    window.requestAnimationFrame = originalFrame
    delete (document as { timeline?: unknown }).timeline
  }
})

// #3430: growth inside the reserve conserves its slack in the flow height. The
// release frame must drop that slack too; otherwise minHeight alone moves nothing
// and the slack leaves in the following React commit — a task again.
it('drops conserved reserve slack in the release frame, not in the following commit', () => {
  let observe: (() => void) | null = null
  Object.defineProperty(window, 'ResizeObserver', { configurable: true, value: class {
    constructor(callback: () => void) { observe = callback }
    observe() {}
    unobserve() {}
    disconnect() {}
  } })
  const frames: FrameRequestCallback[] = []
  const originalFrame = window.requestAnimationFrame
  window.requestAnimationFrame = (callback: FrameRequestCallback) => frames.push(callback)
  Object.defineProperty(document, 'timeline', { configurable: true, value: { currentTime: performance.now() } })
  const host = document.createElement('div')
  const owner = document.createElement('div')
  const mount = document.createElement('div')
  const footer = document.createElement('div')
  owner.style.overflowY = 'auto'
  owner.append(mount, footer)
  host.append(owner)
  document.body.append(host)
  const initialTop = 86222
  let top = initialTop
  let runtimeHeight = 300
  const writes: Array<[number, string | undefined]> = []
  const transition = () => mount.querySelector<HTMLElement>('[data-testid="comments-transition"]')!
  const transitionTop = () => -600 - (top - initialTop)
  const transitionHeight = () => Math.max(transition().style.minHeight === '100vh' ? RESERVE : 0, Number.parseFloat(transition().style.height || '0'))
  Object.defineProperties(owner, {
    clientHeight: { configurable: true, get: () => OWNER_HEIGHT },
    clientWidth: { configurable: true, get: () => 900 },
    scrollHeight: { configurable: true, get: () => 90000 },
    scrollTop: { configurable: true, get: () => top, set: (value: number) => { top = value; writes.push([value, transition().dataset.reserveReleaseState]) } },
  })
  owner.getBoundingClientRect = () => rect(OWNER_TOP, OWNER_HEIGHT)
  footer.getBoundingClientRect = () => rect(transitionTop() + transitionHeight(), FOOTER_HEIGHT)
  const originalRect = HTMLElement.prototype.getBoundingClientRect
  HTMLElement.prototype.getBoundingClientRect = function () {
    if (this.dataset.testid === 'comments-transition') return rect(transitionTop(), transitionHeight())
    if (this.dataset.testid === 'comments-transition-runtime') return rect(transitionTop(), runtimeHeight)
    return originalRect.call(this)
  }
  let root: Root | undefined
  const render = (ready: boolean) => act(() => {
    root ??= createRoot(mount)
    root.render(createElement(Transition, {
      isMobile: false, pending: false, placeholder: null, reserveHeight: '100vh', runtimeFrameReady: ready, runtimeVisibilityReady: true,
      testID: 'comments-transition', children: createElement('div', { style: { height: runtimeHeight } }),
    }))
  })
  try {
    render(false)
    runtimeHeight = RUNTIME
    act(() => observe?.())
    const slack = RESERVE - 300
    expect(transition().style.height).toBe(`${RUNTIME + slack}px`)
    render(true)
    const footerTop = footer.getBoundingClientRect().top
    const releaseTop = top
    writes.length = 0
    act(() => {
      const pending = frames.splice(0)
      for (const callback of pending) callback(performance.now() + 1)
    })
    expect(transition().style.height).toBe(`${RUNTIME}px`)
    expect(footer.getBoundingClientRect().top).toBe(footerTop)
    expect(writes).toEqual([[releaseTop - slack, 'reserved']])
  } finally {
    act(() => root?.unmount())
    host.remove()
    HTMLElement.prototype.getBoundingClientRect = originalRect
    window.requestAnimationFrame = originalFrame
    delete (document as { timeline?: unknown }).timeline
    Object.defineProperty(window, 'ResizeObserver', { configurable: true, value: NoopResizeObserver })
  }
})

// #3430: the commit decides, the animation frame releases. A reader scroll in
// between can carry the empty reserve tail into view with no following frame:
// the release must be decided again, not pull the footer into the viewport.
it('re-decides a release postponed by a scrolled frame before dropping the reserve', async () => {
  const frames: FrameRequestCallback[] = []
  const originalFrame = window.requestAnimationFrame
  window.requestAnimationFrame = (callback: FrameRequestCallback) => frames.push(callback)
  Object.defineProperty(document, 'timeline', { configurable: true, value: { currentTime: performance.now() } })
  const f = commentsAboveFooterFixture()
  const flushFrame = (frameTime = performance.now() + 1) => act(() => {
    const pending = frames.splice(0)
    for (const callback of pending) callback(frameTime)
  })
  try {
    f.render(false)
    // Runtime visible, reserve tail below the viewport: the commit decides to release.
    await f.scrollBy(-391)
    f.render(true)
    // The reader steps in the frame of the release callback.
    await f.scrollBy(400)
    const footerTop = f.footer.getBoundingClientRect().top
    expect(footerTop).toBeGreaterThan(OWNER_TOP + OWNER_HEIGHT - 1)
    flushFrame(0)
    flushFrame()
    expect(f.transition().dataset.reserveReleaseState).toBe('reserved')
    expect(f.footer.getBoundingClientRect().top).toBe(footerTop)
    // A further step shows the footer: it anchors the usual release.
    await f.scrollBy(400)
    const anchoredTop = f.footer.getBoundingClientRect().top
    flushFrame()
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 150)) })
    flushFrame()
    expect(f.transition().dataset.reserveReleaseState).toBe('anchored')
    expect(f.footer.getBoundingClientRect().top).toBe(anchoredTop)
  } finally {
    f.cleanup()
    window.requestAnimationFrame = originalFrame
    delete (document as { timeline?: unknown }).timeline
  }
})
