import type { Page } from '@playwright/test'

import { expect, test } from './fixtures'
import { ensureAuthedStorageFallback, mockFakeAuthApis } from './helpers/auth'

/**
 * #2057 — причина приблизительного маршрута видна ровно один раз, а у прямой
 * линии нет выдуманного времени в пути.
 *
 * Замер на проде (trip 47, пешком, 23.09.2026): ORS ответил HTTP 404 — дороги
 * между частью точек нет (ночной поезд, два перелёта), а экран писал
 * «Сервис построения маршрутов временно недоступен…» 4 раза на 1440 (под
 * плашкой шапки, в шапке карты, в «Итоге маршрута», в «Файле маршрута») и
 * 2 раза на 390; «481 ч 57 мин» (2 429 001 м / 1,4 м/с) стояло в плашке шапки,
 * в шапке карты и в плитке «В пути». Норматив мест показа —
 * `docs/features/trips-plan-route-tab-mock.md` §2.
 *
 * Бэкенд замокан ответом trip 47: спека детерминирована и гоняется на
 * собранном `dist`.
 */

const TRIP_ID = 205701

const VIEWPORTS = [
  { name: 'mobile-390', width: 390, height: 844, reasonTestId: 'route-mobile-summary-reason' },
  { name: 'desktop-1440', width: 1440, height: 900, reasonTestId: 'trip-plan-map-route-reason' },
] as const

const NO_ROUTE_REASON =
  'Не получилось проложить маршрут пешком между всеми точками — часть отрезков показана по прямой. Так бывает на перелётах и переездах.'
const UNAVAILABLE_REASON = 'временно недоступен'
// Любое «N ч» или «N мин»: у прямой линии времени нет нигде.
const DURATION_PATTERN = /\d\s*(ч|мин)(?![а-яё])/
// Поверхности, где на проде стояло «481 ч 57 мин»: плашка шапки, шапка карты,
// «Итог маршрута» и строка итога под картой на телефоне.
const NUMBER_SURFACES = ['trip-plan-summary', 'trip-plan-route-map', 'route-summary', 'route-mobile-summary']

// Люксембург пешком и перелёт в Мюнхен — отрезок, который ORS не прокладывает.
const savedPoints = [
  { title: 'Эхтернах', lat: 49.8117, lng: 6.4214 },
  { title: 'Бердорф', lat: 49.8206, lng: 6.3508 },
  { title: 'Мюллерталь', lat: 49.7897, lng: 6.3208 },
  { title: 'Аэропорт Люксембурга', lat: 49.6233, lng: 6.2044 },
  { title: 'Аэропорт Мюнхена', lat: 48.3538, lng: 11.786 },
].map((point, index) => ({
  id: index + 1,
  point_type: 'custom',
  order: index + 1,
  description: '',
  ...point,
}))

const fallbackWarning = {
  code: 'ors_http_404',
  message: 'Provider route is unavailable; direct-line fallback was used.',
}

// Ответ `GET /api/trips/planned/47/` на проде, сжатый до пяти точек: прямая
// линия по точкам, время бэкенда «дистанция / 1,4 м/с», высот нет.
const tripDto = {
  id: TRIP_ID,
  title: 'E2E приблизительный маршрут',
  description: '',
  start_date: '2026-10-03T09:00:00',
  status: 'planned',
  transport_mode: 'walk',
  bike_type: 'regular',
  owner: 1,
  participants: [],
  route: { points: savedPoints },
  route_geometry: savedPoints.map((point) => [point.lng, point.lat]),
  route_summary: {
    distance_km: 2429.0,
    duration_min: 28916.68,
    elevation_gain_m: null,
    stops_count: savedPoints.length,
    provider: 'direct',
  },
  routing_state: {
    provider: 'direct',
    is_optimal: false,
    fallback_reason: 'ors_http_404',
    warnings: [fallbackWarning],
  },
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
        JSON.stringify({
          necessary: true,
          analytics: false,
          date: '2026-01-01T00:00:00.000Z',
        }),
      )
    } catch {
      // Хранилище может быть недоступно до первого документа — helper'ы
      // авторизации проставят то же значение на origin приложения.
    }
  })

const waitForFakeAuth = (page: Page) =>
  expect
    .poll(() => page.evaluate(() => window.localStorage.getItem('userId')), {
      timeout: 15_000,
    })
    .toBe('1')

