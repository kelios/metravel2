import { test, expect } from './fixtures'
import fs from 'node:fs'
import path from 'node:path'
import {
  ensureAuthedStorageFallback,
  mockFakeAuthApis,
} from './helpers/auth'

/**
 * Trip planner — GPX/KML route import (#1492).
 *
 * Покрывает то, что юнит-тесты доказать не могут: реальный `<input type="file">`
 * в браузере, предпросмотр загруженного трека поверх текущего маршрута и —
 * главное — payload, который уходит в `PUT /trips/planned/{id}/route/`.
 *
 * Именно на payload сломался первый заход (#1496 → work log #1492): точки,
 * снятые с трека, уходили с пустым `title`, бэкенд отвечал
 * `400 {"title": ["title is required for custom route points"]}`, и весь импорт
 * молча не сохранялся. Отсюда два обязательных утверждения ниже: у каждой
 * `custom`-точки непустой `title`, а отказ сохранения виден пользователю.
 *
 * Бэкенд здесь замокан локально — спека остаётся детерминированной и не пишет
 * в реальную поездку; живая прод-проверка того же контракта идёт отдельно.
 */

const TRIP_ID = 99003
const FIXTURES = path.join(process.cwd(), 'e2e', 'fixtures')
const GPX_TRACK = path.join(FIXTURES, 'trip-route-track.gpx')
const KML_TRACK = path.join(FIXTURES, 'trip-route-track.kml')
const BROKEN_GPX = path.join(FIXTURES, 'trip-route-broken.gpx')
const EMPTY_GPX = path.join(FIXTURES, 'trip-route-empty.gpx')

/** Первая и последняя точки трека в фикстурах — обе формы описывают один путь. */
const TRACK_START: [number, number] = [49.2992, 19.9517]
const TRACK_END: [number, number] = [49.35242, 20.01695]

type RoutePointDto = {
  id: number
  point_type: string
  order: number
  title: string
  description: string
  lat: number
  lng: number
}

type PutPayload = { points: Array<Record<string, unknown>> }

const savedPoints: RoutePointDto[] = [
  {
    id: 1,
    point_type: 'custom',
    order: 1,
    title: 'Закопане',
    description: '',
    lat: 49.2992,
    lng: 19.9496,
  },
  {
    id: 2,
    point_type: 'custom',
    order: 2,
    title: 'Кузьнице',
    description: '',
    lat: 49.2705,
    lng: 19.9483,
  },
]

function seedConsent(page: import('@playwright/test').Page) {
  return page.addInitScript(() => {
    try {
      window.localStorage.setItem(
        'metravel_consent_v1',
        JSON.stringify({ necessary: true, analytics: false, date: '2026-01-01T00:00:00.000Z' }),
      )
    } catch {
      // ignore
    }
  })
}

async function setupFakeAuth(page: import('@playwright/test').Page) {
  await ensureAuthedStorageFallback(page)
  await mockFakeAuthApis(page)
}

async function waitForFakeAuth(page: import('@playwright/test').Page) {
  await expect
    .poll(() => page.evaluate(() => Boolean(window.localStorage.getItem('userId'))), {
      timeout: 15_000,
    })
    .toBe(true)
}

/**
 * Мок поездки под импорт. `routeFailures` — сколько первых `PUT /route/` бэкенд
 * отклонит: так воспроизводится ровно тот отказ, который раньше был молчаливым.
 */
async function mockImportTrip(
  page: import('@playwright/test').Page,
  options: { routeFailures?: number } = {},
) {
  const routePuts: PutPayload[] = []
  let remainingFailures = options.routeFailures ?? 0
  let currentPoints = savedPoints.map((point) => ({ ...point }))

  await page.route('**/api/trips/route-templates/', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
  )
  // Хранилище оригинала (#1496): список пустой, POST принимает файл, который
  // «Сохранить маршрут» отправляет вслед за точками.
  await page.route(`**/api/trips/planned/${TRIP_ID}/routes/`, async (route) => {
    if (route.request().method() !== 'POST') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
      return
    }
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 7,
        original_name: 'imported-track',
        size: 21063,
        updated_at: '2026-08-23T10:00:00Z',
      }),
    })
  })
  await page.route(`**/api/trips/${TRIP_ID}/route-summary/`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ trip: TRIP_ID, provider: 'fallback', status: 'unavailable', polyline: null }),
    }),
  )

  await page.route(`**/api/trips/planned/${TRIP_ID}/route/`, async (route) => {
    const request = route.request()
    if (request.method() !== 'PUT') {
      await route.fallback()
      return
    }
    const payload = request.postDataJSON() as PutPayload
    routePuts.push(payload)

    if (remainingFailures > 0) {
      remainingFailures -= 1
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ title: ['title is required for custom route points'] }),
      })
      return
    }

    currentPoints = payload.points.map((point, index) => ({
      id: index + 1,
      point_type: String(point.point_type ?? 'custom'),
      order: Number(point.order ?? index + 1),
      title: String(point.title ?? ''),
      description: String(point.description ?? ''),
      lat: Number(point.lat),
      lng: Number(point.lng),
    }))
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(buildTrip(currentPoints, 1)),
    })
  })

  await page.route(`**/api/trips/planned/${TRIP_ID}/`, async (route) => {
    const request = route.request()
    if (request.method() !== 'GET') {
      await route.fallback()
      return
    }
    await waitForFakeAuth(page)
    const ownerId = await page.evaluate(() => Number(window.localStorage.getItem('userId')))
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(buildTrip(currentPoints, ownerId)),
    })
  })

  return { routePuts }
}

