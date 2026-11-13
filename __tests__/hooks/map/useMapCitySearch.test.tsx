import React from 'react'
import { act, renderHook, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider, focusManager, onlineManager } from '@tanstack/react-query'
import { nominatimSearch } from '@/api/external/nominatim'
import { resolveMapCity, useMapCitySearch } from '@/hooks/map/useMapCitySearch'
import { useMapDataController } from '@/hooks/map/useMapDataController'
import { useLocationSearchQuery, type LocationSearchResult } from '@/api/geoQueries'
import type { MapFilterValues } from '@/utils/mapFiltersStorage'
import { i18n } from '@/i18n'

jest.mock('@/api/external/nominatim', () => ({ nominatimSearch: jest.fn() }))
jest.mock('@/utils/mapAnalytics', () => ({ trackMapPlaceSearch: jest.fn() }))
jest.mock('@/hooks/map/useMapTravels', () => ({
  useMapTravels: () => ({ radiusSearchStatus: 'empty', refetch: jest.fn() }),
}))

const search = jest.mocked(nominatimSearch)
const city: LocationSearchResult = {
  place_id: 'nesvizh', name: 'Несвиж', display_name: 'Несвиж, Минская область, Беларусь',
  type: 'town', lat: '53.218', lon: '26.677', address: { town: 'Несвиж', country: 'Беларусь' },
}
const response = (data: LocationSearchResult[]) => ({ ok: true, json: async () => data }) as Response
const wrapper = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
  return ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
}
let clock = Date.now()
beforeEach(() => {
  clock += 2000
  search.mockReset()
  jest.spyOn(Date, 'now').mockImplementation(() => clock)
})
afterEach(() => jest.restoreAllMocks())

