import type { Page } from '@playwright/test'

import { expect, test } from './fixtures'
import { ensureAuthedStorageFallback, mockFakeAuthApis } from './helpers/auth'

/**
 * #2056 — переезд не входит в пешую дистанцию.
 *
 * Прод trip 47 (23.09.2026): перелёт Люксембург → Мюнхен (431 км) и ещё три
 * переезда печатались как пешие — «Пешком 2 429 км · 481 ч 57 мин». С #2055
 * бэкенд режет сводку на прогоны и переезды (`route_summary.legs`,
 * `transfer_distance_km`), а экран показывает переезд плашкой в списке,
 * пунктирной дугой на карте и отдельной суммой «Переезды K км» в итоге.
 *
 * Бэкенд замокан ответом формы #2055: спека детерминирована и гоняется на
 * собранном `dist`. Раскладка — `docs/features/trips-plan-route-tab-mock.md` §6
 * и `openspec/changes/trip-route-transfer-legs/`.
 */

const TRIP_ID = 205601

const VIEWPORTS = [
  { name: 'mobile-390', width: 390, height: 844, summaryLineTestId: 'route-mobile-summary' },
  { name: 'desktop-1440', width: 1440, height: 900, summaryLineTestId: 'trip-plan-route-map' },
] as const

const LUX: [number, number] = [6.2044, 49.6233]
const MUC: [number, number] = [11.786, 48.3538]

// Пешком по Мюллерталю до аэропорта, перелёт в Мюнхен и пешком в центр.
const savedPoints = [
  { title: 'Эхтернах', lng: 6.4214, lat: 49.8117 },
  { title: 'Бердорф', lng: 6.3508, lat: 49.8206 },
  { title: 'Мюллерталь', lng: 6.3208, lat: 49.7897 },
  { title: 'Аэропорт Люксембурга', lng: LUX[0], lat: LUX[1] },
  { title: 'Аэропорт Мюнхена', lng: MUC[0], lat: MUC[1], arrival_mode: 'flight' },
  { title: 'Мариенплац', lng: 11.5755, lat: 48.1374 },
].map((point, index) => ({
  id: index + 1,
  point_type: 'custom',
  order: index + 1,
  description: '',
  arrival_mode: '',
  ...point,
}))

// Склейка бэкенда (`combine_route_legs`): прогон [0,5), переезд [5,7), прогон [7,10).
const walkOne: Array<[number, number]> = [[6.4214, 49.8117], [6.39, 49.815], [6.3508, 49.8206], [6.3208, 49.7897], LUX]
const flight: Array<[number, number]> = [LUX, MUC]
const walkTwo: Array<[number, number]> = [MUC, [11.68, 48.25], [11.5755, 48.1374]]
const routeGeometry = [...walkOne, ...flight, ...walkTwo]

// Пешком 58 км за 12 ч — только прогоны; перелёт 431 км отдельно.
const WALK_KM = 58
const TRANSFER_KM = 431.2

const tripDto = {
  id: TRIP_ID,
  title: 'E2E переезды внутри поездки',
  description: '',
  start_date: '2026-10-03T09:00:00',
  status: 'planned',
  transport_mode: 'walk',
  bike_type: 'regular',
  owner: 1,
  participants: [],
  route: { points: savedPoints },
  route_geometry: routeGeometry,
  route_summary: {
    distance_km: WALK_KM,
    transfer_distance_km: TRANSFER_KM,
    duration_min: 720,
    elevation_gain_m: 640,
    stops_count: savedPoints.length,
    provider: 'ors',
    legs: [
      { from_order: 1, to_order: 4, mode: 'route', distance_m: 30_000, duration_s: 21_600, provider: 'ors', geometry_slice: [0, 5] },
      { from_order: 4, to_order: 5, mode: 'flight', distance_m: 431_200, duration_s: null, provider: 'transfer', geometry_slice: [5, 7] },
      { from_order: 5, to_order: 6, mode: 'route', distance_m: 28_000, duration_s: 21_600, provider: 'ors', geometry_slice: [7, 10] },
    ],
  },
  routing_state: { provider: 'ors', is_optimal: true, fallback_reason: null, warnings: [] },
  is_public: false,
  max_participants: 4,
}

const TRANSPARENT_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
)

const seedConsent = (page: Page) =>
  page.addInitScript(() => {
    try {
      window.localStorage.setItem(
        'metravel_consent_v1',
        JSON.stringify({ necessary: true, analytics: false, date: '2026-01-01T00:00:00.000Z' }),
      )
    } catch {
      // Хранилище может быть недоступно до первого документа — helper'ы
      // авторизации проставят то же значение на origin приложения.
    }
  })

