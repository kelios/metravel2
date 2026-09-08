// #1845: группировка точек конструктора по дню похода.
import type { RoutePoint } from '@/api/plannedTrips'
import {
  dayGroupDistanceKm,
  groupRoutePointsByDay,
  hikeDayDate,
  routeDayChipValues,
  shouldGroupRouteByDay,
} from '@/components/trips/planning/routePointDays'
import { dayNumberFromBe, parseRouteDayDraft } from '@/utils/routePointDay'

const point = (over: Partial<RoutePoint> = {}): RoutePoint => ({
  id: 'p',
  type: 'custom',
  name: 'Точка',
  description: null,
  coordinates: [6.42, 49.81],
  placeId: null,
  ...over,
})

describe('dayNumberFromBe / parseRouteDayDraft', () => {
  it('принимает 1 и 60, отклоняет ноль, дробь и 61', () => {
    expect(dayNumberFromBe(1)).toBe(1)
    expect(dayNumberFromBe(60)).toBe(60)
    expect(dayNumberFromBe(0)).toBeNull()
    expect(dayNumberFromBe(61)).toBeNull()
    expect(dayNumberFromBe(1.5)).toBeNull()
    expect(dayNumberFromBe('3')).toBe(3)
    expect(dayNumberFromBe(null)).toBeNull()
  })

  it('пустой черновик — точка без дня, мусор — ошибка, а не молчаливый null', () => {
    expect(parseRouteDayDraft('')).toEqual({ dayNumber: null, error: null })
    expect(parseRouteDayDraft('  8  ')).toEqual({ dayNumber: 8, error: null })
    expect(parseRouteDayDraft('80').error).toBeTruthy()
    expect(parseRouteDayDraft('день').error).toBeTruthy()
    expect(parseRouteDayDraft('0').error).toBeTruthy()
  })
})

describe('groupRoutePointsByDay', () => {
  it('не группирует однодневный маршрут без единого дня', () => {
    const route = [point({ id: 'a' }), point({ id: 'b' })]
    expect(shouldGroupRouteByDay(route)).toBe(false)
  })

  it('складывает дни по возрастанию и оставляет точки без дня в конце', () => {
    const route = [
      point({ id: 'd2a', dayNumber: 2, name: 'День 2' }),
      point({ id: 'd1', dayNumber: 1, name: 'День 1' }),
      point({ id: 'none', name: 'Без дня' }),
      point({ id: 'd2b', dayNumber: 2, name: 'День 2 ещё' }),
    ]
    expect(shouldGroupRouteByDay(route)).toBe(true)
    expect(groupRoutePointsByDay(route)).toEqual([
      { dayNumber: 1, indices: [1] },
      { dayNumber: 2, indices: [0, 3] },
      { dayNumber: null, indices: [2] },
    ])
  })

  it('чипы предлагают занятые дни и следующий свободный', () => {
    expect(routeDayChipValues([point(), point({ id: 'b' })])).toEqual([1])
    expect(
      routeDayChipValues([
        point({ dayNumber: 1 }),
        point({ id: 'b', dayNumber: 3 }),
      ]),
    ).toEqual([1, 3, 4])
    expect(routeDayChipValues([point({ dayNumber: 60 })])).toEqual([60])
  })
})

describe('hikeDayDate / day distance', () => {
  it('дата дня N = старт + (N − 1)', () => {
    expect(hikeDayDate('2026-09-26', 1)).toBe('2026-09-26')
    expect(hikeDayDate('2026-09-26', 8)).toBe('2026-10-03')
    expect(hikeDayDate(null, 2)).toBeNull()
  })

  it('суммирует прямые отрезки только внутри группы дня', () => {
    const route = [
      point({ id: 'a', dayNumber: 1, coordinates: [6.0, 49.8] }),
      point({ id: 'b', dayNumber: 1, coordinates: [6.1, 49.8] }),
      point({ id: 'c', dayNumber: 2, coordinates: [6.4, 49.8] }),
    ]
    const day1 = dayGroupDistanceKm(route, [0, 1])
    const day2 = dayGroupDistanceKm(route, [2])
    expect(day1).toBeGreaterThan(5)
    expect(day1).toBeLessThan(10)
    expect(day2).toBe(0)
  })
})
