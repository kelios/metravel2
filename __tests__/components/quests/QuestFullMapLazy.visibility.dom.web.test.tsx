import type React from 'react'
import type { Root } from 'react-dom/client'

type Props = { steps: Array<{ lat: number; lng: number }>; height?: number; deferUntilVisible?: boolean; activeStepIndex?: number }
type Observed = { callback: IntersectionObserverCallback; options?: IntersectionObserverInit; observe: jest.Mock; disconnect: jest.Mock }
let act: typeof import('react').act
let createElement: typeof import('react').createElement
let createRoot: typeof import('react-dom/client').createRoot
let Map: React.ComponentType<Props>
const mockMapRender = jest.fn()
const mockMapMount = jest.fn()
const mockMapUnmount = jest.fn()
const observers: Observed[] = []
const originalObserver = window.IntersectionObserver

beforeAll(() => {
  jest.resetModules()
  jest.doMock('react-native', () => jest.requireActual('react-native-web'))
  jest.doMock('@/hooks/useTheme', () => ({ useThemedColors: () => ({ backgroundSecondary: '#eee' }) }))
  jest.doMock('@/components/quests/QuestFullMap', () => ({
    __esModule: true,
    default: function StatefulMap(props: Props) {
      const React = require('react')
      const [fullscreen, setFullscreen] = React.useState(false)
      const [exportOpen, setExportOpen] = React.useState(false)
      React.useEffect(() => { mockMapMount(); return () => mockMapUnmount() }, [])
      mockMapRender(props)
      return React.createElement('div', { 'data-testid': 'map-renderer', style: { height: props.height },
        'data-fullscreen': fullscreen, 'data-export-open': exportOpen },
      React.createElement('button', { 'data-testid': 'fullscreen', onClick: () => setFullscreen(true) }),
      React.createElement('button', { 'data-testid': 'export', onClick: () => setExportOpen(true) }))
    },
  }))
  ;({ act, createElement } = require('react'))
  ;({ createRoot } = require('react-dom/client'))
  Map = require('@/components/quests/QuestFullMapLazy.tsx').default
})

