import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Platform } from 'react-native'

import { useRouteFilePreviews } from '@/hooks/useRouteFilePreviews'
import { useKeyPointLabels } from '@/hooks/useKeyPointLabels'
import type { Travel } from '@/types/types'
import type { AnchorsMap } from '../TravelDetailsTypes'
import {
  getTravelDetailsMapSectionContentFlags,
  hasTravelDetailsMapData,
} from './travelDetailsMapSectionContentModel'

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
  // The route-file preview pulls the GPX/KML track (hundreds of KB) only to draw
  // the polyline on the map. On web the map sits below the fold, so we wait for
  // the section to approach the viewport before downloading — otherwise it
  // competes for bandwidth during LCP (FE-1). Native renders eagerly as before.
  const [mapNearViewport, setMapNearViewport] = useState(Platform.OS !== 'web')
  const mapObserverRef = useRef<IntersectionObserver | null>(null)

  const { isLoading, shouldRender, shouldRenderMapContent } =
    getTravelDetailsMapSectionContentFlags({
      canRenderHeavy,
      mapNearViewport,
      mapOpened,
      shouldForceRenderMap,
    })

  const routePreviewShouldRender =
    shouldRender && (mapNearViewport || mapOpened || shouldForceRenderMap)

  const {
    routeFilePoints,
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
    // On web the viewport gate is sticky once the map scrolls into view. An SPA
    // navigation reuses this hook instance, so reset it per travel — otherwise the
    // next travel mounts the heavy Leaflet map immediately, bypassing scroll-into-view.
    if (Platform.OS === 'web') setMapNearViewport(false)
  }, [travel.id, travel.slug, resetRoutePreviewItems, resetKeyPointLabels])

  const hasMapData = useMemo(
    () =>
      hasTravelDetailsMapData({
        hasEmbeddedCoords,
        hasTravelAddressPoints,
        routeFilePoints,
        routePreviewItems,
      }),
    [hasEmbeddedCoords, hasTravelAddressPoints, routeFilePoints, routePreviewItems]
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
    routeFilePoints,
    routePreviewItems,
    setMapSectionRef,
    shouldRender,
    shouldRenderMapContent,
  }
}
