import React from 'react'
import { act, renderHook } from '@testing-library/react-native'
import { Platform } from 'react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { fetchPlacesCatalog } from '@/api/places'
import { sendAnalyticsEvent } from '@/utils/analytics'
import { usePlacesCatalogController } from '@/screens/tabs/usePlacesCatalogController'
import { getInterestingCategoryCollections } from '@/screens/tabs/PlacesScreen.helpers'
import type { CatalogPlace, PlacesCatalogPage } from '@/utils/placesCatalog'

const mockRouter = { push: jest.fn(), setParams: jest.fn() }
let mockParams: Record<string, string> = {}
jest.mock('expo-router', () => ({ useLocalSearchParams: () => mockParams, useRouter: () => mockRouter }))
jest.mock('@/api/places', () => ({ fetchPlacesCatalog: jest.fn(), fetchPlacesCatalogCategoryGroups: jest.fn(async () => ({})) }))
jest.mock('@/utils/analytics', () => ({ sendAnalyticsEvent: jest.fn() }))

const place = { id: 'public-1', latNumber: 53, lngNumber: 27, title: 'Private title', address: 'Private address' } as CatalogPlace
const page: PlacesCatalogPage = { places: [place], count: 2, categoryFacets: [], countryFacets: [] }
const fetchCatalog = jest.mocked(fetchPlacesCatalog)
const send = jest.mocked(sendAnalyticsEvent)
const events = (name: string) => send.mock.calls.filter(([event]) => event === name)
const originalPlatform = Platform.OS
let client: QueryClient

const settle = async () => {
  for (let i = 0; i < 3; i++) await act(async () => { await jest.advanceTimersByTimeAsync(5000) })
}
const renderController = async (focused = true) => {
  client = new QueryClient()
  const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
  const view = await renderHook(({ focused }) => usePlacesCatalogController({ isCompact: true, isWide: false, hasMeasuredWidth: true, isFocused: focused }), { wrapper, initialProps: { focused } })
  await settle()
  return view
}

