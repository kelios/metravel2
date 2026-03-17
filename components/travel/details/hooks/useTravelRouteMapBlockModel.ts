import { useMemo } from 'react'

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
      routePreviewItems.map((item) => ({
        color: item.color,
        coords: (item.preview?.linePoints ?? []).map((point: any) => {
          const [latStr, lngStr] = String(point.coord ?? '').replace(/;/g, ',').split(',')
          return [Number(latStr), Number(lngStr)] as [number, number]
        }),
      })),
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
        title: `Профиль высот: ${item.label || `Трек ${index + 1}`}`,
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
