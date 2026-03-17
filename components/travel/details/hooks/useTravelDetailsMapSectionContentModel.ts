import { useCallback, useEffect, useMemo } from 'react'
import { Platform } from 'react-native'

import { useMapLazyLoad } from '@/hooks/useMapLazyLoad'
import { useRouteFilePreviews } from '@/hooks/useRouteFilePreviews'
import { useKeyPointLabels } from '@/hooks/useKeyPointLabels'
import { isWebAutomation } from '@/utils/isWebAutomation'
import type { Travel } from '@/types/types'
import type { AnchorsMap } from '../TravelDetailsTypes'

type UseTravelDetailsMapSectionContentModelArgs = {
  anchors: AnchorsMap
  canRenderHeavy: boolean
  hasEmbeddedCoords: boolean
  hasTravelAddressPoints: boolean
  mapOpened: boolean
  shouldForceRenderMap: boolean
  travel: Travel
}

export function useTravelDetailsMapSectionContentModel({
  anchors,
  canRenderHeavy,
  hasEmbeddedCoords,
  hasTravelAddressPoints,
  mapOpened,
  shouldForceRenderMap,
  travel,
}: UseTravelDetailsMapSectionContentModelArgs) {
  const { shouldRender, elementRef, isLoading } = useMapLazyLoad({
    enabled: true,
    hasData: true,
    canRenderHeavy,
    rootMargin: isWebAutomation ? '800px 0px 800px 0px' : '400px 0px 400px 0px',
    threshold: isWebAutomation ? 0 : 0.1,
  })

  const {
    routePreviewItems,
    resetRoutePreviewItems,
    primaryRoutePreview,
    isRoutePreviewLoading,
  } = useRouteFilePreviews({
    travelId: travel?.id,
    canRenderHeavy,
    shouldRender,
    shouldForceRenderMap,
  })

  const { keyPointLabels, resetKeyPointLabels } = useKeyPointLabels(primaryRoutePreview)

  useEffect(() => {
    resetRoutePreviewItems()
    resetKeyPointLabels()
  }, [travel.id, travel.slug, resetRoutePreviewItems, resetKeyPointLabels])

  const shouldRenderMapContent = shouldRender || shouldForceRenderMap || mapOpened

  const hasMapData = useMemo(
    () =>
      hasEmbeddedCoords ||
      hasTravelAddressPoints ||
      routePreviewItems.some((item) => (item.preview?.linePoints.length ?? 0) > 0),
    [hasEmbeddedCoords, hasTravelAddressPoints, routePreviewItems]
  )

  const setMapSectionRef = useCallback(
    (node: any) => {
      ;(anchors.map as any).current = node
      if (Platform.OS === 'web') {
        elementRef(node)
      }
    },
    [anchors.map, elementRef]
  )

  return {
    hasMapData,
    isLoading,
    isRoutePreviewLoading,
    keyPointLabels,
    routePreviewItems,
    setMapSectionRef,
    shouldRender,
    shouldRenderMapContent,
  }
}
