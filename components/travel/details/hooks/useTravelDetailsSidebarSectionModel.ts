import { useCallback, useEffect, useMemo, useState } from 'react'
import { Platform } from 'react-native'

import { useProgressiveLoad } from '@/hooks/useProgressiveLoading'
import type { Travel } from '@/types/types'

const TRAVEL_DETAILS_SIDEBAR_PROGRESSIVE_LOAD_CONFIG = {
  fallbackDelay: 1000,
  priority: 'low' as const,
  rootMargin: '200px',
  threshold: 0.1,
}

function areSameTravelLists(prev: Travel[], next: Travel[]) {
  if (prev === next) return true
  if (prev.length !== next.length) return false

  for (let index = 0; index < prev.length; index += 1) {
    if (String(prev[index]?.id ?? '') !== String(next[index]?.id ?? '')) return false
  }

  return true
}

function getTravelDetailsSidebarSectionFlags(params: {
  canRenderHeavy: boolean
  relatedTravels: Travel[]
  travelId: unknown
}) {
  const isWeb = Platform.OS === 'web'

  return {
    hasValidTravelId: Number.isFinite(Number(params.travelId)) && Number(params.travelId) > 0,
    progressiveEnabled: !isWeb || params.canRenderHeavy,
    shouldShowNavigationArrows: params.relatedTravels.length > 0,
  }
}

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

  const { setElementRef: setNearRef } = useProgressiveLoad({
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

  return {
    handleTravelsLoaded,
    hasValidTravelId,
    relatedTravels,
    setNearRef,
    setPopularRef,
    shouldShowNavigationArrows,
  }
}
