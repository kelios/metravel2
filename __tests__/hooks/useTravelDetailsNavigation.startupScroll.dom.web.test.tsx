import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { Platform } from 'react-native'

import { useTravelDetailsNavigation } from '@/hooks/useTravelDetailsNavigation'

jest.mock('react-native', () => ({
  Platform: { OS: 'web' },
  DeviceEventEmitter: { addListener: jest.fn(() => ({ remove: jest.fn() })) },
}))
jest.mock('@/hooks/useScrollNavigation', () => ({ useScrollNavigation: jest.fn() }))
jest.mock('@/hooks/useActiveSection', () => ({ useActiveSection: jest.fn() }))

const mockScrollNavigation = jest.requireMock('@/hooks/useScrollNavigation').useScrollNavigation as jest.Mock
const mockActiveSection = jest.requireMock('@/hooks/useActiveSection').useActiveSection as jest.Mock

// A mounted hook drives real DOM scrollTop and bubbling input events. JSDOM
// has no native wheel scrolling, so the fixture applies the resulting position
// explicitly. This proves the timer/input contract, not production causality.
describe('travel startup reset yields to the current reader', () => {
  let root: Root | null
  let host: HTMLDivElement
  let owner: HTMLDivElement
  let child: HTMLDivElement
  let available: boolean
  let latest: ReturnType<typeof useTravelDetailsNavigation>
  let initialScrollTo: jest.Mock
  let sectionScrollTo: jest.Mock
  let setActiveSection: jest.Mock
  let originalWindowScrollTo: typeof window.scrollTo
  let originalScrollingElement: PropertyDescriptor | undefined

  function Probe({ slug }: { slug: string }) {
    latest = useTravelDetailsNavigation({ headerOffset: 72, slug, startTransition: callback => callback() })
    return null
  }

  function mount(slug = 'minsk') {
    root = createRoot(host)
    act(() => { root!.render(createElement(Probe, { slug })) })
  }

  function tick(ms: number) {
    act(() => { jest.advanceTimersByTime(ms) })
  }

  function revealOwner() {
    available = true
    document.body.append(owner)
  }

  beforeEach(() => {
    jest.useFakeTimers()
    jest.clearAllMocks()
    ;(Platform as unknown as { OS: string }).OS = 'web'
    window.history.replaceState(null, '', '/travels/minsk')
    root = null
    host = document.createElement('div')
    document.body.append(host)
    owner = document.createElement('div')
    owner.dataset.testid = 'travel-details-scroll'
    owner.style.overflowY = 'auto'
    Object.defineProperties(owner, {
      scrollHeight: { configurable: true, value: 2400 },
      clientHeight: { configurable: true, value: 400 },
    })
    owner.getBoundingClientRect = () => ({ top: 54, bottom: 454, x: 0, y: 54, width: 390, height: 400 }) as DOMRect
    child = document.createElement('div')
    owner.append(child)
    owner.scrollTo = jest.fn((options: ScrollToOptions | number, y?: number) => {
      owner.scrollTop = typeof options === 'number' ? y ?? 0 : Number(options.top ?? (options as { y?: number }).y ?? 0)
    }) as typeof owner.scrollTo
    available = false
    originalWindowScrollTo = window.scrollTo
    window.scrollTo = jest.fn()
    originalScrollingElement = Object.getOwnPropertyDescriptor(document, 'scrollingElement')
    Object.defineProperty(document, 'scrollingElement', { configurable: true, value: document.documentElement })
    document.documentElement.scrollTop = 0
    initialScrollTo = jest.fn((options: { y: number }) => { if (available) owner.scrollTo({ top: options.y }) })
    sectionScrollTo = jest.fn(() => { if (available) owner.scrollTop = 600 })
    setActiveSection = jest.fn()
    mockScrollNavigation.mockReturnValue({
      anchors: { gallery: { current: null }, map: { current: null } },
      scrollTo: sectionScrollTo,
      scrollRef: { current: { scrollTo: initialScrollTo, getScrollableNode: () => available ? owner : null } },
    })
    mockActiveSection.mockReturnValue({ activeSection: 'gallery', setActiveSection })
  })

  afterEach(() => {
    if (root) act(() => { root!.unmount() })
    jest.clearAllTimers()
    jest.useRealTimers()
    host.remove()
    owner.remove()
    window.scrollTo = originalWindowScrollTo
    if (originalScrollingElement) Object.defineProperty(document, 'scrollingElement', originalScrollingElement)
    else delete (document as unknown as { scrollingElement?: Element }).scrollingElement
    window.history.replaceState(null, '', '/')
  })

  it.each(['wheel', 'touchstart', 'scroll-key'] as const)(
    'does not erase %s reader position with the remaining startup retries',
    intent => {
      revealOwner()
      mount()
      tick(100)
      expect(owner.scrollTop).toBe(0)
      act(() => {
        const event = intent === 'wheel'
          ? new WheelEvent('wheel', { bubbles: true, deltaY: 600 })
          : intent === 'touchstart'
            ? new Event('touchstart', { bubbles: true })
            : new KeyboardEvent('keydown', { bubbles: true, key: 'PageDown' })
        child.dispatchEvent(event)
        owner.scrollTop = 600
        owner.dispatchEvent(new Event('scroll', { bubbles: false }))
      })
      expect(owner.scrollTop).toBe(600)
      tick(300)
      expect(owner.scrollTop).toBe(600)
    },
  )

  it.each(['wheel', 'touchstart', 'scroll-key'] as const)(
    'cancels pending availability retries when a newly revealed owner receives %s',
    intent => {
      mount()
      tick(40)
      revealOwner()
      act(() => {
        const event = intent === 'wheel'
          ? new WheelEvent('wheel', { bubbles: true, deltaY: 600 })
          : intent === 'touchstart'
            ? new Event('touchstart', { bubbles: true })
            : new KeyboardEvent('keydown', { bubbles: true, key: 'PageDown' })
        child.dispatchEvent(event)
        owner.scrollTop = 600
      })
      tick(300)
      expect(owner.scrollTop).toBe(600)
    },
  )

  it('expires pending availability resets before an explicit late-owner section jump', () => {
    mount()
    tick(40)
    revealOwner()
    act(() => { latest.openSection('map') })
    tick(0)
    expect(owner.scrollTop).toBe(600)
    tick(56)
    expect(owner.scrollTop).toBe(600)
  })

  it.each(['editable-arrow', 'typing-key'] as const)('keeps startup availability reset for %s', intent => {
    mount()
    tick(40)
    revealOwner()
    owner.scrollTop = 240
    const input = document.createElement('input')
    owner.append(input)
    const target = intent === 'editable-arrow' ? input : child
    target.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: intent === 'editable-arrow' ? 'ArrowDown' : 'a' }))
    tick(100)
    expect(owner.scrollTop).toBe(0)
  })

  it('does not overwrite an explicit section jump at the next startup retry', () => {
    revealOwner()
    mount()
    tick(100)
    act(() => { latest.openSection('map') })
    tick(0)
    expect(sectionScrollTo).toHaveBeenCalledWith('map')
    expect(owner.scrollTop).toBe(600)
    tick(80)
    expect(owner.scrollTop).toBe(600)
  })

  it('keeps an explicit hash jump while pending startup timers run', () => {
    revealOwner()
    mount()
    tick(100)
    act(() => {
      window.history.replaceState(null, '', '/travels/minsk#map')
      window.dispatchEvent(new HashChangeEvent('hashchange'))
    })
    tick(0)
    tick(80)
    expect(sectionScrollTo).toHaveBeenCalledWith('map')
    expect(owner.scrollTop).toBe(600)
  })

  it('still resets a late owner before any reader interaction', () => {
    mount()
    tick(40)
    owner.scrollTop = 240
    revealOwner()
    tick(100)
    expect(owner.scrollTop).toBe(0)
    expect(owner.scrollTo).toHaveBeenCalled()
  })

  it('retries a found owner whose reset APIs fail until resetting it actually succeeds', () => {
    let readableTop = 240
    let writable = false
    Object.defineProperty(owner, 'scrollTop', {
      configurable: true,
      get: () => readableTop,
      set: value => {
        if (!writable) throw new Error('owner not ready for scroll writes')
        readableTop = Number(value)
      },
    })
    owner.scrollTo = jest.fn((options: ScrollToOptions) => {
      if (!writable) throw new Error('owner not ready for scroll calls')
      owner.scrollTop = Number(options.top ?? (options as { y?: number }).y ?? 0)
    }) as typeof owner.scrollTo
    revealOwner()
    mount()
    tick(40)
    expect(owner.scrollTop).toBe(240)
    writable = true
    tick(100)
    expect(owner.scrollTop).toBe(0)
    const callsAfterSuccess = (owner.scrollTo as jest.Mock).mock.calls.length
    tick(300)
    expect((owner.scrollTo as jest.Mock).mock.calls).toHaveLength(callsAfterSuccess)
  })

  it('does not let unrelated page wheel input cancel a late travel reset', () => {
    mount()
    tick(40)
    document.body.dispatchEvent(new WheelEvent('wheel', { bubbles: true, deltaY: 600 }))
    owner.scrollTop = 240
    revealOwner()
    tick(100)
    expect(owner.scrollTop).toBe(0)
  })

  it('releases reader-intent listeners when all owner-availability retries expire', () => {
    const removeListener = jest.spyOn(window, 'removeEventListener')
    try {
      mount()
      tick(319)
      for (const name of ['wheel', 'touchstart', 'keydown']) {
        expect(removeListener.mock.calls.some(([event]) => event === name)).toBe(false)
      }
      tick(1)
      for (const name of ['wheel', 'touchstart', 'keydown']) {
        expect(removeListener.mock.calls.some(([event, listener, capture]) => (
          event === name && typeof listener === 'function' && capture === true
        ))).toBe(true)
      }
      owner.scrollTop = 600
      revealOwner()
      tick(300)
      expect(owner.scrollTop).toBe(600)
      expect(owner.scrollTo).not.toHaveBeenCalled()
    } finally {
      removeListener.mockRestore()
    }
  })

  it('starts a new reset generation on another travel and then yields to its reader', () => {
    revealOwner()
    mount()
    tick(100)
    child.dispatchEvent(new WheelEvent('wheel', { bubbles: true, deltaY: 600 }))
    owner.scrollTop = 600
    act(() => { root!.render(createElement(Probe, { slug: 'krakow' })) })
    tick(100)
    expect(owner.scrollTop).toBe(0)
    child.dispatchEvent(new WheelEvent('wheel', { bubbles: true, deltaY: 800 }))
    owner.scrollTop = 800
    tick(300)
    expect(owner.scrollTop).toBe(800)
  })

  it('clears pending startup work when the hook unmounts', () => {
    revealOwner()
    mount()
    tick(100)
    act(() => { root!.unmount() })
    root = null
    owner.scrollTop = 600
    tick(300)
    expect(owner.scrollTop).toBe(600)
  })

  it.each(['android', 'ios'])('retains the single initial native reset on %s', platform => {
    ;(Platform as unknown as { OS: string }).OS = platform
    revealOwner()
    owner.scrollTop = 240
    mount()
    expect(initialScrollTo).toHaveBeenCalledTimes(1)
    expect(initialScrollTo).toHaveBeenCalledWith({ y: 0, animated: false })
    owner.scrollTop = 600
    tick(500)
    expect(owner.scrollTop).toBe(600)
    expect(initialScrollTo).toHaveBeenCalledTimes(1)
  })
})
