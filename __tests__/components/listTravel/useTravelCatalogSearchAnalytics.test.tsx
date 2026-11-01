import { renderHook, act } from '@testing-library/react-native'
import { Platform } from 'react-native'

import { useTravelCatalogSearchAnalytics } from '@/components/listTravel/useTravelCatalogSearchAnalytics'
import { sendAnalyticsEvent } from '@/utils/analytics'

jest.mock('@/utils/analytics', () => ({ sendAnalyticsEvent: jest.fn() }))

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

  it('never sends a phrase that looks like personal data and skips the outcome on error', async () => {
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
    })
  })

  it('stays silent outside site search and for an empty query', async () => {
    await renderHook(() => useTravelCatalogSearchAnalytics({ ...baseProps, enabled: false }))
    await renderHook(() => useTravelCatalogSearchAnalytics({ ...baseProps, query: '   ' }))
    await flush()

    expect(sendAnalyticsEvent).not.toHaveBeenCalled()
  })
})
