import { act, fireEvent, render, waitFor } from '@testing-library/react-native'
import { Pressable } from 'react-native'
import { useMapFiltersPanelProps } from '@/hooks/map/useMapFiltersPanelProps'
import { useRouteStore } from '@/stores/routeStore'
import { useRouteStoreAdapter } from '@/hooks/useRouteStoreAdapter'
import MapRouteEngine from '@/components/MapPage/MapRouteEngine'
import RoutingMachine from '@/components/MapPage/RoutingMachine'
import { clearResolvedRouteKeys } from '@/components/MapPage/useRouting'
import { routeCache } from '@/utils/routeCache'

const start: [number, number] = [27.56, 53.9]
const end: [number, number] = [27.58, 53.92]
const road: [number, number][] = [start, [27.565, 53.916], end]
const response = (geometry = road, isOptimal = true) => ({
  ok: true, json: async () => ({ geometry, distance_m: 3200, duration_s: 240, is_optimal: isOptimal, provider: 'ors' }),
})
function RealRouteController({ native = false }: { native?: boolean }) {
  const adapter = useRouteStoreAdapter()
  const { routingSlice } = useMapFiltersPanelProps({
    ...adapter, filters: { categories: [], radius: [], address: [], categoryTravelAddress: [] },
    filterValues: {}, allTravelsData: [], travelsData: [], mapUiApi: null,
  } as any)
  const engine = native ? <MapRouteEngine {...adapter} setRoutingLoading={adapter.setBuilding} setRoutingError={adapter.setError} /> : <RoutingMachine {...adapter} ORS_API_KEY={undefined}
    setRoutingLoading={adapter.setBuilding}
    setErrors={next => {
      const resolved = typeof next === 'function' ? next({ routing: false }) : next
      adapter.setError(typeof resolved.routing === 'string' ? resolved.routing : null)
    }} />
  return <><Pressable testID="actual-build-action" onPress={routingSlice.onBuildRoute} />{engine}</>
}

describe('real store → adapter → routing rebuild (#2311)', () => {
  beforeEach(() => {
    routeCache.clear()
    clearResolvedRouteKeys()
    useRouteStore.setState({ points: [], route: null, routeKey: null, rebuildRevision: 0, error: null, isBuilding: false, transportMode: 'car' })
    useRouteStore.getState().addPoint({ lng: start[0], lat: start[1] }, 'start')
    useRouteStore.getState().addPoint({ lng: end[0], lat: end[1] }, 'end')
    global.fetch = jest.fn()
  })

  it.each([false, true])('publishes identical second road atomically during a pending rebuild (native=%s)', async native => {
    ;(fetch as jest.Mock).mockResolvedValueOnce(response())
    let finish!: (value: unknown) => void
    ;(fetch as jest.Mock).mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    const observed: any[] = []
    const unsubscribe = useRouteStore.subscribe(state => observed.push(state.route))
    const view = render(<RealRouteController native={native} />)
    await waitFor(() => expect(useRouteStore.getState().route?.isOptimal).toBe(true))
    const original = useRouteStore.getState().route
    expect(original?.coordinates).toEqual(road.map(([lng, lat]) => ({ lng, lat })))
    fireEvent.press(view.getByTestId('actual-build-action'))
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2))
    expect(useRouteStore.getState().route).toBe(original)
    await act(async () => finish(response()))
    await waitFor(() => expect(useRouteStore.getState().isBuilding).toBe(false))
    expect(useRouteStore.getState().route?.distance).toBe(3200)
    expect(useRouteStore.getState().route?.isOptimal).toBe(true)
    expect(observed.filter(Boolean).every(route => route.coordinates.length === 3 && route.isOptimal)).toBe(true)
    unsubscribe()
    view.unmount()
  })

  it('actual second Build with direct fallback and every provider failing retains the healthy same-key road', async () => {
    ;(fetch as jest.Mock).mockResolvedValueOnce(response())
      .mockResolvedValueOnce({ ok: true, json: async () => ({ geometry: [start, end], distance_m: 100, duration_s: 20, provider: 'direct', is_optimal: false }) })
      .mockResolvedValue({ ok: false, status: 500, text: async () => 'provider unavailable' })
    const view = render(<RealRouteController />)
    await waitFor(() => expect(useRouteStore.getState().route?.isOptimal).toBe(true))
    const original = useRouteStore.getState().route
    fireEvent.press(view.getByTestId('actual-build-action'))
    await waitFor(() => expect(useRouteStore.getState().error).toEqual(expect.any(String)))
    expect(fetch).toHaveBeenCalledTimes(3)
    expect(useRouteStore.getState().route?.coordinates).toEqual(original?.coordinates)
    expect(useRouteStore.getState().route?.isOptimal).toBe(true)
    expect(routeCache.get([start, end], 'car')?.coords).toEqual(road)
    view.unmount()
  })

  it('keeps the same healthy road and exposes the actual rate-limit error after explicit rebuild', async () => {
    ;(fetch as jest.Mock).mockResolvedValueOnce(response())
    ;(fetch as jest.Mock).mockResolvedValue({ ok: false, status: 429, text: async () => 'rate limited' })
    const view = render(<RealRouteController />)
    await waitFor(() => expect(useRouteStore.getState().route?.isOptimal).toBe(true))
    const original = useRouteStore.getState().route
    fireEvent.press(view.getByTestId('actual-build-action'))
    await waitFor(() => expect(useRouteStore.getState().error).toEqual(expect.any(String)))
    expect(useRouteStore.getState().route?.coordinates).toEqual(original?.coordinates)
    expect(useRouteStore.getState().route?.isOptimal).toBe(true)
    expect(useRouteStore.getState().isBuilding).toBe(false)
    view.unmount()
  })

  it('rejects degraded replacement and stale generations, but changed transport cannot reuse the old road', async () => {
    ;(fetch as jest.Mock).mockResolvedValue(response())
    const view = render(<RealRouteController />)
    await waitFor(() => expect(useRouteStore.getState().route?.isOptimal).toBe(true))
    const original = useRouteStore.getState().route
    const key = useRouteStore.getState().routeKey!
    fireEvent.press(view.getByTestId('actual-build-action'))
    act(() => useRouteStore.getState().publishRouteResult({ routeKey: key, rebuildRevision: 1, coords: [start, end], distance: 100, duration: 0, isOptimal: false, error: 'offline' }))
    expect(useRouteStore.getState().route).toBe(original)
    act(() => useRouteStore.getState().publishRouteResult({ routeKey: key, rebuildRevision: 0, coords: [start, end], distance: 99, duration: 0, isOptimal: true, error: null }))
    expect(useRouteStore.getState().route).toBe(original)
    act(() => useRouteStore.getState().setTransportMode('bike'))
    expect(useRouteStore.getState().route).toBeNull()
    view.unmount()
  })
})