describe('places catalog analytics on the real query/controller boundary', () => {
beforeEach(() => {
  jest.useFakeTimers()
  jest.clearAllMocks()
  mockParams = { category: '', places_source: 'mobile_menu' }
  ;(Platform as any).OS = 'web'
  fetchCatalog.mockResolvedValue(page)
})
afterEach(() => { client?.clear(); (Platform as any).OS = originalPlatform; jest.useRealTimers() })

test('opening and genuine actions retain finite source without private place or URL values', async () => {
  const { result, rerender } = await renderController()
  await rerender({ focused: true })
  expect(events('places_catalog_opened')).toHaveLength(1)
  await act(() => result.current.selectCategoryCollection(getInterestingCategoryCollections()[0]))
  await act(() => result.current.openOnMap(place))
  await act(() => result.current.openTravel('/travels/public-article?private=secret'))
  await act(() => result.current.openOnMap({ ...place, latNumber: NaN }))
  await act(() => result.current.openTravel(''))
  expect(events('places_catalog_collection')).toEqual([['places_catalog_collection', expect.objectContaining({ source: 'mobile_menu', action: 'collection', first_action: 1 })]])
  expect(events('places_catalog_open_map')).toEqual([['places_catalog_open_map', expect.objectContaining({ source: 'mobile_menu', action: 'open_map', first_action: 0 })]])
  expect(events('places_catalog_open_travel')).toHaveLength(1)
  expect(mockRouter.push).toHaveBeenCalledWith(expect.objectContaining({ pathname: '/map' }))
  const payload = JSON.stringify(send.mock.calls)
  for (const value of ['Private', 'address', 'latNumber', 'lngNumber', 'public-article', 'secret', '53', '27']) expect(payload).not.toContain(value)
})

test('a canceled search and its placeholder cannot report results for the new search', async () => {
  const { result } = await renderController()
  let resolveOld!: (value: PlacesCatalogPage) => void
  const old = new Promise<PlacesCatalogPage>(resolve => { resolveOld = resolve })
  fetchCatalog.mockImplementation(async params => params.q === 'Private old' ? old : { ...page, places: [], count: 0 })
  await act(() => result.current.handleQueryChange('Private old'))
  await settle()
  expect(events('places_catalog_search')).toHaveLength(0)
  await act(() => result.current.handleQueryChange('Private new'))
  await settle()
  expect(events('places_catalog_search')).toEqual([['places_catalog_search', expect.objectContaining({ outcome: 'empty', results_count: 0 })]])
  await act(async () => resolveOld(page))
  await settle()
  expect(events('places_catalog_search')).toHaveLength(1)
  expect(JSON.stringify(send.mock.calls)).not.toContain('Private')
})

test('pagination and background refetch do not duplicate a completed search; clearing permits a new search', async () => {
  mockParams.q = 'Private query'
  const { result } = await renderController()
  expect(events('places_catalog_search')).toEqual([['places_catalog_search', expect.objectContaining({ outcome: 'found', results_count: 2 })]])
  await act(() => result.current.loadMorePlaces())
  await settle()
  await act(async () => { await result.current.placesQuery.refetch() })
  await settle()
  expect(events('places_catalog_search')).toHaveLength(1)
  await act(() => result.current.handleQueryChange(''))
  await settle()
  await act(() => result.current.handleQueryChange('Private query'))
  await settle()
  expect(events('places_catalog_search')).toHaveLength(2)
})

test('a final error is distinct from empty and one successful retry reports recovery', async () => {
  mockParams.q = 'Private query'
  fetchCatalog.mockRejectedValue(Object.assign(new Error('Private error'), { name: 'TimeoutError' }))
  const { result } = await renderController()
  expect(events('places_catalog_search')).toEqual([['places_catalog_search', expect.objectContaining({ outcome: 'error' })]])
  expect(events('places_catalog_search')[0][1]).not.toHaveProperty('results_count')
  fetchCatalog.mockResolvedValue(page)
  await act(async () => { await result.current.placesQuery.refetch() })
  await settle()
  expect(events('places_catalog_search').map(([, data]) => data?.outcome)).toEqual(['error', 'found'])
  expect(JSON.stringify(send.mock.calls)).not.toContain('Private')
})

test('unknown source becomes direct; native catalog emits no web measurement', async () => {
  mockParams.places_source = 'Private URL source'
  const view = await renderController()
  expect(events('places_catalog_opened')[0][1]).toEqual({ event_category: 'places_catalog', event_label: 'direct', source: 'direct' })
  await view.unmount()
  client.clear()
  send.mockClear()
  ;(Platform as any).OS = 'android'
  const { result } = await renderController()
  await act(() => result.current.openOnMap(place))
  expect(send).not.toHaveBeenCalled()
})

test('an inactive kept-mounted tab cannot emit; returning counts a new opening and first action', async () => {
  mockParams.q = 'Private query'
  const { result, rerender } = await renderController(false)
  expect(send).not.toHaveBeenCalled()
  await rerender({ focused: true })
  await settle()
  expect(events('places_catalog_opened')).toHaveLength(1)
  await act(() => result.current.openOnMap(place))
  await rerender({ focused: false })
  await act(() => result.current.openOnMap(place))
  expect(events('places_catalog_open_map')).toHaveLength(1)
  await rerender({ focused: true })
  await act(() => result.current.openOnMap(place))
  expect(events('places_catalog_opened')).toHaveLength(2)
  expect(events('places_catalog_open_map').map(([, params]) => params?.first_action)).toEqual([1, 1])
})

test('refocusing with a different URL waits for restored search state before reporting a result', async () => {
  mockParams.q = 'Private old'
  const { rerender } = await renderController()
  await rerender({ focused: false })
  send.mockClear()
  fetchCatalog.mockResolvedValue({ ...page, places: [], count: 0 })
  mockParams = { ...mockParams, q: 'Private new', country: 'by', category: 'castle' }
  await rerender({ focused: true })
  expect(events('places_catalog_search')).toHaveLength(0)
  await settle()
  expect(events('places_catalog_opened')).toHaveLength(1)
  expect(events('places_catalog_search')).toEqual([['places_catalog_search', expect.objectContaining({ outcome: 'empty', results_count: 0 })]])
})
})
