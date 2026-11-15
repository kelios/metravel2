import { useCallback, useEffect, useRef } from 'react'
import { Platform } from 'react-native'

import { sendAnalyticsEvent } from '@/utils/analytics'
import { isAnalyticsSearchTerm } from '@/utils/analyticsSearchTerm'
import { readConsent } from '@/utils/consent'

type TravelCatalogSearchAnalyticsOptions = {
  enabled: boolean
  query: string
  filtersKey: string
  hasFilters: boolean
  /** True only when the rendered outcome belongs to the active query. */
  settled: boolean
  isZeroResults: boolean
  isError: boolean
  resultsCount: number
  relaxedFilters: boolean
}

const SETTLE_DELAY_MS = 900

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
  const lastSearch = useRef<{ key: string; consented: boolean; selected: boolean } | null>(null)
  const term = query.trim().toLowerCase()
  const outcome = isError ? 'error' : isZeroResults ? 'empty' : 'found'
  const key = `${term}\u0000${filtersKey}\u0000${outcome}`
  const canTrack = Platform.OS === 'web' && enabled && Boolean(term) && settled

  const recordSearch = useCallback(() => {
    if (!canTrack) return null

    const consented = readConsent()?.analytics === true
    const previous = lastSearch.current
    if (previous?.key === key && (previous.consented || !consented)) return previous

    const attempt = { key, consented, selected: false }
    lastSearch.current = attempt
    const base = {
      source: 'travel_catalog',
      query_len: term.length,
      has_filters: hasFilters,
      ...(isAnalyticsSearchTerm(term) ? { search_term: term } : {}),
    }

    void sendAnalyticsEvent('search_submit', {
      ...base,
      event_category: 'travel_catalog',
      outcome,
      ...(outcome !== 'error' ? { results_count: resultsCount, relaxed_filters: relaxedFilters } : {}),
    })
    if (outcome === 'empty') {
      void sendAnalyticsEvent('search_zero_results', base)
    } else if (outcome === 'found') {
      void sendAnalyticsEvent('view_search_results', {
        ...base,
        results_count: resultsCount,
        relaxed_filters: relaxedFilters,
      })
    }
    return attempt
  }, [canTrack, hasFilters, key, outcome, relaxedFilters, resultsCount, term])

  useEffect(() => {
    if (!term) lastSearch.current = null
    if (!canTrack || lastSearch.current?.key === key) return

    const timer = setTimeout(recordSearch, SETTLE_DELAY_MS)
    return () => clearTimeout(timer)
  }, [canTrack, key, recordSearch, term])

  return useCallback((travelId: number, position: number) => {
    if (!canTrack || outcome !== 'found') return

    // Navigation can unmount the catalog before the settle timer fires.
    const attempt = recordSearch()
    if (!attempt || attempt.selected) return

    attempt.selected = true
    void sendAnalyticsEvent('search_result_click', {
      source: 'travel_catalog',
      event_category: 'travel_catalog',
      travel_id: travelId,
      position,
      results_count: resultsCount,
      has_filters: hasFilters,
      relaxed_filters: relaxedFilters,
      ...(isAnalyticsSearchTerm(term) ? { search_term: term } : {}),
    })
  }, [canTrack, hasFilters, outcome, recordSearch, relaxedFilters, resultsCount, term])
}