async function mockOwnerTripWithDirectRoute(page: Page) {
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
  // `GET /api/trips/47/route-summary/` на проде: деградация с тем же кодом.
  await page.route(`**/api/trips/${TRIP_ID}/route-summary/`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        trip: TRIP_ID,
        provider: 'direct',
        status: 'degraded',
        ascent_m: null,
        descent_m: null,
        polyline: null,
        is_optimal: false,
        fallback_reason: 'ors_http_404',
        warnings: [fallbackWarning],
      }),
    }),
  )
  await page.route(`**/api/trips/planned/${TRIP_ID}/`, async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback()
      return
    }
    await waitForFakeAuth(page)
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(tripDto),
    })
  })
  // Сохранённая деградация не перестраивается экраном; если движок всё же
  // спросит маршрутизатор, ответ тот же, что у бэкенда, а не проложенная линия.
  await page.route('**/api/routing/route/', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        geometry: tripDto.route_geometry,
        distance_m: 2_429_001,
        duration_s: 1_735_001,
        provider: 'direct',
        is_optimal: false,
        fallback_reason: 'ors_http_404',
        warnings: [fallbackWarning],
      }),
    }),
  )
}

test.describe('Planned trip route tab — the degradation reason is shown once, a straight line has no travel time (#2057)', () => {
  for (const viewport of VIEWPORTS) {
    test(`${viewport.name}: one honest reason, no «Повторить», «по прямой» and no «ч … мин»`, async ({
      page,
    }, testInfo) => {
      await mockOwnerTripWithDirectRoute(page)
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      await page.goto(`/trips/plan/${TRIP_ID}`, { waitUntil: 'domcontentloaded' })
      await waitForFakeAuth(page)

      const panel = page.getByTestId('trip-plan-panel-route').first()
      await expect(panel).toBeVisible({ timeout: 30_000 })
      const reason = page.getByTestId(viewport.reasonTestId)
      await expect(reason).toBeVisible({ timeout: 30_000 })
      await expect(reason).toHaveText(NO_ROUTE_REASON)
      await expect(page.getByTestId('route-summary').first()).toBeAttached()

      // Ровно одно видимое вхождение причины (было 4 на 1440 и 2 на 390), и
      // ни одного «временно недоступен»: ORS ответил 404, а не упал.
      await expect(page.getByText('Не получилось проложить маршрут').filter({ visible: true })).toHaveCount(1)
      await expect(page.getByText(UNAVAILABLE_REASON).filter({ visible: true })).toHaveCount(0)
      await expect(page.getByTestId('trip-plan-route-approximate')).toHaveCount(0)
      // 4xx повтором не лечится.
      await expect(page.getByRole('button', { name: /Повторить/ })).toHaveCount(0)

      // Цифры прямой линии: дистанция «по прямой», времени нет нигде.
      // Разряды форматтер отделяет неразрывным пробелом — `\s` его покрывает.
      await expect(page.getByTestId('trip-plan-summary')).toContainText(/≈\s2\s429\sкм по прямой/)
      const surfaceTexts = await page.evaluate(
        (testIds) =>
          testIds.map((testId) => ({
            testId,
            text: Array.from(document.querySelectorAll<HTMLElement>(`[data-testid="${testId}"]`))
              .map((node) => node.innerText)
              .join('\n'),
          })),
        NUMBER_SURFACES,
      )
      for (const { testId, text } of surfaceTexts) {
        expect(text, `${testId} shows no travel time`).not.toMatch(DURATION_PATTERN)
      }
      await expect(page.getByText(/481\s*ч/)).toHaveCount(0)

      // «Итог маршрута»: чип и две плитки — «Дистанция по прямой» и «Остановки».
      const summary = page.getByTestId('route-summary').first()
      await expect(summary.getByTestId('route-summary-approximate')).toHaveCount(1)
      await expect(summary.getByTestId('route-summary-metric-duration')).toHaveCount(0)
      await expect(summary.getByTestId('route-summary-metric-elevation')).toHaveCount(0)
      await expect(summary.getByTestId('route-summary-metric-distance-label')).toHaveText('Дистанция по прямой')
      await expect(summary.getByTestId('route-summary-metric-stops-value')).toHaveText(String(savedPoints.length))

      // «Файл маршрута» говорит про экспорт одной короткой строкой.
      await expect(
        page.getByTestId('route-builder-route-file').first().getByTestId('trip-route-download-approximate'),
      ).toHaveText('Линия приблизительная — в файле будут прямые отрезки.')

      await page.screenshot({ path: testInfo.outputPath(`degraded-route-${viewport.width}.png`) })
    })
  }
})

