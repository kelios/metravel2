import React from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react-native'
import { Platform, Text } from 'react-native'

import TravelDetailsPostLcpRuntime from '@/components/travel/details/TravelDetailsPostLcpRuntime'
import TravelDetailsScrollRuntime from '@/components/travel/details/TravelDetailsScrollRuntime'
import { TravelDetailsDeferredScrollProvider } from '@/components/travel/details/TravelDetailsDeferredScrollContext'
import {
  TRAVEL_DETAILS_FOOTER_RESERVE_HEIGHT,
  TravelDetailsDeferredTransition,
} from '@/components/travel/details/TravelDetailsDeferredTransition'

const mockLoadDeferredSectionsComponent = jest.fn()
const mockDeferredSectionsComponent = () => {
  const react = require('react')
  const { Text: ActualText } = require('react-native')
  return react.createElement(ActualText, { testID: 'travel-deferred-sections' }, 'deferred')
}
const INCLUDE_HIDDEN = { includeHiddenElements: true } as const

jest.mock('@/components/travel/details/travelDetailsDeferredLoader', () => ({
  getInitialDeferredSectionsComponent: () => null,
  loadDeferredSectionsComponent: () => mockLoadDeferredSectionsComponent(),
}))

jest.mock('@/components/ui/ReadingProgressBar', () => ({
  __esModule: true,
  default: () => {
    const React = require('react')
    const { Text } = require('react-native')
    return React.createElement(Text, { testID: 'reading-progress-bar' }, 'progress')
  },
}))

jest.mock('@/components/travel/TravelSectionsSheet', () => ({
  __esModule: true,
  default: () => {
    const React = require('react')
    const { Text } = require('react-native')
    return React.createElement(Text, { testID: 'travel-sections-sheet-wrapper' }, 'sheet')
  },
}))

jest.mock('@/components/travel/details/TravelStickyActions', () => ({
  __esModule: true,
  default: () => {
    const React = require('react')
    const { Text } = require('react-native')
    return React.createElement(Text, { testID: 'travel-sticky-actions' }, 'actions')
  },
}))

