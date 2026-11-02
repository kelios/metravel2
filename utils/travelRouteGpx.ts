import type { Travel } from '@/types/types'
import { buildGpx } from '@/utils/routeExport/gpx'
import { safeFileBaseName } from '@/utils/routeExport/normalize'
import type { RouteExportResult } from '@/utils/routeExport/types'
import { buildCanonicalUrl } from '@/utils/seo'
import { buildTravelPath } from '@/utils/travelSeo'
import { getTravelRouteWaypoints } from '@/utils/travelNavigatorLinks'

type TravelRouteGpxSource = Pick<Travel, 'id' | 'slug' | 'name' | 'travelAddress'> & {
  userName?: string | null
}

const normalizeText = (value: unknown) => String(value ?? '').replace(/\s+/g, ' ').trim()

/**
 * #2902 — «Скачать GPX» на странице маршрута: GPX 1.1 из точек статьи.
 * `<metadata>` (название, автор, ссылка на страницу), один `<wpt>` на точку и
 * `<rte>` с `<rtept>` в том же порядке — навигатор импортирует это как маршрут.
 * Чистая функция: сохранение файла делает `saveRouteExportFile`.
 */
export const buildTravelRouteGpx = (
  travel: TravelRouteGpxSource,
  options: { time?: string } = {},
): RouteExportResult => {
  const name = normalizeText(travel.name) || 'Metravel route'
  const path = buildTravelPath(travel)
  const result = buildGpx({
    name,
    sourceName: 'Metravel',
    sourceUrl: path ? buildCanonicalUrl(path) : undefined,
    author: normalizeText(travel.userName) || undefined,
    waypoints: getTravelRouteWaypoints(travel.travelAddress),
    includeRoute: true,
    time: options.time,
  })
  const slug = normalizeText(travel.slug)
  return {
    ...result,
    filename: `${safeFileBaseName(slug || name)}.gpx`,
  }
}