const buildTrip = (points: RoutePointDto[], ownerId: number) => ({
  id: TRIP_ID,
  title: 'E2E импорт трека',
  description: 'Проверка загрузки GPX/KML',
  start_date: '2026-09-01T09:00:00',
  status: 'planned',
  transport_mode: 'walk',
  bike_type: 'regular',
  owner: ownerId,
  participants: [],
  route: { points },
  route_geometry: points.map((point) => [point.lng, point.lat]),
  route_summary: {
    distance_km: 3.2,
    duration_min: 48,
    elevation_gain_m: 120,
    stops_count: Math.max(0, points.length - 2),
    provider: 'direct',
  },
  routing_state: {
    provider: 'direct',
    is_optimal: false,
    fallback_reason: 'routing_provider_unavailable',
    warnings: [],
  },
  is_public: false,
  max_participants: 4,
})

async function openPlanner(page: import('@playwright/test').Page) {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto(`/trips/plan/${TRIP_ID}`, { waitUntil: 'domcontentloaded' })
  await waitForFakeAuth(page)
  await expect(page.getByTestId('trip-route-import-panel')).toBeVisible({ timeout: 20_000 })
}

const pickFile = (page: import('@playwright/test').Page, file: string) =>
  page.locator('[data-testid="trip-route-import-picker-input"]').setInputFiles(file)

const customTitles = (payload: PutPayload) =>
  payload.points
    .filter((point) => point.point_type === 'custom')
    .map((point) => String(point.title ?? ''))