describe('verified city recovery', () => {

  it('accepts a settlement and an administrative settlement with matching locality metadata', () => {
    expect(resolveMapCity(city)).toEqual(expect.objectContaining({ lat: 53.218, lng: 26.677, label: city.display_name }))
    expect(resolveMapCity({ ...city, type: 'administrative', address: { city: 'Несвиж' } })).not.toBeNull()
  })

  it('accepts official legacy JSON settlement output without a name field', () => {
    expect(resolveMapCity({
      place_id: 'london', display_name: 'London, Greater London, England, United Kingdom',
      type: 'city', lat: '51.5073219', lon: '-0.1276474', address: { city: 'London' },
    })).toEqual(expect.objectContaining({ lat: 51.5073219, lng: -0.1276474 }))
  })

  it('requires an explicit lookup before contacting the external geocoder', async () => {
    search.mockResolvedValue(response([city]))
    const { result } = await renderHook(() => useMapCitySearch({ query: 'Несвиж', enabled: true, onSelect: jest.fn() }), { wrapper: wrapper() })
    expect(search).not.toHaveBeenCalled()
    expect(result.current.results).toEqual([])
  })

  it.each(['focus', 'reconnect'])('does not bypass explicit request lifetime after %s', async event => {
    search.mockResolvedValue(response([city]))
    const { result } = await renderHook(() => useMapCitySearch({ query: 'Несвиж', enabled: true, onSelect: jest.fn() }), { wrapper: wrapper() })
    await act(() => result.current.request())
    await waitFor(() => expect(result.current.status).toBe('settled'))
    clock += 11 * 60 * 1000
    await act(async () => {
      if (event === 'focus') { focusManager.setFocused(false); focusManager.setFocused(true) }
      else { onlineManager.setOnline(false); onlineManager.setOnline(true) }
      await new Promise(resolve => setTimeout(resolve, 0))
    })
    expect(search).toHaveBeenCalledTimes(1)
  })

  it('does not restart a failed request when connectivity returns', async () => {
    search.mockResolvedValue({ ok: false } as Response)
    const { result } = await renderHook(() => useMapCitySearch({ query: 'Несвиж', enabled: true, onSelect: jest.fn() }), { wrapper: wrapper() })
    await act(() => result.current.request())
    await waitFor(() => expect(result.current.status).toBe('error'))
    await act(async () => {
      onlineManager.setOnline(false)
      onlineManager.setOnline(true)
      await new Promise(resolve => setTimeout(resolve, 0))
    })
    expect(search).toHaveBeenCalledTimes(1)
  })

  it('does not resume a disarmed queued request when the connection returns', async () => {
    onlineManager.setOnline(false)
    search.mockRejectedValue(new Error('offline'))
    try {
      const { result, rerender } = await renderHook(props => useMapCitySearch({ ...props, onSelect: jest.fn() }), {
        wrapper: wrapper(), initialProps: { query: 'Несвиж', enabled: true },
      })
      await act(() => result.current.request())
      await waitFor(() => expect(result.current.status).toBe('error'))
      expect(search).toHaveBeenCalledTimes(1)
      await rerender({ query: 'Несвиж', enabled: false })
      const callsBeforeReconnect = search.mock.calls.length
      await act(async () => {
        onlineManager.setOnline(true)
        await new Promise(resolve => setTimeout(resolve, 0))
      })
      expect(search).toHaveBeenCalledTimes(callsBeforeReconnect)
      expect(result.current.status).toBeNull()
    } finally {
      onlineManager.setOnline(true)
    }
  })

  it('preserves background reconnect defaults for existing canonical geocoder consumers', async () => {
    search.mockResolvedValue(response([city]))
    const { result } = await renderHook(() => useLocationSearchQuery({ query: 'Несвиж' }), { wrapper: wrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    clock += 11 * 60 * 1000
    await act(async () => {
      onlineManager.setOnline(false)
      onlineManager.setOnline(true)
      await new Promise(resolve => setTimeout(resolve, 0))
    })
    await waitFor(() => expect(search).toHaveBeenCalledTimes(2))
  })

  it('preserves the default canonical offline queue for callers without the opt-in', async () => {
    onlineManager.setOnline(false)
    search.mockResolvedValue(response([city]))
    try {
      const { result } = await renderHook(() => useLocationSearchQuery({ query: 'Несвиж' }), { wrapper: wrapper() })
      await waitFor(() => expect(result.current.fetchStatus).toBe('paused'))
      expect(search).not.toHaveBeenCalled()
      await act(() => onlineManager.setOnline(true))
      await waitFor(() => expect(result.current.isSuccess).toBe(true))
      expect(search).toHaveBeenCalledTimes(1)
    } finally {
      onlineManager.setOnline(true)
    }
  })

  it('reacts to a locale change by disarming without requesting the new language', async () => {
    search.mockResolvedValue(response([city]))
    const { result } = await renderHook(() => useMapCitySearch({ query: 'Несвиж', enabled: true, onSelect: jest.fn() }), { wrapper: wrapper() })
    await act(() => result.current.request())
    await waitFor(() => expect(result.current.results).toHaveLength(1))
    try {
      await act(async () => { await i18n.changeLanguage('en') })
      expect(result.current.status).toBe('idle')
      expect(result.current.results).toEqual([])
      expect(search).toHaveBeenCalledTimes(1)
      clock += 1000
      await act(() => result.current.request())
      await waitFor(() => expect(search).toHaveBeenCalledTimes(2))
      expect(search.mock.calls[1][0].acceptLanguage).toBe('en')
    } finally {
      await act(async () => { await i18n.changeLanguage('ru') })
    }
  })

  it.each([
    { lat: '' }, { lat: ' ' }, { lat: 'NaN' }, { lat: '91' }, { lon: '181' }, { lon: '26wrong' },
    { type: 'castle', name: 'Замок' }, { name: 'Замок' }, { address: {} }, { display_name: '' },
  ])('rejects invalid coordinates, POI or absent settlement identity: %o', change => {
    expect(resolveMapCity({ ...city, ...change })).toBeNull()
  })

  it('uses canonical locale-aware transport/default limit and moves only on explicit selection', async () => {
    search.mockResolvedValue(response([city]))
    const onSelect = jest.fn()
    const { result } = await renderHook(() => useMapCitySearch({ query: ' Несвиж ', enabled: true, onSelect }), { wrapper: wrapper() })
    await act(() => result.current.request())
    await waitFor(() => expect(result.current.results).toHaveLength(1))
    expect(search).toHaveBeenCalledWith(
      expect.objectContaining({ q: 'Несвиж', limit: 7, addressdetails: 1, acceptLanguage: 'ru' }),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    )
    expect(onSelect).not.toHaveBeenCalled()
    await act(() => result.current.select(result.current.results[0]))
    expect(onSelect).toHaveBeenCalledWith({ lat: 53.218, lng: 26.677 })
  })

  it.each([['Несвиж', false], ['Не', true]])('does not query outside current empty recovery (%s, %s)', async (query, enabled) => {
    const { result } = await renderHook(() => useMapCitySearch({ query, enabled, onSelect: jest.fn() }), { wrapper: wrapper() })
    expect(result.current.status).toBeNull()
    expect(result.current.results).toEqual([])
    expect(search).not.toHaveBeenCalled()
  })

  it('retains no-city as settled absence and offers retry after a real geocoder failure', async () => {
    search.mockResolvedValueOnce({ ok: false } as Response).mockResolvedValueOnce(response([]))
    const { result } = await renderHook(() => useMapCitySearch({ query: 'Несвиж', enabled: true, onSelect: jest.fn() }), { wrapper: wrapper() })
    await act(() => result.current.request())
    await waitFor(() => expect(result.current.status).toBe('error'))
    expect(result.current.results).toEqual([])
    await act(() => { result.current.retry(); result.current.retry() })
    expect(search).toHaveBeenCalledTimes(1)
    clock += 1000
    await act(() => { result.current.retry(); result.current.retry() })
    await waitFor(() => expect(result.current.status).toBe('settled'))
    expect(result.current.results).toEqual([])
    expect(search).toHaveBeenCalledTimes(2)
  })

  it('removes cached offers immediately when the query or local status changes and rejects old handlers', async () => {
    search.mockResolvedValue(response([city]))
    const onSelect = jest.fn()
    const { result, rerender } = await renderHook(props => useMapCitySearch({ ...props, onSelect }), {
      wrapper: wrapper(), initialProps: { query: 'Несвиж', enabled: true },
    })
    await act(() => result.current.request())
    await waitFor(() => expect(result.current.results).toHaveLength(1))
    const previousCity = result.current.results[0]
    const previousSelect = result.current.select
    await rerender({ query: 'Несвиж', enabled: false })
    await act(() => previousSelect(previousCity))
    expect(onSelect).not.toHaveBeenCalled()
    expect(result.current.results).toEqual([])
    search.mockResolvedValue(response([]))
    await rerender({ query: 'Гродно', enabled: true })
    expect(result.current.status).toBe('idle')
    await act(() => previousSelect(previousCity))
    expect(onSelect).not.toHaveBeenCalled()
    expect(result.current.results).toEqual([])
  })

  it('ignores a late previous-query response after an edit', async () => {
    let finishPrevious!: (value: Response) => void
    search.mockImplementationOnce(() => new Promise(resolve => { finishPrevious = resolve }))
      .mockResolvedValueOnce(response([]))
    const { result, rerender } = await renderHook(props => useMapCitySearch({ ...props, onSelect: jest.fn() }), {
      wrapper: wrapper(), initialProps: { query: 'Несвиж', enabled: true },
    })
    await act(() => result.current.request())
    await waitFor(() => expect(search).toHaveBeenCalledTimes(1))
    expect(result.current.status).toBe('pending')
    const signal = search.mock.calls[0][1]?.signal
    await rerender({ query: 'Гродно', enabled: true })
    expect(result.current.status).toBe('idle')
    expect(signal?.aborted).toBe(true)
    await act(async () => { finishPrevious(response([city])) })
    expect(result.current.results).toEqual([])
    expect(search).toHaveBeenCalledTimes(1)
  })

  it('suppresses rapid requests across remounts and reuses the canonical cached response', async () => {
    search.mockResolvedValue(response([city]))
    const queryWrapper = wrapper()
    const first = await renderHook(() => useMapCitySearch({ query: 'Несвиж', enabled: true, onSelect: jest.fn() }), { wrapper: queryWrapper })
    await act(() => { first.result.current.request(); first.result.current.request() })
    await waitFor(() => expect(first.result.current.results).toHaveLength(1))
    await first.unmount()
    const second = await renderHook(() => useMapCitySearch({ query: 'Несвиж', enabled: true, onSelect: jest.fn() }), { wrapper: queryWrapper })
    await act(() => second.result.current.request())
    expect(second.result.current.status).toBe('idle')
    expect(search).toHaveBeenCalledTimes(1)
    clock += 1000
    await act(() => second.result.current.request())
    await waitFor(() => expect(second.result.current.results).toHaveLength(1))
    expect(search).toHaveBeenCalledTimes(1)
  })
})

describe('existing local-search freshness owns city recovery', () => {
  const filters: MapFilterValues = { categories: [], categoryTravelAddress: [], searchQuery: 'Несвиж', radius: '50', address: '' }
  const anchor = { coordinates: { latitude: 53.9, longitude: 27.559 }, source: 'default' as const }

  it.each(['query', 'radius', 'category', 'anchor'])('never exposes an old empty search on the first %s-change render', async change => {
    search.mockReset().mockResolvedValue(response([city]))
    const observed: (string | null)[] = []
    const onSelect = jest.fn()
    const { result, rerender } = await renderHook(({ filterValues, currentAnchor }) => {
      const data = useMapDataController({
        filterValues, anchor: currentAnchor, filters: { categories: [], categoryTravelAddress: [], radius: [], address: '' },
        mode: 'radius', fullRouteCoords: [], isFocused: true, isMobile: true,
      })
      observed.push(data.placeSearchStatus)
      return useMapCitySearch({ query: String(filterValues.searchQuery), enabled: data.placeSearchStatus === 'empty', onSelect })
    }, { wrapper: wrapper(), initialProps: { filterValues: filters, currentAnchor: anchor } })
    await act(() => result.current.request())
    await waitFor(() => expect(result.current.results).toHaveLength(1))
    const oldCity = result.current.results[0]
    observed.length = 0
    await rerender({
      filterValues: { ...filters, ...(change === 'query' ? { searchQuery: 'Гродно' } : change === 'radius' ? { radius: '100' } : change === 'category' ? { categoryTravelAddress: ['Замок'] } : {}) },
      currentAnchor: change === 'anchor' ? { ...anchor, coordinates: { latitude: 53.218, longitude: 26.677 } } : anchor,
    })
    expect(observed[0]).toBe('pending')
    expect(result.current.results).toEqual([])
    await act(() => result.current.select(oldCity))
    expect(onSelect).not.toHaveBeenCalled()
    await waitFor(() => expect(result.current.status).toBe('idle'))
    expect(search).toHaveBeenCalledTimes(1)
  })
})
