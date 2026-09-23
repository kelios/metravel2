// #2068: печатная версия плана поездки — раскладка по дням и HTML-документ.
import type { PlannedTrip, RoutePoint } from '@/api/plannedTripsTypes'
import { fetchTripGear, type TripGearItem } from '@/api/plannedTripsGear'
import { buildTripPlanPrintModel } from '@/components/trips/planning/print/tripPlanPrintModel'
import { buildTripPlanPrintHtml } from '@/components/trips/planning/print/tripPlanPrintHtml'
import { printTripPlan } from '@/components/trips/planning/print/printTripPlan'
import { openBookPreviewWindow, openPendingBookPreviewWindow } from '@/utils/openBookPreviewWindow'

jest.mock('@/utils/openBookPreviewWindow', () => ({
  openPendingBookPreviewWindow: jest.fn(() => ({})),
  openBookPreviewWindow: jest.fn(),
}))
jest.mock('@/api/plannedTripsGear', () => ({
  ...jest.requireActual('@/api/plannedTripsGear'),
  fetchTripGear: jest.fn(async () => []),
}))
// Чанк генератора карт не загрузился — печать обязана открыться без карт.
jest.mock('@/utils/mapImageGenerator', () => {
  throw new Error('ChunkLoadError')
})

const point = (id: string, lng: number, lat: number, extra: Partial<RoutePoint> = {}): RoutePoint => ({
  id,
  type: 'custom',
  name: id,
  description: null,
  coordinates: [lng, lat],
  placeId: null,
  ...extra,
})

const trip = (route: RoutePoint[], extra: Partial<PlannedTrip> = {}): PlannedTrip =>
  ({
    id: 47,
    slug: 'mullerthal',
    title: 'Mullerthal Trail',
    description: 'Первый абзац.\nВторая строка.\n\nВторой абзац.',
    startDate: '2026-09-25',
    endDate: '2026-10-11',
    startTime: null,
    transport: 'foot',
    bikeType: null,
    visibility: 'private',
    seatsTotal: 1,
    startPoint: null,
    status: 'planning',
    organizer: { id: 1, name: 'Owner', avatarUrl: null },
    route,
    routeGeometry: null,
    routeSummary: { distanceKm: 118.4, durationMin: 0, elevationGainM: 0, stopsCount: route.length, provider: 'ors' },
    routingState: { provider: 'ors', isOptimal: true, fallbackReason: null, warnings: [] },
    participants: [],
    coverUrl: null,
    region: '',
    publishedToCommunity: false,
    report: null,
    isOwner: true,
    myRsvp: null,
    createdAt: '2026-09-01',
    ...extra,
  }) as PlannedTrip

// Автобус до Эхтернаха, петля через Born, центр Эхтернаха, вторая петля с
// финишем в той же точке, потом перелёт.
const ECHTERNACH: [number, number] = [6.4217, 49.8134]
const BORN: [number, number] = [6.5093, 49.7711]
const loopRoute = (): RoutePoint[] => [
  point('bus-stop', 6.1257, 49.6175, { dayNumber: 3 }),
  point('Эхтернах', ...ECHTERNACH, { dayNumber: 3, arrivalMode: 'bus' }),
  point('Born', ...BORN, { dayNumber: 3, type: 'overnight', booking: { address: 'Burer Millen', url: 'https://booking.com/x', price: 90, checkinTime: '15:00' } }),
  point('Эхтернах центр', ...ECHTERNACH, { dayNumber: 4 }),
  point('Финиш', ...ECHTERNACH, { dayNumber: 5 }),
  point('Будапешт', 19.2535, 47.4353, { dayNumber: 6, arrivalMode: 'flight' }),
]

// Линия проходит через центр Эхтернаха дважды — маршрутизатор ведёт её через
// ту же вершину: в середине поездки (день 4) и на финише (день 5).
const loopGeometry = (): [number, number][] => [
  [6.1257, 49.6175],
  ECHTERNACH,
  [6.45, 49.74],
  BORN,
  [6.47, 49.86],
  ECHTERNACH,
  [6.4, 49.86],
  ECHTERNACH,
  [19.2535, 47.4353],
]