test.describe('Trip planner — GPX/KML import', () => {
  test('imports a GPX track, replaces the route and saves every point with a title', async ({ page }) => {
    await setupFakeAuth(page)
    await seedConsent(page)
    const network = await mockImportTrip(page)
    await openPlanner(page)

    await pickFile(page, GPX_TRACK)

    // Предпросмотр: файл, статистика и именованные путевые точки из <wpt>.
    const preview = page.getByTestId('trip-route-import-preview')
    await expect(preview).toBeVisible({ timeout: 15_000 })
    await expect(preview).toContainText('trip-route-track.gpx')
    await expect(preview).toContainText('Точек: 300')
    await expect(preview).toContainText('Parking Kiry')
    await expect(preview).toContainText('Schronisko Ornak')
    await expect(page.getByTestId('trip-route-import-error')).toHaveCount(0)

    const evidenceDir = path.join(process.cwd(), '.codex-temp', 'trip-route-import')
    fs.mkdirSync(evidenceDir, { recursive: true })
    await preview.screenshot({ path: path.join(evidenceDir, 'gpx-preview.png') })

    await page.getByTestId('trip-route-import-replace').click()
    await expect(preview).toHaveCount(0)
    // Трек заменил оба сохранённых пункта и упростился до лимита черновика.
    await expect(page.getByTestId('route-builder-point-0')).toContainText('Parking Kiry')
    await expect(page.locator('[data-testid^="route-builder-point-"]')).toHaveCount(50)

    await page.getByTestId('route-builder-save').click()
    await expect.poll(() => network.routePuts.length, { timeout: 15_000 }).toBe(1)

    const payload = network.routePuts[0]
    expect(payload.points).toHaveLength(50)
    // Регресс #1492: пустой title у custom-точки = 400 и потерянный импорт.
    expect(customTitles(payload).every((title) => title.trim().length > 0)).toBe(true)
    // Имена из файла не затёрты подставленными «Точка N».
    expect(payload.points.map((point) => String(point.title))).toContain('Parking Kiry')
    expect(payload.points.map((point) => String(point.title))).toContain('Schronisko Ornak')
    // Старт и финиш трека сохранены точно, без упрощения.
    expect(Number(payload.points[0].lat)).toBeCloseTo(TRACK_START[0], 6)
    expect(Number(payload.points[0].lng)).toBeCloseTo(TRACK_START[1], 6)
    expect(Number(payload.points[49].lat)).toBeCloseTo(TRACK_END[0], 6)
    expect(Number(payload.points[49].lng)).toBeCloseTo(TRACK_END[1], 6)
    // `unique_together (trip, order)` на бэкенде: порядок 1..N без повторов.
    expect(payload.points.map((point) => Number(point.order))).toEqual(
      Array.from({ length: 50 }, (_, index) => index + 1),
    )

    await expect(page.getByTestId('route-builder-save-error')).toHaveCount(0)
    await expect(page.getByTestId('route-builder-save')).toHaveCount(0)
  })

  test('imports a KML track and appends it after the existing points', async ({ page }) => {
    await setupFakeAuth(page)
    await seedConsent(page)
    const network = await mockImportTrip(page)
    await openPlanner(page)

    await pickFile(page, KML_TRACK)

    const preview = page.getByTestId('trip-route-import-preview')
    await expect(preview).toBeVisible({ timeout: 15_000 })
    await expect(preview).toContainText('trip-route-track.kml')
    await expect(preview).toContainText('Точек: 300')
    await expect(preview).toContainText('Siwa Polana')
    await expect(preview).toContainText('Polana Chocholowska')

    await page.getByTestId('trip-route-import-append').click()
    await expect(preview).toHaveCount(0)
    // Существующие точки остались на своих местах, трек дописан после них.
    await expect(page.getByTestId('route-builder-point-0')).toContainText('Закопане')
    await expect(page.getByTestId('route-builder-point-1')).toContainText('Кузьнице')
    await expect(page.locator('[data-testid^="route-builder-point-"]')).toHaveCount(50)

    await page.getByTestId('route-builder-save').click()
    await expect.poll(() => network.routePuts.length, { timeout: 15_000 }).toBe(1)

    const payload = network.routePuts[0]
    expect(payload.points).toHaveLength(50)
    expect(customTitles(payload).every((title) => title.trim().length > 0)).toBe(true)
    expect(String(payload.points[0].title)).toBe('Закопане')
    expect(String(payload.points[1].title)).toBe('Кузьнице')
    expect(payload.points.map((point) => String(point.title))).toContain('Siwa Polana')
    expect(Number(payload.points[49].lat)).toBeCloseTo(TRACK_END[0], 6)
    expect(Number(payload.points[49].lng)).toBeCloseTo(TRACK_END[1], 6)
  })

  test('shows a distinct readable message for damaged, empty and unsupported files', async ({ page }) => {
    await setupFakeAuth(page)
    await seedConsent(page)
    await mockImportTrip(page)
    await openPlanner(page)

    const error = page.getByTestId('trip-route-import-error')

    await pickFile(page, BROKEN_GPX)
    await expect(error).toHaveText('Файл повреждён или содержит некорректный GPX/KML.')
    await expect(page.getByTestId('trip-route-import-preview')).toHaveCount(0)

    await pickFile(page, EMPTY_GPX)
    await expect(error).toHaveText('В файле нет трека минимум с двумя точками.')

    // Расширение вне контракта: `accept` фильтрует только диалог, не защиту.
    const unsupported = path.join(process.cwd(), '.codex-temp', 'trip-route-import', 'route.geojson')
    fs.mkdirSync(path.dirname(unsupported), { recursive: true })
    fs.writeFileSync(unsupported, '{"type":"FeatureCollection","features":[]}')
    await pickFile(page, unsupported)
    await expect(error).toHaveText('Поддерживаются только файлы GPX и KML.')

    // Ни одна ошибка не тронула текущий маршрут.
    await expect(page.locator('[data-testid^="route-builder-point-"]')).toHaveCount(2)
    await expect(page.getByTestId('route-builder-save')).toHaveCount(0)
  })

  test('surfaces a rejected route save instead of failing silently', async ({ page }) => {
    await setupFakeAuth(page)
    await seedConsent(page)
    const network = await mockImportTrip(page, { routeFailures: 1 })
    await openPlanner(page)

    await pickFile(page, GPX_TRACK)
    await expect(page.getByTestId('trip-route-import-preview')).toBeVisible({ timeout: 15_000 })
    await page.getByTestId('trip-route-import-replace').click()

    await page.getByTestId('route-builder-save').click()
    await expect.poll(() => network.routePuts.length, { timeout: 15_000 }).toBe(1)
    // Раньше здесь не было ничего: кнопка гасла, маршрут не сохранялся, экран молчал.
    await expect(page.getByTestId('route-builder-save-error')).toHaveText(
      'Не удалось сохранить маршрут. Проверьте точки и попробуйте ещё раз.',
    )
    await expect(page.getByTestId('route-builder-save')).toBeVisible()

    await page.getByTestId('route-builder-save').click()
    await expect.poll(() => network.routePuts.length, { timeout: 15_000 }).toBe(2)
    await expect(page.getByTestId('route-builder-save-error')).toHaveCount(0)
    await expect(page.getByTestId('route-builder-save')).toHaveCount(0)
  })
})
