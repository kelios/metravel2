// Слияние прогресса адвента (#2867): «объединение, не выбор победителя», как
// `utils/questProgressMerge.ts`. Открытая где-то дверца остаётся открытой везде;
// при расхождении дат берётся более ранняя — это факт, по которому считается
// серия «день в день». Зачтённое задание означает и открытую дверцу.

import type { AdventProgressMaps } from '@/utils/advent/adventCalendar'

const earliest = (a: string | undefined, b: string | undefined): string | undefined => {
  if (!a) return b
  if (!b) return a
  return a <= b ? a : b
}

const mergeDayMaps = (a: Record<string, string>, b: Record<string, string>): Record<string, string> => {
  const out: Record<string, string> = { ...a }
  Object.entries(b).forEach(([day, date]) => {
    const value = earliest(out[day], date)
    if (value) out[day] = value
  })
  return out
}

export const mergeAdventProgress = (...sources: readonly AdventProgressMaps[]): AdventProgressMaps => {
  let opened: Record<string, string> = {}
  let tasksDone: Record<string, string> = {}
  sources.forEach((source) => {
    opened = mergeDayMaps(opened, source.opened)
    tasksDone = mergeDayMaps(tasksDone, source.tasksDone)
  })
  Object.entries(tasksDone).forEach(([day, date]) => {
    if (!opened[day]) opened[day] = date
  })
  return { opened, tasksDone }
}

/** Есть ли в `local` то, чего сервер ещё не знает (новая дверца, задание или более ранняя дата). */
export const hasUnsyncedAdventProgress = (local: AdventProgressMaps, server: AdventProgressMaps): boolean => {
  const ahead = (mine: Record<string, string>, theirs: Record<string, string>) =>
    Object.entries(mine).some(([day, date]) => !theirs[day] || date < theirs[day])
  return ahead(local.opened, server.opened) || ahead(local.tasksDone, server.tasksDone)
}

export const isAdventProgressEmpty = (maps: AdventProgressMaps): boolean =>
  Object.keys(maps.opened).length === 0 && Object.keys(maps.tasksDone).length === 0

export const sameAdventProgress = (a: AdventProgressMaps, b: AdventProgressMaps): boolean =>
  !hasUnsyncedAdventProgress(a, b) && !hasUnsyncedAdventProgress(b, a)

/**
 * Задания, которые засчитывает только сервер (#2940): их отметка в сравнении и
 * в `POST` берётся из ответа сервера, а не из локальной. Ручная локальная
 * отметка такой дверцы (с другого устройства или до флага) сервером
 * отбрасывается и не должна держать статус «только на этом устройстве».
 */
export const alignServerOwnedTasks = (
  local: AdventProgressMaps,
  server: AdventProgressMaps | undefined,
  days: ReadonlySet<number>,
): AdventProgressMaps => {
  if (days.size === 0) return local
  let changed = false
  const tasksDone = { ...local.tasksDone }
  days.forEach((day) => {
    const key = String(day)
    const serverDate = server?.tasksDone[key]
    if (tasksDone[key] === serverDate) return
    changed = true
    if (serverDate) tasksDone[key] = serverDate
    else delete tasksDone[key]
  })
  return changed ? { opened: local.opened, tasksDone } : local
}
