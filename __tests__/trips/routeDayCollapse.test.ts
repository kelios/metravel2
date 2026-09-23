// #2058: свёртка дней в списке точек конструктора — правило сессии экрана
// (`docs/features/trips-plan-route-tab-mock.md` §3).
import type { RoutePoint } from '@/api/plannedTrips'
import {
  ROUTE_DAY_COLLAPSE_THRESHOLD,
  initialRouteDayCollapse,
  routeDayDropScope,
  routeDayKey,
  shouldCollapseRouteDays,
  syncRouteDayCollapse,
  toggleRouteDay,
} from '@/components/trips/planning/routeDayCollapse'
import { maskRowSpans, resolveDropIndex } from '@/components/trips/planning/routePointReorder'

const point = (index: number, dayNumber: number | null): RoutePoint => ({
  id: `p${index}`,
  type: 'custom',
  name: `Точка ${index + 1}`,
  description: null,
  coordinates: [6.4 + index * 0.01, 49.8],
  placeId: null,
  dayNumber,
})

/** `perDay` точек в каждом из `days` дней подряд. */
const makeRoute = (days: number, perDay: number): RoutePoint[] =>
  Array.from({ length: days * perDay }, (_, index) => point(index, Math.floor(index / perDay) + 1))

const sync = (
  session: ReturnType<typeof initialRouteDayCollapse>,
  route: RoutePoint[],
  editingIndex: number | null = null,
  replacementToken = 0,
) => syncRouteDayCollapse(session, { route, editingIndex, replacementToken })

describe('shouldCollapseRouteDays', () => {
  it('сворачивает только больше 15 точек и только когда есть дни', () => {
    expect(ROUTE_DAY_COLLAPSE_THRESHOLD).toBe(15)
    expect(shouldCollapseRouteDays(makeRoute(5, 3))).toBe(false)
    expect(shouldCollapseRouteDays(makeRoute(4, 4))).toBe(true)
    const withoutDays = makeRoute(4, 4).map((item) => ({ ...item, dayNumber: null }))
    expect(shouldCollapseRouteDays(withoutDays)).toBe(false)
  })
})

describe('initialRouteDayCollapse / syncRouteDayCollapse', () => {
  it('> 15 точек: все дни свёрнуты по умолчанию', () => {
    const route = makeRoute(17, 4)
    const session = initialRouteDayCollapse({ route, editingIndex: null, replacementToken: 0 })

    expect(session.collapsible).toBe(true)
    expect(session.expanded.size).toBe(0)
    expect(sync(session, route)).toBe(session)
  })

  it('≤ 15 точек: свёртки нет', () => {
    const route = makeRoute(5, 3)
    const session = initialRouteDayCollapse({ route, editingIndex: null, replacementToken: 0 })

    expect(session.collapsible).toBe(false)
  })

  it('раскрывает день точки, открытой в форме (из списка или с карты)', () => {
    const route = makeRoute(17, 4)
    const session = initialRouteDayCollapse({ route, editingIndex: null, replacementToken: 0 })

    const next = sync(session, route, 13)

    expect([...next.expanded]).toEqual([routeDayKey(4)])
    // Та же форма на следующем рендере ничего не меняет.
    expect(sync(next, route, 13)).toBe(next)
  })

  it('раскрывает день, куда только что добавили точку', () => {
    const route = makeRoute(17, 4)
    const session = initialRouteDayCollapse({ route, editingIndex: null, replacementToken: 0 })

    const added = sync(session, [...route, point(99, null)])

    expect([...added.expanded]).toEqual([routeDayKey(null)])
  })

  it('после сохранения формы раскрывает день, в который точку перенесли полем дня', () => {
    const route = makeRoute(17, 4)
    const editing = sync(initialRouteDayCollapse({ route, editingIndex: null, replacementToken: 0 }), route, 0)
    const moved = route.map((item, index) => (index === 0 ? { ...item, dayNumber: 9 } : item))

    const saved = sync(editing, moved, null)

    expect(saved.expanded.has(routeDayKey(1))).toBe(true)
    expect(saved.expanded.has(routeDayKey(9))).toBe(true)
  })

  it('не раскрывает чужой день, когда форму закрыло удаление её точки', () => {
    const route = makeRoute(17, 4)
    const editing = sync(initialRouteDayCollapse({ route, editingIndex: null, replacementToken: 0 }), route, 0)
    const collapsedAgain = toggleRouteDay(editing, routeDayKey(1))

    const afterDelete = sync(collapsedAgain, route.slice(1), null)

    expect(afterDelete.expanded.size).toBe(0)
  })

  it('свернуть день может только человек: toggle работает в обе стороны', () => {
    const route = makeRoute(17, 4)
    const session = initialRouteDayCollapse({ route, editingIndex: null, replacementToken: 0 })

    const opened = toggleRouteDay(session, routeDayKey(3))
    expect(opened.expanded.has(routeDayKey(3))).toBe(true)
    expect(toggleRouteDay(opened, routeDayKey(3)).expanded.has(routeDayKey(3))).toBe(false)
  })

  it('список дорос до порога посреди сессии — развёрнутые дни не схлопываются', () => {
    const route = makeRoute(5, 3)
    const session = initialRouteDayCollapse({ route, editingIndex: null, replacementToken: 0 })

    const grown = sync(session, [...route, point(15, 5)])

    expect(grown.collapsible).toBe(true)
    expect([...grown.expanded].sort()).toEqual(
      [1, 2, 3, 4, 5].map((day) => routeDayKey(day)).sort(),
    )
  })

  it('оптовая замена маршрута (шаблон, импорт) возвращает свёрнутый вид по умолчанию', () => {
    const route = makeRoute(17, 4)
    const opened = toggleRouteDay(
      initialRouteDayCollapse({ route, editingIndex: null, replacementToken: 0 }),
      routeDayKey(2),
    )

    const replaced = sync(opened, makeRoute(17, 4), null, 1)

    expect(replaced.expanded.size).toBe(0)
    expect(replaced.replacementToken).toBe(1)
  })
})

describe('routeDayDropScope + maskRowSpans', () => {
  it('перетаскивание при свёрнутых днях не уводит точку за пределы её дня', () => {
    const route = makeRoute(17, 4)
    const scope = routeDayDropScope(route)
    expect(scope(5)).toEqual([4, 5, 6, 7])

    // Замеры строк: день 1 свёрнут, но его строки остались со старыми y выше
    // дня 2 — без маски точку дня 2 можно было бы «уронить» в день 1.
    const spans = Array.from({ length: route.length }, (_, index) => ({ y: index * 50, height: 44 }))
    expect(resolveDropIndex(spans, 5, -300)).toBe(0)
    expect(resolveDropIndex(maskRowSpans(spans, scope(5) ?? []), 5, -300)).toBe(4)
    expect(resolveDropIndex(maskRowSpans(spans, scope(5) ?? []), 5, 50)).toBe(6)
  })
})
