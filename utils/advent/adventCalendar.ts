import { ADVENT_MAIN_DOORS, isoDateToLocalMidnight, toLocalIsoDate } from '@/constants/advent'
import type { AdventCampaignConfig, AdventDoor, AdventDoorState, AdventProgressSnapshot } from '@/types/advent'

export type AdventProgressMaps = Pick<AdventProgressSnapshot, 'opened' | 'tasksDone'>

export const EMPTY_ADVENT_PROGRESS: AdventProgressMaps = Object.freeze({ opened: {}, tasksDone: {} })

export const doorKey = (day: number): string => String(day)

/** Дверца доступна со своего местного дня и без ограничения срока после него. */
export const isDoorUnlocked = (door: Pick<AdventDoor, 'date'>, todayIso: string): boolean =>
  door.date <= todayIso

export const getDoorState = (
  door: Pick<AdventDoor, 'day' | 'date'>,
  todayIso: string,
  progress: AdventProgressMaps,
): AdventDoorState => {
  const key = doorKey(door.day)
  if (progress.tasksDone[key]) return 'done'
  if (progress.opened[key]) return 'opened'
  return isDoorUnlocked(door, todayIso) ? 'available' : 'locked'
}

/** Основные дверцы (без бонусных) — база прогресса N/24 и серии. */
export const mainDoors = (doors: readonly AdventDoor[]): AdventDoor[] =>
  doors.filter((door) => !door.bonus).slice(0, ADVENT_MAIN_DOORS)

/**
 * Серия «день в день»: сколько основных дверец подряд открыты в свой календарный
 * день, считая назад от сегодняшней. Пропущенный день (не открыта или открыта
 * позже) обрывает серию. Сегодняшняя дверца серию не рвёт, пока день не прошёл.
 */
export const computeStreak = (
  doors: readonly AdventDoor[],
  todayIso: string,
  progress: AdventProgressMaps,
): number => {
  const openedOnDay = (door: AdventDoor) => progress.opened[doorKey(door.day)] === door.date
  const past = mainDoors(doors).filter((door) => door.date < todayIso)
  let streak = 0
  for (let index = past.length - 1; index >= 0; index -= 1) {
    if (!openedOnDay(past[index])) break
    streak += 1
  }
  const today = mainDoors(doors).find((door) => door.date === todayIso)
  if (today && openedOnDay(today)) streak += 1
  return streak
}

export const buildProgressSnapshot = (
  doors: readonly AdventDoor[],
  todayIso: string,
  progress: AdventProgressMaps,
): AdventProgressSnapshot => ({
  opened: progress.opened,
  tasksDone: progress.tasksDone,
  streak: computeStreak(doors, todayIso, progress),
})

export const countOpenedMain = (doors: readonly AdventDoor[], progress: AdventProgressMaps): number =>
  mainDoors(doors).filter((door) => progress.opened[doorKey(door.day)]).length

export const countDoneMain = (doors: readonly AdventDoor[], progress: AdventProgressMaps): number =>
  mainDoors(doors).filter((door) => progress.tasksDone[doorKey(door.day)]).length

/** Дверца сегодняшнего дня (если есть). */
export const findTodayDoor = (doors: readonly AdventDoor[], todayIso: string): AdventDoor | null =>
  doors.find((door) => door.date === todayIso) ?? null

/** Ближайшая ещё закрытая дверца — для обратного отсчёта. */
export const findNextLockedDoor = (doors: readonly AdventDoor[], todayIso: string): AdventDoor | null =>
  [...doors].sort((a, b) => a.date.localeCompare(b.date)).find((door) => door.date > todayIso) ?? null

/** Миллисекунды до местной полуночи дня дверцы (минимум 1, как в `seasonalThemeClock`). */
export const millisecondsUntilDoor = (door: Pick<AdventDoor, 'date'>, now: Date): number =>
  Math.max(1, isoDateToLocalMidnight(door.date).getTime() - now.getTime())

export const isCampaignDay = (config: Pick<AdventCampaignConfig, 'start' | 'end'>, todayIso: string): boolean =>
  todayIso >= config.start && todayIso <= config.end

export const todayIsoOf = (now: Date): string => toLocalIsoDate(now)
