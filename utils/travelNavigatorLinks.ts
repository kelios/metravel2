import type { RouteWaypoint } from '@/utils/routeExport/types'
import { buildNavigatorUrl, type NavigatorProvider } from '@/utils/routeExport/navigator'
import { getExportableTravelPointWaypoints } from '@/utils/travelPointsExport'

/**
 * #2902 — «Открыть в навигаторе» на странице маршрута. Порядок меню — макет
 * docs/features/ux-audit-2026-11-mocks.md §3. URL строит общий
 * `utils/routeExport/navigator` (тот же модуль, что у экспорта поездки), здесь —
 * только выбор провайдеров и порог видимости для статьи.
 */
export type TravelNavigatorProvider = Extract<NavigatorProvider, 'google' | 'yandex' | 'apple' | 'osmand'>

export const TRAVEL_NAVIGATOR_PROVIDERS: readonly TravelNavigatorProvider[] = [
  'google',
  'yandex',
  'apple',
  'osmand',
]

/** Кнопки маршрута показываются от двух точек с валидными координатами. */
export const TRAVEL_ROUTE_MIN_POINTS = 2

/** Точки статьи в порядке автора; парсер координат — общий с экспортом GPX/KML блока «Точки». */
export const getTravelRouteWaypoints = (travelAddress: unknown): RouteWaypoint[] =>
  getExportableTravelPointWaypoints(travelAddress)

export const hasTravelRouteForNavigation = (waypoints: readonly RouteWaypoint[]): boolean =>
  waypoints.length >= TRAVEL_ROUTE_MIN_POINTS

export const buildTravelNavigatorUrl = (
  provider: TravelNavigatorProvider,
  waypoints: readonly RouteWaypoint[],
): string | null => {
  if (!hasTravelRouteForNavigation(waypoints)) return null
  return buildNavigatorUrl(provider, { waypoints: [...waypoints] }, { mode: 'driving' })
}