describe('buildTripPlanPrintModel', () => {
  it('группирует по дням, считает даты от старта и находит ночёвку дня', () => {
    const model = buildTripPlanPrintModel(trip(loopRoute()), null)

    expect(model.hasDays).toBe(true)
    expect(model.days.map((d) => [d.dayNumber, d.date])).toEqual([
      [3, '2026-09-27'],
      [4, '2026-09-28'],
      [5, '2026-09-29'],
      [6, '2026-09-30'],
    ])
    expect(model.days[0].overnight?.point.name).toBe('Born')
    expect(model.overnights).toHaveLength(1)
  })

  it('переезд не входит ни в длину дня, ни в карту, и подписан расстоянием', () => {
    const model = buildTripPlanPrintModel(trip(loopRoute(), { routeGeometry: loopGeometry() }), null)
    const day3 = model.days[0]

    // Автобус до Эхтернаха (~25 км) отрезан; Эхтернах → Born идёт по линии
    // через (6.45, 49.74) — ≈ 13,9 км против 7,9 км по прямой.
    expect(day3.distanceKm).toBeGreaterThan(12)
    expect(day3.distanceKm).toBeLessThan(16)
    expect(day3.map?.points.map((p) => p.point.name)).toEqual(['Эхтернах', 'Born'])
    // Утренний путь от ночёвки входит в длину дня 4 — и карта начинается с неё.
    expect(model.days[1].map?.points.map((p) => p.point.name)).toEqual(['Born', 'Эхтернах центр'])
    expect(day3.points[1].arrival).toEqual({ mode: 'bus', distanceKm: expect.any(Number) })
    expect(model.days[3].map).toBeNull()
    expect(model.transferDistanceKm).toBeGreaterThan(900)
  })

  it('кольцо: точка середины поездки берёт первое прохождение линии, а не ближайшее у финиша', () => {
    const model = buildTripPlanPrintModel(trip(loopRoute(), { routeGeometry: loopGeometry() }), null)
    const [, day4, day5] = model.days

    // Born → центр по северной петле (~16 км), а не обрыв на финише.
    expect(day4.distanceKm).toBeGreaterThan(12)
    // Вторая петля (~10,8 км) остаётся у дня 5; с привязкой к ближайшей вершине
    // центр и финиш слиплись бы, и день 5 получил бы ноль.
    expect(day5.distanceKm).toBeGreaterThan(8)
  })

  it('переезд к точке без координат переходит на ребро до следующей точки', () => {
    const model = buildTripPlanPrintModel(
      trip([
        point('A', 6.4, 49.8, { dayNumber: 1 }),
        point('B', 0, 0, { dayNumber: 1, coordinates: null, arrivalMode: 'flight' }),
        point('C', 19.25, 47.43, { dayNumber: 1 }),
      ]),
      null,
    )

    expect(model.days[0].distanceKm).toBeNull()
    expect(model.days[0].map).toBeNull()
    expect(model.transferDistanceKm).toBeGreaterThan(900)
  })

  it('без сохранённой линии расстояния — по прямой, и модель это помечает', () => {
    const route = [point('A', 6.4, 49.8), point('B', 6.5, 49.7)]

    expect(buildTripPlanPrintModel(trip(route), null).approximate).toBe(true)
    expect(buildTripPlanPrintModel(trip([route[0]]), null).approximate).toBe(false)
  })

  it('без дней весь маршрут — одна группа, чеклист собран по категориям', () => {
    const gear: TripGearItem[] = [
      { id: 1, title: 'Фонарь', category: 'electronics', status: 'owned', sortOrder: 0 },
      { id: 2, title: 'Паспорт', category: 'documents', status: 'packed', sortOrder: 1 },
    ]
    const model = buildTripPlanPrintModel(trip([point('A', 6.4, 49.8), point('B', 6.5, 49.7)]), gear)

    expect(model.hasDays).toBe(false)
    expect(model.days).toHaveLength(1)
    expect(model.days[0].dayNumber).toBeNull()
    expect(model.gear.map((g) => g.category)).toEqual(['documents', 'electronics'])
  })
})

describe('buildTripPlanPrintHtml', () => {
  const html = (route: RoutePoint[], extra: Partial<PlannedTrip> = {}) =>
    buildTripPlanPrintHtml(buildTripPlanPrintModel(trip(route, extra), null), {
      maps: { 'day-3': 'data:image/png;base64,AAAA' },
      pageUrl: 'https://metravel.by/trips/plan/47',
      printedAt: new Date(2026, 8, 23),
    })

  it('экранирует пользовательский текст', () => {
    const out = html([point('<script>alert(1)</script>', 6.4, 49.8, { description: '"><img src=x onerror=alert(1)>' })], {
      title: 'Поход <b>',
    })

    expect(out).not.toContain('<script>alert(1)</script>')
    expect(out).not.toContain('<img src=x')
    expect(out).toContain('&lt;script&gt;')
    expect(out).toContain('Поход &lt;b&gt;')
  })

  it('печатает дни, карту дня, бронь ночёвки, переезд и абзацы описания', () => {
    const out = html(loopRoute())

    expect(out.match(/<section class="day"/g)).toHaveLength(4)
    expect(out).toContain('data:image/png;base64,AAAA')
    expect(out).toContain('Burer Millen')
    expect(out).toContain('https://booking.com/x')
    expect(out).toContain('<p>Первый абзац.<br>Вторая строка.</p><p>Второй абзац.</p>')
    expect(out).toContain('class="arrival"')
    expect(out).toContain('@page { size: A4')
  })

  it('сводка прямой линии подписана «по прямой» (#2057)', () => {
    const out = html(loopRoute(), {
      routeSummary: { distanceKm: 2429, durationMin: 0, elevationGainM: 0, stopsCount: 6, provider: 'direct' },
    })

    expect(out).toContain('Дистанция по прямой')
    expect(out).not.toContain('<span>Пешком</span>')
  })
})

describe('printTripPlan', () => {
  beforeEach(() => jest.clearAllMocks())

  it('окно открывается до первого await; без чанка карт план всё равно печатается', async () => {
    const pending = printTripPlan(trip(loopRoute(), { routeGeometry: loopGeometry() }))
    expect(openPendingBookPreviewWindow).toHaveBeenCalledTimes(1)

    await expect(pending).resolves.toBe(true)
    expect(fetchTripGear).toHaveBeenCalledWith(47)
    const [written] = (openBookPreviewWindow as jest.Mock).mock.calls[0]
    expect(written).toContain('<section class="day"')
    expect(written).not.toContain('<figure class="map">')
  })

  it('чеклист не запрашивается у того, кому он закрыт', async () => {
    await printTripPlan(trip(loopRoute(), { isOwner: false, myRsvp: null }))

    expect(fetchTripGear).not.toHaveBeenCalled()
    expect(openBookPreviewWindow).toHaveBeenCalledTimes(1)
  })
})
