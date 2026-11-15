import { renderHook, act } from '@testing-library/react-native'
import { Platform } from 'react-native'

import { useTravelCatalogSearchAnalytics } from '@/components/listTravel/useTravelCatalogSearchAnalytics'
import { sendAnalyticsEvent } from '@/utils/analytics'
import { readConsent } from '@/utils/consent'

jest.mock('@/utils/analytics', () => ({ sendAnalyticsEvent: jest.fn() }))
jest.mock('@/utils/consent', () => ({ readConsent: jest.fn() }))

type Props = Parameters<typeof useTravelCatalogSearchAnalytics>[0]

const baseProps: Props = {
  enabled: true,
  query: 'Гродно',
  filtersKey: '{}',
  hasFilters: false,
  settled: true,
  isZeroResults: false,
  isError: false,
  resultsCount: 17,
  relaxedFilters: false,
}

describe('useTravelCatalogSearchAnalytics (#2908)', () => {
  const originalOS = Platform.OS

  beforeEach(() => {
    jest.useFakeTimers()
    ;(sendAnalyticsEvent as jest.Mock).mockClear()
    jest.mocked(readConsent).mockReturnValue(null)
    Object.defineProperty(Platform, 'OS', { configurable: true, get: () => 'web' })
  })

  afterEach(() => {
    jest.useRealTimers()
    Object.defineProperty(Platform, 'OS', { configurable: true, get: () => originalOS })
  })

  const flush = async () => {
    await act(async () => {
      jest.advanceTimersByTime(1000)
    })
  }

  it('sends search_submit and view_search_results once per settled query', async () => {
    const { rerender } = await renderHook((props: Props) => useTravelCatalogSearchAnalytics(props), {
      initialProps: baseProps,
    })
    await flush()
    await rerender({ ...baseProps })
    await flush()

    expect(sendAnalyticsEvent).toHaveBeenCalledTimes(2)
    expect(sendAnalyticsEvent).toHaveBeenNthCalledWith(1, 'search_submit', {
      source: 'travel_catalog',
      query_len: 6,
      has_filters: false,
      search_term: 'гродно',
      event_category: 'travel_catalog',
      outcome: 'found',
      results_count: 17,
      relaxed_filters: false,
    })
    expect(sendAnalyticsEvent).toHaveBeenNthCalledWith(2, 'view_search_results', {
      source: 'travel_catalog',
      query_len: 6,
      has_filters: false,
      search_term: 'гродно',
      results_count: 17,
      relaxed_filters: false,
    })
  })

  it('reports an empty result as search_zero_results', async () => {
    await renderHook(() => useTravelCatalogSearchAnalytics({
      ...baseProps,
      query: 'qwertyuiop',
      isZeroResults: true,
      resultsCount: 0,
    }))
    await flush()

    expect(sendAnalyticsEvent).toHaveBeenCalledWith('search_zero_results', {
      source: 'travel_catalog',
      query_len: 10,
      has_filters: false,
      search_term: 'qwertyuiop',
    })
    expect(sendAnalyticsEvent).not.toHaveBeenCalledWith('view_search_results', expect.anything())
  })

  it('waits for the terminal state and tracks a filter change as a new search', async () => {
    const { rerender } = await renderHook((props: Props) => useTravelCatalogSearchAnalytics(props), {
      initialProps: { ...baseProps, settled: false },
    })
    await flush()
    expect(sendAnalyticsEvent).not.toHaveBeenCalled()

    await rerender({ ...baseProps })
    await flush()
    await rerender({ ...baseProps, filtersKey: '{"categories":"2"}', hasFilters: true })
    await flush()

    const submits = (sendAnalyticsEvent as jest.Mock).mock.calls.filter(([name]) => name === 'search_submit')
    expect(submits).toHaveLength(2)
    expect(submits[1][1]).toMatchObject({ has_filters: true })
  })

  it('omits a private phrase and distinguishes an error from an empty result', async () => {
    await renderHook(() => useTravelCatalogSearchAnalytics({
      ...baseProps,
      query: 'me@example.com',
      isError: true,
    }))
    await flush()

    expect(sendAnalyticsEvent).toHaveBeenCalledTimes(1)
    expect(sendAnalyticsEvent).toHaveBeenCalledWith('search_submit', {
      source: 'travel_catalog',
      query_len: 14,
      has_filters: false,
      event_category: 'travel_catalog',
      outcome: 'error',
    })
  })

  it('records a fast opening once and cancels duplicate counting by the timer', async () => {
    const { result } = await renderHook(() => useTravelCatalogSearchAnalytics(baseProps))
    await act(async () => {
      result.current(78, 2)
      result.current(90, 3)
    })
    await flush()
    expect(sendAnalyticsEvent).toHaveBeenCalledTimes(3)
    expect(sendAnalyticsEvent).toHaveBeenNthCalledWith(3, 'search_result_click', {
      source: 'travel_catalog',
      event_category: 'travel_catalog',
      search_term: 'гродно',
      travel_id: 78,
      position: 2,
      results_count: 17,
      has_filters: false,
      relaxed_filters: false,
    })
  })

  it('ignores an old card during a pending query and a click with zero results', async () => {
    const { result, rerender } = await renderHook((props: Props) => useTravelCatalogSearchAnalytics(props), {
      initialProps: { ...baseProps, settled: false },
    })
    await act(async () => { result.current(78, 2) })
    expect(sendAnalyticsEvent).not.toHaveBeenCalled()

    await rerender({ ...baseProps, isZeroResults: true, resultsCount: 0 })
    await act(async () => { result.current(78, 2) })
    await flush()
    expect(sendAnalyticsEvent).toHaveBeenCalledWith('search_submit', expect.objectContaining({
      outcome: 'empty',
      results_count: 0,
    }))
    expect(sendAnalyticsEvent).not.toHaveBeenCalledWith('search_result_click', expect.anything())
  })

  it('records a found attempt before opening a result after the same query was empty', async () => {
    const { result, rerender } = await renderHook((props: Props) => useTravelCatalogSearchAnalytics(props), {
      initialProps: { ...baseProps, isZeroResults: true, resultsCount: 0 },
    })
    await flush()
    await rerender({ ...baseProps })
    await act(async () => { result.current(78, 1) })
    expect(sendAnalyticsEvent).toHaveBeenNthCalledWith(1, 'search_submit', expect.objectContaining({ outcome: 'empty' }))
    expect(sendAnalyticsEvent).toHaveBeenNthCalledWith(3, 'search_submit', expect.objectContaining({ outcome: 'found' }))
    expect(sendAnalyticsEvent).toHaveBeenNthCalledWith(5, 'search_result_click', expect.objectContaining({ travel_id: 78 }))
  })

  it('pairs the first post-consent result opening with a post-consent search', async () => {
    const { result } = await renderHook(() => useTravelCatalogSearchAnalytics(baseProps))
    await flush()
    jest.mocked(sendAnalyticsEvent).mockClear()
    jest.mocked(readConsent).mockReturnValue({ necessary: true, analytics: true, date: '2026-11-15' })
    await act(async () => {
      result.current(78, 1)
      result.current(89, 2)
    })
    expect(jest.mocked(sendAnalyticsEvent).mock.calls.map(([name]) => name))
      .toEqual(['search_submit', 'view_search_results', 'search_result_click'])
  })

  it('redacts an embedded phone number from both the search and click payloads', async () => {
    const { result } = await renderHook(() => useTravelCatalogSearchAnalytics({
      ...baseProps, query: 'тел. +375 (17) 123-45-67',
    }))
    await act(async () => { result.current(78, 1) })
    expect(sendAnalyticsEvent).toHaveBeenCalledTimes(3)
    for (const [, params] of (sendAnalyticsEvent as jest.Mock).mock.calls) {
      expect(params).not.toHaveProperty('search_term')
    }
  })

  it('stays silent outside site search and for an empty query', async () => {
    await renderHook(() => useTravelCatalogSearchAnalytics({ ...baseProps, enabled: false }))
    await renderHook(() => useTravelCatalogSearchAnalytics({ ...baseProps, query: '   ' }))
    await flush()

    expect(sendAnalyticsEvent).not.toHaveBeenCalled()
  })
})
