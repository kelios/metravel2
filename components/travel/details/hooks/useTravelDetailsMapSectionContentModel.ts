import { useCallback, useEffect, useMemo } from 'react'

import { useRouteFilePreviews } from '@/hooks/useRouteFilePreviews'
import { useKeyPointLabels } from '@/hooks/useKeyPointLabels'
import type { Travel } from '@/types/types'
import type { AnchorsMap } from '../TravelDetailsTypes'

type RoutePreviewItem = {
  preview?: {
    linePoints?: Array<unknown>
  }
}

function getTravelDetailsMapSectionContentFlags(params: {
  canRenderHeavy: boolean
  mapOpened: boolean
  shouldForceRenderMap: boolean
}) {
  const shouldRender = params.canRenderHeavy

  return {
    isLoading: false,
    shouldRender,
    shouldRenderMapContent: shouldRender || params.shouldForceRenderMap || params.mapOpened,
  }
}

function hasTravelDetailsMapData(params: {
  hasEmbeddedCoords: boolean
  hasTravelAddressPoints: boolean
  routePreviewItems: RoutePreviewItem[]
}) {
  return (
    params.hasEmbeddedCoords ||
    params.hasTravelAddressPoints ||
    params.routePreviewItems.some((item) => (item.preview?.linePoints?.length ?? 0) > 0)
  )
}

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
  const { isLoading, shouldRender, shouldRenderMapContent } =
    getTravelDetailsMapSectionContentFlags({
      canRenderHeavy,
      mapOpened,
      shouldForceRenderMap,
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

  const hasMapData = useMemo(
    () =>
      hasTravelDetailsMapData({
        hasEmbeddedCoords,
        hasTravelAddressPoints,
        routePreviewItems,
      }),
    [hasEmbeddedCoords, hasTravelAddressPoints, routePreviewItems]
  )

  const setMapSectionRef = useCallback(
    (node: any) => {
      ;(anchors.map as any).current = node
    },
    [anchors.map]
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
