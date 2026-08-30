import { useCallback, useEffect, useMemo, useState } from 'react'
import { useIsFetching } from '@tanstack/react-query'

import { queryKeys } from '@/api/queryKeys'
import { useProgressiveLoad } from '@/hooks/useProgressiveLoading'
import type { Travel } from '@/types/types'

import {
  areSameTravelLists,
  getTravelDetailsSidebarSectionFlags,
  TRAVEL_DETAILS_SIDEBAR_PROGRESSIVE_LOAD_CONFIG,
} from './travelDetailsSidebarSectionModel'

type UseTravelDetailsSidebarSectionModelArgs = {
  canRenderHeavy: boolean
  travel: Travel
}

export function useTravelDetailsSidebarSectionModel({
  canRenderHeavy,
  travel,
}: UseTravelDetailsSidebarSectionModelArgs) {
  const [relatedTravels, setRelatedTravels] = useState<Travel[]>([])
  const { hasValidTravelId, progressiveEnabled, shouldShowNavigationArrows } = useMemo(
    () =>
      getTravelDetailsSidebarSectionFlags({
        canRenderHeavy,
        relatedTravels,
        travelId: travel.id,
      }),
    [canRenderHeavy, relatedTravels, travel.id]
  )

  const handleTravelsLoaded = useCallback((travels: Travel[]) => {
    setRelatedTravels((prev) => (areSameTravelLists(prev, travels) ? prev : travels))
  }, [])

  const { setElementRef: setNearRef, shouldLoad: nearInViewport } = useProgressiveLoad({
    ...TRAVEL_DETAILS_SIDEBAR_PROGRESSIVE_LOAD_CONFIG,
    enabled: progressiveEnabled,
  })

  const { setElementRef: setPopularRef } = useProgressiveLoad({
    ...TRAVEL_DETAILS_SIDEBAR_PROGRESSIVE_LOAD_CONFIG,
    enabled: progressiveEnabled,
  })

  useEffect(() => {
    setRelatedTravels([])
  }, [travel.id, travel.slug])

  // The deferred wrapper releases its height reserve when the sidebar frame
  // stops resizing, and both lists go quiet on their own skeletons long before
  // the payloads land. Reporting is therefore suppressed while either list is
  // in flight; an empty or failed response still ends the fetch, so this can
  // never strand the section behind its placeholder.
  const nearFetching = useIsFetching({
    queryKey: queryKeys.travelsNear(Number(travel.id)),
  })
  const popularFetching = useIsFetching({ queryKey: queryKeys.travelsPopular() })

  return {
    handleTravelsLoaded,
    hasValidTravelId,
    listsFetching: nearFetching + popularFetching > 0,
    nearInViewport,
    relatedTravels,
    setNearRef,
    setPopularRef,
    shouldShowNavigationArrows,
  }
}
