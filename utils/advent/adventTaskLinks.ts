import { ADVENT_ROUTE } from '@/constants/advent'
import type { AdventDoor } from '@/types/advent'

export const ADVENT_SOURCE_PARAM = 'from'
export const ADVENT_SOURCE_VALUE = 'advent'
export const ADVENT_DAY_PARAM = 'day'

/**
 * Ссылка задания с меткой источника: `/route?from=advent&day=N` (#2862).
 * Существующие параметры маршрута сохраняются; внешние https-ссылки не трогаем.
 */
export const buildAdventTaskHref = (route: string, day: number): string => {
  const trimmed = route.trim()
  if (!trimmed.startsWith('/')) return trimmed
  const [pathAndQuery, hash] = trimmed.split('#')
  const [path, query = ''] = pathAndQuery.split('?')
  const params = new URLSearchParams(query)
  params.set(ADVENT_SOURCE_PARAM, ADVENT_SOURCE_VALUE)
  params.set(ADVENT_DAY_PARAM, String(day))
  return `${path}?${params.toString()}${hash ? `#${hash}` : ''}`
}

export const buildAdventDoorCtaHref = (door: Pick<AdventDoor, 'day' | 'task'>): string | null =>
  door.task.ctaRoute ? buildAdventTaskHref(door.task.ctaRoute, door.day) : null

/** Возврат на календарь после входа/регистрации гостя. */
export const buildAdventReturnPath = (day?: number): string =>
  day ? `${ADVENT_ROUTE}?${ADVENT_DAY_PARAM}=${day}` : ADVENT_ROUTE
