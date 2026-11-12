import type { Root } from 'react-dom/client'
import type { Travel } from '@/types/types'

let React: typeof import('react')
let createRoot: typeof import('react-dom/client').createRoot
let MapSection: typeof import('@/components/travel/details/sections/TravelDetailsMapSection').TravelDetailsMapSection
let Flow: typeof import('@/components/travel/details/TravelDetailsDeferredTransition').TravelDetailsMeasuredFlow
let mockWidgetReady = false
let mockWidgetGate: Promise<void>
let mockResolveWidget: () => void
let mockEligible = true
let mockViewportWidth = 390

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
  jest.doMock('react-native', () => ({
    ...jest.requireActual('react-native-web'),
    useWindowDimensions: () => ({ width: mockViewportWidth, height: 844, scale: 1, fontScale: 1 }),
  }))
  jest.doMock('@/i18n', () => ({ translate: (key: string) => key }))
  jest.doMock('@/hooks/useTheme', () => ({ useThemedColors: () => ({}) }))
  jest.doMock('@/components/travel/details/TravelDetailsStyles', () => ({
    useTravelDetailsStyles: () => ({ sectionContainer: { marginBottom: 32, width: '100%' } }),
  }))
  jest.doMock('@/components/travel/details/hooks/useTravelDetailsMapSectionModel', () => ({
    useTravelDetailsMapSectionModel: () => ({}),
  }))
  jest.doMock('@/components/travel/details/hooks/useTravelDetailsMapSectionContentModel', () => ({
    useTravelDetailsMapSectionContentModel: ({ anchors }: { anchors: { map: { current: unknown } } }) => ({
      setMapSectionRef: (node: unknown) => { anchors.map.current = node },
    }),
  }))
  jest.doMock('@/components/legal/DataFreshnessNotice', () => ({
    __esModule: true, default: () => require('react').createElement('div', { 'data-testid': 'notice' }),
  }))
  jest.doMock('@/components/travel/details/sections/TravelRouteMapBlock', () => ({
    __esModule: true, default: () => require('react').createElement('div', { 'data-testid': 'map-rendered' }),
  }))
  jest.doMock('@/components/travel/details/sections/TravelWeatherBlock', () => ({ __esModule: true, default: () => null }))
  jest.doMock('@/components/travel/details/sections/TravelPointsBlock', () => ({
    __esModule: true,
    default: ({ anchors }: { anchors: { points: { current: unknown } } }) => require('react').createElement('section', { 'data-testid': 'travel-details-points', ref: anchors.points }),
  }))
  jest.doMock('@/components/belkraj/belkrajAvailability', () => ({ canRenderBelkrajWidget: () => mockEligible }))
  // Keep the real Excursions Suspense, fallback, section and eligibility. Only
  // its remote widget/module payload is controlled by the test.
  jest.doMock('@/components/belkraj/BelkrajWidget', () => ({
    __esModule: true,
    default: () => {
      if (!mockWidgetReady) throw mockWidgetGate
      return require('react').createElement('div', { 'data-testid': 'widget-payload', style: { height: 950 } })
    },
  }))
  React = require('react')
  ;({ createRoot } = require('react-dom/client'))
  ;({ TravelDetailsMeasuredFlow: Flow } = require('@/components/travel/details/TravelDetailsDeferredTransition'))
  ;({ TravelDetailsMapSection: MapSection } = require('@/components/travel/details/sections/TravelDetailsMapSection'))
  Object.defineProperty(window, 'ResizeObserver', { configurable: true, value: FrameObserver })
})

