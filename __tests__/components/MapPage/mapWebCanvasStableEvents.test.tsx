import { renderHook } from '@testing-library/react-native'

import { createStableMapEventsHook } from '@/components/MapPage/Map/MapWebCanvas'
import { getMapFitBoundsPadding } from '@/components/MapPage/Map/mapFitBoundsPadding'

// #2451 — react-leaflet's useMapEvents re-subscribes (map.off + map.on) whenever
// the handlers object changes identity; callers pass inline literals.
describe('createStableMapEventsHook', () => {
  it('hands react-leaflet the same handler object across re-renders and calls the latest handler', async () => {
    const seen: any[] = []
    const impl = jest.fn((handlers: any) => {
      seen.push(handlers)
      return null
    })
    const useStable = createStableMapEventsHook(impl)
    const first = jest.fn()
    const second = jest.fn()

    const { rerender } = await renderHook(
      ({ click }: { click: (event: any) => void }) => useStable({ click, zoomend: () => {} }),
      { initialProps: { click: first } },
    )
    await rerender({ click: second })

    expect(seen).toHaveLength(2)
    expect(seen[1]).toBe(seen[0])
    seen[1].click({ type: 'click' })
    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledWith({ type: 'click' })
  })

  it('re-subscribes only when the set of event names changes', async () => {
    const seen: any[] = []
    const useStable = createStableMapEventsHook((handlers: any) => {
      seen.push(handlers)
      return null
    })
    const { rerender } = await renderHook(
      ({ withZoom }: { withZoom: boolean }) =>
        useStable(withZoom ? { click: () => {}, zoomend: () => {} } : { click: () => {} }),
      { initialProps: { withZoom: false } },
    )
    await rerender({ withZoom: true })
    expect(seen[1]).not.toBe(seen[0])
    expect(Object.keys(seen[1]).sort()).toEqual(['click', 'zoomend'])
  })
})

describe('getMapFitBoundsPadding', () => {
  it('reserves the current bottom-sheet height on the compact radius view', () => {
    expect(getMapFitBoundsPadding('radius', true, 300).paddingBottomRight).toEqual([24, 324])
    expect(getMapFitBoundsPadding('radius', true, 0).paddingBottomRight).toEqual([24, 120])
    expect(getMapFitBoundsPadding('radius', false, 300).paddingBottomRight).toEqual([24, 48])
    expect(getMapFitBoundsPadding('route', true, 300)).toEqual({
      paddingTopLeft: [24, 140],
      paddingBottomRight: [360, 220],
    })
  })
})
