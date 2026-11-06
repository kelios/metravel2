import { useCallback, useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'

import { ApiError } from '@/api/client'
import type { PlaceRequest } from '@/api/placeRequests'
import { queryKeys } from '@/api/queryKeys'
import { usePlaceRequest, usePlaceRequests } from '@/hooks/usePlaceRequests'
import { useLocale, useTranslation } from '@/i18n/LocaleProvider'
import { isPlaceRequestsPilotEnabled } from '@/utils/placeRequestsConfig'

const LAYER_ID = 'belarus-place-requests'
const EMPTY_REQUESTS: PlaceRequest[] = []
type Panel = 'list' | { requestId: string } | null

type LayerState = {
  active: boolean
  linkedId: string | null
  enabled: boolean
  panel: Panel
}

export type MapPlaceRequestsLayer = {
  markers: readonly PlaceRequest[]
  selectedId: string | null
  focus: PlaceRequest | null
  openRequest: (id: string) => void
}

function initialState(active: boolean, linkedId: string | null): LayerState {
  return { active, linkedId, enabled: Boolean(linkedId), panel: linkedId ? { requestId: linkedId } : null }
}

export function useMapPlaceRequests(isFocused: boolean, urlId: string | null) {
  const { t } = useTranslation()
  const { locale } = useLocale()
  const queryClient = useQueryClient()
  const available = isPlaceRequestsPilotEnabled()
  const active = available && isFocused
  const linkedId = active ? urlId : null
  const [stored, setState] = useState(() => initialState(active, linkedId))
  // A retained tab starts from the URL of its current visit, not the previous
  // selection. Derive this before enabling either query.
  const changedEntry = stored.active !== active || stored.linkedId !== linkedId
  const state = changedEntry ? initialState(active, linkedId) : stored
  if (changedEntry) setState(state)

  const enabled = active && state.enabled
  const panel = enabled ? state.panel : null
  const selectedId = panel && panel !== 'list' ? panel.requestId : null
  const list = usePlaceRequests(enabled, { refreshOnFocus: true })
  const detail = usePlaceRequest(selectedId, enabled)
  const detailData = detail.isSuccess && !detail.isFetching ? detail.data : null
  const missing = detail.error instanceof ApiError && detail.error.status === 404
  const retiredId = missing || (detailData && detailData.status !== 'open') ? selectedId : null

  useEffect(() => {
    if (!retiredId) return
    const queryKey = queryKeys.placeRequests(locale)
    const wasFetching = queryClient.getQueryState(queryKey)?.fetchStatus === 'fetching'
    // A collection read started before this detail read can still include
    // the retired invitation. Replace that read before updating the cache.
    if (wasFetching) void queryClient.cancelQueries({ queryKey, exact: true })
    queryClient.setQueryData<PlaceRequest[]>(queryKey, (items) =>
      items?.some(({ id }) => id === retiredId) ? items.filter(({ id }) => id !== retiredId) : undefined,
    )
    if (wasFetching) void queryClient.invalidateQueries({ queryKey, exact: true })
  }, [locale, queryClient, retiredId])

  const listMarkers = useMemo(() => enabled && list.data
    ? list.data.filter(({ id, status }) => status === 'open' && id !== retiredId)
    : EMPTY_REQUESTS, [enabled, list.data, retiredId])
  const markers = useMemo(() => {
    if (detailData?.status !== 'open') return listMarkers
    const listed = listMarkers.find(({ id }) => id === detailData.id)
    if (listed) {
      if (listed.lat === detailData.lat && listed.lng === detailData.lng) return listMarkers
      // The selected marker and the camera use the same canonical coordinates.
      return listMarkers.map((marker) => marker === listed ? detailData : marker)
    }
    // A direct link can resolve while the collection is still loading.
    return detail.dataUpdatedAt >= list.dataUpdatedAt ? [...listMarkers, detailData] : listMarkers
  }, [listMarkers, list.dataUpdatedAt, detailData, detail.dataUpdatedAt])

  useEffect(() => {
    if (detailData?.status === 'open' && list.data && list.dataUpdatedAt > detail.dataUpdatedAt &&
        !list.data.some(({ id }) => id === detailData.id)) {
      void queryClient.invalidateQueries({ queryKey: queryKeys.placeRequest(detailData.id, locale), exact: true })
    }
  }, [detailData, detail.dataUpdatedAt, list.data, list.dataUpdatedAt, locale, queryClient])

  const setEnabled = useCallback((next: boolean) => {
    setState((current) => ({ ...current, enabled: next, panel: next ? current.panel : null }))
  }, [])
  const openList = useCallback(() => {
    setState((current) => ({ ...current, panel: 'list' }))
  }, [])
  const openRequest = useCallback((id: string) => {
    setState((current) => ({ ...current, panel: { requestId: id } }))
  }, [])
  const close = useCallback(() => {
    setState((current) => ({ ...current, panel: null }))
  }, [])

  const focus = detailData?.status === 'open' ? detailData : null
  const layer = useMemo<MapPlaceRequestsLayer | undefined>(() =>
    enabled ? { markers, selectedId, focus, openRequest } : undefined,
  [enabled, markers, selectedId, focus, openRequest])
  const title = t('places:contributions.map.layer')
  const subtitle = t('places:contributions.map.legend')
  const overlay = useMemo(() => available ? {
    id: LAYER_ID,
    title,
    category: 'sights',
    subtitle,
    enabled,
    toggle: setEnabled,
  } : undefined, [available, enabled, setEnabled, subtitle, title])
  const detailLoading = detail.isPending || detail.isFetching
  const detailError = detail.isError && !missing
  return useMemo(() => ({
    layer, overlay, panel, openList, close, openRequest,
    listLoading: list.isPending,
    listError: list.isError,
    retryList: list.refetch,
    detailData,
    detailLoading,
    detailError,
    retryDetail: detail.refetch,
  }), [
    close, detail.refetch, detailData, detailError, detailLoading, layer, list.isError, list.isPending,
    list.refetch, openList, openRequest, overlay, panel,
  ])
}

export type MapPlaceRequestsState = ReturnType<typeof useMapPlaceRequests>