it.each([78, 957.984375])('keeps external authority while a DOM-committed parent has no registry (sidebar y=%s)', async sidebarTop => {
  mockEligible = true
  mockWidgetReady = true
  mockViewportWidth = 1440
  const owner = document.createElement('div'), mount = document.createElement('div')
  owner.style.overflowY = 'auto'
  owner.append(mount); document.body.append(owner)
  let top = 30000
  const writes: number[] = []
  const node = (id: string) => mount.querySelector<HTMLElement>(`[data-testid="${id}"]`)
  const leafHeight = () => Number.parseFloat(node('travel-details-excursions-transition')?.style.height || '0')
  const mapTop = () => sidebarTop - 1100 - (top - 30000)
  const originalRect = HTMLElement.prototype.getBoundingClientRect
  Object.defineProperties(owner, {
    clientHeight: { value: 790 }, clientWidth: { value: 390 }, scrollHeight: { value: 40000 },
    scrollTop: { get: () => top, set: value => { top = value; writes.push(value) } },
  })
  owner.getBoundingClientRect = () => rect(54, 790)
  HTMLElement.prototype.getBoundingClientRect = function () {
    switch (this.dataset.testid || this.dataset.sectionKey) {
      case 'unregistered-map': return rect(mapTop(), 1100)
      case 'travel-details-excursions-transition': return rect(mapTop() + 52, leafHeight())
      case 'travel-details-excursions-transition-runtime': return rect(mapTop() + 52, 1082)
      case 'map': return rect(mapTop() + 52 + leafHeight(), 692)
      case 'travel-details-points': return rect(mapTop() + 744 + leafHeight(), 3105)
      case 'external-sidebar': return rect(sidebarTop - (top - 30000), 1089.59375)
      default: return originalRect.call(this)
    }
  }
  const root = createRoot(mount)
  try {
    await React.act(async () => {
      root.render(React.createElement(React.Fragment, null,
        // This is the already-committed DOM window before the parent can
        // register/publish. Its marker is real; there is no private-registry mock.
        React.createElement('div', {
          'data-testid': 'unregistered-map', 'data-deferred-transition-state': 'runtime', style: { height: 1100 },
        }, React.createElement(MapSection, {
          travel: { id: 544, countryCode: 'DE', travelAddress: [] } as unknown as Travel,
          anchors: { map: { current: null }, points: { current: null }, excursions: { current: null } } as never,
          canRenderHeavy: true, scrollToMapSection: () => undefined,
        })),
        React.createElement('section', { 'data-testid': 'external-sidebar' }),
      ))
      await Promise.resolve()
    })
    expect(leafHeight()).toBe(1082)
    expect(node('unregistered-map')!.style.height).toBe('1100px')
    expect(node('external-sidebar')!.getBoundingClientRect().top).toBe(sidebarTop)
    expect(top).toBe(30000)
    expect(writes).toEqual([])
  } finally {
    await React.act(async () => root.unmount())
    owner.remove()
    HTMLElement.prototype.getBoundingClientRect = originalRect
    mockViewportWidth = 390
  }
})

const rect = (top: number, height: number) => ({ top, bottom: top + height, left: 10, right: 380, x: 10, y: top, width: 370, height, toJSON: () => ({}) }) as DOMRect

