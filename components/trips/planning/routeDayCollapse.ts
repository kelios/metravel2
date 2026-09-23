// components/trips/planning/routeDayCollapse.ts
// #2058: свёртка дней в списке точек конструктора. Чистая арифметика сессии
// экрана — без React: её зовут хук `useRouteListMapFocus` и тесты. Норматив —
// `docs/features/trips-plan-route-tab-mock.md` §3. На бэкенд состояние не уходит.
import type { RoutePoint } from '@/api/plannedTrips'
import {
  groupRoutePointsByDay,
  shouldGroupRouteByDay,
  type RouteDayGroup,
} from '@/components/trips/planning/routePointDays'
import { pointDayNumber } from '@/utils/routePointDay'

/** Больше стольких точек — дни свёрнуты по умолчанию (§3). */
export const ROUTE_DAY_COLLAPSE_THRESHOLD = 15

/** Ключ группы дня. Совпадает с React-ключом заголовка группы. */
export const routeDayKey = (dayNumber: number | null): string =>
  dayNumber == null ? 'unassigned' : `day-${dayNumber}`

export const shouldCollapseRouteDays = (route: readonly RoutePoint[]): boolean =>
  route.length > ROUTE_DAY_COLLAPSE_THRESHOLD && shouldGroupRouteByDay(route)

const pointDayKey = (point: RoutePoint | undefined): string | null =>
  point ? routeDayKey(pointDayNumber(point)) : null

/** То, что список дней получает от владельца состояния свёртки. */
export type RouteDayCollapseView = {
  isExpanded: (key: string) => boolean
  onToggle: (group: RouteDayGroup) => void
  /** Только в мобильной раскладке: `[⌖]` в заголовке показывает день на карте. */
  onShowOnMap?: (group: RouteDayGroup) => void
}

export type RouteDayCollapseSession = {
  expanded: ReadonlySet<string>
  collapsible: boolean
  replacementToken: number
  length: number
  /** id точки, открытой в форме правки на прошлом шаге синхронизации. */
  editingId: string | null
}

export type RouteDayCollapseInput = {
  route: readonly RoutePoint[]
  editingIndex: number | null
  /** #1820: счётчик оптовых замен маршрута (шаблон, импорт трека). */
  replacementToken: number
}

const editingPointOf = ({ route, editingIndex }: RouteDayCollapseInput): RoutePoint | null =>
  editingIndex != null ? route[editingIndex] ?? null : null

/**
 * Старт сессии и оптовая замена маршрута: свёрнуто всё, кроме дня точки,
 * которая прямо сейчас открыта в форме.
 */
export const initialRouteDayCollapse = (input: RouteDayCollapseInput): RouteDayCollapseSession => {
  const editingPoint = editingPointOf(input)
  const editingKey = pointDayKey(editingPoint ?? undefined)
  return {
    expanded: new Set(editingKey ? [editingKey] : []),
    collapsible: shouldCollapseRouteDays(input.route),
    replacementToken: input.replacementToken,
    length: input.route.length,
    editingId: editingPoint ? String(editingPoint.id) : null,
  }
}

/**
 * Следующее состояние сессии для текущего маршрута. Возвращает тот же объект,
 * если раскрывать нечего, — по этому равенству хук понимает, что обновлять
 * состояние не нужно. Авто-раскрытие только добавляет дни: свернуть день
 * может лишь сам человек.
 */
export const syncRouteDayCollapse = (
  session: RouteDayCollapseSession,
  input: RouteDayCollapseInput,
): RouteDayCollapseSession => {
  if (session.replacementToken !== input.replacementToken) return initialRouteDayCollapse(input)

  const { route } = input
  const collapsible = shouldCollapseRouteDays(route)
  const editingPoint = editingPointOf(input)
  const editingId = editingPoint ? String(editingPoint.id) : null
  if (
    collapsible === session.collapsible &&
    route.length === session.length &&
    editingId === session.editingId
  ) {
    return session
  }

  const expanded = new Set(session.expanded)
  const expand = (key: string | null) => {
    if (key) expanded.add(key)
  }
  // Список дорос до порога посреди сессии: дни, которые человек только что
  // видел развёрнутыми, не схлопываются у него на глазах.
  if (collapsible && !session.collapsible) {
    for (const group of groupRoutePointsByDay(route)) expand(routeDayKey(group.dayNumber))
  }
  // Добавление всегда дописывает точку в конец маршрута.
  for (let index = session.length; index < route.length; index += 1) {
    expand(pointDayKey(route[index]))
  }
  // Точка открыта в форме: из списка, из попапа маркера на карте или тапом по
  // карте (новая точка сразу открывает редактор).
  if (editingId && editingId !== session.editingId) expand(pointDayKey(editingPoint ?? undefined))
  // Форма закрылась сохранением: полем дня точка могла переехать в другой день.
  if (session.editingId && session.editingId !== editingId) {
    expand(pointDayKey(route.find((point) => String(point.id) === session.editingId)))
  }

  return { expanded, collapsible, replacementToken: input.replacementToken, length: route.length, editingId }
}

export const toggleRouteDay = (
  session: RouteDayCollapseSession,
  key: string,
): RouteDayCollapseSession => {
  const expanded = new Set(session.expanded)
  if (expanded.has(key)) expanded.delete(key)
  else expanded.add(key)
  return { ...session, expanded }
}

/**
 * Перетаскивание при свёрнутых днях работает внутри дня своей точки (§3):
 * строки свёрнутых дней не смонтированы, их замеры устарели. Перенос в другой
 * день — полем дня в форме точки. `undefined` — ограничения нет.
 */
export const routeDayDropScope = (
  route: readonly RoutePoint[],
): ((fromIndex: number) => readonly number[] | null) => {
  const byIndex = new Map<number, readonly number[]>()
  for (const group of groupRoutePointsByDay(route)) {
    for (const index of group.indices) byIndex.set(index, group.indices)
  }
  return (fromIndex) => byIndex.get(fromIndex) ?? null
}
