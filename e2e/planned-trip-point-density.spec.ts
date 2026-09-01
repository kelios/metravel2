import type { Page } from '@playwright/test'

import { expect, test } from './fixtures'
import { ensureAuthedStorageFallback, mockFakeAuthApis } from './helpers/auth'

/**
 * #1671 — плотность карточки точки и блока «Профиль высот» в плане поездки.
 *
 * На скрине владельца (iPhone, 31.08.2026) координаты «56.006732, 26.247111»
 * переносились по цифрам на четыре строки, а блок высот печатал одни и те же
 * значения в подзаголовке и в шести плитках и занимал половину экрана.
 * Спека держит обе границы на реальной странице: узкая раскладка — координаты
 * одной строкой и три плитки без строки итогов, широкая — прежний полный набор.
 */

const TRIP_ID = 167101
const TRANSPARENT_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
)

// Реальный фрагмент production-ответа `/api/trips/{id}/route-summary/` после
// ORS-пересчёта: полилиния кодирует высоты, поэтому профиль рисуется целиком.
const ORS_ELEVATION_POLYLINE =
  'yv{kHalwxBk{~CFl@hA?Zp@IVr@BZzIFJ?HF?H??HG?HO?@U?AA?CQsIOM{@'

// Координаты со скрина владельца. Точка намеренно без названия: тогда строка
// координат и есть содержимое карточки.
const UNNAMED_POINT_LAT = 56.006732
const UNNAMED_POINT_LNG = 26.247111
const EXPECTED_COORDINATES = '56.00673, 26.24711'

const savedPoints = [
  {
    id: 1,
    point_type: 'custom',
    order: 1,
    title: '',
    description: '',
    lat: UNNAMED_POINT_LAT,
    lng: UNNAMED_POINT_LNG,
  },
  {
    id: 2,
    point_type: 'custom',
    order: 2,
    title: 'Друя',
    description: '',
    lat: 55.7896,
    lng: 27.4712,
  },
]

const tripDto = {
  id: TRIP_ID,
  title: 'E2E плотность карточки точки',
  description: '',
  start_date: '2026-09-10T09:00:00',
  status: 'planned',
  transport_mode: 'bike',
  bike_type: 'regular',
  owner: 1,
  participants: [],
  route: { points: savedPoints },
  route_geometry: null,
  route_summary: {
    distance_km: 16.5,
    duration_min: 30,
    elevation_gain_m: 452,
    stops_count: savedPoints.length,
    provider: 'ors',
  },
  routing_state: {
    provider: 'ors',
    is_optimal: true,
    fallback_reason: null,
    warnings: [],
  },
  is_public: false,
  max_participants: 4,
}

const routeSummaryDto = {
  trip: TRIP_ID,
  distance_m: 16543,
  duration_s: 1806,
  ascent_m: 452,
  descent_m: 270,
  stops_count: savedPoints.length,
  provider: 'ors',
  status: 'ready',
  geometry: null,
  polyline: ORS_ELEVATION_POLYLINE,
  bounds: { south: 49.29, west: 19.94, north: 49.33, east: 20.11 },
  calculated_at: '2026-08-08T19:11:29.496990+00:00',
}

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

async function mockPlannedTrip(page: Page) {
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
      body: JSON.stringify(routeSummaryDto),
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
  await page.route('**/api/routing/route/', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        geometry: savedPoints.map(({ lat, lng }) => [lng, lat]),
        distance_m: 16_543,
        duration_s: 1_806,
        provider: 'ors',
        is_optimal: true,
        fallback_reason: null,
        warnings: [],
      }),
    }),
  )
}

const openPlan = async (page: Page, viewport: { width: number; height: number }) => {
  await mockPlannedTrip(page)
  await page.setViewportSize(viewport)
  await page.goto(`/trips/plan/${TRIP_ID}`, { waitUntil: 'domcontentloaded' })
  await waitForFakeAuth(page)

  // На узкой раскладке план открывается map-first: список точек и профиль
  // высот живут в шторке, свёрнутой до сводки. Геометрию она считает и
  // свёрнутой, но снимок без разворота показал бы карту, а не блоки.
  // Ручка циклическая (summary → points → full → summary) и высота
  // анимируется, поэтому цель проверяется по факту: первая точка целиком в
  // кадре. Широкая раскладка шторки не имеет и цикл не заходит.
  const row = page.getByTestId('route-builder-point-0').first()
  await expect(row).toBeVisible({ timeout: 30_000 })

  const rowFullyVisible = async () => {
    const box = await row.boundingBox()
    return !!box && box.y >= 0 && box.y + box.height <= viewport.height
  }

  const handle = page.getByTestId('route-sheet-handle')
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (await rowFullyVisible()) break
    if (!(await handle.isVisible().catch(() => false))) break
    await handle.click()
    await page.waitForTimeout(800)
  }
}