async function scene(natural: boolean) {
  mockEligible = true
  mockWidgetReady = false
  mockWidgetGate = new Promise(resolve => { mockResolveWidget = resolve })
  const host = document.createElement('div'), owner = document.createElement('div'), mount = document.createElement('div')
  owner.style.overflowY = 'auto'
  owner.append(mount); host.append(owner); document.body.append(host)
  const initialTop = 43000
  let top = initialTop
  const writes: number[] = []
  const anchors = { map: { current: null }, points: { current: null }, excursions: { current: null } }
  const node = (id: string) => mount.querySelector<HTMLElement>(`[data-testid="${id}"]`)
  const height = (id: string) => Number.parseFloat(node(id)?.style.height || '0')
  const intrinsicExcursions = () => {
    if (!mockEligible) return 0
    const widget = node('widget-payload')
    // Production reference: fallback160, real section1050 plus32 outer margin.
    return widget ? Number.parseFloat(widget.style.height) + 100 + 32 : 160
  }
  const excursionsFlow = () => node('travel-details-excursions-transition') ? height('travel-details-excursions-transition') : intrinsicExcursions()
  const mapTop = () => -1578.125 - (owner.scrollTop - initialTop)
  Object.defineProperties(owner, {
    clientHeight: { value: 790 }, clientWidth: { value: 390 },
    scrollHeight: { get: () => 45961 + height('map-slot') - 1590 },
    scrollTop: {
      get: () => natural ? initialTop + height('map-slot') - 1590 : top,
      set: value => { top = value; writes.push(value) },
    },
  })
  owner.getBoundingClientRect = () => rect(54, 790)
  const originalRect = HTMLElement.prototype.getBoundingClientRect
  HTMLElement.prototype.getBoundingClientRect = function () {
    switch (this.dataset.testid) {
      case 'map-slot': return rect(mapTop(), height('map-slot'))
      case 'map-slot-runtime': return rect(mapTop(), 1430 + excursionsFlow())
      case 'travel-details-excursions-transition': return rect(mapTop() + 88, excursionsFlow())
      case 'travel-details-excursions-transition-runtime': return rect(mapTop() + 88, intrinsicExcursions())
      case 'travel-details-points': return rect(mapTop() + 88 + excursionsFlow() + 692, 618)
      case 'following-sidebar': return rect(11.875 + height('map-slot') - 1590 - (owner.scrollTop - initialTop), 981)
      default:
        if (this.dataset.sectionKey === 'map') return rect(mapTop() + 88 + excursionsFlow(), 692)
        return originalRect.call(this)
    }
  }
  const root: Root = createRoot(mount)
  const tree = () => React.createElement(React.Fragment, null,
    React.createElement(Flow, {
      testID: 'map-slot', isMobile: true,
      children: React.createElement(MapSection, {
        travel: { id: 544, countryCode: 'DE', travelAddress: [] } as unknown as Travel,
        anchors: anchors as never, canRenderHeavy: true, scrollToMapSection: () => undefined,
      }),
    }),
    React.createElement('section', { 'data-testid': 'following-sidebar' }),
  )
  await React.act(async () => { root.render(tree()); await Promise.resolve() })
  const notify = (id: string) => {
    const target = node(`${id}-runtime`)
    if (!target) return
    for (const observer of FrameObserver.instances.filter(observer => observer.targets.has(target))) {
      observer.callback([{ target } as ResizeObserverEntry], observer as unknown as ResizeObserver)
    }
  }
  return {
    node, height, anchors, owner, writes,
    resolve: async () => { await React.act(async () => { mockWidgetReady = true; mockResolveWidget(); await mockWidgetGate }) },
    grow: (next: number) => { node('widget-payload')!.style.height = `${next}px` },
    notify: () => React.act(() => { notify('travel-details-excursions-transition'); notify('map-slot') }),
    clear: async () => { await React.act(async () => { mockEligible = false; root.render(tree()) }) },
    cleanup: async () => { await React.act(async () => root.unmount()); host.remove(); HTMLElement.prototype.getBoundingClientRect = originalRect },
  }
}

it.each([false, true])('isolates real Excursions fallback resolution before RO and preserves Map/Points through ancestors (natural=%s)', async natural => {
  const f = await scene(natural)
  try {
    expect(f.node('widget-payload')).toBeNull()
    expect(f.height('map-slot')).toBe(1590)
    expect(f.writes).toEqual([])
    const pointsBefore = f.node('travel-details-points')!.getBoundingClientRect().top
    const mapBefore = (f.anchors.map.current as unknown as HTMLElement).getBoundingClientRect().top
    const sidebarBefore = f.node('following-sidebar')!.getBoundingClientRect().top
    await f.resolve()
    expect(f.node('widget-payload')).not.toBeNull()
    // This fails without the leaf owner: production Points−638→284 before
    // the aggregate map-slot ResizeObserver can update its fixed1590 height.
    expect(f.node('travel-details-points')!.getBoundingClientRect().top).toBe(pointsBefore)
    expect((f.anchors.map.current as unknown as HTMLElement).getBoundingClientRect().top).toBe(mapBefore)
    expect(f.owner.scrollTop).toBe(43000)
    f.notify()
    expect(f.height('map-slot')).toBe(2512)
    expect(f.owner.scrollTop).toBe(43922)
    expect(f.node('travel-details-points')!.getBoundingClientRect().top).toBe(pointsBefore)
    expect((f.anchors.map.current as unknown as HTMLElement).getBoundingClientRect().top).toBe(mapBefore)
    expect(f.node('following-sidebar')!.getBoundingClientRect().top).toBe(sidebarBefore)
    expect((f.anchors.excursions.current as unknown as HTMLElement).getAttribute('data-section-key')).toBe('excursions')
    expect(f.writes).toHaveLength(natural ? 0 : 1)
    f.writes.length = 0
    f.grow(1214)
    expect(f.node('travel-details-points')!.getBoundingClientRect().top).toBe(pointsBefore)
    expect((f.anchors.map.current as unknown as HTMLElement).getBoundingClientRect().top).toBe(mapBefore)
    f.notify()
    expect(f.height('map-slot')).toBe(2776)
    expect(f.owner.scrollTop).toBe(44186)
    expect(f.node('travel-details-points')!.getBoundingClientRect().top).toBe(pointsBefore)
    expect((f.anchors.map.current as unknown as HTMLElement).getBoundingClientRect().top).toBe(mapBefore)
    expect(f.writes).toHaveLength(natural ? 0 : 1)
    f.writes.length = 0
    await f.clear()
    expect(f.anchors.excursions.current).toBeNull()
    expect(f.height('travel-details-excursions-transition')).toBe(0)
    expect(f.node('travel-details-excursions-transition')!.style.minHeight).toBe('')
    expect(f.height('map-slot')).toBe(1430)
    expect(f.owner.scrollTop).toBe(42840)
    expect(f.node('travel-details-points')!.getBoundingClientRect().top).toBe(pointsBefore)
    expect((f.anchors.map.current as unknown as HTMLElement).getBoundingClientRect().top).toBe(mapBefore)
    expect(f.writes).toHaveLength(natural ? 0 : 1)
  } finally { await f.cleanup() }
})