describe('TravelDetailsPostLcpRuntime', () => {
  const originalPlatformOS = Platform.OS

  beforeEach(() => {
    Platform.OS = 'web'
    mockLoadDeferredSectionsComponent.mockReset()
    mockLoadDeferredSectionsComponent.mockResolvedValue(mockDeferredSectionsComponent)
  })

  afterAll(() => {
    Platform.OS = originalPlatformOS
  })

  it('does not treat a native-renderer web layout callback as connected measured DOM', async () => {
    render(
      <TravelDetailsPostLcpRuntime
        travel={{ id: 1, name: 'Demo', slug: 'demo', gallery: [] } as any}
        isMobile anchors={{} as any} forceOpenKey={null} scrollToMapSection={jest.fn()}
      />,
    )
    const runtime = await screen.findByTestId('travel-details-deferred-transition-runtime', INCLUDE_HIDDEN)
    fireEvent(runtime, 'layout', { nativeEvent: { layout: { width: 390, height: 2400, x: 0, y: 0 } } })
    expect(screen.getByTestId('travel-deferred-sections', INCLUDE_HIDDEN)).toBeTruthy()
    expect(screen.getByTestId('travel-details-deferred-transition-placeholder', INCLUDE_HIDDEN)).toBeTruthy()
    expect(screen.getByTestId('travel-details-deferred-transition-runtime', INCLUDE_HIDDEN).props.inert).toBe(true)
    expect(screen.queryByTestId('travel-deferred-sections')).toBeNull()
  })

  it('keeps the original native skeleton when the deferred loader rejects', async () => {
    Platform.OS = 'ios'
    mockLoadDeferredSectionsComponent.mockRejectedValueOnce(new Error('chunk failed'))

    render(
      <TravelDetailsPostLcpRuntime
        travel={{ id: 1, name: 'Demo', slug: 'demo', gallery: [] } as any}
        isMobile
        anchors={{} as any}
        forceOpenKey={null}
        scrollToMapSection={jest.fn()}
      />,
    )

    await act(async () => {
      await Promise.resolve()
    })

    expect(screen.getByTestId('section-skeleton-reserved')).toBeTruthy()
    expect(screen.queryByTestId('travel-details-deferred-load-error')).toBeNull()
    expect(screen.queryByTestId('travel-details-deferred-transition')).toBeNull()
  })

  it('keeps the original direct placeholder-to-runtime behavior on native', () => {
    Platform.OS = 'ios'
    const { rerender } = render(
      <TravelDetailsDeferredTransition
        testID="native-transition"
        isMobile
        pending
        placeholder={<Text testID="native-placeholder">placeholder</Text>}
      >
        <Text testID="native-runtime">runtime</Text>
      </TravelDetailsDeferredTransition>,
    )

    expect(screen.getByTestId('native-placeholder')).toBeTruthy()
    expect(screen.queryByTestId('native-runtime')).toBeNull()
    expect(screen.queryByTestId('native-transition')).toBeNull()

    rerender(
      <TravelDetailsDeferredTransition
        testID="native-transition"
        isMobile
        pending={false}
        placeholder={<Text testID="native-placeholder">placeholder</Text>}
      >
        <Text testID="native-runtime">runtime</Text>
      </TravelDetailsDeferredTransition>,
    )

    expect(screen.queryByTestId('native-placeholder')).toBeNull()
    expect(screen.getByTestId('native-runtime')).toBeTruthy()
    expect(screen.queryByTestId('native-transition')).toBeNull()
  })

  it('renders scroll-derived runtime controls from the scroll provider', async () => {
    render(
      <TravelDetailsDeferredScrollProvider
        value={{
          activeSection: 'map',
          contentHeight: 1200,
          scrollY: {} as any,
          viewportHeight: 800,
        }}
      >
        <TravelDetailsScrollRuntime
          travel={{ id: 1, name: 'Demo', slug: 'demo', gallery: [] } as any}
          isMobile={true}
          screenWidth={390}
          sectionLinks={[{ key: 'map', label: 'Карта', icon: 'map' } as any]}
          onNavigate={jest.fn()}
          criticalChromeReady={true}
          scrollToComments={jest.fn()}
        />
      </TravelDetailsDeferredScrollProvider>
    )

    expect(screen.getByTestId('reading-progress-bar')).toBeTruthy()
    expect(screen.getByTestId('travel-sections-sheet-wrapper')).toBeTruthy()
    expect(await screen.findByTestId('travel-sticky-actions')).toBeTruthy()
  })

  // #2118: на native хром окна (прогресс, бар действий) живёт вне ScrollView —
  // слой `viewport`; в потоке статьи остаётся только лист разделов (`scroll`).
  it.each([
    ['scroll', { sheet: true, progress: false, actions: false }],
    ['viewport', { sheet: false, progress: true, actions: true }],
  ] as const)('renders only the %s layer of the runtime chrome', async (layer, expected) => {
    Platform.OS = 'ios'
    render(
      <TravelDetailsDeferredScrollProvider
        value={{ activeSection: 'map', contentHeight: 1200, scrollY: {} as any, viewportHeight: 800 }}
      >
        <TravelDetailsScrollRuntime
          layer={layer}
          travel={{ id: 1, name: 'Demo', slug: 'demo', gallery: [] } as any}
          isMobile={true}
          screenWidth={390}
          sectionLinks={[{ key: 'map', label: 'Карта', icon: 'map' } as any]}
          onNavigate={jest.fn()}
          criticalChromeReady={true}
          scrollToComments={jest.fn()}
        />
      </TravelDetailsDeferredScrollProvider>
    )

    await act(async () => {})
    expect(screen.queryByTestId('travel-sections-sheet-wrapper') != null).toBe(expected.sheet)
    expect(screen.queryByTestId('reading-progress-bar') != null).toBe(expected.progress)
    expect(screen.queryByTestId('travel-sticky-actions') != null).toBe(expected.actions)
  })
})

