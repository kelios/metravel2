/**
 * «Рядом с маршрутом» (#2911): статьи и квесты сайта в коридоре маршрута планировщика
 * из индекса metravel-assist (`POST /ai/near-route`). Карточки `AiPickCard` в
 * прокручиваемом ряду `CardRail` (как «Подобрать по описанию» на `/search`), под
 * каждой — «Добавить в маршрут»: точка с координатами источника уходит в
 * `RouteBuilder.handleAddAiPoint`. Источники, уже стоящие в маршруте (по `placeId`
 * статьи или добавленные отсюда), скрыты. Пустой ответ, отказ службы, маршрут без
 * координат — блока нет. Модуль живёт только под `EXPO_PUBLIC_AI_PICKS`: `RouteBuilder`
 * грузит его отложенным чанком по литеральному флагу (#2738), без флага запросов к
 * `/ai/*` страница не делает.
 */
import React from 'react'

import type { AiNearRoutePoint, AiPickItem } from '@/api/aiPicks'
import type { RoutePoint } from '@/api/plannedTripsTypes'

export const NEAR_ROUTE_LIMIT = 8

export type RouteNearSuggestionsProps = {
  route: RoutePoint[]
  /** Точка маршрута из карточки: координаты и привязка к источнику. */
  onAddPoint: (item: AiPickItem) => void
  testID?: string
}

export const aiPickSourceKey = (item: Pick<AiPickItem, 'type' | 'source_id'>): string => `${item.type}:${item.source_id}`

/** Точки маршрута с координатами в порядке маршрута: `[lng, lat]` домена → `{lat, lng}` службы. */
export function routeGeoPoints(route: RoutePoint[]): AiNearRoutePoint[] {
  const points: AiNearRoutePoint[] = []
  for (const point of route) {
    const [lng, lat] = point.coordinates ?? []
    if (typeof lat === 'number' && typeof lng === 'number' && Number.isFinite(lat) && Number.isFinite(lng)) points.push({ lat, lng })
  }
  return points
}

const EmptyNearSuggestions = () => null
const RouteNearSuggestions = React.lazy<React.ComponentType<RouteNearSuggestionsProps>>(() =>
  process.env.EXPO_PUBLIC_AI_PICKS
    ? import('@/components/aiPicks/RouteNearSuggestionsRuntime')
    : Promise.resolve({ default: EmptyNearSuggestions }),
)

export default RouteNearSuggestions