it.each([
  { sidebarTop: 78, initialTop: 30000, natural: false, eligible: true },
  { sidebarTop: 78, initialTop: 30000, natural: true, eligible: true },
  { sidebarTop: 957.984375, initialTop: 30000, natural: false, eligible: true },
  { sidebarTop: 78, initialTop: 0, natural: false, eligible: true },
  { sidebarTop: 78, initialTop: 30000, natural: false, eligible: false },
])('preserves first Map ownership (sidebar=$sidebarTop, owner=$initialTop, natural=$natural, eligible=$eligible)', async ({ sidebarTop, initialTop, natural, eligible }) => {
  mockEligible = eligible
  mockWidgetReady = true
  mockViewportWidth = 1440
  let ready = false, resolveMap!: () => void
  const gate = new Promise<void>(resolve => { resolveMap = resolve })
  const owner = document.createElement('div'), mount = document.createElement('div')
  owner.style.overflowY = 'auto'
  owner.append(mount); document.body.append(owner)
  let top = initialTop
  const calls: { kind: string; target: string; height?: number; top?: number; caller?: string }[] = []
  const writes: { from: number; to: number; lastRead: string | undefined; measuredAncestors: string[] }[] = []
  const node = (id: string) => mount.querySelector<HTMLElement>(`[data-testid="${id}"]`)
  const height = (id: string) => Number.parseFloat(node(id)?.style.height || '0')
  const currentTop = () => natural ? initialTop + height('initial-aggregate') - 3200 : top
  const mapTop = () => sidebarTop - 1100 - (currentTop() - initialTop)
  const desktopRect = (y: number, h: number) => ({ top: y, bottom: y + h, left: 401.59375, right: 1400, width: 998.40625, height: h, x: 401.59375, y, toJSON: () => ({}) }) as DOMRect
  Object.defineProperties(owner, {
    clientHeight: { value: 770 }, clientWidth: { value: 1440 },
    scrollHeight: { get: () => 33911 + height('initial-aggregate') - 3200 },
    scrollTop: {
      get: currentTop,
      set: value => {
        writes.push({ from: currentTop(), to: value, lastRead: calls.at(-1)?.target,
          measuredAncestors: calls.filter(call => call.kind === 'rect' && call.caller === 'measure').map(call => call.target) })
        calls.push({ kind: 'write', target: 'owner', top: value })
        top = value
      },
    },
  })
  owner.getBoundingClientRect = () => ({ ...desktopRect(78, 770), left: 0, right: 1440, x: 0, width: 1440 })
  const originalRect = HTMLElement.prototype.getBoundingClientRect
  const originalObserve = FrameObserver.prototype.observe
  FrameObserver.prototype.observe = function (target) {
    calls.push({ kind: 'observe', target: target.getAttribute('data-testid') || '' })
    originalObserve.call(this, target)
  }
  HTMLElement.prototype.getBoundingClientRect = function () {
    const id = this.dataset.testid || this.dataset.sectionKey || ''
    let result: DOMRect
    switch (id) {
      case 'initial-map': result = desktopRect(mapTop(), height('initial-map')); break
      case 'initial-map-runtime': result = desktopRect(mapTop(), ready ? 3881 + height('travel-details-excursions-transition') : 1100); break
      case 'initial-aggregate': result = desktopRect(mapTop() - 445, height('initial-aggregate')); break
      case 'initial-aggregate-runtime': result = desktopRect(mapTop() - 445, height('initial-map') + 2100); break
      case 'travel-details-excursions-transition': result = desktopRect(mapTop() + 52, height('travel-details-excursions-transition')); break
      case 'travel-details-excursions-transition-runtime': result = desktopRect(mapTop() + 52, eligible ? 1082 : 0); break
      case 'map': result = desktopRect(mapTop() + 52 + height('travel-details-excursions-transition'), 692); break
      case 'travel-details-points': result = desktopRect(mapTop() + 744 + height('travel-details-excursions-transition'), 3105); break
      case 'initial-sidebar': result = desktopRect(sidebarTop + height('initial-map') - 1100 - (currentTop() - initialTop), 1089.59375); break
      default: return originalRect.call(this)
    }
    const stack = new Error().stack || ''
    calls.push({ kind: 'rect', target: id, top: result.top, height: result.height,
      caller: stack.includes('measureRuntimeHeight') ? 'measure' : stack.includes('findReserveReleaseAnchor') ? 'capture' : stack.includes('correctMeasuredAnchor') ? 'correct' : 'other' })
    return result
  }
  const anchors = { map: { current: null }, points: { current: null }, excursions: { current: null } }
  function LazyMapPayload() {
    if (!ready) throw gate
    return React.createElement(MapSection, {
      travel: { id: 544, countryCode: 'DE', travelAddress: [] } as unknown as Travel,
      anchors: anchors as never, canRenderHeavy: true, scrollToMapSection: () => undefined,
    })
  }
  const root = createRoot(mount)
  try {
    await React.act(async () => {
      root.render(React.createElement(Flow, {
        testID: 'initial-aggregate', isMobile: false,
        children: React.createElement(React.Fragment, null,
          React.createElement(Flow, {
            testID: 'initial-map', isMobile: false,
            children: React.createElement(React.Suspense, {
              fallback: React.createElement('div', { 'data-testid': 'map-transport-fallback', style: { height: 1100 } }),
            }, React.createElement(LazyMapPayload)),
          }),
          React.createElement('section', { 'data-testid': 'initial-sidebar' }),
        ),
      }))
      await Promise.resolve()
    })
    expect(height('initial-map')).toBe(1100)
    expect(owner.scrollTop).toBe(initialTop)
    expect(writes).toEqual([])
    expect(node('initial-sidebar')!.getBoundingClientRect().top).toBe(sidebarTop)
    const bootstrapCalls = calls.length
    await React.act(async () => { ready = true; resolveMap(); await gate })
    expect(node('map-transport-fallback')).toBeNull()
    const leafHeight = eligible ? 1082 : 0
    const fullHeight = 3881 + leafHeight
    expect(height('travel-details-excursions-transition')).toBe(leafHeight)
    expect(height('initial-map')).toBe(fullHeight)
    expect(height('initial-aggregate')).toBe(fullHeight + 2100)
    expect(node('travel-details-excursions-transition')!.style.minHeight).toBe('')
    const mountCalls = calls.slice(bootstrapCalls)
    // Getter order tells whether the existing map/aggregate registry measured
    // before correction; lastRead identifies the anchor in this unit model.
    expect(mountCalls.some(call => call.target === 'initial-map-runtime' && call.caller === 'measure')).toBe(true)
    expect(mountCalls.some(call => call.target === 'initial-aggregate-runtime' && call.caller === 'measure')).toBe(true)
    if (initialTop === 0) {
      expect(owner.scrollTop).toBe(0)
      expect(writes).toEqual([])
      expect(node('initial-sidebar')!.getBoundingClientRect().top).toBe(sidebarTop + fullHeight - 1100)
    } else if (sidebarTop < 848) {
      expect(node('initial-sidebar')!.getBoundingClientRect().top).toBe(sidebarTop)
      expect(owner.scrollTop).toBe(initialTop + fullHeight - 1100)
      expect(writes).toHaveLength(natural ? 0 : 1)
      if (!natural) expect(writes[0].to).toBe(initialTop + fullHeight - 1100)
    } else {
      // The R3 frame has no already-painted following section on screen. Its
      // freshly inserted Map/Points cannot own an initial programmatic scroll.
      expect(writes).toEqual([])
      expect(top).toBe(initialTop)
    }
  } finally {
    await React.act(async () => root.unmount())
    owner.remove()
    HTMLElement.prototype.getBoundingClientRect = originalRect
    FrameObserver.prototype.observe = originalObserve
    mockViewportWidth = 390
  }
})