// Real web consumers need connected RNW DOM refs. Geometry here is a bounded
// DOM-fixture input (jsdom has no layout), never a pixel/browser acceptance.
// Native-renderer tests above keep their own renderer and unchanged contracts.
describe('TravelDetailsPostLcpRuntime (connected ReactDOM/RNW web consumer)', () => {
  let domReact: typeof import('react')
  let createRoot: typeof import('react-dom/client').createRoot
  let ActualPostLcp: typeof TravelDetailsPostLcpRuntime
  let ActualTransition: typeof TravelDetailsDeferredTransition
  let ActualText: typeof Text
  const originalResizeObserver = Object.getOwnPropertyDescriptor(window, 'ResizeObserver')
  const fixtures: Array<{ cleanup: () => void }> = []

  class ActualNodeResizeObserver {
    static instances: ActualNodeResizeObserver[] = []
    targets = new Set<Element>()
    constructor(readonly callback: ResizeObserverCallback) { ActualNodeResizeObserver.instances.push(this) }
    observe(node: Element) { this.targets.add(node) }
    unobserve(node: Element) { this.targets.delete(node) }
    disconnect() { this.targets.clear() }
  }

  beforeAll(() => {
    Object.defineProperty(window, 'ResizeObserver', { configurable: true, value: ActualNodeResizeObserver })
    jest.resetModules()
    jest.doMock('react-native', () => jest.requireActual('react-native-web'))
    domReact = require('react')
    ;({ createRoot } = require('react-dom/client'))
    ;({ Text: ActualText } = require('react-native'))
    ActualPostLcp = require('@/components/travel/details/TravelDetailsPostLcpRuntime').default
    ActualTransition = require('@/components/travel/details/TravelDetailsDeferredTransition').TravelDetailsDeferredTransition
  })

  beforeEach(() => {
    mockLoadDeferredSectionsComponent.mockReset()
    mockLoadDeferredSectionsComponent.mockResolvedValue(mockDeferredSectionsComponent)
  })

  afterEach(() => { while (fixtures.length) fixtures.pop()!.cleanup() })
  afterAll(() => {
    if (originalResizeObserver) Object.defineProperty(window, 'ResizeObserver', originalResizeObserver)
    else delete (window as unknown as { ResizeObserver?: typeof ResizeObserver }).ResizeObserver
  })

  function fixture(testID = 'travel-details-deferred-transition') {
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    let currentWidth = 390, currentHeight = 0
    let measured: HTMLElement | null = null
    const measuredRect = () => ({
      x: 0, y: 0, top: 0, left: 0, right: currentWidth, bottom: currentHeight,
      width: currentWidth, height: currentHeight, toJSON: () => ({}),
    }) as DOMRect
    const get = (id: string): HTMLElement => {
      const nodes = host.querySelectorAll<HTMLElement>(`[data-testid="${id}"]`)
      expect(nodes).toHaveLength(1)
      return nodes[0]
    }
    const query = (id: string) => host.querySelector<HTMLElement>(`[data-testid="${id}"]`)
    const renderTree = async (tree: React.ReactNode) => {
      await domReact.act(async () => { root.render(tree); await Promise.resolve() })
    }
    const setGeometry = (height: number, width = currentWidth) => {
      const runtime = get(`${testID}-runtime`)
      expect(runtime).toBeInstanceOf(HTMLElement)
      expect(runtime.isConnected).toBe(true)
      currentWidth = width; currentHeight = height
      if (measured !== runtime) {
        measured = runtime
        // RNW UIManager.measure reads actual node offset dimensions, whereas
        // Transition reads this same actual node's outer border rect.
        Object.defineProperties(runtime, {
          offsetWidth: { configurable: true, get: () => currentWidth },
          offsetHeight: { configurable: true, get: () => currentHeight },
          offsetLeft: { configurable: true, value: 0 },
          offsetTop: { configurable: true, value: 0 },
        })
        runtime.getBoundingClientRect = measuredRect
      }
      return runtime
    }
    const notifyLayout = async (height: number, width = currentWidth) => {
      const runtime = setGeometry(height, width)
      const observers = ActualNodeResizeObserver.instances.filter(observer => observer.targets.has(runtime))
      expect(observers.length).toBeGreaterThan(0)
      await domReact.act(async () => {
        for (const observer of observers) observer.callback([{ target: runtime, contentRect: measuredRect() } as ResizeObserverEntry], observer as unknown as ResizeObserver)
        // Await the existing RNW UIManager.measure zero-delay callback, rather
        // than calling a private layout handler or injecting product readiness.
        await new Promise<void>(resolve => setTimeout(resolve, 0))
      })
    }
    const hidden = () => {
      const runtime = get(`${testID}-runtime`)
      expect(runtime.hasAttribute('inert')).toBe(true)
      expect(runtime.getAttribute('aria-hidden')).toBe('true')
      expect(getComputedStyle(runtime).opacity).toBe('0')
      expect(get(`${testID}-placeholder`)).toBeTruthy()
    }
    const visible = () => {
      const runtime = get(`${testID}-runtime`)
      expect(runtime.isConnected).toBe(true)
      expect(runtime.getBoundingClientRect().width).toBeGreaterThan(0)
      expect(runtime.getBoundingClientRect().height).toBeGreaterThan(0)
      expect(runtime.hasAttribute('inert')).toBe(false)
      expect(runtime.getAttribute('aria-hidden')).not.toBe('true')
      expect(getComputedStyle(runtime).opacity).not.toBe('0')
      expect(query(`${testID}-placeholder`)).toBeNull()
      expect(get(testID).dataset.deferredTransitionState).toBe('runtime')
    }
    const cleanup = () => { domReact.act(() => root.unmount()); host.remove() }
    fixtures.push({ cleanup })
    return { host, get, query, renderTree, setGeometry, notifyLayout, hidden, visible }
  }

  const postLcp = (isMobile: boolean) => domReact.createElement(ActualPostLcp, {
    travel: { id: 1, name: 'Demo', slug: 'demo', gallery: [] } as any,
    isMobile, anchors: {} as any, forceOpenKey: null, scrollToMapSection: jest.fn(),
  })

  it('mounts deferred sections without scroll-derived runtime chrome', async () => {
    const f = fixture()
    await f.renderTree(postLcp(true))
    expect(mockLoadDeferredSectionsComponent).toHaveBeenCalledTimes(1)
    f.hidden()
    await f.notifyLayout(2400)
    f.visible()
    expect(f.get('travel-deferred-sections').textContent).toBe('deferred')
    expect(f.query('reading-progress-bar')).toBeNull()
    expect(f.query('travel-sections-sheet-wrapper')).toBeNull()
    expect(f.query('travel-sticky-actions')).toBeNull()
  })

  it('keeps the matching deferred skeleton through the first runtime layout', async () => {
    let resolveDeferred: ((component: typeof mockDeferredSectionsComponent) => void) | undefined
    mockLoadDeferredSectionsComponent.mockReturnValueOnce(new Promise<typeof mockDeferredSectionsComponent>(resolve => { resolveDeferred = resolve }))
    const f = fixture()
    await f.renderTree(postLcp(false))
    expect(f.get('travel-details-deferred-transition-placeholder')).toBeTruthy()
    expect(f.query('travel-details-deferred-transition-runtime')).toBeNull()
    await domReact.act(async () => { resolveDeferred!(mockDeferredSectionsComponent); await Promise.resolve() })
    expect(f.get('travel-deferred-sections')).toBeTruthy()
    f.hidden()
    await f.notifyLayout(0, 900)
    f.hidden()
    await f.notifyLayout(2400, 900)
    f.visible()
  })

  it('reveals an explicit failure state instead of leaving a rejected deferred import behind the skeleton', async () => {
    mockLoadDeferredSectionsComponent.mockRejectedValueOnce(new Error('chunk failed'))
    const f = fixture()
    await f.renderTree(postLcp(false))
    expect(f.get('travel-details-deferred-load-error').textContent!.length).toBeGreaterThan(0)
    f.hidden()
    await f.notifyLayout(40, 900)
    f.visible()
    expect(f.get('travel-details-deferred-load-error').textContent!.length).toBeGreaterThan(0)
    expect(f.query('travel-deferred-sections')).toBeNull()
  })

  it('keeps the footer reserve while measuring and drops it after the runtime frame is ready', async () => {
    const f = fixture('travel-details-footer-transition')
    const tree = (pending: boolean, runtimeFrameReady: boolean) => domReact.createElement(ActualTransition, {
      testID: 'travel-details-footer-transition', isMobile: false, pending,
      placeholder: domReact.createElement(ActualText, { testID: 'footer-skeleton' }, 'skeleton'),
      reserveHeight: TRAVEL_DETAILS_FOOTER_RESERVE_HEIGHT, runtimeFrameReady,
      children: domReact.createElement(ActualText, { testID: 'footer-runtime' }, 'runtime'),
    })
    await f.renderTree(tree(true, false))
    expect(f.get('travel-details-footer-transition').style.minHeight).toBe(TRAVEL_DETAILS_FOOTER_RESERVE_HEIGHT)
    expect(f.get('footer-skeleton')).toBeTruthy()
    await f.renderTree(tree(false, false))
    f.hidden()
    f.setGeometry(844, 900)
    expect(f.get('travel-details-footer-transition').style.minHeight).toBe(TRAVEL_DETAILS_FOOTER_RESERVE_HEIGHT)
    expect(f.get('footer-skeleton')).toBeTruthy()
    await f.renderTree(tree(false, true))
    f.visible()
    expect(f.query('footer-skeleton')).toBeNull()
    expect(f.get('travel-details-footer-transition').style.minHeight).toBe('')
    expect(f.get('travel-details-footer-transition').style.height).toBe('844px')
    expect(f.get('travel-details-footer-transition').dataset.reserveReleaseState).toBe('released')
  })
})
