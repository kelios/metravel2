import { useMemo } from 'react'
import { translate as i18nT } from '@/i18n'
import { splitRouteLineSegments } from '@/utils/routeFileParser'


export function useTravelRouteMapBlockModel({
  downloadingRouteId,
  handleDownloadRoute,
  hasMapData,
  isRoutePreviewLoading,
  keyPointLabels,
  routePreviewItems,
}: {
  downloadingRouteId: number | null
  handleDownloadRoute: (file: any) => void
  hasMapData: boolean
  isRoutePreviewLoading: boolean
  keyPointLabels: any
  routePreviewItems: any[]
}) {
  const shouldShowMapLoadingState = !hasMapData && isRoutePreviewLoading

  const routeLines = useMemo(
    () =>
      routePreviewItems.flatMap((item) =>
        // One polyline per teleport-free segment so stitched jumps (e.g. <wpt>
        // fragments merged into the track) never draw a straight connector.
        splitRouteLineSegments(item.preview?.linePoints ?? [])
          .filter((segment) => segment.length >= 2)
          .map((segment) => ({
            color: item.color,
            coords: segment.map((point: any) => {
              const [latStr, lngStr] = String(point.coord ?? '').replace(/;/g, ',').split(',')
              return [Number(latStr), Number(lngStr)] as [number, number]
            }),
          }))
      ),
    [routePreviewItems]
  )

  const shouldShowRouteLine = useMemo(
    () => routePreviewItems.some((item) => (item.preview?.linePoints.length ?? 0) >= 2),
    [routePreviewItems]
  )

  const routeProfiles = useMemo(
    () =>
      routePreviewItems.map((item, index) => ({
        key: `route-profile-${item.file.id}-${index}`,
        isDownloadPending: downloadingRouteId === item.file.id,
        keyPointLabels: index === 0 ? keyPointLabels : undefined,
        lineColor: item.color,
        onDownloadTrack: () => handleDownloadRoute(item.file),
        preview: item.preview,
        title: i18nT('travel:components.travel.details.hooks.useTravelRouteMapBlockModel.profil_vysot_value1_3d42e1d4', { value1: item.label || `Трек ${index + 1}` }),
      })),
    [downloadingRouteId, handleDownloadRoute, keyPointLabels, routePreviewItems]
  )

  return {
    routeLines,
    routeProfiles,
    shouldShowMapLoadingState,
    shouldShowRouteLine,
  }
}
