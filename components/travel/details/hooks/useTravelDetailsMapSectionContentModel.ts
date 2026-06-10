import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Platform } from 'react-native'

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

  // The route-file preview pulls the GPX/KML track (hundreds of KB) only to draw
  // the polyline on the map. On web the map sits below the fold, so we wait for
  // the section to approach the viewport before downloading — otherwise it
  // competes for bandwidth during LCP (FE-1). Native renders eagerly as before.
  const [mapNearViewport, setMapNearViewport] = useState(Platform.OS !== 'web')
  const mapObserverRef = useRef<IntersectionObserver | null>(null)

  const routePreviewShouldRender =
    shouldRender && (mapNearViewport || mapOpened || shouldForceRenderMap)

  const {
    routePreviewItems,
    resetRoutePreviewItems,
    primaryRoutePreview,
    isRoutePreviewLoading,
  } = useRouteFilePreviews({
    travelId: travel?.id,
    canRenderHeavy,
    shouldRender: routePreviewShouldRender,
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

      if (Platform.OS !== 'web') return
      mapObserverRef.current?.disconnect()
      mapObserverRef.current = null
      if (!node || typeof IntersectionObserver === 'undefined') {
        if (typeof IntersectionObserver === 'undefined') setMapNearViewport(true)
        return
      }
      const observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            setMapNearViewport(true)
            observer.disconnect()
            mapObserverRef.current = null
          }
        },
        { rootMargin: '400px' }
      )
      observer.observe(node as Element)
      mapObserverRef.current = observer
    },
    [anchors.map]
  )

  useEffect(() => () => mapObserverRef.current?.disconnect(), [])

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