/**
 * #2065 — «Повторить» рядом с причиной деградации СОХРАНЁННОГО маршрута:
 * временная причина (ORS 5xx) показывает кнопку на обеих поверхностях, клик
 * шлёт ровно один `POST /api/trips/{id}/route-summary/` с `force_refresh:true`.
 * Постоянная причина (404, спека выше) кнопки не получает — уже покрыто строкой
 * 204 (`getByRole('button', {name: /Повторить/})).toHaveCount(0)`).
 */
const RETRY_TRIP_ID = 205702

const retryTestIdByViewport: Record<(typeof VIEWPORTS)[number]['name'], string> = {
  'mobile-390': 'route-mobile-summary-retry',
  'desktop-1440': 'trip-plan-map-route-retry',
}

const temporaryWarning = {
  code: 'ors_http_502',
  message: 'ORS answered 502; direct-line fallback was used.',
}

const temporaryTripDto = {
  ...tripDto,
  id: RETRY_TRIP_ID,
  route_summary: { ...tripDto.route_summary },
  routing_state: {
    provider: 'direct',
    is_optimal: false,
    fallback_reason: 'ors_http_502',
    warnings: [temporaryWarning],
  },
}

async function mockOwnerTripWithTemporaryDegradation(page: Page, postBodies: unknown[]) {
  await ensureAuthedStorageFallback(page)
  await mockFakeAuthApis(page)
  await seedConsent(page)

  await page.route('**/proxy/tiles/osm/**', (route) =>
    route.fulfill({ status: 200, contentType: 'image/png', body: TRANSPARENT_PNG }),
  )
  await page.route('**/api/trips/route-templates/', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
  )
  await page.route(`**/api/trips/planned/${RETRY_TRIP_ID}/routes/`, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
  )
  await page.route(`**/api/trips/${RETRY_TRIP_ID}/route-summary/`, async (route) => {
    const request = route.request()
    if (request.method() === 'POST') {
      postBodies.push(request.postDataJSON())
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        trip: RETRY_TRIP_ID,
        provider: 'direct',
        status: 'degraded',
        ascent_m: null,
        descent_m: null,
        polyline: null,
        is_optimal: false,
        fallback_reason: 'ors_http_502',
        warnings: [temporaryWarning],
      }),
    })
  })
  await page.route(`**/api/trips/planned/${RETRY_TRIP_ID}/`, async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback()
      return
    }
    await waitForFakeAuth(page)
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(temporaryTripDto),
    })
  })
  await page.route('**/api/routing/route/', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        geometry: temporaryTripDto.route_geometry,
        distance_m: 2_429_001,
        duration_s: 1_735_001,
        provider: 'direct',
        is_optimal: false,
        fallback_reason: 'ors_http_502',
        warnings: [temporaryWarning],
      }),
    }),
  )
}

test.describe('Planned trip route tab — «Повторить» for a temporary saved-route degradation (#2065)', () => {
  for (const viewport of VIEWPORTS) {
    test(`${viewport.name}: ors_http_502 shows «Повторить», click sends one force_refresh POST`, async ({
      page,
    }) => {
      const postBodies: unknown[] = []
      await mockOwnerTripWithTemporaryDegradation(page, postBodies)
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      await page.goto(`/trips/plan/${RETRY_TRIP_ID}`, { waitUntil: 'domcontentloaded' })
      await waitForFakeAuth(page)

      const panel = page.getByTestId('trip-plan-panel-route').first()
      await expect(panel).toBeVisible({ timeout: 30_000 })
      await expect(page.getByTestId(viewport.reasonTestId)).toBeVisible({ timeout: 30_000 })

      const retryButton = page.getByTestId(retryTestIdByViewport[viewport.name])
      await expect(retryButton).toBeVisible()
      await expect(retryButton).toBeEnabled()

      await retryButton.click()

      await expect.poll(() => postBodies.length, { timeout: 15_000 }).toBe(1)
      expect(postBodies[0]).toEqual({ provider: 'ors', force_refresh: true })
      await expect(retryButton).toBeDisabled()
    })
  }
})
