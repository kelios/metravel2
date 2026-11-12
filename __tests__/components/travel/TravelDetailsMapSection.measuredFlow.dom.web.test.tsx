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
    useWindowDimensions: () => ({ width: 390, height: 844, scale: 1, fontScale: 1 }),
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
  top = initialTop
  writes.length = 0
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
