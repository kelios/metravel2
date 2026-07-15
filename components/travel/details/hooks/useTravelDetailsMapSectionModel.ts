import { useCallback, useEffect, useRef, useState } from 'react'
import { Alert, Platform } from 'react-native'
import * as FileSystem from 'expo-file-system/legacy'
import * as Sharing from 'expo-sharing'

import { METRICS } from '@/constants/layout'
import type { TravelRouteFile } from '@/types/travelRoutes'
import type { Travel } from '@/types/types'
import { downloadTravelRouteFileBlob } from '@/api/travelRoutes'
import { downloadBlobOnWeb } from '@/utils/downloadUrlOnWeb'
import { useTravelDetailsMapSectionHintsModel } from './useTravelDetailsMapSectionHintsModel'
import { translate as i18nT } from '@/i18n'


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
  const lastForcedMapKeyRef = useRef<string | null>(null)

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
    lastForcedMapKeyRef.current = null
    setHighlightedPoint(nextState.highlightedPoint)
    setMapOpenTrigger(nextState.mapOpenTrigger)
    setMapOpened(nextState.mapOpened)
    setMapResizeTrigger(nextState.mapResizeTrigger)
    setWeatherVisible(nextState.weatherVisible)
    setDownloadingRouteId(nextState.downloadingRouteId)
  }, [travel.id, travel.slug])

  useEffect(() => {
    const shouldOpenMap = forceOpenKey === 'map' || forceOpenKey === 'points'
    if (!shouldOpenMap) {
      lastForcedMapKeyRef.current = forceOpenKey
      return
    }
    if (lastForcedMapKeyRef.current === forceOpenKey) return

    lastForcedMapKeyRef.current = forceOpenKey
    setMapOpenTrigger((prev) => prev + 1)
  }, [forceOpenKey])

  const notifyDownloadUnavailable = useCallback(() => {
    if (Platform.OS === 'web') {
      try {
        window.alert?.(i18nT('travel:components.travel.details.hooks.useTravelDetailsMapSectionModel.fayl_marshruta_nedostupen_dlya_skachivaniya_eb34c600'))
      } catch {
        return
      }
      return
    }
    Alert.alert?.(i18nT('travel:components.travel.details.hooks.useTravelDetailsMapSectionModel.nedostupno_72fbad4f'), i18nT('travel:components.travel.details.hooks.useTravelDetailsMapSectionModel.fayl_marshruta_nedostupen_dlya_skachivaniya_eb34c600'))
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

      const response = await downloadTravelRouteFileBlob(travel.id, file.id)

      const cacheDir =
        (FileSystem as { cacheDirectory?: string }).cacheDirectory ??
        String((FileSystem as any).Paths?.cache?.uri ?? '')

      if (!cacheDir) {
        notifyDownloadUnavailable()
        return
      }

      const uri = `${cacheDir}${response.filename || filename}`
      await FileSystem.writeAsStringAsync(uri, response.text)

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: response.contentType || 'application/octet-stream',
          dialogTitle: i18nT('travel:components.travel.details.hooks.useTravelDetailsMapSectionModel.sohranit_fayl_marshruta_cdda8b31'),
        })
      } else {
        notifyDownloadUnavailable()
      }
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
