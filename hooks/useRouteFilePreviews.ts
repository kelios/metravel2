import { useCallback, useEffect, useMemo, useState } from 'react'
import { Platform } from 'react-native'

import { DESIGN_COLORS } from '@/constants/designSystem'
import { useThemedColors } from '@/hooks/useTheme'
import { useTravelRouteFiles } from '@/hooks/useTravelRouteFiles'
import { downloadTravelRouteFileBlob } from '@/api/travelRoutes'
import { buildElevationProfile, parseRouteFileGeometry, sanitizeRoutePreview } from '@/utils/routeFileParser'
import { isWebAutomation } from '@/utils/isWebAutomation'
import type { ParsedRoutePreview, TravelRouteFile } from '@/types/travelRoutes'
import { translate as i18nT } from '@/i18n'


const SUPPORTED_ROUTE_EXTENSIONS = new Set(['gpx', 'kml'])

export type RoutePreviewItem = {
  file: TravelRouteFile
  preview: ParsedRoutePreview
  color: string
  label: string
}

export type RouteFilePointItem = {
  id: string
  coord: string
  name: string
}

const areLinePointsEqual = (
  prevPoints: ParsedRoutePreview['linePoints'] | undefined,
  nextPoints: ParsedRoutePreview['linePoints'] | undefined
) => {
  const prev = Array.isArray(prevPoints) ? prevPoints : []
  const next = Array.isArray(nextPoints) ? nextPoints : []
  if (prev.length !== next.length) return false

  for (let i = 0; i < prev.length; i += 1) {
    const prevPoint = prev[i]
    const nextPoint = next[i]
    if (
      String(prevPoint?.coord ?? '') !== String(nextPoint?.coord ?? '') ||
      Number(prevPoint?.elevation ?? NaN) !== Number(nextPoint?.elevation ?? NaN)
    ) {
      return false
    }
  }

  return true
}

const areRoutePreviewItemsEqual = (prevItems: RoutePreviewItem[], nextItems: RoutePreviewItem[]) => {
  if (prevItems.length !== nextItems.length) return false

  for (let i = 0; i < prevItems.length; i += 1) {
    const prev = prevItems[i]
    const next = nextItems[i]

    if (
      prev?.file?.id !== next?.file?.id ||
      prev?.color !== next?.color ||
      prev?.label !== next?.label ||
      !areLinePointsEqual(prev?.preview?.linePoints, next?.preview?.linePoints)
    ) {
      return false
    }
  }

  return true
}

