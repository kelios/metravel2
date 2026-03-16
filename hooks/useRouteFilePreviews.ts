import { useCallback, useEffect, useMemo, useState } from 'react'
import { Platform } from 'react-native'

import { useThemedColors } from '@/hooks/useTheme'
import { useTravelRouteFiles } from '@/hooks/useTravelRouteFiles'
import { downloadTravelRouteFileBlob } from '@/api/travelRoutes'
import { parseRouteFilePreviews } from '@/utils/routeFileParser'
import { isWebAutomation } from '@/utils/isWebAutomation'
import type { ParsedRoutePreview, TravelRouteFile } from '@/types/travelRoutes'

const SUPPORTED_ROUTE_EXTENSIONS = new Set(['gpx', 'kml'])

export type RoutePreviewItem = {
  file: TravelRouteFile
  preview: ParsedRoutePreview
  color: string
  label: string
}

interface UseRouteFilePreviewsArgs {
  travelId: number | undefined
  canRenderHeavy: boolean
  shouldRender: boolean
  shouldForceRenderMap: boolean
}

export function useRouteFilePreviews({
  travelId,
  canRenderHeavy,
  shouldRender,
  shouldForceRenderMap,
}: UseRouteFilePreviewsArgs) {
  const [routePreviewItems, setRoutePreviewItems] = useState<RoutePreviewItem[]>([])
  const colors = useThemedColors()

  const routeColorPalette = useMemo(
    () => [
      colors.primary,
      colors.info,
      colors.success,
      colors.warning,
      colors.accent,
      colors.primaryDark,
      colors.infoDark,
      colors.successDark,
      colors.warningDark,
      colors.accentDark,
    ],
    [colors]
  )

  const routeFilesEnabled =
    Boolean(travelId) &&
    canRenderHeavy &&
    (Platform.OS !== 'web' || shouldRender || shouldForceRenderMap || isWebAutomation)

  const { data: routeFiles = [] } = useTravelRouteFiles(travelId, {
    enabled: routeFilesEnabled,
  })

  useEffect(() => {
    let active = true

    const loadRouteFiles = async () => {
      if (!canRenderHeavy) return
      if (Platform.OS === 'web' && !shouldRender && !shouldForceRenderMap && !isWebAutomation) return
      if (!travelId) {
        if (active) {
          setRoutePreviewItems([])
        }
        return
      }
      try {
        const supportedFiles = routeFiles.filter((file) => {
          const ext = String(file.ext ?? file.original_name?.split('.').pop() ?? '')
            .toLowerCase()
            .replace(/^\./, '')
          return SUPPORTED_ROUTE_EXTENSIONS.has(ext)
        })

        if (supportedFiles.length === 0) {
          setRoutePreviewItems([])
          return
        }

        const parsedResults = await Promise.allSettled(
          supportedFiles.map(async (file, index) => {
            const ext = String(file.ext ?? file.original_name?.split('.').pop() ?? '')
              .toLowerCase()
              .replace(/^\./, '')
            const downloaded = await downloadTravelRouteFileBlob(travelId, file.id)
            const previews = parseRouteFilePreviews(downloaded.text, ext)
            const validPreviews = previews.filter((preview) => (preview?.linePoints?.length ?? 0) >= 2)
            if (validPreviews.length === 0) return [] as RoutePreviewItem[]

            return validPreviews.map((preview, previewIndex) => ({
              file,
              preview,
              color: routeColorPalette[(index + previewIndex) % routeColorPalette.length],
              label:
                validPreviews.length > 1
                  ? `${file.original_name || 'Маршрут'} • трек ${previewIndex + 1}`
                  : file.original_name || 'Маршрут',
            }))
          })
        )

        if (!active) return

        const readyItems = parsedResults
          .flatMap((result) => (result.status === 'fulfilled' ? result.value : []))
          .filter((item): item is RoutePreviewItem => Boolean(item))

        setRoutePreviewItems(readyItems)
      } catch {
        if (active) {
          setRoutePreviewItems([])
        }
      }
    }

    void loadRouteFiles()
    return () => {
      active = false
    }
  }, [canRenderHeavy, routeColorPalette, routeFiles, shouldForceRenderMap, shouldRender, travelId])

  const resetRoutePreviewItems = useCallback(() => setRoutePreviewItems([]), [])

  return {
    routePreviewItems,
    resetRoutePreviewItems,
    primaryRoutePreview: routePreviewItems[0]?.preview ?? null,
  }
}
