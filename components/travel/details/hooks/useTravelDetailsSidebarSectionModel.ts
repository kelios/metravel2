import { useCallback, useEffect, useMemo, useState } from 'react'
import { Platform } from 'react-native'

import { useProgressiveLoad } from '@/hooks/useProgressiveLoading'
import type { Travel } from '@/types/types'

const areSameTravelLists = (prev: Travel[], next: Travel[]) => {
  if (prev === next) return true
  if (prev.length !== next.length) return false
  for (let i = 0; i < prev.length; i += 1) {
    if (String(prev[i]?.id ?? '') !== String(next[i]?.id ?? '')) return false
  }
  return true
}

type UseTravelDetailsSidebarSectionModelArgs = {
  canRenderHeavy: boolean
  travel: Travel
}

export function useTravelDetailsSidebarSectionModel({
  canRenderHeavy,
  travel,
}: UseTravelDetailsSidebarSectionModelArgs) {
  const isWeb = Platform.OS === 'web'
  const progressiveEnabled = !isWeb || canRenderHeavy
  const hasValidTravelId = Number.isFinite(Number(travel.id)) && Number(travel.id) > 0

  const [relatedTravels, setRelatedTravels] = useState<Travel[]>([])
  const handleTravelsLoaded = useCallback((travels: Travel[]) => {
    setRelatedTravels((prev) => (areSameTravelLists(prev, travels) ? prev : travels))
  }, [])

  const { setElementRef: setNearRef } = useProgressiveLoad({
    priority: 'low',
    rootMargin: '200px',
    threshold: 0.1,
    fallbackDelay: 1000,
    enabled: progressiveEnabled,
  })

  const { setElementRef: setPopularRef } = useProgressiveLoad({
    priority: 'low',
    rootMargin: '200px',
    threshold: 0.1,
    fallbackDelay: 1000,
    enabled: progressiveEnabled,
  })

  useEffect(() => {
    setRelatedTravels([])
  }, [travel.id, travel.slug])

  const shouldShowNavigationArrows = useMemo(() => relatedTravels.length > 0, [relatedTravels])

  return {
    handleTravelsLoaded,
    hasValidTravelId,
    relatedTravels,
    setNearRef,
    setPopularRef,
    shouldShowNavigationArrows,
  }
}