/**
 * Снимок элемента осмысленен только после того, как он реально в кадре.
 * `scrollIntoViewIfNeeded` крутит страницу, а на узкой раскладке блоки лежат
 * в собственном скроллере шторки — доводим нативным `scrollIntoView`, который
 * прокручивает всех предков.
 */
const shoot = async (page: Page, locator: ReturnType<Page['getByTestId']>, path: string) => {
  await locator.evaluate((node) =>
    node.scrollIntoView({ block: 'center', inline: 'nearest' }),
  )
  await expect(locator).toBeInViewport({ ratio: 0.9, timeout: 10_000 })
  await locator.screenshot({ path })
}

const coordinatesLine = (page: Page) =>
  page.getByText(EXPECTED_COORDINATES, { exact: true }).first()

const summaryCards = (page: Page) =>
  page.getByTestId('route-elevation-summary-cards').first()

test.describe('Planned trip point density (#1671)', () => {
  test('mobile-390: coordinates stay on one line and the elevation block drops its duplicate summary', async ({
    page,
  }) => {
    await openPlan(page, { width: 390, height: 844 })

    const coordinates = coordinatesLine(page)
    await expect(coordinates).toBeVisible({ timeout: 30_000 })

    // Одна строка — это высота бокса, не длина текста: на скрине владельца
    // строка занимала четыре строки при том же содержимом.
    const lineMetrics = await coordinates.evaluate((node) => {
      const style = getComputedStyle(node)
      return {
        height: node.getBoundingClientRect().height,
        lineHeight: parseFloat(style.lineHeight),
        clientLines: Math.round(
          node.getBoundingClientRect().height / parseFloat(style.lineHeight),
        ),
      }
    })
    expect(lineMetrics.clientLines).toBe(1)

    const profile = page.getByTestId('route-elevation-profile').first()
    await expect(profile).toBeVisible({ timeout: 30_000 })

    // Строка итогов повторяла плитки цифра в цифру — на узкой раскладке её нет.
    await expect(profile.getByText(/м набора/)).toHaveCount(0)
    await expect(summaryCards(page).getByText('Дистанция')).toBeVisible()
    await expect(summaryCards(page).getByText('Набор')).toBeVisible()
    await expect(summaryCards(page).getByText('Перепад')).toBeVisible()
    await expect(summaryCards(page).getByText('Сброс')).toHaveCount(0)
    await expect(summaryCards(page).getByText('Мин высота')).toHaveCount(0)
    await expect(summaryCards(page).getByText('Макс высота')).toHaveCount(0)

    // Ключевые значения — одним рядом, а не сеткой в три ряда.
    const cardRows = await summaryCards(page).evaluate((grid) => {
      const tops = Array.from(grid.children).map(
        (child) => Math.round((child as HTMLElement).getBoundingClientRect().top),
      )
      return new Set(tops).size
    })
    expect(cardRows).toBe(1)

    // Замер на этом же стенде: до правки блок занимал 708 px при экране 844
    // (шапка с подзаголовком 96 + шесть плиток в две колонки 286 + график 132
    // + карточки ключевых точек 124), после — 430 px. Порог держит достигнутое
    // и ловит откат к сетке в три ряда. Треть экрана (281 px) недостижима без
    // удаления графика или карточек «Старт/Высшая точка/Финиш» — это контент,
    // а не дублирование, и решение по нему за владельцем.
    const profileHeight = (await profile.boundingBox())?.height ?? Number.POSITIVE_INFINITY
    expect(profileHeight).toBeLessThan(470)

    // Доказательство владельцу — сами элементы, а не верх страницы: карточка
    // точки и блок высот на 390pt лежат ниже первого экрана.
    await shoot(
      page,
      page.getByTestId('route-builder-point-0').first(),
      'e2e/__screenshots__/planned-trip-point-card-390.png',
    )
    await shoot(page, profile, 'e2e/__screenshots__/planned-trip-elevation-390.png')
  })

  test('desktop-1280: keeps the full tile set and the summary line', async ({ page }) => {
    await openPlan(page, { width: 1280, height: 900 })

    await expect(coordinatesLine(page)).toBeVisible({ timeout: 30_000 })

    const profile = page.getByTestId('route-elevation-profile').first()
    await expect(profile).toBeVisible({ timeout: 30_000 })
    await expect(profile.getByText(/м набора/).first()).toBeVisible()

    for (const label of [
      'Дистанция',
      'Набор',
      'Сброс',
      'Мин высота',
      'Макс высота',
      'Перепад',
    ]) {
      await expect(summaryCards(page).getByText(label)).toBeVisible()
    }

    await shoot(
      page,
      page.getByTestId('route-builder-point-0').first(),
      'e2e/__screenshots__/planned-trip-point-card-1280.png',
    )
    await shoot(page, profile, 'e2e/__screenshots__/planned-trip-elevation-1280.png')
  })
})