const areRouteFilePointsEqual = (prevPoints: RouteFilePointItem[], nextPoints: RouteFilePointItem[]) => {
  if (prevPoints.length !== nextPoints.length) return false
  return prevPoints.every((point, index) => {
    const nextPoint = nextPoints[index]
    return point.id === nextPoint?.id && point.coord === nextPoint?.coord && point.name === nextPoint?.name
  })
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
  const [routeFilePoints, setRouteFilePoints] = useState<RouteFilePointItem[]>([])
  const [isParsingRouteFiles, setIsParsingRouteFiles] = useState(false)
  const colors = useThemedColors()

  const routeColorPalette = useMemo(
    () => [
      DESIGN_COLORS.routeLine,
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

  const routeFilesEnabled = Boolean(travelId) && canRenderHeavy

  const {
    data: routeFiles = [],
    isLoading: isRouteFilesLoading = false,
    isFetching: isRouteFilesFetching = false,
  } = useTravelRouteFiles(travelId, {
    enabled: routeFilesEnabled,
  })

  const supportedFiles = useMemo(
    () =>
      routeFiles.filter((file) => {
        const ext = String(file.ext ?? file.original_name?.split('.').pop() ?? '')
          .toLowerCase()
          .replace(/^\./, '')
        return SUPPORTED_ROUTE_EXTENSIONS.has(ext)
      }),
    [routeFiles]
  )

  useEffect(() => {
    let active = true

    const loadRouteFiles = async () => {
      if (!canRenderHeavy) {
        if (active) setIsParsingRouteFiles(false)
        return
      }
      if (Platform.OS === 'web' && !shouldRender && !shouldForceRenderMap && !isWebAutomation) {
        if (active) setIsParsingRouteFiles(false)
        return
      }
      if (!travelId) {
        if (active) {
          setIsParsingRouteFiles(false)
          setRoutePreviewItems((prev) => (prev.length > 0 ? [] : prev))
          setRouteFilePoints((prev) => (prev.length > 0 ? [] : prev))
        }
        return
      }
      if (supportedFiles.length === 0) {
        if (active) {
          setIsParsingRouteFiles(false)
          setRoutePreviewItems((prev) => (prev.length > 0 ? [] : prev))
          setRouteFilePoints((prev) => (prev.length > 0 ? [] : prev))
        }
        return
      }
      try {
        if (active) setIsParsingRouteFiles(true)

        const parsedResults = await Promise.allSettled(
          supportedFiles.map(async (file, index) => {
            const ext = String(file.ext ?? file.original_name?.split('.').pop() ?? '')
              .toLowerCase()
              .replace(/^\./, '')
            // The backend preview does not retain whether coordinates came from a
            // real line or independent Point/wpt records. Inspect the source XML
            // before trusting line_points so a point-only file cannot become a
            // phantom route. Clean line-only files still use the downsampled server
            // preview; mixed files use the source lines so points never leak into it.
            const downloaded = await downloadTravelRouteFileBlob(travelId, file.id)
            if (!active) return { pointItems: [], previewItems: [] }
            const geometry = parseRouteFileGeometry(downloaded.text, ext)
            const serverPreview = (file.preview?.linePoints?.length ?? 0) >= 2 ? file.preview : null
            const hasValidSourceLine = geometry.lines.some((line) => line.length >= 2)
            const canUseServerPreview = Boolean(serverPreview) && hasValidSourceLine && !geometry.hasIndependentPoints
            const rawPreviews = canUseServerPreview
              ? [serverPreview as ParsedRoutePreview]
              : geometry.lines.map((linePoints) => ({
                  linePoints,
                  elevationProfile: buildElevationProfile(linePoints),
                }))
            if (!active) return { pointItems: [], previewItems: [] }
            // Strip teleport-stitched <wpt> fragments (straight lines + inflated
            // distance) the backend preview can carry; no-op for clean tracks.
            const previews = rawPreviews.map(sanitizeRoutePreview)
            const validPreviews = previews.filter((preview) => (preview?.linePoints?.length ?? 0) >= 2)

            return {
              pointItems: geometry.points.map((point, pointIndex) => ({
                id: `route-file-${file.id}-point-${pointIndex}`,
                coord: point.coord,
                name: point.name,
              })),
              previewItems: validPreviews.map((preview, previewIndex) => ({
                file,
                preview,
                color: routeColorPalette[(index + previewIndex) % routeColorPalette.length],
                label:
                  validPreviews.length > 1
                    ? i18nT('shared:hooks.useRouteFilePreviews.value1_trek_value2_f84d09eb', {
                        value1: file.original_name || i18nT('sharedStatic:route.fileFallback'),
                        value2: previewIndex + 1,
                      })
                    : file.original_name || i18nT('sharedStatic:route.fileFallback'),
              })),
            }
          })
        )

        if (!active) return

        const readyResults = parsedResults.flatMap((result) =>
          result.status === 'fulfilled' ? [result.value] : []
        )
        const readyItems = readyResults
          .flatMap((result) => result.previewItems)
          .filter((item): item is RoutePreviewItem => Boolean(item))
        const readyPoints = readyResults.flatMap((result) => result.pointItems)

        setRoutePreviewItems((prev) => (areRoutePreviewItemsEqual(prev, readyItems) ? prev : readyItems))
        setRouteFilePoints((prev) => (areRouteFilePointsEqual(prev, readyPoints) ? prev : readyPoints))
      } catch {
        if (active) {
          setRoutePreviewItems((prev) => (prev.length > 0 ? [] : prev))
          setRouteFilePoints((prev) => (prev.length > 0 ? [] : prev))
        }
      } finally {
        if (active) {
          setIsParsingRouteFiles(false)
        }
      }
    }

    void loadRouteFiles()
    return () => {
      active = false
    }
  }, [canRenderHeavy, routeColorPalette, shouldForceRenderMap, shouldRender, supportedFiles, travelId])

  const resetRoutePreviewItems = useCallback(() => {
    setRoutePreviewItems([])
    setRouteFilePoints([])
  }, [])

  return {
    routeFilePoints,
    routePreviewItems,
    resetRoutePreviewItems,
    primaryRoutePreview: routePreviewItems[0]?.preview ?? null,
    hasSupportedRouteFiles: supportedFiles.length > 0,
    isRoutePreviewLoading: routeFilesEnabled && (isRouteFilesLoading || isRouteFilesFetching || isParsingRouteFiles),
  }
}
