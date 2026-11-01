import { useEffect, useRef } from 'react'
import { Platform } from 'react-native'

import { sendAnalyticsEvent } from '@/utils/analytics'
import { isAnalyticsSearchTerm } from '@/utils/analyticsSearchTerm'

type TravelCatalogSearchAnalyticsOptions = {
  /** Site search only (/search), not "my travels" or export. */
  enabled: boolean
  /** Debounced text query the shown results belong to. */
  query: string
  /** Serialized API params without the text query: a filter change is a new search. */
  filtersKey: string
  hasFilters: boolean
  /** The catalog reached a terminal state for this query: cards, honest empty or error. */
  settled: boolean
  isZeroResults: boolean
  isError: boolean
  resultsCount: number
  /** Results came from a relaxed-filters fallback, not from the query as typed. */
  relaxedFilters: boolean
}

const SETTLE_DELAY_MS = 900

/**
 * #2908: route-catalog search funnel — `search_submit`, then the outcome:
 * `view_search_results` or `search_zero_results`. One set per settled
 * query + filters, measured against what the user actually sees.
 */
export function useTravelCatalogSearchAnalytics({
  enabled,
  query,
  filtersKey,
  hasFilters,
  settled,
  isZeroResults,
  isError,
  resultsCount,
  relaxedFilters,
}: TravelCatalogSearchAnalyticsOptions) {
  const lastTrackedKey = useRef<string | null>(null)
  const term = query.trim().toLowerCase()
  const key = `${term}\u0000${filtersKey}`

  useEffect(() => {
    if (!term) lastTrackedKey.current = null
    if (Platform.OS !== 'web' || !enabled || !term || !settled || key === lastTrackedKey.current) return

    const timer = setTimeout(() => {
      lastTrackedKey.current = key
      const base = {
        source: 'travel_catalog',
        query_len: term.length,
        has_filters: hasFilters,
        ...(isAnalyticsSearchTerm(term) ? { search_term: term } : {}),
      }
      void sendAnalyticsEvent('search_submit', base)
      if (isError) return
      if (isZeroResults) {
        void sendAnalyticsEvent('search_zero_results', base)
        return
      }
      void sendAnalyticsEvent('view_search_results', {
        ...base,
        results_count: resultsCount,
        relaxed_filters: relaxedFilters,
      })
    }, SETTLE_DELAY_MS)
    return () => clearTimeout(timer)
  }, [enabled, term, key, settled, hasFilters, isZeroResults, isError, resultsCount, relaxedFilters])
}
