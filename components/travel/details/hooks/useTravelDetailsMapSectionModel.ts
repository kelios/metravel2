import { useCallback, useEffect, useState } from 'react'
import { Alert, Platform } from 'react-native'

import { METRICS } from '@/constants/layout'
import type { TravelRouteFile } from '@/types/travelRoutes'
import type { Travel } from '@/types/types'
import { buildTravelRouteDownloadPath, downloadTravelRouteFileBlob } from '@/api/travelRoutes'
import { downloadBlobOnWeb } from '@/utils/downloadUrlOnWeb'
import { openExternalUrlInNewTab } from '@/utils/externalLinks'
import { useTravelDetailsMapSectionHintsModel } from './useTravelDetailsMapSectionHintsModel'

function getTravelDetailsMapSectionFlags(params: {
  forceOpenKey: string | null
  mapOpenTrigger: number
  width: number
}) {
  return {
    isMobileWeb: Platform.OS === 'web' && params.width <= METRICS.breakpoints.tablet,
    shouldForceRenderExcursions: params.forceOpenKey === 'excursions',
    shouldForceRenderMap:
      params.forceOpenKey === 'map' ||
      params.forceOpenKey === 'points' ||
      params.mapOpenTrigger > 0,
  }
}

function getTravelDetailsMapSectionResetState() {
  return {
    downloadingRouteId: null,
    highlightedPoint: null,
    mapOpenTrigger: 0,
    mapOpened: false,
    mapResizeTrigger: 0,
    weatherVisible: false,
  }
}

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
  const { isMobileWeb, shouldForceRenderExcursions, shouldForceRenderMap } =
    getTravelDetailsMapSectionFlags({
      forceOpenKey,
      mapOpenTrigger,
      width,
    })

  useEffect(() => {
    const nextState = getTravelDetailsMapSectionResetState()
    setHighlightedPoint(nextState.highlightedPoint)
    setMapOpenTrigger(nextState.mapOpenTrigger)
    setMapOpened(nextState.mapOpened)
    setMapResizeTrigger(nextState.mapResizeTrigger)
    setWeatherVisible(nextState.weatherVisible)
    setDownloadingRouteId(nextState.downloadingRouteId)
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
      const ext = String(file.ext ?? '').replace(/^\./, '') || 'gpx'
      const filename = file.original_name || `route-${file.id}.${ext}`

      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const response = await downloadTravelRouteFileBlob(travel.id, file.id)
        const blob = new Blob([response.text], {
          type: response.contentType || 'application/octet-stream',
        })
        const started = downloadBlobOnWeb(blob, response.filename || filename)
        if (!started) {
          notifyDownloadUnavailable()
        }
        return
      }

      const rawUrl =
        String(file.download_url ?? '').trim() ||
        buildTravelRouteDownloadPath(travel.id, file.id)

      await openExternalUrlInNewTab(rawUrl, {
        allowRelative: true,
        baseUrl: (process.env.EXPO_PUBLIC_API_URL as string) || undefined,
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