describe('#3440 map visibility with the real hook and RNW DOM', () => {
  let container: HTMLDivElement
  let root: Root
  const render = async (props: Partial<Props> = {}) => {
    await act(async () => root.render(createElement(Map, { steps: [{ lat: 53, lng: 27 }], ...props })))
  }
  const intersect = async (visible: boolean) => {
    await act(async () => {
      observers[0].callback([{ isIntersecting: visible, intersectionRatio: visible ? 1 : 0 } as IntersectionObserverEntry], {} as IntersectionObserver)
    })
  }

  beforeEach(() => {
    observers.length = 0
    mockMapRender.mockClear()
    mockMapMount.mockClear()
    mockMapUnmount.mockClear()
    class Observer {
      observe = jest.fn()
      disconnect = jest.fn()
      constructor(public callback: IntersectionObserverCallback, public options?: IntersectionObserverInit) {
        observers.push(this)
      }
    }
    window.IntersectionObserver = Observer as unknown as typeof IntersectionObserver
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    container.remove()
    window.IntersectionObserver = originalObserver
    jest.useRealTimers()
  })

  it('holds the same slot while the lazy renderer import is pending', async () => {
    await render({ deferUntilVisible: true, height: 460 })
    act(() => observers[0].callback([{ isIntersecting: true, intersectionRatio: 1 } as IntersectionObserverEntry], {} as IntersectionObserver))
    expect(container.querySelector<HTMLElement>('[data-testid="quest-map-deferred-slot"]')!.style.height).toBe('460px')
    expect(container.querySelector('[data-testid="quest-map-placeholder"]')).not.toBeNull()
    await act(async () => {})
    expect(container.querySelector('[data-testid="map-renderer"]')).not.toBeNull()
  })

  it.each([360, 460, 520])('reserves %ipx and never mounts an offscreen opt-in by timer', async (height) => {
    await render({ deferUntilVisible: true, height })
    const slot = container.querySelector<HTMLElement>('[data-testid="quest-map-deferred-slot"]')!
    expect(slot.style.height).toBe(`${height}px`)
    expect(observers).toHaveLength(1)
    expect(observers[0].observe).toHaveBeenCalledWith(slot)
    expect(observers[0].options).toMatchObject({ root: null, rootMargin: '200px', threshold: 0 })
    await intersect(false)
    jest.useFakeTimers()
    await act(async () => jest.advanceTimersByTime(60_000))
    expect(mockMapRender).not.toHaveBeenCalled()
    jest.useRealTimers()
    await intersect(true)
    expect(container.querySelector('[data-testid="map-renderer"]')).not.toBeNull()
    expect(mockMapRender).toHaveBeenCalledWith(expect.objectContaining({ height }))
    expect(slot.style.height).toBe(`${height}px`)
    await intersect(false)
    expect(container.querySelector('[data-testid="map-renderer"]')).not.toBeNull()
    expect(observers[0].disconnect).toHaveBeenCalled()
  })

  it('keeps default/first-screen consumers eager without a visibility observer', async () => {
    await render({ height: 520 })
    expect(observers).toHaveLength(0)
    expect(container.querySelector('[data-testid="quest-map-deferred-slot"]')).toBeNull()
    expect(container.querySelector('[data-testid="map-renderer"]')).not.toBeNull()
  })

  const openMapState = async () => {
    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-testid="fullscreen"]')!.click()
      container.querySelector<HTMLButtonElement>('[data-testid="export"]')!.click()
    })
  }
  const expectStatePreserved = () => {
    const map = container.querySelector<HTMLElement>('[data-testid="map-renderer"]')!
    expect(map.dataset.fullscreen).toBe('true')
    expect(map.dataset.exportOpen).toBe('true')
    expect(mockMapMount).toHaveBeenCalledTimes(1)
    expect(mockMapUnmount).not.toHaveBeenCalled()
  }

  it('preserves real fullscreen/export state across mobile, desktop and current-step rerenders', async () => {
    await render({ deferUntilVisible: true, height: 360 })
    await intersect(true)
    await openMapState()
    await render({ deferUntilVisible: false, height: 520, activeStepIndex: 0 })
    expectStatePreserved()
    await render({ deferUntilVisible: true, height: 360 })
    expectStatePreserved()
    expect(observers).toHaveLength(1)
  })

  it('activates eagerly before intersection when leaving mobile intro and never defers it again', async () => {
    await render({ deferUntilVisible: true, height: 360 })
    expect(mockMapMount).not.toHaveBeenCalled()
    await render({ deferUntilVisible: false, height: 520 })
    expect(mockMapMount).toHaveBeenCalledTimes(1)
    expect(observers[0].disconnect).toHaveBeenCalled()
    await openMapState()
    await render({ deferUntilVisible: true, height: 360 })
    expectStatePreserved()
    expect(observers).toHaveLength(1)
  })

  it('keeps an initially eager map active after opting into mobile layout', async () => {
    await render({ height: 520 })
    await openMapState()
    await render({ deferUntilVisible: true, height: 360 })
    expectStatePreserved()
    expect(observers).toHaveLength(0)
    expect(container.querySelector('[data-testid="quest-map-deferred-slot"]')).toBeNull()
  })

  it('loads the opt-in immediately when observers are unavailable', async () => {
    Object.defineProperty(window, 'IntersectionObserver', { value: undefined, configurable: true, writable: true })
    await render({ deferUntilVisible: true })
    expect(container.querySelector('[data-testid="map-renderer"]')).not.toBeNull()
    expect(container.querySelector<HTMLElement>('[data-testid="quest-map-deferred-slot"]')!.style.height).toBe('520px')
  })
})
