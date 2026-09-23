// utils/routePointArrivalMode.ts
// Способ, которым добираются до точки от предыдущей (#2055, контракт бэкенда
// `TripRoutePoint.arrival_mode`). Разбор и payload живут здесь по той же
// причине, что день похода в `routePointDay.ts`: правила нужны и нормализатору
// ответа, и PUT маршрута, а слой `api/` не импортирует `components/`.
import type { RoutePoint, RoutePointArrivalMode } from '@/api/plannedTripsTypes'

const ARRIVAL_MODES: readonly RoutePointArrivalMode[] = ['train', 'flight', 'bus', 'ferry', 'transfer']

/**
 * Пустая строка бэкенда — «как вся поездка», в домене это `null`. Незнакомое
 * значение тоже `null`: отправить его обратно нельзя, бэкенд отвечает на него
 * 400 и отклоняет весь маршрут.
 */
export const arrivalModeFromBe = (raw: unknown): RoutePointArrivalMode | null =>
  typeof raw === 'string' && (ARRIVAL_MODES as readonly string[]).includes(raw)
    ? (raw as RoutePointArrivalMode)
    : null

/**
 * PUT маршрута атомарный: пропущенный `arrival_mode` бэкенд пишет как `''`,
 * и сохранение из конструктора стирало бы переезды. Поэтому ключ уходит всегда.
 * У первой точки предыдущей нет, контракт #2055 держит там `''`.
 */
export const arrivalModePayload = (
  point: Pick<RoutePoint, 'arrivalMode'>,
  index: number,
): { arrival_mode: RoutePointArrivalMode | '' } => ({
  arrival_mode: index === 0 ? '' : arrivalModeFromBe(point.arrivalMode) ?? '',
})
