// Формат строки сводки маршрута мобильного оверлея карты: дистанция, оценка
// времени по профилю транспорта и её человеческая подпись. Вынесено из
// MapMobileTopOverlay.tsx: это чистые функции без React, а сам оверлей — файл на
// границе порога guard-file-complexity-changed (#1699).
//
// Ключи i18n остаются за оверлеем (`...MapMobileTopOverlay.value1_*`): подписи
// принадлежат его строке, а не этому модулю.
import { formatDistanceMeters, ROUTE_DISTANCE_FORMAT } from '@/utils/distanceCalculator'
import { translate as i18nT } from '@/i18n'
import { formatInteger } from '@/i18n/format'

import { TRANSPORT_SPEED_KMH, type TransportMode } from '../transportModes'

/** Пустая строка для нулевой/неизвестной дистанции — чип метрики не рисуется. */
export function formatRouteDistance(meters: number): string {
  if (!Number.isFinite(meters) || meters <= 0) return ''
  return formatDistanceMeters(meters, ROUTE_DISTANCE_FORMAT)
}

/** Оценка времени, когда провайдер маршрута его не вернул. */
export function estimateRouteDurationSeconds(meters: number, mode: TransportMode): number {
  if (!Number.isFinite(meters) || meters <= 0) return 0
  const speed = TRANSPORT_SPEED_KMH[mode] ?? TRANSPORT_SPEED_KMH.car
  return Math.round((meters / 1000 / speed) * 3600)
}

export function formatRouteDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return ''
  const totalMinutes = Math.max(1, Math.round(seconds / 60))
  if (totalMinutes < 60) return i18nT('map:components.MapPage.MapMobile.MapMobileTopOverlay.value1_min_b586289b', { value1: formatInteger(totalMinutes) })
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (minutes === 0) return i18nT('map:components.MapPage.MapMobile.MapMobileTopOverlay.value1_ch_53da1ce7', { value1: formatInteger(hours) })
  return i18nT('map:components.MapPage.MapMobile.MapMobileTopOverlay.value1_ch_value2_min_0833ca5d', { value1: formatInteger(hours), value2: formatInteger(minutes) })
}

/**
 * Полная фраза сводки для скринридера. На экране подпись нормального состояния
 * не рисуется (её смысл несут цифры), но озвучивать ряд как «3,6 км, 11 мин»
 * без «Маршрут готов» — терять состояние, поэтому здесь она всегда есть.
 */
export function buildRouteSummaryLabel(
  status: string | null,
  distanceText: string,
  durationText: string,
): string {
  return [status, distanceText, durationText].filter(Boolean).join(', ')
}

/** Метрики сводки из сырых значений стора: дистанция и время + их подписи. */
export function resolveRouteMetrics(
  routeDistance: number | null | undefined,
  routeDuration: number | null | undefined,
  transportMode: TransportMode,
) {
  const distanceMeters =
    typeof routeDistance === 'number' && Number.isFinite(routeDistance) ? routeDistance : 0
  const durationSeconds =
    typeof routeDuration === 'number' && Number.isFinite(routeDuration) && routeDuration > 0
      ? routeDuration
      : estimateRouteDurationSeconds(distanceMeters, transportMode)
  return {
    distanceMeters,
    durationSeconds,
    distanceText: formatRouteDistance(distanceMeters),
    durationText: formatRouteDuration(durationSeconds),
  }
}