const waitForFakeAuth = (page: Page) =>
  expect
    .poll(() => page.evaluate(() => window.localStorage.getItem('userId')), { timeout: 15_000 })
    .toBe('1')

/** Тела запросов маршрутизации: переезд не должен уйти в прокладку ни в одном. */
async function mockOwnerTripWithFlight(page: Page): Promise<string[]> {
  const routingBodies: string[] = []
  await ensureAuthedStorageFallback(page)
  await mockFakeAuthApis(page)
  await seedConsent(page)

  await page.route('**/proxy/tiles/osm/**', (route) =>
    route.fulfill({ status: 200, contentType: 'image/png', body: TRANSPARENT_PNG }),
  )
  await page.route('**/api/trips/route-templates/', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
  )
  await page.route(`**/api/trips/planned/${TRIP_ID}/routes/`, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
  )
  await page.route(`**/api/trips/${TRIP_ID}/route-summary/`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        trip: TRIP_ID,
        provider: 'ors',
        status: 'ready',
        ascent_m: 640,
        descent_m: 610,
        polyline: null,
        is_optimal: true,
        fallback_reason: null,
        warnings: [],
        transfer_distance_km: TRANSFER_KM,
        legs: tripDto.route_summary.legs,
      }),
    }),
  )
  await page.route(`**/api/trips/planned/${TRIP_ID}/`, async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback()
      return
    }
    await waitForFakeAuth(page)
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(tripDto) })
  })
  // Сохранённый маршрут экран не перестраивает. Если движок всё же спросит
  // маршрутизатор, запрос записывается: прогон через перелёт — дефект.
  await page.route('**/api/routing/route/', async (route) => {
    routingBodies.push(route.request().postData() ?? '')
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        geometry: walkTwo,
        distance_m: 28_000,
        duration_s: 21_600,
        provider: 'ors',
        is_optimal: true,
        fallback_reason: null,
        warnings: [],
      }),
    })
  })
  return routingBodies
}

test.describe('Planned trip — a transfer is not part of the walking distance (#2056)', () => {
  for (const viewport of VIEWPORTS) {
    test(`${viewport.name}: flight plaque, dashed arc, «Переезды 431 км» apart from the walk`, async ({
      page,
    }, testInfo) => {
      const routingBodies = await mockOwnerTripWithFlight(page)
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      await page.goto(`/trips/plan/${TRIP_ID}`, { waitUntil: 'domcontentloaded' })
      await waitForFakeAuth(page)

      const panel = page.getByTestId('trip-plan-panel-route').first()
      await expect(panel).toBeVisible({ timeout: 30_000 })

      // Плашка переезда стоит над точкой, до которой летят.
      const plaque = page.getByTestId('route-transfer-leg-4').first()
      await expect(plaque).toBeAttached({ timeout: 30_000 })
      await plaque.scrollIntoViewIfNeeded()
      await expect(plaque).toBeVisible()
      // Разряды и «км» форматтер отделяет неразрывным пробелом — `\s` его покрывает.
      await expect(plaque).toContainText(/Перелёт · 431\sкм/)

      // Карта: переезд — пунктирная дуга своего цвета, одна.
      const arc = page.locator('path.metravel-route-transfer')
      await expect(arc).toHaveCount(1, { timeout: 30_000 })
      await expect(arc).toHaveAttribute('stroke-dasharray', '2 8')

      // «Итог маршрута»: пешая дистанция и время — без перелёта; перелёт — своей плиткой.
      const summary = page.getByTestId('route-summary').first()
      await expect(summary.getByTestId('route-summary-metric-distance-value')).toHaveText(/^58\sкм$/)
      await expect(summary.getByTestId('route-summary-metric-duration-value')).toHaveText('12 ч')
      await expect(summary.getByTestId('route-summary-metric-transfers-value')).toHaveText(/^431\sкм$/)
      await expect(summary.getByTestId('route-summary-metric-transfers-label')).toHaveText('Переезды')

      // Строка итога (телефон — под картой, desktop — шапка карты) и плашка шапки.
      await expect(page.getByTestId(viewport.summaryLineTestId).first()).toContainText(/58\sкм · 12 ч · Переезды 431\sкм/)
      await expect(page.getByTestId('trip-plan-summary').first()).toContainText(/Переезды 431\sкм/)
      // Сумма «пешком + перелёт» (489 км) не печатается нигде.
      await expect(page.getByText(/489\sкм/)).toHaveCount(0)

      // Перелёт не уходит в прокладку ни одним запросом.
      for (const body of routingBodies) {
        expect(body.includes(String(LUX[0])) && body.includes(String(MUC[0])), body).toBe(false)
      }

      await page.screenshot({ path: testInfo.outputPath(`transfer-legs-${viewport.width}.png`) })
    })
  }
})
