import { useCallback, useEffect, useState } from 'react'
import { Alert, Platform } from 'react-native'

import { METRICS } from '@/constants/layout'
import type { TravelRouteFile } from '@/types/travelRoutes'
import type { Travel } from '@/types/types'
import { buildTravelRouteDownloadPath } from '@/api/travelRoutes'
import { openExternalUrlInNewTab } from '@/utils/externalLinks'
import { useTravelDetailsMapSectionHintsModel } from './useTravelDetailsMapSectionHintsModel'

interface UseTravelDetailsMapSectionModelArgs {
  travel: Travel
  forceOpenKey: string | null
  scrollToMapSection: () => void
  width: number
}

export function useTravelDetailsMapSectionModel({
  travel,
  forceOpenKey,
  scrollToMapSection,
  width,
}: UseTravelDetailsMapSectionModelArgs) {
  const [highlightedPoint, setHighlightedPoint] = useState<{ coord: string; key: string } | null>(null)
  const [mapOpenTrigger, setMapOpenTrigger] = useState(0)
  const [mapOpened, setMapOpened] = useState(false)
  const [mapResizeTrigger, setMapResizeTrigger] = useState(0)
  const [weatherVisible, setWeatherVisible] = useState(false)
  const [downloadingRouteId, setDownloadingRouteId] = useState<number | null>(null)

  const {
    hasEmbeddedCoords,
    hasTravelAddressPoints,
    placeHints,
    transportHints,
  } = useTravelDetailsMapSectionHintsModel(travel)
  const isMobileWeb = Platform.OS === 'web' && width <= METRICS.breakpoints.tablet

  const shouldForceRenderMap = forceOpenKey === 'map' || forceOpenKey === 'points' || mapOpenTrigger > 0
  const shouldForceRenderExcursions = forceOpenKey === 'excursions'

  useEffect(() => {
    setHighlightedPoint(null)
    setMapOpenTrigger(0)
    setMapOpened(false)
    setMapResizeTrigger(0)
    setWeatherVisible(false)
    setDownloadingRouteId(null)
  }, [travel.id, travel.slug])

  const notifyDownloadUnavailable = useCallback(() => {
    if (Platform.OS === 'web') {
      try {
        window.alert?.('Файл маршрута недоступен для скачивания')
      } catch {
        return
      }
      return
    }
    Alert.alert?.('Недоступно', 'Файл маршрута недоступен для скачивания')
  }, [])

  const handleDownloadRoute = useCallback(async (file: TravelRouteFile) => {
    if (downloadingRouteId === file.id) return
    if (!travel?.id) {
      notifyDownloadUnavailable()
      return
    }

    setDownloadingRouteId(file.id)
    try {
      const rawUrl =
        String(file.download_url ?? '').trim() ||
        buildTravelRouteDownloadPath(travel.id, file.id)
      await openExternalUrlInNewTab(rawUrl, {
        allowRelative: true,
        baseUrl:
          Platform.OS === 'web' && typeof window !== 'undefined'
            ? window.location.origin
            : (process.env.EXPO_PUBLIC_API_URL as string) || undefined,
      })
    } catch {
      notifyDownloadUnavailable()
    } finally {
      setDownloadingRouteId(null)
    }
  }, [downloadingRouteId, notifyDownloadUnavailable, travel?.id])

  const handlePointCardPress = useCallback((point: any) => {
    const coord = String(point?.coord ?? '').trim()
    if (!coord) return
    setHighlightedPoint({ coord, key: `${coord}-${Date.now()}` })
    setMapOpenTrigger((prev) => prev + 1)
    scrollToMapSection()
  }, [scrollToMapSection])

  const handleMapOpenChange = useCallback((open: boolean) => {
    if (Platform.OS !== 'web') return
    if (!open) return
    setMapOpened(true)
    setMapResizeTrigger((prev) => prev + 1)
  }, [])

  return {
    downloadingRouteId,
    handleDownloadRoute,
    handleMapOpenChange,
    handlePointCardPress,
    hasEmbeddedCoords,
    hasTravelAddressPoints,
    highlightedPoint,
    isMobileWeb,
    mapOpenTrigger,
    mapOpened,
    mapResizeTrigger,
    placeHints,
    setWeatherVisible,
    shouldForceRenderExcursions,
    shouldForceRenderMap,
    transportHints,
    weatherVisible,
  }
}
