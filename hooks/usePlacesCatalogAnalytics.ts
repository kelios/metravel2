import { useCallback, useEffect, useRef } from 'react'

import {
  placesCatalogSource,
  trackPlacesCatalogAction,
  trackPlacesCatalogOpened,
  trackPlacesCatalogSearch,
  type PlacesCatalogAction,
  type PlacesCatalogSearchOutcome,
} from '@/utils/placesCatalogAnalytics'

type SearchState = {
  source: unknown
  /** Local matching key only. It is never emitted or persisted. */
  searchKey: string
  hasSearch: boolean
  openReady: boolean
  focused: boolean
  ready: boolean
  fetching: boolean
  placeholder: boolean
  success: boolean
  error: boolean
  count: number
}

export function usePlacesCatalogAnalytics(state: SearchState) {
  const source = placesCatalogSource(state.source)
  const openedSource = useRef<string | null>(null)
  const firstAction = useRef(true)
  const search = useRef<{ key: string; outcome?: PlacesCatalogSearchOutcome }>({ key: '' })

  useEffect(() => {
    if (!state.focused) {
      openedSource.current = null
      search.current = { key: '' }
      return
    }
    if (!state.openReady || openedSource.current === source) return
    openedSource.current = source
    firstAction.current = true
    search.current = { key: '' }
    trackPlacesCatalogOpened(source)
  }, [source, state.openReady, state.focused])

  useEffect(() => {
    if (search.current.key !== state.searchKey) search.current = { key: state.searchKey }
    if (!state.focused || !state.openReady || !state.hasSearch || !state.ready || state.fetching || state.placeholder) return
    const outcome = state.error ? 'error' : state.success ? state.count > 0 ? 'found' : 'empty' : undefined
    if (!outcome || search.current.outcome === outcome) return
    // A settled success stays settled: background refresh and pagination do not
    // manufacture another search. A successful manual retry can recover an error.
    if (search.current.outcome && search.current.outcome !== 'error') return
    search.current.outcome = outcome
    trackPlacesCatalogSearch(source, outcome, state.count)
  }, [source, state.focused, state.openReady, state.searchKey, state.hasSearch, state.ready, state.fetching, state.placeholder, state.error, state.success, state.count])

  return useCallback((action: PlacesCatalogAction) => {
    if (!state.focused || !state.openReady) return
    trackPlacesCatalogAction(source, action, firstAction.current)
    firstAction.current = false
  }, [source, state.focused, state.openReady])
}
