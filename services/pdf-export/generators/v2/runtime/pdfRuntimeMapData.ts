import type { TravelForBook } from '@/types/pdf-export'
import type { ParsedRoutePreview } from '@/types/travelRoutes'
import type { NormalizedLocation } from './types'

type RouteLineCoord = [number, number]

type BuildPdfMapRuntimeDataParams = {
  travel: TravelForBook
  locations: NormalizedLocation[]
  buildRouteSvg: (
    locations: NormalizedLocation[],
    options?: { routeLineCoords?: RouteLineCoord[] }
  ) => string
  calculateRouteDistanceFromPreview: (preview: ParsedRoutePreview) => number
  generateLocationQRCodes: (locations: NormalizedLocation[]) => Promise<string[]>
  buildLocationCards: (locations: NormalizedLocation[], qrCodes: string[]) => string[]
  getLeafletRouteSnapshot: () => Promise<
    (
      points: Array<{ lat: number; lng: number; label?: string }>,
      options: { width: number; height: number; routeLine?: RouteLineCoord[] }
    ) => Promise<string | null>
  >
}

export type PdfMapRuntimeData = {
  snapshotDataUrl: string | null
  mapSvg: string
  locationCards: string[]
  routeInfo?: string
  routePreview: ParsedRoutePreview | null
}

export async function buildPdfMapRuntimeData({
  travel,
  locations,
  buildRouteSvg,
  calculateRouteDistanceFromPreview,
  generateLocationQRCodes,
  buildLocationCards,
  getLeafletRouteSnapshot,
}: BuildPdfMapRuntimeDataParams): Promise<PdfMapRuntimeData> {
  const pointsWithCoords = locations.filter(
    (location) => typeof location.lat === 'number' && typeof location.lng === 'number'
  )

  let routePreview: ParsedRoutePreview | null = null
  let routeLineCoords: RouteLineCoord[] = []
  let routeInfo: string | undefined

  try {
    const { listTravelRouteFiles, downloadTravelRouteFileBlob } = await import('@/api/travelRoutes')
    const { parseRouteFilePreview } = await import('@/utils/routeFileParser')

    const routeFiles = await listTravelRouteFiles(travel.id)
    const supportedExts = new Set(['gpx', 'kml'])
    const supportedFile = routeFiles.find((f) => {
      const ext = String(f.ext ?? f.original_name?.split('.').pop() ?? '').toLowerCase().replace(/^\./, '')
      return supportedExts.has(ext)
    })

    if (supportedFile) {
      const ext = String(supportedFile.ext ?? supportedFile.original_name?.split('.').pop() ?? '')
        .toLowerCase()
        .replace(/^\./, '')
      const downloaded = await downloadTravelRouteFileBlob(travel.id, supportedFile.id)
      const parsed = parseRouteFilePreview(downloaded.text, ext)

      if (parsed.linePoints.length >= 2) {
        routePreview = parsed
        routeLineCoords = parsed.linePoints
          .map((point) => {
            const [latStr, lngStr] = String(point.coord ?? '').replace(/;/g, ',').split(',')
            const lat = Number(latStr)
            const lng = Number(lngStr)
            if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
            return [lat, lng] as RouteLineCoord
          })
          .filter((coord): coord is RouteLineCoord => coord !== null)

        const distanceKm = calculateRouteDistanceFromPreview(parsed)
        if (distanceKm > 0) {
          routeInfo = `${supportedFile.original_name || 'Загруженный маршрут'} • ${Math.round(distanceKm * 10) / 10} км`
        } else {
          routeInfo = supportedFile.original_name || 'Загруженный маршрут'
        }
      }
    }
  } catch {
    // Ignore route-file loading errors and fall back to point-only rendering.
  }

  const mapSvg = buildRouteSvg(locations, { routeLineCoords })
  const hasRouteLineForMap = routeLineCoords.length >= 2
  const mapPoints = pointsWithCoords.map((location) => ({
    lat: location.lat as number,
    lng: location.lng as number,
    label: location.address,
  }))
  const mapRouteOpts = hasRouteLineForMap ? routeLineCoords : undefined

  let snapshotDataUrl: string | null = null

  if (mapPoints.length || hasRouteLineForMap) {
    try {
      const { generateCanvasMapSnapshot } = await import('@/utils/mapImageGenerator')
      snapshotDataUrl = await generateCanvasMapSnapshot(mapPoints, {
        width: 1600,
        height: 1040,
        routeLine: mapRouteOpts,
      })
    } catch {
      snapshotDataUrl = null
    }
  }

  if (!snapshotDataUrl && (mapPoints.length || hasRouteLineForMap)) {
    try {
      const generateLeafletRouteSnapshot = await getLeafletRouteSnapshot()
      snapshotDataUrl = await generateLeafletRouteSnapshot(mapPoints, {
        width: 1600,
        height: 1040,
        routeLine: mapRouteOpts,
      })
    } catch {
      snapshotDataUrl = null
    }
  }

  const locationQRCodes = await generateLocationQRCodes(locations)
  const locationCards = buildLocationCards(locations, locationQRCodes)

  return {
    snapshotDataUrl,
    mapSvg,
    locationCards,
    routeInfo,
    routePreview,
  }
}
