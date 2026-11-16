import type { Root } from 'react-dom/client'
import type { ComponentProps } from 'react'

let React: typeof import('react')
let createRoot: typeof import('react-dom/client').createRoot
let Block: typeof import('@/components/travel/details/sections/TravelRouteMapBlock.tsx').TravelRouteMapBlock
let Flow: typeof import('@/components/travel/details/TravelDetailsDeferredTransition').TravelDetailsMeasuredFlow
let mockChartReady = false
let mockChartGate: Promise<void>
let resolveChart: () => void
const observers: ResizeObserverCallback[] = []
class FrameObserver {
  constructor(callback: ResizeObserverCallback) { observers.push(callback) }
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeAll(() => {
  jest.resetModules()
  jest.doMock('react-native', () => jest.requireActual('react-native-web'))
  jest.doMock('@expo/vector-icons/Feather', () => () => null)
  jest.doMock('@/i18n', () => ({ translate: (key: string) => key }))
  jest.doMock('@/hooks/useTheme', () => ({ useThemedColors: () => ({}) }))
  jest.doMock('@/components/travel/details/TravelDetailsStyles', () => ({ useTravelDetailsStyles: () => ({}) }))
  jest.doMock('@/components/travel/ToggleableMapSection', () => ({
    __esModule: true, default: ({ children }: { children: import('react').ReactNode }) => children,
  }))
  jest.doMock('@/components/travel/TravelDetailSkeletons', () => ({ MapSkeleton: () => null }))
  jest.doMock('@/components/ui/SkeletonLoader', () => ({ SkeletonLoader: () => null }))
  jest.doMock('@/components/travel/details/sections/RouteElevationProfile', () => ({
    __esModule: true,
    default: () => {
      if (!mockChartReady) throw mockChartGate
      return require('react').createElement('div', { 'data-profile-payload': '1', style: { height: 500 } })
    },
  }))
  React = require('react')
  ;({ createRoot } = require('react-dom/client'))
  ;({ TravelRouteMapBlock: Block } = require('@/components/travel/details/sections/TravelRouteMapBlock.tsx'))
  ;({ TravelDetailsMeasuredFlow: Flow } = require('@/components/travel/details/TravelDetailsDeferredTransition'))
  Object.defineProperty(window, 'ResizeObserver', { configurable: true, value: FrameObserver })
})

const rect = (top: number, height: number) => ({ top, bottom: top + height, left: 0, right: 390, x: 0, y: top, width: 390, height, toJSON: () => ({}) }) as DOMRect

it.each([0, 1])('uses first-frame reserve through chart Suspense, then releases surplus safely (%s profiles)', async profiles => {
  observers.length = 0
  mockChartReady = false
  mockChartGate = new Promise(resolve => { resolveChart = resolve })
  const owner = document.createElement('div'), mount = document.createElement('div'), points = document.createElement('section')
  owner.style.overflowY = 'auto'
  points.dataset.testid = 'travel-details-points'
  owner.append(mount, points); document.body.append(owner)
  const initialTop = 10000
  let top = initialTop
  const writes: number[] = []
  const frames: FrameRequestCallback[] = []
  const node = (id: string) => mount.querySelector<HTMLElement>(`[data-testid="${id}"]`)
  const flowHeight = () => Number.parseFloat(node('travel-details-route-map-transition')?.style.height || '0')
  const naturalHeight = () => 692 + Math.max(
    Number.parseFloat(node('route-elevation-profiles')?.style.minHeight || '0'),
    Number.parseFloat(node('route-elevation-profiles-reserve')?.style.height || '0'),
    mount.querySelectorAll('[data-profile-payload]').length * 500,
  )
  const flowTop = () => -600 - (top - initialTop)
  Object.defineProperties(owner, {
    clientHeight: { value: 790 }, clientWidth: { value: 390 }, scrollHeight: { get: () => 20000 + flowHeight() },
    scrollTop: { get: () => top, set: value => { top = value; writes.push(value) } },
  })
  owner.getBoundingClientRect = () => rect(54, 790)
  points.getBoundingClientRect = () => rect(flowTop() + flowHeight(), 844)
  const originalRect = HTMLElement.prototype.getBoundingClientRect
  HTMLElement.prototype.getBoundingClientRect = function () {
    if (this.dataset.testid === 'travel-details-route-map-transition') return rect(flowTop(), flowHeight())
    if (this.dataset.testid === 'travel-details-route-map-transition-runtime') return rect(flowTop(), naturalHeight())
    return originalRect.call(this)
  }
  const originalFrame = window.requestAnimationFrame
  window.requestAnimationFrame = callback => frames.push(callback)
  const props = {
    downloadingRouteId: null, handleDownloadRoute: () => undefined, handleMapOpenChange: () => undefined,
    hasMapData: true, highlightedPoint: null, isLoading: false, isRoutePreviewLoading: false,
    keyPointLabels: {}, mapOpenTrigger: 0, mapResizeTrigger: 0, placeHints: [], routeFilePoints: [],
    shouldForceRenderMap: false, shouldRender: false, shouldRenderMapContent: false, styles: {}, transportHints: [],
    travel: { id: 544, route_track_files_count: 1, travelAddress: [] },
  } as unknown as Omit<ComponentProps<typeof Block>, 'routePreviewItems' | 'isRoutePreviewReady'>
  let root: Root | undefined
  const render = (ready: boolean) => root!.render(React.createElement(Flow, {
    isMobile: true, testID: 'travel-details-route-map-transition', growthOrigin: 'end',
    children: React.createElement(Block, { ...props, isRoutePreviewReady: ready, routePreviewItems: ready && profiles ? [{
      file: { id: 7 }, preview: { linePoints: [{ coord: '50,19' }, { coord: '50.1,19.1' }] },
    }] : [] }),
  }))
  try {
    await React.act(async () => { root = createRoot(mount); render(false) })
    expect(naturalHeight()).toBe(1252)
    expect(flowHeight()).toBe(1252)
    expect(window.getComputedStyle(node('travel-details-route-map-transition')!).overflowY).toBe('clip')
    top = initialTop; writes.length = 0
    const before = points.getBoundingClientRect().top
    Object.defineProperty(document, 'timeline', { configurable: true, value: { currentTime: performance.now() } })
    owner.dispatchEvent(new Event('scroll'))
    await React.act(async () => { render(true); await Promise.resolve() })
    if (profiles) {
      expect(node('route-elevation-profiles-reserve')).not.toBeNull()
      expect(flowHeight()).toBe(1252)
      await React.act(async () => { mockChartReady = true; resolveChart(); await Promise.resolve() })
      expect(mount.querySelectorAll('[data-profile-payload]')).toHaveLength(1)
    }
    React.act(() => { for (const callback of observers) callback([], {} as ResizeObserver) })
    expect(naturalHeight()).toBe(692 + profiles * 500)
    expect(flowHeight()).toBe(1252)
    expect(points.getBoundingClientRect().top).toBe(before)
    expect(writes).toEqual([])
    // The reader is still on the map: its appending flow keeps slack rather
    // than scrolling the map away to anchor the points. Release after the
    // reader actually reaches the following points, in a quiet frame.
    top += before - 80
    owner.dispatchEvent(new Event('scroll'))
    for (let frame = 0; frame < 5 && flowHeight() === 1252; frame++) {
      await React.act(async () => { for (const callback of frames.splice(0)) callback(performance.now() + frame + 1) })
    }
    expect(flowHeight()).toBe(692 + profiles * 500)
    expect(points.getBoundingClientRect().top).toBe(80)
    expect(node('route-elevation-profiles-reserve')).toBeNull()
  } finally {
    if (root) await React.act(async () => root!.unmount())
    owner.remove()
    HTMLElement.prototype.getBoundingClientRect = originalRect
    window.requestAnimationFrame = originalFrame
    delete (document as { timeline?: unknown }).timeline
  }
})
