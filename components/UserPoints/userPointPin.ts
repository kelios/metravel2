import type { ImportedPoint, UserPointPin } from '@/types/userPoints'

import { normalizeCategoryIdsFromPoint } from './pointsListLogic'

/**
 * Общий staleTime коллекции пинов `userPointsAll`: одинаковый у экрана «Мои
 * точки» и у ♥-тогглов карты/мастера travel. Живёт в лёгком модуле пина, чтобы
 * карта не тянула модуль экрана (`usePointsDataModel`).
 */
export const USER_POINTS_COLLECTION_STALE_TIME_MS = 10 * 60 * 1000

/**
 * Полная карточка → лёгкий пин (#3161): мутации пишут в общую коллекцию
 * `userPointsAll` ту же форму, что отдаёт `fields=pins`, иначе коллекция
 * смешивала бы 110-байтные пины с 440-байтными карточками.
 */
export const toUserPointPin = (point: ImportedPoint | UserPointPin): UserPointPin => {
  const categoryIds = normalizeCategoryIdsFromPoint(point)
    .map((id) => Number(id))
    .filter((id) => Number.isFinite(id) && id > 0)
  return {
    id: Number(point.id),
    latitude: Number(point.latitude),
    longitude: Number(point.longitude),
    color: String(point.color ?? ''),
    status: point.status,
    category: typeof point.category === 'string' ? point.category : null,
    category_ids: categoryIds,
    ...(point.name === null || typeof point.name === 'string' ? { name: point.name } : {}),
  }
}
